# PHASE 5: Final version (after the MVP submission), outline only

This is a list of directions, **not task cards**. Cards are written after the MVP is submitted, using what the judges and real users show. Everything here builds on the extension points in `TECH_DESIGN.md` section 10. Nothing in the MVP needs to change to make room for it.

The final showcase is **Saturday Dec 26, 2026** (Daffodil International University). Plan roughly: November for data quality and accounts, early December for community, mid December for hardening and the showcase build.

## 5.1 Data quality (highest value, do first)

- Expert-approved recipes: replace estimated gram quantities with reviewed ones; flip rule `status` from `draft` to `approved`.
- Add the remaining 15 dishes from the original list of 45, then more.
- Fill nutrient gaps with lab-analyzed values from published INFS studies where available; keep the "estimated" label wherever values are calculated.
- Price data for staples (a 2026 open dataset covered rice, wheat flour, lentils and oil in 76 markets; verify before use) to make the shopping list price-aware.
- Cholesterol and gastric rules once an official source supports them.

## 5.2 Accounts and sync (opt-in)

- Sign-in behind `apps/web/src/api/client.ts` and a new `SyncedProfileStore` next to `LocalProfileStore`.
- Health profile sync only with explicit opt-in and encryption on the device before upload. The server must not be able to read it.
- Candidate hosting: a free Postgres or D1 tier; **check current limits and terms** before choosing (free databases may expire or sleep).
- A real "delete my account and data" path.

## 5.3 Community (separate module)

- Posts, vlogs and articles about food, in a separate route group and API module. It must never read the health profile.
- Moderation, reporting and a health-misinformation policy come **before** launch (flag claims such as cures, ban miracle diets).
- Rate limits and abuse controls on every write endpoint.

## 5.4 Product

- On-device OCR fallback for labels (browser-side) when the AI quota is used up.
- Offline mode for the engine and data (already client-side) with an installable PWA.
- A second provider behind `VisionProvider` (verify free-tier terms first).
- Restaurant or street-food mode with handling guidance.
- Share a result as an image or link (without any health profile data).

## 5.5 Quality and operations

- Move the Worker daily budget and cache to durable storage (the MVP counters reset on restart).
- Error reporting that never includes images or profile data.
- A larger evaluation set and a regression run before every release.
- Accessibility audit with real users, including Bangla screen reader checks.
