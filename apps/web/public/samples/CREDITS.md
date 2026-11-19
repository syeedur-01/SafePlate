# Sample photo credits

The four sample cards on the scan screen use real, openly licensed photographs.
Nothing here is AI-generated. The files are served from this directory by URL
(never imported into the bundle, enforced by `scripts/size.ts`).

| File                        | Sample               | Source                                                                                                                                                                                             | Licence       | Author / attribution    |
| --------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------- |
| `sample-kacchi-biryani.jpg` | Kacchi Biryani       | Wikimedia Commons, [File:Basmati Kacchi Biryani (2).jpg](<https://commons.wikimedia.org/wiki/File:Basmati_Kacchi_Biryani_(2).jpg>)                                                                 | CC BY 4.0     | Nahian                  |
| `sample-mishti-doi.jpg`     | Mishti Doi (spoiled) | Wikimedia Commons, [File:Mishti Doi.jpg](https://commons.wikimedia.org/wiki/File:Mishti_Doi.jpg)                                                                                                   | CC BY 2.0     | Kirti Poddar            |
| `sample-label-snack.jpg`    | Label: snack         | Wikimedia Commons, [File:Moscow, Aug.2025 - Pyatyorochka private-label sour cream 01.jpg](https://commons.wikimedia.org/wiki/File:Moscow,_Aug.2025_-_Pyatyorochka_private-label_sour_cream_01.jpg) | Public domain | Retired electrician     |
| `sample-unknown-dish.jpg`   | Unknown dish         | BD-Food33 v1 (Mendeley Data, DOI 10.17632/8wt48bjmx3.1), image `Jhalmuri/jhalmuri_001.jpg` (imageId `8e483cbe59d315b2`), local manifest `eval/bd-food33.manifest.json`                             | CC0-1.0       | No attribution required |

Notes:

- The photos were resized to a maximum of 960 px on the long edge and
  re-encoded as JPEG (quality 75); no other modification was made.
- The CC BY / CC BY-SA attribution is also shown under the sample cards in the
  UI (`scan.sample.credits` in `apps/web/src/i18n/ui-strings.ts`).
- The packaged-label photo is a real product photo; the visible text on the
  package is Russian. The sample _result_ it plays is the offline English
  fixture `fixtures/mock-scan/label-snack.json` (no AI call).
