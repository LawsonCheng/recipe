# Step image prompt guide

Every recipe step needs its own image. A step image is an instruction aid, not
decoration: the helper should be able to compare the photograph with the food
in front of them and tell whether they are doing the correct action and have
reached the correct state.

## Required prompt contract

Use English as the canonical generation prompt because image models generally
follow it most consistently. Keep the Traditional Chinese and Indonesian
versions semantically equivalent for editorial review.

Every prompt must explicitly state:

1. **Identity** — exact recipe name, step number and step title.
2. **Visible ingredients** — name the ingredients that are present at this
   moment. Do not say only “the ingredients”, “the topping” or “the main
   ingredient”. Include up to four distinctive ingredients; omit pantry items
   that are not visible.
3. **Action** — one unambiguous visible action, such as slicing, whisking,
   coating, frying, turning, transferring or checking the centre.
4. **Equipment and setting** — name the frying pan, Chinese wok, bowl, rack,
   ceramic baking dish or MX2-TT20SC. Include the visible heat cue or exact
   appliance mode, temperature and level when the instruction provides it.
5. **Checkpoint** — state what “correct now” looks like: evenly cut, lightly
   coated, small bubbles around the edge, translucent onion, golden surface,
   clear juices, opaque fish flakes, glossy reduced sauce, melted cheese, etc.
6. **Composition** — close overhead or 45-degree instructional photograph,
   one action only, hands permitted but face excluded, uncluttered Hong Kong
   home kitchen, three-person quantity, natural colour, no words, labels,
   collages, split screens or watermarks.
7. **Photographic realism** — the result must look captured by a real camera,
   with believable food texture, steam, oil sheen, depth of field and kitchen
   light. Explicitly reject cartoon, illustration, painting, anime, 3D render,
   CGI, clay, plastic-food and stylised-graphic output.

The prompt must describe the state **during or immediately after that exact
step**. It must not show the final plated dish during preparation, and adjacent
steps must not reuse the same composition.

## Manifest-builder template

The manifest builder can derive the bracketed fields from the recipe JSON:

```text
Instructional food photograph for “[RECIPE_EN]”, step [N] of [TOTAL]:
“[STEP_TITLE_EN]”. Show [VISIBLE_INGREDIENTS] [ACTION_IN_PROGRESS] using
[EQUIPMENT]. [HEAT_OR_MX2_SETTING]. The correct visual checkpoint is
[DONENESS_OR_TEXTURE]. [SHOT_AND_HAND_POSITION]. Hong Kong home kitchen,
realistic three-person quantity, accurate natural colour, clean work area.
Show only this step, not the finished dish. No text, labels, collage,
split-screen, logo or watermark.
```

For a step without a cooking setting, replace `[HEAT_OR_MX2_SETTING]` with a
spatial or preparation cue such as “raw-food board separate from the clean
vegetable board”. Never invent a temperature or doneness state that is absent
from the recipe.

### Wok or frying-pan example

```text
Instructional food photograph for “Hong Kong sweet and sour pork”, step 3 of
6: “Coat and heat the oil”. Show 390 g bite-size pork loin being evenly dusted
with a thin layer of cornstarch beside a Chinese wok of oil at 170–175°C.
One test crumb has just risen and small bubbles surround it; the pork is still
raw and is not yet in the oil. Tight 45-degree view with one gloved hand
shaking off excess starch, face excluded. Hong Kong home kitchen, realistic
three-person quantity, accurate natural colour, clean work area. Show only
this step, not the finished dish. No text, labels, collage, split-screen, logo
or watermark.
```

### MX2-TT20SC example

```text
Instructional food photograph for “Hong Kong baked pork chop rice”, step 5 of
6: “Bake on the lower level”. Show the heatproof ceramic baking dish holding
tomato rice, cooked pork chop and cheese on the steaming rack at the lower
level inside a Toshiba MX2-TT20SC. Bake mode, 200°C, 18–22 minutes; water tank
not used. The cheese is melted with scattered golden-brown spots and the
tomato sauce bubbles gently at the edge. Three-quarter view through the open
door before removal, oven-gloved hand visible, face excluded. Realistic
three-person quantity and natural colour. No text, labels, collage,
split-screen, logo or watermark.
```

### Preparation example

```text
Instructional food photograph for “Cantonese steamed sea bass”, step 1 of 6:
“Prepare the fish and aromatics”. Show one scaled and gutted sea bass being
patted completely dry, with thin ginger matchsticks and spring onion separated
beside it. Raw-fish board and knife are visibly separate from the clean
vegetable board. Tight overhead instructional view, hands only, face excluded,
realistic three-person quantity. The fish skin looks clean and dry, with no
seasoning or cooked garnish yet. No text, labels, collage, split-screen, logo
or watermark.
```

## Prompt-to-file invariants

- One manifest row per `recipe slug + step order`.
- Stable file name: `[recipe-slug]-step-[two-digit-order].webp`.
- Stable but different generation seed for every row.
- Store a SHA-256 digest of the canonical prompt; regenerate when it changes.
- Require one output file per manifest row and reject zero-byte, corrupt or
  duplicate-image files.
- Do not treat the recipe hero as a step image.
- Do not reuse an image between recipes or between steps, even when the action
  title is the same.
- Preserve the exact step order when binding generated files back to JSON.
- Store the actual provider, model, provider result ID, generation time,
  prompt hash and returned-file hash in the asset provenance sidecar.
- A prompt is not “generated” until the provider returned an image and that
  exact result was registered. Never create provenance for queued, failed or
  skipped calls.
- Procedural SVGs, fixed scene templates, recolouring, seed-driven geometric
  variations and rasterized placeholders are forbidden production outputs.

## Audit command

Diagnostic mode reports gaps but exits successfully:

```bash
node scripts/audit-image-prompts.mjs
```

Machine-readable output and a CI gate are also available:

```bash
node scripts/audit-image-prompts.mjs --json
node scripts/audit-image-prompts.mjs --strict
```

The semantic audit checks trilingual prompt presence, recipe and step identity,
named ingredients, action, equipment/heat, visual checkpoint, MX2 settings and
the no-text constraint. It intentionally fails generic prose such as “show
only the ingredients and utensils needed for this step” when no ingredients
or utensils are actually named.

## Human spot check after generation

For each cooking method, inspect at least one complete six-step sequence at
phone size and iPad landscape size. Reject an image if:

- the food or equipment does not match the step;
- a later-step state appears early, such as browned meat before frying;
- the image shows unsafe behaviour, extra burners or an unsupported appliance;
- raw and cooked food contact the same board or utensil;
- MX2 mode, rack level, vessel or water-tank state conflicts with the recipe;
- fingers, knives, steam, hot oil or oven handling look unsafe;
- text, gibberish labels, a collage or watermark appears;
- the result looks like a cartoon, illustration, painting, 3D render, CGI,
  clay/plastic model or other stylised graphic instead of a real photograph;
- two steps are visually indistinguishable.

Passing the automated audit is necessary but does not replace this visual
sequence review.

Independent reviewers must inspect every asset, not only a sample, before
setting visual QA to `approved`. Spot checks are useful for batch diagnosis but
cannot release the 2,157-asset inventory.
