#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const argumentsList = process.argv.slice(2);
const inputs = argumentsList.filter((value) => !value.startsWith("--cross="));
const crossInputs = argumentsList
  .filter((value) => value.startsWith("--cross="))
  .map((value) => value.slice("--cross=".length));
if (!inputs.length) {
  throw new Error(
    "Pass every first-pass report and each cross-review as --cross=path",
  );
}
const manifestPath = resolve(root, "public/assets/generated/manifest.json");
const manifestBuffer = await readFile(manifestPath);
const manifest = JSON.parse(manifestBuffer);
const manifestSha256 = createHash("sha256").update(manifestBuffer).digest("hex");
const records = new Map();
const baselineReportInputs = [];
const requiredChecks = [
  "promptAlignment",
  "stepStateAccuracy",
  "equipmentAccuracy",
  "foodSafety",
  "noTextOrWatermark",
  "noPrematureLaterState",
  "photorealisticNotStylised",
];

for (const input of inputs) {
  const reportPath = resolve(root, input);
  const reportBuffer = await readFile(reportPath);
  const report = JSON.parse(reportBuffer);
  baselineReportInputs.push({
    path: relative(root, reportPath),
    role: "first-pass",
    sha256: createHash("sha256").update(reportBuffer).digest("hex"),
  });
  if (report.reviewerType !== "independent-agent" || !report.reviewer) {
    throw new Error(`${input}: invalid independent reviewer identity`);
  }
  if (!Number.isFinite(Date.parse(report.reviewedAt))) {
    throw new Error(`${input}: invalid reviewedAt`);
  }
  if (report.manifestSha256 !== manifestSha256) {
    throw new Error(`${input}: report does not match the current manifest`);
  }
  for (const record of report.records ?? []) {
    if (!["approved", "blocked"].includes(record.status)) {
      throw new Error(`${input}: invalid first-pass status for ${record.assetId}`);
    }
    if (
      requiredChecks.some(
        (check) => typeof record.checks?.[check] !== "boolean",
      )
    ) {
      throw new Error(`${input}: incomplete checklist for ${record.assetId}`);
    }
    const failedChecks = requiredChecks.filter(
      (check) => record.checks[check] !== true,
    );
    if (
      (record.status === "approved" && failedChecks.length) ||
      (record.status === "blocked" && !failedChecks.length)
    ) {
      throw new Error(
        `${input}: status/checklist mismatch for ${record.assetId}`,
      );
    }
    if (records.has(record.assetId)) {
      throw new Error(`Duplicate visual record: ${record.assetId}`);
    }
    records.set(record.assetId, {
      ...record,
      reviewer: report.reviewer,
      reviewerType: report.reviewerType,
      reviewedAt: report.reviewedAt,
    });
  }
}
const missing = manifest.assets.filter((asset) => !records.has(asset.assetId));
if (missing.length) {
  throw new Error(`Missing ${missing.length} first-pass visual records`);
}
const knownAssetIds = new Set(manifest.assets.map((asset) => asset.assetId));
const unknown = [...records.keys()].filter(
  (assetId) => !knownAssetIds.has(assetId),
);
if (unknown.length) {
  throw new Error(`Found ${unknown.length} unknown first-pass visual records`);
}

const primaryBlocked = [...records.values()].filter(
  (record) => record.status === "blocked",
);
const crossReviews = new Map();
for (const input of crossInputs) {
  const filename = resolve(root, input);
  const reportBuffer = await readFile(filename);
  const report = JSON.parse(reportBuffer);
  baselineReportInputs.push({
    path: relative(root, filename),
    role: "cross-review",
    sha256: createHash("sha256").update(reportBuffer).digest("hex"),
  });
  if (report.reviewerType !== "independent-agent" || !report.reviewer) {
    throw new Error(`${filename}: invalid independent reviewer identity`);
  }
  if (!Number.isFinite(Date.parse(report.reviewedAt))) {
    throw new Error(`${filename}: invalid reviewedAt`);
  }
  if (report.manifestSha256 !== manifestSha256) {
    throw new Error(`${filename}: cross-review does not match current manifest`);
  }
  for (const record of report.records ?? []) {
    if (crossReviews.has(record.assetId)) {
      throw new Error(`Duplicate cross-review record: ${record.assetId}`);
    }
    if (!["confirm_block", "overturn_to_approved"].includes(record.status)) {
      throw new Error(`${filename}: invalid cross-review status for ${record.assetId}`);
    }
    crossReviews.set(record.assetId, {
      ...record,
      reviewer: report.reviewer,
      reviewerType: report.reviewerType,
      reviewedAt: report.reviewedAt,
    });
  }
}
const primaryBlockedIds = new Set(primaryBlocked.map((record) => record.assetId));
const unexpectedCrossReviews = [...crossReviews.keys()].filter(
  (assetId) => !primaryBlockedIds.has(assetId),
);
if (unexpectedCrossReviews.length) {
  throw new Error(
    `Cross-review contains ${unexpectedCrossReviews.length} assets that were not first-pass blocked`,
  );
}
const missingCrossReviews = primaryBlocked.filter(
  (record) => !crossReviews.has(record.assetId),
);
if (missingCrossReviews.length) {
  throw new Error(
    `Missing ${missingCrossReviews.length} independent cross-reviews for blocked assets`,
  );
}
const sameReviewer = primaryBlocked.filter(
  (record) => crossReviews.get(record.assetId)?.reviewer === record.reviewer,
);
if (sameReviewer.length) {
  throw new Error(
    `${sameReviewer.length} blocked assets were cross-reviewed by the original reviewer`,
  );
}
const blocked = primaryBlocked.filter(
  (record) => crossReviews.get(record.assetId)?.status === "confirm_block",
);
const overturned = primaryBlocked.filter(
  (record) => crossReviews.get(record.assetId)?.status === "overturn_to_approved",
);
const constraints = Object.fromEntries(
  blocked.map((record) => [
    record.assetId,
    String(
      crossReviews.get(record.assetId)?.notes ||
        record.notes ||
        "The image failed independent visual alignment review.",
    )
      .trim()
      .replace(/\s+/g, " "),
  ]),
);
const constraintsPath = resolve(root, "scripts/image-visual-constraints.json");
const snapshotPath = resolve(root, "tmp/visual-qa/baseline-manifest.json");
const summaryPath = resolve(root, "tmp/visual-qa/first-pass-summary.json");
await mkdir(dirname(snapshotPath), { recursive: true });
await writeFile(constraintsPath, `${JSON.stringify(constraints, null, 2)}\n`);
const baselineManifest = structuredClone(manifest);
for (const asset of baselineManifest.assets) {
  const imageBuffer = await readFile(
    resolve(root, "public", asset.publicPath.slice(1)),
  );
  const actualAssetSha256 = createHash("sha256")
    .update(imageBuffer)
    .digest("hex");
  const provenance = JSON.parse(
    await readFile(
      resolve(root, "public", asset.provenancePath.slice(1)),
      "utf8",
    ),
  );
  if (
    provenance.assetId !== asset.assetId ||
    provenance.promptHash !== asset.promptHash ||
    provenance.providerPromptHash !== asset.providerPromptHash ||
    provenance.assetSHA256 !== actualAssetSha256
  ) {
    throw new Error(`${asset.assetId}: stale baseline image provenance`);
  }
  const firstPassReview = records.get(asset.assetId);
  if (
    !Number.isFinite(Date.parse(provenance.registeredAt)) ||
    Date.parse(provenance.registeredAt) > Date.parse(firstPassReview.reviewedAt)
  ) {
    throw new Error(
      `${asset.assetId}: production image was registered after first-pass review`,
    );
  }
  asset.assetSHA256 = actualAssetSha256;
}
const baselineSnapshot = Buffer.from(
  `${JSON.stringify(baselineManifest, null, 2)}\n`,
);
await writeFile(snapshotPath, baselineSnapshot);
await writeFile(
  summaryPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      manifestSha256,
      reviewed: records.size,
      approved: records.size - blocked.length,
      blocked: blocked.length,
      primaryBlocked: primaryBlocked.length,
      overturnedAfterCrossReview: overturned.length,
      blockedAssetIds: blocked.map((record) => record.assetId),
      overturnedAssetIds: overturned.map((record) => record.assetId),
      reportFiles: inputs,
      crossReviewFiles: crossInputs,
      baselineReportInputs: baselineReportInputs.sort((left, right) =>
        left.path.localeCompare(right.path),
      ),
      baselineSnapshotSha256: createHash("sha256")
        .update(baselineSnapshot)
        .digest("hex"),
    },
    null,
    2,
  )}\n`,
);
console.log(`Reviewed ${records.size}; blocked ${blocked.length}.`);
console.log(`Wrote ${constraintsPath}`);
console.log(`Snapshotted ${snapshotPath}`);
