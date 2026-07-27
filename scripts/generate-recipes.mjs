#!/usr/bin/env node
/**
 * Deterministic recipe catalogue generator.
 *
 * The catalogue is intentionally generated from a curated dish list rather than
 * fetched at runtime.  This keeps the GitHub-hosted app fast, offline friendly,
 * and reviewable. Quantities are generated for three Hong Kong family-size
 * servings and may be scaled by the UI.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(here, "../src/data/recipes.json");

const t = (zh, en, id) => ({ zh, en, id });
const U = {
  g: t("克", "g", "g"),
  ml: t("毫升", "ml", "ml"),
  tbsp: t("湯匙", "tbsp", "sdm"),
  tsp: t("茶匙", "tsp", "sdt"),
  piece: t("件", "piece", "buah"),
  clove: t("瓣", "clove", "siung"),
  cup: t("杯", "cup", "cangkir"),
  stalk: t("棵", "stalk", "batang"),
  slice: t("片", "slice", "iris"),
};

const I = {
  plantMince: ["Impossible-style 植物免治肉", "Impossible-style plant mince", "daging cincang nabati gaya Impossible", 480, "g"],
  plantStrips: ["植物肉條", "plant-based meat strips", "irisan daging nabati", 560, "g"],
  chickenThigh: ["去骨雞髀肉", "boneless chicken thigh", "paha ayam tanpa tulang", 600, "g", "firmTofu"],
  chickenBreast: ["雞胸肉", "chicken breast", "dada ayam", 520, "g", "firmTofu"],
  chickenWing: ["雞翼", "chicken wings", "sayap ayam", 700, "g", "kingOyster"],
  porkBelly: ["五花腩", "pork belly", "samcan babi", 600, "g", "kingOyster"],
  porkLoin: ["豬柳", "pork loin", "daging has babi", 520, "g", "firmTofu"],
  porkMince: ["免治豬肉", "minced pork", "daging babi cincang", 450, "g", "mushroom"],
  ribs: ["一字排骨", "pork spare ribs", "iga babi", 700, "g", "kingOyster"],
  beefFlank: ["牛肉片", "sliced beef flank", "irisan daging sapi", 520, "g", "kingOyster"],
  beefBrisket: ["牛腩", "beef brisket", "sandung lamur sapi", 700, "g", "kingOyster"],
  beefMince: ["免治牛肉", "minced beef", "daging sapi cincang", 480, "g", "mushroom"],
  lamb: ["羊肉", "lamb", "daging domba", 600, "g", "kingOyster"],
  duck: ["鴨件", "duck pieces", "potongan bebek", 700, "g", "firmTofu"],
  fishFillet: ["無骨魚柳", "boneless fish fillet", "fillet ikan tanpa tulang", 600, "g", "firmTofu"],
  wholeFish: ["原條魚（約700克）", "whole fish (about 700 g)", "ikan utuh (sekitar 700 g)", 1, "piece", "firmTofu"],
  salmon: ["三文魚柳", "salmon fillet", "fillet salmon", 600, "g", "firmTofu"],
  prawn: ["去殼蝦仁", "peeled prawns", "udang kupas", 500, "g", "firmTofu"],
  squid: ["鮮魷魚", "fresh squid", "cumi-cumi segar", 500, "g", "kingOyster"],
  clam: ["蜆", "clams", "kerang", 800, "g", "mushroom"],
  firmTofu: ["硬豆腐", "firm tofu", "tahu padat", 600, "g"],
  softTofu: ["滑豆腐", "silken tofu", "tahu sutra", 600, "g"],
  kingOyster: ["雞髀菇", "king oyster mushroom", "jamur king oyster", 500, "g"],
  mushroom: ["雜菌", "mixed mushrooms", "campuran jamur", 500, "g"],
  egg: ["雞蛋", "eggs", "telur", 4, "piece"],
  eggplant: ["茄子", "eggplant", "terong", 600, "g"],
  cauliflower: ["椰菜花", "cauliflower", "kembang kol", 700, "g"],
  cabbage: ["椰菜", "cabbage", "kol", 600, "g"],
  broccoli: ["西蘭花", "broccoli", "brokoli", 600, "g"],
  pumpkin: ["南瓜", "pumpkin", "labu kuning", 700, "g"],
  potato: ["薯仔", "potatoes", "kentang", 700, "g"],
  tomato: ["番茄", "tomatoes", "tomat", 650, "g"],
  okra: ["秋葵", "okra", "okra", 500, "g"],
  chickpea: ["罐裝鷹嘴豆（瀝乾）", "canned chickpeas, drained", "kacang arab kalengan, tiriskan", 480, "g"],
  lentil: ["紅扁豆", "red lentils", "lentil merah", 350, "g"],
  paneer: ["印度芝士", "paneer", "paneer", 500, "g"],
  rice: ["白米", "jasmine rice", "beras melati", 320, "g"],
  glutinousRice: ["糯米", "glutinous rice", "beras ketan", 320, "g"],
  noodle: ["乾麵", "dried noodles", "mi kering", 400, "g"],
  pasta: ["意大利粉", "dried pasta", "pasta kering", 400, "g"],
};

const P = {
  garlic: ["蒜頭", "garlic", "bawang putih", 3, "clove"],
  ginger: ["薑", "ginger", "jahe", 20, "g"],
  scallion: ["蔥", "spring onion", "daun bawang", 2, "stalk"],
  onion: ["洋蔥", "onion", "bawang bombai", 180, "g"],
  shallot: ["乾蔥", "shallots", "bawang merah", 80, "g"],
  carrot: ["甘筍", "carrot", "wortel", 150, "g"],
  bellPepper: ["甜椒", "bell pepper", "paprika", 180, "g"],
  celery: ["西芹", "celery", "seledri", 120, "g"],
  corn: ["粟米粒", "sweet corn kernels", "jagung manis", 150, "g"],
  pea: ["青豆", "green peas", "kacang polong", 120, "g"],
  spinach: ["菠菜", "spinach", "bayam", 250, "g"],
  bokChoy: ["上海青", "baby bok choy", "pakcoy muda", 300, "g"],
  beanSprout: ["芽菜", "bean sprouts", "tauge", 250, "g"],
  hairyGourd: ["節瓜", "hairy gourd", "labu berbulu", 450, "g"],
  lettuce: ["生菜葉", "lettuce leaves", "daun selada", 12, "piece"],
  chive: ["韭菜", "Chinese chives", "kucai", 120, "g"],
  cucumber: ["青瓜", "cucumber", "mentimun", 250, "g"],
  pineapple: ["菠蘿件", "pineapple chunks", "potongan nanas", 220, "g"],
  lemon: ["檸檬", "lemon", "lemon", 1, "piece"],
  lime: ["青檸", "lime", "jeruk nipis", 2, "piece"],
  basil: ["新鮮羅勒", "fresh basil", "kemangi segar", 25, "g"],
  coriander: ["芫荽", "coriander", "daun ketumbar", 20, "g"],
  parsley: ["番茜", "parsley", "peterseli", 20, "g"],
  olive: ["去核橄欖", "pitted olives", "zaitun tanpa biji", 80, "g"],
  lemongrass: ["香茅", "lemongrass", "serai", 2, "stalk"],
  coconutMilk: ["椰奶", "coconut milk", "santan", 400, "ml"],
  stock: ["低鹽蔬菜湯", "low-salt vegetable stock", "kaldu sayur rendah garam", 500, "ml"],
  milk: ["牛奶", "milk", "susu", 250, "ml"],
  cream: ["淡忌廉", "cooking cream", "krim masak", 180, "ml"],
  butter: ["牛油", "butter", "mentega", 30, "g"],
  cheese: ["巴馬臣芝士", "Parmesan cheese", "keju Parmesan", 50, "g"],
  flour: ["中筋麵粉", "plain flour", "tepung terigu serbaguna", 80, "g"],
  breadcrumb: ["麵包糠", "breadcrumbs", "tepung roti", 100, "g"],
  vegetarianHam: ["素餐肉", "vegetarian luncheon ham", "ham vegetarian", 180, "g"],
  centuryEgg: ["皮蛋", "century egg", "telur pitan", 2, "piece"],
  saltedEgg: ["鹹蛋", "salted duck egg", "telur asin", 1, "piece"],
  preservedRadish: ["菜脯", "preserved radish", "lobak asin", 60, "g"],
  preservedMustard: ["梅菜", "preserved mustard greens", "sayur sawi asin", 60, "g"],
  redFermentedBeanCurd: ["南乳", "red fermented bean curd", "tahu fermentasi merah", 2, "piece"],
  tofuSkin: ["枝竹", "dried tofu skin sticks", "kembang tahu kering", 100, "g"],
  driedTangerinePeel: ["陳皮", "dried tangerine peel", "kulit jeruk kering", 5, "g"],
  sichuanPepper: ["花椒粉", "ground Sichuan pepper", "lada Sichuan bubuk", 0.5, "tsp"],
  peanut: ["無鹽花生", "unsalted peanuts", "kacang tanah tanpa garam", 60, "g"],
  japaneseCurryRoux: ["日式咖喱磚", "Japanese curry roux", "blok kari Jepang", 90, "g"],
  cornstarch: ["粟粉", "cornstarch", "tepung maizena", 2, "tbsp"],
  oil: ["食油", "cooking oil", "minyak goreng", 2, "tbsp"],
  oliveOil: ["橄欖油", "olive oil", "minyak zaitun", 2, "tbsp"],
  lightSoy: ["生抽", "light soy sauce", "kecap asin ringan", 2, "tbsp"],
  darkSoy: ["老抽", "dark soy sauce", "kecap asin pekat", 1, "tsp"],
  oysterSauce: ["蠔油", "oyster sauce", "saus tiram", 1, "tbsp"],
  vegOyster: ["素蠔油", "vegetarian oyster sauce", "saus tiram vegetarian", 1, "tbsp"],
  sesameOil: ["麻油", "sesame oil", "minyak wijen", 1, "tsp"],
  fishSauce: ["魚露", "fish sauce", "kecap ikan", 1.5, "tbsp"],
  tomatoPaste: ["茄膏", "tomato paste", "pasta tomat", 2, "tbsp"],
  cannedTomato: ["罐裝番茄", "canned tomatoes", "tomat kalengan", 400, "g"],
  blackBean: ["磨豉醬", "black bean sauce", "saus kacang hitam", 2, "tbsp"],
  hoisin: ["海鮮醬", "hoisin sauce", "saus hoisin", 2, "tbsp"],
  charSiu: ["叉燒醬", "char siu sauce", "saus char siu", 3, "tbsp"],
  doubanjiang: ["豆瓣醬", "chilli bean paste", "pasta kacang cabai", 1.5, "tbsp"],
  gochujang: ["韓式辣醬", "gochujang", "gochujang", 2, "tbsp"],
  miso: ["味噌", "miso paste", "pasta miso", 2, "tbsp"],
  curryPaste: ["咖喱醬", "curry paste", "pasta kari", 2, "tbsp"],
  curryPowder: ["咖喱粉", "curry powder", "bubuk kari", 2, "tbsp"],
  sambal: ["叁巴醬", "sambal", "sambal", 2, "tbsp"],
  paprika: ["紅椒粉", "paprika", "paprika bubuk", 1, "tsp"],
  cumin: ["孜然粉", "ground cumin", "jintan bubuk", 1, "tsp"],
  turmeric: ["黃薑粉", "turmeric", "kunyit bubuk", 1, "tsp"],
  garamMasala: ["印度綜合香料", "garam masala", "garam masala", 2, "tsp"],
  italianHerb: ["意大利香草", "Italian mixed herbs", "herba Italia", 2, "tsp"],
  sugar: ["砂糖", "sugar", "gula", 2, "tsp"],
  vinegar: ["米醋", "rice vinegar", "cuka beras", 2, "tbsp"],
  honey: ["蜜糖", "honey", "madu", 1.5, "tbsp"],
  salt: ["鹽", "salt", "garam", 0.75, "tsp"],
  pepper: ["白胡椒粉", "white pepper", "lada putih", 0.25, "tsp"],
  blackPepper: ["黑胡椒", "black pepper", "lada hitam", 0.5, "tsp"],
};

const profiles = {
  cantonese: ["ginger", "scallion", "lightSoy", "oysterSauce", "sesameOil", "cornstarch"],
  blackBean: ["garlic", "bellPepper", "blackBean", "lightSoy", "sugar", "cornstarch"],
  sweetSour: ["onion", "bellPepper", "pineapple", "vinegar", "sugar", "tomatoPaste", "cornstarch"],
  soyBraise: ["ginger", "scallion", "lightSoy", "darkSoy", "sugar", "stock"],
  garlic: ["garlic", "scallion", "lightSoy", "oysterSauce", "cornstarch"],
  pepper: ["onion", "bellPepper", "lightSoy", "blackPepper", "cornstarch"],
  tomato: ["onion", "garlic", "cannedTomato", "tomatoPaste", "stock", "sugar"],
  curryHK: ["onion", "potato", "curryPowder", "coconutMilk", "stock"],
  japanese: ["ginger", "lightSoy", "sugar", "sesameOil", "scallion"],
  miso: ["miso", "ginger", "scallion", "stock", "sesameOil"],
  korean: ["garlic", "gochujang", "lightSoy", "sesameOil", "sugar", "scallion"],
  thaiBasil: ["garlic", "shallot", "basil", "fishSauce", "lightSoy", "sugar", "lime"],
  thaiCurry: ["curryPaste", "coconutMilk", "bellPepper", "basil", "fishSauce", "lime"],
  thaiLime: ["lemongrass", "lime", "fishSauce", "sugar", "coriander", "shallot"],
  sambal: ["shallot", "garlic", "sambal", "lightSoy", "sugar", "lime"],
  rendang: ["shallot", "garlic", "lemongrass", "coconutMilk", "curryPowder", "sambal"],
  satay: ["shallot", "garlic", "lightSoy", "curryPowder", "coconutMilk", "sugar"],
  italianTomato: ["onion", "garlic", "cannedTomato", "tomatoPaste", "italianHerb", "oliveOil"],
  italianCream: ["onion", "garlic", "cream", "cheese", "blackPepper", "oliveOil"],
  lemonButter: ["garlic", "lemon", "butter", "parsley", "blackPepper"],
  mediterranean: ["onion", "garlic", "tomato", "paprika", "cumin", "lemon", "oliveOil"],
  indian: ["onion", "garlic", "ginger", "cannedTomato", "garamMasala", "turmeric", "cumin"],
  coconutIndian: ["onion", "garlic", "ginger", "coconutMilk", "garamMasala", "turmeric"],
  broth: ["ginger", "scallion", "stock", "lightSoy", "pepper"],
  herb: ["garlic", "onion", "stock", "italianHerb", "oliveOil", "blackPepper"],
};

// Profile references may use a main ingredient key (e.g. potato).
for (const [key, value] of Object.entries(I)) {
  if (!P[key]) P[key] = value.slice(0, 5);
}

const cuisineNames = {
  hk: t("香港家常", "Hong Kong home-style", "Rumahan Hong Kong"),
  cantonese: t("廣東菜", "Cantonese", "Kanton"),
  northChina: t("中國北方", "Northern Chinese", "Tiongkok Utara"),
  sichuan: t("川湘菜", "Sichuan & Hunan", "Sichuan & Hunan"),
  japanese: t("日本菜", "Japanese", "Jepang"),
  korean: t("韓國菜", "Korean", "Korea"),
  thai: t("泰國菜", "Thai", "Thailand"),
  indonesian: t("印尼菜", "Indonesian", "Indonesia"),
  southeastAsia: t("東南亞菜", "Southeast Asian", "Asia Tenggara"),
  italian: t("意大利菜", "Italian", "Italia"),
  western: t("西式家常", "Western home-style", "Rumahan Barat"),
  mediterranean: t("地中海及中東", "Mediterranean & Middle Eastern", "Mediterania & Timur Tengah"),
  indian: t("印度菜", "Indian", "India"),
  vegetarian: t("蛋奶素食", "Lacto-ovo vegetarian", "Vegetarian lakto-ovo"),
  fusion: t("港式融合", "Hong Kong fusion", "Fusion Hong Kong"),
};

const methodNames = {
  stirFry: t("快炒", "Stir-fry", "Tumis"),
  steam: t("清蒸", "Steam", "Kukus"),
  braise: t("燜煮", "Braise", "Semur"),
  soup: t("湯羹", "Soup", "Sup"),
  roast: t("焗烤", "Roast", "Panggang"),
  bake: t("烘焗", "Bake", "Panggang oven"),
  panFry: t("香煎", "Pan-fry", "Goreng wajan"),
  deepFry: t("酥炸", "Deep-fry", "Goreng rendam"),
  curry: t("咖喱", "Curry", "Kari"),
  noodle: t("麵食", "Noodles", "Mi"),
  rice: t("飯類", "Rice", "Nasi"),
  salad: t("沙律", "Salad", "Salad"),
  stew: t("慢燉", "Stew", "Rebus perlahan"),
  grill: t("燒烤", "Grill", "Bakar"),
  congee: t("粥品", "Congee", "Bubur"),
};

const categoryForMethod = {
  soup: t("湯", "Soup", "Sup"),
  noodle: t("主食", "Main", "Hidangan utama"),
  rice: t("主食", "Main", "Hidangan utama"),
  congee: t("主食", "Main", "Hidangan utama"),
  salad: t("前菜／配菜", "Starter / side", "Pembuka / pendamping"),
};

function slugify(input) {
  return input.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function mentionsIngredient(text, ingredientName) {
  const escaped = ingredientName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i").test(text);
}

function threeServingAmount(amount, unit) {
  if (typeof amount !== "number") return amount;
  if (unit === "g" || unit === "ml") {
    return Math.max(5, Math.round((amount * 0.75) / 5) * 5);
  }
  if (unit === "tbsp" || unit === "tsp" || unit === "cup") {
    return Math.max(0.25, Math.round((amount * 0.75) * 4) / 4);
  }
  if (unit === "piece" || unit === "clove" || unit === "stalk" || unit === "slice") {
    if (amount === 1) return 1;
    return Math.max(1, Math.round(amount * 0.75));
  }
  return amount * 0.75;
}

function meatAlternativeKey(key) {
  if (/Mince/.test(key)) return "plantMince";
  if (/chicken|pork|ribs|beef|lamb|duck/i.test(key)) return "plantStrips";
  return null;
}

function ingredient(key, override = {}) {
  const row = I[key] || P[key];
  if (!row) throw new Error(`Unknown ingredient key: ${key}`);
  const [zh, en, id, amount, unit] = row;
  const scaledAmount = override.amount ?? threeServingAmount(amount, override.unit ?? unit);
  const result = {
    id: key,
    name: t(zh, en, id),
    amount: scaledAmount,
    unit: U[override.unit ?? unit],
    optional: override.optional ?? false,
  };
  if (I[key]?.[5]) {
    const fallbackKey = I[key][5];
    const primaryKey = meatAlternativeKey(key) || fallbackKey;
    const altKey = primaryKey;
    const alt = I[altKey];
    result.vegetarianAlternative = {
      name: t(alt[0], alt[1], alt[2]),
      amount: threeServingAmount(alt[3], alt[4]),
      unit: U[alt[4]],
    };
    if (primaryKey !== fallbackKey) {
      const fallback = I[fallbackKey];
      result.secondaryVegetarianAlternative = {
        name: t(fallback[0], fallback[1], fallback[2]),
        amount: threeServingAmount(fallback[3], fallback[4]),
        unit: U[fallback[4]],
      };
    }
  }
  if (key === "oysterSauce") {
    result.vegetarianAlternative = {
      name: t(...P.vegOyster.slice(0, 3)),
      amount: scaledAmount,
      unit: U[unit],
    };
  }
  if (key === "fishSauce") {
    result.vegetarianAlternative = {
      name: t("淡醬油加少許青檸汁", "light soy sauce with a little lime", "kecap asin ringan dengan sedikit jeruk nipis"),
      amount: scaledAmount,
      unit: U[unit],
    };
  }
  return result;
}

function parseRows(cuisine, text) {
  return text.trim().split("\n").filter(Boolean).map((line) => {
    const [zh, en, id, main, method, profile, extras = ""] = line.split("|");
    return { cuisine, title: t(zh, en, id), main, method, profile, extras: extras ? extras.split(",") : [] };
  });
}

const catalogue = [
  ...parseRows("hk", `
菠蘿咕嚕肉|Hong Kong sweet and sour pork|Babi asam manis ala Hong Kong|porkLoin|deepFry|sweetSour|
粟米魚柳|Fish fillet with sweet corn sauce|Fillet ikan saus jagung manis|fishFillet|panFry|broth|corn,egg
咖喱薯仔雞|Hong Kong curry chicken with potatoes|Kari ayam kentang Hong Kong|chickenThigh|curry|curryHK|carrot
豉油王雞翼|Supreme soy sauce chicken wings|Sayap ayam kecap Hong Kong|chickenWing|braise|soyBraise|garlic
番茄炒蛋|Tomato and egg stir-fry|Tumis tomat dan telur|egg|stirFry|cantonese|tomato
粟米肉粒飯|Minced pork and corn rice|Nasi babi cincang jagung|porkMince|rice|broth|corn,rice,egg
黑椒牛柳粒|Black pepper beef cubes|Dadu sapi lada hitam|beefFlank|stirFry|pepper|garlic,onion
瑞士雞翼|Hong Kong sweet soy chicken wings|Sayap ayam kecap manis Hong Kong|chickenWing|braise|soyBraise|onion
餐肉蛋炒飯|Luncheon-style vegetarian ham egg fried rice|Nasi goreng ham vegetarian dan telur|egg|rice|cantonese|rice,pea,carrot,scallion
沙嗲牛肉粉絲煲|Satay beef vermicelli pot|Bihun sapi satay dalam panci|beefFlank|noodle|satay|cabbage,beanSprout
港式焗豬扒飯|Hong Kong baked pork chop rice|Nasi panggang daging babi Hong Kong|porkLoin|bake|tomato|rice,egg,cheese
豉汁蒸排骨|Steamed spare ribs with black bean sauce|Iga babi kukus saus kacang hitam|ribs|steam|blackBean|bellPepper
冬菇蒸滑雞|Steamed chicken with mushrooms|Ayam kukus dengan jamur|chickenThigh|steam|cantonese|mushroom
節瓜粉絲蝦米煲|Hairy gourd and vermicelli claypot|Labu berbulu dan bihun dalam panci|prawn|braise|broth|noodle,mushroom
港式羅宋湯|Hong Kong borscht|Sup borscht Hong Kong|beefBrisket|soup|tomato|cabbage,carrot,celery,potato
瑤柱蛋白炒飯|Egg white and mushroom fried rice|Nasi goreng putih telur dan jamur|egg|rice|cantonese|rice,mushroom,pea
椒鹽豬扒|Salt and pepper pork chops|Daging babi garam lada|porkLoin|deepFry|garlic|bellPepper,scallion,pepper
叉燒炒蛋|Char siu-style pork with scrambled egg|Babi char siu dengan telur orak-arik|porkLoin|stirFry|cantonese|egg,charSiu
豆腐火腩煲|Roast pork and tofu pot|Samcan panggang dan tahu dalam panci|porkBelly|braise|soyBraise|firmTofu,mushroom
皮蛋瘦肉粥|Century egg and lean pork congee|Bubur telur pitan dan babi tanpa lemak|porkLoin|congee|broth|rice,egg,ginger
`),
  ...parseRows("cantonese", `
薑蔥蒸魚|Steamed fish with ginger and spring onion|Ikan kukus jahe daun bawang|wholeFish|steam|cantonese|
梅菜蒸肉餅|Steamed pork patty with preserved-vegetable flavour|Patty babi kukus rasa sayur asin|porkMince|steam|soyBraise|mushroom
豉椒炒蜆|Clams with black bean and peppers|Kerang tumis kacang hitam dan paprika|clam|stirFry|blackBean|bellPepper
西蘭花炒牛肉|Beef and broccoli stir-fry|Tumis sapi dan brokoli|beefFlank|stirFry|cantonese|broccoli
菜脯煎蛋|Crisp preserved-radish omelette|Telur dadar lobak asin renyah|egg|panFry|cantonese|scallion
魚香茄子煲|Cantonese eggplant claypot|Terong ala Kanton dalam panci|eggplant|braise|blackBean|porkMince
蝦仁炒蛋|Silky scrambled egg with prawns|Telur orak-arik lembut dengan udang|prawn|stirFry|cantonese|egg,scallion
南乳炆齋|Red-fermented-beancurd style vegetable braise|Sayuran semur ala tahu fermentasi merah|firmTofu|braise|soyBraise|cabbage,mushroom,carrot
枝竹羊腩煲|Lamb and tofu-skin style winter pot|Domba dan tahu dalam panci musim dingin|lamb|stew|soyBraise|firmTofu,mushroom
蒜蓉粉絲蒸蝦|Garlic prawns steamed with vermicelli|Udang bawang putih kukus dengan bihun|prawn|steam|garlic|noodle,scallion
陳皮蒸牛肉餅|Steamed beef patty with citrus aroma|Patty sapi kukus aroma jeruk|beefMince|steam|cantonese|mushroom
啫啫雞煲|Sizzling Cantonese chicken pot|Ayam sizzling Kanton dalam panci|chickenThigh|braise|blackBean|onion,bellPepper
蓮藕炆排骨|Braised ribs with lotus-root style vegetables|Iga semur dengan sayuran akar|ribs|braise|soyBraise|potato,carrot
上湯浸娃娃菜|Baby cabbage in superior broth|Sawi muda dalam kaldu gurih|cabbage|soup|broth|mushroom
金銀蛋浸菠菜|Spinach with two-egg broth|Bayam kuah dua telur|spinach|soup|broth|egg,garlic
芙蓉煎蛋|Cantonese vegetable omelette|Telur dadar sayuran Kanton|egg|panFry|cantonese|beanSprout,carrot,scallion
麵醬蒸茄子|Steamed eggplant with savoury bean sauce|Terong kukus saus kacang gurih|eggplant|steam|blackBean|garlic,scallion
紅燒豆腐|Cantonese red-braised tofu|Tahu semur merah Kanton|firmTofu|braise|soyBraise|mushroom,bokChoy
蠔油炆冬菇|Braised mushrooms in oyster-style sauce|Jamur semur saus tiram|mushroom|braise|cantonese|bokChoy
白切雞|Cantonese poached chicken|Ayam rebus Kanton|chickenThigh|soup|cantonese|ginger,scallion
`),
  ...parseRows("northChina", `
京醬肉絲|Beijing sweet-bean pork strips|Irisan babi saus kacang manis Beijing|porkLoin|stirFry|soyBraise|hoisin,scallion
木須肉|Moo shu pork with egg and vegetables|Babi moo shu dengan telur dan sayuran|porkLoin|stirFry|cantonese|egg,mushroom,cabbage
孜然羊肉|Cumin lamb stir-fry|Tumis domba jintan|lamb|stirFry|pepper|cumin,onion,scallion
東北地三鮮|Northeastern three-vegetable stir-fry|Tumis tiga sayuran Tiongkok Timur Laut|eggplant|stirFry|garlic|potato,bellPepper
番茄牛腩|Northern-style tomato beef brisket|Sandung lamur sapi tomat ala Utara|beefBrisket|stew|tomato|potato,carrot
紅燒獅子頭|Red-braised pork meatballs|Bakso babi semur merah|porkMince|braise|soyBraise|cabbage,mushroom
醬爆雞丁|Beijing sauce chicken cubes|Dadu ayam saus Beijing|chickenThigh|stirFry|soyBraise|hoisin,bellPepper
醋溜椰菜|Vinegar-sizzled cabbage|Kol tumis cuka|cabbage|stirFry|garlic|vinegar,sugar
蒜泥白肉|Poached pork with garlic dressing|Babi rebus saus bawang putih|porkBelly|salad|garlic|vinegar,scallion
韭菜雞蛋餅|Chive-style egg pancake|Panekuk telur kucai|egg|panFry|cantonese|scallion,flour
家常豆腐|Northern home-style tofu|Tahu rumahan Tiongkok Utara|firmTofu|braise|soyBraise|bellPepper,mushroom
蔥爆牛肉|Spring onion beef stir-fry|Tumis sapi daun bawang|beefFlank|stirFry|cantonese|scallion,onion
小雞燉蘑菇|Northern chicken and mushroom stew|Semur ayam dan jamur ala Utara|chickenThigh|stew|soyBraise|mushroom,potato
白菜燉豆腐|Napa cabbage and tofu stew|Semur sawi putih dan tahu|firmTofu|stew|broth|cabbage,mushroom
鍋塌豆腐|Egg-coated pan-braised tofu|Tahu lapis telur goreng-semur|firmTofu|panFry|broth|egg,scallion
糖醋魚柳|Northern sweet vinegar fish fillet|Fillet ikan asam manis ala Utara|fishFillet|deepFry|sweetSour|
香菇肉燥麵|Mushroom pork sauce noodles|Mi saus babi dan jamur|porkMince|noodle|soyBraise|mushroom,noodle,bokChoy
雞絲涼麵|Shredded chicken cold noodles|Mi dingin ayam suwir|chickenBreast|noodle|japanese|noodle,cucumber,scallion
玉米雞蛋湯|Sweet corn and egg drop soup|Sup jagung dan telur|egg|soup|broth|corn,cornstarch
土豆燒牛肉|Braised beef with potatoes|Sapi semur kentang|beefBrisket|braise|soyBraise|potato,carrot
`),
  ...parseRows("sichuan", `
少辣麻婆豆腐|Mild mapo tofu|Tahu mapo tidak terlalu pedas|softTofu|braise|korean|porkMince,doubanjiang,scallion
宮保雞丁|Mild kung pao chicken|Ayam kung pao tidak terlalu pedas|chickenThigh|stirFry|sweetSour|bellPepper,scallion
魚香肉絲|Mild fish-fragrant pork strips|Irisan babi yuxiang tidak terlalu pedas|porkLoin|stirFry|blackBean|bellPepper,vinegar,sugar
回鍋肉|Twice-cooked pork with cabbage|Babi masak dua kali dengan kol|porkBelly|stirFry|blackBean|cabbage,bellPepper
水煮魚家庭版|Family-style mild Sichuan fish|Ikan Sichuan rumahan tidak terlalu pedas|fishFillet|soup|korean|cabbage,beanSprout
乾煸四季豆|Dry-fried green-bean style okra|Okra tumis kering ala buncis Sichuan|okra|stirFry|blackBean|porkMince,garlic
酸辣薯絲|Hot and sour shredded potato|Kentang iris asam pedas|potato|stirFry|garlic|vinegar,bellPepper
辣子雞家庭版|Family-style mild chilli chicken|Ayam cabai rumahan tidak terlalu pedas|chickenThigh|deepFry|korean|bellPepper,scallion
口水雞少辣版|Mild Sichuan mouth-watering chicken|Ayam Sichuan saus pedas ringan|chickenThigh|salad|korean|cucumber,coriander
螞蟻上樹|Minced pork with glass noodles|Bihun dengan babi cincang|porkMince|noodle|blackBean|noodle,scallion
酸菜魚簡易版|Easy sour vegetable fish soup|Sup ikan sayur asam mudah|fishFillet|soup|broth|cabbage,ginger
豆瓣茄子|Chilli-bean braised eggplant|Terong semur pasta kacang cabai|eggplant|braise|blackBean|doubanjiang,garlic
椒麻雞絲|Sichuan pepper-style shredded chicken|Ayam suwir saus lada Sichuan|chickenBreast|salad|korean|cucumber,scallion
粉蒸排骨|Steamed spiced spare ribs|Iga kukus berbumbu|ribs|steam|indian|potato
農家小炒肉|Hunan farmhouse pork stir-fry|Tumis babi pedesaan Hunan|porkBelly|stirFry|blackBean|bellPepper,scallion
剁椒蒸魚柳|Steamed fish with mild chopped peppers|Ikan kukus cabai cincang ringan|fishFillet|steam|korean|bellPepper,scallion
香辣椰菜花|Mild spicy cauliflower stir-fry|Tumis kembang kol pedas ringan|cauliflower|stirFry|korean|onion,bellPepper
紅油抄手風餃子湯|Mild chilli dumpling-style soup|Sup pangsit saus cabai ringan|porkMince|soup|korean|cabbage,flour,scallion
醬燒牛肉豆腐|Bean-sauce beef and tofu|Sapi dan tahu saus kacang|beefFlank|braise|blackBean|firmTofu,bellPepper
湖南番茄炒蛋|Hunan tomato egg with mild chilli|Telur tomat Hunan pedas ringan|egg|stirFry|korean|tomato,scallion
`),
  ...parseRows("japanese", `
照燒雞扒|Teriyaki chicken steak|Steak ayam teriyaki|chickenThigh|panFry|japanese|broccoli
日式咖喱牛肉|Japanese beef curry|Kari sapi Jepang|beefBrisket|curry|curryHK|potato,carrot
親子丼|Chicken and egg rice bowl|Donburi ayam dan telur|chickenThigh|rice|japanese|egg,onion,rice
牛肉壽喜燒|Beef sukiyaki hotpot|Sukiyaki sapi|beefFlank|stew|japanese|softTofu,cabbage,mushroom
味噌三文魚|Miso-glazed salmon|Salmon saus miso|salmon|roast|miso|broccoli
日式薑汁豬肉|Japanese ginger pork|Babi jahe Jepang|porkLoin|stirFry|japanese|onion,cabbage
大阪燒家庭版|Family-style okonomiyaki|Okonomiyaki rumahan|egg|panFry|japanese|cabbage,flour,scallion
日式炸雞|Japanese karaage chicken|Ayam karaage Jepang|chickenThigh|deepFry|japanese|cornstarch,lemon
豆腐漢堡扒|Japanese tofu hamburger steak|Steak burger tahu Jepang|firmTofu|panFry|japanese|mushroom,onion,egg
鯖魚風味噌煮魚柳|Miso-simmered fish fillet|Fillet ikan rebus miso|fishFillet|braise|miso|ginger,scallion
日式南瓜煮|Japanese simmered pumpkin|Labu rebus Jepang|pumpkin|braise|japanese|stock
牛肉烏冬|Beef udon-style noodles|Mi udon sapi|beefFlank|noodle|japanese|noodle,bokChoy,mushroom
雞肉炒烏冬|Chicken yaki udon|Yaki udon ayam|chickenThigh|noodle|japanese|noodle,cabbage,carrot
天津風蟹味蛋飯|Japanese-Chinese omelette rice|Nasi telur dadar ala Jepang-Tiongkok|egg|rice|broth|rice,corn,mushroom
照燒豆腐|Teriyaki tofu|Tahu teriyaki|firmTofu|panFry|japanese|broccoli,mushroom
味噌茄子|Miso-glazed eggplant|Terong saus miso|eggplant|roast|miso|scallion
日式薯仔燉肉|Japanese meat and potato stew|Semur daging kentang Jepang|beefFlank|stew|japanese|potato,carrot,onion
茶碗蒸家庭版|Family steamed egg custard|Telur kukus chawanmushi rumahan|egg|steam|japanese|mushroom,prawn
鮭魚炒飯|Japanese salmon fried rice|Nasi goreng salmon Jepang|salmon|rice|japanese|rice,egg,pea,scallion
日式粟米忌廉湯|Japanese creamy corn soup|Sup krim jagung Jepang|corn|soup|herb|milk,cream,butter,onion
`),
  ...parseRows("korean", `
韓式牛肉拌飯|Korean beef bibimbap|Bibimbap sapi Korea|beefFlank|rice|korean|rice,egg,spinach,carrot,mushroom
韓式烤雞|Korean glazed chicken|Ayam saus Korea|chickenThigh|grill|korean|cabbage
泡菜風味豆腐鍋|Mild kimchi-style tofu pot|Sup tahu rasa kimchi ringan|softTofu|stew|korean|cabbage,mushroom,egg
韓式炒粉絲|Korean vegetable glass noodles|Japchae sayuran Korea|mushroom|noodle|japanese|noodle,spinach,carrot,bellPepper
韓式牛肉餅|Korean beef patties|Patty sapi Korea|beefMince|panFry|korean|onion,scallion
韓式辣醬豬肉|Mild gochujang pork|Babi gochujang pedas ringan|porkLoin|stirFry|korean|onion,cabbage
醬油蒜香雞翼|Korean soy garlic chicken wings|Sayap ayam kecap bawang Korea|chickenWing|roast|japanese|garlic,honey
韓式薯仔排骨|Korean potato rib stew|Semur iga kentang Korea|ribs|stew|korean|potato,carrot
韓式海鮮豆腐湯|Mild Korean seafood tofu soup|Sup tahu seafood Korea pedas ringan|prawn|soup|korean|softTofu,squid,egg
韓式粟米芝士|Korean corn cheese|Jagung keju Korea|corn|bake|italianCream|cheese
韓式椰菜煎餅|Korean cabbage pancake|Panekuk kol Korea|cabbage|panFry|korean|egg,flour,scallion
韓式燜牛肋風味牛腩|Korean-style braised beef brisket|Sandung lamur sapi semur Korea|beefBrisket|braise|japanese|carrot,mushroom
辣醬炒魷魚|Mild gochujang squid stir-fry|Tumis cumi gochujang ringan|squid|stirFry|korean|onion,bellPepper
紫菜風味蛋花湯|Korean-style egg ribbon soup|Sup telur ala Korea|egg|soup|broth|spinach,scallion
韓式炸醬麵家庭版|Family Korean black-bean noodles|Mi saus kacang hitam Korea rumahan|porkMince|noodle|blackBean|noodle,onion,cabbage
韓式蜜糖三文魚|Korean honey soy salmon|Salmon madu kecap Korea|salmon|roast|japanese|honey,broccoli
辣拌青瓜|Mild Korean cucumber salad|Salad mentimun Korea pedas ringan|cucumber|salad|korean|lime,scallion
韓式炒年糕風味薯仔|Korean rice-cake style potato stir-fry|Tumis kentang rasa tteokbokki|potato|stirFry|korean|cabbage,scallion
韓式雜菜豆腐煲|Korean vegetable tofu pot|Tahu sayuran Korea dalam panci|firmTofu|stew|korean|cabbage,mushroom,spinach
泡菜風味炒飯|Mild kimchi-style egg fried rice|Nasi goreng telur rasa kimchi ringan|egg|rice|korean|rice,cabbage,pea,scallion
`),
  ...parseRows("thai", `
泰式金不換肉碎|Thai basil minced pork|Babi cincang kemangi Thailand|porkMince|stirFry|thaiBasil|bellPepper,egg
泰式青咖喱雞|Thai green curry chicken|Kari hijau ayam Thailand|chickenThigh|curry|thaiCurry|eggplant
泰式紅咖喱豆腐|Thai red curry tofu|Kari merah tahu Thailand|firmTofu|curry|thaiCurry|pumpkin,bellPepper
冬陰功蝦湯少辣版|Mild tom yum prawn soup|Tom yum udang pedas ringan|prawn|soup|thaiLime|mushroom,tomato
泰式青檸蒸魚|Thai lime steamed fish|Ikan kukus jeruk nipis Thailand|wholeFish|steam|thaiLime|garlic
菠蘿雞肉炒飯|Thai pineapple chicken fried rice|Nasi goreng nanas ayam Thailand|chickenThigh|rice|thaiBasil|rice,pineapple,egg,pea
泰式炒河風味麵|Family-style pad Thai noodles|Mi pad Thai rumahan|prawn|noodle|thaiLime|noodle,egg,beanSprout,scallion
泰式香茅雞翼|Thai lemongrass chicken wings|Sayap ayam serai Thailand|chickenWing|roast|thaiLime|honey
泰式生菜包|Thai minced chicken lettuce cups|Ayam cincang bungkus selada Thailand|chickenBreast|stirFry|thaiBasil|carrot,corn
泰式咖喱炒魷魚|Thai curry squid|Cumi kari Thailand|squid|stirFry|thaiCurry|egg,onion,celery
泰式甜辣魚柳|Thai sweet chilli-style fish|Ikan saus manis pedas Thailand|fishFillet|panFry|sweetSour|lime,coriander
泰式椰奶南瓜湯|Thai coconut pumpkin soup|Sup labu santan Thailand|pumpkin|soup|thaiCurry|stock
泰北咖喱雞麵|Northern Thai curry chicken noodles|Mi kari ayam Thailand Utara|chickenThigh|noodle|thaiCurry|noodle,cabbage,lime
泰式青木瓜風甘筍沙律|Thai carrot som tam-style salad|Salad wortel ala som tam|carrot|salad|thaiLime|beanSprout
泰式蝦醬風炒飯|Thai savoury prawn fried rice|Nasi goreng udang gurih Thailand|prawn|rice|thaiBasil|rice,egg,corn
泰式羅勒茄子|Thai basil eggplant|Terong kemangi Thailand|eggplant|stirFry|thaiBasil|firmTofu
泰式椰奶魚柳|Thai coconut fish curry|Kari ikan santan Thailand|fishFillet|curry|thaiCurry|tomato,bellPepper
泰式蒜香豬頸肉風豬柳|Thai garlic pork loin|Daging has babi bawang Thailand|porkLoin|grill|thaiLime|garlic,honey
泰式酸辣粉絲沙律|Mild Thai glass noodle salad|Salad bihun Thailand pedas ringan|prawn|salad|thaiLime|noodle,cucumber,tomato
芒果風菠蘿糯米飯|Pineapple coconut sticky-rice style dessert|Hidangan nasi ketan kelapa nanas|pineapple|rice|thaiLime|rice,coconutMilk,sugar
`),
  ...parseRows("indonesian", `
印尼甜豉油雞|Ayam kecap-style sweet soy chicken|Ayam kecap rumahan|chickenThigh|braise|sambal|lightSoy,honey
仁當牛肉家庭版|Family-style beef rendang|Rendang sapi rumahan|beefBrisket|stew|rendang|potato
印尼沙嗲雞|Indonesian chicken satay|Sate ayam Indonesia|chickenThigh|grill|satay|cucumber
印尼炒飯|Nasi goreng with chicken and egg|Nasi goreng ayam dan telur|chickenThigh|rice|sambal|rice,egg,carrot,cabbage
印尼炒麵|Mie goreng with vegetables|Mi goreng sayuran|egg|noodle|sambal|noodle,cabbage,carrot,beanSprout
巴東風椰奶雞|Padang-style coconut chicken|Ayam santan ala Padang|chickenThigh|curry|rendang|potato
印尼黃薑魚|Indonesian turmeric fish|Ikan kunyit Indonesia|fishFillet|panFry|coconutIndian|lime
叁巴蝦|Sambal prawns|Udang sambal|prawn|stirFry|sambal|tomato,bellPepper
印尼椰菜豆腐煲|Indonesian cabbage tofu stew|Semur tahu kol Indonesia|firmTofu|stew|coconutIndian|cabbage,carrot
加多加多暖沙律|Gado-gado warm vegetable salad|Gado-gado sayuran hangat|firmTofu|salad|satay|egg,potato,beanSprout,cabbage
印尼薑黃雞湯|Soto ayam-style turmeric soup|Soto ayam kunyit|chickenBreast|soup|coconutIndian|cabbage,beanSprout,egg
巴厘香料豬肉|Balinese-style spiced pork|Babi berbumbu ala Bali|porkLoin|stirFry|rendang|bellPepper
印尼豆豉風煎豆腐|Indonesian sweet soy tofu|Tahu kecap manis Indonesia|firmTofu|panFry|sambal|beanSprout,scallion
印尼椰香南瓜|Indonesian coconut pumpkin|Labu santan Indonesia|pumpkin|stew|coconutIndian|spinach
爪哇甜醬牛肉|Javanese sweet soy beef|Sapi kecap manis Jawa|beefFlank|braise|sambal|onion,potato
印尼香茅烤魚|Indonesian lemongrass grilled fish|Ikan bakar serai Indonesia|wholeFish|grill|sambal|lemongrass,lime
印尼雞肉粥|Bubur ayam-style chicken congee|Bubur ayam rumahan|chickenBreast|congee|broth|rice,egg,scallion
印尼蔬菜椰奶湯|Sayur lodeh-style vegetable soup|Sayur lodeh rumahan|firmTofu|soup|coconutIndian|cabbage,eggplant,carrot
印尼薯仔牛肉餅|Indonesian potato beef patties|Perkedel kentang sapi|beefMince|panFry|sambal|potato,egg,scallion
印尼蜜糖炸雞|Indonesian honey fried chicken|Ayam goreng madu Indonesia|chickenThigh|deepFry|sambal|honey,cornstarch
`),
  ...parseRows("southeastAsia", `
海南雞飯家庭版|Family-style Hainanese chicken rice|Nasi ayam Hainan rumahan|chickenThigh|rice|cantonese|rice,cucumber,ginger
新加坡咖喱魚|Singapore curry fish|Kari ikan Singapura|fishFillet|curry|thaiCurry|eggplant,tomato
星洲炒米風味麵|Singapore-style curry noodles|Mi kari ala Singapura|prawn|noodle|curryHK|noodle,egg,beanSprout,bellPepper
馬來咖喱雞|Malaysian chicken curry|Kari ayam Malaysia|chickenThigh|curry|rendang|potato
叻沙豆腐麵|Tofu laksa noodles|Mi laksa tahu|firmTofu|noodle|thaiCurry|noodle,beanSprout,egg
越式香茅豬扒|Vietnamese lemongrass pork|Babi serai Vietnam|porkLoin|grill|thaiLime|honey,cucumber
越式牛肉湯河風味麵|Vietnamese-style beef noodle soup|Sup mi sapi ala Vietnam|beefFlank|noodle|broth|noodle,beanSprout,coriander
越式焦糖雞|Vietnamese caramel chicken|Ayam karamel Vietnam|chickenThigh|braise|thaiLime|sugar,lightSoy
越式青檸魚露雞翼|Vietnamese lime fish-sauce wings|Sayap ayam saus ikan jeruk Vietnam|chickenWing|roast|thaiLime|honey
馬來叁巴魚|Malaysian sambal fish|Ikan sambal Malaysia|fishFillet|panFry|sambal|tomato,onion
馬來椰漿飯配烤雞|Malaysian coconut rice with grilled chicken|Nasi lemak dengan ayam bakar|chickenThigh|rice|satay|rice,coconutMilk,cucumber,egg
新加坡黑椒蝦|Singapore black pepper prawns|Udang lada hitam Singapura|prawn|stirFry|pepper|garlic,scallion
越式番茄魚|Vietnamese tomato fish|Ikan tomat Vietnam|fishFillet|braise|tomato|fishSauce,coriander
緬甸風咖喱蛋|Burmese-style egg curry|Kari telur ala Myanmar|egg|curry|coconutIndian|tomato,potato
菲律賓醋香雞|Filipino chicken adobo|Adobo ayam Filipina|chickenThigh|braise|soyBraise|vinegar,garlic
菲律賓番茄牛肉|Filipino tomato beef stew|Semur sapi tomat Filipina|beefBrisket|stew|tomato|potato,carrot
柬式香茅魚|Cambodian-style lemongrass fish|Ikan serai ala Kamboja|fishFillet|steam|thaiLime|coconutMilk
越式素米紙卷風沙律|Vietnamese rice-paper roll salad|Salad ala lumpia Vietnam|firmTofu|salad|thaiLime|noodle,cucumber,carrot,beanSprout
馬來薑黃椰菜花|Malaysian turmeric cauliflower|Kembang kol kunyit Malaysia|cauliflower|stirFry|coconutIndian|bellPepper
新加坡粟米雞湯|Singapore chicken corn soup|Sup ayam jagung Singapura|chickenBreast|soup|broth|corn,egg,cornstarch
`),
  ...parseRows("italian", `
番茄肉醬意粉|Spaghetti bolognese|Spageti bolognese|beefMince|noodle|italianTomato|pasta,carrot,celery,cheese
卡邦尼意粉家庭版|Family-style carbonara|Carbonara rumahan|egg|noodle|italianCream|pasta,mushroom,cheese
香草番茄雞|Italian herb tomato chicken|Ayam tomat herba Italia|chickenThigh|braise|italianTomato|bellPepper
檸檬牛油三文魚|Lemon butter salmon|Salmon mentega lemon|salmon|panFry|lemonButter|broccoli
蘑菇忌廉意粉|Creamy mushroom pasta|Pasta krim jamur|mushroom|noodle|italianCream|pasta,spinach
焗芝士茄子|Baked cheesy eggplant|Terong panggang keju|eggplant|bake|italianTomato|cheese,breadcrumb
意式肉丸番茄汁|Italian meatballs in tomato sauce|Bakso Italia saus tomat|beefMince|braise|italianTomato|breadcrumb,egg,cheese
香蒜蝦意粉|Garlic prawn pasta|Pasta udang bawang putih|prawn|noodle|lemonButter|pasta,tomato
意式燉雜菜|Italian vegetable stew|Semur sayuran Italia|chickpea|stew|italianTomato|eggplant,bellPepper,cabbage
菠菜芝士焗雞|Spinach cheese baked chicken|Ayam panggang bayam keju|chickenBreast|bake|italianCream|spinach,cheese
意式番茄魚湯|Italian tomato fish soup|Sup ikan tomat Italia|fishFillet|soup|italianTomato|clam,celery
香草烤薯仔雞|Herb roast chicken with potatoes|Ayam panggang herba dengan kentang|chickenThigh|roast|herb|potato,carrot
意式番茄焗飯|Italian tomato baked rice|Nasi panggang tomat Italia|rice|bake|italianTomato|mushroom,cheese,spinach
南瓜忌廉意粉|Creamy pumpkin pasta|Pasta krim labu|pumpkin|noodle|italianCream|pasta,spinach
香草豬柳|Italian herb pork loin|Daging has babi herba Italia|porkLoin|panFry|herb|bellPepper
番茄蜆肉意粉|Tomato clam pasta|Pasta kerang tomat|clam|noodle|italianTomato|pasta,parsley
意式烤椰菜花|Italian roasted cauliflower|Kembang kol panggang Italia|cauliflower|roast|herb|cheese,breadcrumb
芝士番茄奄列|Italian tomato cheese omelette|Telur dadar tomat keju Italia|egg|panFry|herb|tomato,cheese,spinach
香蒜白酒風魚柳|Garlic herb fish fillet|Fillet ikan bawang herba|fishFillet|panFry|lemonButter|tomato
意式扁豆湯|Italian lentil soup|Sup lentil Italia|lentil|soup|italianTomato|carrot,celery,spinach
`),
  ...parseRows("western", `
香草焗雞扒|Herb baked chicken steak|Steak ayam panggang herba|chickenThigh|bake|herb|potato,carrot
蘑菇汁牛肉漢堡扒|Beef hamburger steak with mushroom gravy|Steak burger sapi saus jamur|beefMince|panFry|herb|mushroom,onion
蜜糖芥末風三文魚|Honey glazed salmon|Salmon panggang madu|salmon|roast|lemonButter|honey,broccoli
英式茄汁焗豆風鷹嘴豆|British-style tomato chickpeas|Kacang arab tomat ala Inggris|chickpea|stew|tomato|egg
薯蓉焗肉批|Cottage pie with mashed potato|Pai daging kentang tumbuk|beefMince|bake|herb|potato,carrot,pea
忌廉蘑菇雞|Creamy mushroom chicken|Ayam krim jamur|chickenBreast|braise|italianCream|mushroom,spinach
檸檬香草魚柳|Lemon herb fish fillet|Fillet ikan lemon herba|fishFillet|panFry|lemonButter|broccoli
脆焗豬扒|Crispy baked pork chops|Daging babi panggang renyah|porkLoin|bake|herb|breadcrumb,egg,cabbage
西式牛肉雜菜湯|Western beef vegetable soup|Sup sapi sayuran Barat|beefBrisket|soup|herb|potato,carrot,celery,tomato
粟米薯仔濃湯|Corn and potato chowder|Sup kental jagung kentang|corn|soup|italianCream|potato,onion,milk
蜜糖烤雞翼|Honey roast chicken wings|Sayap ayam panggang madu|chickenWing|roast|herb|honey,lemon
蒜香牛油蝦|Garlic butter prawns|Udang mentega bawang putih|prawn|panFry|lemonButter|parsley
番茄芝士焗椰菜花|Tomato cheese cauliflower bake|Kembang kol panggang tomat keju|cauliflower|bake|italianTomato|cheese,breadcrumb
香草羊肉薯仔鍋|Herb lamb and potato stew|Semur domba kentang herba|lamb|stew|herb|potato,carrot
西式吞拿魚風三文魚薯餅|Salmon potato fishcakes|Perkedel salmon kentang|salmon|panFry|lemonButter|potato,egg,breadcrumb
牛油蘑菇奄列|Butter mushroom omelette|Telur dadar jamur mentega|egg|panFry|italianCream|mushroom,spinach
烤肉汁風燜排骨|Home-style barbecue ribs|Iga barbekyu rumahan|ribs|roast|tomato|honey,paprika
薯仔西蘭花芝士焗|Potato broccoli cheese bake|Kentang brokoli panggang keju|potato|bake|italianCream|broccoli,cheese,breadcrumb
香草番茄白豆風鷹嘴豆|Herb tomato chickpea casserole|Kaserol kacang arab tomat herba|chickpea|stew|italianTomato|spinach,mushroom
雞肉蘑菇批風焗飯|Chicken mushroom pie-style rice bake|Nasi panggang rasa pai ayam jamur|chickenBreast|bake|italianCream|mushroom,rice,pea
`),
  ...parseRows("mediterranean", `
希臘檸檬雞|Greek lemon chicken|Ayam lemon Yunani|chickenThigh|roast|mediterranean|potato
地中海香草魚|Mediterranean herb fish|Ikan herba Mediterania|wholeFish|roast|mediterranean|tomato,bellPepper
摩洛哥鷹嘴豆燉菜|Moroccan chickpea stew|Semur kacang arab Maroko|chickpea|stew|mediterranean|pumpkin,carrot
土耳其風牛肉丸|Turkish-style beef meatballs|Bakso sapi ala Turki|beefMince|panFry|mediterranean|breadcrumb,egg
番茄燴茄子|Mediterranean tomato eggplant|Terong tomat Mediterania|eggplant|braise|mediterranean|chickpea
香料烤椰菜花|Middle Eastern spiced cauliflower|Kembang kol berbumbu Timur Tengah|cauliflower|roast|mediterranean|chickpea
希臘菠菜芝士蛋餅|Greek spinach cheese frittata|Frittata bayam keju Yunani|egg|bake|mediterranean|spinach,cheese
檸檬香草羊肉|Lemon herb lamb|Domba lemon herba|lamb|grill|mediterranean|bellPepper
中東香料雞飯|Middle Eastern spiced chicken rice|Nasi ayam berbumbu Timur Tengah|chickenThigh|rice|mediterranean|rice,carrot
番茄鷹嘴豆蛋鍋|Tomato chickpea egg skillet|Telur dan kacang arab saus tomat|egg|braise|mediterranean|chickpea,spinach
蒜香檸檬蝦|Mediterranean garlic lemon prawns|Udang bawang lemon Mediterania|prawn|panFry|mediterranean|parsley
香料南瓜湯|Middle Eastern pumpkin soup|Sup labu Timur Tengah|pumpkin|soup|mediterranean|stock
地中海烤三文魚|Mediterranean roast salmon|Salmon panggang Mediterania|salmon|roast|mediterranean|tomato,olive
烤甜椒豆腐串|Mediterranean tofu skewers|Sate tahu Mediterania|firmTofu|grill|mediterranean|bellPepper,onion
番茄扁豆燉湯|Tomato lentil stew|Semur lentil tomat|lentil|stew|mediterranean|carrot,spinach
希臘風薯仔沙律|Greek-style potato salad|Salad kentang ala Yunani|potato|salad|mediterranean|cucumber,tomato
摩洛哥香料魚柳|Moroccan spiced fish fillet|Fillet ikan berbumbu Maroko|fishFillet|panFry|mediterranean|coriander
中東烤茄子鷹嘴豆|Roast eggplant and chickpeas|Terong panggang dan kacang arab|eggplant|roast|mediterranean|chickpea,tomato
香草番茄燴雞蛋|Mediterranean tomato baked eggs|Telur panggang tomat Mediterania|egg|bake|mediterranean|tomato,spinach
檸檬孜然雞肉丸|Lemon cumin chicken meatballs|Bakso ayam lemon jintan|chickenBreast|panFry|mediterranean|breadcrumb,egg
`),
  ...parseRows("indian", `
牛油雞家庭版|Family-style butter chicken|Butter chicken rumahan|chickenThigh|curry|indian|butter,cream
印度菠菜芝士|Palak paneer|Palak paneer|paneer|curry|indian|spinach,cream
鷹嘴豆咖喱|Chana masala|Chana masala|chickpea|curry|indian|tomato
紅扁豆咖喱|Red lentil dal|Dal lentil merah|lentil|stew|indian|spinach
椰香魚咖喱|Coconut fish curry|Kari ikan santan|fishFillet|curry|coconutIndian|tomato
香料薯仔椰菜花|Aloo gobi|Aloo gobi|potato|stirFry|indian|cauliflower,tomato
印度烤雞家庭版|Family-style tandoori chicken|Ayam tandoori rumahan|chickenThigh|roast|indian|lemon
番茄雞蛋咖喱|Tomato egg curry|Kari telur tomat|egg|curry|indian|tomato,potato
印度香料羊肉|Indian spiced lamb curry|Kari domba berbumbu India|lamb|curry|indian|potato
椰奶南瓜咖喱|Coconut pumpkin curry|Kari labu santan|pumpkin|curry|coconutIndian|chickpea
印度香料蝦|Indian masala prawns|Udang masala India|prawn|stirFry|indian|tomato,bellPepper
菠菜扁豆湯|Spinach lentil soup|Sup lentil bayam|lentil|soup|indian|spinach,tomato
印度香料焗魚|Indian spiced baked fish|Ikan panggang berbumbu India|fishFillet|bake|indian|lemon
豆腐咖喱|Indian tofu curry|Kari tahu India|firmTofu|curry|indian|tomato,spinach
香料椰菜炒蛋|Indian cabbage egg stir-fry|Tumis kol telur India|egg|stirFry|indian|cabbage,pea
番茄薯仔咖喱|Tomato potato curry|Kari kentang tomat|potato|curry|indian|pea
印度雞肉香飯|Easy chicken biryani-style rice|Nasi ayam biryani mudah|chickenThigh|rice|indian|rice,carrot,pea
印度芝士甜椒串|Paneer pepper skewers|Sate paneer paprika|paneer|grill|indian|bellPepper,onion
椰香秋葵咖喱|Coconut okra curry|Kari okra santan|okra|curry|coconutIndian|tomato
印度香料牛肉薯仔|Indian beef and potato curry|Kari sapi kentang India|beefBrisket|curry|indian|potato,tomato
`),
  ...parseRows("vegetarian", `
羅漢齋|Buddha's delight|Tumis sayuran Buddha|firmTofu|braise|cantonese|cabbage,mushroom,carrot,broccoli
素麻婆豆腐|Vegetarian mapo tofu|Tahu mapo vegetarian|softTofu|braise|korean|mushroom,doubanjiang
雞髀菇黑椒扒|Black pepper king oyster mushroom steaks|Steak jamur king oyster lada hitam|kingOyster|panFry|pepper|broccoli
南瓜豆腐咖喱|Pumpkin tofu curry|Kari labu tahu|firmTofu|curry|thaiCurry|pumpkin,spinach
番茄芝士焗飯|Tomato cheese baked rice|Nasi panggang tomat keju|rice|bake|italianTomato|mushroom,spinach,cheese
雜菌豆腐煲|Mixed mushroom tofu pot|Tahu campur jamur dalam panci|firmTofu|braise|cantonese|mushroom,bokChoy
鷹嘴豆素漢堡扒|Chickpea vegetarian patties|Patty vegetarian kacang arab|chickpea|panFry|herb|carrot,egg,breadcrumb
菠菜蘑菇奄列|Spinach mushroom omelette|Telur dadar bayam jamur|egg|panFry|herb|spinach,mushroom,cheese
素咕嚕豆腐|Sweet and sour tofu|Tahu asam manis|firmTofu|deepFry|sweetSour|broccoli
茄子蘑菇肉醬意粉|Eggplant mushroom bolognese|Pasta bolognese terong jamur|eggplant|noodle|italianTomato|mushroom,pasta,cheese
椰菜花素炒飯|Cauliflower vegetable fried rice|Nasi goreng sayuran kembang kol|cauliflower|rice|cantonese|rice,egg,carrot,pea
紅燒雞髀菇|Red-braised king oyster mushrooms|Jamur king oyster semur merah|kingOyster|braise|soyBraise|bokChoy
粟米豆腐羹|Sweet corn tofu soup|Sup jagung tahu|softTofu|soup|broth|corn,egg,cornstarch
香烤南瓜鷹嘴豆|Roast pumpkin and chickpeas|Labu panggang dan kacang arab|pumpkin|roast|mediterranean|chickpea,spinach
照燒豆腐丼|Teriyaki tofu rice bowl|Donburi tahu teriyaki|firmTofu|rice|japanese|rice,broccoli,egg
素印尼炒麵|Vegetarian Indonesian fried noodles|Mi goreng vegetarian Indonesia|firmTofu|noodle|sambal|noodle,cabbage,carrot,beanSprout
薯仔椰菜蛋餅|Potato cabbage frittata|Frittata kentang kol|egg|bake|herb|potato,cabbage,cheese
蒜蓉蒸茄子豆腐|Steamed eggplant and tofu with garlic|Terong dan tahu kukus bawang putih|eggplant|steam|garlic|firmTofu,scallion
泰式羅勒雜菌|Thai basil mixed mushrooms|Jamur campur kemangi Thailand|mushroom|stirFry|thaiBasil|bellPepper,firmTofu
番茄扁豆菠菜鍋|Tomato lentil spinach pot|Lentil bayam tomat dalam panci|lentil|stew|tomato|spinach,chickpea
`),
  ...parseRows("fusion", `
豉油雞肉意粉|Soy sauce chicken pasta|Pasta ayam kecap ala Hong Kong|chickenThigh|noodle|cantonese|pasta,mushroom,scallion
黑椒牛肉炒意粉|Black pepper beef stir-fried pasta|Pasta goreng sapi lada hitam|beefFlank|noodle|pepper|pasta,bellPepper,onion
叉燒風豆腐焗飯|Char siu-style tofu baked rice|Nasi panggang tahu rasa char siu|firmTofu|bake|cantonese|charSiu,rice,cheese,broccoli
咖喱三文魚焗飯|Curry salmon baked rice|Nasi panggang kari salmon|salmon|bake|curryHK|rice,broccoli,cheese
薑蔥雞扒漢堡碟|Ginger spring onion chicken steak|Steak ayam jahe daun bawang|chickenThigh|panFry|cantonese|potato,cabbage
港式番茄肉丸|Hong Kong tomato beef meatballs|Bakso sapi tomat Hong Kong|beefMince|braise|tomato|egg,breadcrumb
沙嗲雜菌炒麵|Satay mushroom fried noodles|Mi goreng jamur satay|mushroom|noodle|satay|noodle,cabbage,beanSprout
味噌粟米雞湯|Miso corn chicken soup|Sup ayam jagung miso|chickenBreast|soup|miso|corn,egg
香茅豬扒炒飯|Lemongrass pork fried rice|Nasi goreng babi serai|porkLoin|rice|thaiLime|rice,egg,pea
麻婆豆腐意粉|Mild mapo tofu pasta|Pasta tahu mapo pedas ringan|softTofu|noodle|korean|pasta,mushroom,doubanjiang
照燒雞肉炒麵|Teriyaki chicken fried noodles|Mi goreng ayam teriyaki|chickenThigh|noodle|japanese|noodle,cabbage,carrot
泰式咖喱焗椰菜花|Thai curry cauliflower bake|Kembang kol panggang kari Thailand|cauliflower|bake|thaiCurry|cheese,breadcrumb
叁巴蝦炒意粉|Sambal prawn pasta|Pasta udang sambal|prawn|noodle|sambal|pasta,tomato
咕嚕豆腐飯碗|Sweet and sour tofu rice bowl|Mangkuk nasi tahu asam manis|firmTofu|rice|sweetSour|rice,broccoli
黑椒雞髀菇焗薯|Black pepper mushroom baked potatoes|Kentang panggang jamur lada hitam|kingOyster|bake|pepper|potato,cheese
港式咖喱鷹嘴豆|Hong Kong curry chickpeas|Kari kacang arab Hong Kong|chickpea|curry|curryHK|potato,carrot
蒜香牛油魚柳炒飯|Garlic butter fish fried rice|Nasi goreng ikan mentega bawang|fishFillet|rice|lemonButter|rice,egg,pea
韓式辣醬肉丸焗飯|Mild gochujang meatball rice bake|Nasi panggang bakso gochujang ringan|beefMince|bake|korean|rice,egg,breadcrumb,cheese
印尼甜醬豆腐意粉|Indonesian sweet soy tofu pasta|Pasta tahu kecap manis Indonesia|firmTofu|noodle|sambal|pasta,bellPepper
羅勒番茄雞肉飯|Basil tomato chicken rice|Nasi ayam tomat kemangi|chickenBreast|rice|italianTomato|rice,basil,spinach
`),
];

// Keep the catalogue at 300 entries while expanding the practical baked-rice
// selection. These five upgrades join the seven baked-rice dishes already in
// the curated list, giving the first release twelve distinct rice bakes.
const bakedRiceUpgrades = new Map([
  ["Korean corn cheese", {
    title: t("韓式粟米雞肉焗飯", "Korean corn and chicken rice bake", "Nasi panggang ayam jagung Korea"),
    main: "chickenBreast", method: "bake", profile: "korean", extras: ["rice", "corn", "cheese"],
  }],
  ["Baked cheesy eggplant", {
    title: t("番茄芝士茄子焗飯", "Tomato cheese eggplant rice bake", "Nasi panggang terong tomat keju"),
    main: "eggplant", method: "bake", profile: "italianTomato", extras: ["rice", "cheese", "spinach"],
  }],
  ["Spinach cheese baked chicken", {
    title: t("忌廉菠菜雞肉焗飯", "Creamy spinach chicken rice bake", "Nasi panggang ayam bayam krim"),
    main: "chickenBreast", method: "bake", profile: "italianCream", extras: ["rice", "spinach", "cheese"],
  }],
  ["Potato broccoli cheese bake", {
    title: t("西蘭花雜菌芝士焗飯", "Broccoli mushroom cheese rice bake", "Nasi panggang brokoli jamur keju"),
    main: "mushroom", method: "bake", profile: "italianCream", extras: ["rice", "broccoli", "cheese"],
  }],
  ["Thai curry cauliflower bake", {
    title: t("泰式咖喱雞肉焗飯", "Thai curry chicken rice bake", "Nasi panggang kari ayam Thailand"),
    main: "chickenThigh", method: "bake", profile: "thaiCurry", extras: ["rice", "cauliflower", "cheese"],
  }],
]);

for (const spec of catalogue) {
  const upgrade = bakedRiceUpgrades.get(spec.title.en);
  if (upgrade) Object.assign(spec, upgrade);
}

const signatureIngredientUpgrades = new Map([
  ["Luncheon-style vegetarian ham egg fried rice", { add: ["vegetarianHam"] }],
  ["Hairy gourd and vermicelli claypot", { add: ["hairyGourd"] }],
  ["Century egg and lean pork congee", { add: ["centuryEgg"] }],
  ["Steamed pork patty with preserved-vegetable flavour", { add: ["preservedMustard"] }],
  ["Crisp preserved-radish omelette", { add: ["preservedRadish"] }],
  ["Red-fermented-beancurd style vegetable braise", { add: ["redFermentedBeanCurd"] }],
  ["Lamb and tofu-skin style winter pot", { add: ["tofuSkin"] }],
  ["Steamed beef patty with citrus aroma", { add: ["driedTangerinePeel"] }],
  ["Spinach with two-egg broth", { add: ["centuryEgg", "saltedEgg"] }],
  ["Chive-style egg pancake", { add: ["chive"] }],
  ["Mild kung pao chicken", { add: ["peanut", "sichuanPepper"] }],
  ["Sichuan pepper-style shredded chicken", { add: ["sichuanPepper"] }],
  ["Japanese beef curry", { add: ["japaneseCurryRoux"] }],
  ["Japanese tofu hamburger steak", { add: ["breadcrumb"] }],
  ["Thai minced chicken lettuce cups", { add: ["lettuce"] }],
  ["Pineapple coconut sticky-rice style dessert", {
    add: ["glutinousRice"],
    remove: ["rice", "lemongrass", "lime", "fishSauce", "coriander", "shallot"],
  }],
  ["Indonesian chicken satay", { add: ["peanut"] }],
  ["Gado-gado warm vegetable salad", { add: ["peanut"] }],
  ["Butter mushroom omelette", { add: ["butter"] }],
]);

for (const spec of catalogue) {
  const upgrade = signatureIngredientUpgrades.get(spec.title.en);
  if (!upgrade) continue;
  spec.extras = [...new Set([...spec.extras, ...(upgrade.add || [])])]
    .filter((key) => !(upgrade.remove || []).includes(key));
  spec.excludeKeys = [...new Set(upgrade.remove || [])];
}

const timing = {
  stirFry: [15, 12], steam: [15, 18], braise: [18, 35], soup: [15, 35],
  roast: [15, 35], bake: [20, 35], panFry: [15, 18], deepFry: [20, 20],
  curry: [18, 30], noodle: [18, 18], rice: [20, 25], salad: [20, 12],
  stew: [20, 50], grill: [20, 25], congee: [15, 55],
};

const EQUIPMENT = {
  pan: { name: t("煎 Pan／平底鑊", "frying pan", "wajan datar"), type: "pan" },
  wok: { name: t("中式鑊", "Chinese wok", "wajan Tiongkok"), type: "wok" },
  mx2: { name: t("Toshiba MX2-TT20SC 3合1微波蒸焗爐", "Toshiba MX2-TT20SC 3-in-1 microwave steam oven", "Oven microwave-uap-panggang 3-in-1 Toshiba MX2-TT20SC"), type: "mx2" },
  tray: { name: t("MX2 原裝烤盤", "MX2 supplied baking tray", "loyang bawaan MX2"), type: "accessory" },
  steamRack: { name: t("MX2 蒸烤架", "MX2 steaming rack", "rak kukus-panggang MX2"), type: "accessory" },
  ceramicDish: { name: t("耐熱陶瓷器皿", "heatproof ceramic dish", "wadah keramik tahan panas"), type: "accessory" },
  microwaveDish: { name: t("微波安全陶瓷碟", "microwave-safe ceramic dish", "piring keramik aman microwave"), type: "accessory" },
};

const wokMethods = new Set(["stirFry", "braise", "soup", "deepFry", "curry", "noodle", "rice", "stew", "congee"]);
const ovenMethods = new Set(["steam", "roast", "bake", "grill"]);
const isRiceBakeSpec = (spec) => spec.method === "bake" && (
  spec.main === "rice" || spec.extras.includes("rice") || /焗飯|rice bake|baked rice/i.test(spec.title.en)
);
const minceKeys = new Set(["porkMince", "beefMince", "plantMince"]);
const poultryKeys = new Set(["chickenThigh", "chickenBreast", "chickenWing", "duck"]);
const fishKeys = new Set(["fishFillet", "wholeFish", "salmon"]);
const shellfishKeys = new Set(["prawn", "squid"]);
const dryOrLiquidKeys = new Set([
  "rice", "glutinousRice", "noodle", "pasta", "egg", "chickpea", "lentil", "paneer",
  "coconutMilk", "stock", "milk", "cream", "butter", "cheese", "flour",
  "breadcrumb", "cornstarch", "oil", "oliveOil", "lightSoy", "darkSoy",
  "oysterSauce", "vegOyster", "sesameOil", "fishSauce", "tomatoPaste",
  "cannedTomato", "blackBean", "hoisin", "charSiu", "doubanjiang",
  "gochujang", "miso", "curryPaste", "curryPowder", "sambal", "paprika",
  "cumin", "turmeric", "garamMasala", "italianHerb", "sugar", "vinegar",
  "honey", "salt", "pepper", "blackPepper",
  "redFermentedBeanCurd", "driedTangerinePeel", "sichuanPepper", "japaneseCurryRoux",
]);
const freshProduceKeys = new Set([
  "eggplant", "cauliflower", "cabbage", "broccoli", "pumpkin", "potato",
  "tomato", "okra", "garlic", "ginger", "scallion", "onion", "shallot",
  "carrot", "bellPepper", "celery", "corn", "pea", "spinach", "bokChoy",
  "beanSprout", "cucumber", "pineapple", "lemon", "lime", "basil",
  "coriander", "parsley", "olive", "lemongrass", "mushroom", "kingOyster",
  "hairyGourd", "lettuce", "chive", "preservedRadish", "preservedMustard",
]);
const aromaticKeys = new Set(["garlic", "ginger", "scallion", "onion", "shallot", "lemongrass"]);
const stapleKeys = new Set(["rice", "glutinousRice", "noodle", "pasta"]);
const liquidKeys = new Set(["stock", "coconutMilk", "cannedTomato", "milk", "cream"]);
const dairyKeys = new Set(["butter", "cheese"]);
const fatKeys = new Set(["oil", "oliveOil"]);
const toppingKeys = new Set(["peanut"]);
const binderKeys = new Set(["flour", "breadcrumb", "cornstarch"]);
const sauceKeys = new Set([
  "lightSoy", "darkSoy", "oysterSauce", "vegOyster", "sesameOil", "fishSauce",
  "tomatoPaste", "blackBean", "hoisin", "charSiu", "doubanjiang", "gochujang",
  "miso", "curryPaste", "sambal", "vinegar", "honey",
  "redFermentedBeanCurd", "japaneseCurryRoux",
]);
const spiceKeys = new Set([
  "curryPowder", "paprika", "cumin", "turmeric", "garamMasala",
  "italianHerb", "sugar", "pepper", "blackPepper", "salt",
  "sichuanPepper", "driedTangerinePeel",
]);
const shapeDish = (spec) => /patty|patties|meatball|meatballs|burger|肉餅|肉丸|漢堡|薯餅/i.test(
  `${spec.title.zh} ${spec.title.en} ${spec.title.id}`
);
const omeletteDish = (spec) => /omelette|omelet|frittata|奄列|煎蛋|蛋餅|炒蛋/i.test(
  `${spec.title.zh} ${spec.title.en}`
);
const beatenEggDish = (spec) => ["stirFry", "panFry", "rice", "soup", "steam", "noodle"].includes(spec.method) || omeletteDish(spec);
const carbonaraDish = (spec) => /carbonara|卡邦尼/i.test(`${spec.title.zh} ${spec.title.en}`);

function freshExtras(spec) {
  return spec.extras.filter((key) => freshProduceKeys.has(key));
}

function freshExtraNames(spec) {
  const rows = freshExtras(spec).map((key) => I[key] || P[key]).filter(Boolean);
  return rows.length
    ? t(
        rows.map((row) => row[0]).join("、"),
        rows.map((row) => row[1]).join(", "),
        rows.map((row) => row[2]).join(", "),
      )
    : t("如有的新鮮配菜", "any fresh vegetables used", "sayuran segar yang digunakan");
}

function namesForKeys(keys, fallback = t("其餘材料", "the remaining ingredients", "bahan lainnya")) {
  const rows = keys.map((key) => I[key] || P[key]).filter(Boolean);
  return rows.length
    ? t(
        rows.map((row) => row[0]).join("、"),
        rows.map((row) => row[1]).join(", "),
        rows.map((row) => row[2]).join(", "),
      )
    : fallback;
}

function keysForSpec(spec) {
  const excluded = new Set(spec.excludeKeys || []);
  return [...new Set([spec.main, ...(profiles[spec.profile] || []), ...spec.extras, "oil", "salt"])]
    .filter((key) => !excluded.has(key));
}

function ingredientPlan(spec) {
  const keys = keysForSpec(spec);
  const exceptMain = keys.filter((key) => key !== spec.main);
  return {
    keys,
    aromatics: exceptMain.filter((key) => aromaticKeys.has(key)),
    produce: exceptMain.filter((key) => freshProduceKeys.has(key) && !aromaticKeys.has(key)),
    staples: exceptMain.filter((key) => stapleKeys.has(key)),
    liquids: exceptMain.filter((key) => liquidKeys.has(key)),
    dairy: exceptMain.filter((key) => dairyKeys.has(key)),
    fats: keys.filter((key) => fatKeys.has(key)),
    toppings: exceptMain.filter((key) => toppingKeys.has(key)),
    binders: exceptMain.filter((key) => binderKeys.has(key)),
    sauces: exceptMain.filter((key) => sauceKeys.has(key)),
    spices: exceptMain.filter((key) => spiceKeys.has(key)),
    secondaryProteins: exceptMain.filter((key) =>
      minceKeys.has(key) || poultryKeys.has(key) || fishKeys.has(key) ||
      shellfishKeys.has(key) || key === "clam" || key === "egg" ||
      ["firmTofu", "softTofu", "paneer", "chickpea", "lentil"].includes(key)
      || ["vegetarianHam", "centuryEgg", "saltedEgg", "tofuSkin"].includes(key)
    ),
  };
}

function exactIngredientUseText(spec) {
  const plan = ingredientPlan(spec);
  const hasCornstarch = plan.binders.includes("cornstarch");
  const seasoning = namesForKeys([...plan.sauces, ...plan.spices], t("", "", ""));
  const liquids = namesForKeys(plan.liquids, t("", "", ""));
  const binders = namesForKeys(plan.binders, t("", "", ""));
  const dairy = namesForKeys(plan.dairy, t("", "", ""));
  const staples = namesForKeys(plan.staples, t("", "", ""));
  const aromatics = namesForKeys(plan.aromatics, t("", "", ""));
  const produce = namesForKeys(plan.produce, t("", "", ""));
  const fats = namesForKeys(plan.fats, t("", "", ""));
  const secondaryProteins = namesForKeys(plan.secondaryProteins, t("", "", ""));
  const toppings = namesForKeys(plan.toppings, t("", "", ""));
  const clauses = { zh: [], en: [], id: [] };

  if (seasoning.en) {
    clauses.zh.push(`把${seasoning.zh}按食材表份量拌成此菜的調味汁`);
    clauses.en.push(`combine the listed amounts of ${seasoning.en} to make this dish's seasoning`);
    clauses.id.push(`campur ${seasoning.id} sesuai takaran untuk membuat bumbu hidangan ini`);
  }
  if (aromatics.en) {
    clauses.zh.push(`把${aromatics.zh}切好，烹調主料前先炒至軟及有香味`);
    clauses.en.push(`cut ${aromatics.en} and sauté them until softened and fragrant before cooking the main ingredient`);
    clauses.id.push(`potong ${aromatics.id} dan tumis sampai lunak serta harum sebelum memasak bahan utama`);
  }
  if (produce.en) {
    clauses.zh.push(`把${produce.zh}在主料前後依熟成速度加入，煮至剛軟而不糊爛`);
    clauses.en.push(`add ${produce.en} around the main ingredient according to cooking time and cook until just tender, not mushy`);
    clauses.id.push(`masukkan ${produce.id} sebelum atau sesudah bahan utama sesuai waktu matang, lalu masak sampai baru lunak dan tidak lembek`);
  }
  if (secondaryProteins.en) {
    clauses.zh.push(`把${secondaryProteins.zh}依稍後步驟加入並煮至相應安全熟度`);
    clauses.en.push(`add ${secondaryProteins.en} at the stated cooking stage and cook each to its safe doneness`);
    clauses.id.push(`masukkan ${secondaryProteins.id} pada tahap yang disebutkan dan masak masing-masing hingga matang aman`);
  }
  if (toppings.en) {
    clauses.zh.push(`把${toppings.zh}用乾鑊烘香，最後加入保持香脆`);
    clauses.en.push(`toast ${toppings.en} in the dry wok and add them at the end so they stay crisp`);
    clauses.id.push(`sangrai ${toppings.id} dalam wajan kering dan masukkan terakhir agar tetap renyah`);
  }
  if (fats.en) {
    clauses.zh.push(`用${fats.zh}預熱鑊及炒香材料`);
    clauses.en.push(`use ${fats.en} to coat the hot pan or wok and sauté the ingredients`);
    clauses.id.push(`gunakan ${fats.id} untuk melapisi wajan panas dan menumis bahan`);
  }
  if (liquids.en) {
    clauses.zh.push(`把${liquids.zh}另行量好，在主料煮香後加入作為煮汁`);
    clauses.en.push(`measure ${liquids.en} separately and add them as the cooking liquid after the main ingredient is seared or sautéed`);
    clauses.id.push(`takar ${liquids.id} secara terpisah dan masukkan sebagai cairan setelah bahan utama ditumis`);
  }
  if (binders.en) {
    const use = shapeDish(spec) ? "黏合肉餅或肉丸" : spec.method === "deepFry" ? "上粉或製作脆衣" : "需要時勾芡或形成外層";
    const useEn = shapeDish(spec) ? "bind the patties or meatballs" : spec.method === "deepFry" ? "coat the food for a crisp crust" : "thicken the sauce or form the coating where instructed";
    const useId = shapeDish(spec) ? "merekatkan patty atau bakso" : spec.method === "deepFry" ? "melapisi makanan agar renyah" : "mengentalkan saus atau membuat lapisan sesuai petunjuk";
    clauses.zh.push(`使用${binders.zh}${use}`);
    clauses.en.push(`use ${binders.en} to ${useEn}`);
    clauses.id.push(`gunakan ${binders.id} untuk ${useId}`);
  }
  if (dairy.en) {
    clauses.zh.push(`把${dairy.zh}留待收汁或焗前加入`);
    clauses.en.push(`reserve ${dairy.en} for finishing the sauce or adding before baking`);
    clauses.id.push(`simpan ${dairy.id} untuk menyelesaikan saus atau ditambahkan sebelum memanggang`);
  }
  if (staples.en) {
    clauses.zh.push(`${staples.zh}依稍後主食步驟煮熟後才與餸料結合`);
    clauses.en.push(`cook ${staples.en} in the dedicated staple step before combining with the topping`);
    clauses.id.push(`masak ${staples.id} pada langkah bahan pokok sebelum dicampur dengan lauk`);
  }

  if (!clauses.en.length) {
    return t(
      `「${spec.title.zh}」沒有額外調味汁；只按食材表量好材料，烹調時逐項加入。`,
      `${spec.title.en} has no separate mixed sauce; measure the listed ingredients and add each at its stated cooking step.`,
      `${spec.title.id} tidak memakai saus campur terpisah; takar bahan dan masukkan satu per satu pada langkah memasak yang disebutkan.`,
    );
  }
  return t(
    `製作「${spec.title.zh}」時，${clauses.zh.join("；")}。`,
    `For ${spec.title.en}, ${clauses.en.join("; ")}.`,
    `Untuk ${spec.title.id}, ${clauses.id.join("; ")}.`,
  );
}

function secondaryPrepText(spec) {
  const keys = [...new Set(spec.extras.filter((key) => !freshProduceKeys.has(key) && !dryOrLiquidKeys.has(key)))];
  const clauses = { zh: [], en: [], id: [] };
  for (const key of keys) {
    const row = I[key] || P[key];
    if (!row) continue;
    const name = t(...row.slice(0, 3));
    if (minceKeys.has(key)) {
      clauses.zh.push(`${name.zh}不用清洗或切粒，保持冷藏並用筷子撥鬆`);
      clauses.en.push(`do not wash or dice ${name.en}; keep it chilled and loosen it with chopsticks`);
      clauses.id.push(`${name.id} tidak perlu dicuci atau dipotong dadu; tetap dinginkan dan uraikan dengan sumpit`);
    } else if (key === "egg") {
      clauses.zh.push("雞蛋不用清洗，逐隻打入小碗檢查蛋殼及新鮮度");
      clauses.en.push("do not wash eggs; crack them one at a time into a small bowl to check for shell and freshness");
      clauses.id.push("telur tidak perlu dicuci; pecahkan satu per satu ke mangkuk kecil untuk memeriksa cangkang dan kesegarannya");
    } else if (key === "clam") {
      clauses.zh.push(`${name.zh}用淡鹽水吐沙、刷殼及沖淨，棄掉破殼或敲後仍張開的蜆`);
      clauses.en.push(`purge ${name.en} in lightly salted water, scrub and rinse the shells, and discard cracked clams or any that stay open when tapped`);
      clauses.id.push(`rendam ${name.id} dalam air garam ringan, sikat dan bilas cangkang, lalu buang kerang retak atau yang tetap terbuka setelah diketuk`);
    } else if (key === "prawn") {
      clauses.zh.push(`${name.zh}挑走蝦腸後抹乾`);
      clauses.en.push(`devein ${name.en} and pat them dry`);
      clauses.id.push(`buang urat ${name.id} lalu keringkan`);
    } else if (key === "squid") {
      clauses.zh.push(`${name.zh}清走內臟和軟骨，沖淨抹乾後切 4 厘米件`);
      clauses.en.push(`clean the innards and quill from ${name.en}, rinse, pat dry and cut into 4 cm pieces`);
      clauses.id.push(`bersihkan isi perut dan tulang lunak ${name.id}, bilas, keringkan, lalu potong 4 cm`);
    } else if (fishKeys.has(key)) {
      clauses.zh.push(`${name.zh}拔走幼骨、抹乾並保持厚件`);
      clauses.en.push(`remove pin bones from ${name.en}, pat dry and keep in thick portions`);
      clauses.id.push(`cabut duri halus ${name.id}, keringkan, dan pertahankan sebagai potongan tebal`);
    } else if (poultryKeys.has(key) || /pork|ribs|beef|lamb/i.test(key)) {
      clauses.zh.push(`${name.zh}不用清洗，用廚紙抹乾後切成均勻件`);
      clauses.en.push(`do not wash ${name.en}; pat dry with kitchen paper and cut into even pieces`);
      clauses.id.push(`${name.id} tidak perlu dicuci; keringkan dengan tisu dapur dan potong sama besar`);
    } else if (["firmTofu", "softTofu"].includes(key)) {
      clauses.zh.push(`${name.zh}瀝走包裝水，以廚紙輕輕印乾並按需要切件，不要沖洗`);
      clauses.en.push(`drain ${name.en}, blot gently with kitchen paper and cut as needed without rinsing`);
      clauses.id.push(`tiriskan ${name.id}, tepuk perlahan dengan tisu dapur dan potong sesuai kebutuhan tanpa dibilas`);
    } else if (key === "chickpea") {
      clauses.zh.push(`${name.zh}只需瀝乾`);
      clauses.en.push(`drain ${name.en}; no cutting is needed`);
      clauses.id.push(`tiriskan ${name.id}; tidak perlu dipotong`);
    } else if (key === "lentil") {
      clauses.zh.push(`${name.zh}放篩內沖淨及瀝乾，不需切`);
      clauses.en.push(`rinse ${name.en} in a sieve and drain; no cutting is needed`);
      clauses.id.push(`bilas ${name.id} dalam saringan dan tiriskan; tidak perlu dipotong`);
    }
  }
  if (!keys.length) return t("", "", "");
  return t(
    `另外，${clauses.zh.join("；")}。`,
    `Also, ${clauses.en.join("; ")}.`,
    `Selain itu, ${clauses.id.join("; ")}.`,
  );
}

function prepMainText(spec, food) {
  const plan = ingredientPlan(spec);
  if (spec.main === "wholeFish") {
    return t(
      `請魚檔把${food.zh}去鱗、去鰓及清理內臟；回家後沖淨魚腔及表面，徹底抹乾，保持原條，在魚身最厚位置兩面各斜切兩刀，不要切斷。`,
      `Ask the fishmonger to scale, gut and remove the gills from ${food.en}. At home, rinse the cavity and surface, pat completely dry, keep the fish whole, and make two shallow diagonal cuts on each side at the thickest part without cutting through.`,
      `Minta penjual ikan membuang sisik, insang, dan isi perut ${food.id}. Di rumah, bilas rongga dan permukaannya, keringkan, biarkan ikan tetap utuh, lalu buat dua sayatan miring dangkal pada tiap sisi bagian paling tebal tanpa memotong hingga putus.`,
    );
  }
  if (spec.main === "clam") {
    return t(
      `把${food.zh}放入淡鹽水浸 20 分鐘吐沙，逐隻刷洗外殼後用流動清水沖淨；烹調前丟棄外殼破裂或敲後仍張開的蜆。`,
      `Soak ${food.en} in lightly salted water for 20 minutes to purge grit. Scrub every shell and rinse under running water; before cooking, discard cracked clams or any that stay open when tapped.`,
      `Rendam ${food.id} dalam air garam ringan 20 menit untuk mengeluarkan pasir. Sikat tiap cangkang dan bilas; sebelum dimasak, buang kerang bercangkang retak atau yang tetap terbuka setelah diketuk.`,
    );
  }
  if (spec.main === "egg") {
    if (spec.method === "curry") {
      return t(
        "雞蛋不用清洗。放入冷水中，水滾後轉小火煮 9 分鐘，立即浸冰水 5 分鐘；輕敲剝殼，保持原隻，在蛋白表面淺𠝹兩刀幫助入味。",
        "Do not wash the eggs. Start them in cold water, then simmer for 9 minutes once boiling. Chill in iced water for 5 minutes, peel, keep whole and make two shallow slashes in the white so the curry can flavour them.",
        "Telur tidak perlu dicuci. Mulai dalam air dingin, lalu rebus perlahan 9 menit setelah mendidih. Dinginkan dalam air es 5 menit, kupas, biarkan utuh, dan buat dua sayatan dangkal pada putih telur agar bumbu kari meresap.",
      );
    }
    return t(
      `雞蛋不用清洗。逐隻打入小碗，確認沒有異味或蛋殼；${beatenEggDish(spec) ? "倒入大碗，用筷子打散至蛋白蛋黃剛混合，不要打入太多空氣。" : "保持蛋黃完整，稍後逐隻加入菜式。"} `,
      `Do not wash the eggs. Crack each one into a small bowl and check that it smells fresh and contains no shell; ${beatenEggDish(spec) ? "transfer to a large bowl and beat just until yolks and whites combine without incorporating too much air." : "keep each yolk intact for adding to the dish later."}`,
      `Telur tidak perlu dicuci. Pecahkan satu per satu ke mangkuk kecil, pastikan segar dan tanpa serpihan cangkang; ${beatenEggDish(spec) ? "pindahkan ke mangkuk besar dan kocok hanya sampai putih serta kuning tercampur tanpa terlalu banyak udara." : "jaga kuning telur tetap utuh untuk dimasukkan satu per satu nanti."}`,
    );
  }
  if (minceKeys.has(spec.main)) {
    if (shapeDish(spec)) {
      const shapeBinders = namesForKeys(
        [...plan.binders, ...(plan.secondaryProteins.includes("egg") ? ["egg"] : [])],
        t("食材表列出的黏合材料", "the listed binding ingredients", "bahan pengikat yang tercantum"),
      );
      return t(
        `免治肉不用清洗、抹乾或切粒。放入乾淨大碗，加入${shapeBinders.zh}及食材表調味後只拌至黏合；雙手沾少許水，分成大小相同的肉餅或肉丸並輕壓實。`,
        `Do not wash, pat dry or dice the mince. Put it in a clean bowl, add ${shapeBinders.en} and the listed seasoning, and mix only until bound. Dampen hands and shape equal-size patties or meatballs, pressing gently so they hold together.`,
        `Daging cincang tidak perlu dicuci, dikeringkan, atau dipotong dadu. Masukkan ke mangkuk bersih, tambahkan ${shapeBinders.id} dan bumbu yang tercantum, lalu aduk hanya sampai menyatu. Basahi tangan dan bentuk patty atau bakso berukuran sama, tekan perlahan agar tidak pecah.`,
      );
    }
    return t(
      `免治肉不用清洗、抹乾或切粒。從雪櫃取出後放入乾淨碗，用筷子輕輕撥鬆；未下鑊前保持冷藏。`,
      `Do not wash, pat dry or dice the mince. Put it in a clean bowl straight from the refrigerator and loosen gently with chopsticks; keep chilled until it goes into the wok.`,
      `Daging cincang tidak perlu dicuci, dikeringkan, atau dipotong dadu. Keluarkan dari kulkas ke mangkuk bersih dan uraikan perlahan dengan sumpit; tetap dinginkan sampai masuk wajan.`,
    );
  }
  if (spec.main === "prawn") {
    return t(
      `沖淨${food.zh}，挑走蝦腸後用廚紙徹底抹乾；保持原隻，大小差異很大才把較大的對半切。`,
      `Rinse ${food.en}, remove the intestinal vein and pat thoroughly dry with kitchen paper. Keep prawns whole, halving only unusually large ones.`,
      `Bilas ${food.id}, buang urat punggung, lalu keringkan dengan tisu dapur. Biarkan utuh; belah dua hanya udang yang sangat besar.`,
    );
  }
  if (spec.main === "squid") {
    return t(
      `清理${food.zh}的內臟、軟骨及外皮，沖淨後抹乾；魚身內側淺𠝹交叉紋，再切成約 4 厘米件，觸鬚保持完整。`,
      `Clean the innards, quill and skin from ${food.en}, rinse and pat dry. Lightly score the inside in a crosshatch, cut into roughly 4 cm pieces and leave tentacles whole.`,
      `Bersihkan isi perut, tulang lunak, dan kulit ${food.id}, bilas lalu keringkan. Sayat sisi dalam dengan pola silang dangkal, potong sekitar 4 cm, dan biarkan tentakel utuh.`,
    );
  }
  if (fishKeys.has(spec.main)) {
    return t(
      `檢查${food.zh}並用鉗拔走幼骨，抹乾表面；按菜式需要保持整塊或切成大小一致的厚件，不要切成細粒。`,
      `Check ${food.en} and remove pin bones with tweezers, then pat the surface dry. Keep as whole portions or cut into evenly sized thick pieces as appropriate; do not dice finely.`,
      `Periksa ${food.id}, cabut duri halus dengan pinset, lalu keringkan permukaannya. Biarkan sebagai potongan utuh atau potong tebal sama besar sesuai hidangan; jangan potong dadu kecil.`,
    );
  }
  if (poultryKeys.has(spec.main) || /pork|ribs|beef|lamb/.test(spec.main)) {
    const keepWhole = /chop|steak|wing|ribs|扒|翼|排/i.test(`${spec.title.zh} ${spec.title.en}`);
    return t(
      `${food.zh}不用清洗；用廚紙抹乾，${keepWhole ? "保持肉扒、雞翼或排骨原件並修走多餘脂肪" : "順紋理切成厚薄一致、約一口大小的件"}。接觸生肉的刀、砧板及碟之後不可接觸熟食。`,
      `Do not wash ${food.en}. Pat dry with kitchen paper and ${keepWhole ? "keep chops, wings or ribs as whole pieces while trimming excess fat" : "cut with the grain into evenly sized bite-size pieces"}. Knives, boards and plates that touched raw meat must not touch cooked food.`,
      `${food.id} tidak perlu dicuci. Keringkan dengan tisu dapur dan ${keepWhole ? "biarkan potongan steak, sayap, atau iga tetap utuh sambil membuang lemak berlebih" : "potong searah serat menjadi ukuran sekali makan yang sama tebal"}. Pisau, talenan, dan piring yang terkena daging mentah tidak boleh menyentuh makanan matang.`,
    );
  }
  if (spec.main === "rice") {
    return t(
      "白米放入篩內用清水輕輕淘洗 2–3 次至水接近清澈，瀝乾；米不用抹乾或切。",
      "Rinse the rice gently in a sieve 2–3 times until the water is nearly clear, then drain; rice is not patted dry or cut.",
      "Cuci beras perlahan dalam saringan 2–3 kali hingga air hampir jernih, lalu tiriskan; beras tidak perlu dikeringkan atau dipotong.",
    );
  }
  if (["firmTofu", "softTofu"].includes(spec.main)) {
    return t(
      `${food.zh}瀝走包裝水，以廚紙輕輕印乾；硬豆腐切成約 3 厘米厚件，滑豆腐用闊鑊鏟切成大件。豆腐不要在水龍頭下沖洗，以免吸水或碎裂。`,
      `Drain the packing liquid from ${food.en} and blot gently with kitchen paper. Cut firm tofu into roughly 3 cm pieces; divide silken tofu into large pieces with a broad spatula. Do not rinse tofu under the tap, which can make it waterlogged or break apart.`,
      `Tiriskan cairan kemasan ${food.id} dan tepuk perlahan dengan tisu dapur. Potong tahu padat sekitar 3 cm; bagi tahu sutra menjadi bagian besar dengan spatula lebar. Jangan bilas tahu di bawah keran karena dapat menyerap air atau hancur.`,
    );
  }
  if (spec.main === "chickpea") {
    return t(
      `${food.zh}倒入篩內瀝乾，再用清水快速沖走罐頭液並瀝乾；保持原粒，不需切。`,
      `Drain ${food.en} in a sieve, briefly rinse off the canning liquid and drain well. Keep the chickpeas whole; no cutting is needed.`,
      `Tiriskan ${food.id} dalam saringan, bilas singkat cairan kalengnya, lalu tiriskan baik-baik. Biarkan utuh; tidak perlu dipotong.`,
    );
  }
  if (spec.main === "lentil") {
    return t(
      `${food.zh}放入密篩，挑走小石或雜物後用清水沖淨及瀝乾；不用浸、抹乾或切。`,
      `Put ${food.en} in a fine sieve, remove any stones or debris, rinse and drain. There is no need to soak, pat dry or cut the lentils.`,
      `Masukkan ${food.id} ke saringan halus, buang batu kecil atau kotoran, bilas dan tiriskan. Tidak perlu direndam, dikeringkan, atau dipotong.`,
    );
  }
  if (spec.main === "paneer") {
    return t(
      `${food.zh}用廚紙印乾表面後切成約 3 厘米方件；不用清洗，切時輕手避免碎裂。`,
      `Blot the surface of ${food.en} with kitchen paper and cut into roughly 3 cm cubes. Do not wash it, and handle gently to prevent crumbling.`,
      `Tepuk permukaan ${food.id} dengan tisu dapur dan potong dadu sekitar 3 cm. Jangan dicuci dan tangani perlahan agar tidak hancur.`,
    );
  }
  return t(
    `${food.zh}按需要沖洗，瀝乾；移除硬蒂、外皮或籽後切成大小一致的件。罐頭材料只需瀝乾，豆腐只需輕輕印乾，毋須清洗。`,
    `Rinse ${food.en} only if appropriate and drain. Remove tough stems, peel or seeds, then cut evenly. Canned ingredients only need draining, and tofu should be gently blotted rather than washed.`,
    `Bilas ${food.id} hanya bila sesuai lalu tiriskan. Buang tangkai keras, kulit, atau biji, kemudian potong sama besar. Bahan kalengan cukup ditiriskan, dan tahu cukup ditepuk perlahan tanpa dicuci.`,
  );
}

function seasoningText(spec, food) {
  const exact = exactIngredientUseText(spec);
  if (spec.main === "egg") {
    if (spec.method === "curry") {
      return t(
        `${exact.zh}已煮熟去殼的雞蛋不用醃，最後 8 分鐘才放入咖喱，避免蛋白變硬。`,
        `${exact.en} Do not marinate the peeled boiled eggs; add them only for the final 8 minutes so the whites do not toughen.`,
        `${exact.id} Jangan merendam telur rebus kupas; masukkan hanya selama 8 menit terakhir agar putih telur tidak keras.`,
      );
    }
    return t(
      `${exact.zh}${beatenEggDish(spec) ? "只把食材表列出的少量鹽及胡椒加入蛋液" : "雞蛋保持原隻"}；雞蛋不要醃放。`,
      `${exact.en} ${beatenEggDish(spec) ? "Add only the listed small amount of salt and pepper to the beaten egg" : "keep the eggs whole"}; do not leave eggs to marinate.`,
      `${exact.id} ${beatenEggDish(spec) ? "Tambahkan hanya sedikit garam dan lada yang tercantum ke telur kocok" : "jaga telur tetap utuh"}; jangan merendam telur.`,
    );
  }
  if (minceKeys.has(spec.main) && shapeDish(spec)) {
    return t(
      `${exact.zh}肉餅或肉丸只加入足以黏合的材料和一小部分調味，其餘調味汁稍後才下鑊，避免肉糰過濕散開。`,
      `${exact.en} Add only enough binder and a small portion of seasoning to the patties or meatballs; keep the remaining seasoning for the wok so the shaped mince does not become wet and fall apart.`,
      `${exact.id} Tambahkan hanya cukup bahan pengikat dan sedikit bumbu ke patty atau bakso; simpan sisa bumbu untuk wajan agar bentuknya tidak basah dan hancur.`,
    );
  }
  if (minceKeys.has(spec.main)) {
    return t(
      `${exact.zh}免治肉不需預先醃製；下鑊炒散變色後才加入上述調味，較易保持鬆散。`,
      `${exact.en} Do not marinate the mince; add the named seasoning only after the mince has been broken up and lost its raw colour.`,
      `${exact.id} Jangan merendam daging cincang; tambahkan bumbu yang disebutkan setelah daging diuraikan dan warna mentahnya hilang.`,
    );
  }
  if (spec.main === "clam") {
    const slurry = ingredientPlan(spec).binders.includes("cornstarch")
      ? t("；粟粉水保持分開", "; keep the cornstarch slurry separate", "; pisahkan larutan maizena")
      : t("", "", "");
    return t(
      `${exact.zh}蜆不要醃，以免出水及變鹹；調味汁保持分開${slurry.zh}。`,
      `${exact.en} Do not marinate clams, as they will release water and become too salty; keep the seasoning separate${slurry.en}.`,
      `${exact.id} Jangan merendam kerang karena akan mengeluarkan air dan menjadi terlalu asin; pisahkan bumbu${slurry.id}.`,
    );
  }
  if (spec.main === "rice" || dryOrLiquidKeys.has(spec.main) || (!poultryKeys.has(spec.main) && !fishKeys.has(spec.main) && !shellfishKeys.has(spec.main) && !/pork|ribs|beef|lamb|duck/.test(spec.main))) {
    return t(
      `${exact.zh}${food.zh}只需在烹調前輕拌少量上述調味，不要醃 10 分鐘，以免出水或變軟。`,
      `${exact.en} Toss ${food.en} with a little of the named seasoning just before cooking rather than marinating for 10 minutes, which could draw out water or soften it.`,
      `${exact.id} Aduk ${food.id} dengan sedikit bumbu yang disebutkan tepat sebelum dimasak; jangan direndam 10 menit karena dapat mengeluarkan air atau membuatnya lembek.`,
    );
  }
  return t(
    `${exact.zh}留起三分之二調味汁稍後煮汁；餘下三分之一薄薄拌勻${food.zh}，放雪櫃醃 10 分鐘。`,
    `${exact.en} Reserve two thirds of the named seasoning for cooking. Coat ${food.en} lightly with the remaining third and refrigerate for 10 minutes.`,
    `${exact.id} Sisihkan dua pertiga bumbu yang disebutkan untuk memasak. Lapisi tipis ${food.id} dengan sepertiga sisanya dan simpan di kulkas 10 menit.`,
  );
}

function applianceFor(spec) {
  if (spec.method === "steam") {
    return {
      model: "MX2-TT20SC",
      mode: t("純蒸", "Pure Steam", "Uap Murni"),
      temperatureC: 100,
      preheat: false,
      rack: t("蒸烤架置於下層", "steaming rack on lower level", "rak kukus di tingkat bawah"),
      waterTank: true,
      vessel: t("耐熱陶瓷碟；放在蒸烤架上", "heatproof ceramic dish on the steaming rack", "piring keramik tahan panas di atas rak kukus"),
    };
  }
  if (spec.method === "roast") {
    return {
      model: "MX2-TT20SC",
      mode: t("蒸氣烤焗（有預熱）", "Steam Bake (with preheat)", "Panggang Uap (dengan pemanasan awal)"),
      temperatureC: 210,
      preheat: true,
      rack: t("烤盤置於下層", "baking tray on lower level", "loyang di tingkat bawah"),
      waterTank: true,
      vessel: t("鋪焗紙的 MX2 原裝烤盤", "MX2 supplied tray lined with baking paper", "loyang bawaan MX2 beralas kertas roti"),
    };
  }
  if (spec.method === "grill") {
    return {
      model: "MX2-TT20SC",
      mode: t("烤焗（有預熱）", "Bake (with preheat)", "Panggang (dengan pemanasan awal)"),
      temperatureC: 220,
      preheat: true,
      rack: t("烤盤置於下層", "baking tray on lower level", "loyang di tingkat bawah"),
      waterTank: false,
      vessel: t("鋪焗紙的 MX2 原裝烤盤", "MX2 supplied tray lined with baking paper", "loyang bawaan MX2 beralas kertas roti"),
    };
  }
  if (spec.method === "bake") {
    const isRiceBake = isRiceBakeSpec(spec);
    return {
      model: "MX2-TT20SC",
      mode: t("烤焗（有預熱）", "Bake (with preheat)", "Panggang (dengan pemanasan awal)"),
      temperatureC: isRiceBake ? 200 : 190,
      preheat: true,
      rack: t("烤盤或蒸烤架置於下層", "tray or steaming rack on lower level", "loyang atau rak kukus di tingkat bawah"),
      waterTank: false,
      vessel: isRiceBake
        ? t("耐熱陶瓷焗盤；放在蒸烤架上", "heatproof ceramic baking dish on the steaming rack", "wadah panggang keramik tahan panas di atas rak kukus")
        : t("鋪焗紙的 MX2 原裝烤盤或耐熱陶瓷器皿", "MX2 supplied tray lined with baking paper, or a heatproof ceramic dish", "loyang bawaan MX2 beralas kertas roti, atau wadah keramik tahan panas"),
    };
  }
  return undefined;
}

function equipmentFor(spec) {
  if (["Korean beef bibimbap", "Thai basil minced pork"].includes(spec.title.en)) {
    return [EQUIPMENT.wok, EQUIPMENT.pan];
  }
  if (spec.title.en === "Japanese tofu hamburger steak") {
    return [EQUIPMENT.wok, EQUIPMENT.pan];
  }
  if (spec.title.en === "Gado-gado warm vegetable salad") {
    return [EQUIPMENT.wok, EQUIPMENT.pan];
  }
  if (spec.method === "panFry" || spec.method === "salad") return [EQUIPMENT.pan];
  if (wokMethods.has(spec.method)) return [EQUIPMENT.wok];
  if (spec.method === "steam") return [EQUIPMENT.mx2, EQUIPMENT.steamRack, EQUIPMENT.ceramicDish];
  if (isRiceBakeSpec(spec)) {
    return [EQUIPMENT.wok, EQUIPMENT.mx2, EQUIPMENT.steamRack, EQUIPMENT.ceramicDish];
  }
  if (spec.method === "bake" && (spec.main === "egg" || minceKeys.has(spec.main))) {
    return [EQUIPMENT.wok, EQUIPMENT.mx2, EQUIPMENT.steamRack, EQUIPMENT.ceramicDish];
  }
  if (ovenMethods.has(spec.method)) return [EQUIPMENT.mx2, EQUIPMENT.tray];
  throw new Error(`No equipment mapping for ${spec.method}`);
}

const safetyText = (main) => {
  if (poultryKeys.has(main)) return t(
    "最厚位置要完全熟透、沒有粉紅色；如有溫度計，中心須達 75°C。",
    "The thickest part must be fully cooked with no pink; if using a thermometer, the centre must reach 75°C.",
    "Bagian paling tebal harus matang tanpa warna merah muda; jika ada termometer, bagian tengah harus mencapai 75°C."
  );
  if (minceKeys.has(main)) return t(
    "免治肉要完全熟透，不可留生；如有溫度計，中心須達 71°C。",
    "Cook mince completely with no raw centre; if using a thermometer, the centre must reach 71°C.",
    "Daging cincang harus matang sepenuhnya tanpa bagian mentah; jika ada termometer, bagian tengah harus mencapai 71°C."
  );
  if (/pork|ribs/.test(main)) return t(
    "豬肉要熟透，切開最厚位置不可呈生肉色，肉汁應清澈。",
    "Cook pork through; the thickest part must not look raw and the juices should run clear.",
    "Masak daging babi hingga matang; bagian paling tebal tidak boleh tampak mentah dan sarinya harus bening."
  );
  if (fishKeys.has(main)) return t(
    "魚肉最厚位置要由半透明變成不透明，以叉輕撥能分成魚片；不要過度烹調至乾柴。",
    "The thickest part of the fish must turn from translucent to opaque and flake with gentle fork pressure; do not overcook it until dry.",
    "Bagian ikan paling tebal harus berubah dari bening menjadi tidak bening dan mudah terurai dengan garpu; jangan dimasak berlebihan hingga kering."
  );
  if (main === "clam") return t(
    "蜆殼應在烹調時張開；完成後仍沒有開口的必須棄掉，不要強行撬開食用。",
    "Clam shells should open during cooking; discard every clam that remains closed and do not force it open to eat.",
    "Cangkang kerang harus terbuka saat dimasak; buang semua yang tetap tertutup dan jangan dipaksa dibuka untuk dimakan."
  );
  if (shellfishKeys.has(main)) return t(
    "蝦或魷魚要由半透明變成不透明並剛好熟透；一達熟度便離火，避免變韌。",
    "Prawns or squid must turn from translucent to opaque and be just cooked through; remove from heat promptly to prevent toughness.",
    "Udang atau cumi harus berubah dari bening menjadi tidak bening dan baru matang; segera angkat agar tidak alot."
  );
  if (main === "egg") return t(
    "蛋白必須完全凝固；蛋奶素家庭菜譜以蛋液不再流動為完成標準。",
    "The egg white must be fully set; for these family recipes, beaten egg is done when no liquid egg remains.",
    "Putih telur harus mengeras sepenuhnya; untuk resep keluarga ini, telur kocok matang saat tidak ada telur cair tersisa."
  );
  if (/beef|lamb/.test(main)) return t(
    "肉件中心要熱透；切開最厚位置檢查，按家庭安全做法不可仍有生冷中心。",
    "The centre of meat pieces must be hot; check the thickest piece and do not leave a raw, cold centre for this family preparation.",
    "Bagian tengah potongan daging harus panas; periksa bagian paling tebal dan jangan sisakan tengah yang mentah serta dingin untuk masakan keluarga ini."
  );
  return t(
    "煮至中心熱透；豆腐或蔬菜表面應有香氣而不焦黑。",
    "Cook until hot through; tofu or vegetables should be fragrant without burning.",
    "Masak hingga panas sampai ke tengah; tahu atau sayuran harus harum tanpa gosong."
  );
};

function safetyTextForSpec(spec) {
  const safetyKeys = [spec.main];
  if (!minceKeys.has(spec.main) && spec.extras.some((key) => minceKeys.has(key))) safetyKeys.push("beefMince");
  if (!poultryKeys.has(spec.main) && spec.extras.some((key) => poultryKeys.has(key))) safetyKeys.push("chickenThigh");
  if (!fishKeys.has(spec.main) && spec.extras.some((key) => fishKeys.has(key))) safetyKeys.push("fishFillet");
  if (spec.main !== "clam" && spec.extras.includes("clam")) safetyKeys.push("clam");
  if (!shellfishKeys.has(spec.main) && spec.extras.some((key) => shellfishKeys.has(key))) safetyKeys.push("prawn");
  const texts = safetyKeys.map(safetyText);
  return t(
    texts.map((item) => item.zh).join(""),
    texts.map((item) => item.en).join(" "),
    texts.map((item) => item.id).join(" "),
  );
}

function baseStepSets(spec, mainName, extraNames) {
  const food = mainName;
  const extras = extraNames || t("配菜", "the remaining vegetables", "sayuran lainnya");
  const washableExtras = freshExtraNames(spec);
  const plan = ingredientPlan(spec);
  const hasCornstarch = plan.binders.includes("cornstarch");
  const measured = namesForKeys(
    [...plan.sauces, ...plan.spices, ...plan.liquids, ...plan.binders, ...plan.dairy, "oil"]
      .filter((key, index, list) => list.indexOf(key) === index),
    t("食材表列出的調味", "the listed seasonings", "bumbu yang tercantum"),
  );
  const coating = namesForKeys(plan.binders, t("食材表列出的炸粉", "the listed coating", "pelapis yang tercantum"));
  const soupAddIns = namesForKeys(
    spec.extras.filter((key) => !dryOrLiquidKeys.has(key) && !freshProduceKeys.has(key) && key !== "egg"),
    t("", "", ""),
  );
  const soupAddInPhrase = t(
    soupAddIns.zh ? `及${soupAddIns.zh}` : "",
    soupAddIns.en ? ` and ${soupAddIns.en}` : "",
    soupAddIns.id ? ` dan ${soupAddIns.id}` : "",
  );
  const soupHasEgg = spec.extras.includes("egg");
  const soupHasSeafood = fishKeys.has(spec.main) || shellfishKeys.has(spec.main) || spec.main === "clam" ||
    spec.extras.some((key) => fishKeys.has(key) || shellfishKeys.has(key) || key === "clam");
  const soupHasPoultry = poultryKeys.has(spec.main) || spec.extras.some((key) => poultryKeys.has(key));
  const soupSafetyNote = t(
    `${soupHasPoultry ? "禽肉最厚處須達 75°C。" : ""}${soupHasSeafood ? "海鮮一轉不透明便不要再久煮。" : ""}`,
    `${soupHasPoultry ? "Poultry must reach 75°C at the thickest part. " : ""}${soupHasSeafood ? "Do not cook seafood longer once it turns opaque." : ""}`,
    `${soupHasPoultry ? "Unggas harus mencapai 75°C pada bagian paling tebal. " : ""}${soupHasSeafood ? "Jangan masak seafood lebih lama setelah berubah tidak bening." : ""}`,
  );
  const soupMinutes = /brisket|ribs/i.test(spec.main)
    ? "50–65"
    : poultryKeys.has(spec.main)
      ? "12–15"
      : soupHasSeafood
        ? "3–6"
        : "10–15";
  const commonPrep = {
    title: t("備料", "Prepare", "Siapkan bahan"),
    instruction: t(
      `洗淨雙手及工作枱。${prepMainText(spec, food).zh}把${washableExtras.zh}沖洗、瀝乾及切好。${secondaryPrepText(spec).zh}按食材表量好${measured.zh}，分碗放置；這些材料不可清洗或切。`,
      `Wash hands and the worktop. ${prepMainText(spec, food).en} Rinse, drain and cut ${washableExtras.en}. ${secondaryPrepText(spec).en} Measure ${measured.en} exactly as listed and keep them in separate bowls; do not wash or cut these ingredients.`,
      `Cuci tangan dan meja kerja. ${prepMainText(spec, food).id} Bilas, tiriskan, dan potong ${washableExtras.id}. ${secondaryPrepText(spec).id} Takar ${measured.id} sesuai daftar dan simpan dalam mangkuk terpisah; jangan mencuci atau memotong bahan-bahan ini.`
    ),
  };
  const commonSauce = {
    title: t("調汁及醃味", "Mix sauce and season", "Campur saus dan bumbui"),
    instruction: t(
      `${seasoningText(spec, food).zh}素食模式請在此時換上食材列明的素食替代。`,
      `${seasoningText(spec, food).en} In vegetarian mode, use the replacements listed with the ingredients now.`,
      `${seasoningText(spec, food).id} Untuk mode vegetarian, gunakan pengganti yang tercantum pada daftar bahan sekarang.`
    ),
  };
  const finish = {
    title: t("檢查及上碟", "Check and serve", "Periksa dan sajikan"),
    instruction: t(
      `${safetyTextForSpec(spec).zh}試味後才按需要加鹽；熄火，靜置 2 分鐘再上碟。`,
      `${safetyTextForSpec(spec).en} Taste before adding any extra salt; turn off the heat and rest for 2 minutes before serving.`,
      `${safetyTextForSpec(spec).id} Cicipi sebelum menambah garam; matikan api dan diamkan 2 menit sebelum disajikan.`
    ),
  };

  const sets = {
    stirFry: [
      commonPrep, commonSauce,
      { title: t("燒熱鑊", "Heat the wok", "Panaskan wajan"), instruction: t("大火燒鑊 1 分鐘，加餘下食油；油面微微流動便可，勿燒至冒煙。", "Heat a wok on high for 1 minute, add the remaining oil; it is ready when shimmering but not smoking.", "Panaskan wajan dengan api besar 1 menit, tambah sisa minyak; siap saat berkilau tetapi tidak berasap.") },
      { title: t("炒主料", "Cook the main ingredient", "Masak bahan utama"), instruction: spec.main === "egg"
        ? t(
            "轉中火，倒入蛋液；待底部剛凝固約 20 秒，用鑊鏟由外向內輕推成大塊。蛋面仍稍濕時立即盛到乾淨碟，稍後回鑊才不會過熟。",
            "Reduce to medium and pour in the egg. Let the base just set for about 20 seconds, then push gently from the outside inward to form large curds. Transfer to a clean plate while the surface is still slightly moist so it will not overcook when returned.",
            "Kecilkan ke api sedang dan tuang telur. Biarkan dasar baru mengeras sekitar 20 detik, lalu dorong perlahan dari luar ke dalam membentuk gumpalan besar. Angkat saat permukaan masih sedikit lembap agar tidak terlalu matang ketika dimasukkan kembali.",
          )
        : minceKeys.has(spec.main)
          ? t(
              `中大火放入${food.zh}，用鑊鏟壓散成細塊，炒 4–6 分鐘至完全變色、沒有生肉色；如出水，繼續炒至水分蒸發。`,
              `Add ${food.en} over medium-high heat and break it into small pieces with the spatula. Cook for 4–6 minutes until no raw colour remains; if liquid comes out, continue until it evaporates.`,
              `Masukkan ${food.id} dengan api sedang-besar dan uraikan menjadi bagian kecil memakai spatula. Masak 4–6 menit sampai tidak ada warna mentah; jika keluar cairan, lanjutkan sampai menguap.`,
            )
          : t(`鋪平${food.zh}，先不要翻動 60–90 秒，再快炒至表面變色、中心約八成熟，盛到乾淨碟。雞或鴨回鑊後仍須最終煮至 75°C。`, `Spread out ${food.en}; leave untouched for 60–90 seconds, then stir-fry until coloured outside and about 80% cooked in the centre. Remove to a clean plate. Chicken or duck must still reach 75°C after it returns to the wok.`, `Ratakan ${food.id}; jangan diaduk 60–90 detik, lalu tumis sampai bagian luar berubah warna dan tengah sekitar 80% matang. Angkat ke piring bersih. Ayam atau bebek tetap harus mencapai 75°C setelah kembali ke wajan.`) },
      { title: t("炒配菜及收汁", "Cook vegetables and glaze", "Masak sayuran dan saus"), instruction: t(`原鑊加入${extras.zh}，炒 3 分鐘。主料回鑊，倒入餘下醬汁，炒 1–2 分鐘至汁液均勻包裹。`, `Add ${extras.en} to the same wok and stir-fry for 3 minutes. Return the main ingredient, pour in the remaining sauce, and toss 1–2 minutes until evenly glazed.`, `Masukkan ${extras.id} ke wajan yang sama dan tumis 3 menit. Kembalikan bahan utama, tuang sisa saus, aduk 1–2 menit sampai terlapisi rata.`) },
      finish,
    ],
    steam: [
      commonPrep, commonSauce,
      { title: t("準備 MX2 純蒸模式", "Set up MX2 Pure Steam", "Siapkan mode Uap Murni MX2"), instruction: t("清潔淨水箱並加滿少於 40°C 的過濾水或蒸餾水。選擇「純蒸」100°C，不用預熱。切勿把金屬或金邊器皿當微波器皿使用。", "Clean and fill the fresh-water tank with filtered or distilled water below 40°C. Select Pure Steam at 100°C; no preheating is needed. Never use metal or metallic-trimmed ware for microwave cooking.", "Bersihkan dan isi tangki air bersih dengan air saring atau suling di bawah 40°C. Pilih Uap Murni 100°C; tidak perlu pemanasan awal. Jangan gunakan wadah logam atau berpinggir logam untuk mode microwave.") },
      { title: t("排好材料", "Arrange the dish", "Susun bahan"), instruction: spec.main === "egg"
        ? t(
            `把蛋液與約 1.5 倍體積的暖湯輕輕拌勻，過篩倒入耐熱陶瓷碟，撇走泡沫；加入${extras.zh}後蓋上耐熱陶瓷蓋或耐熱碟，避免倒汗滴入。`,
            `Gently combine the beaten egg with about 1.5 times its volume of warm stock. Strain into a heatproof ceramic dish and remove surface bubbles. Add ${extras.en}, then cover with a heatproof ceramic lid or plate so condensation does not drip onto the custard.`,
            `Campur perlahan telur kocok dengan kaldu hangat sekitar 1,5 kali volumenya. Saring ke piring keramik tahan panas dan buang gelembung. Tambahkan ${extras.id}, lalu tutup dengan tutup atau piring keramik tahan panas agar embun tidak menetes ke telur.`,
          )
        : spec.main === "wholeFish"
        ? t(
            `把原條魚平放在耐熱陶瓷碟，薑蔥等香料一半放魚腔、一半鋪魚面，淋上調味；魚尾如超出碟邊可向內輕彎，但不可切成小件。`,
            `Lay the whole fish flat on a heatproof ceramic dish. Put half the ginger, spring onion and aromatics in the cavity and scatter the rest over the fish, then spoon on the seasoning. If the tail overhangs, curve it inward gently rather than cutting the fish into pieces.`,
            `Baringkan ikan utuh di piring keramik tahan panas. Taruh setengah jahe, daun bawang, dan bumbu di rongga, sisanya di atas ikan, lalu siram bumbu. Jika ekor melewati piring, tekuk perlahan ke dalam; jangan potong ikan menjadi bagian kecil.`,
          )
        : minceKeys.has(spec.main) && shapeDish(spec)
          ? t(
              `把已成形的${food.zh}放在耐熱陶瓷碟中央，厚度保持約 2 厘米；用濕手抹平表面，${extras.zh}鋪在上面，再均勻淋上醬汁。`,
              `Put the shaped ${food.en} in the centre of a heatproof ceramic dish, keeping it about 2 cm thick. Smooth the surface with damp hands, scatter ${extras.en} over it and spoon the sauce evenly on top.`,
              `Taruh ${food.id} yang sudah dibentuk di tengah piring keramik tahan panas dengan ketebalan sekitar 2 cm. Ratakan dengan tangan basah, taburkan ${extras.id}, lalu siram saus secara merata.`,
            )
          : t(`把${food.zh}單層排在碟上，${extras.zh}鋪在上面，淋上醬汁。不要疊得太厚。`, `Arrange ${food.en} in one layer, scatter ${extras.en} over it and spoon over the sauce. Do not pile it too deeply.`, `Susun ${food.id} satu lapis, taburkan ${extras.id} di atasnya dan siram saus. Jangan menumpuk terlalu tebal.`) },
      { title: t("下層蒸至熟透", "Steam on the lower level", "Kukus di tingkat bawah"), instruction: t(`把耐熱陶瓷碟放在蒸烤架上，蒸烤架置於下層；關門後蒸 ${spec.main === "wholeFish" ? "18–22" : spec.main === "egg" ? "14–18" : "12–15"} 分鐘。這裡用手動純蒸，因家庭份量未必等於自動菜單重量。完成後先退後開門，避開熱蒸氣；若顯示 F-01，先讓爐腔降溫。`, `Put the heatproof ceramic dish on the steaming rack at the lower level. Close the door and steam for ${spec.main === "wholeFish" ? "18–22" : spec.main === "egg" ? "14–18" : "12–15"} minutes. Use manual Pure Steam because the family portion may not match an Auto Menu weight. Stand back when opening; if F-01 appears, let the cavity cool first.`, `Taruh piring keramik tahan panas di atas rak kukus pada tingkat bawah. Tutup pintu dan kukus ${spec.main === "wholeFish" ? "18–22" : spec.main === "egg" ? "14–18" : "12–15"} menit. Gunakan Uap Murni manual karena porsi keluarga mungkin tidak sama dengan berat Menu Otomatis. Mundur saat membuka; jika F-01 muncul, dinginkan ruang oven dahulu.`) },
      finish,
    ],
    braise: [
      commonPrep, commonSauce,
      { title: t("煎香主料", "Brown the main ingredient", "Cokelatkan bahan utama"), instruction: spec.main === "egg"
        ? t(
            `雞蛋暫時留在小碗。中火燒熱中式鑊，加餘下食油，把洋蔥、蒜或${extras.zh}等需要炒香的配料先炒 3–4 分鐘至軟。`,
            `Keep the eggs in their small bowls for now. Heat the Chinese wok over medium, add the remaining oil, and cook onion, garlic or other ${extras.en} that need softening for 3–4 minutes.`,
            `Biarkan telur dalam mangkuk kecil untuk sementara. Panaskan wajan Tiongkok dengan api sedang, tambah sisa minyak, lalu masak bawang, bawang putih, atau ${extras.id} lain yang perlu dilunakkan selama 3–4 menit.`,
          )
        : minceKeys.has(spec.main)
        ? (shapeDish(spec)
            ? t(
                `中火燒熱中式鑊，加餘下食油，放入已成形的${food.zh}；每面煎 2–3 分鐘至定形微金黃，使用鑊鏟小心翻面，不要壓散。`,
                `Heat the Chinese wok over medium and add the remaining oil. Add the shaped ${food.en} and brown for 2–3 minutes per side until set and lightly golden, turning carefully with a spatula without breaking the shapes.`,
                `Panaskan wajan Tiongkok dengan api sedang dan tambah sisa minyak. Masukkan ${food.id} yang sudah dibentuk, masak 2–3 menit tiap sisi sampai kokoh dan agak keemasan; balik perlahan dengan spatula tanpa menghancurkan bentuknya.`,
              )
            : t(
                `中大火燒熱中式鑊，加餘下食油及${food.zh}，用鑊鏟炒散 5–7 分鐘，至完全變色及水分蒸發。`,
                `Heat the Chinese wok over medium-high, add the remaining oil and ${food.en}, and break it up with a spatula for 5–7 minutes until no raw colour remains and released liquid has evaporated.`,
                `Panaskan wajan Tiongkok dengan api sedang-besar, tambah sisa minyak dan ${food.id}, lalu uraikan dengan spatula 5–7 menit sampai tidak ada warna mentah dan cairannya menguap.`,
              ))
        : t(`中火燒熱中式鑊，加餘下食油，把${food.zh}每面煎 2 分鐘至微金黃。`, `Heat the Chinese wok over medium, add the remaining oil, and brown ${food.en} for 2 minutes per side.`, `Panaskan wajan Tiongkok dengan api sedang, tambah sisa minyak, lalu cokelatkan ${food.id} 2 menit tiap sisi.`) },
      { title: t("爆香及加汁", "Cook aromatics and add liquid", "Tumis bumbu dan tambah cairan"), instruction: spec.main === "egg"
        ? t(
            `加入餘下${extras.zh}及醬汁，煮滾後轉小火煮 8–10 分鐘至蔬菜軟、醬汁略稠；水分應只覆蓋配料，不可浸過稍後加入的蛋黃。`,
            `Add the remaining ${extras.en} and sauce. Bring to a boil, then simmer 8–10 minutes until the vegetables soften and the sauce thickens slightly. The liquid should cover the vegetables but must not later submerge the yolks.`,
            `Masukkan sisa ${extras.id} dan saus. Didihkan, lalu masak perlahan 8–10 menit sampai sayuran lunak dan saus sedikit mengental. Cairan harus menutupi sayuran tetapi nanti tidak boleh merendam kuning telur.`,
          )
        : t(`加入${extras.zh}炒 3 分鐘。倒入醬汁及清水至材料一半高度，煮滾。`, `Add ${extras.en} and cook for 3 minutes. Add the sauce and enough water to come halfway up the ingredients; bring to a boil.`, `Masukkan ${extras.id} dan masak 3 menit. Tuang saus dan air sampai setengah tinggi bahan; didihkan.`) },
      { title: t("慢火燜煮", "Braise gently", "Semur perlahan"), instruction: spec.main === "egg"
        ? t(
            "用鑊鏟在醬汁中開出小凹位，逐隻滑入雞蛋，蛋黃保持完整。加蓋用最小火煮 5–7 分鐘，至蛋白完全凝固；如要蛋黃全熟，再多煮 2 分鐘。",
            "Make wells in the sauce with the spatula and slide in the eggs one at a time, keeping the yolks intact. Cover and cook on the lowest heat for 5–7 minutes until the whites are fully set; cook 2 minutes longer for firm yolks.",
            "Buat cekungan dalam saus dengan spatula dan masukkan telur satu per satu sambil menjaga kuning tetap utuh. Tutup dan masak dengan api paling kecil 5–7 menit sampai putih telur benar-benar mengeras; tambah 2 menit untuk kuning yang matang keras.",
          )
        : ["firmTofu", "softTofu", "eggplant", "mushroom", "kingOyster"].includes(spec.main)
          ? t(
              `轉小火加蓋燜 10–15 分鐘；不要用鑊鏟大力攪，期間只需輕搖鑊身一次，避免豆腐或蔬菜碎裂。最後開蓋煮 2–3 分鐘收汁。`,
              `Cover and braise on low for 10–15 minutes. Do not stir forcefully; gently shake the wok once so tofu or vegetables do not break. Uncover for the final 2–3 minutes to reduce.`,
              `Tutup dan semur dengan api kecil 10–15 menit. Jangan aduk kuat; cukup goyangkan wajan perlahan sekali agar tahu atau sayuran tidak hancur. Buka tutup 2–3 menit terakhir untuk mengentalkan.`,
            )
          : t(`轉小火加蓋燜 ${/brisket|ribs|belly/i.test(spec.main) ? "45–60" : "18–25"} 分鐘，每 10 分鐘攪動一次；最後開蓋煮 3–5 分鐘收汁。`, `Cover and braise on low for ${/brisket|ribs|belly/i.test(spec.main) ? "45–60" : "18–25"} minutes, stirring every 10 minutes; uncover for the final 3–5 minutes to reduce.`, `Tutup dan semur dengan api kecil ${/brisket|ribs|belly/i.test(spec.main) ? "45–60" : "18–25"} menit, aduk tiap 10 menit; buka tutup 3–5 menit terakhir untuk mengentalkan.`) },
      finish,
    ],
    soup: [
      commonPrep, commonSauce,
      { title: t("炒香湯底", "Start the soup base", "Buat dasar sup"), instruction: t(`中火燒熱中式鑊，加餘下食油，只把洋蔥、薑、蒜及${washableExtras.zh}等需要炒香的蔬菜炒 4 分鐘；肉類、海鮮、豆腐及蛋此時不要加入。`, `Heat the Chinese wok over medium, add the remaining oil, and cook only onion, ginger, garlic and vegetables such as ${washableExtras.en} for 4 minutes. Do not add meat, seafood, tofu or egg yet.`, `Panaskan wajan Tiongkok dengan api sedang, tambah sisa minyak, lalu masak hanya bawang, jahe, bawang putih, dan sayuran seperti ${washableExtras.id} selama 4 menit. Jangan masukkan daging, seafood, tahu, atau telur dulu.`) },
      { title: t("加湯煮滾", "Add stock and boil", "Tambah kaldu dan didihkan"), instruction: t("加入醬料及湯，轉大火煮滾；撇走表面泡沫。", "Add the sauce ingredients and stock, bring to a boil over high heat, and skim off surface foam.", "Masukkan bahan saus dan kaldu, didihkan dengan api besar, lalu buang buih di permukaan.") },
      { title: t("小火煮主料", "Simmer the main ingredient", "Rebus bahan utama"), instruction: spec.main === "egg"
        ? t(
            `湯保持微滾。${hasCornstarch ? "先把粟粉與等量凍水開勻，加入湯內煮至略稠；" : ""}轉最小火，用筷子沿碗邊慢慢把蛋液淋成幼線，等 20 秒才由底向上輕推一次，蛋花凝固便熄火。`,
            `Keep the soup at a gentle simmer. ${hasCornstarch ? "Mix the cornstarch with equal cold water, add it and cook until slightly thick. " : ""}Reduce to the lowest heat, drizzle beaten egg in a thin stream along chopsticks, wait 20 seconds, then lift gently once from the bottom. Turn off the heat as soon as the egg ribbons set.`,
            `Jaga sup mendidih perlahan. ${hasCornstarch ? "Campur maizena dengan air dingin sama banyak, masukkan dan masak hingga sedikit kental. " : ""}Kecilkan ke api paling kecil, tuang telur kocok perlahan melalui sumpit membentuk aliran tipis, tunggu 20 detik, lalu dorong sekali dari dasar. Matikan api segera setelah pita telur mengeras.`,
          )
        : t(
            `加入${food.zh}${soupAddInPhrase.zh}，再滾後轉小火煮 ${soupMinutes} 分鐘。${soupSafetyNote.zh}${soupHasEgg ? "其餘材料熟後轉最小火，沿筷子把蛋液淋成幼線，等 20 秒才輕推一次。" : ""}${hasCornstarch ? "把粟粉先用等量凍水開勻，再慢慢加入勾芡。" : ""}`,
            `Add ${food.en}${soupAddInPhrase.en}; when the soup returns to a boil, simmer on low for ${soupMinutes} minutes. ${soupSafetyNote.en}${soupHasEgg ? " Once the other ingredients are cooked, reduce to the lowest heat, drizzle beaten egg in a thin stream along chopsticks, wait 20 seconds, then lift gently once." : ""}${hasCornstarch ? " Mix the cornstarch with equal cold water and add it slowly to thicken." : ""}`,
            `Masukkan ${food.id}${soupAddInPhrase.id}; setelah mendidih lagi, masak api kecil ${soupMinutes} menit. ${soupSafetyNote.id}${soupHasEgg ? " Setelah bahan lain matang, kecilkan ke api paling kecil, tuang telur kocok tipis melalui sumpit, tunggu 20 detik, lalu dorong perlahan sekali." : ""}${hasCornstarch ? " Campur maizena dengan air dingin sama banyak lalu tuang perlahan untuk mengentalkan." : ""}`,
          ) },
      finish,
    ],
    panFry: [
      commonPrep, commonSauce,
      { title: t("預熱平底鑊", "Preheat the pan", "Panaskan wajan datar"), instruction: t("平底鑊中火預熱 2 分鐘，加餘下食油並轉動鑊身鋪勻。", "Preheat a frying pan over medium heat for 2 minutes, add the remaining oil and swirl to coat.", "Panaskan wajan datar dengan api sedang 2 menit, tambah sisa minyak dan ratakan.") },
      { title: t("煎第一面", "Cook the first side", "Goreng sisi pertama"), instruction: t(`放入${food.zh}後不要移動，中火煎 3–5 分鐘至金黃，勿擠迫鑊面。`, `Add ${food.en} without crowding and leave undisturbed over medium heat for 3–5 minutes until golden.`, `Masukkan ${food.id} tanpa memenuhi wajan dan jangan digerakkan; masak api sedang 3–5 menit sampai keemasan.`) },
      { title: t("反面及加配菜", "Turn and finish", "Balik dan selesaikan"), instruction: t(`反面再煎 3–5 分鐘，加入${extras.zh}及醬汁，加蓋 2 分鐘，再開蓋收汁。`, `Turn and cook another 3–5 minutes. Add ${extras.en} and sauce, cover for 2 minutes, then uncover to reduce.`, `Balik dan masak 3–5 menit lagi. Tambahkan ${extras.id} dan saus, tutup 2 menit, lalu buka untuk mengentalkan.`) },
      finish,
    ],
    deepFry: [
      commonPrep, commonSauce,
      { title: t("上粉及熱油", "Coat and heat the oil", "Lapisi dan panaskan minyak"), instruction: t(`把${food.zh}薄薄沾上${coating.zh}，拍走多餘粉。中式鑊內食油加熱至 170–175°C；沒有溫度計可放一小粒炸粉，應立即浮起冒小泡。`, `Coat ${food.en} lightly with ${coating.en} and shake off excess. Heat the cooking oil in the Chinese wok to 170–175°C; without a thermometer, a pinch of the listed coating should rise immediately with small bubbles.`, `Lapisi tipis ${food.id} dengan ${coating.id} dan tepuk kelebihannya. Panaskan minyak goreng dalam wajan Tiongkok hingga 170–175°C; tanpa termometer, sedikit pelapis harus langsung naik dengan gelembung kecil.`) },
      { title: t("分批炸熟", "Fry in batches", "Goreng bertahap"), instruction: t(`分 2–3 批放入，每批炸 3–5 分鐘至金黃。每批之間讓油溫回升；切勿把水倒入熱油。`, `Fry in 2–3 batches for 3–5 minutes each until golden. Let the oil reheat between batches; never add water to hot oil.`, `Goreng dalam 2–3 tahap, masing-masing 3–5 menit sampai keemasan. Biarkan minyak panas kembali; jangan pernah menuang air ke minyak panas.`) },
      { title: t("瀝油拌汁", "Drain and glaze", "Tiriskan dan beri saus"), instruction: t(`用夾取出放在鋪廚紙的乾淨碟瀝油。倒走中式鑊內熱油並抹淨，再把${extras.zh}及醬汁煮滾 1 分鐘，加入炸好的主料快速拌勻。`, `Lift out with tongs and drain on a clean plate lined with kitchen paper. Safely remove the hot oil and wipe the Chinese wok, then boil ${extras.en} with the sauce for 1 minute and quickly toss through the fried ingredient.`, `Angkat dengan penjepit dan tiriskan di piring bersih beralas tisu dapur. Singkirkan minyak panas dengan aman dan lap wajan Tiongkok, lalu didihkan ${extras.id} dengan saus 1 menit dan cepat aduk bersama bahan goreng.`) },
      finish,
    ],
  };
  return sets;
}

function riceBakeMainCooking(spec, food) {
  if (spec.main === "rice") {
    return t(
      "白飯已煮熟，不要再次乾炒；用中式鑊把需要加熱的蔬菜和醬汁煮 3–4 分鐘。",
      "The rice is already cooked; do not dry-fry it again. Cook any vegetables and sauce that require heating in the Chinese wok for 3–4 minutes.",
      "Nasi sudah matang; jangan ditumis kering lagi. Masak sayuran dan saus yang perlu dipanaskan dalam wajan Tiongkok selama 3–4 menit.",
    );
  }
  if (minceKeys.has(spec.main) && shapeDish(spec)) {
    return t(
      `中火把已成形的${food.zh}逐面煎至定形及熟透，輕手翻動以保持肉丸或肉餅形狀；中心須達 71°C。`,
      `Pan-fry the shaped ${food.en} over medium heat, turning gently to preserve the patties or meatballs, until set and cooked through; the centre must reach 71°C.`,
      `Goreng ${food.id} yang sudah dibentuk dengan api sedang, balik perlahan agar patty atau bakso tetap utuh, sampai kokoh dan matang; bagian tengah harus mencapai 71°C.`,
    );
  }
  const safety = safetyText(spec.main);
  return t(
    `用中式鑊先把${food.zh}煮熟。${safety.zh}`,
    `Cook ${food.en} in the Chinese wok first. ${safety.en}`,
    `Masak ${food.id} dalam wajan Tiongkok terlebih dahulu. ${safety.id}`,
  );
}

function riceBakeMixInCooking(spec) {
  const plan = ingredientPlan(spec);
  const vegetables = namesForKeys([...plan.aromatics, ...plan.produce], t("", "", ""));
  const secondary = namesForKeys(
    plan.secondaryProteins.filter((key) => key !== "egg"),
    t("", "", ""),
  );
  const hasEgg = plan.secondaryProteins.includes("egg");
  const clauses = { zh: [], en: [], id: [] };
  if (vegetables.en) {
    clauses.zh.push(`原鑊把${vegetables.zh}炒 3–4 分鐘至軟及有香味`);
    clauses.en.push(`sauté ${vegetables.en} in the same wok for 3–4 minutes until softened and fragrant`);
    clauses.id.push(`tumis ${vegetables.id} dalam wajan yang sama 3–4 menit sampai lunak dan harum`);
  }
  if (secondary.en) {
    clauses.zh.push(`把${secondary.zh}煮至中心熱透後才混合`);
    clauses.en.push(`cook ${secondary.en} through before combining`);
    clauses.id.push(`masak ${secondary.id} hingga matang sebelum dicampur`);
  }
  if (hasEgg) {
    clauses.zh.push("把雞蛋炒成仍微濕的大蛋塊，加入熱飯炒散 2 分鐘");
    clauses.en.push("scramble the eggs into large, still-moist curds, then add the hot rice and break it up for 2 minutes");
    clauses.id.push("orak-arik telur menjadi gumpalan besar yang masih lembap, lalu masukkan nasi panas dan uraikan 2 menit");
  }
  if (!clauses.en.length) return t("", "", "");
  return t(
    `${clauses.zh.join("；")}。`,
    `${clauses.en.join("; ")}. `,
    `${clauses.id.join("; ")}. `,
  );
}

function composeBakedRice(spec, food) {
  const plan = ingredientPlan(spec);
  const allKeys = plan.keys;
  const lateKeys = allKeys.filter((key) => ["basil", "lime", "scallion"].includes(key));
  const firmVegetableKeys = plan.produce.filter((key) => ["potato", "broccoli", "cauliflower"].includes(key));
  const softVegetableKeys = plan.produce.filter((key) =>
    !firmVegetableKeys.includes(key) && !lateKeys.includes(key)
  );
  const sauceKeys = [
    ...plan.aromatics,
    ...firmVegetableKeys,
    ...softVegetableKeys,
    ...plan.sauces,
    ...plan.spices,
    ...plan.liquids,
    ...plan.dairy.filter((key) => key !== "cheese"),
    ...plan.fats,
  ].filter((key, index, list) =>
    key !== spec.main && key !== "rice" && !lateKeys.includes(key) && list.indexOf(key) === index
  );
  const proteinSupportKeys = [
    ...plan.secondaryProteins.filter((key) => key !== spec.main),
    ...plan.binders,
    ...plan.fats.filter((key) => key === "oil"),
  ].filter((key, index, list) =>
    key !== "cheese" &&
    key !== "rice" &&
    !(spec.title.en === "Hong Kong baked pork chop rice" && key === "egg") &&
    list.indexOf(key) === index
  );
  const prepKeys = allKeys.filter((key) => key !== "rice");
  const rice = namesForKeys(["rice"]);
  const prep = namesForKeys(prepKeys);
  const aromatics = namesForKeys(plan.aromatics, t("", "", ""));
  const firmVegetables = namesForKeys(firmVegetableKeys, t("", "", ""));
  const softVegetables = namesForKeys(softVegetableKeys, t("", "", ""));
  const sauceIngredients = namesForKeys(
    sauceKeys.filter((key) =>
      !plan.aromatics.includes(key) &&
      !firmVegetableKeys.includes(key) &&
      !softVegetableKeys.includes(key) &&
      !plan.fats.includes(key)
    ),
    t("", "", ""),
  );
  const proteinSupport = namesForKeys(proteinSupportKeys, t("", "", ""));
  const cookingFats = namesForKeys(plan.fats, t("食油", "cooking oil", "minyak goreng"));
  const cheese = namesForKeys(allKeys.includes("cheese") ? ["cheese"] : [], t("", "", ""));
  const late = namesForKeys(lateKeys, t("", "", ""));
  const sauceProduct = spec.main === "rice" ? "reduced-bake-sauce" : "bake-sauce";
  const finalSafety = safetyTextForSpec(spec);

  const sauceClauses = {
    zh: [`中式鑊中火加熱${cookingFats.zh}`],
    en: [`Heat ${cookingFats.en} in the Chinese wok over medium`],
    id: [`Panaskan ${cookingFats.id} dalam wajan Tiongkok dengan api sedang`],
  };
  if (aromatics.en) {
    sauceClauses.zh.push(`加入${aromatics.zh}炒 3–4 分鐘至軟及有香味`);
    sauceClauses.en.push(`cook ${aromatics.en} for 3–4 minutes until soft and fragrant`);
    sauceClauses.id.push(`masak ${aromatics.id} 3–4 menit sampai lunak dan harum`);
  }
  if (firmVegetables.en) {
    sauceClauses.zh.push(`加入${firmVegetables.zh}及 80 毫升水，加蓋煮 6–8 分鐘至接近叉可插入`);
    sauceClauses.en.push(`add ${firmVegetables.en} with 80 ml water, cover and cook for 6–8 minutes until nearly fork-tender`);
    sauceClauses.id.push(`tambahkan ${firmVegetables.id} dan 80 ml air, tutup 6–8 menit sampai hampir empuk`);
  }
  if (softVegetables.en) {
    const minutes = spec.main === "eggplant" ? "5–6" : "2–3";
    sauceClauses.zh.push(`加入${softVegetables.zh}炒 ${minutes} 分鐘至剛軟`);
    sauceClauses.en.push(`add ${softVegetables.en} and cook for ${minutes} minutes until just tender`);
    sauceClauses.id.push(`tambahkan ${softVegetables.id} dan masak ${minutes} menit sampai baru lunak`);
  }
  if (sauceIngredients.en) {
    sauceClauses.zh.push(`拌入${sauceIngredients.zh}，小火煮 4–6 分鐘至醬汁可薄薄掛匙`);
    sauceClauses.en.push(`stir in ${sauceIngredients.en} and simmer for 4–6 minutes until the sauce lightly coats a spoon`);
    sauceClauses.id.push(`masukkan ${sauceIngredients.id} dan didihkan perlahan 4–6 menit sampai saus melapisi sendok tipis`);
  }

  let partialInstruction;
  let partialUses;
  let partialConsumes = [];
  let partialProduces;
  if (spec.main === "rice") {
    partialInstruction = t(
      "保持中小火，把上一步醬汁再煮 2–3 分鐘，至鑊鏟劃過鑊底會留下短暫痕跡；醬汁不可水汪汪，以免焗飯濕爛。",
      "Keep the bake sauce over medium-low for another 2–3 minutes, until a spatula drawn across the wok leaves a brief trail. It must not be watery or the rice bake will turn soggy.",
      "Masak saus panggang dengan api sedang-kecil 2–3 menit lagi sampai spatula meninggalkan jejak singkat. Saus tidak boleh encer agar nasi tidak lembek.",
    );
    partialUses = [];
    partialConsumes = ["bake-sauce"];
    partialProduces = ["reduced-bake-sauce"];
  } else if (spec.title.en === "Hong Kong baked pork chop rice") {
    partialInstruction = t(
      "平底鑊中火加一半食油，豬扒每面只煎 90 秒至金黃、中央仍未熟，盛起。抹淨鑊後加餘下食油，倒入蛋液推成仍微濕的大蛋塊，立即加入已煮好的白飯炒散 2 分鐘；豬扒不要回鑊，稍後才在焗爐完成。",
      "Heat half the cooking oil in the frying pan over medium. Sear the pork loin for only 90 seconds per side until browned while the centre remains underdone, then remove it. Wipe the pan, add the remaining cooking oil, pour in the eggs and push into large, still-moist curds. Immediately add the cooked jasmine rice and toss for 2 minutes. Do not return the pork yet; it will finish in the oven.",
      "Panaskan setengah minyak goreng dengan api sedang. Panggang daging babi 90 detik tiap sisi sampai kecokelatan sementara tengah belum matang, lalu angkat. Lap wajan, tambah sisa minyak, tuang telur dan dorong menjadi gumpalan besar yang masih lembap. Segera masukkan nasi melati matang dan aduk 2 menit. Jangan masukkan kembali daging; pematangan selesai dalam oven.",
    );
    partialUses = [spec.main, "egg", "oil", "rice"];
    partialConsumes = ["cooked-rice"];
    partialProduces = ["partially-cooked-main", "egg-fried-rice"];
  } else {
    let supportLead;
    if (minceKeys.has(spec.main) && shapeDish(spec)) {
      supportLead = t(
        `把${food.zh}與${proteinSupport.zh}拌至剛黏合，分成大小一致肉丸。`,
        `Mix ${food.en} with ${proteinSupport.en} just until bound, then shape equal-size meatballs. `,
        `Campur ${food.id} dengan ${proteinSupport.id} sampai baru menyatu, lalu bentuk bakso sama besar. `,
      );
    } else if (spec.main === "firmTofu" && plan.binders.includes("cornstarch")) {
      supportLead = t(
        `把${food.zh}薄薄沾粟粉；平底鑊加食油後才放入。`,
        `Dust ${food.en} lightly with cornstarch, then add it only after the cooking oil is hot. `,
        `Lapisi tipis ${food.id} dengan maizena, lalu masukkan setelah minyak goreng panas. `,
      );
    } else if (proteinSupport.en) {
      supportLead = t(
        `平底鑊加${proteinSupport.zh}後放入${food.zh}。`,
        `Add ${proteinSupport.en} to the frying pan before adding ${food.en}. `,
        `Tambahkan ${proteinSupport.id} ke wajan datar sebelum memasukkan ${food.id}. `,
      );
    } else {
      supportLead = t("", "", "");
    }
    let doneness;
    if (poultryKeys.has(spec.main)) {
      doneness = t(
        "每面只煎 90 秒至外層轉白、中央仍未熟；立即進行組合及焗製，不可在此步煮至 75°C。",
        "Sear for only 90 seconds per side until the outside turns opaque but the centre is still underdone. Assemble and bake immediately; do not cook it through at this stage.",
        "Panggang hanya 90 detik tiap sisi sampai luar buram tetapi tengah belum matang. Segera susun dan panggang; jangan mencapai 75°C pada tahap ini.",
      );
    } else if (minceKeys.has(spec.main)) {
      doneness = t(
        "分成大小一致肉丸，逐面煎約 60 秒只至外層定形，中央仍未熟；71°C 的最終熟度留待焗爐完成。",
        "Sear each meatball for about 60 seconds per side only until the outside holds its shape; keep the centre underdone and complete the cooking only during the final bake.",
        "Bentuk bakso sama besar dan panggang tiap sisi sekitar 60 detik hanya sampai luar kokoh; bagian tengah belum matang dan baru mencapai 71°C saat pemanggangan akhir.",
      );
    } else if (fishKeys.has(spec.main)) {
      doneness = t(
        "每面只煎 60 秒至表面定形，中央保持半透明；魚肉會在焗爐完成，不可在此步煮至全熟。",
        "Sear for only 60 seconds per side to set the surface while the centre stays translucent. The fish will finish in the oven; do not cook it through now.",
        "Panggang hanya 60 detik tiap sisi agar permukaan kokoh sementara tengah tetap tembus cahaya. Ikan akan matang dalam oven; jangan matangkan penuh sekarang.",
      );
    } else if (/pork|beef|lamb|ribs/.test(spec.main)) {
      doneness = t(
        "每面只煎 90 秒至表面金黃，中央仍未熟；熟度留待焗爐完成，避免肉質乾硬。",
        "Sear for only 90 seconds per side until browned while the centre remains underdone. Finish it in the oven to avoid dry, tough meat.",
        "Panggang hanya 90 detik tiap sisi sampai kecokelatan sementara tengah belum matang. Selesaikan dalam oven agar tidak kering dan keras.",
      );
    } else {
      doneness = t(
        "中火每面煎 2–3 分鐘至表面金黃但仍保持形狀；不用在此步久煮，稍後會再焗。",
        "Cook for 2–3 minutes per side over medium until lightly golden and holding its shape; do not overcook because it will bake again.",
        "Masak 2–3 menit tiap sisi dengan api sedang sampai keemasan dan kokoh; jangan terlalu matang karena akan dipanggang lagi.",
      );
    }
    partialInstruction = t(
      `${supportLead.zh}${doneness.zh}`,
      `${supportLead.en}${doneness.en}`,
      `${supportLead.id}${doneness.id}`,
    );
    partialUses = [spec.main, ...proteinSupportKeys].filter((key, index, list) => list.indexOf(key) === index);
    partialProduces = ["partially-cooked-main"];
  }

  const assemblyUses = ["rice", ...(spec.main === "rice" ? [] : [spec.main]), ...(cheese.en ? ["cheese"] : [])];
  const assemblyRice = spec.title.en === "Hong Kong baked pork chop rice"
    ? t("蛋炒白飯", "egg-fried jasmine rice", "nasi melati goreng telur")
    : rice;
  const assemblyIngredientText = cheese.en
    ? t(
        `把${assemblyRice.zh}、醬汁及${spec.main === "rice" ? "配料" : food.zh}拌勻，倒入耐熱陶瓷焗盤，表面均勻鋪${cheese.zh}`,
        `Combine ${assemblyRice.en}, the bake sauce and ${spec.main === "rice" ? "the cooked vegetables" : food.en} in the heatproof ceramic dish, then spread ${cheese.en} evenly on top`,
        `Campur ${assemblyRice.id}, saus, dan ${spec.main === "rice" ? "sayuran matang" : food.id} dalam wadah keramik, lalu ratakan ${cheese.id} di atasnya`,
      )
    : t(
        `把${assemblyRice.zh}、醬汁及${spec.main === "rice" ? "配料" : food.zh}拌勻後倒入耐熱陶瓷焗盤`,
        `Combine ${assemblyRice.en}, the bake sauce and ${spec.main === "rice" ? "the cooked vegetables" : food.en} in the heatproof ceramic dish`,
        `Campur ${assemblyRice.id}, saus, dan ${spec.main === "rice" ? "sayuran matang" : food.id} dalam wadah keramik`,
      );

  return [
    {
      title: t("煮飯及切配材料", "Cook the rice and prepare components", "Masak nasi dan siapkan bahan"),
      instruction: t(
        `洗手並分開生熟用具。${rice.zh}洗至水接近清澈，以 1.2 倍水在中式鑊煮滾，加蓋最小火煮 12 分鐘，熄火靜置 10 分鐘後鬆飯。另按食材表切配及量好${prep.zh}。`,
        `Wash hands and separate raw and cooked utensils. Rinse ${rice.en} until the water is nearly clear, add 1.2 times its volume of water in the Chinese wok, bring to a boil, cover and cook on the lowest heat for 12 minutes, then rest off heat for 10 minutes and fluff. Separately cut or measure ${prep.en} exactly as listed.`,
        `Cuci tangan dan pisahkan alat mentah serta matang. Cuci ${rice.id} sampai air hampir jernih, masak dengan air 1,2 kali volumenya dalam wajan, tutup dan masak api paling kecil 12 menit, lalu diamkan 10 menit dan uraikan. Potong atau takar ${prep.id} sesuai daftar.`,
      ),
      prepares: prepKeys,
      uses: ["rice"],
      produces: ["cooked-rice"],
    },
    {
      title: t("煮焗飯醬汁", "Make the bake sauce", "Buat saus nasi panggang"),
      instruction: t(
        `${sauceClauses.zh.join("；")}。`,
        `${sauceClauses.en.join("; ")}.`,
        `${sauceClauses.id.join("; ")}.`,
      ),
      uses: sauceKeys,
      produces: ["bake-sauce"],
    },
    {
      title: spec.main === "rice"
        ? t("收濃醬汁", "Reduce the bake sauce", "Kentalkan saus panggang")
        : t("只煎至半熟", "Partially cook the main ingredient", "Masak bahan utama setengah matang"),
      instruction: partialInstruction,
      uses: partialUses,
      consumes: partialConsumes,
      produces: partialProduces,
    },
    {
      title: t("預熱 Toshiba MX2", "Preheat the Toshiba MX2", "Panaskan awal Toshiba MX2"),
      instruction: t(
        "此烤焗模式不用水箱。選擇烤焗（有預熱）200°C，開始預熱；蜂鳴後才放入食物。焗盤稍後放下層蒸烤架。",
        "The water tank is not used. Select Bake (with preheat) at 200°C and start preheating; load food only after the beep. The baking dish will sit on the steaming rack at the lower level.",
        "Tangki air tidak digunakan. Pilih Panggang (dengan pemanasan awal) 200°C; masukkan makanan setelah bunyi bip. Wadah akan diletakkan di rak kukus tingkat bawah.",
      ),
      prepares: [],
      uses: [],
    },
    {
      title: t("組合焗飯及焗熟", "Assemble the rice bake and bake through", "Susun nasi panggang dan panggang hingga matang"),
      instruction: t(
        `${assemblyIngredientText.zh}；放在下層蒸烤架焗 12–15 分鐘，至表面金黃、邊緣冒小泡。`,
        `${assemblyIngredientText.en}. Bake on the steaming rack at the lower level for 12–15 minutes, until the top is golden and the edges bubble.`,
        `${assemblyIngredientText.id}. Panggang di rak kukus tingkat bawah 12–15 menit sampai permukaan keemasan dan tepi bergelembung.`,
      ),
      uses: assemblyUses,
      consumes: [
        spec.title.en === "Hong Kong baked pork chop rice" ? "egg-fried-rice" : "cooked-rice",
        sauceProduct,
        ...(spec.main === "rice" ? [] : ["partially-cooked-main"]),
      ],
      produces: ["finished-rice-bake"],
    },
    {
      title: t("檢查最終熟度及加入香草", "Check final doneness and finish", "Periksa kematangan akhir dan selesaikan"),
      instruction: t(
        `${spec.main === "rice" ? "焗飯中心必須熱透。" : `${food.zh}在焗製完成後才檢查：${finalSafety.zh}`}${late.en ? ` 出爐後才加入${late.zh}，避免香草變黑或青檸變苦。` : ""}試味後才加鹽，靜置 5 分鐘再分 3 份。`,
        `${spec.main === "rice" ? "The centre of the rice bake must be piping hot." : `Check ${food.en} only after baking: ${finalSafety.en}`}${late.en ? ` Add ${late.en} only after baking so herbs stay fresh and lime does not turn bitter.` : ""} Taste before adding salt, rest for 5 minutes, then divide into 3 portions.`,
        `${spec.main === "rice" ? "Bagian tengah nasi panggang harus sangat panas." : `Periksa ${food.id} hanya setelah dipanggang: ${finalSafety.id}`}${late.en ? ` Tambahkan ${late.id} setelah dipanggang agar herba tetap segar dan jeruk tidak pahit.` : ""} Cicipi sebelum menambah garam, diamkan 5 menit, lalu bagi 3 porsi.`,
      ),
      uses: [...(spec.main === "rice" ? [] : [spec.main]), ...lateKeys],
      consumes: ["finished-rice-bake"],
    },
  ];
}

function specialDishSteps(spec, food) {
  if (isRiceBakeSpec(spec)) return composeBakedRice(spec, food);
  if (spec.method === "salad" && ["cucumber", "carrot"].includes(spec.main)) {
    const plan = ingredientPlan(spec);
    const vegetables = namesForKeys(plan.produce, t("配菜", "the vegetables", "sayuran"));
    const aromatics = namesForKeys(plan.aromatics, t("香料", "the aromatics", "bumbu aromatik"));
    const dressing = namesForKeys([...plan.sauces, ...plan.spices, ...plan.fats], t("鹽及食油", "salt and cooking oil", "garam dan minyak goreng"));
    return [
      {
        title: t("切主料及配菜", "Cut the main ingredient and vegetables", "Potong bahan utama dan sayuran"),
        instruction: t(
          `${food.zh}洗淨瀝乾，切成幼條或薄片；${vegetables.zh}洗淨切幼，${aromatics.zh}切碎。${dressing.zh}按食材表量好。`,
          `Wash and drain ${food.en}, then cut into fine strips or thin slices. Wash and finely cut ${vegetables.en}, chop ${aromatics.en}, and measure ${dressing.en} exactly as listed.`,
          `Cuci dan tiriskan ${food.id}, lalu potong batang halus atau iris tipis. Cuci dan iris halus ${vegetables.id}, cincang ${aromatics.id}, dan takar ${dressing.id} sesuai daftar.`,
        ),
      },
      {
        title: t("調好沙律汁", "Mix the named dressing", "Campur saus salad"),
        instruction: t(
          `有蓋小樽加入${dressing.zh}及${aromatics.zh}，搖 20 秒至均勻；先試一小滴，味道應酸甜平衡而不過鹹。`,
          `Put ${dressing.en} and ${aromatics.en} in a lidded jar and shake for 20 seconds. Taste one drop; it should be balanced and not overly salty.`,
          `Masukkan ${dressing.id} dan ${aromatics.id} ke botol bertutup lalu kocok 20 detik. Cicipi setetes; rasanya harus seimbang dan tidak terlalu asin.`,
        ),
      },
      {
        title: t("鹽醃主料去水", "Salt briefly to remove water", "Garam sebentar untuk mengeluarkan air"),
        instruction: t(
          `${food.zh}拌入食材表約一半鹽，靜置 10 分鐘；用清水快速沖走表面鹽分，再用廚紙徹底印乾。此菜主料保持生爽，不可落鑊煎。`,
          `Toss ${food.en} with about half the listed salt and rest for 10 minutes. Rinse off the surface salt quickly and blot thoroughly dry. Keep the main ingredient raw and crisp; do not pan-fry it.`,
          `Aduk ${food.id} dengan sekitar setengah garam yang tercantum dan diamkan 10 menit. Bilas cepat garam permukaan lalu keringkan. Bahan utama harus tetap mentah dan renyah; jangan digoreng.`,
        ),
      },
      {
        title: t("加入新鮮配菜", "Add the fresh vegetables", "Tambahkan sayuran segar"),
        instruction: t(
          `大碗放入已印乾的${food.zh}及${vegetables.zh}，用乾淨筷子由底向上翻拌，保持蔬菜完整。`,
          `Put the dried ${food.en} and ${vegetables.en} in a large bowl. Lift and turn with clean chopsticks, keeping the vegetables intact.`,
          `Masukkan ${food.id} yang sudah kering dan ${vegetables.id} ke mangkuk besar. Aduk balik dengan sumpit bersih sambil menjaga sayuran tetap utuh.`,
        ),
      },
      {
        title: t("逐少拌汁", "Dress gradually", "Tambahkan saus bertahap"),
        instruction: t(
          "先倒入一半沙律汁，輕拌 20 秒；試味後才逐湯匙加入其餘沙律汁，碗底不可積聚大量水分。",
          "Add half the dressing and toss gently for 20 seconds. Taste before adding the rest a tablespoon at a time; liquid should not pool heavily in the bottom.",
          "Tuang setengah saus dan aduk perlahan 20 detik. Cicipi sebelum menambah sisanya sesendok demi sesendok; cairan tidak boleh menggenang banyak di dasar.",
        ),
      },
      {
        title: t("冷藏短休及上碟", "Chill briefly and serve", "Dinginkan sebentar dan sajikan"),
        instruction: t(
          "加蓋冷藏 10 分鐘讓味道融合，食用前再輕拌一次。蔬菜應保持爽脆；室溫放置不要超過 2 小時。",
          "Cover and chill for 10 minutes, then toss once more before serving. The vegetables should remain crisp; do not leave at room temperature for more than 2 hours.",
          "Tutup dan dinginkan 10 menit, lalu aduk sekali lagi sebelum disajikan. Sayuran harus tetap renyah; jangan dibiarkan pada suhu ruang lebih dari 2 jam.",
        ),
      },
    ];
  }

  if (spec.title.en === "Shredded chicken cold noodles") {
    return [
      { title: t("備雞肉及青瓜", "Prepare chicken and cucumber", "Siapkan ayam dan mentimun"), instruction: t("雞胸肉不用清洗，用廚紙抹乾；薑切片，蔥切段，青瓜切幼絲。乾麵、生抽、砂糖、麻油、食油及鹽按食材表量好。", "Do not wash the chicken breast; pat it dry. Slice the ginger, cut the spring onion into lengths and julienne the cucumber. Measure the dried noodles, light soy sauce, sugar, sesame oil, cooking oil and salt exactly as listed.", "Dada ayam tidak perlu dicuci; keringkan. Iris jahe, potong daun bawang, dan iris mentimun halus. Takar mi kering, kecap asin ringan, gula, minyak wijen, minyak goreng, dan garam.") },
      { title: t("浸熟雞肉", "Poach the chicken", "Rebus ayam perlahan"), instruction: t("中式鑊加水、薑及一半蔥煮至微滾，放入雞胸肉，小火加蓋浸煮 10–12 分鐘；最厚處達 75°C 後盛起放涼，煮雞水留半杯。", "Bring water, ginger and half the spring onion to a gentle simmer in the wok. Add the chicken breast, cover and poach on low for 10–12 minutes. Remove when the thickest part reaches 75°C, cool, and reserve half a cup of poaching liquid.", "Didihkan perlahan air, jahe, dan setengah daun bawang dalam wajan. Masukkan dada ayam, tutup dan rebus api kecil 10–12 menit. Angkat saat bagian paling tebal mencapai 75°C, dinginkan, dan simpan setengah cangkir air rebusan.") },
      { title: t("煮麵過冷河", "Cook and chill the noodles", "Masak dan dinginkan mi"), instruction: t("煮雞水補清水後煮滾，乾麵依包裝時間煮熟；瀝乾後立即以凍開水沖至完全冷卻，再徹底瀝乾，拌入食油防黏。", "Top up the poaching liquid with water and bring to a boil. Cook the dried noodles for the packet time, drain, rinse immediately with cold drinking water until fully cool, drain well and toss with cooking oil to prevent sticking.", "Tambahkan air ke air rebusan ayam dan didihkan. Masak mi kering sesuai waktu kemasan, tiriskan, segera bilas dengan air minum dingin sampai sejuk, tiriskan baik-baik, lalu aduk dengan minyak goreng.") },
      { title: t("調冷麵汁", "Mix the cold-noodle dressing", "Campur saus mi dingin"), instruction: t("小碗拌勻生抽、砂糖、麻油、鹽及 3 湯匙已放涼的煮雞水，至砂糖溶解。", "Stir the light soy sauce, sugar, sesame oil, salt and 3 tablespoons cooled poaching liquid until the sugar dissolves.", "Aduk kecap asin ringan, gula, minyak wijen, garam, dan 3 sdm air rebusan dingin sampai gula larut.") },
      { title: t("拆雞絲及拌麵", "Shred chicken and toss", "Suwir ayam dan aduk mi"), instruction: t("雞胸肉順紋拆成幼絲。大碗放凍麵、雞絲、青瓜及餘下蔥，先加一半冷麵汁拌勻，再按需要加入其餘汁。", "Shred the chicken breast with the grain. Combine the cold noodles, shredded chicken, cucumber and remaining spring onion; toss with half the dressing, adding more only as needed.", "Suwir dada ayam searah serat. Campur mi dingin, ayam suwir, mentimun, dan sisa daun bawang; aduk dengan setengah saus dan tambah sisanya sesuai kebutuhan.") },
      { title: t("冷藏及上碟", "Chill and serve", "Dinginkan dan sajikan"), instruction: t("加蓋冷藏 15 分鐘後上碟。雞肉中心不可有粉紅色，冷麵應乾爽不積水；室溫勿放超過 2 小時。", "Cover and chill for 15 minutes before serving. The chicken must have no pink centre and the noodles should be separate without pooled liquid; do not leave at room temperature for more than 2 hours.", "Tutup dan dinginkan 15 menit sebelum disajikan. Ayam tidak boleh merah muda di tengah dan mi tidak boleh berair; jangan dibiarkan pada suhu ruang lebih dari 2 jam.") },
    ];
  }

  if (spec.title.en === "Japanese tofu hamburger steak") {
    return [
      { title: t("壓乾豆腐及切配料", "Drain tofu and cut vegetables", "Tiriskan tahu dan potong sayuran"), instruction: t("硬豆腐以廚紙包好，上面放碟壓 15 分鐘後捏碎。雜菌、洋蔥、薑及蔥切幼；雞蛋打入小碗。麵包糠、生抽、砂糖、麻油、食油及鹽按食材表量好。", "Wrap the firm tofu in kitchen paper, weight it with a plate for 15 minutes, then crumble it. Finely cut the mixed mushrooms, onion, ginger and spring onion; crack the egg into a small bowl. Measure breadcrumbs, light soy sauce, sugar, sesame oil, cooking oil and salt.", "Bungkus tahu padat dengan tisu dapur, tindih dengan piring 15 menit, lalu hancurkan. Cincang jamur, bawang bombai, jahe, dan daun bawang; pecahkan telur ke mangkuk kecil. Takar tepung roti, kecap asin ringan, gula, minyak wijen, minyak goreng, dan garam.") },
      { title: t("炒乾雜菌洋蔥", "Cook mushrooms and onion dry", "Masak jamur dan bawang sampai kering"), instruction: t("中式鑊中火加少量食油，炒洋蔥及雜菌 5–6 分鐘至軟且水分蒸發；加入一半薑蔥炒 30 秒，盛起完全放涼。", "Heat a little cooking oil in the wok over medium. Cook the onion and mixed mushrooms for 5–6 minutes until soft and their moisture evaporates. Add half the ginger and spring onion for 30 seconds, then cool completely.", "Panaskan sedikit minyak goreng dalam wajan. Masak bawang bombai dan jamur 5–6 menit sampai lunak dan airnya menguap. Tambahkan setengah jahe dan daun bawang 30 detik, lalu dinginkan.") },
      { title: t("拌勻及成形", "Mix and shape patties", "Campur dan bentuk patty"), instruction: t("大碗放碎豆腐、已放涼雜菌洋蔥、雞蛋、麵包糠及鹽，拌至能黏合；分成 3 個約 2 厘米厚漢堡扒，壓實邊緣後冷藏 10 分鐘。", "Combine the crumbled tofu, cooled mushroom-onion mixture, eggs, breadcrumbs and salt until bound. Shape 3 patties about 2 cm thick, firm the edges and chill for 10 minutes.", "Campur tahu hancur, campuran jamur-bawang yang dingin, telur, tepung roti, dan garam sampai menyatu. Bentuk 3 patty setebal sekitar 2 cm, rapikan tepi dan dinginkan 10 menit.") },
      { title: t("兩面煎至定形", "Pan-fry both sides", "Goreng kedua sisi"), instruction: t("平底鑊中火預熱 2 分鐘，加餘下食油。放入豆腐漢堡扒，每面煎 4–5 分鐘至金黃定形；用闊鑊鏟完整翻面。", "Preheat the frying pan over medium for 2 minutes and add the remaining cooking oil. Fry the tofu patties for 4–5 minutes per side until golden and set, turning with a broad spatula.", "Panaskan wajan datar 2 menit dan tambahkan sisa minyak goreng. Goreng patty tahu 4–5 menit tiap sisi sampai keemasan dan kokoh, balik dengan spatula lebar.") },
      { title: t("煮薑汁掛面", "Glaze with ginger sauce", "Lapisi saus jahe"), instruction: t("小碗拌生抽、砂糖、麻油、餘下薑蔥及 3 湯匙水，倒入平底鑊；小火煮 1–2 分鐘並把汁淋在漢堡扒上，至薄薄掛面。", "Mix light soy sauce, sugar, sesame oil, remaining ginger and spring onion with 3 tablespoons water. Add to the pan and simmer 1–2 minutes, spooning it over the patties until lightly glazed.", "Campur kecap asin ringan, gula, minyak wijen, sisa jahe dan daun bawang dengan 3 sdm air. Tuang ke wajan dan masak 1–2 menit sambil menyiram patty sampai terlapisi tipis.") },
      { title: t("中心熱透上碟", "Check the centre and serve", "Periksa bagian tengah dan sajikan"), instruction: t("切開最厚一件，中心應完全熱透且蛋液凝固，豆腐扒仍保持完整。熄火靜置 2 分鐘後上碟。", "Cut the thickest patty: the centre must be hot, the egg fully set and the tofu patty intact. Turn off the heat and rest for 2 minutes before serving.", "Potong patty paling tebal: bagian tengah harus panas, telur mengeras, dan patty tahu tetap utuh. Matikan api dan diamkan 2 menit sebelum disajikan.") },
    ];
  }

  if (spec.title.en === "Japanese-Chinese omelette rice") {
    return [
      { title: t("煮飯及備料", "Cook rice and prepare", "Masak nasi dan siapkan bahan"), instruction: t("白米洗淨，與 1.2 倍水在中式鑊煮滾，加蓋最小火 12 分鐘，熄火焗 10 分鐘後鬆飯。粟米、雜菌、薑及蔥切好；雞蛋打散。上湯、生抽、白胡椒、食油及鹽量好。", "Rinse the jasmine rice, bring it to a boil in the wok with 1.2 times its volume of water, cover and cook on the lowest heat for 12 minutes, then rest off heat for 10 minutes and fluff. Prepare sweet corn kernels, mixed mushrooms, ginger and spring onion; beat the eggs. Measure low-salt vegetable stock, light soy sauce, white pepper, cooking oil and salt.", "Cuci beras melati, didihkan dalam wajan dengan air 1,2 kali volumenya, tutup dan masak api paling kecil 12 menit, lalu diamkan 10 menit dan uraikan. Siapkan jagung, jamur, jahe, dan daun bawang; kocok telur. Takar kaldu sayur, kecap asin ringan, lada putih, minyak goreng, dan garam.") },
      { title: t("調飯汁及蛋液", "Season rice sauce and egg", "Bumbui saus nasi dan telur"), instruction: t("上湯、生抽及白胡椒拌成飯汁。雞蛋只加一小撮鹽，打至剛混合，不要把飯汁倒入蛋液。", "Mix the vegetable stock, light soy sauce and white pepper as the rice seasoning. Add only a pinch of salt to the eggs and beat just to combine; do not add the rice sauce to the egg.", "Campur kaldu sayur, kecap asin ringan, dan lada putih sebagai bumbu nasi. Tambahkan sedikit garam ke telur dan kocok sekadar tercampur; jangan masukkan saus nasi ke telur.") },
      { title: t("炒香粟米雜菌", "Cook corn and mushrooms", "Masak jagung dan jamur"), instruction: t("中式鑊中大火加一半食油，薑蔥炒 20 秒，加入雜菌炒至水分蒸發，再加粟米炒 1 分鐘。", "Heat half the cooking oil in the wok over medium-high. Cook ginger and spring onion for 20 seconds, add mixed mushrooms until their liquid evaporates, then add sweet corn for 1 minute.", "Panaskan setengah minyak goreng. Masak jahe dan daun bawang 20 detik, tambah jamur sampai airnya menguap, lalu jagung 1 menit.") },
      { title: t("炒成調味飯", "Make the seasoned rice", "Buat nasi berbumbu"), instruction: t("加入熱飯壓散，大火炒 2 分鐘；飯汁沿鑊邊分兩次加入，炒至飯粒乾爽。盛入 3 個碗輕壓成半圓，保溫備用。", "Add the hot rice, break it up and fry on high for 2 minutes. Add the rice seasoning around the wok edge in two additions and fry until dry. Press into 3 bowls to form domes and keep warm.", "Masukkan nasi panas, uraikan dan goreng api besar 2 menit. Tuang bumbu nasi di tepi wajan dalam dua tahap sampai nasi kering. Tekan ke 3 mangkuk membentuk kubah dan jaga hangat.") },
      { title: t("逐底煎滑蛋皮", "Cook three soft omelettes", "Masak tiga omelet lembut"), instruction: t("抹淨中式鑊，轉中火加少量餘下食油。蛋液分三份，每份倒入後轉鑊鋪薄，底部凝固而表面仍微濕時熄火。", "Wipe the wok, heat over medium and add a little remaining cooking oil. Divide the egg into three portions; swirl each thinly and turn off the heat when the base is set but the surface remains slightly moist.", "Lap wajan, panaskan api sedang dan tambah sedikit sisa minyak. Bagi telur tiga; ratakan tipis dan matikan api saat dasar mengeras tetapi permukaan masih sedikit lembap.") },
      { title: t("蛋皮蓋飯上碟", "Cover rice with omelette", "Tutup nasi dengan omelet"), instruction: t("每碗飯反扣上碟，立即把一塊蛋皮滑到飯面並包住兩側。蛋白必須凝固、不可有流動蛋液；趁熱食用。", "Turn each rice dome onto a plate and immediately slide an omelette over it, folding down the sides. The egg white must be set with no liquid egg remaining; serve hot.", "Balik tiap kubah nasi ke piring dan segera selipkan omelet di atasnya, lipat sisi-sisinya. Putih telur harus mengeras tanpa telur cair; sajikan panas.") },
    ];
  }

  if (spec.title.en === "Korean beef bibimbap") {
    return [
      { title: t("煮飯及切配料", "Cook rice and cut ingredients", "Masak nasi dan potong bahan"), instruction: t("白米以中式鑊煮熟並保溫。牛肉片、菠菜、甘筍、雜菌、蒜頭及蔥分開切好；雞蛋逐隻打入小碗。韓式辣醬、生抽、麻油、砂糖、食油及鹽量好。", "Cook the jasmine rice in the Chinese wok and keep warm. Prepare sliced beef flank, spinach, carrot, mixed mushrooms, garlic and spring onion separately; crack each egg into a small bowl. Measure gochujang, light soy sauce, sesame oil, sugar, cooking oil and salt.", "Masak beras melati dalam wajan dan jaga hangat. Siapkan irisan sapi, bayam, wortel, jamur, bawang putih, dan daun bawang terpisah; pecahkan telur satu per satu. Takar gochujang, kecap asin ringan, minyak wijen, gula, minyak goreng, dan garam.") },
      { title: t("醃牛肉及調辣醬", "Marinate beef and mix sauce", "Rendam sapi dan campur saus"), instruction: t("生抽、半份蒜頭、半份麻油及砂糖拌勻，加入牛肉片冷藏醃 10 分鐘。韓式辣醬與 2 湯匙水另碗調開，留待上碟。", "Mix light soy sauce, half the garlic, half the sesame oil and sugar; coat the sliced beef and refrigerate for 10 minutes. Thin the gochujang with 2 tablespoons water in a separate bowl for serving.", "Campur kecap asin ringan, setengah bawang putih, setengah minyak wijen, dan gula; lumuri irisan sapi dan dinginkan 10 menit. Encerkan gochujang dengan 2 sdm air di mangkuk terpisah.") },
      { title: t("分開炒三色蔬菜", "Cook vegetables separately", "Masak sayuran terpisah"), instruction: t("中式鑊中火加少量食油，依次把甘筍、雜菌、菠菜各炒 2–3 分鐘；每樣用少許鹽及餘下蒜頭調味，分開盛起，不要混成一鑊。", "Heat a little cooking oil in the wok. Cook carrot, mixed mushrooms and spinach separately for 2–3 minutes each, seasoning with a little salt and remaining garlic. Keep each vegetable separate.", "Panaskan sedikit minyak. Masak wortel, jamur, dan bayam terpisah masing-masing 2–3 menit, bumbui sedikit garam dan sisa bawang putih. Simpan terpisah.") },
      { title: t("炒熟牛肉", "Cook the beef", "Masak daging sapi"), instruction: t("中大火把牛肉片單層放入鑊，先煎 60 秒再炒 2–3 分鐘至中心熱透、沒有生冷位置；加入蔥粒拌勻盛起。", "Lay the sliced beef in one layer over medium-high heat, sear for 60 seconds, then stir-fry for 2–3 minutes until hot with no raw cold centre. Toss with spring onion and remove.", "Susun irisan sapi satu lapis dengan api sedang-besar, panggang 60 detik lalu tumis 2–3 menit sampai panas tanpa bagian mentah dingin. Aduk daun bawang lalu angkat.") },
      { title: t("煎三隻蛋", "Fry three eggs", "Goreng tiga telur"), instruction: t("平底鑊加餘下食油，中火逐隻煎雞蛋；蛋白完全凝固，如家庭需要全熟蛋黃便加蓋多煮 2 分鐘。", "Add the remaining cooking oil to the frying pan and fry the eggs over medium. Set the whites fully; cover for 2 extra minutes if the household wants firm yolks.", "Tambahkan sisa minyak ke wajan datar dan goreng telur dengan api sedang. Putih harus mengeras; tutup 2 menit tambahan bila ingin kuning matang keras.") },
      { title: t("分色排碗", "Assemble in separate sections", "Susun mangkuk berbagian"), instruction: t("熱飯分 3 碗，牛肉、甘筍、雜菌及菠菜分成四區排在飯面，中央放煎蛋。淋餘下麻油，韓式辣醬另上，食用前才拌勻。", "Divide hot rice among 3 bowls. Arrange beef, carrot, mushrooms and spinach in four separate sections and put a fried egg in the centre. Drizzle remaining sesame oil and serve gochujang separately; mix only before eating.", "Bagi nasi panas ke 3 mangkuk. Susun sapi, wortel, jamur, dan bayam dalam empat bagian, taruh telur di tengah. Teteskan sisa minyak wijen dan sajikan gochujang terpisah; campur saat akan dimakan.") },
    ];
  }

  if (spec.title.en === "Mild chilli dumpling-style soup") {
    return [
      { title: t("搓麵糰及備餡", "Make dough and prepare filling", "Buat adonan dan siapkan isian"), instruction: t("中筋麵粉加一小撮鹽及約 90 毫升暖水，搓 8 分鐘成光滑麵糰，蓋好醒 30 分鐘。椰菜、蒜頭及蔥切幼；免治豬肉保持冷藏。韓式辣醬、生抽、麻油、砂糖、食油及餘下鹽量好。", "Knead plain flour, a pinch of salt and about 90 ml warm water for 8 minutes until smooth; cover and rest 30 minutes. Finely cut cabbage, garlic and spring onion; keep minced pork chilled. Measure gochujang, light soy sauce, sesame oil, sugar, cooking oil and remaining salt.", "Uleni tepung terigu, sedikit garam, dan sekitar 90 ml air hangat 8 menit sampai halus; tutup dan diamkan 30 menit. Cincang kol, bawang putih, dan daun bawang; simpan daging babi cincang tetap dingin. Takar gochujang, kecap asin ringan, minyak wijen, gula, minyak goreng, dan sisa garam.") },
      { title: t("拌實肉菜餡", "Mix the pork-cabbage filling", "Campur isian babi-kol"), instruction: t("免治豬肉加入椰菜、一半蒜蔥、一半生抽、麻油及砂糖，向同一方向攪 2 分鐘至黏實；冷藏 15 分鐘。", "Mix minced pork with cabbage, half the garlic and spring onion, half the light soy sauce, sesame oil and sugar in one direction for 2 minutes until tacky; chill 15 minutes.", "Campur daging babi cincang dengan kol, setengah bawang putih dan daun bawang, setengah kecap asin ringan, minyak wijen, dan gula searah 2 menit sampai lengket; dinginkan 15 menit.") },
      { title: t("擀皮包餃子", "Roll and fill dumplings", "Gilas dan isi pangsit"), instruction: t("麵糰分成 18 份，逐份擀成約 8 厘米圓皮；中央放一平茶匙餡，邊緣沾水對摺捏實。生餃放撒粉碟，彼此不要相貼。", "Divide the dough into 18 pieces and roll each into an 8 cm round. Put a level teaspoon of filling in the centre, moisten the edge, fold and seal firmly. Keep raw dumplings apart on a floured plate.", "Bagi adonan 18 bagian dan gilas tiap bagian menjadi bulat 8 cm. Taruh 1 sdt rata isian, basahi tepi, lipat dan rekatkan. Pisahkan pangsit mentah di piring bertabur tepung.") },
      { title: t("煮香微辣湯底", "Make the mild chilli broth", "Buat kuah cabai ringan"), instruction: t("中式鑊中火加食油，炒餘下蒜頭 20 秒；加入韓式辣醬炒 20 秒，再加 1.2 公升水及餘下生抽煮滾，試味後才加鹽。", "Heat cooking oil in the wok over medium and cook remaining garlic for 20 seconds. Add gochujang for 20 seconds, then 1.2 litres water and remaining light soy sauce; bring to a boil and add salt only after tasting.", "Panaskan minyak goreng dan masak sisa bawang putih 20 detik. Tambahkan gochujang 20 detik, lalu 1,2 liter air dan sisa kecap asin ringan; didihkan dan tambahkan garam setelah mencicipi.") },
      { title: t("下餃子煮至浮起", "Boil dumplings until floating", "Rebus pangsit sampai mengapung"), instruction: t("湯保持中滾，餃子逐隻放入並用鑊鏟輕推防黏底。浮起後再煮 4–5 分鐘；切開一隻檢查肉餡完全熟透，中心達 71°C。", "Keep the broth at a steady boil, add dumplings one by one and move gently to prevent sticking. Once they float, cook 4–5 minutes more. Cut one open: the pork filling must be fully cooked and reach 71°C.", "Jaga kuah mendidih stabil, masukkan pangsit satu per satu dan gerakkan perlahan agar tidak lengket. Setelah mengapung, masak 4–5 menit lagi. Belah satu; isian babi harus matang dan mencapai 71°C.") },
      { title: t("加蔥分碗", "Finish with spring onion", "Selesaikan dengan daun bawang"), instruction: t("熄火加入餘下蔥粒，餃子及湯平均分 3 碗。餃皮應熟透不見白色麵粉芯，肉餡沒有粉紅色。", "Turn off the heat and add remaining spring onion. Divide dumplings and broth among 3 bowls. Wrappers must have no white floury centre and the pork filling must show no pink.", "Matikan api dan tambahkan sisa daun bawang. Bagi pangsit dan kuah ke 3 mangkuk. Kulit tidak boleh memiliki bagian tepung putih dan isian babi tidak boleh merah muda.") },
    ];
  }

  if (spec.title.en === "Thai basil minced pork") {
    return [
      { title: t("備免治肉及香料", "Prepare mince and aromatics", "Siapkan daging cincang dan bumbu"), instruction: t("免治豬肉不用清洗，保持冷藏並撥鬆。蒜頭、乾蔥、羅勒、青檸及甜椒切好；雞蛋逐隻打入小碗。魚露、生抽、砂糖、食油及鹽量好。", "Do not wash minced pork; keep it chilled and loosen it. Prepare garlic, shallots, fresh basil, lime and bell pepper; crack eggs into separate bowls. Measure fish sauce, light soy sauce, sugar, cooking oil and salt.", "Daging babi cincang tidak perlu dicuci; jaga dingin dan uraikan. Siapkan bawang putih, bawang merah, kemangi, jeruk nipis, dan paprika; pecahkan telur terpisah. Takar kecap ikan, kecap asin ringan, gula, minyak goreng, dan garam.") },
      { title: t("調魚露汁", "Mix the fish-sauce seasoning", "Campur bumbu kecap ikan"), instruction: t("魚露、生抽、砂糖、鹽、1 湯匙青檸汁及 2 湯匙水拌至溶解；先不要倒入免治肉。", "Stir fish sauce, light soy sauce, sugar, salt, 1 tablespoon lime juice and 2 tablespoons water until dissolved; do not add it to the mince yet.", "Aduk kecap ikan, kecap asin ringan, gula, garam, 1 sdm air jeruk nipis, dan 2 sdm air sampai larut; jangan masukkan ke daging dulu."), produces: ["fish-sauce-seasoning"] },
      { title: t("先煎三隻蛋", "Fry three eggs first", "Goreng tiga telur dahulu"), instruction: t("平底鑊中火加少量食油，逐隻煎蛋至蛋白完全凝固；盛起保溫。", "Heat a little cooking oil in the frying pan and fry the eggs until the whites are fully set; keep warm.", "Panaskan sedikit minyak dalam wajan datar dan goreng telur sampai putih mengeras; jaga hangat."), produces: ["fried-eggs"] },
      { title: t("爆香炒散豬肉", "Stir-fry and break up pork", "Tumis dan uraikan babi"), instruction: t("中式鑊大火加餘下食油，蒜頭、乾蔥炒 30 秒；加入免治豬肉，以鑊鏟壓散炒 5–7 分鐘至完全變色、中心達 71°C。", "Heat remaining cooking oil in the wok over high. Cook garlic and shallots for 30 seconds, add minced pork and break it up for 5–7 minutes until no raw colour remains and it reaches 71°C.", "Panaskan sisa minyak dengan api besar. Masak bawang putih dan bawang merah 30 detik, tambah daging babi cincang dan uraikan 5–7 menit sampai tidak mentah dan mencapai 71°C."), produces: ["cooked-pork"] },
      { title: t("加甜椒羅勒收汁", "Add pepper, basil and sauce", "Tambahkan paprika, kemangi, dan saus"), instruction: t("加入甜椒炒 2 分鐘，倒入魚露汁大火炒 1 分鐘；熄火後加入羅勒，翻拌至剛軟。", "Add bell pepper for 2 minutes, pour in the reserved fish-sauce seasoning and toss on high for 1 minute. Turn off the heat, add fresh basil and fold until just wilted.", "Tambahkan paprika 2 menit, tuang bumbu kecap ikan dan aduk api besar 1 menit. Matikan api, masukkan kemangi sampai baru layu."), consumes: ["fish-sauce-seasoning", "cooked-pork"], produces: ["finished-basil-pork"] },
      { title: t("配煎蛋上碟", "Serve with fried eggs", "Sajikan dengan telur goreng"), instruction: t("免治豬肉分 3 碟，每碟放一隻煎蛋，按口味加餘下青檸汁。肉不可有粉紅色，羅勒保持綠色。", "Divide the minced pork among 3 plates, top each with a fried egg and add remaining lime juice to taste. Pork must show no pink and fresh basil should remain green.", "Bagi daging babi cincang ke 3 piring, beri telur goreng dan sisa air jeruk sesuai selera. Babi tidak boleh merah muda dan kemangi tetap hijau."), consumes: ["finished-basil-pork", "fried-eggs"] },
    ];
  }

  if (spec.title.en === "Thai minced chicken lettuce cups") {
    return [
      { title: t("剁雞肉及洗生菜", "Mince chicken and wash lettuce", "Cincang ayam dan cuci selada"), instruction: t("雞胸肉不用清洗，抹乾後用刀剁成粗粒。生菜葉逐片洗淨並徹底印乾；甘筍、粟米、蒜頭、乾蔥、羅勒、青檸切好。魚露、生抽、砂糖、食油及鹽量好。", "Do not wash chicken breast; pat dry and hand-chop to a coarse mince. Wash lettuce leaves separately and blot completely dry. Prepare carrot, sweet corn kernels, garlic, shallots, fresh basil and lime. Measure fish sauce, light soy sauce, sugar, cooking oil and salt.", "Dada ayam tidak perlu dicuci; keringkan dan cincang kasar. Cuci daun selada satu per satu dan keringkan. Siapkan wortel, jagung, bawang putih, bawang merah, kemangi, dan jeruk nipis. Takar kecap ikan, kecap asin ringan, gula, minyak goreng, dan garam.") },
      { title: t("調酸甜魚露汁", "Mix sweet-sour fish sauce", "Campur saus ikan asam-manis"), instruction: t("魚露、生抽、砂糖、1 湯匙青檸汁及 3 湯匙水拌勻，留待雞肉熟後加入。", "Mix fish sauce, light soy sauce, sugar, 1 tablespoon lime juice and 3 tablespoons water; reserve until the chicken is cooked.", "Campur kecap ikan, kecap asin ringan, gula, 1 sdm air jeruk nipis, dan 3 sdm air; simpan sampai ayam matang.") },
      { title: t("炒香蒜蔥雞肉", "Cook aromatics and chicken", "Masak bumbu dan ayam"), instruction: t("中式鑊中大火加食油，蒜頭及乾蔥炒 30 秒；加入雞肉粗粒壓散炒 5–7 分鐘，至沒有粉紅色及中心達 75°C。", "Heat cooking oil in the wok over medium-high. Cook garlic and shallots for 30 seconds, add chopped chicken and break it up for 5–7 minutes until no pink remains and it reaches 75°C.", "Panaskan minyak dalam wajan. Masak bawang putih dan bawang merah 30 detik, tambah ayam cincang dan uraikan 5–7 menit sampai tidak merah muda dan mencapai 75°C.") },
      { title: t("加甘筍粟米", "Add carrot and corn", "Tambahkan wortel dan jagung"), instruction: t("加入甘筍及粟米炒 3 分鐘至剛軟，倒入魚露汁大火炒 1–2 分鐘至鑊底乾身。", "Add carrot and sweet corn kernels for 3 minutes until just tender. Pour in the fish-sauce mixture and toss on high for 1–2 minutes until the wok is nearly dry.", "Tambahkan wortel dan jagung 3 menit sampai baru lunak. Tuang campuran kecap ikan dan aduk api besar 1–2 menit sampai wajan hampir kering.") },
      { title: t("離火拌羅勒", "Fold in basil off heat", "Masukkan kemangi setelah api mati"), instruction: t("熄火加入羅勒及餘下青檸汁，翻拌 20 秒；試味後才按需要加鹽。餡料放涼 3 分鐘，避免燙軟生菜。", "Turn off the heat, add basil and remaining lime juice, and toss for 20 seconds. Add salt only after tasting. Cool the filling for 3 minutes so it does not wilt the lettuce.", "Matikan api, tambah kemangi dan sisa air jeruk, aduk 20 detik. Tambahkan garam setelah mencicipi. Dinginkan isian 3 menit agar selada tidak layu.") },
      { title: t("逐杯盛入生菜", "Fill lettuce cups", "Isi cangkir selada"), instruction: t("生菜葉排在乾淨碟，每片放 2–3 湯匙雞肉餡，立即上桌。生菜保持乾爽脆口，雞肉必須全熟。", "Arrange lettuce leaves on a clean plate and spoon 2–3 tablespoons chicken filling into each. Serve immediately; lettuce should stay dry and crisp and chicken must be fully cooked.", "Susun daun selada di piring bersih dan isi 2–3 sdm ayam tiap daun. Sajikan segera; selada tetap kering dan renyah, ayam harus matang.") },
    ];
  }

  if (spec.title.en === "Pineapple coconut sticky-rice style dessert") {
    return [
      { title: t("浸糯米及切菠蘿", "Soak rice and cut pineapple", "Rendam beras dan potong nanas"), instruction: t("糯米洗至水接近清澈，浸凍水至少 4 小時後瀝乾。菠蘿件切成 2 厘米粒；椰奶、砂糖、食油及鹽按食材表量好。", "Rinse glutinous rice until the water is nearly clear, soak in cold water for at least 4 hours, then drain. Cut pineapple chunks into 2 cm pieces and measure coconut milk, sugar, cooking oil and salt.", "Cuci beras ketan sampai air hampir jernih, rendam air dingin minimal 4 jam, lalu tiriskan. Potong nanas 2 cm dan takar santan, gula, minyak goreng, dan garam.") },
      { title: t("煮椰奶甜汁", "Make coconut sauce", "Buat saus santan"), instruction: t("中式鑊小火加入椰奶、砂糖及一小撮鹽，不停攪拌 3–4 分鐘至砂糖溶解；不可大滾。盛起三分之一留作淋汁。", "Heat coconut milk, sugar and a pinch of salt in the wok over low for 3–4 minutes, stirring until dissolved without boiling hard. Reserve one third for serving.", "Panaskan santan, gula, dan sedikit garam dengan api kecil 3–4 menit sambil diaduk sampai larut tanpa mendidih keras. Sisihkan sepertiga."), produces: ["coconut-sauce"] },
      { title: t("小火煮熟糯米", "Cook the glutinous rice", "Masak beras ketan"), instruction: t("瀝乾糯米放回中式鑊，加入 260 毫升水煮滾；加蓋轉最小火煮 18–20 分鐘，期間不可開蓋，至水分吸收及米心軟熟。", "Put drained glutinous rice in the wok with 260 ml water and bring to a boil. Cover and cook on the lowest heat for 18–20 minutes without lifting the lid, until the liquid is absorbed and the centre is tender.", "Masukkan beras ketan tiris ke wajan dengan 260 ml air dan didihkan. Tutup dan masak api paling kecil 18–20 menit tanpa membuka tutup sampai air terserap dan bagian tengah lunak."), produces: ["cooked-glutinous-rice"] },
      { title: t("拌椰奶焗飯", "Fold in coconut sauce", "Campur saus santan"), instruction: t("熄火，把鑊內三分之二椰奶甜汁分兩次拌入熱糯米；加蓋靜置 15 分鐘吸收，之後用飯勺輕輕翻鬆。", "Turn off the heat and fold two thirds of the coconut sauce into the hot glutinous rice in two additions. Cover and rest 15 minutes to absorb, then fluff gently.", "Matikan api dan campur dua pertiga saus santan ke beras ketan panas dalam dua tahap. Tutup dan diamkan 15 menit, lalu uraikan perlahan."), consumes: ["coconut-sauce", "cooked-glutinous-rice"], produces: ["coconut-glutinous-rice"] },
      { title: t("煎香菠蘿", "Caramelise pineapple", "Karamelisasi nanas"), instruction: t("平底鑊中火加食油，菠蘿單層煎 2 分鐘，翻面再煎 2 分鐘至邊緣金黃；不要煮成糊狀。", "Heat cooking oil in the frying pan over medium. Cook pineapple chunks in one layer for 2 minutes per side until golden at the edges without turning mushy.", "Panaskan minyak dalam wajan datar. Masak nanas satu lapis 2 menit tiap sisi sampai tepi keemasan tanpa menjadi lembek."), produces: ["caramelised-pineapple"] },
      { title: t("三份上碟淋汁", "Plate three portions", "Sajikan tiga porsi"), instruction: t("椰香糯米分 3 碗，放上煎菠蘿，淋預留椰奶甜汁。糯米應軟糯而仍見米粒；可溫食或冷藏後食用。", "Divide coconut glutinous rice among 3 bowls, top with pineapple chunks and spoon over reserved coconut sauce. The rice should be sticky and tender while grains remain visible; serve warm or chilled.", "Bagi beras ketan santan ke 3 mangkuk, beri nanas dan siram sisa saus santan. Nasi harus lengket dan lembut tetapi butir masih terlihat; sajikan hangat atau dingin."), consumes: ["coconut-sauce", "coconut-glutinous-rice", "caramelised-pineapple"] },
    ];
  }

  if (spec.title.en === "Family-style beef rendang") {
    return [
      { title: t("切牛腩及香料", "Cut beef and aromatics", "Potong sapi dan bumbu"), instruction: t("牛腩不用清洗，抹乾後切 4 厘米件。乾蔥、蒜頭及香茅切幼，薯仔切 4 厘米件。椰奶、咖喱粉、叁巴醬、食油及鹽量好。", "Do not wash beef brisket; pat dry and cut into 4 cm pieces. Finely cut shallots, garlic and lemongrass, and cut potatoes into 4 cm pieces. Measure coconut milk, curry powder, sambal, cooking oil and salt.", "Daging sapi tidak perlu dicuci; keringkan dan potong 4 cm. Cincang bawang merah, bawang putih, dan serai; potong kentang 4 cm. Takar santan, bubuk kari, sambal, minyak goreng, dan garam.") },
      { title: t("炒香叁巴香料", "Fry the rendang paste", "Tumis bumbu rendang"), instruction: t("中式鑊中火加食油，乾蔥、蒜頭及香茅炒 4 分鐘至軟；加入咖喱粉及叁巴醬，不停攪 60 秒至出香味而不焦。", "Heat cooking oil in the wok over medium. Cook shallots, garlic and lemongrass for 4 minutes until soft, then add curry powder and sambal and stir constantly for 60 seconds without burning.", "Panaskan minyak dalam wajan. Masak bawang merah, bawang putih, dan serai 4 menit, lalu tambah bubuk kari dan sambal sambil diaduk 60 detik tanpa gosong.") },
      { title: t("煎香牛腩", "Brown the beef", "Cokelatkan daging sapi"), instruction: t("轉中大火，牛腩分兩批加入，每批煎 4–5 分鐘至表面轉深啡；每批盛起後才煎下一批，避免出水。", "Increase to medium-high and brown beef brisket in two batches for 4–5 minutes each until deeply coloured, removing each batch so the wok does not steam.", "Naikkan api sedang-besar dan cokelatkan daging sapi dalam dua tahap, 4–5 menit tiap tahap, agar tidak berair.") },
      { title: t("加椰奶慢燜", "Add coconut milk and braise", "Tambah santan dan semur"), instruction: t("牛腩全部回鑊，加入椰奶及 250 毫升水煮至微滾；轉最小火半加蓋燜 60 分鐘，每 15 分鐘由鑊底攪一次。", "Return all beef to the wok, add coconut milk and 250 ml water and bring to a gentle simmer. Part-cover and cook on the lowest heat for 60 minutes, stirring from the bottom every 15 minutes.", "Kembalikan semua daging, tambah santan dan 250 ml air lalu didihkan perlahan. Tutup sebagian dan masak api paling kecil 60 menit, aduk dasar tiap 15 menit.") },
      { title: t("加薯仔煮至乾身", "Add potatoes and reduce", "Tambah kentang dan keringkan"), instruction: t("加入薯仔再燜 25–35 分鐘，至牛腩可用叉輕易插入。最後開蓋中小火攪煮 8–12 分鐘，讓油分微微析出、醬汁濃至掛肉。", "Add potatoes and braise another 25–35 minutes until beef is fork-tender. Uncover and stir over medium-low for 8–12 minutes until a little oil separates and the sauce clings to the meat.", "Tambahkan kentang dan semur 25–35 menit sampai daging empuk. Buka tutup dan aduk api sedang-kecil 8–12 menit sampai sedikit minyak keluar dan saus melekat.") },
      { title: t("試味靜置", "Taste and rest", "Cicipi dan diamkan"), instruction: t("試味後才逐少加鹽。熄火靜置 10 分鐘再上碟；牛腩中心必須熱透，醬汁應濃厚而不是水狀。", "Taste before adding salt. Turn off the heat and rest 10 minutes; the beef centre must be hot and the sauce thick rather than watery.", "Cicipi sebelum menambah garam. Matikan api dan diamkan 10 menit; bagian tengah daging harus panas dan saus kental.") },
    ];
  }

  if (spec.title.en === "Indonesian chicken satay") {
    return [
      { title: t("切雞及浸竹籤", "Cut chicken and soak skewers", "Potong ayam dan rendam tusuk"), instruction: t("雞髀肉不用清洗，抹乾後切 3 厘米件。竹籤浸水 30 分鐘。乾蔥、蒜頭及青瓜切好；花生切碎。生抽、咖喱粉、椰奶、砂糖、食油及鹽量好。", "Do not wash boneless chicken thigh; pat dry and cut into 3 cm pieces. Soak bamboo skewers for 30 minutes. Prepare shallots, garlic and cucumber; chop unsalted peanuts. Measure light soy sauce, curry powder, coconut milk, sugar, cooking oil and salt.", "Paha ayam tidak perlu dicuci; keringkan dan potong 3 cm. Rendam tusuk bambu 30 menit. Siapkan bawang merah, bawang putih, mentimun; cincang kacang tanah. Takar kecap asin ringan, bubuk kari, santan, gula, minyak, dan garam.") },
      { title: t("醃雞肉", "Marinate the chicken", "Rendam ayam"), instruction: t("一半乾蔥蒜頭、生抽、咖喱粉、2 湯匙椰奶、砂糖及食油拌勻，加入雞肉冷藏醃 30 分鐘；餘下椰奶留作花生汁。", "Mix half the shallots and garlic with light soy sauce, curry powder, 2 tablespoons coconut milk, sugar and cooking oil. Coat boneless chicken thigh and refrigerate 30 minutes; reserve remaining coconut milk for peanut sauce.", "Campur setengah bawang merah dan putih dengan kecap asin, bubuk kari, 2 sdm santan, gula, dan minyak. Lumuri ayam dan dinginkan 30 menit; simpan santan untuk saus kacang."), produces: ["marinated-chicken"] },
      { title: t("串好及預熱 MX2", "Skewer and preheat MX2", "Tusuk dan panaskan MX2"), instruction: t("雞肉每支串 4–5 件，件與件之間留少許空位，排在鋪焗紙原裝烤盤。MX2 選烤焗 220°C 預熱，蜂鳴後才放入下層。", "Thread the marinated boneless chicken thigh, 4–5 pieces on each skewer with small gaps, and arrange on the lined MX2 supplied tray. Preheat MX2 Bake to 220°C and load on the lower level only after the beep.", "Tusuk 4–5 potong ayam per tusuk dengan jarak kecil dan susun di loyang MX2 beralas. Panaskan MX2 mode Panggang 220°C dan masukkan tingkat bawah setelah bunyi bip."), consumes: ["marinated-chicken"], produces: ["skewered-chicken"] },
      { title: t("焗烤至 75°C", "Bake until 75°C", "Panggang hingga 75°C"), instruction: t("下層焗 8 分鐘後用夾翻面，再焗 6–8 分鐘；最厚雞件中心達 75°C、表面微焦便取出。", "Bake the skewered boneless chicken thigh on the lower level for 8 minutes, turn with tongs, then bake 6–8 minutes more. Remove when the thickest piece reaches 75°C and is lightly charred.", "Panggang tingkat bawah 8 menit, balik dengan penjepit, lalu panggang 6–8 menit. Angkat saat bagian ayam paling tebal mencapai 75°C dan agak terbakar."), consumes: ["skewered-chicken"], produces: ["cooked-satay"] },
      { title: t("煮花生椰奶汁", "Cook peanut coconut sauce", "Masak saus kacang santan"), instruction: t("中式鑊小火炒餘下乾蔥蒜頭 2 分鐘，加入花生、鹽及餘下椰奶，小火攪煮 4–5 分鐘至可掛匙；太稠逐湯匙加水。", "Cook remaining shallots and garlic in the wok over low for 2 minutes. Add unsalted peanuts, salt and remaining coconut milk and stir 4–5 minutes until it coats a spoon, adding water a tablespoon at a time if too thick.", "Masak sisa bawang merah dan putih 2 menit. Tambah kacang tanah, garam, dan sisa santan, aduk 4–5 menit sampai melapisi sendok; tambah air sedikit bila terlalu kental."), produces: ["peanut-sauce"] },
      { title: t("配青瓜上碟", "Serve with cucumber", "Sajikan dengan mentimun"), instruction: t("雞肉串靜置 3 分鐘，與青瓜及花生汁分開上碟。雞肉不可有粉紅色，花生汁趁暖食用。", "Rest the boneless chicken thigh satay for 3 minutes and serve with cucumber and peanut sauce separately. Chicken must show no pink and the sauce is served warm.", "Diamkan sate ayam 3 menit dan sajikan dengan mentimun serta saus kacang terpisah. Ayam tidak boleh merah muda dan saus disajikan hangat."), consumes: ["cooked-satay", "peanut-sauce"] },
    ];
  }

  if (spec.title.en === "Gado-gado warm vegetable salad") {
    return [
      { title: t("切豆腐蔬菜及花生", "Prepare tofu, vegetables and peanuts", "Siapkan tahu, sayuran, dan kacang"), instruction: t("硬豆腐瀝乾印乾切 3 厘米件。薯仔、椰菜切件，芽菜洗淨；雞蛋備好。乾蔥、蒜頭及花生切碎。生抽、咖喱粉、椰奶、砂糖、食油及鹽量好。", "Drain and blot firm tofu and cut into 3 cm pieces. Cut potatoes and cabbage, rinse bean sprouts and prepare eggs. Chop shallots, garlic and unsalted peanuts. Measure light soy sauce, curry powder, coconut milk, sugar, cooking oil and salt.", "Tiriskan tahu dan potong 3 cm. Potong kentang serta kol, cuci tauge, dan siapkan telur. Cincang bawang merah, bawang putih, dan kacang tanah. Takar kecap asin, bubuk kari, santan, gula, minyak, dan garam.") },
      { title: t("煮蛋薯仔及蔬菜", "Boil eggs, potatoes and vegetables", "Rebus telur, kentang, dan sayuran"), instruction: t("中式鑊冷水放雞蛋，水滾後煮 9 分鐘，浸冷水剝殼切半。同鑊煮薯仔 10–12 分鐘至軟；最後 2 分鐘加入椰菜及芽菜焯熟，全部瀝乾分開。", "Start eggs in cold water, boil 9 minutes, chill, peel and halve. Boil potatoes in the same wok for 10–12 minutes until tender, adding cabbage and bean sprouts for the final 2 minutes; drain separately.", "Mulai telur dalam air dingin, rebus 9 menit, dinginkan, kupas, dan belah. Rebus kentang 10–12 menit, masukkan kol dan tauge selama 2 menit terakhir; tiriskan terpisah.") },
      { title: t("煎香豆腐", "Brown the tofu", "Cokelatkan tahu"), instruction: t("平底鑊中火加一半食油，豆腐單層每面煎 3–4 分鐘至金黃，盛起放在廚紙上。", "Heat half the cooking oil in the frying pan. Brown firm tofu in one layer for 3–4 minutes per side, then drain on kitchen paper.", "Panaskan setengah minyak dalam wajan datar. Goreng tahu satu lapis 3–4 menit tiap sisi, lalu tiriskan.") },
      { title: t("煮濃花生汁", "Cook thick peanut sauce", "Masak saus kacang kental"), instruction: t("中式鑊加餘下食油，乾蔥蒜頭炒 2 分鐘；加入花生及咖喱粉炒 30 秒，再加椰奶、生抽、砂糖及 100 毫升水，小火攪煮 5 分鐘至濃稠。", "Heat remaining cooking oil in the wok and cook shallots and garlic for 2 minutes. Add unsalted peanuts and curry powder for 30 seconds, then coconut milk, light soy sauce, sugar and 100 ml water; simmer 5 minutes until thick.", "Panaskan sisa minyak, masak bawang merah dan putih 2 menit. Tambah kacang dan bubuk kari 30 detik, lalu santan, kecap asin, gula, dan 100 ml air; masak 5 menit sampai kental.") },
      { title: t("分區排暖沙律", "Arrange the warm salad", "Susun salad hangat"), instruction: t("薯仔、椰菜、芽菜、豆腐及雞蛋分區排在大碟，不要先全部拌爛；材料保持暖但不應滴水。", "Arrange potatoes, cabbage, bean sprouts, tofu and eggs in separate sections on a platter rather than mixing them into a mash. Keep warm and well drained.", "Susun kentang, kol, tauge, tahu, dan telur dalam bagian terpisah di piring besar. Jaga hangat dan tidak berair.") },
      { title: t("淋花生汁上桌", "Spoon over peanut sauce", "Siram saus kacang"), instruction: t("先淋一半暖花生汁，餘下另上讓家人自行加。試味後才按需要加鹽；雞蛋全熟、薯仔可用叉插入。", "Spoon half the warm peanut sauce over the salad and serve the rest separately. Add salt only after tasting; eggs must be firm and potatoes fork-tender.", "Siram setengah saus kacang hangat dan sajikan sisanya terpisah. Tambah garam setelah mencicipi; telur harus matang dan kentang empuk.") },
    ];
  }

  if (["Chive-style egg pancake", "Korean cabbage pancake"].includes(spec.title.en)) {
    const plan = ingredientPlan(spec);
    const vegetables = namesForKeys(
      [...(freshProduceKeys.has(spec.main) ? [spec.main] : []), ...plan.aromatics, ...plan.produce],
      t("蔬菜", "the vegetables", "sayuran"),
    );
    const seasoning = namesForKeys([...plan.sauces, ...plan.spices], t("鹽", "salt", "garam"));
    const binders = namesForKeys(plan.binders, t("中筋麵粉", "plain flour", "tepung terigu"));
    return [
      {
        title: t("切幼蔬菜及量材料", "Cut vegetables and measure", "Potong sayuran dan takar bahan"),
        instruction: t(
          `${vegetables.zh}洗淨瀝乾，全部切幼。雞蛋逐隻打入小碗；${binders.zh}過篩。${seasoning.zh}及食油按食材表量好。`,
          `Wash, drain and finely cut ${vegetables.en}. Crack the eggs one at a time into a small bowl and sift ${binders.en}. Measure ${seasoning.en} and cooking oil exactly as listed.`,
          `Cuci, tiriskan, dan iris halus ${vegetables.id}. Pecahkan telur satu per satu ke mangkuk kecil dan ayak ${binders.id}. Takar ${seasoning.id} dan minyak goreng sesuai daftar.`,
        ),
      },
      {
        title: t("調成蔬菜麵糊", "Make the vegetable batter", "Buat adonan sayuran"),
        instruction: t(
          `大碗把雞蛋、100 毫升凍水及${seasoning.zh}拌勻，分兩次加入${binders.zh}，拌至沒有乾粉；加入${vegetables.zh}翻拌至均勻，麵糊應能慢慢流動而不是水狀。`,
          `Whisk the eggs with 100 ml cold water and ${seasoning.en}. Add ${binders.en} in two batches and mix until no dry flour remains, then fold in ${vegetables.en}. The batter should flow slowly rather than look watery.`,
          `Kocok telur dengan 100 ml air dingin dan ${seasoning.id}. Masukkan ${binders.id} dalam dua tahap sampai tidak ada tepung kering, lalu aduk balik ${vegetables.id}. Adonan harus mengalir perlahan dan tidak encer.`,
        ),
      },
      {
        title: t("預熱平底鑊", "Preheat the frying pan", "Panaskan wajan datar"),
        instruction: t(
          "平底鑊中火預熱 2 分鐘，加入一半食油並轉動鋪勻；油面微微流動便轉中小火。",
          "Preheat the frying pan over medium for 2 minutes, add half the cooking oil and swirl to coat; reduce to medium-low when the oil shimmers.",
          "Panaskan wajan datar dengan api sedang 2 menit, tambah setengah minyak goreng dan ratakan; kecilkan ke api sedang-kecil saat minyak berkilau.",
        ),
      },
      {
        title: t("分兩底煎第一面", "Cook the first side in two batches", "Masak sisi pertama dalam dua tahap"),
        instruction: t(
          "麵糊分兩份，每份倒入鑊後攤成約 1.5 厘米厚圓餅。中小火加蓋煎 3–4 分鐘，至底部金黃、表面邊緣開始凝固。",
          "Divide the batter in two. Spread each batch into a round about 1.5 cm thick, cover and cook over medium-low for 3–4 minutes until the base is golden and the surface edge begins to set.",
          "Bagi adonan menjadi dua. Ratakan tiap bagian menjadi bulatan setebal sekitar 1,5 cm, tutup dan masak api sedang-kecil 3–4 menit sampai dasar keemasan dan tepi permukaan mulai mengeras.",
        ),
      },
      {
        title: t("翻面煎至中心熟", "Flip and cook the centre", "Balik dan masak bagian tengah"),
        instruction: t(
          "用大鑊鏟完整翻面，鑊邊補少量餘下食油，再煎 3 分鐘。竹籤插入中心拔出沒有濕麵糊；逐底重複。",
          "Turn with a broad spatula, add a little of the remaining cooking oil around the edge and cook for 3 minutes. A skewer inserted in the centre must come out without wet batter; repeat with the second batch.",
          "Balik dengan spatula lebar, tambahkan sedikit sisa minyak goreng di tepi dan masak 3 menit. Tusuk bagian tengah; tidak boleh ada adonan basah. Ulangi untuk bagian kedua.",
        ),
      },
      {
        title: t("靜置切件", "Rest and cut", "Diamkan dan potong"),
        instruction: t(
          "兩底蔬菜餅放在乾淨砧板靜置 2 分鐘，每底切成 6 件。中心要完全凝固，蔬菜仍濕潤而底面保持金黃。",
          "Rest both vegetable pancakes on a clean board for 2 minutes, then cut each into 6 wedges. The centre must be fully set, with moist vegetables and a golden base.",
          "Diamkan kedua panekuk sayuran di talenan bersih 2 menit, lalu potong masing-masing menjadi 6 bagian. Bagian tengah harus mengeras, sayuran tetap lembap, dan dasar keemasan.",
        ),
      },
    ];
  }

  if (spec.title.en === "Family-style okonomiyaki") {
    return [
      {
        title: t("切幼椰菜及備料", "Shred the cabbage and prepare", "Iris kol dan siapkan bahan"),
        instruction: t(
          "椰菜切成約 3 毫米幼絲；薑磨蓉，蔥切粒。雞蛋逐隻打入小碗檢查蛋殼。中筋麵粉過篩，生抽、砂糖、麻油、鹽及食油按食材表量好。",
          "Shred the cabbage into roughly 3 mm strips; grate the ginger and slice the spring onion. Crack each egg into a small bowl and check for shell. Sift the plain flour, then measure the light soy sauce, sugar, sesame oil, salt and cooking oil exactly as listed.",
          "Iris kol setebal sekitar 3 mm; parut jahe dan iris daun bawang. Pecahkan telur satu per satu ke mangkuk kecil dan periksa cangkangnya. Ayak tepung terigu, lalu takar kecap asin ringan, gula, minyak wijen, garam, dan minyak goreng sesuai daftar.",
        ),
      },
      {
        title: t("調成椰菜麵糊", "Make the cabbage batter", "Buat adonan kol"),
        instruction: t(
          "大碗把雞蛋、120 毫升凍水、生抽、砂糖及鹽拌勻；分兩次篩入中筋麵粉，拌至剛好沒有乾粉。加入椰菜、薑及一半蔥粒翻拌，讓每條椰菜薄薄沾上麵糊，不要過度攪拌。",
          "Whisk the eggs with 120 ml cold water, light soy sauce, sugar and salt in a large bowl. Sift in the plain flour in two additions and mix only until no dry flour remains. Fold in the cabbage, ginger and half the spring onion so every strand is lightly coated; do not overmix.",
          "Kocok telur dengan 120 ml air dingin, kecap asin ringan, gula, dan garam dalam mangkuk besar. Ayak tepung terigu dalam dua tahap dan aduk hanya sampai tidak ada tepung kering. Masukkan kol, jahe, dan setengah daun bawang; aduk balik sampai terlapisi tipis tanpa berlebihan.",
        ),
      },
      {
        title: t("預熱平底鑊", "Preheat the frying pan", "Panaskan wajan datar"),
        instruction: t(
          "平底鑊中火預熱 2 分鐘，加入一半食油並轉動鑊身鋪勻；油面微微流動便轉中小火。",
          "Preheat the frying pan over medium for 2 minutes. Add half the cooking oil and swirl to coat; reduce to medium-low when the oil shimmers.",
          "Panaskan wajan datar dengan api sedang 2 menit. Tambahkan setengah minyak goreng dan ratakan; kecilkan ke api sedang-kecil saat minyak berkilau.",
        ),
      },
      {
        title: t("攤平慢煎第一面", "Cook the first side gently", "Masak sisi pertama perlahan"),
        instruction: t(
          "倒入椰菜麵糊，整成約 20 厘米圓餅、厚度不超過 2.5 厘米。加蓋中小火煎 5–6 分鐘，至底部金黃、邊緣開始凝固；未凝固前不要移動。",
          "Pour in the cabbage batter and shape a roughly 20 cm round no thicker than 2.5 cm. Cover and cook over medium-low for 5–6 minutes until the base is golden and the edge begins to set; do not move it before it firms.",
          "Tuang adonan kol dan bentuk bulat sekitar 20 cm dengan tebal maksimal 2,5 cm. Tutup dan masak api sedang-kecil 5–6 menit sampai dasar keemasan dan tepi mulai mengeras; jangan digeser sebelum kokoh.",
        ),
      },
      {
        title: t("完整翻面煎熟", "Flip and cook through", "Balik dan masak hingga matang"),
        instruction: t(
          "把大碟蓋在平底鑊上，戴隔熱手套反轉，再加餘下食油，把餅滑回鑊。加蓋中小火煎 4–5 分鐘；用竹籤插入中心，拔出沒有濕麵糊才算熟。",
          "Cover the pan with a large plate, invert it while wearing oven gloves, add the remaining cooking oil, then slide the pancake back into the pan. Cover and cook on medium-low for 4–5 minutes; a skewer inserted in the centre must come out without wet batter.",
          "Tutup wajan dengan piring besar, balik sambil memakai sarung tangan tahan panas, tambahkan sisa minyak goreng, lalu geser panekuk kembali ke wajan. Tutup dan masak api sedang-kecil 4–5 menit; tusuk bagian tengah dan pastikan tidak ada adonan basah.",
        ),
      },
      {
        title: t("掃汁及上碟", "Glaze and serve", "Oles bumbu dan sajikan"),
        instruction: t(
          "熄火後把麻油薄薄掃在餅面，撒上餘下蔥粒。靜置 2 分鐘後切成 6 件；中心應完全凝固而椰菜仍保持濕潤。",
          "Turn off the heat, brush the sesame oil lightly over the pancake and scatter the remaining spring onion. Rest for 2 minutes, then cut into 6 wedges; the centre must be fully set while the cabbage remains moist.",
          "Matikan api, oles tipis minyak wijen di atas panekuk dan taburkan sisa daun bawang. Diamkan 2 menit lalu potong menjadi 6 bagian; bagian tengah harus mengeras sepenuhnya sementara kol tetap lembap.",
        ),
      },
    ];
  }

  if (spec.title.en === "Palak paneer") {
    return [
      {
        title: t("切芝士及蔬菜", "Prepare paneer and vegetables", "Siapkan paneer dan sayuran"),
        instruction: t(
          "印度芝士用廚紙印乾後切成 3 厘米方件。菠菜洗淨瀝乾並切幼；洋蔥切粒，蒜頭及薑切蓉。罐裝番茄、淡忌廉、印度綜合香料、黃薑粉、孜然粉、鹽及食油按食材表量好。",
          "Blot the paneer and cut into 3 cm cubes. Wash, drain and finely chop the spinach; dice the onion and mince the garlic and ginger. Measure the canned tomatoes, cooking cream, garam masala, turmeric, cumin, salt and cooking oil exactly as listed.",
          "Keringkan paneer dan potong dadu 3 cm. Cuci, tiriskan, dan cincang halus bayam; potong bawang bombai serta cincang bawang putih dan jahe. Takar tomat kalengan, krim masak, garam masala, kunyit, jintan, garam, dan minyak goreng sesuai daftar.",
        ),
      },
      {
        title: t("拌好香料", "Combine the spices", "Campur rempah"),
        instruction: t(
          "小碗混合印度綜合香料、黃薑粉及孜然粉；另留一小撮鹽最後試味才用。香料不要直接放在極熱乾鑊，以免燒焦變苦。",
          "Combine the garam masala, turmeric and ground cumin in a small bowl, keeping a pinch of salt for the final taste check. Do not put the spices into a very hot dry wok, where they can burn and turn bitter.",
          "Campur garam masala, kunyit, dan jintan bubuk dalam mangkuk kecil; sisakan sedikit garam untuk pemeriksaan rasa akhir. Jangan masukkan rempah ke wajan kering yang sangat panas karena dapat gosong dan pahit.",
        ),
        produces: ["palak-spice-mix"],
      },
      {
        title: t("煎香印度芝士", "Brown the paneer", "Cokelatkan paneer"),
        instruction: t(
          "中式鑊中火加一半食油，印度芝士單層排好，每面煎約 90 秒至淺金黃；用鑊鏟盛到乾淨碟，避免久煎變硬。",
          "Heat half the cooking oil in the Chinese wok over medium. Arrange the paneer in one layer and brown for about 90 seconds per side. Transfer to a clean plate before it becomes tough.",
          "Panaskan setengah minyak goreng dalam wajan Tiongkok dengan api sedang. Susun paneer satu lapis dan masak sekitar 90 detik tiap sisi sampai keemasan muda. Angkat sebelum menjadi keras.",
        ),
        produces: ["browned-paneer"],
      },
      {
        title: t("炒洋蔥番茄香料底", "Cook the onion-tomato masala", "Masak masala bawang-tomat"),
        instruction: t(
          "原鑊加餘下食油，中火炒洋蔥 5 分鐘至軟；加入蒜頭及薑炒 30 秒，再加入混合香料炒 20 秒。倒入罐裝番茄，小火煮 6–8 分鐘至醬汁濃稠而沒有生番茄味。",
          "Add the remaining cooking oil to the wok and soften the onion over medium for 5 minutes. Add garlic and ginger for 30 seconds, then the combined spices for 20 seconds. Add the canned tomatoes and simmer for 6–8 minutes until thick with no raw tomato taste.",
          "Tambahkan sisa minyak goreng dan lunakkan bawang bombai dengan api sedang 5 menit. Masukkan bawang putih dan jahe 30 detik, lalu campuran rempah 20 detik. Tambahkan tomat kalengan dan masak perlahan 6–8 menit sampai kental tanpa rasa tomat mentah.",
        ),
        consumes: ["palak-spice-mix"],
        produces: ["onion-tomato-masala"],
      },
      {
        title: t("煮菠菜忌廉汁", "Cook the spinach cream sauce", "Masak saus bayam krim"),
        instruction: t(
          "分三次加入菠菜，每次炒至縮軟才加下一批。菠菜全部軟後加入淡忌廉及 60 毫升水，小火煮 3 分鐘；用鑊鏟把菠菜稍為壓碎，保持幼滑但不用攪拌機。",
          "Add the spinach in three batches, wilting each before adding the next. Stir in the cooking cream and 60 ml water, then simmer for 3 minutes. Press the spinach gently with the spatula for a smoother sauce without needing a blender.",
          "Masukkan bayam dalam tiga tahap, layukan tiap tahap sebelum menambah berikutnya. Tambahkan krim masak dan 60 ml air, lalu masak perlahan 3 menit. Tekan bayam perlahan dengan spatula agar saus lebih halus tanpa blender.",
        ),
        consumes: ["onion-tomato-masala"],
        produces: ["spinach-cream-sauce"],
      },
      {
        title: t("回鑊煮熱及試味", "Return paneer and finish", "Masukkan kembali paneer"),
        instruction: t(
          "印度芝士回鑊，輕輕拌入菠菜汁，小火煮 2–3 分鐘至中心熱透。試味後才逐少加鹽；熄火靜置 2 分鐘，菠菜汁應能掛在芝士表面。",
          "Return the paneer and fold it gently through the spinach sauce. Simmer for 2–3 minutes until hot in the centre. Taste before adding the reserved salt, then turn off the heat and rest for 2 minutes; the sauce should cling to the paneer.",
          "Masukkan kembali paneer dan aduk perlahan dalam saus bayam. Masak 2–3 menit sampai bagian tengah panas. Cicipi sebelum menambah sisa garam, matikan api dan diamkan 2 menit; saus harus melekat pada paneer.",
        ),
        consumes: ["browned-paneer", "spinach-cream-sauce"],
      },
    ];
  }
  return null;
}

function familyForSpec(spec) {
  if (isRiceBakeSpec(spec)) return "bakedRice";
  if (spec.title.en === "Family-style okonomiyaki") return "cabbagePancake";
  if (spec.title.en === "Palak paneer") return "spinachCurry";
  if (spec.title.en === "Shredded chicken cold noodles") return "coldNoodles";
  if (spec.title.en === "Japanese tofu hamburger steak") return "tofuPatty";
  if (spec.title.en === "Japanese-Chinese omelette rice") return "omeletteRice";
  if (spec.title.en === "Korean beef bibimbap") return "bibimbap";
  if (spec.title.en === "Mild chilli dumpling-style soup") return "dumplingSoup";
  if (spec.title.en === "Thai basil minced pork") return "thaiBasilMince";
  if (spec.title.en === "Thai minced chicken lettuce cups") return "lettuceCups";
  if (spec.title.en === "Pineapple coconut sticky-rice style dessert") return "stickyRiceDessert";
  if (spec.title.en === "Family-style beef rendang") return "rendang";
  if (spec.title.en === "Indonesian chicken satay") return "satay";
  if (spec.title.en === "Gado-gado warm vegetable salad") return "gadoGado";
  if (spec.method === "salad" && ["cucumber", "carrot"].includes(spec.main)) return "rawSalad";
  if (/pancake|frittata|omelette|omelet/i.test(spec.title.en)) return "eggOrSavoryPancake";
  if (carbonaraDish(spec)) return "carbonara";
  if (shapeDish(spec)) return "shapedProtein";
  if (spec.main === "wholeFish") return "wholeFish";
  if (spec.main === "egg" && spec.method === "curry") return "eggCurry";
  if (spec.main === "egg" && spec.method === "steam") return "steamedEggCustard";
  return spec.method;
}

function additionalSteps(spec, food, extras) {
  const isRiceBake = isRiceBakeSpec(spec);
  const usesCeramicBake = isRiceBake || spec.main === "egg" || minceKeys.has(spec.main);
  const washableExtras = freshExtraNames(spec);
  const plan = ingredientPlan(spec);
  const measured = namesForKeys(
    [...plan.sauces, ...plan.spices, ...plan.liquids, ...plan.binders, ...plan.dairy, "oil"]
      .filter((key, index, list) => list.indexOf(key) === index),
    t("食材表列出的調味", "the listed seasonings", "bumbu yang tercantum"),
  );
  const namedDressing = namesForKeys(
    [...plan.sauces, ...plan.spices, ...plan.fats],
    t("第 2 步調好的沙律汁", "the dressing prepared in step 2", "saus salad yang disiapkan pada langkah 2"),
  );
  const prep = {
    title: isRiceBake
      ? t("煮飯及安全備料", "Cook the rice and prepare safely", "Masak nasi dan siapkan dengan aman")
      : t("備料及保持衛生", "Prepare safely", "Siapkan dengan aman"),
    instruction: t(
      isRiceBake
        ? `洗手並分開生熟用具。白米洗至水接近清澈；中式鑊加入米及米量 1.2 倍清水，煮滾後加蓋轉最小火 12 分鐘，熄火焗 10 分鐘再鬆飯。${spec.main === "rice" ? "白飯是主料，不需再次抹乾或切。" : prepMainText(spec, food).zh}把${washableExtras.zh}沖洗、瀝乾及切好。${secondaryPrepText(spec).zh}按食材表量好${measured.zh}，分碗放置。`
        : `洗手並分開生熟用具。${prepMainText(spec, food).zh}把${washableExtras.zh}沖洗、瀝乾及切好。${secondaryPrepText(spec).zh}按食材表量好${measured.zh}，分碗放置；不可清洗或切。`,
      isRiceBake
        ? `Wash hands and separate raw and cooked utensils. Rinse the rice until the water is nearly clear. Put it in the Chinese wok with 1.2 times its volume of water, bring to a boil, cover and cook on the lowest heat for 12 minutes, then turn off the heat and rest for 10 minutes before fluffing. ${spec.main === "rice" ? "The cooked rice is the main ingredient and is not patted dry or cut again." : prepMainText(spec, food).en} Rinse, drain and cut ${washableExtras.en}. ${secondaryPrepText(spec).en} Measure ${measured.en} exactly as listed and keep them in separate bowls.`
        : `Wash hands and separate raw and cooked utensils. ${prepMainText(spec, food).en} Rinse, drain and cut ${washableExtras.en}. ${secondaryPrepText(spec).en} Measure ${measured.en} exactly as listed and keep them in separate bowls; do not wash or cut them.`,
      isRiceBake
        ? `Cuci tangan dan pisahkan alat mentah serta matang. Cuci beras hingga air hampir jernih. Masukkan ke wajan Tiongkok dengan air 1,2 kali volume beras, didihkan, tutup dan masak dengan api paling kecil 12 menit, lalu matikan api dan diamkan 10 menit sebelum diaduk lepas. ${spec.main === "rice" ? "Nasi matang adalah bahan utama dan tidak perlu dikeringkan atau dipotong lagi." : prepMainText(spec, food).id} Bilas, tiriskan, dan potong ${washableExtras.id}. ${secondaryPrepText(spec).id} Takar ${measured.id} sesuai daftar dan simpan dalam mangkuk terpisah.`
        : `Cuci tangan dan pisahkan alat mentah serta matang. ${prepMainText(spec, food).id} Bilas, tiriskan, dan potong ${washableExtras.id}. ${secondaryPrepText(spec).id} Takar ${measured.id} sesuai daftar dan simpan dalam mangkuk terpisah; jangan mencuci atau memotongnya.`
    ),
  };
  const season = {
    title: t("混合調味", "Mix the seasoning", "Campur bumbu"),
    instruction: t(
      `${seasoningText(spec, food).zh}素食模式在此時使用食材列明的替代品。`,
      `${seasoningText(spec, food).en} For vegetarian mode, use the replacements listed with the ingredients now.`,
      `${seasoningText(spec, food).id} Untuk mode vegetarian, gunakan pengganti pada daftar bahan sekarang.`
    ),
  };
  const check = {
    title: t("熟度檢查及上碟", "Check doneness and serve", "Periksa kematangan dan sajikan"),
    instruction: t(
      `${safetyTextForSpec(spec).zh}先試味才加鹽，離火靜置 2 分鐘。`,
      `${safetyTextForSpec(spec).en} Taste before adding salt, remove from heat and rest for 2 minutes.`,
      `${safetyTextForSpec(spec).id} Cicipi sebelum menambah garam, angkat dan diamkan 2 menit。`
    ),
  };
  if (["roast", "bake", "grill"].includes(spec.method)) {
    const appliance = applianceFor(spec);
    return [
      prep, season,
      { title: t("預熱 Toshiba MX2", "Preheat the Toshiba MX2", "Panaskan awal Toshiba MX2"), instruction: t(
        `${appliance.waterTank ? "清潔淨水箱並加滿少於 40°C 的過濾水或蒸餾水；" : "此烤焗模式不用水箱；"}選擇「${appliance.mode.zh}」${appliance.temperatureC}°C，按開始預熱。蜂鳴後才放食物；使用隔熱手套，勿觸碰爐腔或內側玻璃。`,
        `${appliance.waterTank ? "Clean and fill the fresh-water tank with filtered or distilled water below 40°C; " : "The water tank is not used for this Bake mode. "}Select ${appliance.mode.en} at ${appliance.temperatureC}°C and start preheating. Load food only after the beep; wear oven gloves and do not touch the cavity or inner glass.`,
        `${appliance.waterTank ? "Bersihkan dan isi tangki air bersih dengan air saring atau suling di bawah 40°C; " : "Tangki air tidak digunakan untuk mode Panggang ini. "}Pilih ${appliance.mode.id} ${appliance.temperatureC}°C lalu mulai pemanasan awal. Masukkan makanan setelah bunyi bip; pakai sarung tangan oven dan jangan sentuh ruang atau kaca bagian dalam.`
      ) },
      { title: t(isRiceBake ? "組合焗飯" : "排好主料", isRiceBake ? "Assemble the rice bake" : "Arrange the main ingredient", isRiceBake ? "Susun nasi panggang" : "Susun bahan utama"), instruction: t(
        isRiceBake
          ? `${riceBakeMainCooking(spec, food).zh}${riceBakeMixInCooking(spec).zh}加入第 2 步按名稱調好的醬汁，與已煮好的熱飯及配料拌勻，倒入沒有金邊或裂紋的耐熱陶瓷焗盤，表面鋪上食材表列出的芝士。`
          : spec.main === "egg"
            ? beatenEggDish(spec)
              ? `把蛋液與已炒軟的${extras.zh}拌勻，倒入薄薄塗油的耐熱陶瓷器皿，深度不要超過 4 厘米；放在下層蒸烤架上，不可使用有金邊或裂紋的器皿。`
              : `先把${extras.zh}和醬汁放入耐熱陶瓷器皿，焗 10 分鐘至熱及略稠；用隔熱手套取出，在醬汁開出凹位，逐隻加入保持完整的雞蛋，再放回下層蒸烤架。`
            : minceKeys.has(spec.main)
              ? `${shapeDish(spec) ? `把已成形的${food.zh}單層排好` : `先在中式鑊把${food.zh}炒散至完全變色`}，再與${extras.zh}及醬汁放入耐熱陶瓷器皿；免治肉完成時中心須達 71°C。`
              : `把${food.zh}單層排在鋪焗紙的 MX2 原裝烤盤，周圍放${extras.zh}，淋上餘下醬汁；材料之間留空位。`,
        isRiceBake
          ? `${riceBakeMainCooking(spec, food).en} ${riceBakeMixInCooking(spec).en}Add the named seasoning prepared in step 2, combine with the cooked hot rice and prepared ingredients, transfer to a heatproof ceramic dish without cracks or metallic trim, and top with the listed Parmesan cheese.`
          : spec.main === "egg"
            ? beatenEggDish(spec)
              ? `Combine the beaten egg with softened ${extras.en} and pour into a lightly oiled heatproof ceramic dish no deeper than 4 cm. Put it on the steaming rack at the lower level; never use a cracked dish or one with metallic trim.`
              : `Put ${extras.en} and the sauce in a heatproof ceramic dish and bake for 10 minutes until hot and slightly thick. Remove with oven gloves, make wells in the sauce, add the intact eggs one at a time, then return the dish to the steaming rack at the lower level.`
            : minceKeys.has(spec.main)
              ? `${shapeDish(spec) ? `Arrange the shaped ${food.en} in one layer` : `First break up and cook ${food.en} in the Chinese wok until no raw colour remains`}, then combine with ${extras.en} and the sauce in a heatproof ceramic dish. The mince must reach 71°C in the centre when finished.`
              : `Arrange ${food.en} in one layer on the MX2 supplied tray lined with baking paper. Add ${extras.en} around it, spoon over the remaining seasoning and leave space between pieces.`,
        isRiceBake
          ? `${riceBakeMainCooking(spec, food).id} ${riceBakeMixInCooking(spec).id}Tambahkan bumbu bernama yang disiapkan pada langkah 2, campur dengan nasi panas matang dan bahan lain, pindahkan ke wadah keramik tahan panas tanpa retak atau pinggiran logam, lalu beri keju Parmesan yang tercantum.`
          : spec.main === "egg"
            ? beatenEggDish(spec)
              ? `Campur telur kocok dengan ${extras.id} yang sudah dilunakkan, lalu tuang ke wadah keramik tahan panas yang dioles tipis minyak, dengan kedalaman maksimal 4 cm. Letakkan di rak kukus tingkat bawah; jangan gunakan wadah retak atau berpinggir logam.`
              : `Masukkan ${extras.id} dan saus ke wadah keramik tahan panas, lalu panggang 10 menit sampai panas dan sedikit kental. Keluarkan dengan sarung tangan oven, buat cekungan dalam saus, masukkan telur utuh satu per satu, lalu kembalikan ke rak kukus tingkat bawah.`
            : minceKeys.has(spec.main)
              ? `${shapeDish(spec) ? `Susun ${food.id} yang sudah dibentuk dalam satu lapis` : `Uraikan dan masak ${food.id} dalam wajan Tiongkok sampai tidak ada warna mentah`}, lalu campur dengan ${extras.id} dan saus dalam wadah keramik tahan panas. Daging cincang harus mencapai 71°C di tengah saat selesai.`
              : `Susun ${food.id} satu lapis di loyang bawaan MX2 beralas kertas roti. Taruh ${extras.id} di sekelilingnya, siram sisa bumbu, dan beri jarak antar potongan.`
      ) },
      { title: t("下層焗至金黃", "Bake on the lower level", "Panggang di tingkat bawah"), instruction: t(
        `${usesCeramicBake ? "把陶瓷焗盤放在蒸烤架上" : "使用原裝烤盤"}，置於下層，關門焗 ${isRiceBake ? "18–22" : spec.main === "egg" && !beatenEggDish(spec) ? "8–12" : "22–30"} 分鐘。中途不要改層位；最後 5 分鐘觀察上色情況。`,
        `${usesCeramicBake ? "Put the ceramic baking dish on the steaming rack" : "Use the supplied tray"} at the lower level, close the door and bake for ${isRiceBake ? "18–22" : spec.main === "egg" && !beatenEggDish(spec) ? "8–12" : "22–30"} minutes. Do not change levels during cooking; watch the browning for the final 5 minutes.`,
        `${usesCeramicBake ? "Taruh wadah panggang keramik di atas rak kukus" : "Gunakan loyang bawaan"} pada tingkat bawah, tutup pintu dan panggang ${isRiceBake ? "18–22" : spec.main === "egg" && !beatenEggDish(spec) ? "8–12" : "22–30"} menit. Jangan pindah tingkat selama memasak; awasi warna selama 5 menit terakhir.`
      ) },
      check,
    ];
  }
  if (["curry", "stew"].includes(spec.method)) {
    return [
      prep, season,
      { title: t("炒香香料", "Bloom the spices", "Tumis rempah"), instruction: t(`中式鑊中火加油，先炒${extras.zh} 4 分鐘，再加香料醬炒 60 秒；保持攪動，不可炒焦。`, `Heat oil in the Chinese wok over medium. Cook ${extras.en} for 4 minutes, add the spice paste and stir constantly for 60 seconds without burning.`, `Panaskan minyak dalam wajan Tiongkok dengan api sedang. Masak ${extras.id} 4 menit, tambah pasta rempah dan aduk terus 60 detik tanpa gosong.`) },
      { title: t("加入主料", "Add the main ingredient", "Masukkan bahan utama"), instruction: spec.main === "egg"
        ? t(
            "先加入薯仔、番茄等需要較長時間的材料，倒入液體至剛好蓋過蔬菜並煮滾；已煮熟的雞蛋留在碗內，暫時不要加入。",
            "Add potatoes, tomatoes and other ingredients that need longer cooking first. Add liquid just to cover the vegetables and bring to a boil; keep the boiled eggs in their bowl for now.",
            "Masukkan kentang, tomat, dan bahan lain yang perlu waktu lebih lama terlebih dahulu. Tambah cairan hingga menutupi sayuran dan didihkan; simpan telur rebus dalam mangkuk untuk sementara.",
          )
        : t(`加入${food.zh}炒 3–5 分鐘，讓每件沾上香料。加入液體至剛好蓋過材料並煮滾。`, `Add ${food.en} and cook for 3–5 minutes so every piece is coated. Add liquid just to cover and bring to a boil.`, `Masukkan ${food.id} dan masak 3–5 menit sampai semua terlapisi. Tambah cairan hingga menutupi bahan lalu didihkan.`) },
      { title: t("小火煮至入味", "Simmer gently", "Masak perlahan"), instruction: spec.main === "egg"
        ? t(
            "轉小火半加蓋煮蔬菜 15–20 分鐘至軟。最後加入原隻已剝殼雞蛋，輕輕滾動讓咖喱沾勻，再煮 8 分鐘；不要長時間猛滾，避免蛋白變硬。",
            "Part-cover and simmer the vegetables for 15–20 minutes until tender. Add the peeled whole eggs for the final 8 minutes, rolling them gently to coat with curry. Do not boil hard for a long time or the whites will toughen.",
            "Tutup sebagian dan masak sayuran 15–20 menit sampai lunak. Masukkan telur rebus kupas utuh selama 8 menit terakhir, gulingkan perlahan agar terlapisi kari. Jangan didihkan keras terlalu lama agar putih telur tidak keras.",
          )
        : t(`轉小火半加蓋煮 ${/brisket|ribs|lamb/i.test(spec.main) ? "50–65" : "22–30"} 分鐘，每 10 分鐘由鍋底攪一次；太稠可每次加 2 湯匙熱水。`, `Part-cover and simmer on low for ${/brisket|ribs|lamb/i.test(spec.main) ? "50–65" : "22–30"} minutes, stirring from the bottom every 10 minutes; if too thick, add hot water 2 tablespoons at a time.`, `Tutup sebagian dan masak api kecil ${/brisket|ribs|lamb/i.test(spec.main) ? "50–65" : "22–30"} menit, aduk dari dasar tiap 10 menit; jika terlalu kental tambahkan air panas 2 sdm setiap kali.`) },
      check,
    ];
  }
  if (spec.method === "noodle") {
    return [
      prep, season,
      { title: t("煮麵", "Cook the noodles", "Rebus mi"), instruction: t("中式鑊加水煮滾，依包裝時間少煮 1 分鐘。留起半杯煮麵水，麵瀝乾但不要沖水，抹乾中式鑊再炒餸。", "Boil water in the Chinese wok and cook noodles for 1 minute less than the packet time. Reserve half a cup of cooking water, drain without rinsing, then wipe the wok dry before cooking the topping.", "Didihkan air dalam wajan Tiongkok dan masak mi 1 menit kurang dari waktu pada kemasan. Simpan setengah cangkir air rebusan, tiriskan tanpa dibilas, lalu lap wajan hingga kering sebelum memasak lauk.") },
      { title: t("炒熟主料及配菜", "Cook the topping", "Masak lauk"), instruction: spec.main === "egg"
        ? carbonaraDish(spec)
          ? t(
              `蛋液與芝士、少量黑胡椒在乾淨碗內拌勻，保持室溫。鑊中火加油，把${extras.zh}炒 3–4 分鐘至熟及乾身；雞蛋此步不可直接下熱鑊。`,
              `Mix the egg with cheese and a little black pepper in a clean bowl and keep at room temperature. Heat oil in the wok over medium and cook ${extras.en} for 3–4 minutes until done and fairly dry; do not put the egg directly into the hot wok at this stage.`,
              `Campur telur dengan keju dan sedikit lada hitam dalam mangkuk bersih, lalu biarkan pada suhu ruang. Panaskan minyak dalam wajan dengan api sedang dan masak ${extras.id} 3–4 menit sampai matang serta cukup kering; jangan masukkan telur langsung ke wajan panas pada tahap ini.`,
            )
          : t(
              `鑊中火加油，倒入蛋液，待底部剛凝固便推成大塊；蛋面仍稍濕時加入${extras.zh}炒 2–3 分鐘，至蛋完全凝固及配菜剛熟。`,
              `Heat oil in the wok over medium and add the egg. Once the base just sets, push it into large curds. While still slightly moist, add ${extras.en} and stir-fry for 2–3 minutes until the egg is set and the vegetables are just cooked.`,
              `Panaskan minyak dalam wajan dengan api sedang dan masukkan telur. Saat dasar baru mengeras, dorong menjadi gumpalan besar. Ketika masih sedikit lembap, tambah ${extras.id} dan tumis 2–3 menit sampai telur mengeras dan sayuran baru matang.`,
            )
        : t(`鑊中火加油，${food.zh}炒 4–6 分鐘，再加${extras.zh}炒 3 分鐘。`, `Heat oil in a wok over medium. Cook ${food.en} for 4–6 minutes, then add ${extras.en} and cook for 3 minutes.`, `Panaskan minyak dalam wajan api sedang. Masak ${food.id} 4–6 menit, lalu tambah ${extras.id} dan masak 3 menit.`) },
      { title: t("拌麵收汁", "Toss and reduce", "Aduk mi dan saus"), instruction: carbonaraDish(spec)
        ? t(
            "加入熱意粉拌勻後熄火，等 30 秒才倒入蛋芝士液，一面快速拌一面逐湯匙加入煮麵水，利用餘溫拌至幼滑掛麵；不可重新大火煮，以免變成炒蛋。",
            "Toss in the hot pasta, turn off the heat and wait 30 seconds. Add the egg-cheese mixture while tossing rapidly, adding reserved pasta water a tablespoon at a time until smooth and glossy. Do not return to high heat or the sauce will scramble.",
            "Masukkan pasta panas dan aduk, matikan api lalu tunggu 30 detik. Tuang campuran telur-keju sambil mengaduk cepat, tambah air rebusan sesendok demi sesendok sampai halus dan mengilap. Jangan nyalakan api besar lagi agar saus tidak menjadi telur orak-arik.",
          )
        : t("加入麵及餘下醬汁，大火拌炒 1–2 分鐘。太乾便逐湯匙加入煮麵水，直至醬汁薄薄掛麵。", "Add noodles and remaining sauce; toss on high for 1–2 minutes. If dry, add reserved noodle water a tablespoon at a time until lightly coated.", "Masukkan mi dan sisa saus; aduk api besar 1–2 menit. Jika kering, tambah air rebusan sesendok demi sesendok sampai terlapisi tipis.") },
      check,
    ];
  }
  if (spec.method === "rice") {
    return [
      prep, season,
      { title: t("用中式鑊煮飯或準備冷飯", "Prepare rice in the wok", "Siapkan nasi dalam wajan"), instruction: t("白米洗至水接近清澈。中式鑊加入米及米量 1.2 倍清水，煮滾後加蓋轉最小火 12 分鐘，熄火焗 10 分鐘才鬆飯；炒飯可使用雪櫃冷藏一晚的飯。", "Rinse rice until the water is nearly clear. Put it in the Chinese wok with 1.2 times its volume of water, bring to a boil, cover and cook on the lowest heat for 12 minutes, then turn off the heat and rest 10 minutes before fluffing. Overnight chilled rice is suitable for fried rice.", "Cuci beras hingga air hampir jernih. Masukkan ke wajan Tiongkok dengan air 1,2 kali volume beras, didihkan, tutup dan masak dengan api paling kecil 12 menit, lalu matikan api dan diamkan 10 menit sebelum diaduk lepas. Nasi semalam dari kulkas cocok untuk nasi goreng.") },
      { title: t("煮熟餸料", "Cook the topping", "Masak lauk"), instruction: spec.main === "egg"
        ? t(
            `中大火加油，倒入蛋液後推成大塊，約七成熟時盛起。原鑊把${extras.zh}炒 3 分鐘至剛熟，雞蛋留待下一步才回鑊，避免過熟。`,
            `Heat oil over medium-high, add the egg and push into large curds. Remove when about 70% set. Cook ${extras.en} in the same wok for 3 minutes until just done, keeping the egg aside until the next step to prevent overcooking.`,
            `Panaskan minyak dengan api sedang-besar, masukkan telur dan dorong menjadi gumpalan besar. Angkat saat sekitar 70% mengeras. Masak ${extras.id} dalam wajan yang sama 3 menit sampai baru matang; masukkan telur kembali pada langkah berikutnya agar tidak terlalu matang.`,
          )
        : t(`中大火加油，把${food.zh}煮 4–6 分鐘，加入${extras.zh}再煮 3 分鐘。`, `Heat oil over medium-high and cook ${food.en} for 4–6 minutes; add ${extras.en} and cook another 3 minutes.`, `Panaskan minyak api sedang-besar dan masak ${food.id} 4–6 menit; tambah ${extras.id} lalu masak 3 menit lagi.`) },
      { title: t("拌飯或組合飯碗", "Combine with rice", "Campur dengan nasi"), instruction: t("做炒飯時加入飯，大火壓散炒 3 分鐘，再加醬汁炒至乾身；做飯碗則把熱飯分碗，餸料和醬汁放在上面。", "For fried rice, add rice, break up and fry on high for 3 minutes, then add sauce and fry until dry. For a rice bowl, divide hot rice and spoon the topping and sauce over it.", "Untuk nasi goreng, masukkan nasi, uraikan dan goreng api besar 3 menit, tambah saus lalu goreng hingga kering. Untuk mangkuk nasi, bagi nasi panas lalu taruh lauk dan saus di atas.") },
      check,
    ];
  }
  if (spec.method === "congee") {
    return [
      prep, season,
      { title: t("洗米浸米", "Rinse and soak rice", "Cuci dan rendam beras"), instruction: t("米洗淨後加清水浸 20 分鐘，瀝乾拌 1 茶匙油；這樣較易煮開花。", "Rinse rice, soak in water for 20 minutes, drain and mix with 1 teaspoon oil; this helps the grains break down.", "Cuci beras, rendam 20 menit, tiriskan dan campur 1 sdt minyak agar butir mudah hancur.") },
      { title: t("煮粥底", "Cook the congee base", "Masak dasar bubur"), instruction: t("中式鑊加入米和約 1.35 公升水，煮滾後轉小火半加蓋煮 40 分鐘，每 10 分鐘攪鑊底。", "Put rice and about 1.35 litres water in the Chinese wok. Bring to a boil, then part-cover and simmer 40 minutes, stirring the bottom every 10 minutes.", "Masukkan beras dan sekitar 1,35 liter air ke wajan Tiongkok. Didihkan, lalu tutup sebagian dan masak api kecil 40 menit, aduk dasar tiap 10 menit.") },
      { title: t("加入餸料", "Add the topping", "Masukkan lauk"), instruction: t(`加入${food.zh}及${extras.zh}，保持微滾再煮 8–12 分鐘，期間經常攪拌防黏底。`, `Add ${food.en} and ${extras.en}; keep at a gentle bubble for 8–12 minutes, stirring often to prevent sticking.`, `Masukkan ${food.id} dan ${extras.id}; didihkan perlahan 8–12 menit sambil sering diaduk agar tidak lengket.`) },
      check,
    ];
  }
  if (spec.method === "salad") {
    return [
      prep, season,
      { title: t("煮熟需加熱材料", "Cook ingredients that need heat", "Masak bahan yang perlu dipanaskan"), instruction: t(`中火加油，把${food.zh}煮至熟透及微金黃，盛到乾淨碟上放涼 5 分鐘。`, `Heat oil over medium and cook ${food.en} through until lightly golden. Transfer to a clean plate and cool for 5 minutes.`, `Panaskan minyak api sedang dan masak ${food.id} hingga matang serta agak keemasan. Pindahkan ke piring bersih dan dinginkan 5 menit.`) },
      { title: t("調沙律汁", "Make the dressing", "Buat saus salad"), instruction: t(`把${namedDressing.zh}放入有蓋小樽，搖 20 秒至乳化；試味，應酸甜平衡而不過鹹。`, `Put ${namedDressing.en} in a lidded jar and shake for 20 seconds until emulsified; taste for a balanced sweet-sour flavour without excess salt.`, `Masukkan ${namedDressing.id} ke botol bertutup dan kocok 20 detik hingga menyatu; rasanya harus seimbang asam-manis dan tidak terlalu asin.`) },
      { title: t("拌勻", "Toss", "Aduk salad"), instruction: t(`大碗放${extras.zh}及主料，先加一半沙律汁輕拌；需要才逐少加入其餘沙律汁。`, `Put ${extras.en} and the main ingredient in a large bowl. Toss gently with half the dressing, adding more only as needed.`, `Masukkan ${extras.id} dan bahan utama ke mangkuk besar. Aduk perlahan dengan setengah saus, tambah sisanya hanya bila perlu.`) },
      check,
    ];
  }
  throw new Error(`No steps for method ${spec.method}`);
}

function buildRecipe(spec, index) {
  const mainRow = I[spec.main] || P[spec.main];
  if (!mainRow) throw new Error(`Unknown main ${spec.main} in ${spec.title.en}`);
  const mainName = t(...mainRow.slice(0, 3));
  const profileKeys = profiles[spec.profile];
  if (!profileKeys) throw new Error(`Unknown profile ${spec.profile} in ${spec.title.en}`);
  const ingredientKeys = keysForSpec(spec);
  const ingredients = ingredientKeys.map((key) => ingredient(key));
  const activeExtraKeys = spec.extras.filter((key) => !dryOrLiquidKeys.has(key) || key === "egg");
  const extraRows = activeExtraKeys.map((key) => I[key] || P[key]).filter(Boolean);
  const extraNames = extraRows.length ? t(
    extraRows.map((r) => r[0]).join("、"),
    extraRows.map((r) => r[1]).join(", "),
    extraRows.map((r) => r[2]).join(", ")
  ) : t("香料及配菜", "the aromatics and vegetables", "bumbu dan sayuran");

  const special = specialDishSteps(spec, mainName);
  const direct = baseStepSets(spec, mainName, extraNames)[spec.method];
  const rawSteps = special || direct || additionalSteps(spec, mainName, extraNames);
  const slug = slugify(spec.title.en);
  const recipeId = `recipe-${String(index + 1).padStart(3, "0")}`;
  const imageDirectory = `/assets/generated/recipes/${recipeId}-${slug}`;
  const appliance = applianceFor(spec);
  const family = familyForSpec(spec);
  const appliancePrompt = appliance
    ? t(
        `如本步驟使用焗爐，必須準確顯示 Toshiba ${appliance.model}、${appliance.mode.zh}、${appliance.temperatureC}°C、${appliance.rack.zh}、${appliance.vessel.zh}。`,
        `If this step uses the oven, accurately show Toshiba ${appliance.model}, ${appliance.mode.en}, ${appliance.temperatureC}°C, ${appliance.rack.en}, and ${appliance.vessel.en}.`,
        `Jika langkah ini memakai oven, tampilkan dengan tepat Toshiba ${appliance.model}, ${appliance.mode.id}, ${appliance.temperatureC}°C, ${appliance.rack.id}, dan ${appliance.vessel.id}.`,
      )
    : t("", "", "");
  const steps = rawSteps.map((step, stepIndex) => {
    const order = stepIndex + 1;
    const actionId = slugify(step.title.en);
    const instruction = t(
      `「${spec.title.zh}」第 ${order} 步：${step.instruction.zh}`,
      `${spec.title.en}, step ${order}: ${step.instruction.en}`,
      `${spec.title.id}, langkah ${order}: ${step.instruction.id}`,
    );
    const ingredientRefs = ingredients
      .filter((item) => mentionsIngredient(step.instruction.en, item.name.en))
      .map((item) => item.id);
    const preparationOnly = /^(?:prepare|cut|soak|rinse|measure|preheat|set-up)/.test(actionId);
    const prepares = step.prepares
      ? [...step.prepares]
      : preparationOnly
        ? [...ingredientRefs]
        : [];
    const uses = step.uses
      ? [...step.uses]
      : preparationOnly
        ? []
        : [...ingredientRefs];
    const produces = step.produces ? [...step.produces] : [];
    const consumes = step.consumes ? [...step.consumes] : [];
    return {
      order,
      title: step.title,
      instruction,
      actionId,
      prepares,
      uses,
      produces,
      consumes,
      targetState: step.title,
      ingredientRefs,
      imageUrl: `${imageDirectory}/step-${String(order).padStart(2, "0")}.webp`,
      imagePrompt: t(
        `「${spec.title.zh}」第 ${order} 步「${step.title.zh}」的獨立教學圖片。主要食材：${mainName.zh}。嚴格按完整描述顯示當刻材料形態、操作、器具、火力及熟度：${instruction.zh}${appliancePrompt.zh} 只顯示本步，不可提前顯示成品；香港家庭廚房，清晰寫實，無文字、無水印、無人物臉孔。`,
        `Independent instructional image for ${spec.title.en}, step ${order}, "${step.title.en}". Main ingredient: ${mainName.en}. Follow the complete description exactly, showing the ingredient state, action, equipment, heat and doneness at this moment: ${instruction.en} ${appliancePrompt.en} Show this step only and do not reveal the finished dish early. Photorealistic Hong Kong home-kitchen food photography captured like a real camera, with natural ingredient texture and believable light. No cartoon, illustration, painting, 3D render, CGI, clay, plastic food, or stylised graphic. No text, watermark, or visible faces.`,
        `Gambar instruksi tersendiri untuk ${spec.title.id}, langkah ${order}, "${step.title.id}". Bahan utama: ${mainName.id}. Ikuti deskripsi lengkap dengan tepat dan tampilkan keadaan bahan, tindakan, alat, panas, serta kematangan saat ini: ${instruction.id} ${appliancePrompt.id} Tampilkan hanya langkah ini, jangan menampilkan hidangan akhir terlalu awal. Foto dapur rumah Hong Kong yang jelas dan realistis, tanpa teks, tanda air, atau wajah.`
      ),
      imageSeed: `${slug}-step-${String(order).padStart(2, "0")}`,
      visual: {
        recipeSlug: slug,
        stepNumber: order,
        action: step.title,
        ingredientRefs,
        shot: "overhead-close",
        noText: true,
      },
    };
  });
  const [prepMinutes, cookMinutes] = timing[spec.method];
  const difficulty = cookMinutes >= 45
    ? t("中等", "Medium", "Sedang")
    : t("容易", "Easy", "Mudah");
  const cuisine = cuisineNames[spec.cuisine];
  const category = categoryForMethod[spec.method] || t("主菜", "Main dish", "Hidangan utama");
  const hasReplacement = ingredients.some((item) => item.vegetarianAlternative);
  const isRiceFriendly = ["stirFry", "steam", "braise", "roast", "bake", "panFry", "deepFry", "curry", "stew", "grill"].includes(spec.method);
  const isRiceBake = isRiceBakeSpec(spec);
  const equipment = equipmentFor(spec);
  const tags = [
    cuisine,
    methodNames[spec.method],
    mainName,
    t("香港易買食材", "Hong Kong supermarket-friendly", "Bahan mudah dibeli di Hong Kong"),
    ...(isRiceFriendly ? [t("送飯", "Great with rice", "Cocok dengan nasi")] : []),
    ...(appliance ? [t("MX2-TT20SC", "MX2-TT20SC", "MX2-TT20SC")] : []),
    ...(isRiceBake ? [t("焗飯", "Rice bake", "Nasi panggang")] : []),
    ...(hasReplacement ? [t("可轉蛋奶素", "Vegetarian option", "Opsi vegetarian")] : [t("蛋奶素", "Vegetarian", "Vegetarian")]),
  ];
  const searchTokens = [...new Set([
    ...Object.values(spec.title),
    ...Object.values(cuisine),
    ...Object.values(category),
    ...ingredients.flatMap((item) => Object.values(item.name)),
    ...tags.flatMap((tag) => Object.values(tag)),
  ].map((value) => String(value).toLowerCase()))];

  return {
    id: recipeId,
    slug,
    title: spec.title,
    description: t(
      `${spec.title.zh}的香港家庭版本，調味不過辣不過鹹，三人份材料可在本港街市或大型超市買到。步驟列出火力、時間及熟度，適合家傭照做。`,
      `A Hong Kong family version of ${spec.title.en}, balanced to be neither overly hot nor salty. Ingredients for three are readily available at Hong Kong wet markets or supermarkets, with heat, timing and doneness stated clearly.`,
      `Versi keluarga Hong Kong untuk ${spec.title.id}, rasanya tidak terlalu pedas atau asin. Bahan untuk tiga orang mudah dibeli di pasar atau supermarket Hong Kong, dengan api, waktu dan kematangan yang dijelaskan jelas.`
    ),
    cuisine,
    category,
    tags,
    servings: 3,
    prepMinutes,
    cookMinutes,
    totalMinutes: prepMinutes + cookMinutes,
    difficulty,
    family,
    signature: {
      ingredientIds: [...new Set([spec.main, ...spec.extras])],
      techniqueIds: [...new Set([family, spec.method, spec.profile])],
    },
    vegetarianAvailable: true,
    vegetarianNotes: hasReplacement ? t(
      "開啟素食模式後，豬、牛、羊、雞或鴨首選用食材列出的 Impossible-style 植物免治肉或植物肉條；豆腐或菇菌列作次選。海鮮以豆腐或菇菌代替；蠔油及魚露亦用列出的素食替代。蛋奶可保留。",
      "In vegetarian mode, the first choice for pork, beef, lamb, chicken or duck is the listed Impossible-style plant mince or plant-based strips; tofu or mushrooms are the second choice. Replace seafood with tofu or mushrooms, and use the listed vegetarian substitutes for oyster or fish sauce. Eggs and dairy may remain.",
      "Dalam mode vegetarian, pilihan utama untuk babi, sapi, domba, ayam atau bebek adalah daging cincang nabati gaya Impossible atau irisan daging nabati yang tercantum; tahu atau jamur adalah pilihan kedua. Ganti seafood dengan tahu atau jamur, serta gunakan pengganti vegetarian untuk saus tiram atau kecap ikan. Telur dan susu boleh tetap digunakan."
    ) : t(
      "此菜本身適合蛋奶素食者。購買醬料時仍要檢查標籤，避免魚露、蝦醬或動物明膠。",
      "This dish is already suitable for lacto-ovo vegetarians. Still check sauce labels for fish sauce, shrimp paste or animal gelatine.",
      "Hidangan ini sudah cocok untuk vegetarian lakto-ovo. Tetap periksa label saus agar tidak mengandung kecap ikan, terasi atau gelatin hewani."
    ),
    imageUrl: `${imageDirectory}/hero.webp`,
    imagePrompt: t(
      `香港家庭餐桌上的${spec.title.zh}，三人份，清楚呈現此菜獨有主料及醬汁，家常擺盤，自然窗光，真實食物攝影，無文字`,
      `${spec.title.en} on a Hong Kong family dining table, three servings, clearly showing this dish's distinctive main ingredient and sauce, homestyle plating, natural window light, photorealistic food photography captured like a real camera, natural food texture. No cartoon, illustration, painting, 3D render, CGI, clay, plastic food, or stylised graphic. No text, watermark, or people.`,
      `${spec.title.id} di meja makan keluarga Hong Kong, tiga porsi, jelas menampilkan bahan utama dan saus khas hidangan ini, penyajian rumahan, cahaya jendela alami, foto makanan realistis, tanpa teks`
    ),
    imageSeed: `${slug}-hero`,
    visual: {
      recipeSlug: slug,
      subject: spec.title,
      cuisine,
      heroShot: "three-quarter-table",
      plating: "Hong Kong family-style, three servings",
      noText: true,
    },
    equipment,
    ...(appliance ? { appliance } : {}),
    ingredients,
    steps,
    searchTokens,
  };
}

function validate(recipes) {
  const errors = [];
  if (recipes.length !== 300) errors.push(`Expected 300 recipes, got ${recipes.length}`);
  const allowedEquipmentTypes = new Set(["pan", "wok", "mx2", "accessory"]);
  const ids = new Set();
  const titles = { zh: new Set(), en: new Set(), id: new Set() };
  for (const [index, recipe] of recipes.entries()) {
    const at = `recipe[${index}]`;
    if (ids.has(recipe.id)) errors.push(`${at}: duplicate id ${recipe.id}`);
    ids.add(recipe.id);
    for (const lang of ["zh", "en", "id"]) {
      if (!recipe.title?.[lang]) errors.push(`${at}: missing title.${lang}`);
      if (titles[lang].has(recipe.title?.[lang])) errors.push(`${at}: duplicate title.${lang} ${recipe.title?.[lang]}`);
      titles[lang].add(recipe.title?.[lang]);
      if (!recipe.description?.[lang]) errors.push(`${at}: missing description.${lang}`);
      if (!recipe.vegetarianNotes?.[lang]) errors.push(`${at}: missing vegetarianNotes.${lang}`);
    }
    if (recipe.servings !== 3) errors.push(`${at}: servings must be 3`);
    if (!recipe.imagePrompt?.zh || !recipe.imagePrompt?.en || !recipe.imagePrompt?.id || !recipe.imageSeed || !recipe.visual) {
      errors.push(`${at}: missing recipe-specific image metadata`);
    }
    if (recipe.imageUrl?.includes("home-table-hero")) errors.push(`${at}: generic hero image is forbidden`);
    if (!Array.isArray(recipe.equipment) || recipe.equipment.length === 0) errors.push(`${at}: missing equipment`);
    recipe.equipment?.forEach((item, equipmentIndex) => {
      if (!allowedEquipmentTypes.has(item.type) || !item.name?.zh || !item.name?.en || !item.name?.id) {
        errors.push(`${at}.equipment[${equipmentIndex}]: invalid equipment`);
      }
    });
    if (recipe.tags.some((tag) => tag.en === "MX2-TT20SC")) {
      const appliance = recipe.appliance;
      if (
        appliance?.model !== "MX2-TT20SC" ||
        !appliance.mode?.zh || !appliance.mode?.en || !appliance.mode?.id ||
        typeof appliance.preheat !== "boolean" ||
        !appliance.rack?.zh || !appliance.rack?.en || !appliance.rack?.id ||
        typeof appliance.waterTank !== "boolean" ||
        !appliance.vessel?.zh || !appliance.vessel?.en || !appliance.vessel?.id
      ) {
        errors.push(`${at}: incomplete MX2 appliance instructions`);
      }
    }
    if (recipe.ingredients.length < 5) errors.push(`${at}: too few ingredients`);
    if (recipe.steps.length < 6) errors.push(`${at}: too few steps`);
    recipe.ingredients.forEach((item, ingredientIndex) => {
      if (!item.name?.zh || !item.name?.en || !item.name?.id || item.amount == null || !item.unit) {
        errors.push(`${at}.ingredients[${ingredientIndex}]: incomplete`);
      }
    });
    recipe.steps.forEach((step, stepIndex) => {
      if (!step.instruction?.zh || !step.instruction?.en || !step.instruction?.id || !step.imagePrompt?.zh || !step.imagePrompt?.en || !step.imagePrompt?.id || !step.imageSeed || !step.visual) {
        errors.push(`${at}.steps[${stepIndex}]: incomplete`);
      }
      if (step.imageUrl?.includes("home-table-hero")) errors.push(`${at}.steps[${stepIndex}]: generic image is forbidden`);
    });
  }
  const riceBakes = recipes.filter((recipe) => recipe.tags.some((tag) => tag.en === "Rice bake"));
  if (riceBakes.length < 12) errors.push(`Expected at least 12 rice bakes, got ${riceBakes.length}`);
  if (errors.length) throw new Error(`Recipe validation failed:\n${errors.join("\n")}`);
}

const recipes = catalogue.map(buildRecipe);
validate(recipes);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(recipes, null, 2)}\n`, "utf8");
console.log(`Generated and validated ${recipes.length} recipes at ${outputPath}`);
console.log(`Cuisines: ${Object.entries(recipes.reduce((acc, recipe) => {
  acc[recipe.cuisine.en] = (acc[recipe.cuisine.en] || 0) + 1;
  return acc;
}, {})).map(([name, count]) => `${name}=${count}`).join(", ")}`);
