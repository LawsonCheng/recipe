#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";

const batchFile = process.argv[2];
if (!batchFile) {
  throw new Error(
    "Usage: node scripts/register-generated-image-batch.mjs <generated-assets.json>",
  );
}

const rows = JSON.parse(await readFile(resolve(batchFile), "utf8"));
if (!Array.isArray(rows) || rows.length === 0) {
  throw new Error("Generated asset batch must be a non-empty JSON array");
}

const requiredFields = [
  "assetId",
  "input",
  "provider",
  "model",
  "generatedAt",
  "providerAssetId",
  "providerPromptHash",
];
const manifest = JSON.parse(
  await readFile(resolve(import.meta.dirname, "../public/assets/generated/manifest.json"), "utf8"),
);
const manifestById = new Map(
  (manifest.assets ?? []).map((asset) => [asset.assetId, asset]),
);
const seen = new Set();
for (const [index, row] of rows.entries()) {
  for (const field of requiredFields) {
    if (typeof row[field] !== "string" || !row[field].trim()) {
      throw new Error(`Row ${index + 1} is missing ${field}`);
    }
  }
  if (seen.has(row.assetId)) {
    throw new Error(`Duplicate assetId in batch: ${row.assetId}`);
  }
  const asset = manifestById.get(row.assetId);
  if (!asset) throw new Error(`Unknown assetId in batch: ${row.assetId}`);
  if (row.providerPromptHash !== asset.providerPromptHash) {
    throw new Error(
      `${row.assetId}: provider prompt hash is stale; regenerate this image from the current queue`,
    );
  }
  seen.add(row.assetId);
}

let registered = 0;
for (const row of rows) {
  const result = spawnSync(
    process.execPath,
    [
      resolve(import.meta.dirname, "register-generated-image.mjs"),
      `--asset-id=${row.assetId}`,
      `--input=${resolve(row.input)}`,
      `--provider=${row.provider}`,
      `--model=${row.model}`,
      `--generated-at=${row.generatedAt}`,
      `--provider-asset-id=${row.providerAssetId}`,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(
      `Batch stopped after ${registered}/${rows.length}; failed to register ${row.assetId}`,
    );
  }
  registered += 1;
  process.stdout.write(result.stdout);
}

console.log(
  `Registered ${registered} generated images. Automated and independent visual QA remain required.`,
);
