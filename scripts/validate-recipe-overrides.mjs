#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "src/data/recipes.json");
const sourceBuffer = await readFile(sourcePath);
const sourceHash = createHash("sha256").update(sourceBuffer).digest("hex");
const sourceRecipes = JSON.parse(sourceBuffer);
const sourceById = new Map(sourceRecipes.map((recipe) => [recipe.id, recipe]));
const paths = process.argv.slice(2);

if (!paths.length) {
  console.error("Usage: node scripts/validate-recipe-overrides.mjs <batch.json> [...]");
  process.exit(2);
}

const errors = [];
const seenRecipes = new Set();
const instructionOwners = new Map();
const banned = [
  /according to cooking time/i,
  /remaining ingredients/i,
  /mix the sauces and spices/i,
  /for (?:fried rice|a rice bowl).*\bfor (?:fried rice|a rice bowl)/i,
  /\bif (?:used|using|needed)\b/i,
  /\bas appropriate\b/i,
  /\bany fresh vegetables\b/i,
  /\bthe aromatics\b/i,
  /\bthe vegetables\b/i,
  /\bthe main ingredient\b/i,
  /\bprepare exactly\b/i,
  /\bpat meat or seafood\b/i,
  /\bmix the dish seasoning\b/i,
  /\bkeep this exact seasoning\b/i,
  /\badd no further vegetables\b/i,
  /\bno additional seasoning\b/i,
  /\breturn removed seafood\b/i,
  /\bif the title specifies\b/i,
  /\bfor fishcakes\b.*\bfor chickpea patties\b/i,
  /\bminced beef must\b.*\bminced chicken\b/i,
  /\bpoultry must\b.*\bfish must\b/i,
  /\bmeat must be fork-tender\b/i,
  /\bfinish .+ with no additional\b/i,
  /\bfold in\s+off heat\b/i,
];

function entryId(value) {
  return typeof value === "string" ? value : value?.id;
}

function addedName(value) {
  if (typeof value === "string") return null;
  return value?.nameEn || value?.name?.en || null;
}

function normalized(value) {
  return value
    .toLowerCase()
    .replace(/\b\d+(?:\.\d+)?\b/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

for (const relativePath of paths) {
  const filePath = resolve(root, relativePath);
  let batch;
  try {
    batch = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    errors.push(`${relativePath}: cannot parse JSON (${error.message})`);
    continue;
  }

  if (batch.schemaVersion !== 1) {
    errors.push(`${relativePath}: schemaVersion must be 1`);
  }
  if (!batch.recipes || typeof batch.recipes !== "object") {
    errors.push(`${relativePath}: missing recipes object`);
    continue;
  }
  if (batch.sourceRecipeSHA256 !== sourceHash) {
    const batchRecipeIds = Object.keys(batch.recipes);
    const isAlreadyCuratedSource =
      batchRecipeIds.length > 0 &&
      batchRecipeIds.every((recipeId) => {
        const source = sourceById.get(recipeId);
        return (
          source?.curation?.sourceRecipeSHA256 ===
            batch.sourceRecipeSHA256 &&
          typeof source?.curation?.overrideSHA256 === "string" &&
          source.curation.overrideSHA256.length > 0
        );
      });
    if (!isAlreadyCuratedSource) {
      errors.push(
        `${relativePath}: source hash ${batch.sourceRecipeSHA256} does not match ${sourceHash} and the current source is not a matching curated release`,
      );
    }
  }

  for (const [recipeId, override] of Object.entries(batch.recipes)) {
    const source = sourceById.get(recipeId);
    if (!source) {
      errors.push(`${relativePath}:${recipeId}: unknown source recipe`);
      continue;
    }
    if (seenRecipes.has(recipeId)) {
      errors.push(`${relativePath}:${recipeId}: recipe appears in more than one batch`);
    }
    seenRecipes.add(recipeId);

    if (!override.family || !override.signature) {
      errors.push(`${recipeId}: family and signature are required`);
    }

    const changes = override.ingredientChanges || {};
    const removed = new Set((changes.remove || []).map(entryId));
    const added = changes.add || [];
    const ingredientNames = new Map(
      source.ingredients
        .filter((ingredient) => !removed.has(ingredient.id))
        .map((ingredient) => [ingredient.id, ingredient.name.en]),
    );
    for (const entry of added) {
      const id = entryId(entry);
      if (!id) {
        errors.push(`${recipeId}: ingredientChanges.add has an entry without id`);
        continue;
      }
      const name = addedName(entry);
      if (!ingredientNames.has(id) && !name) {
        errors.push(`${recipeId}: new ingredient ${id} requires nameEn`);
      }
      ingredientNames.set(id, name || ingredientNames.get(id) || id);
    }

    const steps = override.steps;
    if (!Array.isArray(steps) || steps.length < 6 || steps.length > 9) {
      errors.push(`${recipeId}: must have 6–9 steps`);
      continue;
    }

    const used = new Set();
    const produced = new Map();
    const consumed = new Set();
    const actionIds = new Set();

    for (const [index, step] of steps.entries()) {
      const label = `${recipeId}:step-${index + 1}`;
      if (!step.actionId || actionIds.has(step.actionId)) {
        errors.push(`${label}: missing or duplicate actionId`);
      }
      actionIds.add(step.actionId);
      if (!step.titleEn || !step.targetStateEn || !step.instructionEn) {
        errors.push(`${label}: titleEn, instructionEn and targetStateEn are required`);
      }
      if ((step.instructionEn || "").length < 45) {
        errors.push(`${label}: instruction is too short to be independently actionable`);
      }
      for (const pattern of banned) {
        if (pattern.test(step.instructionEn || "")) {
          errors.push(`${label}: banned generic wording ${pattern}`);
        }
      }

      for (const key of ["prepares", "uses", "produces", "consumes"]) {
        if (!Array.isArray(step[key])) errors.push(`${label}: ${key} must be an array`);
      }
      const prepares = new Set(step.prepares || []);
      for (const id of step.uses || []) {
        if (prepares.has(id)) errors.push(`${label}: ${id} is both prepares and uses`);
        if (!ingredientNames.has(id)) errors.push(`${label}: uses unknown ingredient ${id}`);
        const name = ingredientNames.get(id);
        if (
          name &&
          !(step.instructionEn || "").toLowerCase().includes(name.toLowerCase())
        ) {
          errors.push(`${label}: uses ${id} but does not name “${name}”`);
        }
        used.add(id);
      }
      for (const id of step.prepares || []) {
        if (!ingredientNames.has(id)) errors.push(`${label}: prepares unknown ingredient ${id}`);
      }
      for (const product of step.produces || []) {
        if (!product || produced.has(product)) {
          errors.push(`${label}: invalid or duplicate produced component ${product}`);
        } else {
          produced.set(product, index);
        }
      }
      for (const product of step.consumes || []) {
        if (!produced.has(product) || produced.get(product) >= index) {
          errors.push(`${label}: consumes ${product} before it is produced`);
        }
        consumed.add(product);
      }

      const skeleton = normalized(step.instructionEn || "");
      const owners = instructionOwners.get(skeleton) || [];
      owners.push(label);
      instructionOwners.set(skeleton, owners);
    }

    for (const id of ingredientNames.keys()) {
      if (!used.has(id)) errors.push(`${recipeId}: ingredient ${id} has no culinary uses[]`);
    }
    for (const product of produced.keys()) {
      if (!consumed.has(product)) errors.push(`${recipeId}: product ${product} is never consumed`);
    }
  }
}

for (const [skeleton, owners] of instructionOwners) {
  if (owners.length > 1) {
    errors.push(
      `Duplicate normalized instruction (${owners.join(", ")}): ${skeleton.slice(0, 120)}`,
    );
  }
}

if (errors.length) {
  console.error(`Recipe override validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Recipe override validation passed: ${seenRecipes.size} recipes across ${paths.length} batch file(s).`,
);
