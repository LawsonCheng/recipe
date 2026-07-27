#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const visualQaDirectory = resolve(root, "tmp/visual-qa");
const baselinePath = resolve(visualQaDirectory, "baseline-manifest.json");
const summaryPath = resolve(visualQaDirectory, "first-pass-summary.json");
const currentManifestPath = resolve(root, "public/assets/generated/manifest.json");
const outputPath = resolve(visualQaDirectory, "final-consolidated.json");
const inputs = process.argv.slice(2);

if (!inputs.length) {
  throw new Error(
    "Pass every first-pass, cross-review, and retry visual QA report",
  );
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

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const baselineBuffer = await readFile(baselinePath);
const baselineManifest = JSON.parse(baselineBuffer);
const baselineSnapshotSha256 = sha256(baselineBuffer);
const summary = JSON.parse(await readFile(summaryPath, "utf8"));
const baselineSha256 = summary.manifestSha256;
const currentBuffer = await readFile(currentManifestPath);
const currentManifest = JSON.parse(currentBuffer);
const currentSha256 = sha256(currentBuffer);

if (summary.baselineSnapshotSha256 !== baselineSnapshotSha256) {
  throw new Error("First-pass summary and baseline snapshot do not match");
}

const reports = [];
for (const input of inputs) {
  const path = resolve(root, input);
  const reportBuffer = await readFile(path);
  const report = JSON.parse(reportBuffer);
  if (report.reviewerType !== "independent-agent" || !report.reviewer) {
    throw new Error(`${input}: invalid independent reviewer identity`);
  }
  if (!Number.isFinite(Date.parse(report.reviewedAt))) {
    throw new Error(`${input}: invalid reviewedAt`);
  }
  if (![baselineSha256, currentSha256].includes(report.manifestSha256)) {
    throw new Error(`${input}: report matches neither baseline nor current manifest`);
  }
  reports.push({
    input,
    normalizedPath: relative(root, path),
    reportSha256: sha256(reportBuffer),
    report,
  });
}

const expectedBaselineInputs = new Map(
  (summary.baselineReportInputs ?? []).map((entry) => [entry.path, entry]),
);
if (!expectedBaselineInputs.size) {
  throw new Error("First-pass summary does not bind baseline report contents");
}
const suppliedBaselineInputs = reports.filter(
  ({ report }) => report.manifestSha256 === baselineSha256,
);
for (const { normalizedPath, reportSha256, report } of suppliedBaselineInputs) {
  const expected = expectedBaselineInputs.get(normalizedPath);
  const role = (report.records ?? []).some((record) =>
    ["confirm_block", "overturn_to_approved"].includes(record.status),
  )
    ? "cross-review"
    : "first-pass";
  if (
    !expected ||
    expected.sha256 !== reportSha256 ||
    expected.role !== role
  ) {
    throw new Error(
      `${normalizedPath}: baseline report was not used to build the retry decision`,
    );
  }
}
const missingBoundInputs = [...expectedBaselineInputs.keys()].filter(
  (path) =>
    !suppliedBaselineInputs.some((report) => report.normalizedPath === path),
);
if (
  missingBoundInputs.length ||
  suppliedBaselineInputs.length !== expectedBaselineInputs.size
) {
  throw new Error("Consolidation requires the exact bound baseline report set");
}

const baselineAssets = new Map(
  baselineManifest.assets.map((asset) => [asset.assetId, asset]),
);
const currentAssets = new Map(
  currentManifest.assets.map((asset) => [asset.assetId, asset]),
);
if (
  baselineAssets.size !== currentAssets.size ||
  [...baselineAssets.keys()].some((assetId) => !currentAssets.has(assetId))
) {
  throw new Error("Baseline and current manifests do not contain the same assets");
}
for (const asset of baselineManifest.assets) {
  if (!/^[a-f0-9]{64}$/.test(asset.assetSHA256 || "")) {
    throw new Error(`${asset.assetId}: baseline snapshot lacks an asset SHA`);
  }
}
for (const asset of currentManifest.assets) {
  if (!/^[a-f0-9]{64}$/.test(asset.assetSHA256 || "")) {
    throw new Error(`${asset.assetId}: current manifest lacks an asset SHA`);
  }
}

const primary = new Map();
const crossReview = new Map();
const currentReview = new Map();

const saveUnique = (map, assetId, value, label) => {
  if (map.has(assetId)) {
    throw new Error(`Duplicate ${label} record: ${assetId}`);
  }
  map.set(assetId, value);
};

for (const { input, report } of reports) {
  for (const record of report.records ?? []) {
    if (!currentAssets.has(record.assetId)) {
      throw new Error(`${input}: unknown asset ${record.assetId}`);
    }
    const enriched = {
      ...record,
      reviewer: record.reviewer || report.reviewer,
      reviewerType: record.reviewerType || report.reviewerType,
      reviewedAt: record.reviewedAt || report.reviewedAt,
      sourceReport: input,
    };
    if (["confirm_block", "overturn_to_approved"].includes(record.status)) {
      if (report.manifestSha256 !== baselineSha256) {
        throw new Error(`${input}: cross-review must reference the baseline manifest`);
      }
      saveUnique(crossReview, record.assetId, enriched, "cross-review");
    } else if (report.manifestSha256 === baselineSha256) {
      saveUnique(primary, record.assetId, enriched, "first-pass");
    } else {
      saveUnique(currentReview, record.assetId, enriched, "retry");
    }
  }
}

const missingPrimary = [...baselineAssets.keys()].filter(
  (assetId) => !primary.has(assetId),
);
if (missingPrimary.length) {
  throw new Error(
    `Missing ${missingPrimary.length} first-pass records: ${missingPrimary.slice(0, 8)}`,
  );
}

const isApproved = (record) =>
  record?.status === "approved" &&
  requiredChecks.every((check) => record.checks?.[check] === true);
for (const [assetId, cross] of crossReview) {
  const firstPass = primary.get(assetId);
  if (!firstPass || firstPass.status !== "blocked") {
    throw new Error(`${assetId}: cross-review does not target a first-pass block`);
  }
  if (cross.reviewer === firstPass.reviewer) {
    throw new Error(`${assetId}: cross-reviewer matches the first-pass reviewer`);
  }
}
const finalRecords = [];

for (const asset of currentManifest.assets) {
  const baselineAsset = baselineAssets.get(asset.assetId);
  const unchanged =
    asset.promptHash === baselineAsset.promptHash &&
    asset.providerPromptHash === baselineAsset.providerPromptHash &&
    asset.assetSHA256 === baselineAsset.assetSHA256;

  if (!unchanged) {
    const retry = currentReview.get(asset.assetId);
    if (!isApproved(retry)) {
      throw new Error(
        `${asset.assetId}: changed asset lacks an approved current-manifest review`,
      );
    }
    finalRecords.push({
      assetId: asset.assetId,
      status: "approved",
      checks: retry.checks,
      notes: retry.notes || "Approved after targeted image regeneration.",
      reviewer: retry.reviewer,
      reviewerType: retry.reviewerType,
      reviewedAt: retry.reviewedAt,
      sourceReport: retry.sourceReport,
    });
    continue;
  }

  const firstPass = primary.get(asset.assetId);
  if (isApproved(firstPass)) {
    finalRecords.push({
      assetId: asset.assetId,
      status: "approved",
      checks: firstPass.checks,
      notes: firstPass.notes || "",
      reviewer: firstPass.reviewer,
      reviewerType: firstPass.reviewerType,
      reviewedAt: firstPass.reviewedAt,
      sourceReport: firstPass.sourceReport,
    });
    continue;
  }

  const cross = crossReview.get(asset.assetId);
  if (cross?.status !== "overturn_to_approved") {
    throw new Error(
      `${asset.assetId}: baseline asset remains blocked or lacks cross-review`,
    );
  }
  finalRecords.push({
    assetId: asset.assetId,
    status: "approved",
    checks: Object.fromEntries(requiredChecks.map((check) => [check, true])),
    notes: cross.notes || "Approved by independent cross-review.",
    reviewer: cross.reviewer,
    reviewerType: cross.reviewerType,
    reviewedAt: cross.reviewedAt,
    sourceReport: cross.sourceReport,
  });
}

const unusedRetry = [...currentReview.keys()].filter((assetId) => {
  const baselineAsset = baselineAssets.get(assetId);
  const asset = currentAssets.get(assetId);
  return (
    asset.promptHash === baselineAsset.promptHash &&
    asset.providerPromptHash === baselineAsset.providerPromptHash &&
    asset.assetSHA256 === baselineAsset.assetSHA256
  );
});
if (unusedRetry.length) {
  throw new Error(
    `Retry reports contain ${unusedRetry.length} unchanged assets: ${unusedRetry.slice(0, 8)}`,
  );
}

await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      manifestSha256: currentSha256,
      reviewerType: "independent-agent",
      reviewer: "multi-agent-visual-qa-consolidation",
      reviewedAt: new Date().toISOString(),
      baselineManifestSha256: baselineSha256,
      baselineSnapshotSha256,
      records: finalRecords,
    },
    null,
    2,
  )}\n`,
);

console.log(`Consolidated ${finalRecords.length} independently reviewed assets.`);
console.log(`Wrote ${outputPath}`);
