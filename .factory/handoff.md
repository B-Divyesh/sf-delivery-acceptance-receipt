# Delivery Receipt v1 — handoff

## What shipped

- A complete local-first creator flow for engagement details, service checklists, and streaming SHA-256 file fingerprints. File bytes are read in 2 MB chunks and are never persisted, linked, or uploaded.
- A sealed, portable receipt with receipt ID, manifest digest, delivery/invoice dates, optional handoff note, and an acknowledgement URL whose payload is URL-safe JSON.
- A locked client “Side B” page that verifies the manifest digest, records accept/decline, client name, optional note, UTC response time, and a response hash.
- A response-code round trip back into the freelancer’s original receipt, with receipt-ID, manifest-hash, and response-integrity checks before local status is changed.
- Real in-browser PDF generation for delivery and response receipts plus individual JSON, response JSON, and full IndexedDB archive export/import.
- IndexedDB persistence, empty/error/offline states, destructive confirmation, keyboard-native controls, 390px layout, visible focus, reduced-motion handling, and update/offline notices.
- Installable PWA manifest, hand-authored 192/512/maskable icons, versioned service-worker shell cache, network-first navigation, same-origin asset cache, offline fallback, and update-ready messaging.
- A genuinely useful free tier. The one-time ₹499 Studio license uses the required Sociobot checkout/verification contract, restores from a pasted token, caches verification for one day, and unlocks brand-free PDFs plus a custom PDF footer. Accessibility, evidence creation, and data export remain free.
- Static `/privacy/` and `/terms/` pages, robots/sitemap, expanded README, MIT license, and the product-specific design/provenance record.
- An original cassette-era editorial hero generated with the factory image model. Shipped AVIFs are 19 KB (720px) and 55 KB (1200px), WebP fallbacks are 40 KB and 111 KB, and the JPEG fallback is 155 KB; the 2.7 MB PNG source and prompt sidecar remain under `assets/src/`.

## How to run and verify

```sh
npm ci
npm test
npm run build
npm run preview
```

`npm run build` writes the static deployment to `./dist`, with `dist/index.html` at its root and independent `privacy/index.html` and `terms/index.html` entries.

Verification completed on 2026-08-28:

- `npm test`: 5/5 unit tests and 7/7 applicable Playwright checks passed across desktop Chrome and Pixel 5 emulation; one desktop duplicate of the mobile-only width assertion is intentionally skipped.
- End-to-end tested: create → service manifest → seal → client acceptance → return code → sender verification → PDF download.
- Offline tested with Playwright `context.setOffline(true)`: cached app shell, local receipt tools, and status UI reload successfully on desktop and mobile.
- Axe: zero serious or critical findings on the core app, privacy page, and terms page in desktop and mobile projects.
- Factory `verify-url.sh`: HTTP 200; title and `lang` present; exactly one `<h1>`; `<main>` present; no missing image alt text; no console/page errors. The final hidden license button also has an explicit accessible name.
- Lighthouse 12.8.2 mobile: Performance 100, Accessibility 100, Best Practices 100, SEO 100. FCP 1.1 s, LCP 1.3 s, CLS 0, TBT 0 ms, Speed Index 1.1 s.
- Production bundle: 40.5 KB JS raw / 14.5 KB gzip; 17.1 KB CSS raw / 4.6 KB gzip; no runtime packages, fonts, CDNs, analytics, or trackers. All stated static budgets pass.
- `npm audit`: 0 vulnerabilities after patch-level Vite/Vitest updates.

## Known gaps and deliberate boundaries

- The static/local-first model cannot automatically send a client’s response back to the freelancer. The client must return the generated response code through the existing email/message thread. This is explicit in the UI and avoids a central evidence or identity database.
- Names are stated, not identity-verified; timestamps come from the responding device. Hashes expose later changes to the manifest/response but are not a qualified digital signature or trusted timestamp.
- Acknowledgement URL length grows with the number and length of manifest items. Normal freelance manifests are practical; very large batches should be grouped or described as service items.
- Live checkout and license verification were integrated against the production contract but not purchase-tested because factory product registration and a real/test license happen after build. Core use never waits on that request.
- No Android/Capacitor wrapper was added because the job requires no native-only capability; the installable offline PWA covers the requested artifact.

## Suggested next steps

1. Factory: register the paid product and validate one complete hosted checkout/return/revoke cycle.
2. Pilot with freelancers and measure the brief’s target: receipts sent before the final invoice due date in at least 75% of completed engagements.
3. If pilots regularly create unusually large manifests, add an optional compact downloadable acknowledgement file while preserving the no-server model.
