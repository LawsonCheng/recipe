import { readFile } from 'node:fs/promises';

const path = new URL('../src/data/recipes.json', import.meta.url);
const recipes = JSON.parse(await readFile(path, 'utf8'));
const languages = ['zh', 'en', 'id'];
const errors = [];

if (recipes.length !== 300) {
  errors.push(`Expected 300 recipes, received ${recipes.length}`);
}

const ids = new Set();
const titles = Object.fromEntries(languages.map((language) => [language, new Set()]));
const allowedEquipmentTypes = new Set(['pan', 'wok', 'mx2', 'accessory']);
let bakedRiceCount = 0;
for (const [index, recipe] of recipes.entries()) {
  const label = recipe.id || `recipe at index ${index}`;
  if (!recipe.id || ids.has(recipe.id)) errors.push(`${label}: missing or duplicate id`);
  ids.add(recipe.id);
  for (const field of ['title', 'description']) {
    for (const language of languages) {
      if (!recipe[field]?.[language]) errors.push(`${label}: missing ${field}.${language}`);
    }
  }
  for (const language of languages) {
    const title = recipe.title?.[language];
    if (title && titles[language].has(title)) errors.push(`${label}: duplicate ${language} title`);
    if (title) titles[language].add(title);
  }
  if (recipe.servings !== 3) errors.push(`${label}: default servings must be 3`);
  if (Object.values(recipe.title || {}).join(' ').match(/焗.*飯|baked.*rice|rice.*bake/i)) {
    bakedRiceCount += 1;
  }
  if (!Array.isArray(recipe.tags) || !recipe.tags.length) errors.push(`${label}: missing tags`);
  if (!Array.isArray(recipe.equipment) || !recipe.equipment.length) {
    errors.push(`${label}: missing allowed equipment list`);
  } else {
    for (const item of recipe.equipment) {
      if (!allowedEquipmentTypes.has(item.type)) {
        errors.push(`${label}: unsupported equipment type ${item.type}`);
      }
      for (const language of languages) {
        if (!item.name?.[language]) errors.push(`${label}: equipment missing name.${language}`);
      }
    }
  }
  if (recipe.appliance && recipe.appliance.model !== 'MX2-TT20SC') {
    errors.push(`${label}: unsupported appliance ${recipe.appliance.model}`);
  }
  if (String(recipe.imageUrl || recipe.image || '').includes('home-table-hero')) {
    errors.push(`${label}: recipe uses the old shared hero image`);
  }
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length < 3) {
    errors.push(`${label}: needs at least 3 ingredients`);
  }
  if (!Array.isArray(recipe.steps) || recipe.steps.length < 3) {
    errors.push(`${label}: needs at least 3 steps`);
  }
  for (const [stepIndex, step] of (recipe.steps || []).entries()) {
    for (const language of languages) {
      if (!step.instruction?.[language]) {
        errors.push(`${label}: step ${stepIndex + 1} missing instruction.${language}`);
      }
    }
    if (!step.image && !step.imageUrl && !step.imagePrompt) {
      errors.push(`${label}: step ${stepIndex + 1} missing image metadata`);
    }
    if (String(step.imageUrl || step.image || '').includes('home-table-hero')) {
      errors.push(`${label}: step ${stepIndex + 1} uses the old shared hero image`);
    }
  }
}

if (bakedRiceCount < 12) {
  errors.push(`Expected at least 12 baked-rice recipes, received ${bakedRiceCount}`);
}

if (errors.length) {
  console.error(errors.slice(0, 100).join('\n'));
  if (errors.length > 100) console.error(`…and ${errors.length - 100} more`);
  process.exit(1);
}

console.log(
  `Validated ${recipes.length} recipes, ${bakedRiceCount} baked-rice dishes, ` +
    '3-serving defaults, allowed equipment, unique trilingual titles and custom image metadata.',
);
