#!/usr/bin/env node
/**
 * Adds source-faithful Filipino (`fil`) display text to the 203 completed
 * Veggie Deer recipes. Filipino translations are made from the existing
 * reviewed English copy; quantities, image paths, and source metadata are not
 * altered. This is idempotent and may be rerun to fill only missing fields.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const recipesPath = resolve(projectRoot, 'src/data/synced/veggiedeer-recipes.json');
const titlesPath = resolve(projectRoot, 'scripts/veggiedeer-enrichment/formal-titles.json');
const recipes = JSON.parse(await readFile(recipesPath, 'utf8'));
const titles = JSON.parse(await readFile(titlesPath, 'utf8'));
const completed = recipes.filter((recipe) =>
  recipe.ingredientListComplete === true && recipe.stepListComplete === true,
);

if (completed.length !== 203 || Object.keys(titles).length !== 203) {
  throw new Error('Expected exactly 203 completed recipes and formal title entries');
}

const targetsBySource = new Map();
function collectLocalized(value, label) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectLocalized(item, `${label}[${index}]`));
    return;
  }
  if (typeof value.en === 'string' || typeof value.zh === 'string') {
    if (!value.fil?.trim()) {
      const sourceLanguage = value.en?.trim() ? 'en' : 'zh';
      const source = value[sourceLanguage].trim();
      if (source) {
        const key = `${sourceLanguage}\u0000${source}`;
        targetsBySource.set(key, [...(targetsBySource.get(key) ?? []), value]);
      }
    }
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (!['sync', 'evidence', 'uncertainties'].includes(key)) collectLocalized(nested, `${label}.${key}`);
  }
}

for (const recipe of completed) collectLocalized(recipe, recipe.id);
for (const title of Object.values(titles)) collectLocalized(title, 'formal-title');

function chunks(values, maxCharacters = 4200, maxItems = 35) {
  const result = [];
  let current = [];
  let length = 0;
  for (const value of values) {
    if (current.length && (current.length >= maxItems || length + value.length > maxCharacters)) {
      result.push(current);
      current = [];
      length = 0;
    }
    current.push(value);
    length += value.length;
  }
  if (current.length) result.push(current);
  return result;
}

async function translateBatch(values, sourceLanguage) {
  const url = new URL('https://translate.googleapis.com/translate_a/t');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', sourceLanguage);
  url.searchParams.set('tl', 'tl');
  for (const value of values) url.searchParams.append('q', value);
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`translation request failed: HTTP ${response.status}`);
      const translated = await response.json();
      if (!Array.isArray(translated) || translated.length !== values.length ||
        translated.some((value) => typeof value !== 'string' || !value.trim())) {
        throw new Error('translation response did not match the request batch');
      }
      return translated.map((value) => value.trim());
    } catch (error) {
      lastError = error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 750));
    }
  }
  throw lastError;
}

const sourceStringsByLanguage = new Map();
for (const key of targetsBySource.keys()) {
  const [sourceLanguage, source] = key.split('\u0000');
  sourceStringsByLanguage.set(sourceLanguage, [...(sourceStringsByLanguage.get(sourceLanguage) ?? []), source]);
}
const sourceCount = [...sourceStringsByLanguage.values()].reduce((total, values) => total + values.length, 0);
let translatedCount = 0;
let batchIndex = 0;
for (const [sourceLanguage, sourceStrings] of sourceStringsByLanguage) {
  for (const batch of chunks(sourceStrings)) {
    const translations = await translateBatch(batch, sourceLanguage);
    for (const [offset, translated] of translations.entries()) {
      const key = `${sourceLanguage}\u0000${batch[offset]}`;
      for (const target of targetsBySource.get(key)) target.fil = translated;
    }
    translatedCount += batch.length;
    batchIndex += 1;
    console.log(`Translated ${translatedCount}/${sourceCount} unique Filipino strings (${batchIndex}).`);
  }
}

await writeFile(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`);
await writeFile(titlesPath, `${JSON.stringify(titles, null, 2)}\n`);
console.log(`Filled Filipino text for ${completed.length} completed Veggie Deer recipes.`);
