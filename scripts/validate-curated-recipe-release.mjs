#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  loadOverrideBatches,
} from "./apply-curated-recipe-overrides.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const recipePath = resolve(projectRoot, "src/data/recipes.json");
const recipes = JSON.parse(await readFile(recipePath, "utf8"));
const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
const batches = await loadOverrideBatches();
const errors = [];
let curatedCount = 0;

for (const batch of batches) {
  for (const [recipeId, override] of Object.entries(batch.data.recipes ?? {})) {
    const recipe = recipeById.get(recipeId);
    if (!recipe) {
      errors.push(`${recipeId}: missing from recipe catalogue`);
      continue;
    }
    const curation = recipe.curation;
    if (!curation) {
      errors.push(
        `${recipeId}: curated override has not been applied (run npm run recipes:generate)`,
      );
      continue;
    }
    curatedCount += 1;
    if (curation.schemaVersion !== batch.data.schemaVersion) {
      errors.push(`${recipeId}: curation schemaVersion is stale`);
    }
    if (curation.sourceRecipeSHA256 !== batch.data.sourceRecipeSHA256) {
      errors.push(`${recipeId}: curated source fingerprint is stale`);
    }
    if (curation.overrideFile !== batch.file) {
      errors.push(`${recipeId}: expected override source ${batch.file}`);
    }
    if (curation.overrideSHA256 !== batch.sha256) {
      errors.push(`${recipeId}: curated override fingerprint is stale`);
    }
    if (recipe.family !== override.family) {
      errors.push(`${recipeId}: curated family does not match its override`);
    }
    if (JSON.stringify(recipe.signature) !== JSON.stringify(override.signature)) {
      errors.push(`${recipeId}: curated signature does not match its override`);
    }
    if (recipe.steps.length !== override.steps.length) {
      errors.push(`${recipeId}: curated step count does not match its override`);
    } else {
      for (const [index, overrideStep] of override.steps.entries()) {
        const step = recipe.steps[index];
        const label = `${recipeId}:step-${index + 1}`;
        if (step.title.en !== overrideStep.titleEn) {
          errors.push(`${label}: English title was changed after curation`);
        }
        if (step.instruction.en !== overrideStep.instructionEn) {
          errors.push(`${label}: English instruction was changed after curation`);
        }
        if (step.targetState.en !== overrideStep.targetStateEn) {
          errors.push(`${label}: English target state was changed after curation`);
        }
        for (const [language, suffix] of [["zh", "Zh"], ["id", "Id"]]) {
          for (const [field, overridePrefix] of [
            ["title", "title"],
            ["instruction", "instruction"],
            ["targetState", "targetState"],
          ]) {
            const approved = overrideStep[`${overridePrefix}${suffix}`];
            if (approved && step[field]?.[language] !== approved) {
              errors.push(
                `${label}: approved ${field}.${language} was changed after curation`,
              );
            }
          }
        }
        for (const field of [
          "actionId",
          "prepares",
          "uses",
          "produces",
          "consumes",
        ]) {
          if (JSON.stringify(step[field]) !== JSON.stringify(overrideStep[field])) {
            errors.push(`${label}: ${field} does not match its override`);
          }
        }
      }
    }
    const ingredientById = new Map(
      recipe.ingredients.map((ingredient) => [ingredient.id, ingredient]),
    );
    for (const addition of override.ingredientChanges?.add ?? []) {
      const ingredient = ingredientById.get(addition.id);
      if (!ingredient) {
        errors.push(`${recipeId}: missing curated ingredient ${addition.id}`);
        continue;
      }
      for (const [language, suffix] of [["zh", "Zh"], ["id", "Id"]]) {
        const approved = addition[`name${suffix}`] ?? addition.name?.[language];
        if (approved && ingredient.name?.[language] !== approved) {
          errors.push(
            `${recipeId}: approved ingredient ${addition.id} name.${language} was changed after curation`,
          );
        }
      }
    }
    if (curation.translationStatus !== "complete") {
      errors.push(`${recipeId}: zh/id curated translations are not approved`);
    }
    if (
      !Array.isArray(curation.pendingTranslations) ||
      curation.pendingTranslations.length > 0
    ) {
      errors.push(
        `${recipeId}: ${curation.pendingTranslations?.length ?? "unknown"} curated translation field(s) remain pending`,
      );
    }

    const localizedValues = [
      ...recipe.ingredients.flatMap((ingredient) => Object.values(ingredient.name)),
      ...recipe.steps.flatMap((step) => [
        ...Object.values(step.title),
        ...Object.values(step.instruction),
        ...Object.values(step.targetState),
        ...Object.values(step.imagePrompt),
      ]),
      ...Object.values(recipe.imagePrompt),
    ];
    if (localizedValues.some((value) => /\[TRANSLATION TODO:(?:zh|id)\]/.test(value))) {
      errors.push(`${recipeId}: contains a TRANSLATION TODO placeholder`);
    }
  }
}

if (errors.length) {
  console.error(
    `CURATED RECIPE PRODUCTION GATE BLOCKED with ${errors.length} issue(s).`,
  );
  console.error(
    "English overrides are authoritative, but every preserved/new zh and id field must be translated, image prompts regenerated, and curation.translationStatus set to complete before release.",
  );
  for (const error of errors.slice(0, 120)) console.error(`- ${error}`);
  if (errors.length > 120) {
    console.error(`- …and ${errors.length - 120} more issue(s)`);
  }
  process.exit(1);
}

console.log(
  `Curated recipe production gate passed for ${curatedCount} recipes: exact override fingerprints and approved zh/id translations are present.`,
);
