#!/usr/bin/env node
/**
 * Translate missing Veggie Deer title/description metadata with local Ollama.
 *
 * Production data is always read-only. Results are cached outside src/data and
 * can optionally be injected into existing enrichment candidates.
 */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const RECIPES_PATH = resolve(
  PROJECT_ROOT,
  'src/data/synced/veggiedeer-recipes.json',
);
const DEFAULT_OUTPUT_ROOT = resolve(
  PROJECT_ROOT,
  'scripts/veggiedeer-enrichment/output',
);
const DEFAULT_MODEL = 'qwen3-vl:8b';
const TARGET_LANGUAGES = ['en', 'id'];
const PROMPT_VERSION = 3;
const SOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;
const CULINARY_TERMS = [
  {
    zh: '懶人電鍋燜飯',
    en: /(?=.*\bone-pot rice\b)(?=.*\brice cooker\b)/i,
    id: /(?=.*\bnasi tanak\b)(?=.*\bpenanak nasi\b)/i,
    hint: '懶人電鍋燜飯 → preferred natural title: Easy One-Pot Rice in a Rice Cooker / Nasi Tanak Praktis dengan Penanak Nasi',
  },
  {
    zh: '純素肉末',
    en: /\b(?:vegan|plant-based) (?:mince|minced meat)\b/i,
    id: /\bdaging cincang (?:vegan|nabati)\b/i,
    hint: '純素肉末 = vegan mince = daging cincang vegan/nabati',
  },
  {
    zh: '燜飯',
    en: /\b(?:one-pot|braised|rice cooker) rice\b/i,
    id: /\bnasi tanak\b/i,
    hint: '燜飯 = one-pot/braised rice = nasi tanak (never fried rice, nasi goreng or nasi lemak)',
  },
  {
    zh: '悶飯',
    en: /\b(?:one-pot|braised|rice cooker) rice\b/i,
    id: /\bnasi tanak\b/i,
    hint: '悶飯 in this context means 燜飯 = one-pot rice = nasi tanak',
  },
  { zh: '玉米', en: /\bcorn\b/i, id: /\bjagung\b/i, hint: '玉米 = corn = jagung (never kacang)' },
  { zh: '電鍋', en: /\brice cooker\b/i, id: /\bpenanak nasi\b/i, hint: '電鍋 = rice cooker = penanak nasi' },
  { zh: '純素', en: /\bvegan\b/i, id: /\bvegan\b/i, hint: '純素 = vegan' },
  { zh: '全素', en: /\bvegan\b/i, id: /\bvegan\b/i, hint: '全素 = vegan' },
  { zh: '茄子', en: /\b(?:eggplant|aubergine)\b/i, id: /\bterong\b/i, hint: '茄子 = eggplant = terong' },
  { zh: '豆腐', en: /\btofu\b/i, id: /\btahu\b/i, hint: '豆腐 = tofu = tahu' },
  { zh: '馬鈴薯', en: /\bpotato/i, id: /\bkentang\b/i, hint: '馬鈴薯 = potato = kentang' },
  { zh: '地瓜', en: /\bsweet potato/i, id: /\bubi jalar\b/i, hint: '地瓜 = sweet potato = ubi jalar' },
  { zh: '杏鮑菇', en: /\bking oyster mushroom/i, id: /\bjamur tiram raja\b/i, hint: '杏鮑菇 = king oyster mushroom = jamur tiram raja' },
  { zh: '金針菇', en: /\benoki/i, id: /\benoki/i, hint: '金針菇 = enoki mushroom = jamur enoki' },
  { zh: '米粉', en: /\brice (?:vermicelli|noodles)\b/i, id: /\b(?:bihun|mi beras)\b/i, hint: '米粉 = rice vermicelli = bihun' },
  { zh: '冬粉', en: /\b(?:glass|cellophane) noodles\b/i, id: /\b(?:soun|sohun)\b/i, hint: '冬粉 = glass noodles = soun' },
  { zh: '凍豆腐', en: /\bfrozen tofu\b/i, id: /\btahu beku\b/i, hint: '凍豆腐 = frozen tofu = tahu beku' },
  {
    zh: '下飯',
    en: /\b(?:rice-friendly|goes (?:very )?well with rice)\b/i,
    id: /\bcocok (?:sekali )?(?:disantap )?dengan nasi\b/i,
    hint: '下飯 = rice-friendly/goes well with rice = cocok disantap dengan nasi',
  },
  {
    zh: '颱風天抗漲料理',
    en: /\bbudget-friendly typhoon-day (?:dish|meal)\b/i,
    id: /\bhidangan hemat untuk hari topan\b/i,
    hint: '颱風天抗漲料理 = budget-friendly typhoon-day dish = hidangan hemat untuk hari topan',
  },
];
const BANNED_TRANSLATIONS = [
  {
    when: /懶人/,
    en: /\blazy\b/i,
    id: /\bmalas\b/i,
    message: '懶人 means easy/hands-off/praktis in a recipe title, not lazy/malas',
  },
  {
    when: /下飯/,
    en: /\brice-adding\b/i,
    id: /\bmenambah nasi\b/i,
    message: '下飯 means goes well with rice/cocok disantap dengan nasi',
  },
  {
    when: /[燜悶]飯/,
    en: /\bfried rice\b/i,
    id: /\bnasi (?:goreng|lemak)\b/i,
    message: '燜飯 is not fried rice, nasi goreng or nasi lemak',
  },
];

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  const options = {
    dryRun: false,
    continueOnError: false,
    limit: null,
    model: DEFAULT_MODEL,
    outputRoot: DEFAULT_OUTPUT_ROOT,
    refresh: false,
    sourceIds: [],
    updateCandidates: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') {
      options.dryRun = true;
    } else if (argument === '--continue-on-error') {
      options.continueOnError = true;
    } else if (argument === '--refresh') {
      options.refresh = true;
    } else if (argument === '--update-candidates') {
      options.updateCandidates = true;
    } else if (argument === '--limit') {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1) fail('--limit requires a positive integer');
      options.limit = value;
      index += 1;
    } else if (argument === '--model') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) fail('--model requires a model name');
      options.model = value;
      index += 1;
    } else if (argument === '--output') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) fail('--output requires a directory');
      options.outputRoot = resolve(process.cwd(), value);
      index += 1;
    } else if (argument === '--source-id') {
      const value = argv[index + 1];
      if (!SOURCE_ID_PATTERN.test(value || '')) fail('--source-id is invalid');
      options.sourceIds.push(value);
      index += 1;
    } else if (argument === '--help' || argument === '-h') {
      console.log(`Usage:
  node scripts/veggiedeer-enrichment/translate-metadata.mjs [options]

Options:
  --dry-run           Call Ollama and print results without writing cache/candidates
  --continue-on-error Finish the batch and report sourceIds that failed
  --limit N           Process at most N recipes
  --source-id ID      Process one sourceId; repeat to select several
  --model NAME        Ollama model (default: qwen3-vl:8b)
  --output DIR        Enrichment output root
  --refresh           Ignore valid cached translations
  --update-candidates Add translations to existing candidate JSON files
  --help              Show this help`);
      process.exit(0);
    } else {
      fail(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sourceHash(recipe, model) {
  return hash(
    JSON.stringify({
      promptVersion: PROMPT_VERSION,
      model,
      titleZh: text(recipe.title?.zh),
      descriptionZh: text(recipe.description?.zh),
      existingTitle: {
        en: text(recipe.title?.en),
        id: text(recipe.title?.id),
      },
      existingDescription: {
        en: text(recipe.description?.en),
        id: text(recipe.description?.id),
      },
    }),
  );
}

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    fail(`${label} is not valid JSON (${path}): ${error.message}`);
  }
}

async function atomicWriteJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporaryPath, json(value), { flag: 'wx' });
    await rename(temporaryPath, path);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw new Error(`Could not atomically write ${path}: ${error.message}`);
  }
}

function missingLanguages(value) {
  return TARGET_LANGUAGES.filter((language) => !text(value?.[language]));
}

function translationPlan(recipe) {
  const title = missingLanguages(recipe.title);
  const description = missingLanguages(recipe.description);
  return { title, description };
}

function buildSchema(plan) {
  const required = [];
  const properties = {};
  for (const field of ['title', 'description']) {
    if (!plan[field].length) continue;
    required.push(field);
    properties[field] = {
      type: 'object',
      required: plan[field],
      properties: Object.fromEntries(
        plan[field].map((language) => [language, { type: 'string' }]),
      ),
      additionalProperties: false,
    };
  }
  return {
    type: 'object',
    required,
    properties,
    additionalProperties: false,
  };
}

function languageName(language) {
  return language === 'en' ? 'natural English' : 'natural Bahasa Indonesia';
}

function buildPrompt(recipe, plan, correction = '') {
  const requests = [];
  for (const field of ['title', 'description']) {
    for (const language of plan[field]) {
      requests.push(`- ${field}.${language}: ${languageName(language)}`);
    }
  }
  const source = `${text(recipe.title?.zh)}\n${text(recipe.description?.zh)}`;
  const relevantGlossary = CULINARY_TERMS
    .filter((term) => source.includes(term.zh))
    .map((term) => `- ${term.hint}`);
  return `你是專業食譜翻譯，讀者是香港家庭及印尼家庭傭工。只翻譯指定欄位。
英文必須是自然的食譜英文；印尼文必須是自然的 Bahasa Indonesia。保留全部原意、
材料、份量、烹調細節、分段及 emoji，不可逐字硬譯，不可增加資料。菜名必須先看
description 理解實際菜式，再用自然目標語言命名。英文及印尼文不可殘留任何漢字。
不可將一般菜式擅自改成另一道著名菜式（例如燜飯不是 fried rice、nasi goreng 或
nasi lemak）。只輸出符合 JSON schema 的 JSON，不要解釋。

Requested fields:
${requests.join('\n')}

Required culinary terminology:
${relevantGlossary.length ? relevantGlossary.join('\n') : '- Use standard English and Indonesian culinary terms.'}
Every listed term that occurs in a Chinese field MUST be represented in that
same translated field. Treat the preferred exact-title example as authoritative.

${correction ? `上一個版本不合格，必須修正：\n${correction}\n` : ''}
Traditional Chinese title:
${text(recipe.title?.zh)}

Traditional Chinese description:
${text(recipe.description?.zh)}`;
}

async function ollamaTags() {
  let response;
  try {
    response = await fetch('http://127.0.0.1:11434/api/tags', {
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    fail(`Ollama is not reachable at 127.0.0.1:11434 (${error.message})`);
  }
  if (!response.ok) fail(`Ollama model list failed with HTTP ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload.models) ? payload.models : [];
}

async function ensureModelAvailable(model) {
  const models = await ollamaTags();
  const available = models.some(
    (item) => item.name === model || item.model === model,
  );
  if (!available) {
    fail(
      `Ollama model ${model} is not installed. Run: ollama pull ${model}`,
    );
  }
}

async function translateWithOllama(recipe, plan, model, correction, attempt) {
  const body = {
    model,
    prompt: buildPrompt(recipe, plan, correction),
    format: buildSchema(plan),
    stream: false,
    think: false,
    options: {
      temperature: 0.1,
      seed: 41 + attempt,
      // Match the transcript/enrichment pipeline so Ollama can reuse the same
      // loaded runner instead of repeatedly unloading on context-size changes.
      num_ctx: 32_768,
    },
  };
  let response;
  try {
    response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(600_000),
    });
  } catch (error) {
    fail(`${recipe.sync?.sourceId}: Ollama request failed (${error.message})`);
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    fail(
      `${recipe.sync?.sourceId}: Ollama returned HTTP ${response.status}: ${detail}`,
    );
  }
  const payload = await response.json();
  if (payload.error) fail(`${recipe.sync?.sourceId}: ${payload.error}`);
  const raw = text(payload.response) || text(payload.thinking);
  if (!raw) fail(`${recipe.sync?.sourceId}: Ollama returned no translation`);
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`${recipe.sync?.sourceId}: Ollama response was not JSON (${error.message})`);
  }
}

function validateTranslations(recipe, plan, translations) {
  if (!translations || typeof translations !== 'object' || Array.isArray(translations)) {
    fail(`${recipe.sync?.sourceId}: translation must be an object`);
  }
  const normalized = {};
  const issues = [];
  for (const field of ['title', 'description']) {
    if (!plan[field].length) continue;
    if (
      !translations[field] ||
      typeof translations[field] !== 'object' ||
      Array.isArray(translations[field])
    ) {
      fail(`${recipe.sync?.sourceId}: missing translated ${field}`);
    }
    normalized[field] = {};
    for (const language of plan[field]) {
      const value = text(translations[field][language]);
      const minimumLength = field === 'description' ? 10 : 1;
      if (value.length < minimumLength) {
        issues.push(`${field}.${language} is too short`);
        continue;
      }
      if (value === text(recipe[field]?.zh)) {
        issues.push(`${field}.${language} was not translated`);
      }
      if (/\p{Script=Han}/u.test(value)) {
        issues.push(`${field}.${language} contains untranslated Han characters`);
      }
      const ChineseSource = text(recipe[field]?.zh);
      for (const term of CULINARY_TERMS) {
        if (
          ChineseSource.includes(term.zh) &&
          !term[language].test(value)
        ) {
          issues.push(
            `${field}.${language} does not preserve the required term ${term.zh}`,
          );
        }
      }
      for (const banned of BANNED_TRANSLATIONS) {
        if (banned.when.test(ChineseSource) && banned[language].test(value)) {
          issues.push(`${field}.${language}: ${banned.message}`);
        }
      }
      normalized[field][language] = value;
    }
  }
  if (issues.length) {
    fail(`${recipe.sync?.sourceId}: ${issues.join('; ')}`);
  }
  return normalized;
}

async function translateAndValidate(recipe, plan, model) {
  let correction = '';
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return validateTranslations(
        recipe,
        plan,
        await translateWithOllama(recipe, plan, model, correction, attempt),
      );
    } catch (error) {
      lastError = error;
      correction = [correction, error.message].filter(Boolean).join('\n');
      if (attempt < 3) {
        console.warn(
          `  ${recipe.sync?.sourceId}: translation QA failed; retrying ` +
            `(${attempt}/3): ${error.message}`,
        );
      }
    }
  }
  throw lastError;
}

function cacheCoversPlan(cache, plan, expectedSourceHash) {
  if (
    cache?.schemaVersion !== 1 ||
    cache?.sourceHash !== expectedSourceHash ||
    !cache.translations
  ) {
    return false;
  }
  return ['title', 'description'].every((field) =>
    plan[field].every((language) =>
      Boolean(text(cache.translations?.[field]?.[language])),
    ),
  );
}

function completeMetadata(recipe, translations) {
  return Object.fromEntries(
    ['title', 'description'].map((field) => [
      field,
      {
        zh: text(recipe[field]?.zh),
        ...(text(recipe[field]?.en) ? { en: text(recipe[field].en) } : {}),
        ...(text(recipe[field]?.id) ? { id: text(recipe[field].id) } : {}),
        ...(translations[field] || {}),
      },
    ]),
  );
}

async function updateCandidate(candidatePath, recipe, translations, dryRun) {
  if (!existsSync(candidatePath)) {
    return { updated: false, reason: 'candidate-missing' };
  }
  const candidate = await readJson(candidatePath, 'Enrichment candidate');
  if (
    candidate.recipe?.id !== recipe.id ||
    candidate.recipe?.sourceId !== recipe.sync?.sourceId
  ) {
    fail(`${recipe.sync?.sourceId}: candidate identity does not match recipe`);
  }
  const metadata = completeMetadata(recipe, translations);
  if (
    !TARGET_LANGUAGES.every(
      (language) =>
        text(metadata.title[language]) && text(metadata.description[language]),
    )
  ) {
    return { updated: false, reason: 'metadata-still-incomplete' };
  }
  if (!dryRun) {
    await atomicWriteJson(candidatePath, {
      ...candidate,
      title: metadata.title,
      description: metadata.description,
    });
  }
  return { updated: true };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const recipes = await readJson(RECIPES_PATH, 'Synced recipe collection');
  if (!Array.isArray(recipes)) fail('Synced recipe collection must be an array');
  const selectedIds = new Set(options.sourceIds);
  let selected = recipes.filter((recipe) => {
    const sourceId = recipe.sync?.sourceId;
    if (selectedIds.size && !selectedIds.has(sourceId)) return false;
    const plan = translationPlan(recipe);
    return plan.title.length || plan.description.length;
  });
  if (selectedIds.size) {
    const found = new Set(selected.map((recipe) => recipe.sync?.sourceId));
    const unknown = [...selectedIds].filter(
      (sourceId) =>
        !recipes.some((recipe) => recipe.sync?.sourceId === sourceId),
    );
    if (unknown.length) fail(`Unknown sourceId(s): ${unknown.join(', ')}`);
    const alreadyComplete = [...selectedIds].filter(
      (sourceId) => !found.has(sourceId) && !unknown.includes(sourceId),
    );
    if (alreadyComplete.length) {
      console.log(`Already complete: ${alreadyComplete.join(', ')}`);
    }
  }
  if (options.limit) selected = selected.slice(0, options.limit);
  if (!selected.length) {
    console.log('No recipes are missing English or Indonesian metadata.');
    return;
  }

  await ensureModelAvailable(options.model);
  const cacheDirectory = resolve(options.outputRoot, 'metadata-translations');
  const candidatesDirectory = resolve(options.outputRoot, 'candidates');
  console.log(
    `${options.dryRun ? 'Dry run:' : 'Translating'} ${selected.length} recipe(s) ` +
      `with ${options.model}; production data is read-only.`,
  );

  let cacheHits = 0;
  let translated = 0;
  let candidatesUpdated = 0;
  const failures = [];
  for (const [index, recipe] of selected.entries()) {
    const sourceId = recipe.sync.sourceId;
    try {
      const plan = translationPlan(recipe);
      const expectedSourceHash = sourceHash(recipe, options.model);
      const cachePath = resolve(cacheDirectory, `${sourceId}.json`);
      let translations;
      if (!options.refresh && existsSync(cachePath)) {
        const cache = await readJson(cachePath, 'Metadata translation cache');
        if (cacheCoversPlan(cache, plan, expectedSourceHash)) {
          translations = validateTranslations(recipe, plan, cache.translations);
          cacheHits += 1;
        }
      }
      if (!translations) {
        translations = await translateAndValidate(recipe, plan, options.model);
        translated += 1;
        if (!options.dryRun) {
          await atomicWriteJson(cachePath, {
            schemaVersion: 1,
            sourceId,
            recipeId: recipe.id,
            model: options.model,
            promptVersion: PROMPT_VERSION,
            sourceHash: expectedSourceHash,
            generatedAt: new Date().toISOString(),
            translations,
          });
        }
      }

      const completed = completeMetadata(recipe, translations);
      console.log(
        `[${index + 1}/${selected.length}] ${sourceId}` +
        `${existsSync(cachePath) && !options.refresh ? ' (cache eligible)' : ''}`,
      );
      if (options.dryRun) {
        console.log(`  en: ${completed.title.en}`);
        console.log(`  id: ${completed.title.id}`);
        console.log(`  en description: ${completed.description.en.slice(0, 180)}`);
        console.log(`  id description: ${completed.description.id.slice(0, 180)}`);
      }
      if (options.updateCandidates) {
        const result = await updateCandidate(
          resolve(candidatesDirectory, `${sourceId}.json`),
          recipe,
          translations,
          options.dryRun,
        );
        if (result.updated) candidatesUpdated += 1;
        else console.log(`  candidate not updated: ${result.reason}`);
      }
    } catch (error) {
      if (!options.continueOnError) throw error;
      failures.push({ sourceId, error: error.message });
      console.error(
        `[${index + 1}/${selected.length}] FAILED ${sourceId}: ${error.message}`,
      );
    }
  }
  console.log(
    `Complete: ${translated} Ollama translation(s), ${cacheHits} cache hit(s), ` +
      `${candidatesUpdated} candidate update(s).` +
      (options.dryRun ? ' No files were written.' : ''),
  );
  if (failures.length) {
    console.error(`Failed sourceIds (${failures.length}):`);
    for (const failure of failures) {
      console.error(`- ${failure.sourceId}: ${failure.error}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Veggie Deer metadata translation failed: ${error.message}`);
  process.exitCode = 1;
});
