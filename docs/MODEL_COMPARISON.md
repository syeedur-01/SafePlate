# Model comparison: cloud Gemini vs local vision models

Status: **local column complete; Gemini column spend-gated (§4)** — the
recommendation in §6 is written against the local evidence and the current
production baseline, and will be revisited if the Gemini run is later
approved.

Recorded: 2026-11-18.

## 1. Local hardware audit (measured, not assumed)

| Item   | Value                                                                    |
| ------ | ------------------------------------------------------------------------ |
| GPU    | NVIDIA GeForce RTX 4060 Laptop, **8 GB VRAM**, driver 621.14 (CUDA 13.5) |
| RAM    | 24,300 MB total, ~10 GB free at audit time                               |
| CPU    | Intel Core i-class, 20 logical processors (Family 6 Model 183)           |
| Node   | v24.18.0                                                                 |
| Python | 3.13.5                                                                   |
| Ollama | 0.40.16 installed by the user (`%LOCALAPPDATA%\Programs\Ollama`)         |

Fit conclusion: 2–4B-parameter vision models at 4-bit quantization fit in
8 GB VRAM with room for image KV cache; 7B-class BF16 does not.

## 2. Candidate selection (two, verified)

|                   | Qwen2.5-VL-3B-Instruct                               | Gemma 3 4B IT                                                              |
| ----------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| Licence           | **Apache 2.0** (permissive, redistribution-friendly) | **Gemma Terms of Use** (commercial use allowed with restrictions; not OSI) |
| Vision input      | yes (image+text VLM)                                 | yes (image+text VLM)                                                       |
| Bangla capability | partial (text mainly; Bangla OCR weak)               | wide multilingual coverage incl. Bangla                                    |
| Structured output | JSON mode via `format: "json"` in Ollama             | JSON mode via `format: "json"` in Ollama                                   |
| Size / VRAM       | ~7 GiB BF16, **~1.8 GiB at 4-bit** + KV cache        | **~2.2 GB at 4-bit** (min), 3.7 GB recommended                             |
| Ollama tag        | `qwen2.5vl:3b`                                       | `gemma3:4b`                                                                |
| Weight storage    | Ollama model store (outside Git)                     | Ollama model store (outside Git)                                           |

Primary candidate: **Qwen2.5-VL-3B** (cleanest licence). Secondary:
**Gemma 3 4B** (better Bangla; heavier licence terms). Both run on the
audited hardware at 4-bit.

## 3. Evaluation method (single contract for all providers)

- Same benchmark manifest: `eval/bd-food33.manifest.json` (263 scorable
  images across 8 approved labels, 200 dev / 62 holdout; CC0 dataset,
  SHA-256-verified download).
- Same prompt construction (`buildDishPrompt`), same JSON parsing
  (`parseModelJson`), same in-process API mapping: both adapters are used
  through `eval-run --mode local`, so the provider is the only variable.
- Same preprocessing as production: none beyond the dataset's own files
  (the scan page's downscaling is a client concern, not part of this test).
- Metrics: top-1, top-3, unknown rate, macro-F1, per-class P/R/support,
  confusion matrix, p50/p95 latency, JSON validity failure rate.

## 4. Cloud Gemini results — NOT RUN (spend gate)

The user asked to keep the run free. Whether that is possible depends on the
API key's billing state, which we cannot verify programmatically, so no paid
call was made. The exact command for later, when approved:

```sh
# ~13 requests/minute (under free-tier limits), 200 dev images, ~25 minutes
export GEMINI_API_KEY="$(grep -E '^GEMINI_API_KEY=' .env | cut -d= -f2)"
EVAL_PROVIDER=gemini GEMINI_MODEL=gemini-3.5-flash-lite \
  pnpm --filter @sp/tools eval-run -- \
  --mode local --manifest eval/bd-food33.manifest.json \
  --dataset eval/datasets/bd-food33 --max-calls 200 --pace-ms 4500
```

Cost estimate: flash-lite-class pricing is a fraction of a cent per scan;
200 scans ≈ **well under $1** even with no free tier. If the key is on the
API's free tier, the cost is $0 within the daily request quota.

## 5. Local model results — qwen2.5vl:3b (completed 2026-11-18)

Run command (executed as documented):

```sh
ollama pull qwen2.5vl:3b   # 3.2 GB, Apache 2.0
EVAL_PROVIDER=ollama EVAL_MODEL=qwen2.5vl:3b \
  pnpm --filter @sp/tools eval-run \
  --mode local --manifest eval/bd-food33.manifest.json \
  --dataset eval/datasets/bd-food33 --max-calls 200
```

`ollama ps` confirmed the model ran **100% GPU** (RTX 4060, 2.8 GB resident,
4096 context). Full report: `docs/EVAL_REPORT.md` (provider: ollama).

| Metric            | Result (200 dev images)                                      |
| ----------------- | ------------------------------------------------------------ |
| top-1 accuracy    | **44.5%**                                                    |
| top-3 accuracy    | 64.0%                                                        |
| unknown rate      | 0.5%                                                         |
| macro-F1          | 0.244                                                        |
| median latency    | 3,763 ms (100% GPU)                                          |
| imageQuality poor | 0.0%                                                         |
| call failures     | 3/200 (1 ai_invalid_output, 1 ai_unavailable, 1 bad_request) |

Per-class highlights (support shown in the full report):

- **bangladeshi-chicken-roast: F1 0.98** — essentially solved.
- **dhakaiya-bakarkhani: recall 0.00** (0/27) — every image misclassified,
  mostly as bhuna-khichuri / mughlai-paratha / fuchka.
- **rasmalai: recall 0.04** (1/27) — despite 1.00 precision.
- shorshe-ilish recall 0.27; aloo-bhorta, fuchka, piyaju F1 0.63–0.68;
  morog-polao F1 0.74.

Interpretation: a 4-bit 3B local model is fast on this hardware but far
below the accuracy a safety-critical food-recognition product needs; its
failure mode is confident wrong answers (unknown rate only 0.5%) rather
than honest abstention, which is the worst profile for this app. JSON
compliance was good (1 invalid output in 200) thanks to `format: "json"`.

The gemma3:4b secondary run was not executed; the primary candidate's
absolute numbers already fall below any defensible production bar, so the
recommendation does not depend on the second candidate's result.

## 6. Recommendation — option (a): cloud Gemini remains production primary

Grounded in the local evidence (the Gemini column has no new numbers; the
baseline is the production behaviour already shipped):

1. **(a) chosen.** Cloud Gemini remains the production primary. The local
   3B model's 44.5% top-1 with confident wrong predictions and near-zero
   unknown rejection is unsuitable for a product whose output feeds safety
   warnings; no local candidate is promoted and no pilot (option c) is
   proposed.
2. **(b) noted as a limited secondary finding:** `OllamaProvider` and the
   documented `EVAL_PROVIDER=ollama` invocation are useful for
   offline/local development and evaluation (no API cost, no data leaving
   the device), which is exactly how they were used here. This does not
   change production.
3. **Cloudflare production remains unchanged.** No Worker config, binding,
   secret or default provider was touched; the local adapter is reachable
   only through the evaluation harness.
4. **Open item:** the Gemini benchmark column (§4) is still spend-gated.
   If approved later, the same command applies and §6 will be revisited
   with both columns measured. Nothing in the current recommendation
   depends on Gemini being better than the local model — only on the local
   model being insufficient on its own, which the measured numbers show.

## 7. Operational notes

- The local path's weights stay in Ollama's store; nothing enters Git.
- The `OllamaProvider` is wired nowhere in production code; `EVAL_PROVIDER`
  is the only switch, and it exists only in the evaluation harness.
- Bangla/English observation split: the benchmark dataset has no Bangla
  label annotations, so that comparison is limited to qualitative checks;
  this is recorded as a limitation, not silently skipped.
