#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');
const outputFile = resolve(
  projectRoot,
  'src/data/synced/veggiedeer-recipes.json',
);
const CHANNEL_NAME = '野菜鹿鹿 Veggie Deer';
const PLAYLIST_ID = 'PLXP32gr0yuC3nEMXo8GjfIuPdHJQ9V1t2';
const PLAYLIST_URL =
  `https://www.youtube.com/playlist?list=${PLAYLIST_ID}&hl=zh-TW&gl=TW`;
const CONCURRENCY = 8;

const ANDROID_CLIENT = {
  clientName: 'ANDROID',
  clientVersion: '20.10.38',
  androidSdkVersion: 30,
  hl: 'zh-TW',
  gl: 'TW',
};

const INGREDIENT_NAMES = [
  '白花椰菜', '青花椰菜', '高麗菜', '大白菜', '青江菜', '小白菜',
  '金針菇', '杏鮑菇', '秀珍菇', '香菇', '鴻喜菇', '猴頭菇', '蘑菇',
  '凍豆腐', '板豆腐', '嫩豆腐', '雞蛋豆腐', '豆腐皮', '豆腐乳', '豆腐',
  '百頁豆腐', '豆包', '腐竹', '豆皮', '豆干', '毛豆', '黃豆', '黑豆',
  '鷹嘴豆', '紅豆', '綠豆', '扁豆', '玉米筍', '玉米', '馬鈴薯',
  '地瓜', '芋頭', '南瓜', '山藥', '蓮藕', '牛蒡', '白蘿蔔', '紅蘿蔔',
  '茄子', '番茄', '小黃瓜', '櫛瓜', '絲瓜', '苦瓜', '冬瓜', '甜椒',
  '青椒', '辣椒', '四季豆', '茼萵', '菠菜', '韭菜', '芹菜', '香菜',
  '九層塔', '羅勒', '蔥', '薑', '蒜', '洋蔥', '竹筍', '桂竹筍',
  '酪梨', '蘋果', '芒果', '鳳梨', '檸檬', '香蕉', '草莓', '栗子',
  '腰果', '花生', '芝麻', '海苔', '昆布', '紫菜', '蒟蒻', '麵筋',
  '植物肉', '素肉', '未來肉', '燕麥奶', '豆漿', '椰奶', '味噌',
  '花生醬', '芝麻醬', '辣椒油', '醬油', '味醂', '豆豉', '泡菜', '咖哩',
  '米血糕', '年糕', '米苔目', '米粉', '冬粉', '麵線', '烏龍麵',
  '拉麵', '義大利麵', '白飯', '白米', '糯米', '燕麥', '麵粉', '太白粉',
  '樹薯粉', '地瓜粉', '糯米粉', '麵包', '吐司', '饅頭', '餛飩皮',
  '鹽巴', '胡椒', '香油', '麻油', '植物油',
].sort((left, right) => right.length - left.length);

const METHOD_LABELS = [
  ['氣炸', '氣炸'],
  ['電鍋', '電鍋'],
  ['一鍋到底', '一鍋完成'],
  ['涼拌', '涼拌'],
  ['醃', '醃漬'],
  ['蒸', '蒸煮'],
  ['燉', '燉煮'],
  ['煮', '煮製'],
  ['炒', '拌炒'],
  ['煎', '香煎'],
  ['烤', '烘烤'],
  ['炸', '酥炸'],
  ['拌', '拌勻'],
  ['熬', '熬煮'],
];

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
            'AppleWebKit/537.36 Chrome/136 Safari/537.36',
          ...options.headers,
        },
      });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 500);
    }
  }
  throw lastError;
}

function parseJsonAfterMarker(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return null;

  const start = markerIndex + marker.length;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}' && --depth === 0) {
      return JSON.parse(source.slice(start, index + 1));
    }
  }
  return null;
}

function youtubeConfigValue(source, key) {
  return source.match(new RegExp(`"${key}":"([^"]+)"`))?.[1] || '';
}

function walk(value, visitor, path = []) {
  if (!value || typeof value !== 'object') return;
  visitor(value, path);
  for (const [key, child] of Object.entries(value)) {
    walk(child, visitor, [...path, key]);
  }
}

function playlistEntries(data) {
  const entries = [];
  walk(data, (value) => {
    const lockup = value.lockupViewModel;
    const endpoint =
      lockup?.rendererContext?.commandContext?.onTap?.innertubeCommand
        ?.watchEndpoint;
    if (!lockup?.contentId || endpoint?.playlistId !== PLAYLIST_ID) return;

    const metadata = lockup.metadata?.lockupMetadataViewModel;
    const badgeTexts = [];
    walk(lockup.contentImage, (item) => {
      const text = item.thumbnailBadgeViewModel?.text;
      if (text) badgeTexts.push(text);
    });
    entries.push({
      videoId: lockup.contentId,
      title: metadata?.title?.content || '',
      durationText: badgeTexts.find((text) => /^\d+:\d+(?::\d+)?$/.test(text)),
      index: Number(endpoint.index),
    });
  });

  return [...new Map(entries.map((entry) => [entry.videoId, entry])).values()]
    .sort((left, right) => left.index - right.index);
}

function continuationToken(data) {
  const tokens = [];
  walk(data, (value, path) => {
    const token = value.continuationCommand?.token;
    const location = path.join('.');
    if (token && location.includes('continuationItemViewModel')) {
      tokens.push({ token, path: location });
    }
  });
  return (
    tokens.find(({ path }) =>
      path.includes('itemSectionRenderer.contents.0'),
    )?.token ||
    tokens.find(({ path }) => path.includes('itemSectionRenderer'))?.token ||
    tokens[0]?.token ||
    ''
  );
}

async function fetchPlaylistIndex() {
  const html = await (await fetchWithRetry(PLAYLIST_URL)).text();
  const initialData =
    parseJsonAfterMarker(html, 'var ytInitialData = ') ||
    parseJsonAfterMarker(html, 'ytInitialData = ');
  if (!initialData) throw new Error('Unable to read the Veggie Deer playlist');

  const apiKey = youtubeConfigValue(html, 'INNERTUBE_API_KEY');
  const clientVersion = youtubeConfigValue(html, 'INNERTUBE_CLIENT_VERSION');
  if (!apiKey || !clientVersion) {
    throw new Error('YouTube page did not expose an Innertube client config');
  }

  const allEntries = playlistEntries(initialData);
  let token = continuationToken(initialData);
  let pageNumber = 1;
  console.log(`Playlist page ${pageNumber}: ${allEntries.length} recipes`);

  while (token) {
    const response = await fetchWithRetry(
      `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion,
              hl: 'zh-TW',
              gl: 'TW',
            },
          },
          continuation: token,
        }),
      },
    );
    const data = await response.json();
    const nextEntries = playlistEntries(data);
    const known = new Set(allEntries.map((entry) => entry.videoId));
    const freshEntries = nextEntries.filter((entry) => !known.has(entry.videoId));
    allEntries.push(...freshEntries);
    token = continuationToken(data);
    pageNumber += 1;
    console.log(
      `Playlist page ${pageNumber}: +${freshEntries.length} ` +
        `(${allEntries.length} total)`,
    );
    if (!freshEntries.length) break;
  }

  return { apiKey, entries: allEntries };
}

async function mapConcurrent(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

async function fetchVideoMetadata(apiKey, entry) {
  const response = await fetchWithRetry(
    `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        context: { client: ANDROID_CLIENT },
        videoId: entry.videoId,
        contentCheckOk: true,
        racyCheckOk: true,
      }),
    },
  );
  const data = await response.json();
  const details = data.videoDetails || {};
  const microformat = data.microformat?.playerMicroformatRenderer || {};
  return {
    ...entry,
    title: details.title || entry.title,
    description: details.shortDescription || '',
    lengthSeconds: Number(details.lengthSeconds) || 0,
    publishedAt: microformat.publishDate || microformat.uploadDate || '',
  };
}

function cleanTitle(title) {
  return String(title || '')
    .split(/\s*[｜|]\s*/)[0]
    .replace(/\s*➤.*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function recipeTitle(title, description) {
  const source = String(description || '');
  const rawTitle = cleanTitle(title);
  const normalizeCandidate = (value) =>
    String(value || '')
      .replace(/\p{Extended_Pictographic}|\uFE0F/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  const candidates = [
    rawTitle.match(/^([^：:]{2,28})[：:]/u)?.[1],
    source.match(/[【「『]([^】」』\n]{2,26})[】」』]/u)?.[1],
    rawTitle.match(/[【「『]([^】」』\n]{2,26})[】」』]/u)?.[1],
    source.match(/(?:料理|食譜)[：:]\s*([^，。！!\n]{2,26})/u)?.[1],
    source.match(
      /分享(?:一道)?[^，。！!\n]{0,30}?\s+([純全素電鍋一-龥A-Za-z0-9]{2,24})(?=[，。！!\n])/u,
    )?.[1],
  ].map(normalizeCandidate).filter(Boolean);
  const dishWords =
    /飯|麵|粉|湯|羹|鍋|粥|餅|糕|肉|魚|雞|鴨|豆腐|豆乾|豆包|玉米|茄子|黃瓜|馬鈴薯|地瓜|芋頭|南瓜|筍|菜|捲|包|醬|米線|冬粉|饅頭|吐司|沙拉|甜點|塔|芋圓|排骨|燒賣|丸|蛋|蓮藕/u;
  const candidate = candidates.find(
    (value) =>
      dishWords.test(value) &&
      !/今天|這次|做法|食材|步驟|特色|分享|推薦|收藏|覺得|味道/u.test(
        value,
      ),
  );
  return candidate || rawTitle;
}

function cleanDescription(description) {
  const boilerplate =
    /^(?:＿＿|－－|成為這個頻道|野菜鹿鹿的好油|📖|🥦精選|❤️追蹤|合作邀約|Facebook|Instagram|♫|Song:|Music:|如果你喜歡|記得按讚|💬|👇|🎁|加入伊萊克斯|#)/i;
  const lines = String(description || '').split(/\r?\n/);
  const kept = [];
  for (const rawLine of lines) {
    const line = rawLine.trim().replace(/https?:\/\/\S+/g, '').trim();
    if (boilerplate.test(line)) break;
    if (!line || line.includes('@gmail.com')) continue;
    kept.push(line);
    if (kept.join(' ').length >= 420) break;
  }
  return kept
    .join('\n')
    .replace(/^["“]|["”]$/g, '')
    .slice(0, 520)
    .trim();
}

function matchedIngredients(text) {
  const matched = [];
  let remaining = text;
  for (const name of INGREDIENT_NAMES) {
    if (!remaining.includes(name)) continue;
    matched.push(name);
    remaining = remaining.split(name).join(' ');
  }
  return matched.slice(0, 12);
}

function methodLabel(text) {
  return METHOD_LABELS.find(([term]) => text.includes(term))?.[1] || '';
}

function inferCategory(text) {
  if (/甜點|蛋糕|餅乾|軟糖|布丁|冰淇淋|粉粿|芋圓|塔|鬆餅/.test(text)) {
    return '甜點';
  }
  if (/湯|羹|火鍋|湯鍋|粥/.test(text)) return '湯品';
  if (/小菜|涼拌|沙拉|泡菜|醃/.test(text)) return '小菜';
  if (/早餐|吐司|饅頭/.test(text)) return '早餐';
  return '主菜';
}

function inferredMinutes(text) {
  const match = text.match(/(\d{1,3})\s*分鐘/);
  return match ? Number(match[1]) : 0;
}

function buildHighlights(text, vegan) {
  const highlights = [vegan ? '純素' : '素食'];
  const rules = [
    [/一鍋到底|一鍋完成/, '一鍋料理'],
    [/電鍋/, '電鍋料理'],
    [/氣炸/, '氣炸鍋'],
    [/不用炸|免油炸|無油|不加一滴油/, '少油料理'],
    [/高蛋白|蛋白質/, '高蛋白'],
    [/低脂|低卡|減脂/, '輕盈少負擔'],
    [/新手|零失敗|超簡單|快速/, '新手友善'],
    [/便當/, '便當菜'],
  ];
  for (const [pattern, label] of rules) {
    if (pattern.test(text)) highlights.push(label);
  }
  const method = methodLabel(text);
  if (method) highlights.push(method);
  highlights.push(CHANNEL_NAME);
  return [...new Set(highlights)].map((label) => ({ zh: label }));
}

function extractMethodNotes(description) {
  const candidates = description
    .split(/\n|(?<=[。！？!?])/u)
    .map((sentence) => sentence.trim())
    .filter(
      (sentence) =>
        sentence.length >= 8 &&
        sentence.length <= 130 &&
        !/[?？]/u.test(sentence) &&
        /先|再|接著|加入|放入|拌炒|翻炒|快炒|煎到|炒到|炒香|蒸到|煮到|燉到|烤到|炸到|蓋上|淋上|切成|打成|熬煮|冰鎮|吸滿|備好食材/u.test(
          sentence,
        ),
    );
  return [...new Set(candidates)].slice(0, 5).map((instruction, index) => ({
    order: index + 1,
    title: { zh: methodLabel(instruction) || `料理重點 ${index + 1}` },
    instruction: { zh: instruction.replace(/\s+/g, ' ') },
  }));
}

function slugFor(videoId) {
  return `veggiedeer-${videoId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function toRecipe(metadata) {
  const description = cleanDescription(metadata.description);
  const title = recipeTitle(metadata.title, description);
  const combinedText = `${metadata.title}\n${title}\n${description}`;
  const vegan = /純素|全素|\bvegan\b/i.test(combinedText);
  const ingredients = matchedIngredients(combinedText).map((name, index) => ({
    id: `veggiedeer-ingredient-${index + 1}`,
    name: { zh: name },
    amount: '',
    unit: { zh: '' },
    optional: false,
  }));
  const method = methodLabel(combinedText);
  const totalMinutes = inferredMinutes(combinedText);

  return {
    id: `veggiedeer-${metadata.videoId}`,
    slug: slugFor(metadata.videoId),
    title: { zh: title },
    description: {
      zh:
        description ||
        `${CHANNEL_NAME} 的${vegan ? '純素' : '素食'}料理分享。`,
    },
    cuisine: { zh: '台灣素食' },
    category: { zh: inferCategory(combinedText) },
    tags: buildHighlights(combinedText, vegan),
    highlights: buildHighlights(combinedText, vegan).slice(0, 6),
    servings: 3,
    prepMinutes: 0,
    cookMinutes: totalMinutes,
    totalMinutes,
    difficulty: {
      zh: /新手|零失敗|超簡單|簡單|快速/.test(combinedText)
        ? '容易'
        : '一般',
    },
    method: method ? { zh: method } : undefined,
    vegetarian: true,
    vegan,
    vegetarianAvailable: true,
    ingredientListComplete: false,
    stepListComplete: false,
    imageUrl: `/assets/recipes/veggiedeer/${metadata.videoId}.jpg`,
    equipment: [],
    ingredients,
    steps: extractMethodNotes(description),
    sync: {
      provider: 'youtube',
      channel: CHANNEL_NAME,
      playlistId: PLAYLIST_ID,
      sourceId: metadata.videoId,
      publishedAt: metadata.publishedAt || undefined,
      durationSeconds: metadata.lengthSeconds || undefined,
    },
  };
}

async function main() {
  await mkdir(dirname(outputFile), { recursive: true });

  const { apiKey, entries } = await fetchPlaylistIndex();
  if (entries.length < 150) {
    throw new Error(
      `Safety check failed: expected a full recipe playlist, received ${entries.length}`,
    );
  }

  let existingById = new Map();
  if (existsSync(outputFile)) {
    const existing = JSON.parse(await readFile(outputFile, 'utf8'));
    existingById = new Map(
      existing.map((recipe) => [recipe.sync?.sourceId, recipe]),
    );
  }

  console.log(`Reading ${entries.length} recipe descriptions…`);
  let completed = 0;
  const metadata = await mapConcurrent(
    entries,
    CONCURRENCY,
    async (entry) => {
      try {
        return await fetchVideoMetadata(apiKey, entry);
      } catch (error) {
        const cached = existingById.get(entry.videoId);
        if (cached) {
          console.warn(`Using cached metadata for ${entry.videoId}`);
          return {
            ...entry,
            title: cached.title?.zh || entry.title,
            description: cached.description?.zh || '',
            lengthSeconds: cached.sync?.durationSeconds || 0,
            publishedAt: cached.sync?.publishedAt || '',
          };
        }
        throw error;
      } finally {
        completed += 1;
        if (completed % 25 === 0 || completed === entries.length) {
          console.log(`Metadata ${completed}/${entries.length}`);
        }
      }
    },
  );

  const recipes = metadata.map(toRecipe);
  await writeFile(outputFile, `${JSON.stringify(recipes, null, 2)}\n`);
  console.log(
    `Synced ${recipes.length} vegetarian recipes to ` +
      `${outputFile.replace(`${projectRoot}/`, '')}`,
  );
  console.log(
    'Recipe images are intentionally left untouched here. Run the frame ' +
      'capture step to create verified screenshots from the video streams.',
  );
}

await main();
