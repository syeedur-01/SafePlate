# Evaluation dataset licence audit

Recorded: 2026-11-18. This file is the hard STOP gate required by
`SAFEPLATE_V2_IMPROVEMENT_PLAN.md` Phase 3: **no image may be downloaded,
committed, trained on or redistributed** unless its licence, attribution,
terms and provenance are verified and recorded here first.

Every claim below was verified against the live hosting page on 2026-11-18
(Mendeley Data dataset pages and the Hugging Face dataset card). File sizes
and hashes come from the Mendeley public API (`/public-api/datasets/<id>/files`).

## Verified candidates

### 1. BD-Food33 — approved for local evaluation use

| Field                    | Value                                                                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source                   | [Mendeley Data, `8wt48bjmx3` v1](https://data.mendeley.com/datasets/8wt48bjmx3/1)                                                                                                                              |
| Licence                  | **CC0 1.0** (Public Domain Dedication) — verified on the dataset page                                                                                                                                          |
| Contents                 | 1,200+ images, 33 categories of Bangladeshi local food                                                                                                                                                         |
| Files (per Mendeley API) | `local_food_pre.zip`, 139,862,419 bytes, SHA-256 `71801b8774e0c324366410f3e461b5fa3672df3dac275ed3945859ac9a5eeca7` — verify after download                                                                    |
| Attribution required     | No (CC0), but we still record the source DOI out of academic honesty                                                                                                                                           |
| Provenance caveat        | The card describes images gathered from public websites, restaurant sites, blogs and manual capture; provenance is **per-dataset, not per-image**. Do not assume every image shows a distinct dish or setting. |
| Redistribute metadata?   | Yes — CC0 places no restriction on the label/manifest metadata we commit                                                                                                                                       |
| Intended use             | Primary dish-recognition benchmark for local evaluation                                                                                                                                                        |

### 2. FoodBD v2 — approved for local evaluation use; download path unresolved

| Field                | Value                                                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source               | [Mendeley Data, `xh3ghf3jbg` v2](https://data.mendeley.com/datasets/xh3ghf3jbg/2), DOI `10.17632/xh3ghf3jbg.2`                                                                |
| Licence              | **CC BY 4.0** — verified on the dataset page **and** in the Mendeley API `data_licence` field                                                                                 |
| Contents             | 3,523 smartphone-captured meal images, 67 categories, polygon annotations; 1,837 images with nutrition estimates from a nutrition expert                                      |
| Attribution required | Yes — credit the authors (Ahmed, Haque, Huq, Ali, Masud, Naznin; United International University et al.) and indicate changes                                                 |
| Download status      | The Mendeley public API returns an empty file list for both versions (`size: 0`); the browser "Download All" button or a linked GitHub release may work. **Not downloaded.**  |
| Nutrition caveat     | The dataset's nutrition numbers are expert estimates for those images only. They are **not** approval to copy them into SafePlate's recipe database and not laboratory truth. |
| Intended use         | Secondary benchmark (larger, richer annotations) once a download path exists                                                                                                  |

### 3. Bangladeshi Food (Hugging Face) — usable locally with restrictions; do not redistribute derivatives

| Field        | Value                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Source       | [Hugging Face `tanziro/bangladeshi-food`](https://huggingface.co/datasets/tanziro/bangladeshi-food)                                         |
| Licence      | **CC BY-SA 4.0** for the dataset as a whole; individual images carry permissive licences (CC0, CC-BY, Public Domain, GFDL) recorded per row |
| Contents     | 2,273 images, ~604 classes, ~3.8 images/class — sparse per class                                                                            |
| Attribution  | Required — every row carries `attribution` (photographer) and `source_url` (Wikimedia/Flickr)                                               |
| Share-alike  | Any redistributed derivative dataset must also be CC BY-SA 4.0 — **we must not commit manifest+image derivatives of this dataset**          |
| Intended use | Optional local cross-check only. Any committed artifact derived from it (manifests, splits) needs explicit legal review. Default: not used. |

## Decision

- **BD-Food33 (CC0)** is the first real benchmark: cleanest licence, modest size (133 MB),
  published SHA-256, and CC0 allows committing label/manifest metadata.
- **FoodBD v2 (CC BY 4.0)** is the preferred larger benchmark once downloadable; attribution
  text will be added to the manifest and report when used.
- **HF CC BY-SA 4.0** is parked: share-alike makes committed derivatives a legal review item,
  and ~3.8 images/class is too sparse for reliable per-class metrics.

## Rules that follow from this audit

1. Image bytes live only under `eval/datasets/` (gitignored). Nothing under that path is ever committed.
2. Manifests and label maps committed to Git may only reference licence-cleared datasets
   (currently BD-Food33 and, once downloaded, FoodBD v2 with attribution).
3. Every manifest entry records `source`, `licence`, and the original dataset DOI/URL.
4. Any report built from these datasets credits the source in `docs/EVAL_REPORT.md`.
5. Re-verify licences before any public redistribution of derived assets (release gate).
