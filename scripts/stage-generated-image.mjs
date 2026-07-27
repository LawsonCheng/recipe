#!/usr/bin/env node

import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const value = (name) =>
  process.argv
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const required = (name) => {
  const result = value(name);
  if (!result) throw new Error(`Missing --${name}=...`);
  return result;
};

const manifestPath = resolve(
  root,
  value("manifest") || "tmp/image-generation-manifest.json",
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const assetId = required("asset-id");
const input = resolve(required("input"));
const provider = required("provider");
const model = required("model");
const generatedAt = new Date(required("generated-at")).toISOString();
const providerAssetId = required("provider-asset-id");
const providerPromptHash = required("provider-prompt-hash");
const transform = value("transform");
if (
  !/^(?:exec-[0-9a-f-]{36}|call_[A-Za-z0-9]+)(?:\.(?:png|jpe?g|webp))?$/.test(
    providerAssetId,
  )
) {
  throw new Error(`Invalid provider asset id: ${providerAssetId}`);
}
const asset = manifest.assets.find((candidate) => candidate.assetId === assetId);
if (!asset) throw new Error(`Unknown assetId in staging manifest: ${assetId}`);
if (asset.providerPromptHash !== providerPromptHash) {
  throw new Error(`${assetId}: provider prompt hash does not match staging manifest`);
}

const metadata = await sharp(input).metadata();
if (!metadata.width || !metadata.height) throw new Error("Unreadable provider image");
const sourceAspectRatio = metadata.width / metadata.height;
const isFourByThree = Math.abs(sourceAspectRatio - 4 / 3) <= 0.03;
const isApprovedThreeByTwoCrop =
  transform === "center-crop-4x3" &&
  Math.abs(sourceAspectRatio - 3 / 2) <= 0.03;
if (!isFourByThree && !isApprovedThreeByTwoCrop) {
  throw new Error(
    `${assetId}: staged input must be 4:3; received ${metadata.width}x${metadata.height}`,
  );
}

const [recipeId, kind] = assetId.split(":");
if (!/^recipe-\d{3}$/.test(recipeId) || !/^(?:hero|step-\d{2})$/.test(kind)) {
  throw new Error(`Unsafe assetId for staging: ${assetId}`);
}
const directory = resolve(root, ".incoming-images", recipeId);
const output = resolve(directory, `${kind}.png`);
const metadataPath = resolve(directory, "metadata.json");
await mkdir(directory, { recursive: true });
if (isApprovedThreeByTwoCrop) {
  await sharp(input)
    .resize(1200, 900, {
      fit: "cover",
      position: "centre",
      withoutEnlargement: true,
    })
    .png()
    .toFile(output);
} else {
  await copyFile(input, output);
}

let rows = [];
try {
  rows = JSON.parse(await readFile(metadataPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const row = {
  assetId,
  input: `.incoming-images/${recipeId}/${kind}.png`,
  provider,
  model,
  generatedAt,
  providerAssetId,
  providerPromptHash,
  stagedFrom: basename(input),
  ...(isApprovedThreeByTwoCrop
    ? {
        transform: {
          type: "center-crop-4x3",
          sourceWidth: metadata.width,
          sourceHeight: metadata.height,
          outputWidth: 1200,
          outputHeight: 900,
        },
      }
    : {}),
};
const existingIndex = rows.findIndex((candidate) => candidate.assetId === assetId);
if (existingIndex >= 0) rows[existingIndex] = row;
else rows.push(row);
rows.sort((left, right) => left.assetId.localeCompare(right.assetId));
await writeFile(metadataPath, `${JSON.stringify(rows, null, 2)}\n`);

console.log(`Staged ${assetId} -> ${output}`);
