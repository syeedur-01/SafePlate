# P1-DH01 approval record (human decisions, applied 2026-11-11)

**Card:** P1-DH01 [HUMAN] Approve proposals — approvals applied by the agent on the explicit,
row-by-row decisions of the project owner given in the working session (logged below).
**Branch:** `d/P1-DH01-approvals`
**Files decided:** `fctb-matches.json` (`approvedFoodCode`), `usda-matches.json` (`approvedFdcId`).

## How the recommendations were prepared (agent evidence)

- FCTB 2013 PDF (fao.org, 226 pp) spot-check required by the card: **10/10 random `rowText`
  values confirmed** on their cited pages (9 exact; 1 — beef p129 — differs only in PDF text
  extraction spacing of "15-20%").
- Card rules applied: FCTB preferred over USDA; a USDA match approved only when it is genuinely
  the same food; doubtful matches rejected; no value invented anywhere (nulls stay null).

## Decision log (chat, 2026-11-11)

| #   | Ingredient      | Owner decision             | Detail                                                                                                                                                                              |
| --- | --------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | hilsa           | **approve 09_0033**        | owner chose the boneless row **plus** the source-stated edible coefficient (0.76) — see flags; the coefficient application itself is deferred to a follow-up card, not applied here |
| 3   | plain yogurt    | **NULL**                   | no genuine match exists                                                                                                                                                             |
| 4   | rice flour      | **NULL**                   | brown ≠ white flour                                                                                                                                                                 |
| 6   | moong dal       | **reject**                 | whole-bean proxy not accepted; goes to the follow-up lookup list                                                                                                                    |
| 42  | coconut kernel  | **approve 06_0006**        | owner asked for the full reasoning, then approved                                                                                                                                   |
| —   | everything else | **approve as recommended** | owner confirmed the catch-all after reviewing the prune example                                                                                                                     |

## Final tally

- **42 ingredients approved** (39 via codes/IDs the matcher had proposed and the owner ratified +
  3 manual FCTB adds the matcher had missed; rows verified in the PDF text — see below)
- **14 left NULL** (no genuine match in any opened source)
- Correction vs the earlier review-table draft: its bottom tally line said "35 approvals, 20
  NULL" — that arithmetic was wrong; the correct counts are 42 / 14 as applied above.

## Manual FCTB adds (values read from the PDF text by the agent, pages verified)

These codes were **not** among the proposals' candidates, so each entry also carries an
`approvedRows` array with the exact table/page/values for `apply-approved` (P1-D04) to consume —
the `FctbApproval` interface already supports explicit values.

| Ingredient                 | Code    | Row                                            | Values                                                  | PDF page        |
| -------------------------- | ------- | ---------------------------------------------- | ------------------------------------------------------- | --------------- |
| hilsa-raw-unverified       | 09_0033 | Hilsha, without bones, raw (Ilish, kata chara) | energy 223, protein 18.0, fat 16.8, carbs 0, fibre 0    | 116 (Proximate) |
| hilsa-raw-unverified       | 09_0033 | (same row)                                     | sodium 52                                               | 117 (Mineral)   |
| large-prawn-raw-unverified | 09_0055 | Prawn, Giant tiger prawn, raw (Chingri, Bagda) | energy 92, protein 16.5, fat 2.9, carbs 0, fibre 0      | 119 (Proximate) |
| large-prawn-raw-unverified | 09_0055 | (same row)                                     | sodium 117                                              | 120 (Mineral)   |
| coconut-kernel-mature-raw  | 06_0006 | Coconut, mature kernel (Narikel)               | energy 389, protein 3.3, fat 36.7, carbs 6.9, fibre 9.2 | 80 (Proximate)  |

Coconut kernel's mineral row (Na 16, p81) was already among the matcher's candidates.

## Flags for the expert review round / follow-up work

1. **Edible-coefficient policy (owner decision, not yet implemented):** hilsa approved with the
   boneless FCTB row while dish grams are as-bought (bone-in). Owner chose to apply FCTB's own
   edible-portion coefficient (0.76 for 09_0033). This generalizes to rohu, shrimp, mutton, beef
   (every row has its own coefficient) and changes the meaning of `grams_raw`, so it needs its own
   small card with tests and expert sign-off — deliberately **not** slipped into this approvals
   commit. Until then hilsa numbers are mildly generous (≤ ~1.3×), in the "safe" direction for
   sodium/sat-fat warnings.
2. **D04 tooling note:** apply-approved must read `approvedRows` (table/page/values) for the three
   manual adds; candidate-based approvals work as designed.
3. **wheat-flour sodium:** the proximate candidate is 01_0032, the sodium candidate 01_0031 (both
   "white flour"); a single `approvedFoodCode` (01_0032) was approved, so Na stays null unless D04
   maps the sibling code — flagged, not silently resolved.
4. **Follow-up source lookups (next work item, owner-approved plan):** USDA/IFCT proposals for
   plain yogurt, chhana, rice flour (white), moong dal, dried fish (shutki), white sugar, jaggery,
   broken wheat; plus sat-fat-only gaps for whole milk, egg, and skinless chicken leg.

## Complete per-ingredient decisions

Approved (42): water · white-rice · hilsa · onion · potato · beef-15-20 · eggplant · beef-lean ·
wheat-flour · bottle-gourd · rohu · mustard-oil · mutton · large-prawn · lentil-red · vermicelli ·
white-peas · coconut-milk · bengal-gram · egg · ghee · garlic · speckled-shrimp · ginger · tomato ·
green-chilli · salt · coconut-kernel · tamarind · mustard-seed · cashew · raisin · semolina ·
dried-plum · coriander-leaves · cumin · turmeric · cardamom · cinnamon · coriander-powder ·
bay-leaf · saffron

NULL (14): plain-yogurt · rice-flour · moong-dal · dried-fish-shutki · chhana · whole-spice-mix ·
fermentation-starter · red-chilli-powder · cow-milk (sat/sug only) · chicken-leg (sat/sug only) ·
white-sugar (sat/sug/Na) · date-palm-jaggery (sat/sug/Na) · broken-wheat · dried-red-chilli
(sat/sug only)

Exact codes per ingredient are in the two proposal JSONs (`approvedFoodCode` / `approvedFdcId`);
the FCTB/USDA-only split and per-row notes are in the review table that was shown to the owner
during the session.
