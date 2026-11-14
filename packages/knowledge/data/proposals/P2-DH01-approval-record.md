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
4. Panta-ilish (class `fermented`, no fried tag despite pre-fried hilsa) — nutritionist's call.

## Known limitations accepted with this review (follow-ups for future cards)

- **Substring matching** (`packages/engine` label.ts, out of this card's scope): keyword matching is
  case-insensitive substring, so broad words over-warn by design (conservative direction, kept deliberately:
  removing `butter`/`milk` words would under-warn for a milk-allergic user). Documented collisions:
  egg→eggplant/eggless, til→lentil, rui→fruit, fish→shellfish, flour→rice flour, milk→coconut milk,
  বাদাম→চিনাবাদাম (peanut dishes also flag tree nuts). A future engine card should switch to whole-word/token
  matching; then decide whether `flour` and `বাদাম` should be dropped.
- **Policy questions**: coconut is not in tree_nuts (correct by most food laws, but confirm for BD labels);
  rasmalai and polao may also use pistachio; chotpoti is often topped with crushed puri (wheat) or chanachur
  (peanut); oats are omitted from gluten; plain "lecithin" omitted (may be soy or sunflower).
- The "avoid" level name may over-claim next to the "consider limiting" wording — confirm 30%/60% per dish.
- Bangla technical terms (খাদ্যশক্তি, খাদ্য উপাদান তালিকা, সম্পৃক্ত চর্বি) should be checked against how BSTI
  or INFS label them.
- All Act/Codex/Guideline page numbers unverified (see top). Re-run `check-sources` for
  `bd-dietary-guidelines`.
