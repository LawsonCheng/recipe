# Veggie Deer enrichment pipeline

This directory contains the reviewed enrichment workflow for the 204 synced
Veggie Deer videos. Candidate generation is isolated from production. The
preferred evidence path is a source-specific NotebookLM response; when
NotebookLM reports that a YouTube source cannot be imported, the explicit
fallback is:

1. downloads the YouTube metadata and mono 16 kHz WAV audio;
2. runs Chinese Whisper transcription with timestamped segments;
3. preserves the published description and runs local Apple Vision OCR over
   likely ingredient-card frames;
4. writes a self-contained evidence packet with no model-authored claims;
5. normalizes only source-evidenced ingredients, quantities and procedures in
   Traditional Chinese, English and Bahasa Indonesia; and
6. generates one text-free OpenAI image per reviewed cooking step.

Outputs live in `scripts/veggiedeer-enrichment/output/` by default and should
not be committed. Review the candidate before a separate integration process
copies its fields and frames into production data/assets.

## Review and integrate candidates

The integration script reads every
`scripts/veggiedeer-enrichment/output/candidates/*.json` file, but by default
it will merge **only** candidates whose `reviewStatus` is exactly `approved`.
Run the batch QA before promotion:

```bash
node scripts/veggiedeer-enrichment/validate-batches.mjs
```

Mark a candidate approved only after checking its quantities, three-language
copy, procedural ordering and image prompts. Promotion is deliberately
single-source:

```bash
node scripts/veggiedeer-enrichment/promote-reviewed.mjs SOURCE_ID
```

Preview the complete merge without changing production data or assets:

```bash
node scripts/veggiedeer-enrichment/integrate.mjs --dry-run
```

Apply all approved candidates:

```bash
node scripts/veggiedeer-enrichment/integrate.mjs
```

For a controlled automated batch, the main pipeline may explicitly opt in to
unreviewed generator output:

```bash
node scripts/veggiedeer-enrichment/integrate.mjs \
  --allow-generated --dry-run
```

`--allow-generated` admits only the known `needs-human-review` and `generated`
statuses in addition to `approved`; it never admits `rejected` candidates.
Use `--output DIR` when the enrichment command wrote to a non-default output
root.

During a real integration, every generated step image is verified, hashed, and
copied to
`public/assets/recipes/veggiedeer/generated-steps/<sourceId>/step-XX.png`. The script
updates `src/data/synced/veggiedeer-step-frame-manifest.json` using the release
gate's manifest contract and writes the recipe collection last. All output
files are staged beside their targets and swapped into place as one
rollback-capable transaction. Candidates that were not selected and all other
synced recipe objects remain structurally unchanged.

Candidates may also contain optional top-level `title` and `description`
localized objects. When either is present, the integrator requires complete
`zh`, `en` and `id` values. Titles preserve the synced Chinese source; reviewed
descriptions may replace copied video copy with a concise recipe summary.

## Evidence-only fallback

Use this only for source IDs that NotebookLM explicitly failed to import:

```bash
python3 scripts/veggiedeer-enrichment/enrich.py \
  --video-id SOURCE_ID \
  --transcriber mlx \
  --mlx-whisper-model mlx-community/whisper-small-mlx \
  --evidence-only
```

The packet is written to `output/evidence/SOURCE_ID.json`. This path uses no
Ollama extraction and must not be described as a NotebookLM result.

For a high-volume backfill where the immediate need is only source metadata and
timestamped speech, use the frame-free transcript path. It does not capture
ingredient cards, screenshots, or step frames:

```bash
python3 scripts/veggiedeer-enrichment/enrich.py \
  --all --transcript-only --transcriber mlx
```

Use automatic captions only as a fast probe; if a video has no Chinese captions,
run the MLX transcription path for that source instead. Quantities that are not
spoken or otherwise source-evidenced remain unknown until a targeted review.

## Translate title and description metadata

Use the local `qwen3-vl:8b` Ollama model to translate only missing English and
Indonesian title/description fields. Production data is always read-only:

```bash
node scripts/veggiedeer-enrichment/translate-metadata.mjs \
  --limit 2 --dry-run
```

The dry run calls Ollama and prints the two translated titles plus description
previews, but writes nothing. For the full resumable run:

```bash
node scripts/veggiedeer-enrichment/translate-metadata.mjs
```

Translations are cached per source ID in
`output/metadata-translations/<sourceId>.json`. A cache entry includes a hash
of the Chinese source, existing translations, prompt version and model, so a
changed source is translated again automatically. Use `--refresh` to bypass
valid cache explicitly.

Once recipe candidates exist, inject complete trilingual metadata into them
without touching production:

```bash
node scripts/veggiedeer-enrichment/translate-metadata.mjs \
  --update-candidates
```

`--source-id ID` (repeatable), `--limit N`, `--model NAME` and `--output DIR`
can narrow or relocate a run. Ollama is called sequentially with temperature
`0.1`, a deterministic seed and a per-recipe JSON schema. A culinary glossary,
Han-character check and post-response term checks guard common
mistranslations such as treating 玉米 as beans or 燜飯 as nasi goreng. A failed
QA result is retried up to three times with the specific error fed back to the
model; rejected output is never cached.

For a long batch, add `--continue-on-error` to finish the remaining recipes and
print every failed source ID at the end. Successful translations are cached
immediately, so rerunning the same command resumes from the failures.

## Prerequisites

- `ffmpeg` and `ffprobe`
- `yt-dlp` (or `uv`, so `uvx yt-dlp` works)
- On Apple Silicon, `uv`/`uvx` for the default fast MLX Whisper transcription.
- Python 3 plus the OpenAI Whisper module for the fallback (the pipeline tries
  the `whisper` command, then automatically falls back to
  `python3 -m whisper`):

  ```bash
  python3 -m pip install -U openai-whisper
  ```

- Ollama and an installed text-instruction model. `qwen3:8b` is the default:

  ```bash
  ollama pull qwen3:8b
  ```

The transcript default is `--transcriber auto`: MLX Whisper on Apple Silicon,
then OpenAI Whisper, then YouTube automatic captions. The captions route labels
the result
`youtube-auto-captions-fallback`; it is useful only for diagnosing the rest of
the pipeline and must not be represented as audio transcription.

If YouTube blocks an authenticated request, add your own temporary yt-dlp
browser cookie store explicitly (the value itself is never output or persisted):

```bash
python3 scripts/veggiedeer-enrichment/enrich.py --video-id bWacVFFyigk \
  --cookies-from-browser chrome
```

Do not put exported cookie files in this repository or the generated JSON.
The pipeline defaults to yt-dlp's `android_vr` YouTube player client and format
18, which avoids the current web-client bot challenge. Override the client only
when needed with `--youtube-player-client CLIENT`.

## Run the end-to-end pilot

```bash
python3 scripts/veggiedeer-enrichment/enrich.py \
  --video-id bWacVFFyigk \
  --mlx-whisper-model mlx-community/whisper-small-mlx \
  --ollama-model qwen3:8b
```

To reuse an existing download:

```bash
python3 scripts/veggiedeer-enrichment/enrich.py \
  --video-id bWacVFFyigk --source-video /tmp/bWacVFFyigk.mp4 \
  --mlx-whisper-model mlx-community/whisper-small-mlx \
  --ollama-model qwen3-vl:8b
```

The resulting candidate is
`scripts/veggiedeer-enrichment/output/candidates/bWacVFFyigk.json`; its frames
are in `scripts/veggiedeer-enrichment/output/frames/bWacVFFyigk/`.

For a non-production smoke test when Whisper is not installed:

```bash
python3 scripts/veggiedeer-enrichment/enrich.py \
  --video-id bWacVFFyigk --transcriber auto --ollama-model qwen3-vl:8b
```

To make a batch after validating the pilot:

```bash
python3 scripts/veggiedeer-enrichment/enrich.py --all --limit 10
```

Batch runs resume automatically: an existing candidate is skipped. One failed
video does not stop the remaining videos; the final report lists every failed
`sourceId` and exits non-zero. Use `--refresh` to replace candidates and all
locally cached metadata/audio/transcripts. Every
candidate has `reviewStatus: "needs-human-review"`; unknown amounts and unclear
speech must remain unknown rather than being invented. Ingredient names/units
and step titles/instructions are emitted in Traditional Chinese, English and
Bahasa Indonesia.
