# Verification 2 — FAIL

- **Candidate:** `0a297f2e5500079901c586bc9c73d29afe960d57` (`0a297f2 docs: record repair verification and deployment`)
- **Live URL:** <https://delivery-acceptance-receipt.sociobot.in/>
- **Work order:** `delivery-acceptance-receipt-verify-2`
- **Verified:** 2026-08-28 06:58 UTC
- **Verdict:** **FAIL**

The previous whitespace-only receipt defect is repaired, all repository quality gates pass, and the live deployment is byte-for-byte identical to the candidate build. The release still fails the local-first acceptance contract because the advertised archive importer accepts malformed receipt rows and persists them. Two such rows make the local deck unavailable after every reload, with no in-product recovery.

## Release-blocking defect

### High — malformed archive rows are persisted and can make the local deck unavailable

Reproduced independently in a fresh Chromium profile against both the local production build and the live URL:

1. Open the product and choose **Import JSON**.
2. Select this structurally plausible but invalid archive:

   ```json
   {
     "product": "delivery-acceptance-receipt",
     "exportedAt": "2026-08-28T00:00:00.000Z",
     "receipts": [{ "id": "QA-MALFORMED-1" }, { "id": "QA-MALFORMED-2" }],
     "responses": []
   }
   ```

3. The importer persists both rows and shows the internal error `Cannot read properties of undefined (reading 'localeCompare')`.
4. Reload the page. The only main state is **The local deck could not open.**
5. Select **Try again**. The same unavailable state returns.

Exact result on both targets:

```json
{
  "toast": "Cannot read properties of undefined (reading 'localeCompare')",
  "afterReload": "The local deck could not open.",
  "afterRetry": "The local deck could not open."
}
```

Expected: validate the complete bundle and every receipt/response before any IndexedDB write; reject invalid rows with an actionable message while preserving the current archive. Import should be atomic so a rejected bundle cannot partly change local data.

Actual cause: `importBundle` checks only the product marker and that `receipts`/`responses` are arrays, then saves every object. Rendering assumes required fields exist and sorts with `createdAt.localeCompare`. The invalid rows remain in IndexedDB, so initialization fails on every visit. The UI cannot export or remove them from the fallback screen; clearing all site data is the only browser-level recovery and can discard valid receipts and the saved license.

Impact: JSON export/import is the PWA's required user-ownership and device-transfer path. A malformed, hand-edited, or incompatible archive can make all local records inaccessible through the product. This violates the required invalid-input recovery and local-first persistence contract.

## Other defects and deployment observations

### Medium — auxiliary mobile links miss the 44×44 CSS-pixel target requirement

At 390×844, five visible links on the home screen have 15–20.1 px hit-area heights: Studio **Privacy** and **Terms**, plus footer **Privacy**, **Terms**, and **Product site**. Footer **Terms** is approximately 39×20.1 px. The visually hidden file/import inputs were excluded because their visible labels provide the effective control target. Core form buttons and acknowledgement decision labels meet the intended target size.

### Low — static HTTP caching is short-lived and assets are not fingerprinted

HTML, JavaScript, CSS, manifest, service worker, and checked images all return `Cache-Control: public, must-revalidate, max-age=30`. JavaScript and CSS use stable names (`assets/main.js`, `assets/app.css`) rather than content hashes. The versioned service-worker cache makes offline/update behavior work, but the deployment does not meet the stated long-lived immutable asset-caching guidance.

### Low — response-policy hardening and manifest MIME type

Checked live responses include HSTS, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`. They do not include Content-Security-Policy, Permissions-Policy, COOP, or CORP. `manifest.webmanifest` is served as `application/octet-stream`; Chromium nevertheless parsed it with zero manifest errors and recognized its standalone install metadata.

## Clean checkout and repository gates

- Created a detached clean worktree at the exact candidate SHA before installation.
- Runtime: Node `v22.23.2`, npm `10.9.8`.
- `npm ci`: 59 packages installed, 60 audited, 0 vulnerabilities.
- `npm test`: PASS. Vitest 6/6; Playwright 9 passed with one intentional desktop skip for the mobile-only width check.
- `npm run build`: PASS. It ran `tsc --noEmit` and the exact Vite production build and produced `dist/`.
- No separate lint script exists. Strict TypeScript checking is part of the build.
- `npm audit --omit=dev`: 0 vulnerabilities.
- `git diff --check`: PASS.
- Library/CLI consumer packing is not applicable to this PWA; backend concurrency/health checks are not applicable.

Production budgets:

- JavaScript: 41,938 bytes raw / 14.85 kB gzip (budget: 200 kB raw).
- CSS: 17,063 bytes raw / 4.53 kB gzip (budget: 50 kB raw).
- Mobile AVIF hero: 19,182 bytes (budget: 300 kB).
- No webfonts or CDN scripts are loaded.

## Functional and persistence evidence

Independent local-production checks passed for the following paths before the blocking import case:

- Empty required fields focus the first field and provide a recovery message.
- Whitespace-only identity and service values are rejected; the prior candidate defect is fixed.
- Missing manifest submission is rejected without losing the draft.
- A 2 MiB + 8-byte file produced browser SHA-256 `692e521d8cbea7b5b95f1ae23ebbdf07b3ba97cdcde9783f8bc905b6e2fc0192`, exactly matching Node's independent SHA-256.
- A 120-character service value, item removal, due date, note, sealing, and acknowledgement-link generation worked.
- The receipt PDF was 1,813 bytes and began `%PDF-1.4`; receipt JSON contained the same manifest hash.
- Receipt state survived reload and reopening from IndexedDB.
- Client decline created a 463-character response code; the acknowledgement survived reload; the sender rejected an invalid response code without losing the receipt, then verified the correct decline.
- Full archive export contained one receipt and one response. Delete cancellation, confirmed deletion, wrong-product import rejection, and reimport of a valid product export worked.
- Changing a deliverable name without updating its manifest hash produced the damaged-link recovery screen.

The live site independently completed a keyboard-only service receipt, client acceptance, and sender response verification. The live response code was 403 characters. No console errors, page errors, or failed requests occurred during the normal desktop/mobile flows.

## Accessibility, responsive design, and motion

- Factory `verify-url.sh`: PASS on live (`200`, title, `lang="en"`, one H1, main landmark, no missing image alt text, no unlabeled buttons, no browser errors).
- Live axe scans on `/`, `/privacy/`, and `/terms/`: zero violations, including zero serious/critical findings.
- First Tab focused the visible skip link at 224×48.8 px with a 4 px outline. Keyboard-only navigation reached all receipt fields, the visually hidden file input exposed a 4 px outline on its visible label, and Enter added a service and sealed the receipt.
- `prefers-reduced-motion: reduce` set smooth scrolling to `auto` and reduced transition/animation duration to `0.001ms`.
- Desktop 1366×900 and mobile 390×844 were visually reviewed. Root and acknowledgement screens each reported `scrollWidth === clientWidth === 390`; the mobile create/seal/acknowledgement path worked.
- The design is product-specific and matches `.factory/design.md`; generated art provenance, palette, typography, spacing, and motion policy are documented. The 720 px AVIF hero was visually coherent and had no apparent text/brand artifact.

## PWA, privacy, license, and live identity

- Chromium parsed the manifest with zero errors: standalone display, versioned `start_url`, 192/512/maskable icons, and matching theme/background colors.
- Service worker `delivery-receipt-v1.0.3` controlled the page and cached `/`, JavaScript, and CSS.
- A controlled old-cache simulation displayed **A fresh deck is ready. Reload when convenient.**
- After going offline, reload retained the app, saved receipt, main heading, and **Offline deck** state.
- The unlicensed core workflow contacted only `https://delivery-acceptance-receipt.sociobot.in`; no analytics, remote fonts, tracking, file uploads, or third-party scripts were observed. IndexedDB/export contained file metadata and hashes, not file bytes.
- The expected invalid-license request returned HTTP 200 with `valid: false`; the query token was removed from the URL, stored under the required localStorage key, the free sealing workflow remained enabled, checkout used the Sociobot product URL, and reload did not repeat verification within one day.
- The API response used `Cache-Control: no-store` and allowed the exact product origin through CORS.
- All 17 files in local `dist/` were fetched from the live URL and SHA-256 compared: all matched. Key digests: JavaScript `53b2f78867e32285b9e97a8bb2b1360817e3f82e9030c3c54bbb9f7f54b51236`; CSS `3694a64e1870aff94ab9b3b9739928696562160f4c21392c3956055b5fefb59c`; service worker `bced601166294b461829dae50fa2d5d6d580400934f86b459e471bfe5b0be628`; HTML `8a5be0b372549e3a87dc87cf522c73b715cd9a2f2fe8002432727e79a16c8c00`.

## Lighthouse mobile

Lighthouse 13.0.1 against the live URL using Chromium 145:

- Performance 100
- Accessibility 100
- Best Practices 100
- SEO 100
- FCP 0.9 s, LCP 1.0 s, TBT 10 ms, CLS 0, Speed Index 0.9 s, TTI 1.0 s

## Required remediation

1. Define and enforce runtime schemas for the full export bundle, every receipt, every deliverable, and every response. Reuse receipt/response integrity checks where applicable.
2. Validate the complete archive before writing anything, then import atomically in one IndexedDB transaction.
3. Add regression coverage proving malformed or incompatible archives are rejected, existing records remain usable, and reload/retry still opens the deck.
4. Increase auxiliary mobile link targets to at least 44×44 CSS px without reducing link spacing.
5. Reverify the repaired commit locally and at the deployment URL. Separately improve static cache headers/asset fingerprinting and response-policy hardening.
