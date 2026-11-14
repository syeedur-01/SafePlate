# SafePlate data freeze — 2026-11-14

Frozen on branch `d/P3-X08-freeze`, immediately after the review stack (P2-DH01, P2-DH02,
a/E01, d/E02) merged into `main` (#43–#46, #51). This file records what was frozen and what
remains open. Regenerate with `pnpm --filter @sp/tools normalize && apply-approved &&
merge-rules && demo-gate` (in that order), then run Prettier over the written JSON files;
`packages/knowledge/test/runtime-sync.test.ts` fails if `data/runtime/runtime.json` drifts
from `buildRuntime()`.

## Counts

- Dishes: **30** (all quantities and serving weights are ESTIMATE)
- Ingredients: **56** (20 carry human-approved FCTB/USDA/gap values; 4 have no energy value)
- Health rules: **4** — 4 approved, 0 draft
- Safety rules: **10** — 10 approved, 0 draft
- Sources register: 10 entries — 8 verified, 2 unverified (`bd-bfsa`, `bd-bsti`)

## Coverage gate list (29 of 30 dishes pass, min coverage 0.8)

The gate list is `data/runtime/demo-dishes.json` (`dishIds`). The only dish below the
0.8 energy-coverage gate is **`shutki-bhorta`**, because `dried-fish-shutki-unverified`
and `fermentation-starter-unverified` have no energy values.

## Open items (must not be presented as final)

- **Draft rules: none.** All merged rules are approved; nothing carries `status: "draft"`.
- **Unreviewed quantities:** every ingredient quantity and cooked serving weight in
  `data/source/dishes.json` is `ESTIMATE` (`quantity_basis: "ESTIMATE"`); none has been
  reviewed by a nutritionist. `serving_weight_basis` is `ESTIMATE` for all dishes.
- **Salt values for beef-tehari and haleem remain 1 g placeholder estimates.** No published
  source exists (full search log: `data/proposals/salt-values-proposals.json`). The applied
  values — bhuna-khichuri 3.62 g (FCTB 01_0035), morog-polao 1.55 g (FCTB 01_0036),
  kacchi-biryani 2.61 g (UK CoFID 2021 19-454, lab-analyzed) — are documented back-calculations
  from published composites, guarded by `packages/engine/test/fctb-composites.test.ts`.
- **Unverified sources:** `bd-bfsa` (Bangladesh Food Safety Act citations verified verbatim
  from the PDF, register entry still `unverified`) and `bd-bsti` (dead endpoints).
- **Ingredients without energy values:** `whole-spice-mix-unverified`,
  `dried-fish-shutki-unverified`, `red-chilli-powder-unverified`,
  `fermentation-starter-unverified`.
- **AI perception outputs are never frozen here.** The LLM only classifies the photo; scores,
  warnings and nutrient numbers are computed deterministically by `@sp/engine`.
