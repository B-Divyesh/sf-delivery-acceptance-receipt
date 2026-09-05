# Delivery receipt review — record a delivery and client acceptance

## Verdict: FAIL

- Findings: **11** (4 High, 5 Medium, 2 Low)
- Untested public claims: **14**
- Implementation reviewed: `e30ea12d64b5019dd73cca1522bb4d7517452b9b`
- Documentation SHA: `2b956b7162eb2db8f941014f72672d84b3b41eb3`
- Live URL: <https://delivery-acceptance-receipt.sociobot.in/>
- Reviewed: 2026-09-05 UTC

The product does not pass. The main receipt flow works, but there is no sample sandbox, malformed archive import can make all local records unavailable, every public claim lacks the required claim test, and the advertised paid checkout returns 404.

## Job, audience, and first action before scrolling

The job is to record delivered files or services, give a client a page to accept or decline the listed delivery, and export the result. The audience is freelancers who want a record before a payment dispute. The first visible action is **Make a receipt**.

On desktop and a fresh 390×844 phone, the first screen showed the job and action. It did not name freelancers or another audience. On the phone, the three fact lines started below the viewport. The required **Try it with sample data** action was absent.

Evidence: `/work/.evidence/live/desktop-first-screen.png` and `/work/.evidence/live/phone-first-screen.png`.

## Findings

### R1 — High — The required one-click sample sandbox does not exist

`/demo` returns HTTP 200 but renders the same empty real app as `/`. There is no **Try it with sample data** action, realistic populated sample, persistent **Demo — sample data, nothing is saved** label, **Reset demo**, or **Start for real**. The route is not isolated: `initialize()` treats `/demo` as the home route and opens the same `delivery-receipt` IndexedDB database. `.factory/demo.md` is also missing.

This prevents the requested sample, reset, and no-real-data checks. It also means verifiers cannot test claims from the required clean sample entry point.

### R2 — High — Malformed archive import still makes the local app unavailable

The earlier high-severity finding is open on the current live build.

Using a fresh browser with one valid receipt, import:

```json
{
  "product": "delivery-acceptance-receipt",
  "exportedAt": "2026-09-05T00:00:00.000Z",
  "receipts": [{ "id": "QA-MALFORMED-1" }, { "id": "QA-MALFORMED-2" }],
  "responses": []
}
```

The app persisted both invalid rows and displayed `Cannot read properties of undefined (reading 'localeCompare')`. Reload and **Try again** both showed **The local deck could not open.** The valid receipt was no longer reachable through the app. Clearing all site data is the only recovery and can also remove valid records and a saved license.

The importer still checks only the product marker and top-level arrays, writes records separately, and validates neither rows nor the full bundle before writing.

### R3 — High — Fourteen public claims have no claim manifest or claim tests

`.factory/claims.json` is missing. There are no `@claim:<id>` tests and no declared claim commands. The ordinary test suite passes, but it cannot replace the required claim inventory, one tagged test per claim, clean demo entry point, and observable claim assertion.

Fourteen unique public claim groups appear on the live pages or in `README.md`:

1. Selected file bytes are fingerprinted with SHA-256.
2. File contents are not uploaded, retained, or put in acknowledgement links.
3. The app creates a locked client acknowledgement page from files or services.
4. Acceptance or decline is bound to the receipt and manifest hashes, name, and UTC time.
5. The app exports an actual receipt PDF.
6. The app exports portable receipt and response JSON.
7. Full JSON archives can be exported, imported, and moved to another device.
8. Receipts and responses stay in IndexedDB until export, deletion, or site-data clearing.
9. Hashing, new receipts, responses, PDFs, and saved records work offline after the first load.
10. The core app has no analytics, ads, account system, sync, remote scripts, or remote fonts.
11. No account is required.
12. The free tier includes unlimited receipts.
13. A one-time ₹499 Studio purchase adds brand-free PDFs and a custom footer, with refund revocation.
14. License verification uses only Sociobot, happens at most daily, and checkout embeds no payment provider.

Several were independently observed during this review, but all 14 remain untested under the claims contract because no executable claim command exists. The paid-checkout part of claim 14 is also false in the live runtime; see R4.

### R4 — High — The advertised Studio checkout is broken

The live **Buy Studio once** link points to the documented Sociobot endpoint, but a GET returns HTTP 404 and:

```json
{"error":"enabled factory product","status":404}
```

There is no redirect to hosted checkout. The page advertises a one-time ₹499 purchase that cannot be completed. Invalid-license verification itself returned a valid `valid: false` response, removed the token from the page URL, kept the free tools enabled, and did not repeat verification on reload.

### R5 — Medium — First-screen and section copy does not meet the plain-words contract

The first screen does not name freelancers or another audience. At 390×844, the three required fact lines are below the initial viewport. The primary action is the real empty form rather than the mandatory sample action.

The page also uses metaphor and mood copy despite the explicit plain-words rule, including **THE HANDOFF TAPE**, **SIDE A**, **No tracks yet**, **Your deck is empty**, **Make the paper yours**, **Proof without a hostage situation**, and **Privacy, without the fog**. The legal header is labelled **CLIENT SIDE / B**. `.factory/copy-audit.md` is missing, so the required sentence and banned-word audit was not delivered.

The visual treatment itself is distinctive and matches `.factory/design.md`; this finding is about the words and first-screen information order.

### R6 — Medium — Five phone links remain below the 44×44 px target minimum

At 390×844, the Studio **Privacy** and **Terms** links measured 54.6×15 and 39×15 px. Footer **Privacy**, **Terms**, and **Product site** measured 54.6×20.1, 39×20.1, and 93.6×20.1 px. This exactly confirms the earlier medium finding is still open.

Core buttons and form controls met the target size. Keyboard traversal reached the interactive controls without a trap, and the first Tab focused the 224×48.8 px skip link with a 4 px visible outline.

### R7 — Medium — Client acknowledgement is not a real titled route and does not manage focus

The client page is encoded in `/#ack=...`, although hash-only routing is reserved for in-page anchors. Its title remains **Delivery Receipt — document a fair handoff** instead of a client acknowledgement title. Changing from the home state to the acknowledgement hash leaves focus on `<body>` rather than moving it to and announcing the new H1. `/demo` also retains the home title instead of **Demo — Delivery Receipt**.

The acknowledgement function works, but address-bar navigation, route titles, and screen-reader focus do not meet the site-structure contract.

### R8 — Medium — There is no designed 404 response

`/404` and `/this-route-does-not-exist` both return HTTP 200 and render the home page. This is not the expected deliberate HTTP 404 with a designed recovery page; it is a missing route and wrong status. No `404.html` or response override exists.

### R9 — Medium — Required metadata and standard site structure are incomplete

The home and legal documents have no canonical link, Open Graph metadata, Twitter card metadata, or Apple touch icon link. There is no 1200×630 social image. Legal documents omit meta descriptions. The sitemap lists only `/`, `/privacy/`, and `/terms/`, so it omits the required demo route.

The header has no Demo or Privacy link. The footer has no **Built by Param Factory** text or version/build ID. Acknowledgement and legal pages replace normal navigation with the unrelated **CLIENT SIDE / B** label.

### R10 — Low — Static cache and manifest delivery remain below the stated PWA policy

All checked live resources use `Cache-Control: public, must-revalidate, max-age=30`. JavaScript and CSS have stable names (`assets/main.js`, `assets/app.css`) rather than content hashes and immutable caching. `manifest.webmanifest` is served as `application/octet-stream` rather than `application/manifest+json`.

Chromium still parsed the manifest, the versioned service-worker cache worked, and the controlled update test showed **A fresh deck is ready. Reload when convenient.** This is the same unresolved low-severity deployment issue recorded earlier.

### R11 — Low — Required response security policy configuration is absent

Live responses include HSTS, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`. They do not include Content-Security-Policy, Permissions-Policy, COOP, or CORP. The repository has no `staticwebapp.config.json` to define the required navigation/404 behavior and security headers.

No CSP console violation occurred because no CSP is sent. This is unresolved defence-in-depth and site-structure work, separate from the functional 404 finding.

## Earlier finding disposition

| Earlier item | Current disposition | Evidence |
| --- | --- | --- |
| Whitespace-only identities could seal a damaged receipt | Fixed | The clean test suite exercises each identity and client response name. All pass. The live build matches that implementation byte-for-byte. Live empty and blank service errors focused the correct control and gave a recovery message. |
| Malformed archive import corrupts the local deck | Open | Reproduced live exactly; see R2. |
| Five phone links are below 44 px | Open | Re-measured live; see R6. |
| Short HTTP caching and stable asset names | Open | `max-age=30` and stable names remain; see R10. |
| Manifest has a generic MIME type | Open | Live content type remains `application/octet-stream`; see R10. |
| Security policy headers are absent | Open | Current header capture confirms it; see R11. |

## Functional evidence

### Normal job path

- A 2 MiB + 8-byte file was selected in a fresh desktop browser. The app hash `d16dae163d836cfe30a32e229000412c460644475eeb7030da16283a5fa0474a` matched an independent Node SHA-256.
- A completed service, names, delivery date, due date, and realistic handoff note produced a populated sealed receipt.
- A separate clean client browser opened the acknowledgement link, accepted the exact manifest, and produced a 486-character response code.
- The sender first received the expected error for an invalid response code, then verified the correct code. **Accepted by Inez Rahman** remained after reload.
- Receipt JSON contained both deliverables. Downloaded receipt and offline receipt files began `%PDF-1.4`.

### Invalid, boundary, and recovery paths

- Empty receipt submission focused `project` and explained what to enter.
- A blank service was rejected with an actionable message.
- Whitespace-only required identity regression tests passed in both browser projects.
- The hash crossed the implementation's 2 MiB chunk boundary and matched independently.
- Invalid response code recovery preserved the receipt.
- Malformed import recovery failed and persisted the bad data; this is R2.
- A damaged acknowledgement payload renders the dedicated damaged-link state in the repository suite.

### Offline, update, persistence, and privacy

- In a dedicated fresh context, the service worker controlled the page before offline mode was enabled.
- While offline, the review created and sealed a new receipt, opened its acknowledgement, recorded a decline, returned to the sender, verified the response, and downloaded a PDF.
- The offline strip was visible. IndexedDB state survived reload.
- A controlled old-cache update left only `delivery-receipt-v1.0.3` and displayed the update notice.
- The unlicensed normal job path contacted only the product origin. No file upload, analytics, remote font, or third-party script request occurred.
- The privacy page explains local data, shared-link contents, license verification, deletion, and contact through `privacy@sociobot.in`. The terms page is present and explains evidence limits.

### Accessibility and responsive checks

- Factory `verify-url.sh`: PASS for status, title, `lang`, one H1, main, alt text, button names, and console load.
- Playwright axe on live `/`, `/privacy/`, and `/terms/`: zero violations.
- Fresh 390×844 phone: no horizontal overflow; the main action was visible before scrolling.
- A 640 CSS-pixel reflow check, equivalent to 200% zoom on a 1280 CSS-pixel desktop viewport, had no horizontal overflow and retained all controls.
- Reduced motion set smooth scrolling to `auto`, control transitions to effectively instant, and decorative transforms to none.
- The five undersized links are recorded in R6. Hash-route focus is recorded in R7.

### Performance and build size

- Lighthouse 13.0.1 mobile: Performance 100, Accessibility 100, Best Practices 100, SEO 100.
- FCP 0.91 s, LCP 1.14 s, TBT 91 ms, CLS 0, Speed Index 0.91 s.
- Production JavaScript: 41,938 bytes raw / 14,722 bytes gzip.
- Production CSS: 17,063 bytes raw / 4,542 bytes gzip.
- Mobile AVIF hero: 19,182 bytes. No webfonts ship.

## Clean-checkout and candidate evidence

A detached worktree was created at implementation commit `e30ea12d64b5019dd73cca1522bb4d7517452b9b`. Later commits `0a297f2` and `2b956b7` only change reports, so the documentation SHA differs from the implementation SHA.

Commands run from the clean worktree:

```text
npm ci          PASS — 59 packages installed, 0 vulnerabilities
npm test        PASS — Vitest 6/6; Playwright 9 passed, 1 intentional mobile-only skip
npm run build   PASS — TypeScript and Vite; dist/index.html produced
npm audit --omit=dev  PASS — 0 vulnerabilities
```

There were no declared claim commands because `.factory/claims.json` is missing. This is not treated as a pass; it is R3 and produces 14 untested public claims.

Every one of the 17 files in the clean `dist/` was fetched from the live URL and SHA-256 compared. All matched. Key hashes:

- `assets/main.js`: `53b2f78867e32285b9e97a8bb2b1360817e3f82e9030c3c54bbb9f7f54b51236`
- `assets/app.css`: `3694a64e1870aff94ab9b3b9739928696562160f4c21392c3956055b5fefb59c`
- `sw.js`: `bced601166294b461829dae50fa2d5d6d580400934f86b459e471bfe5b0be628`
- `index.html`: `8a5be0b372549e3a87dc87cf522c73b715cd9a2f2fe8002432727e79a16c8c00`

The live runtime is therefore the reviewed implementation, not a later report-only build or a stale image.

## Applicability and missed leverage

This is a static PWA, so backend tenant isolation, SQLite restart persistence, health endpoints, and 429/Retry-After checks do not apply. CLI, library, desktop installer, and clean consumer-environment checks do not apply.

An AI feature would not improve the deterministic hashing, acknowledgement, or evidence job enough to justify sending more delivery data to a model. No missed-AI-leverage finding was raised. Export/import is expected and present, but its invalid-input safety is broken in R2.

## Evidence files

- `/work/.evidence/live/live-audit.json`
- `/work/.evidence/live/more-audit.json`
- `/work/.evidence/live/lighthouse.json`
- `/work/.evidence/live/desktop-first-screen.png`
- `/work/.evidence/live/phone-first-screen.png`
- `/work/.evidence/live/normal-receipt.json`
- `/work/.evidence/live/normal-receipt.pdf`
- `/work/.evidence/live/offline-receipt.pdf`

## Required next work

1. Add the isolated one-click sample, persistent sample label, reset/start-real actions, `/demo` title, and `.factory/demo.md`.
2. Validate the complete import bundle before one atomic transaction, reject bad rows without mutation, and add recovery regression tests.
3. Add `.factory/claims.json` and one demo-backed tagged test per public claim; remove or narrow claims that cannot be proved.
4. Enable the product in the Sociobot billing engine or remove the paid offer until checkout works.
5. Repair the plain words, phone targets, real routes/titles/focus, designed 404, metadata, footer, caching, MIME type, and security policy configuration.

Acceptance requires zero findings and zero untested claims. Current result: **FAIL — 11 findings and 14 untested claims.**
