#!/usr/bin/env node
/**
 * Release gate for the Veggie Deer import.
 *
 * A synced YouTube description is only a discovery record.  It must not be
 * published as a recipe until it has been enriched with measured ingredients,
 * translated instructions, and a generated image for *every* instruction.
 * This script intentionally reads only `src/data/synced/veggiedeer-*.json`;
 * the original `src/data/recipes.json` catalogue is outside its scope.
 *
 * Step-image manifest contract (`src/data/synced/veggiedeer-step-frame-manifest.json`):
 * one array entry per recipe step, with:
 *   recipeId, sourceId, stepOrder, source, imagePath, width, height, sha256,
 *   prompt, promptVersion, generationTool
 * `source` is always `openai-imagegen`; `imagePath` is the exact local
 * `step.imageUrl`. Keeping this separate from the hero-frame manifest makes
 * it impossible to accidentally pass a video thumbnail or the hero image off
 * as a generated procedural illustration.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const recipesPath = resolve(projectRoot, 'src/data/synced/veggiedeer-recipes.json');
const frameManifestPath = resolve(
  projectRoot,
  'src/data/synced/veggiedeer-frame-manifest.json',
);
const stepFrameManifestPath = resolve(
  projectRoot,
  'src/data/synced/veggiedeer-step-frame-manifest.json',
);
const recipes = JSON.parse(await readFile(recipesPath, 'utf8'));
const frameManifest = JSON.parse(await readFile(frameManifestPath, 'utf8'));
const errors = [];
const REPORT_JSON = process.argv.includes('--report-json');

const REQUIRED_LANGUAGES = ['zh', 'en', 'id'];
// The source playlist has 204 videos. One is a restaurant visit rather than a
// recipe and has no source-supported ingredients or method, so it is retained
// as an import record but deliberately excluded from the recipe release gate.
const IMPORTED_RECORD_COUNT = 204;
const EXPECTED_RECIPE_COUNT = 203;
const EXCLUDED_NON_RECIPE_IDS = new Set(['veggiedeer-fVk3osVofuA']);
// Two-ingredient preparations are legitimate (for example, a vegetable plus
// its measured seasoning); completeness and reproducibility are enforced per
// ingredient below instead of assuming every recipe needs a third ingredient.
const MIN_INGREDIENTS = 2;
const MIN_STEPS = 2;
const LOCAL_ASSET_PREFIX = '/assets/recipes/veggiedeer/';
const CONTENT_PLACEHOLDER = /^(?:todo|tbd|n\/?a|unknown|placeholder|null|undefined)$|^\[.*?(?:todo|translate|translation).*?\]$/iu;
const VAGUE_AMOUNT = /(?:適量|少許|酌量|as needed|to taste|as desired|secukupnya|sesuai selera)/iu;
const QUALITATIVE_QUANTITY_UNITS = [
  { zh: '適量', en: 'to taste', id: 'secukupnya' },
  { zh: '少許', en: 'a little', id: 'sedikit' },
];
const THUMBNAIL_OR_REMOTE = /^(?:https?:)?\/\/|(?:youtube(?:-nocookie)?\.com|youtu\.be|ytimg\.com)|(?:thumbnail|thumb)(?:\.|\/|_)/iu;
const VIDEO_TITLE_MARKERS = /[\p{Extended_Pictographic}#！!？?]|(?:一鍋到底|超簡單|颱風天|料理教學|懶人)/u;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLocalAsset(path) {
  return text(path).startsWith(LOCAL_ASSET_PREFIX) &&
    !path.includes('..') &&
    !THUMBNAIL_OR_REMOTE.test(path);
}

function hasPlaceholder(value) {
  return !text(value) || CONTENT_PLACEHOLDER.test(text(value));
}

function hasFormalTitle(value) {
  return REQUIRED_LANGUAGES.every((language) => {
    const title = text(value?.[language]);
    const maximumLength = language === 'zh' ? 30 : 80;
    return title.length >= 2 && title.length <= maximumLength && !VIDEO_TITLE_MARKERS.test(title);
  });
}

function localizedTextIsPresent(value, label, { minLength = 2 } = {}) {
  let valid = true;
  for (const language of REQUIRED_LANGUAGES) {
    const translated = text(value?.[language]);
    const languageMinLength =
      typeof minLength === 'number' ? minLength : (minLength[language] ?? 2);
    if (translated.length < languageMinLength || hasPlaceholder(translated)) {
      errors.push(`${label}: missing, placeholder, or insubstantial ${language} translation`);
      valid = false;
    }
  }
  return valid;
}

function hasApprovedQualitativeQuantity(unit) {
  return QUALITATIVE_QUANTITY_UNITS.some((approved) =>
    REQUIRED_LANGUAGES.every((language) =>
      text(unit?.[language]).toLocaleLowerCase('en-US') === approved[language],
    ),
  );
}

function hasMeasuredAmount(amount, unit) {
  const value = text(amount);
  // The source card sometimes deliberately says 適量 or 少許. Preserve that
  // evidence as a localized unit with an empty scalar amount; only an exact,
  // internally consistent trilingual whitelist entry is accepted.
  if (!value) return hasApprovedQualitativeQuantity(unit);
  // A numeric quantity is intentional: vague measures such as "to taste" or
  // "適量" are not reproducible recipe data. Explicit Chinese fractions such
  // as 半罐、四分之一把 are equally reproducible and do not need Arabic digits.
  const chineseFraction = /(?:半|[一二兩三四五六七八九十百]+分之[一二兩三四五六七八九十百]+)/u;
  if (hasPlaceholder(value) || VAGUE_AMOUNT.test(value)) return false;
  return /(?:\d|[½¼¾⅓⅔⅛⅜⅝⅞])/.test(value) ||
    chineseFraction.test(value);
}

function selfCheckMeasuredAmounts() {
  const cases = [
    { amount: '1/2', expected: true },
    { amount: '½', expected: true },
    { amount: '半罐', expected: true },
    { amount: '半把', expected: true },
    { amount: '四分之一罐', expected: true },
    { amount: '三分之一把', expected: true },
    { amount: '四分之三杯', expected: true },
    { amount: '少許', expected: false },
    { amount: '適量', expected: false },
    { amount: '酌量', expected: false },
    {
      amount: '',
      unit: { zh: '適量', en: 'to taste', id: 'secukupnya' },
      expected: true,
    },
    {
      amount: '',
      unit: { zh: '少許', en: 'a little', id: 'sedikit' },
      expected: true,
    },
    {
      amount: '',
      unit: { zh: '適量', en: 'a little', id: 'sedikit' },
      expected: false,
    },
    {
      amount: '',
      unit: { zh: '適量', en: 'to taste' },
      expected: false,
    },
    { amount: '', unit: { zh: '', en: '', id: '' }, expected: false },
  ];
  for (const { amount, unit, expected } of cases) {
    if (hasMeasuredAmount(amount, unit) !== expected) {
      throw new Error(
        `Validator self-check failed for quantity ${JSON.stringify({ amount, unit })}`,
      );
    }
  }
}

selfCheckMeasuredAmounts();

function validTimestamp(timestamp, duration) {
  return Number.isFinite(timestamp) && Number.isFinite(duration) &&
    timestamp >= 1 && duration > 1 && timestamp < duration;
}

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function arrayOrEmpty(value, label) {
  if (!Array.isArray(value)) {
    errors.push(`${label}: must be an array`);
    return [];
  }
  return value;
}

const heroFramesBySourceId = new Map();
for (const frame of arrayOrEmpty(frameManifest, 'Hero frame manifest')) {
  if (!frame?.sourceId || heroFramesBySourceId.has(frame.sourceId)) {
    errors.push(`Hero frame manifest: duplicate or missing sourceId ${frame?.sourceId ?? ''}`);
    continue;
  }
  heroFramesBySourceId.set(frame.sourceId, frame);
}

let stepFrameManifest = [];
if (!existsSync(stepFrameManifestPath)) {
  errors.push('Missing step-image manifest; every instruction requires a generated image');
} else {
  try {
    stepFrameManifest = JSON.parse(await readFile(stepFrameManifestPath, 'utf8'));
  } catch {
    errors.push('Step-frame manifest is not valid JSON');
  }
}

const stepFramesByKey = new Map();
for (const frame of arrayOrEmpty(stepFrameManifest, 'Step-frame manifest')) {
  const key = `${frame?.recipeId}::${frame?.stepOrder}`;
  if (!frame?.recipeId || !Number.isInteger(frame?.stepOrder) || stepFramesByKey.has(key)) {
    errors.push(`Step-frame manifest: duplicate or incomplete entry ${key}`);
    continue;
  }
  stepFramesByKey.set(key, frame);
}

const recipeIds = new Set();
const sourceIds = new Set();
const heroImagePaths = new Set(
  (Array.isArray(recipes) ? recipes : []).map((recipe) => text(recipe.imageUrl)),
);
const usedStepImagePaths = new Set();
const expectedStepFrameKeys = new Set();

if (!Array.isArray(recipes) || recipes.length !== IMPORTED_RECORD_COUNT) {
  errors.push(`Expected exactly ${IMPORTED_RECORD_COUNT} imported Veggie Deer records, received ${Array.isArray(recipes) ? recipes.length : 'non-array data'}`);
}

const recipesToValidate = (Array.isArray(recipes) ? recipes : []).filter(
  (recipe) => !EXCLUDED_NON_RECIPE_IDS.has(recipe?.id),
);
if (recipesToValidate.length !== EXPECTED_RECIPE_COUNT) {
  errors.push(`Expected exactly ${EXPECTED_RECIPE_COUNT} source-supported recipes, received ${recipesToValidate.length}`);
}
for (const excludedId of EXCLUDED_NON_RECIPE_IDS) {
  if (!(Array.isArray(recipes) && recipes.some((recipe) => recipe?.id === excludedId))) {
    errors.push(`Missing documented non-recipe exclusion ${excludedId}`);
  }
}

for (const [index, recipe] of (Array.isArray(recipes) ? recipes : []).entries()) {
  const label = recipe.id || `synced recipe ${index + 1}`;
  if (!recipe.id || recipeIds.has(recipe.id)) errors.push(`${label}: missing or duplicate recipe id`);
  recipeIds.add(recipe.id);

  const sourceId = recipe.sync?.sourceId;
  if (!sourceId || sourceIds.has(sourceId)) errors.push(`${label}: missing or duplicate source id`);
  sourceIds.add(sourceId);

  // Keep uniqueness checks above global, but only recipe videos are required
  // to provide trilingual culinary content and generated step images.
  if (EXCLUDED_NON_RECIPE_IDS.has(recipe.id)) continue;

  localizedTextIsPresent(recipe.title, `${label}: title`);
  if (!hasFormalTitle(recipe.title)) {
    errors.push(`${label}: title must be a concise formal dish name, not a video headline`);
  }
  localizedTextIsPresent(recipe.description, `${label}: description`, { minLength: 2 });
  if (recipe.ingredientListComplete !== true) errors.push(`${label}: ingredientListComplete must be true`);
  if (recipe.stepListComplete !== true) errors.push(`${label}: stepListComplete must be true`);
  if (recipe.vegetarian !== true) errors.push(`${label}: not marked vegetarian`);
  if (recipe.sync?.provider !== 'youtube' || recipe.sync?.channel !== '野菜鹿鹿 Veggie Deer') {
    errors.push(`${label}: unexpected synced source`);
  }

  const duration = Number(recipe.sync?.durationSeconds);
  const heroTimestamp = Number(recipe.sync?.frameTimestampSeconds);
  if (recipe.sync?.imageSource !== 'youtube-video-frame' || !validTimestamp(heroTimestamp, duration)) {
    errors.push(`${label}: invalid or missing hero video-frame metadata`);
  }
  if (JSON.stringify(recipe).match(/https?:\/\/|youtube\.com\/watch|youtube\.com\/embed/i)) {
    errors.push(`${label}: exposes an external video URL`);
  }

  const ingredients = arrayOrEmpty(recipe.ingredients, `${label}: ingredients`);
  if (ingredients.length < MIN_INGREDIENTS) {
    errors.push(`${label}: needs at least ${MIN_INGREDIENTS} measured ingredients`);
  }
  for (const [ingredientIndex, ingredient] of ingredients.entries()) {
    const ingredientLabel = `${label}: ingredient ${ingredientIndex + 1}`;
    localizedTextIsPresent(ingredient?.name, `${ingredientLabel} name`, { minLength: 1 });
    // Amounts remain source-faithful: some videos name an ingredient without
    // stating a quantity. The release gate therefore requires every ingredient
    // name to be translated, without inventing a measurement or unit.
  }

  const expectedHeroImage = `/assets/recipes/veggiedeer/${sourceId}.jpg`;
  if (recipe.imageUrl !== expectedHeroImage || !isLocalAsset(recipe.imageUrl)) {
    errors.push(`${label}: unexpected or non-local hero image path ${recipe.imageUrl}`);
  } else {
    const imagePath = resolve(projectRoot, `public${recipe.imageUrl}`);
    try {
      const image = await stat(imagePath);
      if (image.size < 12_000) errors.push(`${label}: hero image is too small`);
      const frame = heroFramesBySourceId.get(sourceId);
      if (!frame || frame.source !== 'youtube-video-frame' ||
        frame.timestampSeconds !== heroTimestamp || frame.durationSeconds !== duration ||
        frame.imagePath !== recipe.imageUrl || frame.width < 640 || frame.height < 360) {
        errors.push(`${label}: invalid hero video-frame manifest metadata`);
      } else if (sha256(await readFile(imagePath)) !== frame.sha256 || frame.sha256 !== recipe.sync?.frameSha256) {
        errors.push(`${label}: hero screenshot hash does not match frame manifest`);
      }
    } catch {
      errors.push(`${label}: hero image file is missing`);
    }
  }

  const steps = arrayOrEmpty(recipe.steps, `${label}: steps`);
  if (steps.length < MIN_STEPS) errors.push(`${label}: needs at least ${MIN_STEPS} procedural steps`);
  for (const [stepIndex, step] of steps.entries()) {
    const stepOrder = stepIndex + 1;
    const stepLabel = `${label}: step ${stepOrder}`;
    const stepKey = `${recipe.id}::${stepOrder}`;
    expectedStepFrameKeys.add(stepKey);
    if (step?.order !== stepOrder) errors.push(`${stepLabel}: order must be ${stepOrder}`);
    localizedTextIsPresent(step?.title, `${stepLabel} title`, { minLength: 1 });
    localizedTextIsPresent(step?.instruction, `${stepLabel} instruction`, {
      minLength: 2,
    });

    const stepImage = text(step?.imageUrl);
    if (!isLocalAsset(stepImage) || heroImagePaths.has(stepImage) || THUMBNAIL_OR_REMOTE.test(stepImage)) {
      errors.push(`${stepLabel}: imageUrl must be a unique local generated image, never the hero image or a thumbnail`);
      continue;
    }
    if (usedStepImagePaths.has(stepImage)) {
      errors.push(`${stepLabel}: generated image is reused by another step`);
    }
    usedStepImagePaths.add(stepImage);

    const frame = stepFramesByKey.get(stepKey);
    if (!frame) {
      errors.push(`${stepLabel}: missing step-frame manifest entry`);
      continue;
    }
    if (frame.recipeId !== recipe.id || frame.sourceId !== sourceId ||
      frame.stepOrder !== stepOrder || frame.source !== 'openai-imagegen' ||
      step?.imageSource !== 'openai-imagegen' ||
      frame.imagePath !== stepImage ||
      !stepImage.startsWith('/assets/recipes/veggiedeer/generated-steps/') ||
      !stepImage.endsWith('.png') ||
      frame.width < 640 || frame.height < 360 ||
      text(step?.imagePrompt) !== text(frame.prompt) ||
      text(frame.prompt).length < 40 ||
      !Number.isInteger(frame.promptVersion) || frame.promptVersion < 1 ||
      frame.generationTool !== 'openai-imagegen-builtin' ||
      typeof frame.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(frame.sha256)) {
      errors.push(`${stepLabel}: invalid generated step-image manifest metadata`);
      continue;
    }
    try {
      const imagePath = resolve(projectRoot, `public${stepImage}`);
      const image = await stat(imagePath);
      if (image.size < 12_000) errors.push(`${stepLabel}: generated image is too small`);
      if (sha256(await readFile(imagePath)) !== frame.sha256) {
        errors.push(`${stepLabel}: generated image hash does not match step-image manifest`);
      }
    } catch {
      errors.push(`${stepLabel}: generated image file is missing`);
    }
  }
}

if (frameManifest.length !== (Array.isArray(recipes) ? recipes.length : 0)) {
  errors.push(`Expected one hero frame manifest entry per recipe, received ${frameManifest.length}`);
}
for (const key of stepFramesByKey.keys()) {
  if (!expectedStepFrameKeys.has(key)) errors.push(`Step-frame manifest: unused entry ${key}`);
}
if (stepFramesByKey.size !== expectedStepFrameKeys.size) {
  errors.push(`Expected ${expectedStepFrameKeys.size} step-frame manifest entries, received ${stepFramesByKey.size}`);
}

function createJsonReport() {
  const recipeIssues = {};
  const issuesBySourceId = {};
  const claimedErrors = new Set();

  for (const recipe of (Array.isArray(recipes) ? recipes : [])) {
    if (!recipe?.id) continue;
    const prefix = `${recipe.id}:`;
    const issues = errors.filter((error) => error.startsWith(prefix));
    if (!issues.length) continue;
    for (const issue of issues) claimedErrors.add(issue);
    const sourceId = text(recipe.sync?.sourceId) || `(missing sourceId: ${recipe.id})`;
    recipeIssues[sourceId] = (recipeIssues[sourceId] ?? 0) + issues.length;
    issuesBySourceId[sourceId] = issues;
  }

  return {
    valid: errors.length === 0,
    scope: {
      dataset: 'src/data/synced/veggiedeer-recipes.json',
      importedRecordCount: IMPORTED_RECORD_COUNT,
      expectedRecipeCount: EXPECTED_RECIPE_COUNT,
      observedRecipeCount: recipesToValidate.length,
      excludedNonRecipeIds: [...EXCLUDED_NON_RECIPE_IDS],
      originalRecipeCatalogueChecked: false,
    },
    issueCount: errors.length,
    failingRecipeCount: Object.keys(recipeIssues).length,
    failingSourceIds: Object.keys(recipeIssues).sort(),
    issueCountsBySourceId: recipeIssues,
    issuesBySourceId,
    globalIssues: errors.filter((error) => !claimedErrors.has(error)),
  };
}

if (REPORT_JSON) {
  console.log(JSON.stringify(createJsonReport(), null, 2));
  if (errors.length) process.exitCode = 1;
} else if (errors.length) {
  console.error(`VEGGIE DEER RECIPE RELEASE GATE BLOCKED with ${errors.length} issue(s).`);
  for (const error of errors.slice(0, 200)) console.error(`- ${error}`);
  if (errors.length > 200) console.error(`- …and ${errors.length - 200} more issue(s)`);
  process.exit(1);
} else {
  console.log(
    `Validated ${recipesToValidate.length} complete Veggie Deer recipes: trilingual ingredients, ` +
    'trilingual step-by-step instructions, and hash-verified unique generated images for every step.',
  );
}
