# Record delivery and client acceptance — verification 3

## Verdict: FAIL

- Findings: **3** (0 critical, 0 high, 3 medium, 0 low)
- Untested claims: **2**
- Implementation reviewed: `cbd2bc673d7549f8a019d6f66cd15e5ff3827fde`
- Documentation baseline: `7e09a53291d85698736dfca54f541f7cf6bae77c`
- Earlier documentation commits: `f59e339664d84b97a650ec201187747d0e94844d`, `7e09a53291d85698736dfca54f541f7cf6bae77c`
- Live URL: <https://delivery-acceptance-receipt.sociobot.in/>
- Verified: 2026-09-05 UTC

The product does not pass the factory contract. The main job works live, the sample is isolated, the deployment matches the implementation, and all declared commands exit successfully. One set of phone links is below the required 44 px height. Two declared claim tests do not exercise the full outcomes they claim to prove, so those claims remain untested under the claims contract.

## Job, audience, and first action before scrolling

The job is **record delivered work and client acceptance**. The audience is freelancers who need a handoff record before an invoice or payment dispute. The first action is **Try it with sample data**.

Fresh Chromium contexts were used at 1366×900 and 393×727. On the phone, the third fact ended at 717.0 px in a 727 px viewport. The job, audience, sample action, and all three facts were visible without scrolling. There was no horizontal overflow.

Evidence: `/work/.evidence/verify-3/desktop-first-screen.png`, `/work/.evidence/verify-3/phone-first-screen.png`, and `/work/.evidence/verify-3/live-audit.json`.

## Findings

### V3-1 — Medium — Four phone links are only 18 px high

At 393 px wide, these visible links do not meet the attached 44×44 CSS-pixel target rule:

- Home and demo: **Read the privacy policy**, 220.8×18 px.
- Privacy: **privacy@sociobot.in**, 182.4×18 px.
- Terms: **support@sociobot.in**, 182.4×18 px.

Header, demo-banner, button, and footer targets meet the requirement. The five links reported in the previous review were repaired or removed. These four remaining content links were not covered by the repository test, which checks only `footer a`.

Expected: each visible link must provide a target at least 44 px wide and 44 px high at phone width.

Evidence: the `phone touch targets` result in `/work/.evidence/verify-3/live-audit.json` and the independent all-route target measurement.

### V3-2 — Medium — The offline claim test can pass without creating an offline receipt

Claim `offline-reload` says receipt creation works offline after the first visit. Its command passes, but the test opens the pre-populated demo, goes offline, calls the receipt helper, and then checks only that **Send this receipt with the delivery** is visible. That heading belongs to the sample receipt and is already visible before the attempted creation. The test never checks the new project, record count, acknowledgement link, exported record, or stored receipt.

The offline status also says **Receipts, responses, and PDF exports still work.** The declared claim is narrower, and its test does not exercise an offline response or PDF export.

Independent live testing found the current behavior works: an offline receipt produced a new acknowledgement link, an offline client response produced a 407-character code, the sender verified it, and an offline PDF started `%PDF-1.4`. That manual result does not replace the required repeatable claim test.

Expected: assert a newly created offline receipt and either add outcome checks for the broader offline status or narrow that status to the tested scope.

### V3-3 — Medium — The same-origin demo-flow claim test checks only page load

Claim `local-only` says the demo flow sends requests only to this site. The test attaches a request listener, loads `/demo`, checks that no account field exists, and ends. It does not perform the demo flow: fingerprinting, acknowledgement, response recording, verification, import/export, or PDF export.

Independent live capture saw only `https://delivery-acceptance-receipt.sociobot.in` during the tested creation, demo, and route flow. The implementation appears to meet the claim today, but the declared test is incomplete and could miss a later request added to an interaction.

Expected: exercise the full claimed demo flow while recording requests, then assert the allowed origins.

## Declared claims

Every manifest command was run from the clean detached checkout. All commands exited successfully. Command success is separate from test sufficiency.

| Claim | Command result | Coverage review |
| --- | --- | --- |
| `demo-sandbox` | Pass, desktop and phone | Pass |
| `local-file-hash` | Pass, desktop and phone | Pass |
| `acknowledgement-page` | Pass, desktop and phone | Pass |
| `response-bound` | Pass, desktop and phone | Pass |
| `pdf-export` | Pass, desktop and phone | Pass |
| `archive-transfer` | Pass, desktop and phone | Pass |
| `browser-persistence` | Pass, desktop and phone | Pass |
| `offline-reload` | Pass, desktop and phone | **Incomplete; V3-2** |
| `local-only` | Pass, desktop and phone | **Incomplete; V3-3** |

Each claim ID appears exactly once in `tests/e2e/app.spec.ts`. Untested claim count: **2**.

## Sample and real-data isolation

- The one-click action opened `/demo` with the persistent **Demo — sample data, nothing is saved to real records** label.
- The populated sample showed **Northstar Coffee launch** and **Accepted by Inez Rahman**.
- **Reset demo** restored the sample and kept the label.
- A real receipt named **Verify 3 real receipt** was created before entering the demo. After reset and **Start for real**, that real receipt remained and the Northstar sample was absent from real records.
- Demo acknowledgement links used `/ack/demo/`; real acknowledgement links used `/ack/`.

Evidence: `/work/.evidence/verify-3/desktop-demo.png` and `/work/.evidence/verify-3/live-audit.json`.

## Normal, invalid, boundary, and recovery paths

- A 2 MiB + 8 byte file produced SHA-256 `d16dae163d836cfe30a32e229000412c460644475eeb7030da16283a5fa0474a`, matching Node’s independent hash.
- A fresh client page showed the fixed delivery list, recorded a decline, and returned a 463-character response code.
- An invalid response code showed the recovery message without removing the receipt. The valid code then produced **Declined by Inez Client** and remained after reload.
- The downloaded PDF was 1,944 bytes, started `%PDF-1.4`, and contained `MANIFEST SHA-256`.
- Whitespace-only identity input was rejected with an actionable message and focus on the field. Blank service and missing-manifest paths were also checked.
- A malformed archive row was rejected. Reload retained the valid receipt and did not show the storage-error screen.
- `/ack/not-a-record` showed the titled damaged-link recovery page.

Evidence: `/work/.evidence/verify-3/live-boundary-receipt.json`, `/work/.evidence/verify-3/live-receipt.pdf`, and `/work/.evidence/verify-3/live-audit.json`.

## Accessibility, keyboard, phone, and motion

- The factory `verify-url.sh` check passed: HTTPS 200, title, `lang="en"`, one H1, one main landmark, alt text, labelled buttons, and no home-load console errors.
- Axe checks on `/`, `/demo`, `/privacy/`, and `/terms/` found zero serious or critical violations.
- The skip link is 224.0×48.8 px and shows a 4 px focus outline. The primary sample link works with Enter, and **Reset demo** works with Space.
- Browser back and forward restored the correct route, title, and H1 focus.
- Native form, radio, checkbox, and file controls were operable in the exercised flows. Route changes moved focus to the H1 and used the polite route announcer.
- At 393 px, content had no horizontal overflow. At 640 px, the 200% zoom-equivalent reflow check also had no horizontal overflow.
- Reduced motion changed smooth scrolling to `auto` and transitions/animations to effectively instant.
- The remaining target-size defect is V3-1.

## Offline, update, privacy, and routes

- A dedicated controlled context loaded `/demo`, went offline, reloaded the sample, created and sealed a receipt, completed an acknowledgement and sender verification, and exported a PDF.
- A simulated old cache was removed, cache `delivery-receipt-v1.1.0` replaced it, and **An update is ready. Reload when convenient.** appeared.
- Live request capture used only the product origin. No analytics, remote fonts, tracking, file upload, or third-party script request was observed.
- `/`, `/demo`, `/privacy/`, and `/terms/` have route-specific titles, one H1, a main landmark, descriptions, canonical links, and working internal links.
- `/not-a-real-route` deliberately returned HTTP 404 with **Page not found — Delivery Receipt**, **This page is not available**, and a working home link. The expected 404 network result is not a defect.
- The manifest uses `application/manifest+json`. Hashed JavaScript uses `public, max-age=31536000, immutable`; `sw.js` uses `no-cache`.
- The home response includes CSP, Permissions Policy, COOP, CORP, referrer policy, and nosniff headers.

## Clean-checkout gates

A detached worktree at `cbd2bc673d7549f8a019d6f66cd15e5ff3827fde` was used with Node `v22.23.2`, npm `10.9.8`, and the pinned Playwright Chromium 1.58.2 browser.

| Command | Result |
| --- | --- |
| `npm ci` | Pass; 61 packages installed, 0 vulnerabilities |
| `npm test` | Pass; Vitest 7/7, Playwright 27 passed and one documented phone-only skip |
| `npm run build` | Pass; `dist/index.html` produced |
| `npm run test:claims` | All nine commands exited successfully |
| `npm audit --omit=dev` | Pass; 0 vulnerabilities |
| `git diff --check` | Pass |

Production output: main JavaScript 44.10 kB raw / 14.73 kB gzip; CSS 17.40 kB raw / 4.55 kB gzip. No webfonts ship.

## Live artifact and performance

All 25 deployable files in the clean `dist/` matched the live files byte-for-byte. `staticwebapp.config.json` was excluded because it configures the host and is not a public artifact. The live runtime is the implementation candidate, not a later report-only commit.

Lighthouse 13.0.1 mobile:

- Performance 100
- Accessibility 100
- Best Practices 100
- SEO 100
- FCP 1.2 s, LCP 1.2 s, TBT 70 ms, CLS 0
- Total transferred size 64 KiB

Evidence: `/work/.evidence/verify-3/lighthouse.json`.

## Earlier finding disposition

| Earlier finding | Current disposition |
| --- | --- |
| Whitespace-only required fields could seal a damaged receipt | Fixed; independently rejected with focus and recovery text. |
| Malformed archives could make storage unavailable | Fixed; invalid rows are rejected and the existing receipt remains after reload. |
| R1 sample sandbox missing | Fixed; one-click isolated sample, label, reset, and start-real path work. |
| R2 atomic import validation missing | Fixed. |
| R3 claim manifest and tests missing | Partly fixed; nine entries and commands exist, but V3-2 and V3-3 are incomplete. |
| R4 broken Studio checkout | Fixed by removing the offer and checkout UI. A future paid tier still depends on a working Sociobot billing registration. |
| R5 first-screen audience, sample action, and plain words | Fixed on desktop and phone. |
| R6 five undersized Studio/footer links | Those exact targets are fixed or removed; V3-1 records four other undersized content links. |
| R7 acknowledgement route, title, and focus | Fixed. |
| R8 designed HTTP 404 | Fixed; the deliberate 404 is expected and works. |
| R9 metadata and shared site structure | Fixed. |
| R10 immutable caching and manifest MIME | Fixed. |
| R11 response security headers | Fixed. |

## Applicability

This is a static local-first PWA. Backend tenant isolation, SQLite restart persistence, health endpoints, 429/Retry-After, CLI installation, library consumers, and desktop installers do not apply. An AI feature would add privacy and reliability cost to a deterministic hashing and acknowledgement task, so there is no missed-AI finding. No paid offer is advertised.

## Required next work

1. Give the four content links 44×44 px phone targets and test links across every public route, not only the footer.
2. Make `offline-reload` assert the new offline receipt itself. Add offline response and PDF checks or narrow the offline status text.
3. Make `local-only` perform the claimed demo flow while capturing every request.
4. Re-run every claim command and the live phone check after repair.

Final result: **FAIL — 3 findings and 2 untested claims.**
