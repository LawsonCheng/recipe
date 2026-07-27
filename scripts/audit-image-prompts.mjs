#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const args = new Set(process.argv.slice(2));
const recipesPath = resolve(
  process.cwd(),
  [...args].find((arg) => arg.endsWith(".json")) || "src/data/recipes.json",
);
const outputJson = args.has("--json");
const strict = args.has("--strict");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const exampleLimit = Number(limitArg?.split("=")[1] || 12);

const normalized = (value = "") =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const containsPhrase = (text, phrase) => {
  const haystack = normalized(text);
  const needle = normalized(phrase);
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(
    haystack,
  );
};

const PANTRY_WORDS = new Set([
  "oil", "cooking oil", "salt", "water", "hot water", "sugar", "pepper",
]);

const ACTION_CUES = [
  "add", "arrange", "assemble", "bake", "beat", "blanch", "blend", "boil",
  "braise", "break up", "brush", "carve", "check", "chill", "chop", "coat",
  "combine", "cook", "cool", "cut", "dice", "drain", "dress", "drizzle", "dry",
  "emulsify", "fill", "finish", "flip", "fold", "fry", "garnish",
  "glaze", "grate", "grill", "heat", "knead", "layer", "marinate",
  "mash", "measure", "mix", "pat", "peel", "plate", "pour", "preheat",
  "reduce", "rest", "rinse", "roast", "sear", "season", "serve", "shape",
  "shake", "shred", "simmer", "slice", "soak", "spoon", "steam", "thread",
  "stir", "strain", "toast", "toss", "transfer", "turn", "wash", "whisk",
  "wipe", "load",
];

const EQUIPMENT_CUES = [
  "baking dish", "baking paper", "board", "bowl", "ceramic dish",
  "chinese wok", "chopsticks", "colander", "cup", "flat cavity base",
  "frying pan", "jar", "knife", "ladle", "lid", "lower level",
  "measuring spoon", "microwave", "mx2", "oven", "oven gloves", "pan",
  "plate", "rack", "steaming rack", "supplied tray", "thermometer",
  "tongs", "toshiba", "tray", "water tank", "wok",
];

const HEAT_CUES = [
  "lowest heat", "low heat", "medium-low", "medium heat", "medium-high",
  "high heat", "gentle bubble", "rolling boil", "preheat",
];

const VISUAL_STATE_CUES = [
  "amber", "browned", "browning", "bubbles", "charred", "clear",
  "coated", "crisp", "crispy", "curdled", "dry", "emulsified", "flaky",
  "foamy", "fragrant", "glazed", "glossy", "golden", "juices run clear",
  "melted", "opaque", "puffed", "set", "shiny", "softened", "sticky",
  "tender", "thick", "thickened", "translucent", "wilted",
];

const GENERIC_ONLY_PATTERNS = [
  /only the ingredients and utensils needed for this step/i,
  /realistic food photography,? clear,? no text/i,
  /showing step \d+/i,
];

const temperatureMatches = (text) =>
  normalized(text).match(/\b\d{2,3}\s*°?\s*c\b/g) || [];

function matchedCues(text, cues) {
  return cues.filter((cue) => containsPhrase(text, cue));
}

function expectedIngredientNames(recipe, instruction) {
  const all = recipe.ingredients
    .map((ingredient) => ingredient.name?.en)
    .filter(Boolean)
    .filter((name) => !PANTRY_WORDS.has(normalized(name)));
  const mentioned = all.filter((name) => containsPhrase(instruction, name));
  // A step should still name its food subject even when the generated
  // instruction says only "the fried ingredient" or "the topping".
  return mentioned.length ? mentioned : all.slice(0, 1);
}

function auditStep(recipe, step) {
  const prompt = step.imagePrompt?.en || "";
  const instruction = step.instruction?.en || "";
  const title = step.title?.en || "";
  const expectedIngredients = expectedIngredientNames(recipe, instruction);
  const foundIngredients = expectedIngredients.filter((name) =>
    containsPhrase(prompt, name)
  );
  const ingredientTarget = Math.min(2, expectedIngredients.length);
  const ingredientPass =
    ingredientTarget > 0 && foundIngredients.length >= ingredientTarget;

  const expectedActions = matchedCues(`${title}. ${instruction}`, ACTION_CUES);
  const foundActions = expectedActions.filter((cue) => containsPhrase(prompt, cue));
  const actionPass = expectedActions.length > 0 && foundActions.length > 0;

  const expectedEquipment = matchedCues(instruction, EQUIPMENT_CUES);
  const expectedHeat = matchedCues(instruction, HEAT_CUES);
  const instructionTemperatures = temperatureMatches(instruction);
  const relevantEquipmentSetting =
    expectedEquipment.length > 0 ||
    expectedHeat.length > 0 ||
    instructionTemperatures.length > 0;
  const foundEquipment = expectedEquipment.filter((cue) =>
    containsPhrase(prompt, cue)
  );
  const foundHeat = expectedHeat.filter((cue) => containsPhrase(prompt, cue));
  const foundTemperatures = instructionTemperatures.filter((cue) =>
    normalized(prompt).includes(cue)
  );
  const equipmentSettingPass =
    !relevantEquipmentSetting ||
    foundEquipment.length > 0 ||
    foundHeat.length > 0 ||
    foundTemperatures.length > 0;

  const expectedVisualStates = matchedCues(instruction, VISUAL_STATE_CUES);
  const visualStateRelevant = expectedVisualStates.length > 0;
  const foundVisualStates = expectedVisualStates.filter((cue) =>
    containsPhrase(prompt, cue)
  );
  const visualStatePass =
    !visualStateRelevant || foundVisualStates.length > 0;

  const appliance = recipe.appliance;
  const applianceStep = Boolean(
    appliance &&
      /(mx2|toshiba|oven|bake|steam|preheat|lower level|rack|tray)/i.test(
        `${title} ${instruction}`,
      )
  );
  const expectedApplianceTokens = applianceStep
    ? [
        appliance.model,
        appliance.mode?.en,
        appliance.temperatureC ? `${appliance.temperatureC}°C` : null,
        appliance.rack?.en,
        appliance.vessel?.en,
      ].filter(Boolean)
    : [];
  const foundApplianceTokens = expectedApplianceTokens.filter((cue) =>
    containsPhrase(prompt, cue)
  );
  // At minimum the exact model/mode plus one physical or numeric setting.
  const appliancePass =
    !applianceStep ||
    (expectedApplianceTokens.length > 0 && foundApplianceTokens.length >= 2);

  const localePass = ["zh", "en", "id"].every(
    (locale) => normalized(step.imagePrompt?.[locale]).length >= 24,
  );
  const recipeIdentityPass =
    containsPhrase(prompt, recipe.title?.en) ||
    containsPhrase(prompt, recipe.slug?.replaceAll("-", " "));
  const stepIdentityPass =
    containsPhrase(prompt, title) &&
    new RegExp(`\\bstep\\s*${step.order}\\b`, "i").test(prompt);
  const noTextPass = /\b(no text|without text|no lettering)\b/i.test(prompt);
  const photorealisticStylePass =
    /\b(?:photorealistic|realistic)\b[^.]{0,80}\b(?:food )?photograph/i.test(prompt) &&
    /\bno cartoon\b/i.test(prompt) &&
    /\billustration\b/i.test(prompt) &&
    /\b3d render\b/i.test(prompt) &&
    /\bcgi\b/i.test(prompt);
  const genericTemplateHits = GENERIC_ONLY_PATTERNS.filter((pattern) =>
    pattern.test(prompt)
  ).length;
  const nonGenericPass = genericTemplateHits < 2;

  const checks = {
    localePass,
    recipeIdentityPass,
    stepIdentityPass,
    ingredientPass,
    actionPass,
    equipmentSettingPass,
    visualStatePass,
    appliancePass,
    noTextPass,
    photorealisticStylePass,
    nonGenericPass,
  };
  const failed = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  return {
    id: `${recipe.slug}#${step.order}`,
    recipe: recipe.title?.en,
    step: step.order,
    title,
    checks,
    applicable: {
      localePass: true,
      recipeIdentityPass: true,
      stepIdentityPass: true,
      ingredientPass: true,
      actionPass: true,
      equipmentSettingPass: relevantEquipmentSetting,
      visualStatePass: visualStateRelevant,
      appliancePass: applianceStep,
      noTextPass: true,
      photorealisticStylePass: true,
      nonGenericPass: true,
    },
    failed,
    prompt,
    expected: {
      ingredients: expectedIngredients.slice(0, 4),
      actions: expectedActions.slice(0, 6),
      equipment: expectedEquipment,
      heat: [...expectedHeat, ...instructionTemperatures],
      visualStates: expectedVisualStates,
      appliance: expectedApplianceTokens,
    },
    found: {
      ingredients: foundIngredients,
      actions: foundActions,
      equipment: foundEquipment,
      heat: [...foundHeat, ...foundTemperatures],
      visualStates: foundVisualStates,
      appliance: foundApplianceTokens,
    },
    genericTemplateHits,
  };
}

const recipes = JSON.parse(await readFile(recipesPath, "utf8"));
const results = recipes.flatMap((recipe) =>
  recipe.steps.map((step) => auditStep(recipe, step))
);

const checkKeys = Object.keys(results[0]?.checks || {});
const counts = Object.fromEntries(
  checkKeys.map((key) => [
    key,
    results.filter((result) => result.checks[key]).length,
  ]),
);
const applicableCounts = Object.fromEntries(
  checkKeys.map((key) => [
    key,
    results.filter((result) => result.applicable[key]).length,
  ]),
);
const strong = results.filter((result) => result.failed.length === 0);
const generic = results.filter((result) => result.genericTemplateHits >= 2);
const exactDuplicateGroups = Object.entries(
  results.reduce((groups, result) => {
    const key = normalized(result.prompt);
    groups[key] ||= [];
    groups[key].push(result.id);
    return groups;
  }, {}),
).filter(([, ids]) => ids.length > 1);

const report = {
  source: recipesPath,
  recipeCount: recipes.length,
  stepCount: results.length,
  allChecksPassed: strong.length,
  weakOrIncomplete: results.length - strong.length,
  genericTemplatePrompts: generic.length,
  exactDuplicatePromptGroups: exactDuplicateGroups.length,
  checks: Object.fromEntries(
    checkKeys.map((key) => [
      key,
      {
        passed: results.filter(
          (result) => result.applicable[key] && result.checks[key],
        ).length,
        applicable: applicableCounts[key],
        failed: results.filter(
          (result) => result.applicable[key] && !result.checks[key],
        ).length,
        percent: Number(
          (
            (results.filter(
              (result) => result.applicable[key] && result.checks[key],
            ).length /
              Math.max(1, applicableCounts[key])) *
            100
          ).toFixed(1),
        ),
      },
    ]),
  ),
  examples: results
    .filter((result) => result.failed.length > 0)
    .sort((a, b) => b.failed.length - a.failed.length)
    .slice(0, exampleLimit)
    .map(({ id, recipe, step, title, failed, expected, found, prompt }) => ({
      id,
      recipe,
      step,
      title,
      failed,
      expected,
      found,
      prompt,
    })),
};

if (outputJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Step image prompt audit: ${report.recipeCount} recipes / ${report.stepCount} steps`);
  console.log(`Fully traceable prompts: ${report.allChecksPassed}/${report.stepCount}`);
  console.log(`Weak or incomplete prompts: ${report.weakOrIncomplete}/${report.stepCount}`);
  console.log(`Generic-template prompts: ${report.genericTemplatePrompts}/${report.stepCount}`);
  console.log(`Exact duplicate prompt groups: ${report.exactDuplicatePromptGroups}`);
  console.log("");
  for (const [key, value] of Object.entries(report.checks)) {
    console.log(
      `${key.padEnd(24)} ${String(value.passed).padStart(4)}/${String(value.applicable).padEnd(4)} (${value.percent}%)`,
    );
  }
  if (report.examples.length) {
    console.log("\nWeakest examples:");
    for (const example of report.examples) {
      console.log(`- ${example.id} "${example.title}": ${example.failed.join(", ")}`);
      console.log(`  expected ingredients: ${example.expected.ingredients.join(", ") || "none"}`);
      console.log(`  expected equipment/heat: ${[
        ...example.expected.equipment,
        ...example.expected.heat,
      ].join(", ") || "none"}`);
      console.log(`  expected visual states: ${example.expected.visualStates.join(", ") || "none"}`);
    }
  }
}

if (strict && report.weakOrIncomplete > 0) process.exitCode = 1;
