import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const argument = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const recipeFile = resolve(
  projectRoot,
  argument("recipes") || "src/data/recipes.json",
);
const outputFile = resolve(
  projectRoot,
  argument("output") || "public/assets/generated/manifest.json",
);
const visualQaConstraintsPath = resolve(
  projectRoot,
  argument("visual-qa-constraints") || "scripts/image-visual-constraints.json",
);
const generationPromptOverridesPath = resolve(
  projectRoot,
  argument("generation-prompt-overrides") ||
    "scripts/image-generation-prompt-overrides.json",
);

const LANGUAGES = ["zh", "en", "id"];
const EXPECTED_RECIPES = 300;
const DISALLOWED_SHARED_IMAGE = /(?:default|placeholder|home-table-hero)/i;
const PROVENANCE_SCHEMA_VERSION = 1;
const STEP_COMPOSITION_CONSTRAINTS = {
  "recipe-001:step-01":
    "Show the completed mise en place only: all cut pork, onion, bell pepper, and drained pineapple must be in four separate bowls. The cutting board must be cleared, with no food or labelled packaging left on it.",
  "recipe-002:step-01":
    "Show exactly six fish portions together in one bowl, visibly coated with the combined seasoning. Do not show soy sauce, salt, pepper, or any other seasoning in separate bowls or containers.",
  "recipe-002:step-02":
    "Show only the four components prepared in this step: shredded ginger, sliced spring onion, beaten egg, and cornstarch slurry. Do not show fish or any ingredient from an earlier or later step.",
  "recipe-002:step-03":
    "Show exactly six equal fish portions in the frying pan at the same lightly golden, nearly opaque stage. Do not show only a subset and do not show a fully cooked white interior. The recipe uses white pepper, so there must be no visible black pepper granules or black seasoning specks.",
  "recipe-002:step-05":
    "Choose the single moment immediately after all egg has been drizzled and the pouring bowl has been removed: fresh egg ribbons are just forming, the ladle is outside the pan, and nothing is being stirred yet. The heat has already been lowered, so the sauce surface must be calm with no vigorous boil or large active bubbles.",
  "recipe-002:step-06":
    "Show exactly six separate seared fish portions together in the egg-corn sauce, all opaque and garnished with spring onion. Do not merge the portions into one or two oversized fillets.",
};
let VISUAL_QA_CONSTRAINTS = {};
try {
  VISUAL_QA_CONSTRAINTS = JSON.parse(
    await readFile(visualQaConstraintsPath, "utf8"),
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
let GENERATION_PROMPT_OVERRIDES = {};
try {
  GENERATION_PROMPT_OVERRIDES = JSON.parse(
    await readFile(generationPromptOverridesPath, "utf8"),
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const visualQaConstraint = (assetId, equipment = []) =>
  VISUAL_QA_CONSTRAINTS[assetId]
    ? ` Previous visual QA blocked this asset because: ${VISUAL_QA_CONSTRAINTS[assetId]} Regenerate it with that issue explicitly corrected while preserving every other requirement.${equipment.length ? ` The only allowed cooking equipment for this recipe is: ${equipment.join(", ")}. Do not show a saucepan, stockpot, claypot, or any other cooking vessel unless it is explicitly in that list.` : ""}`
    : "";

const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");

const canonicalPrompt = (generationPrompt) =>
  [
    "production-recipe-image/v1",
    generationPrompt.en.trim(),
    generationPrompt.zh.trim(),
    generationPrompt.id.trim(),
  ].join("\n");

const requireLocalized = (value, label) => {
  if (!value || typeof value !== "object") {
    throw new Error(`${label} must be a localized object`);
  }

  for (const language of LANGUAGES) {
    if (typeof value[language] !== "string" || !value[language].trim()) {
      throw new Error(`${label}.${language} is required`);
    }
  }

  return Object.fromEntries(
    LANGUAGES.map((language) => [language, value[language].trim()]),
  );
};

const safeSegment = (value, label) => {
  const segment = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  if (!segment) {
    throw new Error(`${label} cannot produce an empty filename segment`);
  }

  return segment;
};

const stepNumberToken = (stepNumber) => String(stepNumber).padStart(2, "0");

const deriveMethod = (recipe) => {
  const method = recipe.tags?.[1];
  return requireLocalized(method, `${recipe.id}.method`);
};

const deriveMainIngredient = (recipe) => {
  const mainIngredient =
    recipe.ingredients?.find((ingredient) => !ingredient.optional) ??
    recipe.ingredients?.[0];

  if (!mainIngredient) {
    throw new Error(`${recipe.id} has no main ingredient`);
  }

  return requireLocalized(
    mainIngredient.name,
    `${recipe.id}.mainIngredient`,
  );
};

const deriveEquipment = (recipe) => {
  const localizedItems = (recipe.equipment ?? []).map((item, index) =>
    requireLocalized(
      item.name ?? item,
      `${recipe.id}.equipment[${index}]`,
    ),
  );
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      localizedItems.map((item) => item[language]),
    ]),
  );
};

const heroGenerationPrompt = (imagePrompt, common, assetId) => ({
  zh: `4:3 橫向構圖。${imagePrompt.zh}。菜式：${common.recipeTitle.zh}；菜系：${common.cuisine.zh}；主要食材：${common.mainIngredient.zh}；烹調方法：${common.method.zh}。成品必須與此菜的材料、汁醬、切法及烹調狀態一致。以真實相機拍攝的寫實食物照片呈現自然食材紋理、蒸氣、油光及家庭廚房光線；不可是卡通、插畫、繪畫、3D render、CGI 或塑膠模型。只顯示三人份成品，不要文字、水印、人物或無關菜式。`,
  en: `4:3 landscape composition. ${imagePrompt.en}. Dish: ${common.recipeTitle.en}; cuisine: ${common.cuisine.en}; main ingredient: ${common.mainIngredient.en}; cooking method: ${common.method.en}. The finished food must match this recipe's ingredients, sauce, cuts, and cooked state.${visualQaConstraint(assetId, common.equipment.en)} Make a photorealistic food photograph that looks captured with a real camera, with natural ingredient texture, steam, oil sheen, and home-kitchen light. No cartoon, illustration, painting, 3D render, CGI, clay, plastic food, or stylised graphic. Show only the finished three-serving dish, with no text, watermark, people, or unrelated food.`,
  id: `Komposisi lanskap 4:3. ${imagePrompt.id}. Hidangan: ${common.recipeTitle.id}; masakan: ${common.cuisine.id}; bahan utama: ${common.mainIngredient.id}; metode memasak: ${common.method.id}. Hasil akhir harus sesuai dengan bahan, saus, potongan, dan tingkat kematangan resep ini. Buat foto makanan fotorealistis seperti hasil kamera asli, dengan tekstur bahan, uap, kilau minyak, dan cahaya dapur rumah yang alami; bukan kartun, ilustrasi, lukisan, render 3D, CGI, tanah liat, makanan plastik, atau grafis bergaya. Tampilkan hanya hidangan jadi untuk tiga porsi, tanpa teks, tanda air, orang, atau makanan lain.`,
});

const stepGenerationPrompt = (
  imagePrompt,
  stepTitle,
  stepInstruction,
  common,
  assetId,
) => ({
  zh: `4:3 橫向構圖。${imagePrompt.zh}。必須嚴格依照本步驟完整描述生成：${stepInstruction.zh}。畫面焦點是「${stepTitle.zh}」，顯示這一步正在進行或剛完成時的材料形態、份量、顏色、熟度、廚具位置及操作動作；同一食材只可顯示當前狀態一次，禁止額外複製食材來展示處理前後；不要提前顯示後續步驟或最終成品。菜式：${common.recipeTitle.zh}；主要食材：${common.mainIngredient.zh}；烹調方法：${common.method.zh}。真實相機拍攝的香港家庭廚房寫實食物照片，保留自然食材紋理、蒸氣、油光及真實光線；不可是卡通、插畫、繪畫、3D render、CGI 或塑膠模型。無文字、無水印、無人物臉孔。`,
  en: `4:3 landscape composition. ${imagePrompt.en}. Generate the image strictly from this complete step instruction: ${stepInstruction.en} The visual focus is “${stepTitle.en}”. Depict one exact moment only: show the ingredient form, quantity, colour, doneness, utensil position, and action while this step is underway or immediately after it finishes. Every ingredient must appear only once and in one current state. Never show before-and-after versions together. Do not leave bowls, trays, or piles containing an earlier state or an unused duplicate amount of any ingredient already incorporated. If the instruction contains multiple cooking passes, show all portions together immediately after the final pass, not earlier and later states side by side. Only show an ingredient in both a pouring container and the cooking vessel when they form one physically continuous transfer required by this exact step.${STEP_COMPOSITION_CONSTRAINTS[assetId] ? ` ${STEP_COMPOSITION_CONSTRAINTS[assetId]}` : ""}${visualQaConstraint(assetId, common.equipment.en)} Do not show later steps or the final dish early. Dish: ${common.recipeTitle.en}; main ingredient: ${common.mainIngredient.en}; cooking method: ${common.method.en}. Photorealistic instructional food photography in a Hong Kong home kitchen, captured like a real camera with natural ingredient texture, steam, oil sheen, depth of field, and believable light. No cartoon, illustration, painting, 3D render, CGI, clay, plastic food, or stylised graphic. No text, watermark, or visible faces.`,
  id: `Komposisi lanskap 4:3. ${imagePrompt.id}. Buat gambar secara ketat berdasarkan instruksi lengkap langkah ini: ${stepInstruction.id} Fokus visual adalah “${stepTitle.id}”. Tampilkan bentuk, jumlah, warna, tingkat kematangan bahan, posisi alat, dan tindakan saat langkah ini berlangsung atau tepat setelah selesai. Tampilkan setiap bahan hanya sekali dalam satu keadaan saat ini; jangan menggandakan bahan untuk menunjukkan keadaan sebelum dan sesudah. Jangan tampilkan langkah berikutnya atau hidangan akhir terlalu dini. Hidangan: ${common.recipeTitle.id}; bahan utama: ${common.mainIngredient.id}; metode memasak: ${common.method.id}. Foto instruksi makanan fotorealistis di dapur rumah Hong Kong, seperti hasil kamera asli dengan tekstur bahan, uap, kilau minyak, kedalaman ruang, dan cahaya yang alami. Bukan kartun, ilustrasi, lukisan, render 3D, CGI, tanah liat, makanan plastik, atau grafis bergaya. Tanpa teks, tanda air, atau wajah orang.`,
});

const buildManifest = (recipes) => {
  if (!Array.isArray(recipes)) {
    throw new Error("src/data/recipes.json must contain an array");
  }
  if (recipes.length !== EXPECTED_RECIPES) {
    throw new Error(
      `Expected ${EXPECTED_RECIPES} recipes, found ${recipes.length}`,
    );
  }

  const recipeIds = new Set();
  const recipeSlugs = new Set();
  const assetIds = new Set();
  const filenames = new Set();
  const assets = [];
  const expectedHeroes = recipes.length;
  const expectedSteps = recipes.reduce(
    (count, recipe) => count + (recipe.steps?.length ?? 0),
    0,
  );
  const expectedAssets = expectedHeroes + expectedSteps;

  const registerAsset = (asset) => {
    if (assetIds.has(asset.assetId)) {
      throw new Error(`Duplicate assetId: ${asset.assetId}`);
    }
    if (filenames.has(asset.filename)) {
      throw new Error(`Duplicate image filename: ${asset.filename}`);
    }
    if (DISALLOWED_SHARED_IMAGE.test(asset.filename)) {
      throw new Error(`Shared/default image filename is forbidden: ${asset.filename}`);
    }
    if (DISALLOWED_SHARED_IMAGE.test(asset.publicPath)) {
      throw new Error(`Shared/default image path is forbidden: ${asset.publicPath}`);
    }

    const promptOverride = GENERATION_PROMPT_OVERRIDES[asset.assetId];
    if (promptOverride !== undefined) {
      if (typeof promptOverride !== "string" || !promptOverride.trim()) {
        throw new Error(
          `Generation prompt override for ${asset.assetId} must be a non-empty string`,
        );
      }
      asset.generationPrompt = {
        ...asset.generationPrompt,
        en: promptOverride.trim(),
      };
    }

    assetIds.add(asset.assetId);
    filenames.add(asset.filename);
    const promptHash = sha256(canonicalPrompt(asset.generationPrompt));
    const providerPromptHash = sha256(asset.generationPrompt.en.trim());
    assets.push({
      ...asset,
      promptHash,
      providerPromptHash,
      provenancePath: `/assets/generated/provenance/${asset.assetId
        .replaceAll(":", "--")}.json`,
      provider: null,
      model: null,
      generatedAt: null,
      assetSHA256: null,
      qaStatus: {
        automated: "pending",
        visual: "pending",
        release: "blocked",
      },
    });
  };

  for (const recipe of recipes) {
    const recipeId = safeSegment(recipe.id, "recipe.id");
    const recipeSlug = safeSegment(recipe.slug, `${recipe.id}.slug`);

    if (recipeIds.has(recipeId)) {
      throw new Error(`Duplicate recipe id: ${recipeId}`);
    }
    if (recipeSlugs.has(recipeSlug)) {
      throw new Error(`Duplicate recipe slug: ${recipeSlug}`);
    }
    recipeIds.add(recipeId);
    recipeSlugs.add(recipeSlug);

    const common = {
      recipeId,
      recipeSlug,
      recipeTitle: requireLocalized(recipe.title, `${recipe.id}.title`),
      cuisine: requireLocalized(recipe.cuisine, `${recipe.id}.cuisine`),
      mainIngredient: deriveMainIngredient(recipe),
      method: deriveMethod(recipe),
      equipment: deriveEquipment(recipe),
    };
    const directory = `recipes/${recipeId}-${recipeSlug}`;
    const heroPrompt = requireLocalized(
      recipe.imagePrompt,
      `${recipe.id}.imagePrompt`,
    );
    const heroFilename = `${directory}/hero.webp`;
    const heroStageTitle = {
      zh: "完成菜式並上碟",
      en: "Finish and plate the dish",
      id: "Selesaikan dan sajikan hidangan",
    };
    const heroStageInstruction = {
      zh: `完成菜譜所有步驟後，將${common.recipeTitle.zh}以三人份上碟，準確呈現此菜的主要食材、汁醬、切法、顏色及最終熟度。`,
      en: `After completing every recipe step, plate ${common.recipeTitle.en} as three servings, accurately showing its main ingredient, sauce, cuts, colour, and final doneness.`,
      id: `Setelah semua langkah resep selesai, sajikan ${common.recipeTitle.id} untuk tiga porsi dengan bahan utama, saus, potongan, warna, dan tingkat kematangan akhir yang akurat.`,
    };

    registerAsset({
      assetId: `${recipeId}:hero`,
      kind: "hero",
      filename: heroFilename,
      publicPath: `/assets/generated/${heroFilename}`,
      ...common,
      stepNumber: 0,
      stepTitle: heroStageTitle,
      stepInstruction: heroStageInstruction,
      imagePrompt: heroPrompt,
      generationPrompt: heroGenerationPrompt(
        heroPrompt,
        common,
        `${recipeId}:hero`,
      ),
      visual: {
        ...recipe.visual,
        assetRole: "recipe-hero",
        requiredOutput: {
          format: "webp",
          aspectRatio: "4:3",
          uniqueToAsset: true,
          textInImage: false,
        },
      },
      sourceImageSeed: recipe.imageSeed,
    });

    if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) {
      throw new Error(`${recipe.id} has no steps`);
    }

    const stepNumbers = new Set();
    for (const [stepIndex, step] of recipe.steps.entries()) {
      const stepNumber = Number(step.order ?? stepIndex + 1);
      if (!Number.isInteger(stepNumber) || stepNumber < 1) {
        throw new Error(`${recipe.id}.steps[${stepIndex}] has an invalid order`);
      }
      if (stepNumbers.has(stepNumber)) {
        throw new Error(`${recipe.id} has duplicate step number ${stepNumber}`);
      }
      stepNumbers.add(stepNumber);

      const stepTitle = requireLocalized(
        step.title,
        `${recipe.id}.steps[${stepIndex}].title`,
      );
      const stepInstruction = requireLocalized(
        step.instruction,
        `${recipe.id}.steps[${stepIndex}].instruction`,
      );
      const stepPrompt = requireLocalized(
        step.imagePrompt,
        `${recipe.id}.steps[${stepIndex}].imagePrompt`,
      );
      const token = stepNumberToken(stepNumber);
      const filename = `${directory}/step-${token}.webp`;

      registerAsset({
        assetId: `${recipeId}:step-${token}`,
        kind: "step",
        filename,
        publicPath: `/assets/generated/${filename}`,
        ...common,
        stepNumber,
        stepTitle,
        stepInstruction,
        imagePrompt: stepPrompt,
        generationPrompt: stepGenerationPrompt(
          stepPrompt,
          stepTitle,
          stepInstruction,
          common,
          `${recipeId}:step-${token}`,
        ),
        visual: {
          ...step.visual,
          assetRole: "recipe-step",
          stepTitle,
          stepInstruction,
          requiredOutput: {
            format: "webp",
            aspectRatio: "4:3",
            uniqueToAsset: true,
            textInImage: false,
            mustShowOnlyThisStep: true,
          },
        },
        sourceImageSeed: step.imageSeed,
      });
    }
  }

  const heroCount = assets.filter((asset) => asset.kind === "hero").length;
  const stepCount = assets.filter((asset) => asset.kind === "step").length;

  if (heroCount !== expectedHeroes) {
    throw new Error(`Expected ${expectedHeroes} hero assets, found ${heroCount}`);
  }
  if (stepCount !== expectedSteps) {
    throw new Error(`Expected ${expectedSteps} step assets, found ${stepCount}`);
  }
  if (assets.length !== expectedAssets) {
    throw new Error(`Expected ${expectedAssets} assets, found ${assets.length}`);
  }
  if (filenames.size !== expectedAssets) {
    throw new Error(
      `Expected ${expectedAssets} unique filenames, found ${filenames.size}`,
    );
  }
  const unknownPromptOverrides = Object.keys(
    GENERATION_PROMPT_OVERRIDES,
  ).filter((assetId) => !assetIds.has(assetId));
  if (unknownPromptOverrides.length) {
    throw new Error(
      `Unknown generation prompt override assetIds: ${unknownPromptOverrides.join(", ")}`,
    );
  }

  return {
    schemaVersion: 2,
    provenanceSchemaVersion: PROVENANCE_SCHEMA_VERSION,
    source: "src/data/recipes.json",
    outputRoot: "public/assets/generated",
    summary: {
      recipeCount: recipes.length,
      heroCount,
      stepCount,
      assetCount: assets.length,
      uniqueFilenameCount: filenames.size,
      languages: LANGUAGES,
      imageFormat: "webp",
    },
    assets,
  };
};

const recipes = JSON.parse(await readFile(recipeFile, "utf8"));
const manifest = buildManifest(recipes);

for (const asset of manifest.assets) {
  const provenanceFile = resolve(
    projectRoot,
    "public",
    asset.provenancePath.slice(1),
  );
  try {
    const provenance = JSON.parse(await readFile(provenanceFile, "utf8"));
    if (
      provenance.schemaVersion !== PROVENANCE_SCHEMA_VERSION ||
      provenance.assetId !== asset.assetId ||
      provenance.promptHash !== asset.promptHash
    ) {
      continue;
    }
    asset.provider = provenance.provider ?? null;
    asset.model = provenance.model ?? null;
    asset.generatedAt = provenance.generatedAt ?? null;
    asset.assetSHA256 = provenance.assetSHA256 ?? null;
    asset.qaStatus = {
      automated: provenance.qa?.automated?.status ?? "pending",
      visual: provenance.qa?.visual?.status ?? "pending",
      release:
        provenance.qa?.automated?.status === "passed" &&
        provenance.qa?.visual?.status === "approved"
          ? "eligible"
          : "blocked",
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Image manifest written to ${outputFile}`);
console.log(
  `${manifest.summary.recipeCount} recipes: ` +
    `${manifest.summary.heroCount} heroes + ` +
    `${manifest.summary.stepCount} steps = ` +
    `${manifest.summary.assetCount} unique image paths`,
);
