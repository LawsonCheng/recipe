#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const root = resolve(import.meta.dirname, "..");
const defaultFiles = [
  "scripts/recipe-overrides/recipes-001-100.json",
  "scripts/recipe-overrides/recipes-101-200.json",
  "scripts/recipe-overrides/recipes-201-300.json",
];
const requestedFiles = process.argv.slice(2).filter((value) => value.endsWith(".json"));
const files = (requestedFiles.length ? requestedFiles : defaultFiles).map((file) =>
  resolve(root, file),
);
const argument = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const fromId = Number(argument("from") || 1);
const toId = Number(argument("to") || 300);

const errors = [];
let recipeCount = 0;
let stepCount = 0;

const numericSignature = (value) =>
  [...String(value).matchAll(/\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?/gu)]
    .map((match) =>
      match[0]
        .replace(/\s+/g, "")
        .replaceAll(",", ".")
        .replace("–", "-"),
    )
    .sort((left, right) => left.localeCompare(right, "en", { numeric: true }));

const sameSignature = (left, right) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const countMatches = (value, pattern) => [...String(value).matchAll(pattern)].length;

const unitParityChecks = [
  {
    label: "grams",
    en: /\b\d+(?:\.\d+)?\s*g\b/gi,
    zh: /\d+(?:\.\d+)?\s*克/gu,
    id: /\d+(?:[.,]\d+)?\s*(?:g|gr)\b/gi,
  },
  {
    label: "millilitres",
    en: /\b\d+(?:\.\d+)?\s*ml\b/gi,
    zh: /\d+(?:\.\d+)?\s*毫升/gu,
    id: /\d+(?:[.,]\d+)?\s*ml\b/gi,
  },
  {
    label: "tablespoons",
    en: /\b\d+(?:\.\d+)?\s*tbsp\b/gi,
    zh: /\d+(?:\.\d+)?\s*湯匙/gu,
    id: /\d+(?:[.,]\d+)?\s*sdm\b/gi,
  },
  {
    label: "teaspoons",
    en: /\b\d+(?:\.\d+)?\s*tsp\b/gi,
    zh: /\d+(?:\.\d+)?\s*茶匙/gu,
    id: /\d+(?:[.,]\d+)?\s*sdt\b/gi,
  },
  {
    label: "centimetres",
    en: /\b\d+(?:\.\d+)?\s*cm\b/gi,
    zh: /\d+(?:\.\d+)?\s*(?:厘米|公分)/gu,
    id: /\d+(?:[.,]\d+)?\s*cm\b/gi,
  },
  {
    label: "Celsius temperatures",
    en: /\b\d+(?:\.\d+)?\s*°C/gi,
    zh: /\d+(?:\.\d+)?\s*°C/gu,
    id: /\d+(?:[.,]\d+)?\s*°C/gi,
  },
  {
    label: "minute durations",
    en: /\b\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*minutes?\b/gi,
    zh: /\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*分鐘/gu,
    id: /\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*menit\b/gi,
  },
  {
    label: "second durations",
    en: /\b\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*seconds?\b/gi,
    zh: /\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*秒/gu,
    id: /\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*detik\b/gi,
  },
];

for (const file of files) {
  const batch = JSON.parse(await readFile(file, "utf8"));
  for (const [recipeId, recipe] of Object.entries(batch.recipes ?? {})) {
    const numericId = Number(recipeId.replace("recipe-", ""));
    if (numericId < fromId || numericId > toId) continue;
    recipeCount += 1;
    for (const addition of recipe.ingredientChanges?.add ?? []) {
      for (const field of ["nameZh", "nameId"]) {
        if (typeof addition[field] !== "string" || addition[field].trim().length < 2) {
          errors.push(`${recipeId}: ingredient ${addition.id ?? "unknown"} missing ${field}`);
        }
      }
    }
    for (const [index, step] of (recipe.steps ?? []).entries()) {
      stepCount += 1;
      const label = `${recipeId}:step-${index + 1}`;
      for (const field of [
        "titleZh",
        "titleId",
        "instructionZh",
        "instructionId",
        "targetStateZh",
        "targetStateId",
      ]) {
        if (typeof step[field] !== "string" || step[field].trim().length < 2) {
          errors.push(`${label}: missing or empty ${field}`);
        }
      }

      const englishNumbers = numericSignature(step.instructionEn);
      for (const [locale, field] of [
        ["zh", "instructionZh"],
        ["id", "instructionId"],
      ]) {
        const translatedNumbers = numericSignature(step[field]);
        if (!sameSignature(englishNumbers, translatedNumbers)) {
          errors.push(
            `${label}: ${locale} numeric signature ${JSON.stringify(translatedNumbers)} ` +
              `does not match English ${JSON.stringify(englishNumbers)}`,
          );
        }
      }
      const englishTargetNumbers = numericSignature(step.targetStateEn);
      for (const [locale, field] of [
        ["zh", "targetStateZh"],
        ["id", "targetStateId"],
      ]) {
        const translatedNumbers = numericSignature(step[field]);
        if (!sameSignature(englishTargetNumbers, translatedNumbers)) {
          errors.push(
            `${label}: ${locale} target-state numeric signature ` +
              `${JSON.stringify(translatedNumbers)} does not match English ` +
              `${JSON.stringify(englishTargetNumbers)}`,
          );
        }
      }
      for (const unit of unitParityChecks) {
        const englishCount = countMatches(step.instructionEn, unit.en);
        for (const [locale, field] of [
          ["zh", "instructionZh"],
          ["id", "instructionId"],
        ]) {
          const translatedCount = countMatches(step[field], unit[locale]);
          if (translatedCount !== englishCount) {
            errors.push(
              `${label}: ${locale} ${unit.label} count ${translatedCount} ` +
                `does not match English ${englishCount}`,
            );
          }
        }
      }

      if (/\b(?:the|and|with|until|heat|cook|serve)\b/i.test(step.instructionZh ?? "")) {
        errors.push(`${label}: Traditional Chinese instruction contains untranslated English prose`);
      }
      if (/[将锅这后还发里边块让净烧盖开关鸡鱼汤盐酱]/u.test(step.instructionZh ?? "")) {
        errors.push(`${label}: Traditional Chinese instruction contains Simplified Chinese`);
      }
      if (
        /豬腰肉|機翼接頭|特級醬油汁|潮濕的凝乳|推入大凝乳|降低熱量|輕輕的壓力|折疊(?:起來)?(?:調味好的)?豬/u.test(
          step.instructionZh ?? "",
        )
      ) {
        errors.push(`${label}: Traditional Chinese instruction contains literal-machine wording`);
      }
      if (/[\u4e00-\u9fff]/u.test(step.instructionId ?? "")) {
        errors.push(`${label}: Indonesian instruction contains Chinese prose`);
      }
      if (
        /\b(?:babak belur|cairan kedelai tertinggi|hanya berfungsi bila|dadih|istirahat di bawah api)\b/i.test(
          step.instructionId ?? "",
        ) ||
        /\bhaluskan\b[^.]{0,40}\bnasi\b|\bnasi\b[^.]{0,40}\bhaluskan\b/i.test(
          step.instructionId ?? "",
        )
      ) {
        errors.push(`${label}: Indonesian instruction contains literal-machine wording`);
      }
    }
  }
}

if (errors.length) {
  console.error(`Recipe override translation validation failed with ${errors.length} issue(s):`);
  for (const error of errors.slice(0, 200)) console.error(`- ${error}`);
  if (errors.length > 200) console.error(`- …and ${errors.length - 200} more`);
  process.exit(1);
}

console.log(
  `Recipe override translation validation passed: ${recipeCount} recipes / ${stepCount} steps.`,
);
