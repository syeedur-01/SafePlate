# Vision evaluation report

**Status: no real-world evaluation has been run yet.** The numbers below are a
pipeline validation against a tiny synthetic fixture and the deterministic
mock provider. They are **not** recognition accuracy and must never be cited
as evidence that SafePlate recognizes food correctly.

- run configuration: `--mode local` (in-process API app, no deployed endpoint)
- provider: `mock` (`EVAL_PROVIDER=mock`) — deterministic fixture picker, not a vision model
- data: 8 synthetic JPEG stubs under `eval/datasets/pipeline-demo/`
  (gitignored, clearly labelled "Synthetic pipeline demo (NOT real-world data)")
- date of pipeline validation: 2026-11-18
- prompt/schema version: whatever `main` carried on that date

## What the validation proved

The Phase 3 evaluation harness runs end to end offline:

1. `eval-build-manifest` walks a dataset directory, hashes every image,
   marks exact duplicates `unused`, and emits a licence-attributed manifest
   (validated by `validateBenchmarkManifest`).
2. `eval-run --mode local` evaluates a provider through the same in-process
   app code the API deploys, without a network endpoint.
3. Unmapped dataset labels are never scored; per-class support, macro-F1 and
   a confusion matrix are reported; failures are listed per image.

## Real-world results

None. A real benchmark requires a licence-cleared real image dataset. The
licence audit lives in `docs/EVAL_DATASETS.md` (BD-Food33, CC0 1.0, is the
approved first candidate). Until that dataset is downloaded and a real
provider is run, **no recognition claim exists**, in either direction.

## Limitations

- The mock provider cannot measure recognition quality.
- The synthetic fixture cannot measure anything about real photos.
- Near-duplicate detection is exact-byte only; visually similar photos across
  sources still need manual review before splits are trusted.
- Label-OCR and spoilage-sign evaluation tasks have no real labelled data yet;
  their metrics will only be reported when valid labelled samples exist.
