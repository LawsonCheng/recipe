#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const argument = (name) => {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
};
const manifestPath = resolve(
  root,
  argument("manifest") || "public/assets/generated/manifest.json",
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const batch = Math.max(1, Number(argument("batch") || 50));
const offset = Math.max(0, Number(argument("offset") || 0));
const match = (argument("match") || "").toLowerCase();
const output = argument("output");
const includeBlocked = process.argv.includes("--include-blocked");

const candidates = manifest.assets.filter((asset) => {
  if (!includeBlocked && asset.qaStatus?.release === "eligible") return false;
  if (!match) return true;
  return `${asset.assetId} ${asset.recipeTitle?.en} ${asset.stepTitle?.en}`
    .toLowerCase()
    .includes(match);
});

const selected = candidates.slice(offset, offset + batch);
const rows = selected.map((asset) => ({
  schemaVersion: 1,
  assetId: asset.assetId,
  kind: asset.kind,
  promptHash: asset.promptHash,
  providerPromptHash: asset.providerPromptHash,
  generationPrompt: asset.generationPrompt.en,
  reviewContext: {
    recipe: asset.recipeTitle,
    stepNumber: asset.stepNumber,
    stepTitle: asset.stepTitle,
    stepInstruction: asset.stepInstruction,
    mainIngredient: asset.mainIngredient,
    visual: asset.visual,
  },
  requiredOutput: {
    format: "webp",
    width: 1200,
    height: 900,
    aspectRatio: "4:3",
    noText: true,
    noWatermark: true,
  },
  destination: asset.publicPath,
  registrationCommand:
    `node scripts/register-generated-image.mjs --asset-id=${asset.assetId} ` +
    "--input=<provider-output> --provider=<provider> --model=<model> " +
    "--generated-at=<ISO-8601> --provider-asset-id=<provider-id>",
}));

const jsonl = `${rows.map((row) => JSON.stringify(row)).join("\n")}${rows.length ? "\n" : ""}`;
if (output) {
  const outputPath = resolve(root, output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, jsonl, "utf8");
  console.log(`Wrote ${rows.length} production requests to ${outputPath}`);
} else {
  process.stdout.write(jsonl);
}
console.error(
  `Queue selection: ${rows.length}/${candidates.length} pending assets (offset ${offset}).`,
);
