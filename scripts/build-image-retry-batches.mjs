#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const summary = JSON.parse(
  await readFile(resolve(root, "tmp/visual-qa/first-pass-summary.json"), "utf8"),
);
const batchCount = Number(
  process.argv
    .find((argument) => argument.startsWith("--batches="))
    ?.slice("--batches=".length) ?? 4,
);
if (!Number.isInteger(batchCount) || batchCount < 1 || batchCount > 16) {
  throw new Error("--batches must be an integer from 1 to 16");
}

const groups = new Map();
for (const assetId of summary.blockedAssetIds ?? []) {
  const recipeId = assetId.split(":")[0];
  const group = groups.get(recipeId) ?? [];
  group.push(assetId);
  groups.set(recipeId, group);
}
const batches = Array.from({ length: batchCount }, (_, index) => ({
  batch: index + 1,
  assetIds: [],
  recipeIds: [],
}));
for (const [recipeId, assetIds] of [...groups.entries()].sort(
  (left, right) =>
    right[1].length - left[1].length || left[0].localeCompare(right[0]),
)) {
  const batch = [...batches].sort(
    (left, right) =>
      left.assetIds.length - right.assetIds.length || left.batch - right.batch,
  )[0];
  batch.recipeIds.push(recipeId);
  batch.assetIds.push(...assetIds);
}
for (const batch of batches) {
  batch.recipeIds.sort();
  batch.assetIds.sort();
  batch.count = batch.assetIds.length;
}

const outputPath = resolve(root, "tmp/visual-qa/retry-batches.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(batches, null, 2)}\n`);
console.log(
  `Wrote ${batches.length} retry batches: ${batches
    .map((batch) => batch.count)
    .join(", ")}`,
);
