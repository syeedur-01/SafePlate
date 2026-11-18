# QA checklist

Run this before every demo recording and before tagging a release. The automated part comes first (`pnpm check`); the manual part takes about 15 minutes in a browser.

## 1. Automated (must be green)

- [ ] `pnpm check` — typecheck, lint and every test in the monorepo.
- [ ] `apps/web/test/contrast.test.ts` — every colour-token pair in `apps/web/src/index.css` (light palette and both dark palettes) meets WCAG 2.1 AA: body text and link text on their backgrounds ≥ 4.5:1, each risk colour on the card background ≥ 3.0:1.
- [ ] `apps/web/test/a11y.test.tsx` — every button and link on the Result page has an accessible name, every `<img>` has `alt`, every Onboarding form control is reachable by its label, and the safety level and nutrition status are conveyed in words (not colour alone).
- [ ] `pnpm --filter @sp/tools verify` — data files, rules, messages and sources all verify.

## 2. Responsive (browser dev tools at 320 / 375 / 768 / 1280 px)

- [ ] Onboarding, Scan, Confirm, Result and History: no horizontal scrolling and no clipped text.
- [ ] Bangla text (`বাংলা`) does not overflow buttons, badges or tabs at 320 px.
- [ ] The result tabs, cards and shopping list stack cleanly on a narrow screen.
- [ ] Controls stay comfortably tappable (the forms use `min-h-11`, i.e. 44 px).

## 3. Keyboard

- [ ] Tab through Onboarding → Scan → Result: every control is reachable and shows a visible focus ring.
- [ ] The result tabs move with arrow keys and activate with Enter/Space (roving focus, no tab trap).
- [ ] The "Why is this missing?" accordion opens and closes from the keyboard.

## 4. Screen-reader spot check (VoiceOver or NVDA, English and Bangla)

- [ ] Result page: the risk gauge is announced with its level and score (for example "Moderate risk: 42/100"), and the same level word is visible on screen.
- [ ] The `Estimated` badge and any `Draft` rule badge are read out as text.
- [ ] History thumbnails are decorative (empty `alt`) and the dish title beside them is read instead.
- [ ] Onboarding checkboxes and radios announce their label when focused.

## 5. Theme and motion

- [ ] Light mode passes the automated contrast checks.
- [ ] Dark mode (OS `prefers-color-scheme: dark`) passes the same checks — there is no in-app theme toggle; the `data-theme` hook exists for a future toggle.
- [ ] With "reduce motion" enabled at OS level, the risk gauge renders its final state without animation.

## 6. Functional smoke (no camera and no AI quota)

- [ ] A failed or offline scan shows the error state and offers the sample scans.
- [ ] A sample scan produces a Safety card in which every deducted point opens its evidence.
- [ ] Nutrition numbers stay hidden when coverage is too low, and the `Estimated` badge is present.
- [ ] Privacy: in the browser network tab, only the scan request goes out; no profile or health data appears in any request, URL or log.

## 7. Before the MVP video

- [ ] `/demo` scenarios run end to end (if P4-X01 is merged) without camera, network or AI quota.
- [ ] `docs/KNOWN_LIMITATIONS.md` exists and the disclaimers are visible where the card says they must be.
- [ ] The deployed build is the commit that will be tagged.
