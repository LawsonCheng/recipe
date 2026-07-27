# Production recipe-image contract

Status: **the existing image set is not production ready**. Most current files
are low-complexity rasterized SVG templates and have no truthful model
provenance or independent visual approval. A unique path or SHA-256 does not prove that an
image was generated from its prompt.

## Non-negotiable inventory

- 300 recipe heroes and one image for every current recipe step. The curated
  catalogue currently has 1,857 steps, so the current target is 2,157 assets;
  the manifest derives this count from live data instead of assuming six steps.
- One separately generated 4:3 WebP for every manifest row.
- Step images show the exact current action and state, never a later step.
- No default, shared, procedural, recoloured, geometric, SVG-derived or
  template raster is acceptable.
- A real image-model result must have provider/model provenance and
  asset-by-asset independent visual QA.
- Every hero and step asset must be a photorealistic food photograph. Cartoon,
  illustration, painting, anime, 3D-rendered, CGI, clay, plastic-food or other
  stylised imagery is a release blocker.

Build the schema-v2 manifest:

```sh
node scripts/build-image-manifest.mjs
```

Every asset in `public/assets/generated/manifest.json` includes:

- stable `assetId`, `publicPath`, complete trilingual prompt and visual context;
- SHA-256 `promptHash` of the canonical trilingual prompt and
  `providerPromptHash` of the exact English prompt sent to the image model;
- `provider`, `model`, `generatedAt`, `assetSHA256`;
- stable `provenancePath`;
- automated, independent visual and release QA status.

The last five fields remain `null`/`pending` unless a matching provenance
sidecar exists. The manifest builder never invents them.

## Truthful provenance sidecar

Each image requires:

```text
public/assets/generated/provenance/<asset-id-with-double-dash>.json
```

The sidecar records schema version, asset ID/path, canonical and exact provider
prompt hashes, provider, model, provider asset/request ID, generation
timestamp, registered timestamp, input and production SHA-256, automated QA,
and named independent-agent visual review.

An image becomes release eligible only when all of these are true:

1. prompt hash matches the current manifest;
2. file hash matches `assetSHA256`;
3. provider/model/timestamps are real and complete;
4. automated format, complexity and similarity checks pass;
5. a named reviewer approves every semantic and safety check;
6. the manifest is rebuilt after approval.

Copying an existing file and fabricating provider metadata is prohibited.

## Generation queue

Create a bounded JSONL batch:

```sh
node scripts/image-generation-queue.mjs \
  --batch=50 --offset=0 --output=tmp/image-batch-001.jsonl
```

Useful filters:

```sh
node scripts/image-generation-queue.mjs --batch=25 --match=recipe-001
node scripts/image-generation-queue.mjs --batch=50 --offset=50
```

Each queue row contains exactly one English generation prompt, review context,
output requirements, destination, prompt hash, and registration command. Send
the prompt to a genuine image-generation provider separately. Do not mark a
request complete because a provider call was merely attempted.

Register an actual returned image:

```sh
node scripts/register-generated-image.mjs \
  --asset-id=recipe-001:step-01 \
  --input=/absolute/path/provider-result.png \
  --provider=<actual-provider> \
  --model=<actual-model> \
  --generated-at=<actual-ISO-8601-time> \
  --provider-asset-id=<actual-provider-id>
```

Registration verifies 4:3 input, writes a 1200×900 WebP, calculates hashes and
creates a pending sidecar. It deliberately does not approve the image.

For a reviewed provider-output batch, put the same seven fields
(`assetId`, absolute `input`, `provider`, `model`, `generatedAt`,
`providerAssetId`, `providerPromptHash`) in a JSON array and run:

```sh
npm run images:register-batch -- tmp/generated-assets.json
```

The batch command calls the same strict per-image registration path and stops
at the first invalid row. It never marks automated or visual QA as passed.

The old command is a safety guard and exits non-zero:

```sh
node scripts/render-recipe-images.mjs
```

It cannot render SVG/template placeholders.

## QA and release gate

Run the prompt audit before spending image-generation capacity:

```sh
node scripts/audit-image-prompts.mjs --strict
```

Run automated image QA and write truthful results to existing sidecars:

```sh
node scripts/validate-recipe-images.mjs --write-automated-qa
```

Independent agents inspect every image against its recipe instruction and
produce complete report files containing all seven checks. Apply a fully
approved exact-set report only after consolidation:

```sh
npm run images:visual-qa:consolidate -- <all review report paths>
npm run images:visual-qa:apply -- tmp/visual-qa/final-consolidated.json
```

Then rebuild the manifest and run:

```sh
node scripts/build-image-manifest.mjs
node scripts/validate-recipe-images.mjs \
  --json=tmp/production-image-gate.json
```

The gate rejects corrupt/missing/non-4:3 images, low visual entropy, low colour
complexity, perceptual near-duplicates, missing/stale/false provenance, hash
mismatch, forbidden template generators, pending automated QA, and incomplete
independent visual review.

Thresholds are deliberately conservative and reported in the JSON output.
They are necessary, not sufficient: image models can produce complex but
semantically wrong pictures, which is why independent asset-by-asset review
cannot be skipped.

## Stable paths

```text
/assets/generated/recipes/<recipe-id>-<recipe-slug>/hero.webp
/assets/generated/recipes/<recipe-id>-<recipe-slug>/step-01.webp
```

Changing a recipe position does not change its path. Recipe IDs, slugs, asset
IDs and filenames must remain unique.
