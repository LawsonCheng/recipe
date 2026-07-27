#!/usr/bin/env node
/**
 * Production content checks for the generated recipe catalogue.
 *
 * These checks focus on dangerous or confusing template contamination. They do
 * not replace a cook test, but they stop known bad instructions from reaching
 * the app.
 */
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const recipesPath = resolve(here, "../src/data/recipes.json");
const recipes = JSON.parse(await readFile(recipesPath, "utf8"));
const errors = [];
const instructionOwners = new Map();
const bannedGenericPhrases = [
  "mix the sauces and spices",
  "remaining prepared ingredients",
  "remaining sauce ingredients",
];
const phantomPantry = new Map([
  ["honey", "honey"],
  ["breadcrumb", "breadcrumbs"],
  ["butter", "butter"],
  ["cream", "cooking cream"],
  ["flour", "plain flour"],
  ["cornstarch", "cornstarch"],
]);
const signatureRules = new Map([
  ["Family-style okonomiyaki", {
    family: "cabbagePancake",
    ingredients: ["egg", "flour", "cabbage"],
    actionIds: ["make-the-cabbage-batter", "flip-and-cook-through"],
  }],
  ["Palak paneer", {
    family: "spinachCurry",
    ingredients: ["paneer", "spinach", "onion", "garlic", "ginger", "cannedTomato", "cream"],
    actionIds: ["cook-the-onion-tomato-masala", "cook-the-spinach-cream-sauce", "return-paneer-and-finish"],
  }],
  ["Chive-style egg pancake", {
    family: "eggOrSavoryPancake",
    ingredients: ["egg", "flour", "scallion"],
    actionIds: ["make-the-vegetable-batter", "flip-and-cook-the-centre"],
  }],
  ["Korean cabbage pancake", {
    family: "eggOrSavoryPancake",
    ingredients: ["cabbage", "egg", "flour"],
    actionIds: ["make-the-vegetable-batter", "flip-and-cook-the-centre"],
  }],
  ["Shredded chicken cold noodles", {
    family: "coldNoodles",
    ingredients: ["chickenBreast", "noodle", "cucumber", "sesameOil"],
    actionIds: ["poach-the-chicken", "cook-and-chill-the-noodles", "shred-chicken-and-toss"],
  }],
  ["Japanese tofu hamburger steak", {
    family: "tofuPatty",
    ingredients: ["firmTofu", "mushroom", "onion", "egg", "breadcrumb"],
    actionIds: ["mix-and-shape-patties", "pan-fry-both-sides", "glaze-with-ginger-sauce"],
  }],
  ["Japanese-Chinese omelette rice", {
    family: "omeletteRice",
    ingredients: ["egg", "rice", "corn", "mushroom"],
    actionIds: ["make-the-seasoned-rice", "cook-three-soft-omelettes", "cover-rice-with-omelette"],
  }],
  ["Korean beef bibimbap", {
    family: "bibimbap",
    ingredients: ["beefFlank", "rice", "egg", "spinach", "carrot", "mushroom", "gochujang"],
    actionIds: ["cook-vegetables-separately", "cook-the-beef", "assemble-in-separate-sections"],
  }],
  ["Mild Korean cucumber salad", {
    family: "rawSalad",
    ingredients: ["cucumber", "gochujang", "lime"],
    actionIds: ["salt-briefly-to-remove-water", "dress-gradually"],
  }],
  ["Thai carrot som tam-style salad", {
    family: "rawSalad",
    ingredients: ["carrot", "fishSauce", "lime"],
    actionIds: ["salt-briefly-to-remove-water", "dress-gradually"],
  }],
  ["Mild chilli dumpling-style soup", {
    family: "dumplingSoup",
    ingredients: ["porkMince", "flour", "cabbage"],
    actionIds: ["make-dough-and-prepare-filling", "roll-and-fill-dumplings", "boil-dumplings-until-floating"],
  }],
  ["Thai basil minced pork", {
    family: "thaiBasilMince",
    ingredients: ["porkMince", "basil", "egg", "fishSauce"],
    actionIds: ["fry-three-eggs-first", "stir-fry-and-break-up-pork", "add-pepper-basil-and-sauce"],
  }],
  ["Thai minced chicken lettuce cups", {
    family: "lettuceCups",
    ingredients: ["chickenBreast", "lettuce", "basil", "fishSauce"],
    actionIds: ["mince-chicken-and-wash-lettuce", "cook-aromatics-and-chicken", "fill-lettuce-cups"],
  }],
  ["Pineapple coconut sticky-rice style dessert", {
    family: "stickyRiceDessert",
    ingredients: ["glutinousRice", "pineapple", "coconutMilk"],
    actionIds: ["soak-rice-and-cut-pineapple", "cook-the-glutinous-rice", "caramelise-pineapple"],
  }],
  ["Family-style beef rendang", {
    family: "rendang",
    ingredients: ["beefBrisket", "coconutMilk", "lemongrass", "sambal"],
    actionIds: ["fry-the-rendang-paste", "add-coconut-milk-and-braise", "add-potatoes-and-reduce"],
  }],
  ["Indonesian chicken satay", {
    family: "satay",
    ingredients: ["chickenThigh", "peanut", "coconutMilk"],
    actionIds: ["marinate-the-chicken", "skewer-and-preheat-mx2", "bake-until-75-c"],
  }],
  ["Gado-gado warm vegetable salad", {
    family: "gadoGado",
    ingredients: ["firmTofu", "peanut", "egg", "potato", "cabbage", "beanSprout"],
    actionIds: ["boil-eggs-potatoes-and-vegetables", "brown-the-tofu", "cook-thick-peanut-sauce"],
  }],
]);

const poultry = new Set(["chickenThigh", "chickenBreast", "chickenWing", "duck"]);
const mince = new Set(["porkMince", "beefMince", "plantMince"]);
const fish = new Set(["fishFillet", "wholeFish", "salmon"]);
const sauceKeysForValidation = new Set([
  "lightSoy", "darkSoy", "oysterSauce", "vegOyster", "sesameOil", "fishSauce",
  "tomatoPaste", "blackBean", "hoisin", "charSiu", "doubanjiang", "gochujang",
  "miso", "curryPaste", "sambal", "vinegar", "honey", "cannedTomato",
  "coconutMilk", "stock", "cream", "milk",
]);
const forbiddenPrepIds = new Set([
  "honey", "breadcrumb", "butter", "cream", "milk", "cheese", "flour",
  "cornstarch", "lightSoy", "darkSoy", "oysterSauce",
  "vegOyster", "sesameOil", "fishSauce", "tomatoPaste", "blackBean",
  "hoisin", "charSiu", "doubanjiang", "gochujang", "miso", "curryPaste",
  "curryPowder", "sambal", "paprika", "cumin", "turmeric", "garamMasala",
  "italianHerb", "sugar", "vinegar", "pepper", "blackPepper",
]);

function fullText(recipe, lang = "en") {
  return recipe.steps.map((step) => `${step.title?.[lang] || ""}. ${step.instruction?.[lang] || ""}`).join(" ");
}

function sentences(recipe, lang = "en") {
  return fullText(recipe, lang)
    .split(/[.!?。！？;；]+/)
    .map((part) => part.replace(/^.*?,\s*step\s+\d+:\s*/i, "").trim())
    .filter(Boolean);
}

function containsPositiveAction(recipe, ingredientNames, actions) {
  const negation = /\b(?:do not|don't|never|no need to|must not|rather than|without)\b/i;
  return sentences(recipe).some((sentence) => (
    !negation.test(sentence) &&
    ingredientNames.some((name) => {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return actions.some((action) => {
        const ingredient = `(?:^|\\b)${escaped}(?:\\b|$)`;
        return new RegExp(`(?:${action.source})[^.;]{0,25}${ingredient}|${ingredient}[^.;]{0,25}(?:${action.source})`, "i").test(sentence);
      });
    })
  ));
}

function requireText(recipe, condition, message) {
  if (!condition) errors.push(`${recipe.id} ${recipe.title.en}: ${message}`);
}

function mentionsIngredient(text, ingredientName) {
  const escaped = ingredientName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i").test(text);
}

for (const recipe of recipes) {
  const ids = new Set(recipe.ingredients.map((item) => item.id));
  const en = fullText(recipe);
  const zh = fullText(recipe, "zh");
  const id = fullText(recipe, "id");
  const all = `${en} ${zh} ${id}`;
  const isRiceBake = recipe.tags.some((tag) => tag.en === "Rice bake");

  requireText(recipe, recipe.servings === 3, "servings must default to 3");
  requireText(recipe, recipe.steps.length >= 6, "must contain at least 6 instructional steps");
  requireText(recipe, recipe.steps.every((step) => step.imagePrompt?.en.includes(step.instruction.en)), "every image prompt must include its complete English step instruction");
  requireText(recipe, typeof recipe.family === "string" && recipe.family.length > 0, "missing semantic recipe family");
  requireText(recipe, Array.isArray(recipe.signature?.ingredientIds) && Array.isArray(recipe.signature?.techniqueIds), "missing semantic signature");

  /*
   * Curated recipes are validated against their immutable override
   * fingerprints, localized numeric parity, and release approval by the
   * dedicated override/release gates. The legacy rules below describe the
   * original template action graph and would incorrectly require curated
   * recipes to keep obsolete action IDs and component names.
   */
  const approvedCurated =
    recipe.curation?.schemaVersion === 1 &&
    recipe.curation?.translationStatus === "complete" &&
    Array.isArray(recipe.curation?.pendingTranslations) &&
    recipe.curation.pendingTranslations.length === 0;
  if (approvedCurated) {
    for (const step of recipe.steps) {
      const key = step.instruction.en.trim();
      const owners = instructionOwners.get(key) || [];
      owners.push(`${recipe.id}:step-${step.order}`);
      instructionOwners.set(key, owners);
      requireText(recipe, typeof step.actionId === "string" && step.actionId.length > 0, `step ${step.order} missing actionId`);
      requireText(recipe, Array.isArray(step.prepares), `step ${step.order} missing prepares[]`);
      requireText(recipe, Array.isArray(step.uses), `step ${step.order} missing uses[]`);
      requireText(recipe, Array.isArray(step.produces), `step ${step.order} missing produces[]`);
      requireText(recipe, Array.isArray(step.consumes), `step ${step.order} missing consumes[]`);
      requireText(
        recipe,
        ["zh", "en", "id"].every(
          (language) =>
            typeof step.title?.[language] === "string" &&
            step.title[language].trim() &&
            typeof step.instruction?.[language] === "string" &&
            step.instruction[language].trim() &&
            typeof step.targetState?.[language] === "string" &&
            step.targetState[language].trim(),
        ),
        `step ${step.order} is missing approved localized content`,
      );
    }
    for (const phrase of bannedGenericPhrases) {
      requireText(recipe, !en.toLowerCase().includes(phrase), `contains banned generic phrase "${phrase}"`);
    }
    continue;
  }

  const usedIds = new Set();
  const producedAt = new Map();
  const consumedProducts = new Set();
  for (const step of recipe.steps) {
    const key = step.instruction.en.trim();
    const owners = instructionOwners.get(key) || [];
    owners.push(`${recipe.id}:step-${step.order}`);
    instructionOwners.set(key, owners);
    requireText(recipe, typeof step.actionId === "string" && step.actionId.length > 0, `step ${step.order} missing actionId`);
    requireText(recipe, Array.isArray(step.prepares), `step ${step.order} missing prepares[]`);
    requireText(recipe, Array.isArray(step.uses), `step ${step.order} missing uses[]`);
    requireText(recipe, Array.isArray(step.produces), `step ${step.order} missing produces[]`);
    requireText(recipe, Array.isArray(step.consumes), `step ${step.order} missing consumes[]`);
    const stepEnglish = step.instruction.en.toLowerCase();
    for (const id of step.prepares || []) {
      if (!ids.has(id)) errors.push(`${recipe.id} ${recipe.title.en}: step ${step.order} prepares unlisted ingredient ${id}`);
      const item = recipe.ingredients.find((ingredient) => ingredient.id === id);
      requireText(
        recipe,
        item && mentionsIngredient(stepEnglish, item.name.en),
        `step ${step.order} prepares ${id} without naming ${item?.name.en || id} directly`,
      );
    }
    for (const id of step.uses || []) {
      if (!ids.has(id)) errors.push(`${recipe.id} ${recipe.title.en}: step ${step.order} uses unlisted ingredient ${id}`);
      const item = recipe.ingredients.find((ingredient) => ingredient.id === id);
      requireText(
        recipe,
        item && mentionsIngredient(stepEnglish, item.name.en),
        `step ${step.order} uses ${id} without naming ${item?.name.en || id} directly`,
      );
      usedIds.add(id);
    }
    requireText(
      recipe,
      !(step.prepares || []).some((id) => (step.uses || []).includes(id)),
      `step ${step.order} assigns the same ingredient to both prepares[] and uses[]`,
    );
    if (/^(?:prepare|cut|soak|rinse|measure|preheat|set-up)/.test(step.actionId)) {
      requireText(recipe, step.uses.length === 0, `step ${step.order} is preparation-only but declares culinary uses[]`);
    }
    for (const product of step.produces || []) {
      requireText(recipe, typeof product === "string" && product.length > 0, `step ${step.order} has invalid produced component`);
      requireText(recipe, !producedAt.has(product), `component ${product} is produced more than once`);
      producedAt.set(product, step.order);
    }
    for (const product of step.consumes || []) {
      requireText(recipe, producedAt.has(product), `step ${step.order} consumes component ${product} before it is produced`);
      if (producedAt.has(product)) requireText(recipe, producedAt.get(product) < step.order, `step ${step.order} does not consume ${product} after production`);
      consumedProducts.add(product);
    }
  }

  for (const [product, order] of producedAt) {
    requireText(recipe, consumedProducts.has(product), `step ${order} produces component ${product} that is never consumed`);
  }

  for (const ingredient of recipe.ingredients.filter((item) => !item.optional)) {
    requireText(recipe, usedIds.has(ingredient.id), `ingredient ${ingredient.id} is not assigned to any structured step uses[]`);
    requireText(
      recipe,
      en.toLowerCase().includes(ingredient.name.en.toLowerCase()),
      `ingredient ${ingredient.id} (${ingredient.name.en}) is never named directly in the English steps`,
    );
  }

  for (const phrase of bannedGenericPhrases) {
    requireText(recipe, !en.toLowerCase().includes(phrase), `contains banned generic phrase "${phrase}"`);
  }

  for (const [id, name] of phantomPantry) {
    if (!ids.has(id)) {
      requireText(recipe, !new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(en), `mentions unlisted pantry ingredient ${id}`);
    }
  }

  const signatureRule = signatureRules.get(recipe.title.en);
  if (signatureRule) {
    requireText(recipe, recipe.family === signatureRule.family, `expected family ${signatureRule.family}`);
    for (const id of signatureRule.ingredients) requireText(recipe, ids.has(id), `missing signature ingredient ${id}`);
    const actionIds = new Set(recipe.steps.map((step) => step.actionId));
    for (const actionId of signatureRule.actionIds) requireText(recipe, actionIds.has(actionId), `missing signature technique ${actionId}`);
  }

  if (ids.has("egg")) {
    requireText(
      recipe,
      !containsPositiveAction(recipe, ["egg", "eggs"], [/\bwash(?:ed|ing)?\b/i, /\brinse[sd]?\b/i, /\bpat\b.*\bdry\b/i, /\bdice[sd]?\b/i, /\bcut\b.*\bbite-size\b/i, /\bmarinat(?:e|ed|ing)\b/i]),
      "egg is positively instructed to be washed, dried, diced, cut bite-size or marinated",
    );
  }

  for (const ingredient of recipe.ingredients.filter((item) => forbiddenPrepIds.has(item.id))) {
    requireText(
      recipe,
      !containsPositiveAction(
        recipe,
        [ingredient.name.en],
        [/\bwash(?:ed|ing)?\b/i, /\brinse[sd]?\b/i, /\bpat\b.*\bdry\b/i, /\bcut\b/i, /\bdice[sd]?\b/i],
      ),
      `${ingredient.name.en} is positively instructed to be washed, dried or cut`,
    );
  }

  if ([...ids].some((key) => mince.has(key))) {
    requireText(recipe, /\b71°C\b/.test(en), "mince recipe must state a 71°C centre");
  }
  if (mince.has(recipe.ingredients[0]?.id)) {
    requireText(
      recipe,
      !containsPositiveAction(recipe, ["mince", "minced pork", "minced beef", "plant mince"], [/\bwash(?:ed|ing)?\b/i, /\bpat\b.*\bdry\b/i, /\bdice[sd]?\b/i, /\bcut\b.*\bbite-size\b/i]),
      "main mince is positively instructed to be washed, dried or diced",
    );
    if (/patty|patties|meatball|meatballs|burger/i.test(recipe.title.en)) {
      requireText(recipe, /\bshape\b|\bshaped\b|\bpatt(?:y|ies)\b|\bmeatballs?\b/i.test(en), "mince patty/meatball dish must explicitly shape equal-size pieces");
    } else if (recipe.family !== "dumplingSoup") {
      requireText(recipe, /\bbreak\b.*\b(?:up|pieces)\b|\bloosen\b|\buraikan\b|\b炒散\b/i.test(all), "unshaped mince dish must explicitly loosen or break up the mince");
    }
  }

  if ([...ids].some((key) => poultry.has(key))) {
    requireText(recipe, /\b75°C\b/.test(en), "chicken or duck recipe must state a 75°C centre");
  }

  if ([...ids].some((key) => fish.has(key))) {
    requireText(recipe, /\bopaque\b/i.test(en) && /\bflake\b/i.test(en), "fish recipe must state opaque and flaky doneness");
  }

  if (recipe.ingredients[0]?.id === "wholeFish") {
    requireText(recipe, /\bkeep\b.*\bwhole\b|\bwhole fish\b/i.test(en), "whole fish must explicitly remain whole");
    requireText(recipe, !/\bwhole fish\b[^.]{0,100}\b(?:dice|bite-size pieces|small pieces)\b/i.test(en), "whole fish is cut into small pieces");
  }

  if (ids.has("clam")) {
    requireText(recipe, /\bopen\b/i.test(en) && /\bdiscard\b/i.test(en), "clam recipe must tell the cook to discard unopened clams");
  } else {
    requireText(recipe, !/\bclams?\b[^.]{0,90}\b(?:must|should)\b[^.]{0,50}\bopen\b/i.test(en), "non-clam recipe contains a clam-opening safety rule");
  }

  if (isRiceBake) {
    const cookRice = recipe.steps.findIndex((step) => /cook the rice|rice is already cooked/i.test(`${step.title.en} ${step.instruction.en}`));
    const assemble = recipe.steps.findIndex((step) => /assemble the rice bake/i.test(step.title.en));
    requireText(recipe, ids.has("rice"), "rice bake must include rice");
    requireText(recipe, cookRice !== -1 && assemble !== -1 && cookRice < assemble, "rice must be fully cooked before the rice bake is assembled");
    requireText(recipe, /heatproof ceramic/i.test(en), "rice bake must specify a heatproof ceramic baking dish");
    requireText(recipe, recipe.family === "bakedRice", "rice bake must use bakedRice family");
    requireText(recipe, ids.has("cheese"), "rice bake must include its cheese topping");
    const riceStep = recipe.steps.find((step) => step.uses?.includes("rice"));
    const sauceStep = recipe.steps.find((step) => step.uses?.some((id) => sauceKeysForValidation.has(id)));
    const dedicatedSauceStep = recipe.steps.find((step) => step.actionId === "make-the-bake-sauce");
    const partialStep = recipe.steps.find((step) => step.actionId === "partially-cook-the-main-ingredient");
    const assemblyStep = recipe.steps.find((step) => step.actionId === "assemble-the-rice-bake-and-bake-through");
    const finalStep = recipe.steps.find((step) => step.actionId === "check-final-doneness-and-finish");
    const mainId = recipe.ingredients[0]?.id;
    requireText(recipe, Boolean(riceStep), "rice bake has no structured rice use");
    requireText(recipe, Boolean(sauceStep), "rice bake has no structured sauce stage");
    requireText(recipe, Boolean(dedicatedSauceStep), "rice bake must have a dedicated make-the-bake-sauce action");
    requireText(recipe, /coats a spoon/i.test(dedicatedSauceStep?.instruction.en || ""), "rice-bake sauce must reduce to a visible spoon-coating target");
    requireText(recipe, dedicatedSauceStep?.produces?.includes("bake-sauce"), "rice-bake sauce stage must produce bake-sauce");
    requireText(recipe, Boolean(assemblyStep), "rice bake must have a dedicated assembly and final-bake action");
    requireText(recipe, /12–15 minutes/i.test(assemblyStep?.instruction.en || ""), "rice bake must use the tested 12–15 minute final bake window");
    const riceComponent = recipe.title.en === "Hong Kong baked pork chop rice" ? "egg-fried-rice" : "cooked-rice";
    requireText(recipe, assemblyStep?.consumes?.includes(riceComponent), `rice-bake assembly must consume ${riceComponent}`);
    requireText(recipe, assemblyStep?.consumes?.includes(mainId === "rice" ? "reduced-bake-sauce" : "bake-sauce"), "rice-bake assembly must consume its prepared sauce");
    requireText(recipe, Boolean(finalStep) && finalStep.consumes?.includes("finished-rice-bake"), "rice bake must check the finished-rice-bake after baking");
    if (mainId !== "rice") {
      requireText(recipe, Boolean(partialStep), "rice bake with a separate main ingredient must have a partial-cook stage");
      requireText(recipe, partialStep?.uses?.includes(mainId), "rice-bake partial-cook stage must actually use the main ingredient");
      const requiresFinalProteinCook = poultry.has(mainId) || mince.has(mainId) || fish.has(mainId) || /pork|beef|lamb|ribs/.test(mainId);
      if (requiresFinalProteinCook) {
        requireText(recipe, /underdone|still underdone|centre stays translucent/i.test(partialStep?.instruction.en || ""), "rice-bake main ingredient must remain underdone before the final bake");
        requireText(recipe, !/\breach(?:es|ed)?\s+(?:71|75)°C|\bcooked through\b/i.test(partialStep?.instruction.en || ""), "rice-bake main ingredient is taken to final doneness before baking");
      } else {
        requireText(recipe, /will bake again|do not overcook/i.test(partialStep?.instruction.en || ""), "rice-bake vegetable or tofu main must avoid overcooking before baking");
      }
      requireText(recipe, assemblyStep?.consumes?.includes("partially-cooked-main"), "rice-bake assembly must consume partially-cooked-main");
      requireText(recipe, finalStep?.uses?.includes(mainId), "rice-bake final doneness step must check the main ingredient");
    }
  }

  if (/carbonara/i.test(recipe.title.en)) {
    requireText(recipe, /turn off the heat/i.test(en) && /do not return to high heat/i.test(en), "carbonara must emulsify egg off heat");
  }

  if (recipe.ingredients[0]?.id === "egg" && recipe.tags.some((tag) => tag.en === "Curry")) {
    requireText(recipe, /simmer for 9 minutes/i.test(en) && /final 8 minutes/i.test(en), "egg curry must boil eggs first and add them only near the end");
  }

  if (recipe.appliance) {
    const appliance = recipe.appliance;
    const mode = appliance.mode.en;
    requireText(recipe, appliance.model === "MX2-TT20SC", "unsupported appliance model");
    if (/Pure Steam/i.test(mode)) {
      requireText(recipe, appliance.temperatureC >= 50 && appliance.temperatureC <= 100, "Pure Steam must be 50–100°C");
      requireText(recipe, appliance.waterTank === true && appliance.preheat === false, "Pure Steam requires water and no preheat");
      requireText(recipe, /filtered or distilled water below 40°C/i.test(en), "Pure Steam step must specify suitable water below 40°C");
    } else if (/Steam Bake/i.test(mode)) {
      requireText(recipe, appliance.temperatureC >= 100 && appliance.temperatureC <= 230, "Steam Bake must be 100–230°C");
      requireText(recipe, appliance.waterTank === true, "Steam Bake requires the water tank");
    } else if (/Bake/i.test(mode)) {
      requireText(recipe, appliance.temperatureC >= 70 && appliance.temperatureC <= 230, "Bake must be 70–230°C");
    } else {
      errors.push(`${recipe.id} ${recipe.title.en}: unsupported MX2 mode ${mode}`);
    }
    requireText(recipe, /lower level/i.test(en), "MX2 recipe must state the lower level");
    requireText(recipe, appliance.preheat ? /after the beep/i.test(en) : /no preheating/i.test(en), "MX2 preheat instruction does not match appliance metadata");
  }
}

for (const [instruction, owners] of instructionOwners) {
  if (owners.length > 1) {
    errors.push(`duplicate English instruction shared by ${owners.length} steps: ${owners.slice(0, 6).join(", ")} :: ${instruction.slice(0, 120)}`);
  }
}

requireText(
  { id: "catalogue", title: { en: "all recipes" } },
  recipes.length === 300,
  `expected exactly 300 recipes, got ${recipes.length}`,
);

if (errors.length) {
  console.error(`Recipe content validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const counts = {
  recipes: recipes.length,
  steps: recipes.reduce((sum, recipe) => sum + recipe.steps.length, 0),
  riceBakes: recipes.filter((recipe) => recipe.tags.some((tag) => tag.en === "Rice bake")).length,
  mx2: recipes.filter((recipe) => recipe.appliance).length,
  poultry: recipes.filter((recipe) => recipe.ingredients.some((item) => poultry.has(item.id))).length,
  mince: recipes.filter((recipe) => recipe.ingredients.some((item) => mince.has(item.id))).length,
  fish: recipes.filter((recipe) => recipe.ingredients.some((item) => fish.has(item.id))).length,
  clam: recipes.filter((recipe) => recipe.ingredients.some((item) => item.id === "clam")).length,
};

console.log(`Recipe content validation passed: ${Object.entries(counts).map(([key, value]) => `${key}=${value}`).join(", ")}`);
