#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  await readFile(resolve(root, "tmp/image-generation-manifest.json"), "utf8"),
);
const outputArgument = process.argv
  .find((argument) => argument.startsWith("--json="))
  ?.slice("--json=".length);
const outputPath = resolve(root, outputArgument || "tmp/staged-image-qa.json");
const MIN_ENTROPY = 6;
const MIN_QUANTIZED_COLOURS = 64;
const REVIEW_QUANTIZED_COLOURS = 220;
const MAX_DHASH_DISTANCE = 2;
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const popcount64 = (value) => {
  let count = 0;
  while (value) {
    value &= value - 1n;
    count += 1;
  }
  return count;
};

const metadataByRecipe = new Map();
async function recipeMetadata(recipeId) {
  if (!metadataByRecipe.has(recipeId)) {
    metadataByRecipe.set(
      recipeId,
      readFile(resolve(root, ".incoming-images", recipeId, "metadata.json"), "utf8")
        .then(JSON.parse)
        .catch(() => []),
    );
  }
  return metadataByRecipe.get(recipeId);
}

const results = [];
let cursor = 0;
async function worker() {
  while (cursor < manifest.assets.length) {
    const asset = manifest.assets[cursor++];
    const [recipeId, kind] = asset.assetId.split(":");
    const input = resolve(root, ".incoming-images", recipeId, `${kind}.png`);
    const errors = [];
    const rows = await recipeMetadata(recipeId);
    const receipt = rows.find((row) => row.assetId === asset.assetId);
    if (!receipt) errors.push("missing staging receipt");
    if (receipt?.providerPromptHash !== asset.providerPromptHash) {
      errors.push("provider prompt hash mismatch");
    }
    if (receipt?.provider !== "OpenAI") errors.push("unexpected provider");
    if (receipt?.model !== "Codex built-in imagegen") errors.push("unexpected model");
    if (
      !/^(?:exec-[0-9a-f-]{36}|call_[A-Za-z0-9]+)(?:\.(?:png|jpe?g|webp))?$/.test(
        receipt?.providerAssetId || "",
      )
    ) {
      errors.push("invalid provider asset id");
    }
    if (!Number.isFinite(Date.parse(receipt?.generatedAt || ""))) {
      errors.push("invalid generatedAt");
    }

    try {
      const [buffer, fileStat] = await Promise.all([readFile(input), stat(input)]);
      const [imageMetadata, imageStats, sample, hashPixels] = await Promise.all([
        sharp(buffer).metadata(),
        sharp(buffer).stats(),
        sharp(buffer).resize(96, 72, { fit: "fill" }).removeAlpha().raw().toBuffer(),
        sharp(buffer).greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer(),
      ]);
      if (
        !imageMetadata.width ||
        !imageMetadata.height ||
        Math.abs(imageMetadata.width / imageMetadata.height - 4 / 3) > 0.03
      ) {
        errors.push(
          `expected 4:3; found ${imageMetadata.width}x${imageMetadata.height}`,
        );
      }
      if (imageMetadata.width < 1200 || imageMetadata.height < 900) {
        errors.push(
          `resolution below 1200x900 (${imageMetadata.width}x${imageMetadata.height})`,
        );
      }
      if (fileStat.size < 10_000) errors.push(`suspiciously small (${fileStat.size})`);
      const quantizedColours = new Set();
      for (let index = 0; index < sample.length; index += 3) {
        quantizedColours.add(
          `${sample[index] >> 4},${sample[index + 1] >> 4},${sample[index + 2] >> 4}`,
        );
      }
      if (imageStats.entropy < MIN_ENTROPY) {
        errors.push(`low entropy ${imageStats.entropy.toFixed(3)}`);
      }
      if (quantizedColours.size < MIN_QUANTIZED_COLOURS) {
        errors.push(`low colour complexity ${quantizedColours.size}`);
      }
      let dHash = 0n;
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          dHash <<= 1n;
          if (hashPixels[y * 9 + x] > hashPixels[y * 9 + x + 1]) dHash |= 1n;
        }
      }
      results.push({
        assetId: asset.assetId,
        errors,
        sha256: sha256(buffer),
        dHash,
        entropy: imageStats.entropy,
        quantizedColours: quantizedColours.size,
        width: imageMetadata.width,
        height: imageMetadata.height,
      });
    } catch (error) {
      errors.push(`missing or unreadable staged image (${error.code || error.message})`);
      results.push({ assetId: asset.assetId, errors });
    }
  }
}

await Promise.all(Array.from({ length: 12 }, () => worker()));
results.sort((left, right) => left.assetId.localeCompare(right.assetId));

const exactGroups = new Map();
for (const result of results) {
  if (!result.sha256) continue;
  const group = exactGroups.get(result.sha256) || [];
  group.push(result.assetId);
  exactGroups.set(result.sha256, group);
}
const exactDuplicates = [...exactGroups.values()].filter((group) => group.length > 1);
for (const group of exactDuplicates) {
  for (const assetId of group) {
    results.find((result) => result.assetId === assetId)?.errors.push(
      `exact duplicate: ${group.join(", ")}`,
    );
  }
}

const nearDuplicatePairs = [];
for (let left = 0; left < results.length; left += 1) {
  if (results[left].dHash == null) continue;
  for (let right = left + 1; right < results.length; right += 1) {
    if (results[right].dHash == null) continue;
    const distance = popcount64(results[left].dHash ^ results[right].dHash);
    if (distance <= MAX_DHASH_DISTANCE) {
      nearDuplicatePairs.push([
        results[left].assetId,
        results[right].assetId,
        distance,
      ]);
    }
  }
}

const failures = results.filter((result) => result.errors.length);
const lowColourReview = results
  .filter(
    (result) =>
      Number.isFinite(result.quantizedColours) &&
      result.quantizedColours < REVIEW_QUANTIZED_COLOURS,
  )
  .map(({ assetId, quantizedColours }) => ({ assetId, quantizedColours }));
const report = {
  generatedAt: new Date().toISOString(),
  status: failures.length || exactDuplicates.length ? "FAIL" : "PASS",
  counts: {
    expected: manifest.assets.length,
    inspected: results.length,
    passed: results.length - failures.length,
    failed: failures.length,
    exactDuplicateGroups: exactDuplicates.length,
    nearDuplicatePairs: nearDuplicatePairs.length,
    lowColourReview: lowColourReview.length,
  },
  thresholds: {
    minimumEntropy: MIN_ENTROPY,
    minimumQuantizedColours: MIN_QUANTIZED_COLOURS,
    maximumReportedDHashDistance: MAX_DHASH_DISTANCE,
    reviewQuantizedColoursBelow: REVIEW_QUANTIZED_COLOURS,
  },
  failures: failures.map(({ assetId, errors }) => ({ assetId, errors })),
  exactDuplicates,
  nearDuplicatePairs,
  lowColourReview,
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Staged image QA: ${report.status}`);
console.log(`Inspected: ${results.length}/${manifest.assets.length}`);
console.log(`Failures: ${failures.length}`);
console.log(`Exact duplicate groups: ${exactDuplicates.length}`);
console.log(`Near-duplicate pairs for visual review: ${nearDuplicatePairs.length}`);
console.log(`Low-colour images for visual review: ${lowColourReview.length}`);
console.log(`Report: ${outputPath}`);
if (report.status !== "PASS") process.exitCode = 1;
