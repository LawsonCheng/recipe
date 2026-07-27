#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(root, "public/assets/generated/manifest.json");
const manifestBuffer = await readFile(manifestPath);
const manifest = JSON.parse(manifestBuffer);
const manifestSha256 = createHash("sha256").update(manifestBuffer).digest("hex");
const inputs = process.argv.slice(2);
if (!inputs.length) {
  throw new Error("Pass one or more independent visual QA JSON files");
}

const requiredChecks = [
  "promptAlignment",
  "stepStateAccuracy",
  "equipmentAccuracy",
  "foodSafety",
  "noTextOrWatermark",
  "noPrematureLaterState",
  "photorealisticNotStylised",
];
const records = new Map();
for (const input of inputs) {
  const report = JSON.parse(await readFile(resolve(root, input), "utf8"));
  if (report.reviewerType !== "independent-agent" || !report.reviewer) {
    throw new Error(`${input}: invalid independent reviewer identity`);
  }
  if (report.manifestSha256 !== manifestSha256) {
    throw new Error(`${input}: visual review is stale for the current manifest`);
  }
  if (!Number.isFinite(Date.parse(report.reviewedAt))) {
    throw new Error(`${input}: invalid reviewedAt`);
  }
  for (const record of report.records ?? []) {
    if (records.has(record.assetId)) {
      throw new Error(`Duplicate visual review record: ${record.assetId}`);
    }
    records.set(record.assetId, {
      ...record,
      reviewer: record.reviewer || report.reviewer,
      reviewerType: record.reviewerType || report.reviewerType,
      reviewedAt: record.reviewedAt || report.reviewedAt,
    });
  }
}

const missing = manifest.assets
  .map((asset) => asset.assetId)
  .filter((assetId) => !records.has(assetId));
if (missing.length) {
  throw new Error(`Missing ${missing.length} visual review records: ${missing.slice(0, 8)}`);
}
const manifestAssetIds = new Set(manifest.assets.map((asset) => asset.assetId));
const unknown = [...records.keys()].filter(
  (assetId) => !manifestAssetIds.has(assetId),
);
if (unknown.length) {
  throw new Error(
    `Found ${unknown.length} unknown visual review records: ${unknown.slice(0, 8)}`,
  );
}
const blocked = [...records.values()].filter(
  (record) =>
    record.status !== "approved" ||
    requiredChecks.some((check) => record.checks?.[check] !== true),
);
if (blocked.length) {
  console.error(`Independent visual QA has ${blocked.length} blocked assets:`);
  for (const record of blocked.slice(0, 50)) {
    console.error(`- ${record.assetId}: ${record.notes || "failed checklist"}`);
  }
  process.exitCode = 1;
} else {
  const provenanceDirectory = resolve(
    root,
    "public/assets/generated/provenance",
  );
  const stagedDirectory = `${provenanceDirectory}.visual-qa-${process.pid}`;
  const backupDirectory = `${provenanceDirectory}.pre-visual-qa-${process.pid}`;
  const stagedWrites = [];
  for (const asset of manifest.assets) {
    const record = records.get(asset.assetId);
    if (
      record.reviewerType !== "independent-agent" ||
      !record.reviewer ||
      !Number.isFinite(Date.parse(record.reviewedAt))
    ) {
      throw new Error(`${asset.assetId}: invalid independent reviewer metadata`);
    }
    const provenancePath = resolve(root, "public", asset.provenancePath.slice(1));
    const provenance = JSON.parse(await readFile(provenancePath, "utf8"));
    const imageBuffer = await readFile(
      resolve(root, "public", asset.publicPath.slice(1)),
    );
    const actualAssetSha256 = createHash("sha256")
      .update(imageBuffer)
      .digest("hex");
    if (
      provenance.promptHash !== asset.promptHash ||
      provenance.providerPromptHash !== asset.providerPromptHash ||
      provenance.assetSHA256 !== actualAssetSha256 ||
      asset.assetSHA256 !== actualAssetSha256
    ) {
      throw new Error(`${asset.assetId}: cannot approve stale production provenance`);
    }
    if (
      provenance.qa?.automated?.status !== "passed" ||
      !provenance.qa?.visual
    ) {
      throw new Error(`${asset.assetId}: incomplete production QA provenance`);
    }
    provenance.qa.visual = {
      status: "approved",
      reviewer: record.reviewer,
      reviewerType: record.reviewerType,
      reviewedAt: record.reviewedAt,
      checks: Object.fromEntries(requiredChecks.map((check) => [check, true])),
      notes: record.notes || "",
    };
    stagedWrites.push({
      provenancePath,
      temporaryPath: resolve(stagedDirectory, basename(provenancePath)),
      contents: `${JSON.stringify(provenance, null, 2)}\n`,
    });
  }
  await mkdir(stagedDirectory, { recursive: false });
  let originalMoved = false;
  let replacementMoved = false;
  try {
    await Promise.all(
      stagedWrites.map(({ temporaryPath, contents }) =>
        writeFile(temporaryPath, contents, { flag: "wx" }),
      ),
    );
    await rename(provenanceDirectory, backupDirectory);
    originalMoved = true;
    await rename(stagedDirectory, provenanceDirectory);
    replacementMoved = true;
    await rm(backupDirectory, { recursive: true });
  } finally {
    if (originalMoved && !replacementMoved) {
      await rename(backupDirectory, provenanceDirectory);
    }
    await rm(stagedDirectory, { recursive: true, force: true });
  }
  console.log(`Applied independent visual QA to ${manifest.assets.length} assets.`);
}
