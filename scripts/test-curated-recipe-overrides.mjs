#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  applyCuratedOverrides,
  loadOverrideBatches,
} from "./apply-curated-recipe-overrides.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const sourceBuffer = await readFile(
  resolve(projectRoot, "src/data/recipes.json"),
);
const sourceHash = createHash("sha256").update(sourceBuffer).digest("hex");
const recipes = JSON.parse(sourceBuffer);
const batches = await loadOverrideBatches();

const result = applyCuratedOverrides({
  recipes,
  sourceRecipeSHA256: sourceHash,
  batches,
});
assert.equal(result.coveredCount, 289);
assert.ok(
  result.appliedCount === 0 || result.appliedCount === 289,
  `expected a fresh or already-curated source, applied ${result.appliedCount}`,
);
assert.equal(result.recipes.length, 300);

const byId = new Map(result.recipes.map((recipe) => [recipe.id, recipe]));
const expectedEquipmentType = {
  pan: "pan",
  wok: "wok",
  mx2: "mx2",
  tray: "accessory",
  steamRack: "accessory",
  ceramicDish: "accessory",
};
const imagePaths = new Set();

for (const batch of batches) {
  for (const [recipeId, override] of Object.entries(batch.data.recipes)) {
    const recipe = byId.get(recipeId);
    assert.ok(recipe, `${recipeId} must exist`);
    assert.equal(recipe.family, override.family);
    assert.deepEqual(recipe.signature, override.signature);
    assert.equal(recipe.steps.length, override.steps.length);
    for (const [index, overrideStep] of override.steps.entries()) {
      const step = recipe.steps[index];
      assert.equal(step.title.en, overrideStep.titleEn);
      assert.equal(step.instruction.en, overrideStep.instructionEn);
      assert.equal(step.targetState.en, overrideStep.targetStateEn);
      for (const field of [
        "actionId",
        "prepares",
        "uses",
        "produces",
        "consumes",
      ]) {
        assert.deepEqual(step[field], overrideStep[field]);
      }
      assert.ok(!imagePaths.has(step.imageUrl), `duplicate ${step.imageUrl}`);
      imagePaths.add(step.imageUrl);
    }

    const ingredientById = new Map(
      recipe.ingredients.map((ingredient) => [ingredient.id, ingredient]),
    );
    for (const entry of override.ingredientChanges?.remove ?? []) {
      assert.ok(!ingredientById.has(typeof entry === "string" ? entry : entry.id));
    }
    for (const entry of override.ingredientChanges?.add ?? []) {
      const ingredient = ingredientById.get(entry.id);
      assert.ok(ingredient, `${recipeId} must add ${entry.id}`);
      assert.equal(ingredient.name.en, entry.nameEn);
      assert.equal(ingredient.amount, entry.amount);
      assert.equal(ingredient.unit.en, entry.unit);
    }
    for (const [id, amount] of Object.entries(
      override.ingredientChanges?.amounts ?? {},
    )) {
      assert.equal(ingredientById.get(id)?.amount, amount.amount);
      assert.equal(ingredientById.get(id)?.unit.en, amount.unit);
    }

    if (override.equipmentTypes !== undefined) {
      assert.deepEqual(
        recipe.equipment.map((item) => item.type),
        override.equipmentTypes.map((type) => expectedEquipmentType[type]),
      );
    }
    if (override.applianceOverride !== undefined) {
      assert.deepEqual(recipe.appliance, override.applianceOverride ?? undefined);
    }
    assert.equal(
      recipe.curation.translationStatus,
      recipe.curation.pendingTranslations.length === 0 ? "complete" : "pending",
    );
  }
}

const firstOverride = batches[0].data.recipes["recipe-001"];
const first = byId.get("recipe-001");
assert.equal(first.steps[0].title.en, firstOverride.steps[0].titleEn);
assert.equal(
  first.steps[0].instruction.en,
  firstOverride.steps[0].instructionEn,
);
assert.equal(first.steps[0].title.zh, firstOverride.steps[0].titleZh);
assert.equal(first.ingredients.find((item) => item.id === "flour").amount, 60);
assert.equal(first.equipment[0].type, "wok");
assert.match(first.steps[0].imageUrl, /step-01\.webp$/);
assert.match(first.steps[0].imagePrompt.en, /Cut the pork and vegetables/);
assert.equal(first.curation.translationStatus, "complete");
assert.deepEqual(first.curation.pendingTranslations, []);
assert.ok(first.steps[0].imagePrompt.zh.includes(firstOverride.steps[0].titleZh));

const translated = byId.get("recipe-102");
assert.equal(translated.curation.translationStatus, "complete");
assert.deepEqual(translated.curation.pendingTranslations, []);
assert.ok(translated.steps[0].title.zh);
assert.ok(translated.steps[0].title.id);
assert.ok(translated.steps[0].imagePrompt.zh);
assert.ok(translated.steps[0].imagePrompt.id);

const mx2 = byId.get("recipe-021");
assert.equal(mx2.appliance.model, "MX2-TT20SC");
assert.deepEqual(
  mx2.equipment.map((item) => item.type),
  ["wok", "mx2", "accessory", "accessory"],
);

const noMx2 = byId.get("recipe-049");
assert.equal(noMx2.appliance, undefined);
assert.ok(!noMx2.tags.some((tag) => tag.en === "MX2-TT20SC"));

const serialized = `${JSON.stringify(result.recipes, null, 2)}\n`;
const second = applyCuratedOverrides({
  recipes: JSON.parse(serialized),
  sourceRecipeSHA256: createHash("sha256").update(serialized).digest("hex"),
  batches,
});
assert.equal(second.appliedCount, 0);
assert.equal(`${JSON.stringify(second.recipes, null, 2)}\n`, serialized);

const translatedOverride = structuredClone(
  batches[0].data.recipes["recipe-001"],
);
for (const step of translatedOverride.steps) {
  step.titleZh = `中：${step.titleEn}`;
  step.titleId = `ID: ${step.titleEn}`;
  step.instructionZh = `中：${step.instructionEn}`;
  step.instructionId = `ID: ${step.instructionEn}`;
  step.targetStateZh = `中：${step.targetStateEn}`;
  step.targetStateId = `ID: ${step.targetStateEn}`;
}
for (const ingredient of translatedOverride.ingredientChanges.add) {
  ingredient.nameZh = `中：${ingredient.nameEn}`;
  ingredient.nameId = `ID: ${ingredient.nameEn}`;
}
const translatedBatchData = {
  schemaVersion: 1,
  sourceRecipeSHA256: sourceHash,
  recipes: { "recipe-001": translatedOverride },
};
const translatedBatchRaw = Buffer.from(JSON.stringify(translatedBatchData));
const translationInput = structuredClone(recipes);
delete translationInput.find((recipe) => recipe.id === "recipe-001").curation;
const translatedResult = applyCuratedOverrides({
  recipes: translationInput,
  sourceRecipeSHA256: sourceHash,
  batches: [{
    file: "translated-test.json",
    raw: translatedBatchRaw,
    sha256: createHash("sha256").update(translatedBatchRaw).digest("hex"),
    data: translatedBatchData,
  }],
}).recipes[0];
assert.equal(translatedResult.curation.translationStatus, "complete");
assert.deepEqual(translatedResult.curation.pendingTranslations, []);
assert.equal(
  translatedResult.steps[0].title.zh,
  `中：${translatedOverride.steps[0].titleEn}`,
);
assert.equal(
  translatedResult.steps[0].instruction.id,
  `ID: ${translatedOverride.steps[0].instructionEn}`,
);
assert.match(
  translatedResult.steps[0].imagePrompt.zh,
  new RegExp(translatedOverride.steps[0].titleZh),
);

console.log(
  "Curated override integration test passed: 289 deterministic overrides, ingredient/equipment/appliance changes, exact English steps, translated override fields, regenerated image metadata, release status, and idempotent re-application.",
);
