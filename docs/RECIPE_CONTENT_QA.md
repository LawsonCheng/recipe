# Recipe content production QA

This document covers the generated trilingual recipe content in
`src/data/recipes.json`. Image fidelity and independent visual approval are separate
release gates.

## Catalogue release contract

- Exactly 300 recipes and 1,857 detailed steps.
- Default yield is 3 servings.
- At least 12 baked-rice recipes.
- Cooking equipment is limited to a frying pan, Chinese wok, Toshiba
  MX2-TT20SC and its appropriate tray, steaming rack or heatproof vessel.
- Every recipe and step has Traditional Chinese, English and Indonesian copy.
- Step image prompts contain the complete corresponding instruction.
- Every recipe declares a semantic `family` and signature ingredient/technique
  identifiers. Every step declares an `actionId`, exact ingredient `uses[]`
  and a visible `targetState`.

## Ingredient-aware preparation rules

- Eggs are never washed, patted dry, diced or marinated. They are beaten,
  kept whole, steamed, boiled or added off heat according to the method.
- Mince is never washed, patted dry or diced. Patty and meatball dishes shape
  equal-size portions; loose-mince dishes explicitly loosen or break it up.
- A whole fish remains whole. It is scaled, gutted, dried and shallow-scored,
  never cut into bite-size pieces.
- Clams are purged and scrubbed. Only recipes containing clams instruct the
  cook to discard unopened shells.
- Honey, breadcrumbs, butter, cream, oils, dry spices and sauces are measured,
  not washed or cut.
- Tofu is drained and blotted. Lentils are checked and rinsed; canned
  chickpeas are drained and briefly rinsed.
- Secondary proteins are prepared by their own rules and are not described as
  vegetables.

## Doneness and appliance rules

- Chicken and duck: 75°C at the thickest point.
- Mince: 71°C at the centre.
- Fish: opaque at the thickest point and flakes with gentle fork pressure.
- Prawns and squid: just opaque; stop cooking promptly to avoid toughness.
- Clams: discard any that remain closed after cooking.
- MX2 Pure Steam: 50–100°C range, water tank filled with filtered or distilled
  water below 40°C, no preheat.
- MX2 Steam Bake: 100–230°C and water tank required.
- MX2 Bake: 70–230°C; food goes in only after the preheat beep.
- Recipes use manual MX2 settings rather than assuming an auto-menu weight.
- Baked rice always cooks and rests the rice before assembly, uses a heatproof
  ceramic dish on the lower level, and cooks raw protein before mixing it with
  rice.

## Automated release checks

Run from the project root:

```sh
node scripts/generate-recipes.mjs
node scripts/validate-recipe-content.mjs
node scripts/audit-image-prompts.mjs
npm run lint:data
npm run build
```

`validate-recipe-content.mjs` blocks known template contamination, duplicate
English instructions, unlisted pantry ingredients, ingredients not used by any
step, missing direct ingredient names, missing signature ingredients or
techniques, required doneness statements, incorrect clam rules, broken
whole-fish handling, missing rice-bake sequencing and invalid MX2 metadata or
instructions.

`audit-image-prompts.mjs` requires all 1,857 step prompts to identify the
recipe and step, name the relevant ingredients and action, show the requested
target state and equipment setting where applicable, prohibit visible text,
and remain unique.

The signature-dish gate includes okonomiyaki, palak paneer, cold chicken
noodles, tofu hamburger steak, omelette rice, bibimbap, dumpling soup, Thai
basil pork, lettuce cups, pineapple coconut glutinous rice, beef rendang,
chicken satay and gado-gado. These recipes use dedicated step composers rather
than a method-only template.

## Manual sampling matrix

The content review should include at least these risk groups on every catalogue
release:

| Group | Representative checks |
| --- | --- |
| Egg | tomato scrambled egg, steamed egg custard, carbonara, egg curry, baked eggs |
| Mince | steamed pork patty, mapo tofu with mince, hamburger steak, meatballs, meatball rice bake |
| Seafood | whole steamed fish, fish soup with clams, prawn soup, squid stir-fry |
| Long cooking | brisket stew, ribs, lamb curry |
| Delicate food | silken tofu braise, egg custard, fish fillet |
| MX2 | Pure Steam, Bake, Steam Bake, ceramic-vessel baked rice |
| Staples | fried rice, congee, noodles, pasta, all 12 baked-rice recipes |

## Independent review and remaining production risk

Automated checks cannot prove flavour balance, exact supermarket brand
saltiness, produce variability or real-world appliance heat distribution. A
representative cook test by the household is still required before treating
all 300 recipes as field-validated. For MX2 dishes, verify the first cook a few
minutes early and extend only after checking doneness; never lower the stated
food-safety endpoint.

Do not mark a catalogue release as locked from generator self-validation
alone. A separate reviewer must inspect semantic duplication, signature-dish
identity, ingredient-to-step coverage and a risk-based sample from the matrix
above. Image production additionally requires independent visual approval that each
generated frame matches its exact step; prompt traceability does not prove
image fidelity.
