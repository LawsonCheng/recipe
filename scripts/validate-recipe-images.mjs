#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const publicRoot = resolve(root, "public");
const manifestPath = resolve(root, "public/assets/generated/manifest.json");
const recipePath = resolve(root, "src/data/recipes.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const recipes = JSON.parse(await readFile(recipePath, "utf8"));
const writeAutomatedQa = process.argv.includes("--write-automated-qa");
const jsonPath = process.argv
  .find((argument) => argument.startsWith("--json="))
  ?.slice("--json=".length);

const expectedHeroes = recipes.length;
const expectedSteps = recipes.reduce(
  (count, recipe) => count + (recipe.steps?.length ?? 0),
  0,
);
const expectedAssets = expectedHeroes + expectedSteps;
const MIN_ENTROPY = 6.0;
const MIN_QUANTIZED_COLOURS = 64;
const REVIEW_QUANTIZED_COLOURS = 220;
const MAX_DHASH_DISTANCE = 2;
const FORBIDDEN_GENERATOR = /local|template|svg|placeholder|procedural/i;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const popcount64 = (value) => {
  let count = 0;
  while (value) {
    value &= value - 1n;
    count += 1;
  }
  return count;
};

async function inspectImage(filePath) {
  const buffer = await readFile(filePath);
  const [metadata, stats, sample, hashPixels] = await Promise.all([
    sharp(buffer).metadata(),
    sharp(buffer).stats(),
    sharp(buffer).resize(96, 72, { fit: "fill" }).removeAlpha().raw().toBuffer(),
    sharp(buffer).greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer(),
  ]);
  const quantizedColours = new Set();
  for (let index = 0; index < sample.length; index += 3) {
    quantizedColours.add(
      `${sample[index] >> 4},${sample[index + 1] >> 4},${sample[index + 2] >> 4}`,
    );
  }
  let dHash = 0n;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      dHash <<= 1n;
      if (hashPixels[y * 9 + x] > hashPixels[y * 9 + x + 1]) dHash |= 1n;
    }
  }
  return {
    buffer,
    metadata,
    entropy: stats.entropy,
    quantizedColours: quantizedColours.size,
    dHash,
  };
}

const assets = manifest.assets ?? [];
const results = [];
const globalErrors = [];
if (manifest.schemaVersion !== 2) {
  globalErrors.push(`Manifest schema must be 2; found ${manifest.schemaVersion}`);
}
if (assets.length !== expectedAssets) {
  globalErrors.push(`Expected ${expectedAssets} manifest assets; found ${assets.length}`);
}
if (
  manifest.summary?.heroCount !== expectedHeroes ||
  manifest.summary?.stepCount !== expectedSteps ||
  manifest.summary?.assetCount !== expectedAssets
) {
  globalErrors.push(
    `Manifest summary is stale; expected heroes=${expectedHeroes}, steps=${expectedSteps}, assets=${expectedAssets}`,
  );
}

let cursor = 0;
const concurrency = 12;
async function worker() {
  while (cursor < assets.length) {
    const asset = assets[cursor++];
    const errors = [];
    const filePath = resolve(publicRoot, asset.publicPath.slice(1));
    let inspection;
    let fileStat;
    try {
      [inspection, fileStat] = await Promise.all([
        inspectImage(filePath),
        stat(filePath),
      ]);
    } catch (error) {
      results.push({
        asset,
        filePath,
        errors: [`missing or unreadable image (${error.code || error.message})`],
      });
      continue;
    }

    const { metadata, entropy, quantizedColours, buffer } = inspection;
    const digest = sha256(buffer);
    if (metadata.format !== "webp") errors.push(`expected WebP; found ${metadata.format}`);
    if (
      !metadata.width ||
      !metadata.height ||
      Math.abs(metadata.width / metadata.height - 4 / 3) > 0.03
    ) {
      errors.push(`expected 4:3; found ${metadata.width}x${metadata.height}`);
    }
    if (fileStat.size < 10_000) errors.push(`suspiciously small (${fileStat.size} bytes)`);
    if (entropy < MIN_ENTROPY) {
      errors.push(
        `low visual entropy ${entropy.toFixed(3)} < ${MIN_ENTROPY}; likely template/placeholder`,
      );
    }
    if (quantizedColours < MIN_QUANTIZED_COLOURS) {
      errors.push(
        `low colour complexity ${quantizedColours} < ${MIN_QUANTIZED_COLOURS}; likely template/placeholder`,
      );
    }

    const provenancePath = resolve(publicRoot, asset.provenancePath.slice(1));
    let provenance;
    try {
      provenance = JSON.parse(await readFile(provenancePath, "utf8"));
    } catch (error) {
      errors.push(`missing or unreadable provenance sidecar`);
    }
    if (provenance) {
      if (provenance.schemaVersion !== 1) errors.push("invalid provenance schema");
      if (provenance.assetId !== asset.assetId) errors.push("provenance assetId mismatch");
      if (provenance.publicPath !== asset.publicPath) errors.push("provenance publicPath mismatch");
      if (provenance.promptHash !== asset.promptHash) errors.push("prompt hash mismatch/stale image");
      if (
        !provenance.providerPromptHash ||
        provenance.providerPromptHash !== asset.providerPromptHash
      ) {
        errors.push("provider prompt hash mismatch/stale generation prompt");
      }
      if (!provenance.provider || !provenance.model) errors.push("provider/model missing");
      if (FORBIDDEN_GENERATOR.test(`${provenance.provider} ${provenance.model}`)) {
        errors.push("template/procedural generator is forbidden");
      }
      if (!Number.isFinite(Date.parse(provenance.generatedAt))) {
        errors.push("generatedAt is missing or invalid");
      }
      if (provenance.assetSHA256 !== digest) errors.push("asset SHA-256 mismatch");
      if (provenance.qa?.automated?.status !== "passed") {
        errors.push("automated QA status is not passed");
      }
      const visual = provenance.qa?.visual;
      const requiredVisualChecks = [
        "promptAlignment",
        "stepStateAccuracy",
        "equipmentAccuracy",
        "foodSafety",
        "noTextOrWatermark",
        "noPrematureLaterState",
        "photorealisticNotStylised",
      ];
      if (
        visual?.status !== "approved" ||
        visual?.reviewerType !== "independent-agent" ||
        !visual.reviewer ||
        !Number.isFinite(Date.parse(visual.reviewedAt)) ||
        requiredVisualChecks.some((key) => visual.checks?.[key] !== true)
      ) {
        errors.push("independent visual QA approval/checklist is incomplete");
      }
    }
    results.push({
      asset,
      filePath,
      provenancePath,
      provenance,
      digest,
      entropy,
      quantizedColours,
      dHash: inspection.dHash,
      errors,
    });
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));

// A 64-bit difference hash is a perceptual fingerprint. Very close hashes are
// not sufficient to reject a single image, but large near-duplicate groups are
// strong evidence of a recoloured/rearranged template family.
const nearDuplicatePairs = [];
const nearDuplicateAssets = new Set();
for (let left = 0; left < results.length; left += 1) {
  if (results[left].dHash == null) continue;
  for (let right = left + 1; right < results.length; right += 1) {
    if (results[right].dHash == null) continue;
    const distance = popcount64(results[left].dHash ^ results[right].dHash);
    if (distance <= MAX_DHASH_DISTANCE) {
      nearDuplicatePairs.push([
        results[left].asset.assetId,
        results[right].asset.assetId,
        distance,
      ]);
      nearDuplicateAssets.add(results[left].asset.assetId);
      nearDuplicateAssets.add(results[right].asset.assetId);
    }
  }
}
for (const result of results) {
  if (nearDuplicateAssets.has(result.asset.assetId)) {
    result.errors.push(
      `perceptual near-duplicate (dHash distance <= ${MAX_DHASH_DISTANCE})`,
    );
  }
}

const lowComplexity = results.filter(
  (result) =>
    result.entropy < MIN_ENTROPY ||
    result.quantizedColours < MIN_QUANTIZED_COLOURS,
);
const lowColourReview = results.filter(
  (result) =>
    Number.isFinite(result.quantizedColours) &&
    result.quantizedColours < REVIEW_QUANTIZED_COLOURS,
);
const missingProvenance = results.filter((result) => !result.provenance);
const visualPending = results.filter(
  (result) => result.provenance?.qa?.visual?.status !== "approved",
);
const failed = results.filter((result) => result.errors.length > 0);
const report = {
  generatedAt: new Date().toISOString(),
  status: globalErrors.length || failed.length ? "FAIL" : "PASS",
  thresholds: {
    minimumEntropy: MIN_ENTROPY,
    minimumQuantizedColours: MIN_QUANTIZED_COLOURS,
    perceptualHash: "64-bit dHash",
    maximumNearDuplicateDistance: MAX_DHASH_DISTANCE,
    reviewQuantizedColoursBelow: REVIEW_QUANTIZED_COLOURS,
  },
  counts: {
    expected: expectedAssets,
    inspected: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    lowComplexity: lowComplexity.length,
    lowColourReview: lowColourReview.length,
    missingProvenance: missingProvenance.length,
    independentVisualApprovalIncomplete: visualPending.length,
    perceptualNearDuplicateAssets: nearDuplicateAssets.size,
    perceptualNearDuplicatePairs: nearDuplicatePairs.length,
  },
  globalErrors,
  failures: failed.slice(0, 100).map((result) => ({
    assetId: result.asset.assetId,
    errors: result.errors,
    metrics: {
      entropy: result.entropy,
      quantizedColours: result.quantizedColours,
    },
  })),
  nearDuplicateExamples: nearDuplicatePairs.slice(0, 50),
};

if (jsonPath) {
  await writeFile(resolve(root, jsonPath), `${JSON.stringify(report, null, 2)}\n`);
}

if (writeAutomatedQa) {
  let written = 0;
  for (const result of results) {
    if (!result.provenance) continue;
    const automatedErrors = result.errors.filter(
      (error) =>
        error !== "automated QA status is not passed" &&
        error !== "independent visual QA approval/checklist is incomplete",
    );
    result.provenance.qa.automated = {
      status: automatedErrors.length ? "failed" : "passed",
      checkedAt: report.generatedAt,
      reportVersion: "production-image-gate/v1",
      metrics: {
        entropy: result.entropy,
        quantizedColours: result.quantizedColours,
        dHash64: result.dHash.toString(16).padStart(16, "0"),
      },
      errors: automatedErrors,
    };
    await writeFile(
      result.provenancePath,
      `${JSON.stringify(result.provenance, null, 2)}\n`,
    );
    written += 1;
  }
  console.log(`Updated automated QA in ${written} truthful provenance sidecars.`);
}

console.log(`Production image gate: ${report.status}`);
console.log(`Inspected: ${report.counts.inspected}/${report.counts.expected}`);
console.log(`Low-complexity/template-like: ${report.counts.lowComplexity}`);
console.log(`Low-colour images for visual review: ${report.counts.lowColourReview}`);
console.log(`Missing provenance: ${report.counts.missingProvenance}`);
console.log(
  `Independent visual approval incomplete: ${report.counts.independentVisualApprovalIncomplete}`,
);
console.log(
  `Perceptual near-duplicates: ${report.counts.perceptualNearDuplicateAssets} assets / ` +
    `${report.counts.perceptualNearDuplicatePairs} pairs`,
);
if (failed.length) {
  console.error("\nFirst failures:");
  for (const item of report.failures.slice(0, 12)) {
    console.error(`- ${item.assetId}: ${item.errors.join("; ")}`);
  }
}
if (report.status === "FAIL") process.exitCode = 1;
