#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const value = (name) =>
  process.argv
    .find((argument) => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const manifest = JSON.parse(
  await readFile(resolve(root, "tmp/image-generation-manifest.json"), "utf8"),
);
const idsFile = value("ids-file");
let requestedIds = null;
if (idsFile) {
  const parsed = JSON.parse(await readFile(resolve(root, idsFile), "utf8"));
  const ids = Array.isArray(parsed) ? parsed : parsed.blockedAssetIds;
  if (!Array.isArray(ids) || !ids.length) {
    throw new Error("--ids-file must contain an array or blockedAssetIds");
  }
  requestedIds = new Set(ids);
  if (requestedIds.size !== ids.length) {
    throw new Error("--ids-file contains duplicate asset IDs");
  }
}
const rows = [];
for (const asset of manifest.assets) {
  if (requestedIds && !requestedIds.has(asset.assetId)) continue;
  const [recipeId] = asset.assetId.split(":");
  const metadata = JSON.parse(
    await readFile(
      resolve(root, ".incoming-images", recipeId, "metadata.json"),
      "utf8",
    ),
  );
  const row = metadata.find((candidate) => candidate.assetId === asset.assetId);
  if (!row) throw new Error(`${asset.assetId}: missing staging receipt`);
  if (row.providerPromptHash !== asset.providerPromptHash) {
    throw new Error(`${asset.assetId}: staging receipt uses a stale prompt`);
  }
  rows.push(row);
}
if (requestedIds && rows.length !== requestedIds.size) {
  const manifestIds = new Set(manifest.assets.map((asset) => asset.assetId));
  const unknown = [...requestedIds].filter((assetId) => !manifestIds.has(assetId));
  throw new Error(
    `Could not build every requested row; unknown IDs: ${unknown.slice(0, 8)}`,
  );
}

const output = resolve(
  root,
  value("output") || "tmp/staged-registration-batch.json",
);
await writeFile(output, `${JSON.stringify(rows, null, 2)}\n`);
console.log(`Wrote ${rows.length} verified registration rows to ${output}`);
