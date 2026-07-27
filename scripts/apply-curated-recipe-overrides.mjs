#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_RECIPE_PATH = resolve(PROJECT_ROOT, "src/data/recipes.json");
const DEFAULT_OVERRIDE_PATHS = [
  resolve(PROJECT_ROOT, "scripts/recipe-overrides/recipes-001-100.json"),
  resolve(PROJECT_ROOT, "scripts/recipe-overrides/recipes-101-200.json"),
  resolve(PROJECT_ROOT, "scripts/recipe-overrides/recipes-201-300.json"),
];
const LANGUAGES = ["zh", "en", "id"];
const NON_ENGLISH_LANGUAGES = ["zh", "id"];
const CURATION_SCHEMA_VERSION = 1;

const UNIT_LABELS = {
  g: { zh: "克", en: "g", id: "g" },
  ml: { zh: "毫升", en: "ml", id: "ml" },
  tbsp: { zh: "湯匙", en: "tbsp", id: "sdm" },
  tsp: { zh: "茶匙", en: "tsp", id: "sdt" },
  piece: { zh: "件", en: "piece", id: "buah" },
  clove: { zh: "瓣", en: "clove", id: "siung" },
  cup: { zh: "杯", en: "cup", id: "cangkir" },
  stalk: { zh: "棵", en: "stalk", id: "batang" },
  slice: { zh: "片", en: "slice", id: "iris" },
};

const EQUIPMENT = {
  pan: {
    name: { zh: "煎 Pan／平底鑊", en: "frying pan", id: "wajan datar" },
    type: "pan",
  },
  wok: {
    name: { zh: "中式鑊", en: "Chinese wok", id: "wajan Tiongkok" },
    type: "wok",
  },
  mx2: {
    name: {
      zh: "Toshiba MX2-TT20SC 3合1微波蒸焗爐",
      en: "Toshiba MX2-TT20SC 3-in-1 microwave steam oven",
      id: "Oven microwave-uap-panggang 3-in-1 Toshiba MX2-TT20SC",
    },
    type: "mx2",
  },
  tray: {
    name: {
      zh: "MX2 原裝烤盤",
      en: "MX2 supplied baking tray",
      id: "loyang bawaan MX2",
    },
    type: "accessory",
  },
  steamRack: {
    name: {
      zh: "MX2 蒸烤架",
      en: "MX2 steaming rack",
      id: "rak kukus-panggang MX2",
    },
    type: "accessory",
  },
  ceramicDish: {
    name: {
      zh: "耐熱陶瓷器皿",
      en: "heatproof ceramic dish",
      id: "wadah keramik tahan panas",
    },
    type: "accessory",
  },
};

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const clone = (value) => structuredClone(value);

const localizedTodo = (language, label) =>
  `[TRANSLATION TODO:${language}] ${label}`;

const entryId = (entry) => (typeof entry === "string" ? entry : entry?.id);

const localizedFromOverride = ({
  existing,
  english,
  translated = {},
  label,
  pendingTranslations,
}) => {
  const result = { en: english };
  for (const language of NON_ENGLISH_LANGUAGES) {
    const approved = translated[language]?.trim();
    const preserved = existing?.[language]?.trim();
    result[language] =
      approved || preserved || localizedTodo(language, english);
    if (!approved) pendingTranslations.push(`${label}.${language}`);
  }
  return { zh: result.zh, en: result.en, id: result.id };
};

const appliancePrompt = (appliance) => {
  if (!appliance) return { zh: "", en: "", id: "" };
  return {
    zh: `如本步驟使用焗爐，必須準確顯示 Toshiba ${appliance.model}、${appliance.mode.zh}、${appliance.temperatureC}°C、${appliance.rack.zh}、${appliance.vessel.zh}。`,
    en: `If this step uses the oven, accurately show Toshiba ${appliance.model}, ${appliance.mode.en}, ${appliance.temperatureC}°C, ${appliance.rack.en}, and ${appliance.vessel.en}.`,
    id: `Jika langkah ini memakai oven, tampilkan dengan tepat Toshiba ${appliance.model}, ${appliance.mode.id}, ${appliance.temperatureC}°C, ${appliance.rack.id}, dan ${appliance.vessel.id}.`,
  };
};

const makeHeroImageMetadata = (recipe) => {
  const directory = `/assets/generated/recipes/${recipe.id}-${recipe.slug}`;
  const mainIngredient =
    recipe.ingredients.find((ingredient) => !ingredient.optional) ??
    recipe.ingredients[0];
  const mainName = mainIngredient?.name ?? {
    zh: recipe.title.zh,
    en: recipe.title.en,
    id: recipe.title.id,
  };

  return {
    imageUrl: `${directory}/hero.webp`,
    imagePrompt: {
      zh: `香港家庭餐桌上的${recipe.title.zh}，三人份，清楚呈現${mainName.zh}及此菜獨有的汁醬、切法與熟度，家常擺盤，自然窗光，真實相機食物攝影，無文字、無水印、無人物。`,
      en: `${recipe.title.en} on a Hong Kong family dining table, three servings, clearly showing ${mainName.en} with this dish's distinctive sauce, cuts, and final doneness. Homestyle plating, natural window light, photorealistic food photography captured like a real camera. No cartoon, illustration, painting, 3D render, CGI, plastic food, or stylised graphic. No text, watermark, or people.`,
      id: `${recipe.title.id} di meja makan keluarga Hong Kong, tiga porsi, dengan ${mainName.id}, saus, potongan, dan tingkat kematangan khas hidangan ini. Penyajian rumahan, cahaya jendela alami, foto makanan realistis, tanpa teks, tanda air, atau orang.`,
    },
    imageSeed: `${recipe.slug}-hero`,
    visual: {
      recipeSlug: recipe.slug,
      subject: clone(recipe.title),
      cuisine: clone(recipe.cuisine),
      heroShot: "three-quarter-table",
      plating: "Hong Kong family-style, three servings",
      noText: true,
    },
  };
};

const makeStepImageMetadata = ({
  recipe,
  step,
  stepNumber,
  mainName,
  appliance,
}) => {
  const directory = `/assets/generated/recipes/${recipe.id}-${recipe.slug}`;
  const token = String(stepNumber).padStart(2, "0");
  const ovenPrompt = appliancePrompt(appliance);

  return {
    imageUrl: `${directory}/step-${token}.webp`,
    imagePrompt: {
      zh: `「${recipe.title.zh}」第 ${stepNumber} 步「${step.title.zh}」的獨立教學圖片。主要食材：${mainName.zh}。嚴格按本步驟完整描述顯示當刻材料形態、份量、操作、器具、火力及熟度：${step.instruction.zh} ${ovenPrompt.zh}只顯示本步，不可提前顯示成品；香港家庭廚房寫實相片，無文字、無水印、無人物臉孔。`,
      en: `Independent instructional image for ${recipe.title.en}, step ${stepNumber}, "${step.title.en}". Main ingredient: ${mainName.en}. Follow this complete step instruction exactly, showing the ingredient form, quantity, action, equipment, heat, and doneness at this moment: ${step.instruction.en} ${ovenPrompt.en} Show this step only and do not reveal the finished dish early. Photorealistic Hong Kong home-kitchen food photography captured like a real camera, with natural ingredient texture and believable light. No cartoon, illustration, painting, 3D render, CGI, plastic food, or stylised graphic. No text, watermark, or visible faces.`,
      id: `Gambar instruksi tersendiri untuk ${recipe.title.id}, langkah ${stepNumber}, "${step.title.id}". Bahan utama: ${mainName.id}. Ikuti instruksi lengkap langkah ini dengan tepat dan tampilkan bentuk, jumlah, tindakan, alat, panas, serta kematangan bahan saat ini: ${step.instruction.id} ${ovenPrompt.id} Tampilkan hanya langkah ini dan jangan tampilkan hidangan akhir terlalu dini. Foto realistis di dapur rumah Hong Kong, tanpa teks, tanda air, atau wajah.`,
    },
    imageSeed: `${recipe.slug}-step-${token}`,
    visual: {
      recipeSlug: recipe.slug,
      stepNumber,
      action: clone(step.title),
      ingredientRefs: [...step.ingredientRefs],
      shot: "overhead-close",
      noText: true,
    },
  };
};

const applyIngredientChanges = (recipe, changes, pendingTranslations) => {
  const removed = new Set((changes?.remove ?? []).map(entryId));
  const additions = changes?.add ?? [];
  const amountOverrides = changes?.amounts ?? {};
  const ingredients = recipe.ingredients
    .filter((ingredient) => !removed.has(ingredient.id))
    .map(clone);
  const byId = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

  for (const addition of additions) {
    const id = entryId(addition);
    if (!id) throw new Error(`${recipe.id}: ingredientChanges.add entry has no id`);
    const existing = byId.get(id);
    const englishName =
      (typeof addition === "object" &&
        (addition.nameEn ?? addition.name?.en)) ||
      existing?.name?.en;
    if (!englishName) {
      throw new Error(`${recipe.id}: added ingredient ${id} has no English name`);
    }
    const unitKey =
      (typeof addition === "object" && addition.unit) ??
      existing?.unit?.en;
    if (!UNIT_LABELS[unitKey]) {
      throw new Error(`${recipe.id}: unsupported unit ${unitKey} for ${id}`);
    }

    if (existing) {
      existing.name = localizedFromOverride({
        existing: existing.name,
        english: englishName,
        translated: {
          zh: addition.nameZh ?? addition.name?.zh,
          id: addition.nameId ?? addition.name?.id,
        },
        label: `ingredients.${id}.name`,
        pendingTranslations,
      });
      if (typeof addition === "object" && addition.amount != null) {
        existing.amount = addition.amount;
      }
      existing.unit = clone(UNIT_LABELS[unitKey]);
    } else {
      const ingredient = {
        id,
        name: localizedFromOverride({
          existing: null,
          english: englishName,
          translated: {
            zh: addition.nameZh ?? addition.name?.zh,
            id: addition.nameId ?? addition.name?.id,
          },
          label: `ingredients.${id}.name`,
          pendingTranslations,
        }),
        amount: addition.amount,
        unit: clone(UNIT_LABELS[unitKey]),
        optional: addition.optional ?? false,
      };
      ingredients.push(ingredient);
      byId.set(id, ingredient);
    }
  }

  for (const [id, amountOverride] of Object.entries(amountOverrides)) {
    const ingredient = byId.get(id);
    if (!ingredient) {
      throw new Error(`${recipe.id}: amount override references missing ingredient ${id}`);
    }
    if (amountOverride.amount == null) {
      throw new Error(`${recipe.id}: amount override for ${id} has no amount`);
    }
    const unitKey = amountOverride.unit ?? ingredient.unit?.en;
    if (!UNIT_LABELS[unitKey]) {
      throw new Error(`${recipe.id}: unsupported unit ${unitKey} for ${id}`);
    }
    ingredient.amount = amountOverride.amount;
    ingredient.unit = clone(UNIT_LABELS[unitKey]);
  }

  return ingredients;
};

const applyEquipment = (recipe, equipmentTypes) => {
  if (equipmentTypes === undefined) return clone(recipe.equipment);
  return equipmentTypes.map((equipmentType) => {
    if (!EQUIPMENT[equipmentType]) {
      throw new Error(`${recipe.id}: unsupported equipment type ${equipmentType}`);
    }
    return clone(EQUIPMENT[equipmentType]);
  });
};

const syncMx2Tag = (recipe, appliance) => {
  const tags = recipe.tags
    .filter((tag) => tag?.en !== "MX2-TT20SC")
    .map(clone);
  if (appliance) {
    tags.push({ zh: "MX2-TT20SC", en: "MX2-TT20SC", id: "MX2-TT20SC" });
  }
  return tags;
};

const applySteps = (recipe, overrideSteps, appliance, pendingTranslations) => {
  const oldSteps = recipe.steps;
  const mainName =
    recipe.ingredients.find((ingredient) => !ingredient.optional)?.name ??
    recipe.ingredients[0]?.name ??
    recipe.title;

  return overrideSteps.map((overrideStep, index) => {
    const oldStep = oldSteps[index];
    const stepNumber = index + 1;
    const title = localizedFromOverride({
      existing: oldStep?.title,
      english: overrideStep.titleEn,
      translated: {
        zh: overrideStep.titleZh,
        id: overrideStep.titleId,
      },
      label: `steps.${stepNumber}.title`,
      pendingTranslations,
    });
    const instruction = localizedFromOverride({
      existing: oldStep?.instruction,
      english: overrideStep.instructionEn,
      translated: {
        zh: overrideStep.instructionZh,
        id: overrideStep.instructionId,
      },
      label: `steps.${stepNumber}.instruction`,
      pendingTranslations,
    });
    const targetState = localizedFromOverride({
      existing: oldStep?.targetState ?? oldStep?.title,
      english: overrideStep.targetStateEn,
      translated: {
        zh: overrideStep.targetStateZh,
        id: overrideStep.targetStateId,
      },
      label: `steps.${stepNumber}.targetState`,
      pendingTranslations,
    });
    const ingredientRefs = [
      ...new Set([...(overrideStep.prepares ?? []), ...(overrideStep.uses ?? [])]),
    ];
    const step = {
      order: stepNumber,
      title,
      instruction,
      actionId: overrideStep.actionId,
      prepares: [...overrideStep.prepares],
      uses: [...overrideStep.uses],
      produces: [...overrideStep.produces],
      consumes: [...overrideStep.consumes],
      targetState,
      ingredientRefs,
    };
    for (const [language, suffix] of [["zh", "Zh"], ["id", "Id"]]) {
      if (
        !overrideStep[`title${suffix}`]?.trim() ||
        !overrideStep[`instruction${suffix}`]?.trim()
      ) {
        pendingTranslations.push(`steps.${stepNumber}.imagePrompt.${language}`);
      }
    }
    return {
      ...step,
      ...makeStepImageMetadata({
        recipe,
        step,
        stepNumber,
        mainName,
        appliance,
      }),
    };
  });
};

const assertLocalizedAppliance = (recipeId, appliance) => {
  if (!appliance) return;
  if (appliance.model !== "MX2-TT20SC") {
    throw new Error(`${recipeId}: unsupported appliance ${appliance.model}`);
  }
  for (const field of ["mode", "rack", "vessel"]) {
    for (const language of LANGUAGES) {
      if (!appliance[field]?.[language]) {
        throw new Error(`${recipeId}: appliance.${field}.${language} is required`);
      }
    }
  }
  if (
    !Number.isFinite(appliance.temperatureC) ||
    typeof appliance.preheat !== "boolean" ||
    typeof appliance.waterTank !== "boolean"
  ) {
    throw new Error(`${recipeId}: appliance override is incomplete`);
  }
};

const applyRecipeOverride = (sourceRecipe, override, provenance) => {
  const recipe = clone(sourceRecipe);
  const pendingTranslations = [];

  recipe.family = override.family;
  recipe.signature = clone(override.signature);
  recipe.ingredients = applyIngredientChanges(
    recipe,
    override.ingredientChanges,
    pendingTranslations,
  );
  recipe.equipment = applyEquipment(recipe, override.equipmentTypes);

  const appliance =
    override.applianceOverride === undefined
      ? clone(recipe.appliance)
      : clone(override.applianceOverride);
  assertLocalizedAppliance(recipe.id, appliance);
  if (appliance) recipe.appliance = appliance;
  else delete recipe.appliance;
  recipe.tags = syncMx2Tag(recipe, appliance);

  recipe.steps = applySteps(
    recipe,
    override.steps,
    appliance,
    pendingTranslations,
  );
  Object.assign(recipe, makeHeroImageMetadata(recipe));
  const mainIngredient =
    recipe.ingredients.find((ingredient) => !ingredient.optional) ??
    recipe.ingredients[0];
  for (const language of NON_ENGLISH_LANGUAGES) {
    if (
      pendingTranslations.includes(
        `ingredients.${mainIngredient?.id}.name.${language}`,
      )
    ) {
      pendingTranslations.push(`imagePrompt.${language}`);
    }
  }
  recipe.searchTokens = [
    ...new Set([
      ...recipe.searchTokens,
      ...recipe.ingredients.flatMap((ingredient) =>
        Object.values(ingredient.name),
      ),
      ...recipe.steps.flatMap((step) => [
        step.title.en,
        step.instruction.en,
        step.targetState.en,
      ]),
    ].map((value) => String(value).toLowerCase())),
  ];
  const uniquePendingTranslations = [...new Set(pendingTranslations)].sort();
  recipe.curation = {
    schemaVersion: CURATION_SCHEMA_VERSION,
    sourceRecipeSHA256: provenance.sourceRecipeSHA256,
    overrideFile: provenance.overrideFile,
    overrideSHA256: provenance.overrideSHA256,
    translationStatus:
      uniquePendingTranslations.length === 0 ? "complete" : "pending",
    pendingTranslations: uniquePendingTranslations,
  };
  return recipe;
};

export const loadOverrideBatches = async (overridePaths = DEFAULT_OVERRIDE_PATHS) =>
  Promise.all(
    overridePaths.map(async (overridePath) => {
      const raw = await readFile(overridePath);
      return {
        path: overridePath,
        file: basename(overridePath),
        raw,
        sha256: sha256(raw),
        data: JSON.parse(raw),
      };
    }),
  );

export const applyCuratedOverrides = ({
  recipes,
  sourceRecipeSHA256,
  batches,
}) => {
  if (!Array.isArray(recipes)) {
    throw new Error("Recipe source must be a JSON array");
  }
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const seen = new Set();
  let appliedCount = 0;

  for (const batch of batches) {
    if (batch.data.schemaVersion !== CURATION_SCHEMA_VERSION) {
      throw new Error(`${batch.file}: unsupported schemaVersion`);
    }
    for (const [recipeId, override] of Object.entries(batch.data.recipes ?? {})) {
      if (seen.has(recipeId)) {
        throw new Error(`${recipeId}: appears in more than one override batch`);
      }
      seen.add(recipeId);
      const sourceRecipe = recipeById.get(recipeId);
      if (!sourceRecipe) throw new Error(`${recipeId}: source recipe does not exist`);

      const alreadyApplied =
        sourceRecipe.curation?.sourceRecipeSHA256 ===
          batch.data.sourceRecipeSHA256 &&
        sourceRecipe.curation?.overrideSHA256 === batch.sha256;
      if (alreadyApplied) continue;
      if (sourceRecipe.curation) {
        throw new Error(
          `${recipeId}: a different curated override is already applied; regenerate the base catalogue before applying the new batch`,
        );
      }
      if (batch.data.sourceRecipeSHA256 !== sourceRecipeSHA256) {
        throw new Error(
          `${batch.file}: source hash ${batch.data.sourceRecipeSHA256} does not match ${sourceRecipeSHA256}`,
        );
      }
      recipeById.set(
        recipeId,
        applyRecipeOverride(sourceRecipe, override, {
          sourceRecipeSHA256,
          overrideFile: batch.file,
          overrideSHA256: batch.sha256,
        }),
      );
      appliedCount += 1;
    }
  }

  return {
    recipes: recipes.map((recipe) => recipeById.get(recipe.id)),
    appliedCount,
    coveredCount: seen.size,
  };
};

const parseArguments = (arguments_) => {
  const options = {
    input: DEFAULT_RECIPE_PATH,
    output: DEFAULT_RECIPE_PATH,
    overridePaths: DEFAULT_OVERRIDE_PATHS,
    check: false,
  };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--input") options.input = resolve(arguments_[++index]);
    else if (argument === "--output") options.output = resolve(arguments_[++index]);
    else if (argument === "--overrides") {
      options.overridePaths = arguments_[++index]
        .split(",")
        .map((value) => resolve(value));
    } else if (argument === "--check") options.check = true;
    else {
      throw new Error(
        `Unknown argument ${argument}. Usage: apply-curated-recipe-overrides.mjs [--input path] [--output path] [--overrides a.json,b.json] [--check]`,
      );
    }
  }
  return options;
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const sourceBuffer = await readFile(options.input);
  const recipes = JSON.parse(sourceBuffer);
  const batches = await loadOverrideBatches(options.overridePaths);
  const result = applyCuratedOverrides({
    recipes,
    sourceRecipeSHA256: sha256(sourceBuffer),
    batches,
  });
  const output = `${JSON.stringify(result.recipes, null, 2)}\n`;

  if (options.check) {
    if (!sourceBuffer.equals(Buffer.from(output))) {
      throw new Error(
        `${options.input} is not up to date; run npm run recipes:curate`,
      );
    }
    console.log(
      `Curated recipe integration is current (${result.coveredCount} override records).`,
    );
    return;
  }

  await writeFile(options.output, output, "utf8");
  console.log(
    `Applied ${result.appliedCount} curated overrides (${result.coveredCount} covered recipes) to ${options.output}.`,
  );
  console.log(
    "Translation status is pending; production validation will remain blocked until every marked zh/id field is translated and reviewed.",
  );
};

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "")) {
  main().catch((error) => {
    console.error(`Curated override application failed: ${error.message}`);
    process.exit(1);
  });
}
