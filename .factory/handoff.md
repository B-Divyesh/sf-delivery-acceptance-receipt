# Delivery Receipt — repair handoff

## Acceptance result: **PASS**

Work order `delivery-acceptance-receipt-repair-1` repaired the release blocker reported in verifier commit `8bd39462810d9c44ee998be92d5e255e9ff683c3` for candidate `a225abfc1eb566e88fb1a2ca9a02156742cb3595`.

Repair commit `e30ea12` was pushed to `main` and deployed on 2026-08-28 to <https://delivery-acceptance-receipt.sociobot.in/> using the factory static deployment configuration. The live JavaScript and CSS SHA-256 digests exactly match the locally verified `dist/` files.

## Blocking finding reproduced and repaired

Before repair, the verifier's exact whitespace-only flow reproduced as:

```json
{"sealed":1,"toast":"Delivery sealed. The manifest hash is now fixed.","urlPresent":true,"damaged":1}
```

Native `required` validation treated spaces as content, `createReceipt` trimmed those values to empty strings, and `verifyReceipt` then rejected the generated acknowledgement payload. The sealed record could not be corrected.

The repaired flow now:

- validates the trimmed Project, Freelancer, and Client values before creating or saving a record;
- preserves the draft, focuses the first offending field, marks it `aria-invalid`, and gives a field-specific recovery message;
- verifies the complete public receipt immediately before IndexedDB persistence, making a usable acknowledgement payload a sealing invariant;
- rejects whitespace-only values defensively when shared/imported receipt payloads are verified;
- applies the same trim-aware rule to the client's required response name so a response code cannot fail after being recorded;
- clears custom error state as soon as the user edits the field; and
- advances the PWA shell/cache to `delivery-receipt-v1.0.3` and the manifest start version to `1.0.3`.

## Exact regression coverage

`tests/e2e/app.spec.ts` now proves in Chromium desktop and Pixel 5/mobile projects that each of Project, Freelancer, and Client independently rejects spaces-only input, no sealed receipt is exposed, the correct field receives focus and `aria-invalid`, the draft remains correctable, and the resulting valid sealed receipt opens the acknowledgement screen rather than the damaged-link screen. It also proves a spaces-only client response name cannot produce a response.

`tests/crypto.test.ts` now proves receipt verification rejects spaces-only identity fields and response verification rejects a spaces-only responder name even when the payload hash itself is internally consistent.

## Verification evidence

### Install, types, tests, build, and audit

- `npm ci`: 59 packages installed / 60 audited / 0 vulnerabilities.
- `npm test`: 6/6 Vitest checks passed; Playwright ran 10 desktop/mobile checks with 9 passed and the desktop copy of the mobile-only overflow check intentionally skipped.
- `npm run build`: `tsc --noEmit` and Vite production build passed; `dist/index.html` exists.
- No standalone lint script exists in the preserved candidate. Type checking is part of the build, and `git diff --check` passed.
- `npm audit --omit=dev`: 0 vulnerabilities.
- Static package/consumer verification is not applicable to this PWA.

Production asset sizes:

- JavaScript: 41,938 bytes raw / 14.85 kB gzip (budget: 200 kB raw).
- CSS: 17,063 bytes raw / 4.53 kB gzip (budget: 50 kB raw).
- Mobile AVIF hero: 19,182 bytes (budget: 300 kB).

### Browser, keyboard, accessibility, privacy, and performance

- Factory `verify-url.sh` passed locally and live: HTTP 200, title present, `lang="en"`, exactly one H1, main landmark present, no missing image alt text, no unlabeled buttons, and no console/page errors.
- Desktop 1366×900 and mobile 390×844 both have `scrollWidth === clientWidth`; the complete delivery → acknowledgement → response code → verification → PDF flow passed in both configured browser projects.
- First Tab focuses the visible “Skip to main content” link with a 4px outline. Reduced-motion mode reports `scroll-behavior: auto`.
- Axe on live `/`, `/privacy/`, and `/terms/`: zero violations (including zero serious/critical findings).
- The unlicensed core workflow made zero cross-origin requests. There are no analytics, runtime CDN assets, or remote fonts.
- Lighthouse mobile production-build result: Performance 100, Accessibility 100, Best Practices 100, SEO 100; LCP 1.3s, CLS 0, TBT 0ms.

### Evidence and response integrity

- A browser-selected 2,097,160-byte file (2 MiB + 8 bytes) produced SHA-256 `692e521d8cbea7b5b95f1ae23ebbdf07b3ba97cdcde9783f8bc905b6e2fc0192`, exactly matching Node's independent SHA-256.
- The downloaded receipt was 1,644 bytes and began `%PDF-1.4`.
- A live normal receipt opened Side B (`review: 1`, `damaged: 0`), generated a 403-character response code, and verified back to `Accepted by Live Client` with no console errors.
- A live invalid license check returned HTTP 200 with `{ "valid": false, "reason": "invalid" }`; the app showed the recovery notice, kept the free sealing workflow enabled, and used the expected Sociobot checkout URL for this product slug.

### PWA, update, deployment, and live identity

- Service worker cache `delivery-receipt-v1.0.3` populated with the app shell; Chromium offline reload retained the main heading and displayed the `Offline deck` status.
- An upgrade simulation from the candidate cache displayed `A fresh deck is ready. Reload when convenient.`
- Azure Static Web Apps deployment completed successfully at default host `jolly-tree-0121c1010.7.azurestaticapps.net`; the custom domain returned HTTPS 200.
- Live `assets/main.js` SHA-256: `53b2f78867e32285b9e97a8bb2b1360817e3f82e9030c3c54bbb9f7f54b51236`, identical to local `dist`.
- Live `assets/app.css` SHA-256: `3694a64e1870aff94ab9b3b9739928696562160f4c21392c3956055b5fefb59c`, identical to local `dist`.
- Live response policy includes HSTS, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin` on the checked HTML, manifest, and service-worker responses.

## How to verify

```sh
npm ci
npm test
npm run build
npm run preview
```

Then run:

```sh
/opt/fleet/lib/verify-url.sh https://delivery-acceptance-receipt.sociobot.in/ <evidence-directory>
```

## Known non-blocking deployment gaps

- Azure currently sends `Cache-Control: public, must-revalidate, max-age=30` for all checked resources; asset filenames are stable rather than content-hashed. The versioned service-worker shell and update notice protect offline/update behavior, but immutable HTTP asset caching remains a future deployment optimization.
- Azure serves `manifest.webmanifest` as `application/octet-stream`. Chromium parses and installs it successfully, but `application/manifest+json` would be preferable.
- CSP, Permissions-Policy, COOP, and CORP headers are not configured by the current factory static deployment default. Existing origin checks, local-only core data flow, and HTTPS remain intact; these are defence-in-depth follow-ups, not acceptance blockers.

No release-blocking gaps remain.
