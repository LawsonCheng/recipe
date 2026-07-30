#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
const batchRoot = resolve(
  projectRoot,
  'scripts/veggiedeer-enrichment/output/notebooklm',
);
const recipes = JSON.parse(
  await readFile(
    resolve(projectRoot, 'src/data/synced/veggiedeer-recipes.json'),
    'utf8',
  ),
);
const knownSourceIds = new Set(recipes.map((recipe) => recipe.sync?.sourceId));
const files = (await readdir(batchRoot))
  .filter((name) => /^batch-\d{3}-\d{3}\.json$/.test(name))
  .sort();
const errors = [];
const warnings = [];
const seenSourceIds = new Map();
const CJK = /[\u3400-\u9fff]/u;
const CITATION_SUFFIX = /(?:[A-Za-z)])\d{2,4}(?:[.,;:]|\s|$)/u;
const GENERIC = /^(?:(?:具體操作|specific action|tindakan khusus)\s*\d*|備料|準備食材|prepare ingredients?|依影片料理|cook or assemble|完成與享用|finish(?: and serve)?)$/iu;
const SOURCE_BOILERPLATE = /(?:source-grounded|grounded in the (?:video )?transcript|根據影片逐字稿|依影片|following the (?:video|transcript))/iu;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function issue(list, file, sourceId, path, message) {
  list.push(`${file} ${sourceId || '(missing sourceId)'} ${path}: ${message}`);
}

function localized(value, file, sourceId, path, minLengths) {
  for (const language of ['zh', 'en', 'id']) {
    const translated = text(value?.[language]);
    const minimum = minLengths?.[language] ?? 2;
    if (translated.length < minimum) {
      issue(errors, file, sourceId, `${path}.${language}`, `needs at least ${minimum} characters`);
    }
  }
}

for (const file of files) {
  const path = resolve(batchRoot, file);
  let candidates;
  try {
    candidates = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    errors.push(`${file}: invalid JSON (${error.message})`);
    continue;
  }
  if (!Array.isArray(candidates)) {
    errors.push(`${file}: root must be an array`);
    continue;
  }

  for (const candidate of candidates) {
    const sourceId = text(candidate?.sourceId);
    if (!knownSourceIds.has(sourceId)) {
      issue(errors, file, sourceId, 'sourceId', 'is not one of the 204 synced recipes');
    }
    if (seenSourceIds.has(sourceId)) {
      issue(
        errors,
        file,
        sourceId,
        'sourceId',
        `duplicates ${seenSourceIds.get(sourceId)}`,
      );
    } else if (sourceId) {
      seenSourceIds.set(sourceId, file);
    }

    localized(candidate?.title, file, sourceId, 'title');
    localized(
      candidate?.description,
      file,
      sourceId,
      'description',
      { zh: 10, en: 20, id: 20 },
    );
    for (const language of ['zh', 'en', 'id']) {
      if (SOURCE_BOILERPLATE.test(text(candidate?.description?.[language]))) {
        issue(errors, file, sourceId, `description.${language}`, 'contains workflow boilerplate');
      }
    }

    if (!Array.isArray(candidate?.ingredients) || candidate.ingredients.length < 2) {
      issue(errors, file, sourceId, 'ingredients', 'needs at least two ingredients');
    } else {
      candidate.ingredients.forEach((ingredient, index) => {
        const pathPrefix = `ingredients[${index}]`;
        localized(
          ingredient?.name,
          file,
          sourceId,
          `${pathPrefix}.name`,
          { zh: 1, en: 2, id: 2 },
        );
        if (CJK.test(text(ingredient?.name?.en)) || CJK.test(text(ingredient?.name?.id))) {
          issue(errors, file, sourceId, `${pathPrefix}.name`, 'English/Indonesian contains untranslated CJK text');
        }
        if (
          text(ingredient?.name?.id).length > 3 &&
          text(ingredient?.name?.id).toLocaleLowerCase('en-US') ===
            text(ingredient?.name?.en).toLocaleLowerCase('en-US')
        ) {
          issue(warnings, file, sourceId, `${pathPrefix}.name.id`, 'is identical to English; review translation');
        }
        if (ingredient?.amount == null) {
          issue(warnings, file, sourceId, `${pathPrefix}.amount`, 'quantity is not explicit in current evidence');
        }
      });
    }

    if (!Array.isArray(candidate?.steps) || candidate.steps.length < 3) {
      issue(errors, file, sourceId, 'steps', 'needs at least three procedural steps');
      continue;
    }
    candidate.steps.forEach((step, index) => {
      const pathPrefix = `steps[${index}]`;
      if (step?.order !== index + 1) {
        issue(errors, file, sourceId, `${pathPrefix}.order`, `must be ${index + 1}`);
      }
      localized(step?.title, file, sourceId, `${pathPrefix}.title`);
      localized(
        step?.instruction,
        file,
        sourceId,
        `${pathPrefix}.instruction`,
        { zh: 10, en: 20, id: 20 },
      );
      for (const field of ['title', 'instruction']) {
        for (const language of ['zh', 'en', 'id']) {
          const value = text(step?.[field]?.[language]);
          if (GENERIC.test(value)) {
            issue(errors, file, sourceId, `${pathPrefix}.${field}.${language}`, 'uses a generic workflow template');
          }
          if (CITATION_SUFFIX.test(value)) {
            issue(errors, file, sourceId, `${pathPrefix}.${field}.${language}`, 'contains a NotebookLM citation suffix');
          }
        }
      }
      if (CJK.test(text(step?.instruction?.en)) || CJK.test(text(step?.instruction?.id))) {
        issue(errors, file, sourceId, `${pathPrefix}.instruction`, 'English/Indonesian contains untranslated CJK text');
      }
      const english = text(step?.instruction?.en).toLocaleLowerCase('en-US');
      const indonesian = text(step?.instruction?.id).toLocaleLowerCase('en-US');
      const chinese = text(step?.instruction?.zh).toLocaleLowerCase('en-US');
      if (
        ['zh', 'en', 'id'].some(
          (language) =>
            text(step?.instruction?.[language]).toLocaleLowerCase('en-US') ===
            text(step?.title?.[language]).toLocaleLowerCase('en-US'),
        )
      ) {
        issue(errors, file, sourceId, `${pathPrefix}.instruction`, 'merely repeats the step title');
      }
      if (english && (english === indonesian || english === chinese)) {
        issue(errors, file, sourceId, `${pathPrefix}.instruction`, 'contains a copied English instruction instead of three translations');
      }
      if (SOURCE_BOILERPLATE.test(chinese) || SOURCE_BOILERPLATE.test(english) || SOURCE_BOILERPLATE.test(indonesian)) {
        issue(errors, file, sourceId, `${pathPrefix}.instruction`, 'refers to the source workflow instead of giving the cooking action');
      }
      const prompt = text(step?.imagePrompt);
      if (prompt.length < 40 || !/no text/iu.test(prompt)) {
        issue(errors, file, sourceId, `${pathPrefix}.imagePrompt`, 'needs a specific text-free image prompt of at least 40 characters');
      }
    });
  }
}

const report = {
  valid: errors.length === 0,
  batchFiles: files,
  candidateCount: seenSourceIds.size,
  missingCandidateCount: knownSourceIds.size - seenSourceIds.size,
  errorCount: errors.length,
  warningCount: warnings.length,
  errors,
  warnings,
};
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
