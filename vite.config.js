import {
  copyFileSync,
  existsSync,
  readFileSync,
  unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, normalizePath } from 'vite';
import react from '@vitejs/plugin-react';

const recipeSourceFile = fileURLToPath(
  new URL('./src/data/recipes.json', import.meta.url),
);
const syncedRecipeSourceFile = fileURLToPath(
  new URL('./src/data/synced/veggiedeer-recipes.json', import.meta.url),
);
const virtualRecipeUrl = 'virtual:runtime-recipes-url';
const resolvedVirtualRecipeUrl = `\0${virtualRecipeUrl}`;
const generationOnlyFields = new Set([
  'imagePrompt',
  'imageSeed',
  'visual',
  'visualSpecification',
  'visualSpec',
  'generationMetadata',
]);

function runtimeRecipeJson() {
  const source = readFileSync(recipeSourceFile, 'utf8');
  const syncedSource = existsSync(syncedRecipeSourceFile)
    ? readFileSync(syncedRecipeSourceFile, 'utf8')
    : '[]';
  const recipes = [
    ...JSON.parse(source),
    ...JSON.parse(syncedSource),
  ];
  return JSON.stringify(
    JSON.parse(
      JSON.stringify(recipes),
      (key, value) =>
        generationOnlyFields.has(key) ? undefined : value,
    ),
  );
}

/**
 * Keeps the authoring JSON intact while publishing only fields the UI needs.
 * The resulting JSON is fetched after the app shell instead of being parsed as
 * part of the JavaScript bundle.
 */
function runtimeRecipeDataPlugin() {
  let resolvedConfig;

  return {
    name: 'runtime-recipe-data',
    enforce: 'pre',
    configResolved(config) {
      resolvedConfig = config;
    },
    configureServer(server) {
      const pathname = `${resolvedConfig.base}data/recipes.runtime.json`;
      server.middlewares.use((request, response, next) => {
        const requestPath = new URL(request.url || '/', 'http://localhost').pathname;
        if (requestPath !== pathname) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        response.end(runtimeRecipeJson());
      });

      server.watcher.add(recipeSourceFile);
      server.watcher.add(syncedRecipeSourceFile);
      server.watcher.on('change', (changedFile) => {
        if (
          [recipeSourceFile, syncedRecipeSourceFile]
            .map(normalizePath)
            .includes(normalizePath(changedFile))
        ) {
          server.ws.send({ type: 'full-reload' });
        }
      });
    },
    resolveId(id) {
      return id === virtualRecipeUrl ? resolvedVirtualRecipeUrl : null;
    },
    transformIndexHtml() {
      return [
        {
          tag: 'link',
          attrs: {
            rel: 'icon',
            type: 'image/svg+xml',
            href: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2214%22 fill=%22%23006c51%22/%3E%3Cpath d=%22M14 30h36c0 14-8 22-18 22S14 44 14 30Z%22 fill=%22white%22/%3E%3Cpath d=%22M20 26c2-8 8-12 12-12s10 4 12 12%22 fill=%22none%22 stroke=%22%23f0bf5a%22 stroke-width=%225%22 stroke-linecap=%22round%22/%3E%3C/svg%3E',
          },
          injectTo: 'head',
        },
      ];
    },
    load(id) {
      if (id !== resolvedVirtualRecipeUrl) return null;

      if (resolvedConfig.command === 'serve') {
        return 'export default import.meta.env.BASE_URL + "data/recipes.runtime.json";';
      }

      const referenceId = this.emitFile({
        type: 'asset',
        name: 'recipes.runtime.json',
        source: runtimeRecipeJson(),
      });
      return `export default import.meta.ROLLUP_FILE_URL_${referenceId};`;
    },
    closeBundle() {
      if (resolvedConfig.command !== 'build') return;

      const outputDirectory = join(resolvedConfig.root, resolvedConfig.build.outDir);
      const indexFile = join(outputDirectory, 'index.html');
      if (existsSync(indexFile)) {
        copyFileSync(indexFile, join(outputDirectory, '404.html'));
      }

      // The WebP hero is the only format referenced by the application.
      const unusedPngHero = join(outputDirectory, 'assets', 'home-table-hero.png');
      if (existsSync(unusedPngHero)) unlinkSync(unusedPngHero);
    },
  };
}

function normalizeBasePath(value) {
  if (!value) return '/';
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

export default defineConfig({
  plugins: [react(), runtimeRecipeDataPlugin()],
  base: normalizeBasePath(process.env.VITE_BASE_PATH),
  build: {
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    sourcemap: false,
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          return id.includes('node_modules') ? 'vendor' : undefined;
        },
      },
    },
  },
});
