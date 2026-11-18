# Known limitations

SafePlate is an MVP built for the International AI Builders Congress 2026. Everything in this file is true today; a limitation is removed here only when it is actually lifted. Read this before trusting any number the app shows.

## What the numbers are

- **Nutrient values are estimates from estimated recipes.** Gram amounts, serving weights and recipes are estimates (each carries `ESTIMATE` in the data), so the nutrition card is always marked **Estimated**. Lab values are scaled to a serving where they exist; the rest is calculated from ingredient composition.
- **Some dishes show "not enough data."** When too many ingredients in a recipe have no composition data, the card hides the numbers instead of showing a partial total. A missing value is `null`, never `0`.
- **Rules are drafts unless an expert approved them.** Safety and health rules carry a status; anything not yet approved is shown with a **Draft** badge. The point values are heuristic weights chosen by the team — they are not medical thresholds.

## What the app cannot see

- **Invisible chemical contamination cannot be detected.** No photograph shows bacterial load, pesticide residue or added formaldehyde. The chemical-limit notice says exactly this. The app judges what is visible: spoilage signs, storage time, declared allergens, label facts.
- **Photo recognition can be wrong.** The model returns candidates with a confidence score, and the app always asks you to confirm the dish before showing results. Confirm the wrong dish and the numbers will be about the wrong dish.
- **The allergen keyword list is conservative and incomplete.** Allergen detection matches a hand-built keyword list against ingredient text. It can miss synonyms, brand names and anything absent from the list. It is a help, not an allergist.

## Service limits

- **The free AI quota is small.** Scans call the Gemini free tier behind a daily budget; when the budget or the network runs out the app shows an error and offers the offline sample scans instead of guessing.
- **Sample scans and `/demo` scenarios are canned photos.** They run the real engine offline so the app can be judged without a camera or AI quota — they are not live recognition.

## Language

- **Bangla text was machine-drafted by AI.** Native-speaker review of the Bangla messages is a tracked team task (`docs/TEAM.md`, "Bangla review of messages"). Until the team records the actual coverage in this file, treat parts of the Bangla wording — especially knowledge-base text outside the demo flows — as unreviewed. English is the reference language.

## Not medical advice

SafePlate explains one food photo against a profile you saved on your own device. It is a demo, not a diagnosis: for medical decisions, talk to a clinician.
