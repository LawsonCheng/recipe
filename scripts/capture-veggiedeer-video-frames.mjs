#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const recipesPath = resolve(
  projectRoot,
  'src/data/synced/veggiedeer-recipes.json',
);
const manifestPath = resolve(
  projectRoot,
  'src/data/synced/veggiedeer-frame-manifest.json',
);
const imageDirectory = resolve(
  projectRoot,
  'public/assets/recipes/veggiedeer',
);

const CAPTURE_VERSION = 1;
const CONCURRENCY = Math.max(
  1,
  Number(process.env.VEGGIEDEER_FRAME_CONCURRENCY) || 4,
);
const REFRESH_FRAMES = process.argv.includes('--refresh-frames');
const limitArgument = process.argv.find((argument) => argument.startsWith('--limit='));
const LIMIT = limitArgument ? Number(limitArgument.split('=')[1]) : Infinity;

function commandAvailable(command, argumentsList = ['--version']) {
  const result = spawnSync(command, argumentsList, {
    stdio: 'ignore',
    timeout: 15_000,
  });
  return !result.error && result.status === 0;
}

function ytDlpCommand() {
  if (commandAvailable('yt-dlp')) return { command: 'yt-dlp', prefix: [] };
  if (commandAvailable('uvx', ['yt-dlp', '--version'])) {
    return { command: 'uvx', prefix: ['yt-dlp'] };
  }
  throw new Error(
    'yt-dlp is required. Install it or make `uvx yt-dlp` available.',
  );
}

function run(command, argumentsList, { captureOutput = false } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, argumentsList, {
      stdio: captureOutput
        ? ['ignore', 'pipe', 'pipe']
        : ['ignore', 'inherit', 'inherit'],
    });
    const stdout = [];
    const stderr = [];
    if (captureOutput) {
      child.stdout.on('data', (chunk) => stdout.push(chunk));
      child.stderr.on('data', (chunk) => stderr.push(chunk));
    }
    child.on('error', rejectPromise);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise(Buffer.concat(stdout).toString('utf8').trim());
        return;
      }
      const detail = Buffer.concat(stderr).toString('utf8').trim();
      rejectPromise(
        new Error(`${command} exited with code ${code}${detail ? `: ${detail}` : ''}`),
      );
    });
  });
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

function captureTimestamp(durationSeconds) {
  const duration = Math.max(1, Number(durationSeconds) || 1);
  const endBuffer = Math.max(6, Math.round(duration * 0.04));
  return Math.max(1, Math.min(duration - endBuffer, Math.round(duration * 0.86)));
}

async function sha256(path) {
  const contents = await readFile(path);
  return createHash('sha256').update(contents).digest('hex');
}

async function imageDimensions(path) {
  const output = await run(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=s=x:p=0',
      path,
    ],
    { captureOutput: true },
  );
  const [width, height] = output.split('x').map(Number);
  if (!width || !height) throw new Error(`Unable to inspect ${path}`);
  return { width, height };
}

async function existingFrameIsValid(entry, destination) {
  if (REFRESH_FRAMES || !entry || !existsSync(destination)) return false;
  if (
    entry.captureVersion !== CAPTURE_VERSION ||
    entry.source !== 'youtube-video-frame' ||
    !entry.sha256
  ) {
    return false;
  }
  const image = await stat(destination);
  if (image.size < 12_000) return false;
  return (await sha256(destination)) === entry.sha256;
}

async function streamUrl(videoId, downloader) {
  const url = await run(
    downloader.command,
    [
      ...downloader.prefix,
      '--quiet',
      '--no-warnings',
      '--no-playlist',
      '--format',
      '22/18/best[ext=mp4][height<=720]/best[height<=720]/best',
      '--get-url',
      `https://www.youtube.com/watch?v=${videoId}`,
    ],
    { captureOutput: true },
  );
  const firstUrl = url.split(/\r?\n/).find(Boolean);
  if (!firstUrl) throw new Error(`No playable video stream for ${videoId}`);
  return firstUrl;
}

async function captureFrame(recipe, downloader) {
  const videoId = recipe.sync?.sourceId;
  const timestampSeconds = captureTimestamp(recipe.sync?.durationSeconds);
  const destination = resolve(imageDirectory, `${videoId}.jpg`);
  const temporary = resolve(imageDirectory, `.${videoId}.frame.tmp.jpg`);
  const url = await streamUrl(videoId, downloader);

  try {
    await run('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-ss',
      String(timestampSeconds),
      '-i',
      url,
      '-frames:v',
      '1',
      '-q:v',
      '2',
      temporary,
    ]);
    const image = await stat(temporary);
    if (image.size < 12_000) {
      throw new Error(`Captured frame is unexpectedly small (${image.size} bytes)`);
    }
    const dimensions = await imageDimensions(temporary);
    if (dimensions.width < 640 || dimensions.height < 360) {
      throw new Error(
        `Captured frame is below 640x360 (${dimensions.width}x${dimensions.height})`,
      );
    }
    await rename(temporary, destination);
    return {
      sourceId: videoId,
      source: 'youtube-video-frame',
      timestampSeconds,
      durationSeconds: recipe.sync?.durationSeconds,
      imagePath: `/assets/recipes/veggiedeer/${videoId}.jpg`,
      width: dimensions.width,
      height: dimensions.height,
      sha256: await sha256(destination),
      captureVersion: CAPTURE_VERSION,
    };
  } finally {
    if (existsSync(temporary)) await unlink(temporary);
  }
}

async function main() {
  if (
    !commandAvailable('ffmpeg', ['-version']) ||
    !commandAvailable('ffprobe', ['-version'])
  ) {
    throw new Error('ffmpeg and ffprobe are required for video-frame capture.');
  }
  const downloader = ytDlpCommand();
  const recipes = JSON.parse(await readFile(recipesPath, 'utf8'));
  const previousManifest = existsSync(manifestPath)
    ? JSON.parse(await readFile(manifestPath, 'utf8'))
    : [];
  const manifestById = new Map(
    previousManifest.map((entry) => [entry.sourceId, entry]),
  );
  const selected = recipes.slice(0, LIMIT);
  await mkdir(imageDirectory, { recursive: true });
  await mkdir(dirname(manifestPath), { recursive: true });

  console.log(
    `Capturing verified video frames for ${selected.length} recipes ` +
      `(${CONCURRENCY} concurrent)…`,
  );
  let completed = 0;
  await mapConcurrent(selected, CONCURRENCY, async (recipe) => {
    const videoId = recipe.sync?.sourceId;
    if (!videoId) throw new Error(`${recipe.id}: missing source video id`);
    const destination = resolve(imageDirectory, `${videoId}.jpg`);
    const previous = manifestById.get(videoId);
    if (await existingFrameIsValid(previous, destination)) {
      completed += 1;
      console.log(`Frames ${completed}/${selected.length}: ${videoId} (verified cache)`);
      return;
    }

    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const frame = await captureFrame(recipe, downloader);
        manifestById.set(videoId, frame);
        const checkpoint = recipes
          .map((item) => manifestById.get(item.sync?.sourceId))
          .filter(Boolean);
        await writeFile(
          manifestPath,
          `${JSON.stringify(checkpoint, null, 2)}\n`,
        );
        completed += 1;
        console.log(
          `Frames ${completed}/${selected.length}: ${videoId} ` +
            `@ ${frame.timestampSeconds}s (${frame.width}x${frame.height})`,
        );
        return;
      } catch (error) {
        lastError = error;
        console.warn(
          `Frame ${videoId} attempt ${attempt}/3 failed: ${error.message}`,
        );
      }
    }
    throw lastError;
  });

  const completeManifest = recipes
    .map((recipe) => manifestById.get(recipe.sync?.sourceId))
    .filter(Boolean);
  await writeFile(
    manifestPath,
    `${JSON.stringify(completeManifest, null, 2)}\n`,
  );

  for (const recipe of recipes) {
    const frame = manifestById.get(recipe.sync?.sourceId);
    if (!frame) continue;
    recipe.sync.imageSource = frame.source;
    recipe.sync.frameTimestampSeconds = frame.timestampSeconds;
    recipe.sync.frameSha256 = frame.sha256;
  }
  await writeFile(recipesPath, `${JSON.stringify(recipes, null, 2)}\n`);
  console.log(
    `Recorded ${completeManifest.length}/${recipes.length} verified video frames.`,
  );
}

await main();
