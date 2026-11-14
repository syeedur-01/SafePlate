# P2-DH01 approval record

Date of review: 2026-11-14 · Card: P2-DH01 [HUMAN] Expert and language review · Branch: `d/P2-DH01-review`

## How this review was actually done (honest provenance)

**No human nutritionist, doctor, or native-Bangla-speaker session was held.** The owner could not book an
expert before the deadline. Instead, the review pack (`data/review/rules-review.csv`,
`data/review/dishes-review.csv`, `messages.json`, `allergen-keywords.json`, `sources.json`) was given to an
external AI (model not recorded; a general-purpose LLM) instructed to act as a stand-in panel:

1. a nutritionist/food-safety expert familiar with Bangladesh (Food Safety Act 2013, Codex texts, National
   Dietary Guidelines for Bangladesh 2025),
2. a native Bangla speaker,
3. a Bangladeshi grocery shopper.

The **owner read the review output and accepted it**; that acceptance is the human decision recorded here
(the human-in-the-loop required by AGENTS.md 3.10). It must be described exactly this way in the demo video:
"expert review was AI-assisted and accepted by the owner; no human nutritionist was involved."

**Reviewer limitation, stated up front:** the source PDFs (Safe Food Act, BD dietary guidelines, Codex texts)
were unreachable from the reviewer's environment, so **every section, clause and page number cited is
plausibility-checked only, not verified against the originals.** `sources.json`'s `bd-dietary-guidelines`
entry also remains unverified. A human should still re-run `check-sources` and spot-check citations.

## Applied decisions

### Rules (all 14 rules reviewed; reviewer said "15", the file has 14 — every rule got a decision)

Safety (`safety-rules-proposals.json`):

| Rule                                                                                                                                     | Decision                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| spoilage-visible-mold, slimy-surface, discoloration, leaking-packaging, separated-liquid, foam-or-bubbles, foreign-object, label-expired | keep (points confirmed in range)                                                                                                                                                 |
| spoilage-bloated-packaging                                                                                                               | keep points 35; **basis rewritten** — the cited text covers transport-damage inspection, not bloating; bloating-as-gas-producing-microbes is now marked as SafePlate's inference |
| dish-tag-seafood                                                                                                                         | keep points 8; **basis rewritten** — Codex CXC 52-2003 is about rejecting unfit fish at processing, so it is now cited only as a general freshness reminder                      |

All 10 safety rules: `status` → `approved`.

Health (`health-rules-proposals.json`):

| Rule                                 | Decision                                                                                                                                                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| diabetes-sodium, hypertension-sodium | keep limits (2000 / 1500 mg); **basis appended** — caution/avoid fractions (0.3/0.6) are SafePlate heuristics, not from the guideline; hypertension basis also flags the internally inconsistent quote (sodium < 1.5 g vs "salt < 1 tsp" ≈ 2000 mg sodium) for a human to check |
| diabetes-fried                       | keep (deep_fried + shallow_fried; reasonable inference from "restrict fat and oil, prefer boiling/steaming/grilling")                                                                                                                                                           |
| high-cholesterol-fried               | **match narrowed to `deep_fried` only** — the cited sentence covers deep-fried foods and oily snacks, not all shallow-fried food                                                                                                                                                |

All 4 health rules: `status` → `approved`.

### Dish data (4 confident fixes applied; source `cooking_method` text edited, class is derived by `classifyCooking`)

| Dish                | Class change                          | Method text now                                        |
| ------------------- | ------------------------------------- | ------------------------------------------------------ |
| bhuna-khichuri      | shallow_fried → boiled_or_simmered    | "rice and dal boiled together with roasted spices"     |
| rui-macher-jhol     | shallow_fried → braised_or_curry      | "fish lightly browned, then simmered in a light gravy" |
| dhakaiya-bakarkhani | braised_or_curry → baked_or_roasted   | "flaky dough baked until crisp"                        |
| chotpoti            | braised_or_curry → boiled_or_simmered | "peas and potatoes boiled with spices"                 |

Reviewer found **no allergen-list errors** in any dish; all gram amounts and other rows: keep.

### Messages and keywords (full-file replacements, mechanically verified before applying)

- `messages.json`: all 45 keys kept, **English unchanged** (except the two fixes below),
  `notice.chemical_limit` byte-identical to TECH_DESIGN §8, placeholders `{allergen}`/`{percent}`/`{nutrient}`
  identical in en/bn (enforced by knowledge tests). 31 of 45 Bangla texts improved by the reviewer.
- Accepted reviewer follow-up fixes applied after the file swap:
  - `swap.none`: English no longer says "safe for you" (never-claim-safe rule) → "…and has no warnings for
    your profile." Bangla updated to match.
  - `warn.diabetes_sodium` / `warn.hypertension_sodium` English now say "**daily** {nutrient} level" (the
    rules are daily limits; the reviewer's Bangla already said দৈনিক).
- `allergen-keywords.json`: 10 allergen keys, **no original keyword removed**, ~450 additions (e.g.
  soyabean oil, shorshe/সর্ষে, kasundi, shidol, golda/bagda, dalia, borhani). Deliberately NOT added (with
  reasons): chana (chickpea), bata (paste), mola (molasses collision), shing (shingara collision), rai
  (grain/রাইস collision), puri (purified collision), nut (nutmeg collision).

## Held — reviewer unsure, NOT applied (needs a real human)

1. **Cooking classes**: lau-chingri (shallow_fried → braised?), mughlai-paratha (deep_fried → shallow_fried?),
   bangladeshi-chicken-roast (shallow_fried?) — reviewer marked all three "Unsure"; left as-is.
2. **shutki-bhorta serving weight** 100 → ~60 g — plausible (ingredients sum to 57 g) but "Unsure".
3. **Salt 1 g → 2–3 g** in kacchi-biryani, beef-tehari, morog-polao, bhuna-khichuri, haleem — the reviewer is
   right that 1 g (~390 mg sodium) is implausibly low for 300–420 g servings and systematically understates
   sodium warnings, but setting a number is a nutritionist's call. **Do not invent it.**
   **→ Partly resolved 2026-11-14 (branch `d/E02-sourced-salt-values`):** the FCTB 2013 (already a verified
   source) turned out to contain cooked composite dishes: code 01_0035 **Plain Khichuri = 410 mg Na/100 g**
   (recipe calculation from Pasricha et al 2006) and code 01_0036 **Plain pulao = 167 mg Na/100 g** (Rahim 2013),
   PDF pp. 28–29. On that direct basis the salt lines were set by deterministic back-calculation:
   bhuna-khichuri 1 → **3.62 g**, morog-polao 1 → **1.55 g** (see each dish's second source entry and the new
   engine test `fctb-composites.test.ts`). A second search pass on the same day found a laboratory-analyzed
   biryani value in the UK CoFID 2021 dataset (McCance & Widdowson, GOV.UK): code 19-454 "Biryani, chicken,
   takeaway" = **263 mg Na/100 g**, 10 samples from 2 establishments in each of 5 regions (Aspland and James
   Ltd 1997), so kacchi-biryani 1 → **2.61 g** as a documented cross-country proxy. For **beef-tehari and
   haleem no legitimate source exists in any database searched (CoFID included)** — they stay at 1 g and are
   documented in `data/proposals/salt-values-proposals.json` for a nutritionist to decide.
4. Panta-ilish (class `fermented`, no fried tag despite pre-fried hilsa) — nutritionist's call.

## Known limitations accepted with this review (follow-ups for future cards)

- **Substring matching** (`packages/engine` label.ts, out of this card's scope): keyword matching is
  case-insensitive substring, so broad words over-warn by design (conservative direction, kept deliberately:
  removing `butter`/`milk` words would under-warn for a milk-allergic user). Documented collisions:
  egg→eggplant/eggless, til→lentil, rui→fruit, fish→shellfish, flour→rice flour, milk→coconut milk,
  বাদাম→চিনাবাদাম (peanut dishes also flag tree nuts). A future engine card should switch to whole-word/token
  matching; then decide whether `flour` and `বাদাম` should be dropped.
  **→ Resolved 2026-11-14 (branch `a/E01-token-matching`):** the engine now matches keywords as whole tokens
  (Unicode-aware, punctuation-split, Bangla vowel marks kept attached to their word). All keywords were kept —
  including `flour` and `বাদাম` — so the conservative direction is preserved; the false-positive collisions above
  are fixed at the matching level, not by dropping keywords. Two single-token variants that substring used to
  catch (`wholewheat`, `wheatgerm`) were added to `wheat_gluten`. Remaining over-warnings are semantic, not
  mechanical: `butter`→peanut butter, `milk`→coconut milk, `flour`→rice/corn flour still match because the
  keyword word itself appears as a whole token (e.g. "rice **flour**"); fixing those needs per-ingredient
  knowledge, not matching changes. `cornflour` no longer triggers wheat_gluten — correct, it is maize.
- **Policy questions**: coconut is not in tree_nuts (correct by most food laws, but confirm for BD labels);
  rasmalai and polao may also use pistachio; chotpoti is often topped with crushed puri (wheat) or chanachur
  (peanut); oats are omitted from gluten; plain "lecithin" omitted (may be soy or sunflower).
- The "avoid" level name may over-claim next to the "consider limiting" wording — confirm 30%/60% per dish.
- Bangla technical terms (খাদ্যশক্তি, খাদ্য উপাদান তালিকা, সম্পৃক্ত চর্বি) should be checked against how BSTI
  or INFS label them.
- All Act/Codex/Guideline page numbers unverified (see top). Re-run `check-sources` for
  `bd-dietary-guidelines`.

## Update 2026-11-14: citation verification (card P2-DH02, branch `d/P2-DH02-verify-sources`)

The source PDFs were downloaded and their text extracted (pypdf). Results:

**Verified verbatim:**

- Food Safety Act 2013 (FAOLEX authentic English text): s26 (sub-standard food ban), s29 (sale after expiry),
  s32(c) (label must state production/packaging/expiry date), s34 (diseased/decomposed fish, meat, milk, egg) —
  all four match the bases exactly.
- National Dietary Guidelines for Bangladesh 2025 (142-page PDF, WHO-hosted CDN): printed page = PDF page − 22.
  - Guideline 2 (diabetes), printed p.69: "Sodium restriction varies with individual health status, usually in
    a range of <2000 mg/day is recommended" → diabetes-sodium basis confirmed.
  - Guideline 7 (hypertension), printed p.81: "sodium <1.5 g" (with fibre 30 g, cholesterol 150 mg) AND
    "Reduce salt intake to less than 1tsp/day, preferably three-quarters of a teaspoon/day" → the sodium-rule
    basis is faithful; **the 1.5 g vs 1 tsp inconsistency is in the source itself**, not a transcription error.
  - Guideline 2 (diabetes), printed p.68: "Use low fat and fat free cooking methods such as boiling, steaming,
    broiling, baking, roasting and grilling" → diabetes-fried basis confirmed.
  - Guideline 2 (fats and oils), printed p.19: "Limit the intake of deep-fried foods and oily snacks" →
    high-cholesterol-fried basis confirmed.
  - The reviewer's suspicion that "p.19 and p.68-69 both labelled Guideline 2 looks wrong" was checked: the
    document really does contain two different chapters both numbered Guideline 2 (fats/oils, and diabetes) —
    an editorial flaw of the source; both citations were correct. Noted in the bases.
- `sources.json`: `bd-dietary-guidelines` flipped to `verified` (accessedOn 2026-11-14, year 2025).

**Still unverified (not fixable from here):** Codex GPFH (CXC 1-1969) clause numbers 13.2.5 and 13.2.8 and the
fish code CXC 52-2003 — the FAO/Codex download endpoints are dead (sh-proxy redirects to the home page) and the
new codex.fao.org site search returned nothing. These remain plausibility-checked only, and the affected bases
and note fields say so. A human with normal web access should retry (the PDFs may be on mirrors) or consult the
Codex editorial print editions.
