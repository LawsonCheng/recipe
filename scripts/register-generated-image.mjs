#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(root, "public/assets/generated/manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const value = (name) => {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
};
const required = (name) => {
  const result = value(name);
  if (!result) throw new Error(`Missing required --${name}=...`);
  return result;
};

const assetId = required("asset-id");
const input = resolve(process.cwd(), required("input"));
const provider = required("provider");
const model = required("model");
const generatedAt = required("generated-at");
const providerAssetId = required("provider-asset-id");
const asset = manifest.assets.find((item) => item.assetId === assetId);
if (!asset) throw new Error(`Unknown asset id: ${assetId}`);
if (!Number.isFinite(Date.parse(generatedAt))) {
  throw new Error("--generated-at must be a valid ISO-8601 timestamp");
}
if (/local|template|svg|placeholder|procedural/i.test(`${provider} ${model}`)) {
  throw new Error("Local/template/procedural renderers are forbidden in production");
}

const inputBuffer = await readFile(input);
const metadata = await sharp(inputBuffer).metadata();
if (!metadata.width || !metadata.height) throw new Error("Unreadable input image");
if (Math.abs(metadata.width / metadata.height - 4 / 3) > 0.03) {
  throw new Error(`Provider output must be 4:3; received ${metadata.width}x${metadata.height}`);
}

const outputPath = resolve(root, "public", asset.publicPath.slice(1));
const temporaryPath = `${outputPath}.incoming`;
await mkdir(dirname(outputPath), { recursive: true });
await sharp(inputBuffer)
  .resize(1200, 900, { fit: "cover" })
  .webp({ quality: 88, effort: 5, smartSubsample: true })
  .toFile(temporaryPath);
const productionBuffer = await readFile(temporaryPath);
const assetSHA256 = createHash("sha256").update(productionBuffer).digest("hex");
await rename(temporaryPath, outputPath);

const provenancePath = resolve(root, "public", asset.provenancePath.slice(1));
await mkdir(dirname(provenancePath), { recursive: true });
const provenance = {
  schemaVersion: 1,
  assetId,
  publicPath: asset.publicPath,
  promptHash: asset.promptHash,
  providerPromptHash: asset.providerPromptHash,
  provider,
  model,
  providerAssetId,
  generatedAt: new Date(generatedAt).toISOString(),
  registeredAt: new Date().toISOString(),
  assetSHA256,
  source: {
    inputFilename: input.split("/").at(-1),
    inputSHA256: createHash("sha256").update(inputBuffer).digest("hex"),
  },
  qa: {
    automated: {
      status: "pending",
      checkedAt: null,
      reportVersion: null,
    },
    visual: {
      status: "pending",
      reviewer: null,
      reviewerType: null,
      reviewedAt: null,
      checks: {
        promptAlignment: null,
        stepStateAccuracy: null,
        equipmentAccuracy: null,
        foodSafety: null,
        noTextOrWatermark: null,
        noPrematureLaterState: null,
        photorealisticNotStylised: null,
      },
      notes: "",
    },
  },
};
await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);

console.log(`Registered ${assetId}`);
console.log(`Image: ${outputPath}`);
console.log(`Provenance: ${provenancePath}`);
console.log(
  "Independent visual QA remains pending; this asset is not release eligible.",
);
