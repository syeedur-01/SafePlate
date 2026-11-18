# Model comparison: cloud Gemini vs local vision models

Status: **in progress** — the local run is pending the Ollama install; the
Gemini run is spend-gated (see below). This file will hold the final results
and recommendation once both columns have real numbers.

Recorded: 2026-11-18.

## 1. Local hardware audit (measured, not assumed)

| Item   | Value                                                                    |
| ------ | ------------------------------------------------------------------------ |
| GPU    | NVIDIA GeForce RTX 4060 Laptop, **8 GB VRAM**, driver 621.14 (CUDA 13.5) |
| RAM    | 24,300 MB total, ~10 GB free at audit time                               |
| CPU    | Intel Core i-class, 20 logical processors (Family 6 Model 183)           |
| Node   | v24.18.0                                                                 |
| Python | 3.13.5                                                                   |
| Ollama | not installed at audit time (install in progress by the user)            |

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

## 5. Local model results — pending

Blocked on: Ollama installed by the user, then:

```sh
ollama pull qwen2.5vl:3b   # primary, Apache 2.0
EVAL_PROVIDER=ollama EVAL_MODEL=qwen2.5vl:3b \
  pnpm --filter @sp/tools eval-run -- \
  --mode local --manifest eval/bd-food33.manifest.json \
  --dataset eval/datasets/bd-food33 --max-calls 200
```

(gemma3:4b run optional as the second candidate.)

## 6. Recommendation

To be written only after both columns exist. The decision options per plan:
(a) cloud Gemini stays production primary; (b) local model is useful only for
offline/local use; (c) local model deserves a separately hosted pilot
(implements only with approval).

## 7. Operational notes

- The local path's weights stay in Ollama's store; nothing enters Git.
- The `OllamaProvider` is wired nowhere in production code; `EVAL_PROVIDER`
  is the only switch, and it exists only in the evaluation harness.
- Bangla/English observation split: the benchmark dataset has no Bangla
  label annotations, so that comparison is limited to qualitative checks;
  this is recorded as a limitation, not silently skipped.
