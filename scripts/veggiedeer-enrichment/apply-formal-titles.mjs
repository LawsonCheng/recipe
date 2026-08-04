#!/usr/bin/env node
/** Apply concise, localized dish titles to the source-supported Veggie Deer recipes. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const recipesPath = resolve(projectRoot, 'src/data/synced/veggiedeer-recipes.json');
const titlePath = resolve(projectRoot, 'scripts/veggiedeer-enrichment/formal-titles.json');
const recipes = JSON.parse(await readFile(recipesPath, 'utf8'));
const titles = JSON.parse(await readFile(titlePath, 'utf8'));
const EXCLUDED_SOURCE_ID = 'fVk3osVofuA';

function conciseChineseTitle(value) {
  let title = value
    .replace(/[\p{Extended_Pictographic}#]/gu, '')
    .replace(/[！!？?。…]/gu, '｜')
    .split('｜')[0]
    .trim();
  // Retain the dish name while dropping recurring YouTube marketing clauses.
  title = title
    .replace(/^(?:顛覆傳統|懶人|下飯神菜|熱到吃不下飯|新年必備|冷氣團來襲|健康低脂|超強|零失敗|一鍋到底|炎炎夏日|素食者也可以吃了|蛋白質不夠居然會心情低落)/u, '')
    .replace(/(?:一鍋到底|超簡單|年菜要開始練習了|在家也能簡單做|颱風天抗漲料理|颱風天就靠它了|不用再炒豆乾了|料理教學|快速上桌|新手也能做出來|夏天必吃|冰箱一定要有這個|減脂料理).*$/u, '')
    .trim();
  return title || value.trim();
}

function conciseTitle(value, language) {
  const title = value.trim().replace(/[\p{Extended_Pictographic}#]/gu, '');
  return language === 'zh' ? conciseChineseTitle(title) : title
    .replace(/\s*[!！?？…]+\s*/gu, ' ')
    .replace(/\s{2,}/gu, ' ')
    .trim();
}

const completed = recipes.filter((recipe) =>
  recipe.ingredientListComplete === true && recipe.stepListComplete === true,
);
if (completed.length !== 203 || titles[EXCLUDED_SOURCE_ID] || Object.keys(titles).length !== 203) {
  throw new Error('Formal title manifest must contain exactly the 203 source-supported recipes');
}

for (const recipe of completed) {
  const sourceId = recipe.sync?.sourceId;
  const title = titles[sourceId];
  if (!title) throw new Error(`Missing formal title for ${sourceId}`);
  recipe.title = Object.fromEntries(
    ['zh', 'en', 'id', 'fil'].map((language) => [language, conciseTitle(title[language] ?? '', language)]),
  );
  if (Object.values(recipe.title).some((value) => !value)) {
    throw new Error(`Incomplete formal title for ${sourceId}`);
  }
}

await writeFile(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`);
console.log(`Applied concise trilingual formal titles to ${completed.length} recipes.`);
