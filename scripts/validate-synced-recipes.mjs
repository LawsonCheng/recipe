#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const recipesPath = resolve(
  projectRoot,
  'src/data/synced/veggiedeer-recipes.json',
);
const recipes = JSON.parse(await readFile(recipesPath, 'utf8'));
const frameManifestPath = resolve(
  projectRoot,
  'src/data/synced/veggiedeer-frame-manifest.json',
);
const frameManifest = JSON.parse(await readFile(frameManifestPath, 'utf8'));
const framesBySourceId = new Map(
  frameManifest.map((frame) => [frame.sourceId, frame]),
);
const errors = [];
const recipeIds = new Set();
const sourceIds = new Set();

if (!Array.isArray(recipes) || recipes.length < 150) {
  errors.push(`Expected a full synced collection, received ${recipes.length}`);
}

for (const [index, recipe] of recipes.entries()) {
  const label = recipe.id || `synced recipe ${index + 1}`;
  if (!recipe.id || recipeIds.has(recipe.id)) {
    errors.push(`${label}: missing or duplicate recipe id`);
  }
  recipeIds.add(recipe.id);

  const sourceId = recipe.sync?.sourceId;
  if (!sourceId || sourceIds.has(sourceId)) {
    errors.push(`${label}: missing or duplicate source id`);
  }
  sourceIds.add(sourceId);

  if (!recipe.title?.zh) errors.push(`${label}: missing Chinese title`);
  if (!recipe.description?.zh) errors.push(`${label}: missing Chinese description`);
  if (recipe.vegetarian !== true) errors.push(`${label}: not marked vegetarian`);
  if (recipe.sync?.provider !== 'youtube') {
    errors.push(`${label}: unexpected sync provider`);
  }
  if (recipe.sync?.imageSource !== 'youtube-video-frame') {
    errors.push(`${label}: image is not marked as a captured video frame`);
  }
  const frameTimestamp = Number(recipe.sync?.frameTimestampSeconds);
  const duration = Number(recipe.sync?.durationSeconds);
  if (
    !frameTimestamp ||
    !duration ||
    frameTimestamp >= duration ||
    frameTimestamp < 1
  ) {
    errors.push(`${label}: invalid or missing video-frame timestamp`);
  }
  if (!Array.isArray(recipe.tags) || !recipe.tags.length) {
    errors.push(`${label}: missing tags`);
  }
  if (
    JSON.stringify(recipe).match(
      /https?:\/\/|youtube\.com\/watch|youtube\.com\/embed/i,
    )
  ) {
    errors.push(`${label}: exposes an external video URL`);
  }

  const expectedImage = `/assets/recipes/veggiedeer/${sourceId}.jpg`;
  if (recipe.imageUrl !== expectedImage) {
    errors.push(`${label}: unexpected image path ${recipe.imageUrl}`);
    continue;
  }
  try {
    const imagePath = resolve(projectRoot, `public${expectedImage}`);
    const image = await stat(imagePath);
    if (image.size < 12_000) errors.push(`${label}: image is too small`);
    const frame = framesBySourceId.get(sourceId);
    if (!frame) {
      errors.push(`${label}: missing video-frame manifest entry`);
      continue;
    }
    if (
      frame.source !== 'youtube-video-frame' ||
      frame.timestampSeconds !== frameTimestamp ||
      frame.imagePath !== expectedImage ||
      frame.width < 640 ||
      frame.height < 360
    ) {
      errors.push(`${label}: invalid video-frame manifest metadata`);
    }
    const imageHash = createHash('sha256')
      .update(await readFile(imagePath))
      .digest('hex');
    if (
      imageHash !== frame.sha256 ||
      imageHash !== recipe.sync?.frameSha256
    ) {
      errors.push(`${label}: screenshot hash does not match frame manifest`);
    }
  } catch {
    errors.push(`${label}: image file is missing`);
  }
}

if (frameManifest.length !== recipes.length) {
  errors.push(
    `Expected ${recipes.length} frame manifest entries, received ` +
      `${frameManifest.length}`,
  );
}

if (errors.length) {
  console.error(errors.slice(0, 100).join('\n'));
  if (errors.length > 100) console.error(`…and ${errors.length - 100} more`);
  process.exit(1);
}

console.log(
  `Validated ${recipes.length} synced Veggie Deer recipes, verified video ` +
    'frame timestamps and hashes, unique source IDs and vegetarian flags.',
);
