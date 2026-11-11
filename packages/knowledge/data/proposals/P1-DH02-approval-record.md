# P1-DH02 approval record — gap-fill lookups (IFCT 2017 / USDA / FCTB re-checks)

Date decided: 2026-11-11 (chat). Decision by the human owner; the agent verified every value
against the source text (PDF extraction, cross-checked against the official IFCT npm data dump
for column alignment only — the PDF is authoritative) and prepared this proposal file.

Branch: `d/P1-DH02-gap-lookups` · Proposals: `gap-matches-proposals.json` (all decisions below)

## Source priority applied

FCTB first, then IFCT 2017 (regional South Asian), then USDA as last resort.
IFCT 2017 (Longvah et al., ICMR-NIN) was registered this card as source `ifct-2017`;
its copyright notice (book p.3) encourages data use with full acknowledgment — every value
below is cited by IFCT food code and physical PDF page. The PDF itself is kept out of the repo.

## Decisions

| #   | Ingredient                     | Decision  | Source(s) and note                                                                                   |
| --- | ------------------------------ | --------- | ---------------------------------------------------------------------------------------------------- |
| 1   | moong dal (all 8 fields)       | approve   | IFCT B010 exact dal row (p42, 154, 230, 210) — replaces the rejected whole-bean proxy                |
| 2   | broken wheat (all 8)           | approve   | IFCT A021 bulgur ("Dalia" in IFCT's regional list); parboiled-vs-raw proxy flagged                   |
| 3   | date-palm jaggery (sat/sug/Na) | approve   | mixed: FCTB 15_0004 Na 79 (p159); IFCT I001 sat 0.0692 (p260), sugars 84.32 (p224)                   |
| 4   | white sugar (sat/sug/Na)       | approve   | USDA 169655 (sat 0, sugars 99.8, Na 1); FCTB 15_0008 Na 5 verified but not used                      |
| 5   | whole milk (sat/sug)           | approve   | USDA 171265 (sat 1.865, sugars 5.05)                                                                 |
| 6   | egg (sat/carbs/sug/Na)         | approve   | USDA 171287 (sat 3.126, carbs 0.72, sugars 0.37, Na 142)                                             |
| 7   | chicken leg (sat/sug)          | approve   | USDA 173619 (sat 1.05, sugars 0)                                                                     |
| 8   | plain yogurt (all 8)           | approve   | USDA 171284 plain whole-milk yogurt — **supersedes the P1-DH01 NULL**                                |
| 9   | chhana (7 of 8)                | approve   | IFCT L003 paneer (p57, 184, 260); sugars AND fibre left null (source-internal conflict / blank cell) |
| 10  | rice flour (all 8)             | approve   | USDA 169714 white rice flour, unenriched — **supersedes the P1-DH01 NULL**                           |
| 11  | dried fish shutki (all 8)      | no-source | stays null; USDA dried-salted cod rejected (Na 7027 unrepresentative)                                |

## Verified-source notes (for the next reviewer)

- IFCT Table 6 "Available CHO" disagrees with Table 1 proximate for B010 (42.01 vs 52.59) and
  A021 (61.74 vs 69.06). Table 1 was used for `carbs_g` because it is consistent with the
  reported energy; Table 6 was used only for `sugars_g`.
- IFCT "Total Free Sugars" for dairy includes lactose from the Table 6 footnote; paneer's 11.57
  contradicts its own proximate CHO 2.41 — hence chhana `sugars_g` stays null.
- The npm package `ifct2017@2.1.2` (third-party digitization) is corrupted for L003 proximate
  values; never use it as a source of values, only as a column-alignment aid.
- The stale `usda-matches.json` candidate lists for the six USDA-approved ingredients above are
  misaligned (e.g. the milk entry lists egg products); D04 should take these ingredients from
  `gap-matches-proposals.json`, which carries explicit row-level provenance.
