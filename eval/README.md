# Evaluation set for the vision provider

This folder holds the evaluation assets. Photos and datasets stay **out of git**;
only licence-cleared metadata (manifests, label maps) is committed.

Two formats coexist:

1. **Legacy manifest** (`manifest.json`, `manifest.example.json`) — hand-built
   `EvalItem[]` for small label-OCR / ad-hoc checks against `eval/photos/`.
2. **Benchmark manifest** (Phase 3, real datasets) — generated from a downloaded
   dataset with `eval-build-manifest`, richer licence/provenance fields.

## Layout

```text
eval/
├── manifest.json                    ← legacy manifest (local; format in manifest.example.json)
├── manifest.example.json            ← committed format reference
├── photos/                          ← GITIGNORED, never committed
├── datasets/                        ← GITIGNORED, downloaded datasets live here
│   └── bd-food33/                   ← unzipped BD-Food33 (category folders of images)
└── bd-food33.label-map.json         ← committed: dataset label → catalogue id mapping
```

## Real benchmark workflow (BD-Food33, CC0 1.0)

The licence audit lives in `docs/EVAL_DATASETS.md` — read it before downloading
anything. Then, from the repo root:

1. Download the dataset (approval-gated; see `docs/EVAL_DATASETS.md`):

   ```sh
   curl -L -o eval/datasets/bd-food33.zip "https://data.mendeley.com/public-files/datasets/8wt48bjmx3/files/fb35aa17-2d6f-4884-b06d-55589b760f88/file_downloaded"
   # verify against the SHA-256 published in docs/EVAL_DATASETS.md
   shasum -a 256 eval/datasets/bd-food33.zip   # or: sha256sum on Linux/WSL
   unzip eval/datasets/bd-food33.zip -d eval/datasets/bd-food33
   ```

2. Inspect the category folders and write `eval/bd-food33.label-map.json`
   (array of `{ datasetLabel, safePlateDishId, status, reason }`).
   **Never silently merge distinct foods**: map only clear matches; leave
   ambiguous labels unmapped (`safePlateDishId: null`, `status: "proposed"`).
   Mappings need human review (`status: "approved"`) before they are scored.

3. Build the manifest (hashes images, marks exact duplicates unused):

   ```sh
   pnpm --filter @sp/tools eval-build-manifest -- \
     --dataset eval/datasets/bd-food33 \
     --map eval/bd-food33.label-map.json \
     --out eval/bd-food33.manifest.json \
     --source "BD-Food33 v1 (Mendeley Data DOI 10.17632/8wt48bjmx3.1)" \
     --licence "CC0-1.0"
   ```

4. Run the evaluation locally (no deployed endpoint; CI-safe with mock):

   ```sh
   EVAL_PROVIDER=mock pnpm --filter @sp/tools eval-run -- \
     --mode local --manifest eval/bd-food33.manifest.json --dataset eval/datasets/bd-food33
   ```

   `EVAL_PROVIDER=gemini` also works locally but spends paid API calls —
   only with explicit approval, never in CI.

## Benchmark manifest format

A JSON array of entries (validated by `validateBenchmarkManifest` in
`tools/src/eval-manifest.ts`):

| field          | meaning                                                               |
| -------------- | --------------------------------------------------------------------- |
| `imageId`      | stable id derived from the image path (16 hex chars)                  |
| `imagePath`    | path relative to the dataset root; must not escape it                 |
| `kind`         | `'dish'`, `'label'` or `'spoilage'` (tasks are never scored together) |
| `datasetLabel` | the dataset's own label (top-level folder)                            |
| `split`        | `'dev'`, `'holdout'`, or `'unused'` (exact duplicates)                |
| `source`       | dataset name + DOI/URL                                                |
| `licence`      | e.g. `CC0-1.0`, `CC-BY-4.0`                                           |
| `attribution`  | required attribution string, or null for CC0                          |
| `mappedDishId` | catalogue dish id, or null while unmapped (unmapped never scored)     |
| `notes`        | free text                                                             |

Splits are deterministic (`deterministicSplit`: every 5th id by content hash is
holdout) and `splitLeaks` verifies no identical image lands in both dev and
holdout. Exact-byte duplicates are marked `unused` automatically.

## Metrics

- Legacy manifest: `dishMetrics` / `labelMetrics` in `tools/src/eval-lib.ts`.
- Benchmark: top-1, top-3, unknown rate, **macro-F1, per-class precision/recall
  with support, and a confusion matrix** in `tools/src/eval-metrics.ts`.
- Rules: unmapped labels are never scored; a missing prediction is a miss, not
  an unknown; every zero denominator returns 0, never NaN; support counts are
  always shown so class imbalance cannot hide.

## Known limitations

- Near-duplicate detection is exact-byte only; visually similar photos across
  sources still need manual review before splits are trusted.
- Label-OCR and spoilage-sign tasks have no real labelled data yet.
- The mock provider measures the harness, never recognition quality.
