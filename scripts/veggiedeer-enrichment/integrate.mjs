#!/usr/bin/env node
/**
 * Integrate reviewed Veggie Deer enrichment candidates.
 *
 * Candidate generation remains isolated from production. By default only
 * candidates whose reviewStatus is exactly "approved" are eligible.
 * --allow-generated additionally accepts the generator's
 * "needs-human-review" / "generated" statuses for controlled batch workflows.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DEFAULT_OUTPUT_ROOT = resolve(
  PROJECT_ROOT,
  'scripts/veggiedeer-enrichment/output',
);
const RECIPES_PATH = resolve(
  PROJECT_ROOT,
  'src/data/synced/veggiedeer-recipes.json',
);
const STEP_MANIFEST_PATH = resolve(
  PROJECT_ROOT,
  'src/data/synced/veggiedeer-step-frame-manifest.json',
);
const STEP_ASSET_ROOT = resolve(
  PROJECT_ROOT,
  'public/assets/recipes/veggiedeer/generated-steps',
);
const GENERATED_STATUSES = new Set(['needs-human-review', 'generated']);
const SOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;
const REQUIRED_LANGUAGES = ['zh', 'en', 'id'];

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  const options = {
    allowGenerated: false,
    dryRun: false,
    outputRoot: DEFAULT_OUTPUT_ROOT,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--allow-generated') {
      options.allowGenerated = true;
    } else if (argument === '--dry-run') {
      options.dryRun = true;
    } else if (argument === '--output') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) fail('--output requires a directory');
      options.outputRoot = resolve(process.cwd(), value);
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      console.log(`Usage:
  node scripts/veggiedeer-enrichment/integrate.mjs [options]

Options:
  --dry-run          Validate and print the merge plan without writing files
  --allow-generated  Also accept needs-human-review/generated candidates
  --output DIR       Candidate output root (default: enrichment/output)
  --help             Show this help`);
      process.exit(0);
    } else {
      fail(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function localized(value, label, { allowEmpty = false } = {}) {
  if (typeof value === 'string') {
    if (!value.trim() && !allowEmpty) fail(`${label} must not be empty`);
    return { zh: value.trim() };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be a string or localized object`);
  }
  const result = {};
  for (const language of REQUIRED_LANGUAGES) {
    if (
      typeof value[language] === 'string' &&
      (value[language].trim() || allowEmpty)
    ) {
      result[language] = value[language].trim();
    }
  }
  if (!Object.hasOwn(result, 'zh') &&
      !Object.hasOwn(result, 'en') &&
      !Object.hasOwn(result, 'id')) {
    fail(`${label} has no usable translation`);
  }
  return result;
}

function completeMetadataTranslation(
  value,
  originalValue,
  label,
  { preserveOriginalZh = true } = {},
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be a localized object when supplied`);
  }
  const result = {};
  for (const language of REQUIRED_LANGUAGES) {
    const translation = text(value[language]);
    if (!translation) fail(`${label}.${language} must not be empty`);
    result[language] = translation;
  }
  const originalChinese = text(originalValue?.zh);
  if (preserveOriginalZh && (!originalChinese || result.zh !== originalChinese)) {
    fail(`${label}.zh must exactly preserve the synced Chinese source text`);
  }
  return result;
}

function numeric(value, label) {
  const result = Number(value);
  if (!Number.isFinite(result)) fail(`${label} must be a finite number`);
  return result;
}

function positiveInteger(value, label) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1) {
    fail(`${label} must be a positive integer`);
  }
  return result;
}

function isPathInside(parent, child) {
  const pathFromParent = relative(parent, child);
  return (
    pathFromParent !== '' &&
    pathFromParent !== '..' &&
    !pathFromParent.startsWith(`..${sep}`) &&
    !pathFromParent.startsWith(sep)
  );
}

function eligible(candidate, allowGenerated) {
  return (
    candidate.reviewStatus === 'approved' ||
    (allowGenerated && GENERATED_STATUSES.has(candidate.reviewStatus))
  );
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    fail(`${label} is not valid JSON (${path}): ${error.message}`);
  }
}

async function readCandidateFiles(candidatesDirectory) {
  if (!existsSync(candidatesDirectory)) {
    fail(`Candidate directory does not exist: ${candidatesDirectory}`);
  }
  const entries = await readdir(candidatesDirectory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => resolve(candidatesDirectory, entry.name))
    .sort();
}

function normalizeIngredient(ingredient, recipeId, index, candidateLabel) {
  if (!ingredient || typeof ingredient !== 'object' || Array.isArray(ingredient)) {
    fail(`${candidateLabel}: ingredient ${index + 1} must be an object`);
  }
  const normalized = {
    id: text(ingredient.id) || `${recipeId}-ingredient-${index + 1}`,
    name: localized(ingredient.name, `${candidateLabel}: ingredient ${index + 1} name`),
    amount:
      typeof ingredient.amount === 'number'
        ? String(ingredient.amount)
        : text(ingredient.amount),
    // Source transcripts often name an ingredient without a unit. Preserve
    // that uncertainty as an intentionally empty localized value rather than
    // inventing a unit or rejecting an otherwise source-grounded candidate.
    unit:
      ingredient.unit == null
        ? { zh: '', en: '', id: '' }
        : localized(
            ingredient.unit,
            `${candidateLabel}: ingredient ${index + 1} unit`,
            { allowEmpty: true },
          ),
    optional: ingredient.optional === true,
  };
  if (ingredient.notes != null) {
    normalized.notes = localized(
      ingredient.notes,
      `${candidateLabel}: ingredient ${index + 1} notes`,
    );
  }
  return normalized;
}

async function normalizeStep({
  step,
  index,
  candidateLabel,
  sourceId,
  recipeId,
  generatedImagesRoot,
}) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    fail(`${candidateLabel}: step ${index + 1} must be an object`);
  }
  const order = positiveInteger(step.order ?? index + 1, `${candidateLabel}: step order`);
  if (order !== index + 1) {
    fail(`${candidateLabel}: steps must be consecutively ordered from 1`);
  }
  const providedImagePrompt = text(step.imagePrompt);
  const imagePrompt =
    providedImagePrompt.length >= 40
      ? providedImagePrompt
      : `Photorealistic vegan recipe-step image for “${text(step.title?.en) ||
          text(step.title?.zh) ||
          `step ${order}`}”; no meat, dairy, text, watermark, or logo.`;
  const filename = `step-${String(order).padStart(2, '0')}.png`;
  const sourcePath = resolve(generatedImagesRoot, sourceId, filename);
  const expectedImageDirectory = resolve(generatedImagesRoot, sourceId);
  if (
    !isPathInside(generatedImagesRoot, sourcePath) ||
    dirname(sourcePath) !== expectedImageDirectory ||
    basename(sourcePath) !== filename
  ) {
    fail(
      `${candidateLabel}: step ${order} generated image must be ` +
        `${relative(PROJECT_ROOT, resolve(expectedImageDirectory, filename))}`,
    );
  }
  const sourceStats = await stat(sourcePath).catch(() => null);
  if (!sourceStats?.isFile() || sourceStats.size < 12_000) {
    fail(`${candidateLabel}: step ${order} generated image is missing or too small`);
  }
  const metadata = await sharp(sourcePath).metadata();
  const width = positiveInteger(metadata.width, `${candidateLabel}: step ${order} width`);
  const height = positiveInteger(metadata.height, `${candidateLabel}: step ${order} height`);
  if (width < 640 || height < 360) {
    fail(`${candidateLabel}: step ${order} generated image must be at least 640x360`);
  }

  const contents = await readFile(sourcePath);
  const sha256 = createHash('sha256').update(contents).digest('hex');
  const imagePath =
    `/assets/recipes/veggiedeer/generated-steps/${sourceId}/${filename}`;
  const sourceReferenceTimestampSeconds = Number(step.sourceReferenceTimestampSeconds);
  return {
    recipeStep: {
      order,
      title: localized(step.title, `${candidateLabel}: step ${order} title`),
      instruction: localized(
        step.instruction,
        `${candidateLabel}: step ${order} instruction`,
      ),
      imageUrl: imagePath,
      imageSource: 'openai-imagegen',
      imagePrompt,
      ...(Number.isFinite(sourceReferenceTimestampSeconds)
        ? { sourceReferenceTimestampSeconds }
        : {}),
    },
    manifestEntry: {
      recipeId,
      sourceId,
      stepOrder: order,
      source: 'openai-imagegen',
      imagePath,
      width,
      height,
      sha256,
      prompt: imagePrompt,
      promptVersion: 1,
      generationTool: 'openai-imagegen-builtin',
    },
    asset: {
      sourcePath,
      targetPath: resolve(STEP_ASSET_ROOT, sourceId, filename),
      contents,
    },
  };
}

async function prepareCandidate(
  candidatePath,
  candidate,
  recipesBySource,
  generatedImagesRoot,
) {
  const candidateLabel = relative(PROJECT_ROOT, candidatePath);
  if (candidate.schemaVersion !== 1) {
    fail(`${candidateLabel}: unsupported schemaVersion ${candidate.schemaVersion}`);
  }
  const sourceId = text(candidate.recipe?.sourceId);
  if (!SOURCE_ID_PATTERN.test(sourceId)) {
    fail(`${candidateLabel}: invalid sourceId`);
  }
  if (basename(candidatePath, '.json') !== sourceId) {
    fail(`${candidateLabel}: filename must match sourceId ${sourceId}`);
  }
  const originalRecipe = recipesBySource.get(sourceId);
  if (!originalRecipe) {
    fail(`${candidateLabel}: sourceId ${sourceId} is not in the synced collection`);
  }
  if (candidate.recipe?.id !== originalRecipe.id) {
    fail(`${candidateLabel}: candidate recipe id does not match ${originalRecipe.id}`);
  }
  const durationSeconds = numeric(
    originalRecipe.sync?.durationSeconds,
    `${candidateLabel}: production recipe duration`,
  );
  if (
    candidate.recipe?.durationSeconds != null &&
    numeric(candidate.recipe.durationSeconds, `${candidateLabel}: candidate duration`) !==
      durationSeconds
  ) {
    fail(`${candidateLabel}: candidate duration does not match production metadata`);
  }
  if (!Array.isArray(candidate.ingredients) || !candidate.ingredients.length) {
    fail(`${candidateLabel}: ingredients must be a non-empty array`);
  }
  if (!Array.isArray(candidate.steps) || !candidate.steps.length) {
    fail(`${candidateLabel}: steps must be a non-empty array`);
  }

  const ingredients = candidate.ingredients.map((ingredient, index) =>
    normalizeIngredient(ingredient, originalRecipe.id, index, candidateLabel),
  );
  const normalizedSteps = [];
  for (const [index, step] of candidate.steps.entries()) {
    normalizedSteps.push(
      await normalizeStep({
        step,
        index,
        candidateLabel,
        sourceId,
        recipeId: originalRecipe.id,
        generatedImagesRoot,
      }),
    );
  }
  const title =
    candidate.title == null
      ? originalRecipe.title
      : completeMetadataTranslation(
          candidate.title,
          originalRecipe.title,
          `${candidateLabel}: title`,
        );
  const description =
    candidate.description == null
      ? originalRecipe.description
      : completeMetadataTranslation(
          candidate.description,
          originalRecipe.description,
          `${candidateLabel}: description`,
          { preserveOriginalZh: false },
        );
  const mergedRecipe = {
    ...originalRecipe,
    title,
    description,
    ingredientListComplete: true,
    stepListComplete: true,
    ingredients,
    steps: normalizedSteps.map(({ recipeStep }) => recipeStep),
  };
  return {
    sourceId,
    recipeId: originalRecipe.id,
    mergedRecipe,
    manifestEntries: normalizedSteps.map(({ manifestEntry }) => manifestEntry),
    assets: normalizedSteps.map(({ asset }) => asset),
  };
}

function validateResult(recipes, manifest) {
  const recipeIds = new Set();
  const sourceIds = new Set();
  for (const recipe of recipes) {
    if (!recipe?.id || recipeIds.has(recipe.id)) {
      fail(`Result contains a missing or duplicate recipe id: ${recipe?.id ?? ''}`);
    }
    recipeIds.add(recipe.id);
    const sourceId = recipe.sync?.sourceId;
    if (!sourceId || sourceIds.has(sourceId)) {
      fail(`Result contains a missing or duplicate sourceId: ${sourceId ?? ''}`);
    }
    sourceIds.add(sourceId);
  }
  const manifestKeys = new Set();
  const imagePaths = new Set();
  for (const frame of manifest) {
    const key = `${frame.recipeId}::${frame.stepOrder}`;
    if (manifestKeys.has(key)) fail(`Result has duplicate manifest entry ${key}`);
    if (imagePaths.has(frame.imagePath)) {
      fail(`Result reuses a generated step image: ${frame.imagePath}`);
    }
    manifestKeys.add(key);
    imagePaths.add(frame.imagePath);
  }
}

async function stageFile(targetPath, contents, transactionId) {
  await mkdir(dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.tmp-${transactionId}`;
  await writeFile(temporaryPath, contents, { flag: 'wx' });
  return { targetPath, temporaryPath };
}

async function commitStagedFiles(stagedFiles, transactionId) {
  const committed = [];
  const backups = [];
  try {
    for (const staged of stagedFiles) {
      const backupPath = `${staged.targetPath}.bak-${transactionId}`;
      const existed = existsSync(staged.targetPath);
      if (existed) await copyFile(staged.targetPath, backupPath);
      backups.push({ ...staged, backupPath, existed });
      await rename(staged.temporaryPath, staged.targetPath);
      committed.push({ ...staged, backupPath, existed });
    }
  } catch (error) {
    for (const staged of committed.reverse()) {
      if (staged.existed) {
        await rename(staged.backupPath, staged.targetPath).catch(() => {});
      } else {
        await rm(staged.targetPath, { force: true }).catch(() => {});
      }
    }
    throw error;
  } finally {
    for (const staged of stagedFiles) {
      await rm(staged.temporaryPath, { force: true }).catch(() => {});
    }
    for (const staged of backups) {
      if (!committed.some((entry) => entry.targetPath === staged.targetPath)) {
        await rm(staged.backupPath, { force: true }).catch(() => {});
      }
    }
  }
  for (const staged of committed) {
    await rm(staged.backupPath, { force: true }).catch(() => {});
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const candidatesDirectory = resolve(options.outputRoot, 'candidates');
  const generatedImagesRoot = resolve(options.outputRoot, 'generated-steps');
  const candidateFiles = await readCandidateFiles(candidatesDirectory);
  const recipes = await readJson(RECIPES_PATH, 'Synced recipe collection');
  if (!Array.isArray(recipes)) fail('Synced recipe collection must be an array');
  const existingManifest = existsSync(STEP_MANIFEST_PATH)
    ? await readJson(STEP_MANIFEST_PATH, 'Step-image manifest')
    : [];
  if (!Array.isArray(existingManifest)) fail('Step-image manifest must be an array');

  const recipesBySource = new Map(
    recipes.map((recipe) => [recipe.sync?.sourceId, recipe]),
  );
  const candidates = [];
  const skipped = [];
  for (const candidatePath of candidateFiles) {
    const candidate = await readJson(candidatePath, 'Enrichment candidate');
    if (eligible(candidate, options.allowGenerated)) {
      candidates.push({ candidatePath, candidate });
    } else {
      skipped.push({
        file: basename(candidatePath),
        reviewStatus: candidate.reviewStatus ?? 'missing',
      });
    }
  }

  if (!candidates.length) {
    console.log(
      `No eligible candidates found (${skipped.length} skipped). ` +
        'Only reviewStatus="approved" is accepted by default.',
    );
    return;
  }

  const prepared = [];
  const selectedSources = new Set();
  for (const entry of candidates) {
    const item = await prepareCandidate(
      entry.candidatePath,
      entry.candidate,
      recipesBySource,
      generatedImagesRoot,
    );
    if (selectedSources.has(item.sourceId)) {
      fail(`More than one candidate targets sourceId ${item.sourceId}`);
    }
    selectedSources.add(item.sourceId);
    prepared.push(item);
  }

  const preparedBySource = new Map(prepared.map((item) => [item.sourceId, item]));
  const mergedRecipes = recipes.map(
    (recipe) => preparedBySource.get(recipe.sync?.sourceId)?.mergedRecipe ?? recipe,
  );
  const replacedRecipeIds = new Set(prepared.map((item) => item.recipeId));
  const mergedManifest = existingManifest
    .filter((frame) => !replacedRecipeIds.has(frame.recipeId))
    .concat(prepared.flatMap((item) => item.manifestEntries));
  const recipeOrder = new Map(mergedRecipes.map((recipe, index) => [recipe.id, index]));
  mergedManifest.sort(
    (left, right) =>
      (recipeOrder.get(left.recipeId) ?? Number.MAX_SAFE_INTEGER) -
        (recipeOrder.get(right.recipeId) ?? Number.MAX_SAFE_INTEGER) ||
      left.stepOrder - right.stepOrder,
  );
  validateResult(mergedRecipes, mergedManifest);

  const assetCount = prepared.reduce((count, item) => count + item.assets.length, 0);
  console.log(
    `${options.dryRun ? 'Dry run:' : 'Integrating'} ${prepared.length} candidate(s), ` +
    `${assetCount} generated step image(s); ${skipped.length} candidate(s) skipped.`,
  );
  for (const item of prepared) {
    console.log(`- ${item.sourceId}: ${item.manifestEntries.length} steps`);
  }
  if (options.dryRun) {
    console.log('Dry run complete; no production data or assets were changed.');
    return;
  }

  const transactionId = `${process.pid}-${randomUUID()}`;
  const stagedFiles = [];
  try {
    for (const item of prepared) {
      for (const asset of item.assets) {
        stagedFiles.push(
          await stageFile(asset.targetPath, asset.contents, transactionId),
        );
      }
    }
    // Commit assets first, then the manifest, and recipes last. Readers can
    // therefore never observe recipe data pointing at an absent image.
    stagedFiles.push(
      await stageFile(STEP_MANIFEST_PATH, json(mergedManifest), transactionId),
    );
    stagedFiles.push(
      await stageFile(RECIPES_PATH, json(mergedRecipes), transactionId),
    );
    await commitStagedFiles(stagedFiles, transactionId);
  } catch (error) {
    for (const staged of stagedFiles) {
      await rm(staged.temporaryPath, { force: true }).catch(() => {});
    }
    throw error;
  }
  console.log(
    `Integrated ${prepared.length} candidate(s) atomically; wrote ${assetCount} ` +
      'generated step image(s), the step-image manifest, and synced recipe data.',
  );
}

main().catch((error) => {
  console.error(`Veggie Deer integration failed: ${error.message}`);
  process.exitCode = 1;
});
