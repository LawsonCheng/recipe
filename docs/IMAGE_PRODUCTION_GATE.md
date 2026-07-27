# Image production gate report

## Current decision

**FAIL — release blocked.**

The curated catalogue requires 300 hero images and 1,857 distinct step images
(2,157 assets total). File structure alone is not proof of semantic quality.
The production validator therefore requires real provider provenance,
prompt-bound hashes, image-byte hashes and per-image independent visual
approval.

The previous SVG renderer has been removed and replaced by a command that
exits non-zero. No script in this repository can now claim that a procedural
placeholder is a production image.

## Release criteria

Production status requires every live manifest asset to pass (currently 2,157):

- correct WebP file, 4:3 ratio and stable unique destination;
- real image-model provider and model recorded without fabrication;
- prompt hash and asset SHA-256 match;
- visual entropy/colour-complexity gate;
- 64-bit perceptual dHash near-duplicate gate;
- named independent-agent reviewer approval of prompt alignment, exact step state,
  equipment, food safety, absence of text/watermark and absence of later-step
  content.

## Reproduce the decision

```sh
node scripts/build-image-manifest.mjs
node scripts/validate-recipe-images.mjs \
  --json=tmp/production-image-gate.json
```

Expected result until replacement work is complete: non-zero exit and
`Production image gate: FAIL`.

The validator's live counts are authoritative; this document intentionally
does not freeze a number that will become stale while assets are replaced.
Follow the queue, registration and approval workflow in
`docs/IMAGE_ASSET_SPEC.md`.
