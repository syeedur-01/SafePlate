# Evaluation report

> **Status (2026-11-18): there are no measured recognition results yet — nothing in this file is a performance claim.**

The evaluation runner (`tools/src/eval-run.ts`) and its metrics (`tools/src/eval-lib.ts`) are implemented and unit-tested, but they have never been run against a real photo set:

- No licensed evaluation images are committed. `eval/` contains only `README.md` and `manifest.example.json`; `fixtures/mock-scan/*.json` are synthetic fixtures, **not** evidence of real-world accuracy.
- The runner currently targets a deployed API; the v2 programme (Phase 3 of `SAFEPLATE_V2_IMPROVEMENT_PLAN.md`) is building a reproducible local benchmark with a licence-audited dataset.
- Until a real run is recorded here, recognition accuracy (top-1/top-3, unknown rejection, spoilage-sign precision/recall, label OCR quality) is **unmeasured**.

This file will be filled only from completed, reproducible runs, including: dataset and licence identification, model/provider and version, prompt/schema versions, run configuration, per-class support counts, and stated limitations.
