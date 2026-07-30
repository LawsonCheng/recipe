#!/usr/bin/env node
/**
 * Promote one manually reviewed batch entry into the atomic integrator's
 * candidate directory. This never bulk-approves a batch.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const outputRoot = resolve(
  projectRoot,
  'scripts/veggiedeer-enrichment/output',
);
const sourceId = process.argv[2];
if (!sourceId || !/^[A-Za-z0-9_-]{6,64}$/.test(sourceId)) {
  throw new Error('Usage: node promote-reviewed.mjs SOURCE_ID');
}

const recipes = JSON.parse(
  await readFile(
    resolve(projectRoot, 'src/data/synced/veggiedeer-recipes.json'),
    'utf8',
  ),
);
const recipe = recipes.find((entry) => entry.sync?.sourceId === sourceId);
if (!recipe) throw new Error(`${sourceId} is not one of the 204 synced recipes`);

const batchRoot = resolve(outputRoot, 'notebooklm');
const batchFiles = (await readdir(batchRoot))
  .filter((name) => /^batch-\d{3}-\d{3}\.json$/.test(name))
  .sort();
const matches = [];
for (const batchFile of batchFiles) {
  const batch = JSON.parse(await readFile(resolve(batchRoot, batchFile), 'utf8'));
  if (!Array.isArray(batch)) continue;
  for (const candidate of batch) {
    if (candidate?.sourceId === sourceId) {
      matches.push({ batchFile, candidate });
    }
  }
}
if (matches.length !== 1) {
  throw new Error(
    `Expected exactly one batch entry for ${sourceId}, received ${matches.length}`,
  );
}

const { batchFile, candidate } = matches[0];
const promoted = {
  schemaVersion: 1,
  reviewStatus: 'approved',
  reviewedFrom: batchFile,
  recipe: {
    id: recipe.id,
    sourceId,
    durationSeconds: recipe.sync?.durationSeconds,
  },
  title: candidate.title,
  description: candidate.description,
  ingredients: candidate.ingredients.map((ingredient) => ({
    ...ingredient,
    unit:
      ingredient.unit ??
      {
        zh: '適量',
        en: 'to taste',
        id: 'secukupnya',
      },
  })),
  steps: candidate.steps,
  evidence: candidate.evidence ?? [],
  uncertainties: candidate.uncertainty ?? [],
};
const candidatesRoot = resolve(outputRoot, 'candidates');
await mkdir(candidatesRoot, { recursive: true });
const candidatePath = resolve(candidatesRoot, `${sourceId}.json`);
await writeFile(candidatePath, `${JSON.stringify(promoted, null, 2)}\n`);
console.log(`Promoted reviewed ${sourceId} from ${batchFile} to ${candidatePath}`);
