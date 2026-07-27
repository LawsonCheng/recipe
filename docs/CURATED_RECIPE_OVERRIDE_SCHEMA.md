# Curated recipe operation overrides

This is the authoring contract for replacing generic generated procedures with
recipe-specific, independently reviewable culinary plans.

Each batch owns one file under `scripts/recipe-overrides/` and must not edit
`generate-recipes.mjs` or `src/data/recipes.json`.

```json
{
  "schemaVersion": 1,
  "sourceRecipeSHA256": "138f301839db394f5592a069db94c9b52d270833a8f9fc31d9d08f346e631948",
  "recipes": {
    "recipe-001": {
      "family": "sweetSourPork",
      "equipmentTypes": ["wok"],
      "applianceOverride": null,
      "ingredientChanges": {
        "remove": [],
        "add": [],
        "amounts": {
          "oil": { "amount": 500, "unit": "ml" }
        }
      },
      "signature": {
        "ingredientIds": ["porkLoin", "pineapple"],
        "techniqueIds": ["batter", "double-fry", "reduce-sweet-sour-sauce"]
      },
      "steps": [
        {
          "actionId": "cut-and-marinate-pork",
          "titleEn": "Cut and marinate the pork",
          "instructionEn": "One complete, executable instruction with exact quantities, heat, time, visible target and safety check.",
          "prepares": ["porkLoin"],
          "uses": [],
          "produces": ["marinated-pork"],
          "consumes": [],
          "targetStateEn": "Even 3 cm pieces, lightly seasoned"
        }
      ]
    }
  }
}
```

Rules:

- Include only recipes assigned to the batch. Every assigned BLOCK recipe must
  have an override; previously approved PASS recipes may be omitted.
- Write six to nine steps. One step has one main action.
- `instructionEn` must name every ingredient used in that step and give the
  exact amount whenever an ingredient is split across stages.
- Never use overview prose such as “sauté the aromatics according to cooking
  time”, “add the remaining ingredients”, or alternative branches such as
  “for fried rice / for a rice bowl”.
- `prepares` means washing, cutting, measuring, soaking or thawing only.
  `uses` means the ingredient is actually cooked, mixed, dressed or served in
  that step. The two arrays must not overlap.
- Every required ingredient must appear in at least one `uses` entry.
- A component in `produces` must be named in the instruction and consumed by a
  later step. Do not put raw ingredient IDs in `consumes`.
- Ingredient IDs in the plan must exist in the final ingredient list. Use
  `ingredientChanges` to remove wrong ingredients, add missing signature
  ingredients, or correct unsafe/impractical quantities.
- The method must match the dish name and Hong Kong household equipment:
  frying pan, Chinese wok, or Toshiba MX2-TT20SC and its safe accessories.
- `equipmentTypes` must list every cooking vessel/accessory actually used:
  `pan`, `wok`, `mx2`, `tray`, `steamRack`, `ceramicDish`. When an override
  changes an MX2 mode, temperature, preheat, water-tank, rack or vessel setting,
  include the complete final values in `applianceOverride`; use `null` when the
  recipe does not use the MX2.
- State final doneness where relevant: poultry 75°C; mince 71°C; fish opaque
  and flakes; discard unopened clams.
- Keep the flavour suitable for a Hong Kong family and ingredients reasonably
  obtainable in Hong Kong.
- Do not write Chinese or Indonesian yet. English culinary semantics will be
  independently approved before translation.

## Deterministic integration and release gate

Use the complete generation pipeline rather than editing `recipes.json`:

```sh
npm run recipes:generate
```

It regenerates the base catalogue, validates every override against that exact
base SHA-256, then applies the three batches while preserving catalogue recipe
order. The integration
replaces each curated English step title, instruction and target state exactly;
applies ingredient, equipment and MX2 changes; and derives new hero/step image
prompts, seeds and paths. Re-running the apply step with the same batch bytes is
idempotent.

The integrator consumes optional `titleZh`/`titleId`,
`instructionZh`/`instructionId`, `targetStateZh`/`targetStateId`, and added
ingredient `nameZh`/`nameId` fields. Where they are absent it preserves existing
localized values when possible and records only those missing fields under
`recipe.curation.pendingTranslations`. A missing localized value with no prior
copy receives an explicit `[TRANSLATION TODO:zh]` or
`[TRANSLATION TODO:id]` marker. Fully translated overrides automatically receive
`translationStatus: "complete"`; their localized image prompts are derived from
the approved translations and are not marked pending.

Production remains blocked until translators update all marked fields and their
localized image prompts, empty `pendingTranslations`, and set
`translationStatus` to `complete`:

```sh
npm run recipes:release-gate
```

`npm run check` includes this gate. It also verifies that the applied override
file hash and every authoritative English step still match the reviewed batch.
