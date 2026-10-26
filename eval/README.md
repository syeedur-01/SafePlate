# Evaluation set for the vision provider

This folder defines the **manifest** used to measure how well the AI reads test photos.
The photos themselves stay **out of git**.

## Layout

```text
eval/
├── manifest.json           ← the real manifest (one per team copy; photos stay local)
├── manifest.example.json   ← format example, committed
└── photos/                 ← the photos, GITIGNORED, never committed
```

`eval/photos/` is gitignored (`.gitignore` rule `eval/photos/`). Put the test photos there.
A real `manifest.json` stays local unless the team agrees it is safe to share;
`manifest.example.json` is the committed format reference.

## Manifest format

A manifest is a JSON **array of `EvalItem`** (see `tools/src/eval-lib.ts` for the exact type):

| field               | required for | meaning                                                                         |
| ------------------- | ------------ | ------------------------------------------------------------------------------- |
| `file`              | all          | file name of the photo, relative to `eval/photos/`                              |
| `kind`              | all          | `'dish'` or `'label'`                                                           |
| `split`             | all          | `'dev'` (tune prompts against it) or `'holdout'` (final run)                    |
| `expectedDishId`    | dish         | dish id from `dishes.json`; `null` when the dish is not on the 30-dish list     |
| `expectedAllergens` | label        | allergen ids from the contract vocabulary (section 11 of `docs/TECH_DESIGN.md`) |
| `expectedExpiry`    | label        | expiry date on the label as `YYYY-MM-DD`; `null` when none is printed           |
| `notes`             | optional     | free text; never sent to the model                                              |

Expected values must come from the photo itself or the real data files. Never invent an id,
an allergen or a date.

## Metrics

The pure functions in `tools/src/eval-lib.ts` score predictions against the manifest:

- `dishMetrics(items, predictions)` → `{ n, top1, top3, unknownRate }`
- `labelMetrics(items, predictions)` → `{ n, allergenPrecision, allergenRecall, expiryExact }`

Rules that apply to both:

- Only items whose expected field is present are evaluated (dishes need `expectedDishId`,
  labels are evaluated as a whole).
- An item without a prediction counts as a miss, never as a crash or an unknown.
- Every denominator of 0 returns `0`, never `NaN`.
- `unknownRate` counts first candidates whose `dishId` is `null` among evaluated dish items;
  they also count as top1/top3 misses.

The dev split is for tuning; the holdout split (P3-X05) is scored once and reported.
