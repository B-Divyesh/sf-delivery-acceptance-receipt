# Verification 1 — FAIL

**Candidate:** `a225abfc1eb566e88fb1a2ca9a02156742cb3595` (`a225abf docs: add deployment guide and verified handoff`)  
**Live URL:** https://delivery-acceptance-receipt.sociobot.in/  
**Verified:** 2026-08-28 UTC  
**Verdict:** **FAIL**

The live deployment exactly matches the candidate's generated `dist/` files and most of the core local-first/PWA workflow works. It nevertheless fails the acceptance contract because invalid whitespace-only required fields can create an acknowledgement link that the product itself rejects. This prevents the smallest useful product's central delivery-to-client-acknowledgement job from completing and leaves the user with an irrecoverable sealed record (other than deleting and recreating it).

## Blocking defect

### High — whitespace-only required details create a broken receipt

**Reproduction (fresh Chromium/local production preview):**

1. Enter spaces only in `Project or engagement`, `Your name or studio`, and `Client name`.
2. Add a valid service item and select **Seal this delivery**.
3. The app confirms `Delivery sealed. The manifest hash is now fixed.` and exposes an acknowledgement link.
4. Open that link.

**Actual:** The acknowledgement page displays `This handoff link is damaged.`

**Expected:** Whitespace-only required values must be rejected before sealing, with an actionable error and focus on the offending field; a sealed receipt must always generate a usable acknowledgement page.

**Evidence:** browser result was `{"sealed":1,"toast":"Delivery sealed. The manifest hash is now fixed.","urlPresent":true,"damaged":1}`. Native HTML `required` treats whitespace as non-empty; `createReceipt` subsequently trims those values, while `verifyReceipt` rejects the resulting empty fields.

**Impact:** This is a core-flow data-validation failure. A freelancer can believe a delivery record is sealed and send the link, but the client cannot acknowledge it. The sealed record is not editable, so recovery requires deletion and re-entry.

## Verification performed

### Clean local checkout and quality gates

- Checkout was clean at the candidate SHA before installation.
- `npm ci` completed: 60 packages audited, 0 vulnerabilities.
- `npm run build` completed successfully (`tsc --noEmit && vite build`), producing `dist/`.
- `npm test` was run from the clean install. Vitest reported **5/5** passing crypto tests; the configured Playwright suite exercised 8 desktop/mobile checks (normal delivery/acknowledgement/PDF, axe, offline, and 390px width) without a reported failure.
- No separate lint script is defined; TypeScript checking is part of `npm run build`.
- Production output: `assets/main.js` 40.66 kB raw / 14.48 kB gzip; `assets/app.css` 17.06 kB raw / 4.53 kB gzip. Initial JS is under the 200 kB budget.
- `npm audit --omit=dev` reported 0 vulnerabilities.

### Independent functional/browser checks

- Normal end-to-end acceptance was exercised by the repository browser suite: create service manifest → seal → client accepts → return code → sender verifies → PDF download.
- Independent boundary test uploaded a 2 MiB + 8-byte file. The exported receipt’s SHA-256 matched Node’s independent SHA-256 exactly; receipt PDF began `%PDF-1.4`.
- Invalid empty submit focuses `project` and says `Complete the required delivery details before sealing.`; blank service add says `Name the completed service before adding it.`
- Invalid acknowledgement payload displays the dedicated damaged-link recovery page.
- Invalid response code is rejected without losing the sealed receipt: `That response code is invalid or belongs to a different manifest. Ask the client to copy it again.`
- Desktop and 390×844 mobile were checked. Mobile had no horizontal overflow (`scrollWidth = clientWidth = 390`), and `prefers-reduced-motion` sets smooth scrolling to `auto`.
- Keyboard smoke check: first Tab reaches the visible `Skip to main content` link with a 4px focus outline; the normal form controls are native keyboard controls.
- No console errors or page errors occurred during independent local normal/boundary/invalid tests.

### Accessibility and privacy

- Live Chromium axe scans found **zero serious or critical violations** on `/`, `/privacy/`, and `/terms/`.
- Live document has `lang`, one H1, main landmarks, labelled controls, visible focus, and image alt text; legal routes are available.
- Network capture of the unlicensed core flow made no third-party requests. Static inspection found no analytics, CDN fonts, or runtime third-party scripts. The only product-controlled external endpoint is the optional Sociobot license checkout/verification API.

### PWA and live deployment

- Live service worker installed, controlled the page, and populated cache `delivery-receipt-v1.0.2`.
- After first live load, an offline reload succeeded and showed the app heading plus the `Offline deck` status strip.
- Chrome DevTools reported no manifest parse or installability errors. Manifest includes standalone display, start URL, 192/512/maskable icons, and matching theme/background colours.
- Every generated file in local `dist/` was fetched from the live URL and SHA-256-compared; no differences were found. This confirms the live site is the candidate artifact, not a stale or divergent deployment.
- Live headers are HTTPS with HSTS, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin`; HTML, JS, CSS, service worker, legal pages, and offline page returned HTTP 200.

## Non-blocking deployment observations

- All checked live resources, including immutable-looking static assets, use `Cache-Control: public, must-revalidate, max-age=30`; assets are also emitted as stable names (`assets/main.js`, `assets/app.css`) rather than fingerprinted names. The service worker precache makes repeat/offline use work, but this does not meet the stated long-lived immutable HTTP-cache guidance for static assets.
- `/manifest.webmanifest` is served as `application/octet-stream`, not the conventional `application/manifest+json`. Chromium accepted it and reported no installability errors, so this was not treated as a blocker.
- No Content-Security-Policy, Permissions-Policy, COOP, or CORP header was observed. This is defence-in-depth hardening rather than the reason for this failed acceptance.

## Required remediation and re-verification

1. Validate trimmed values for all required text fields before saving or sealing; reject whitespace-only input and preserve the existing form/draft for correction.
2. Add a regression test that proves whitespace-only project, freelancer, and client values cannot seal a receipt, and that every sealed receipt produces a valid acknowledgement page.
3. Re-run the full local suite and the deployed verification after the fix. Consider configuring content types/security headers and a fingerprinted, long-lived cache policy at deployment.
