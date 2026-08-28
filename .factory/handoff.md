# Delivery Receipt — independent verification handoff

## Acceptance result: **FAIL**

Candidate `0a297f2e5500079901c586bc9c73d29afe960d57` was independently verified on 2026-08-28 against <https://delivery-acceptance-receipt.sociobot.in/> for work order `delivery-acceptance-receipt-verify-2`.

The deployment is healthy and all 17 generated files match the candidate build byte-for-byte. The previous whitespace-only receipt defect is repaired. However, the candidate has a new release-blocking local-data recovery defect: archive import validates only the product marker and top-level arrays, persists malformed receipt rows, and can leave the app permanently on **The local deck could not open.** Retrying does not recover because the invalid rows remain in IndexedDB; the product offers no way to remove or export them from that state.

Exact local and live reproduction with two receipt objects containing only `id`:

```json
{
  "toast": "Cannot read properties of undefined (reading 'localeCompare')",
  "afterReload": "The local deck could not open.",
  "afterRetry": "The local deck could not open."
}
```

This is **High** severity because JSON import/export is the PWA's required data-ownership and transfer path, and browser-level clearing can also discard valid local receipts. Five auxiliary mobile legal/product links also miss the required 44 px target height (**Medium**). Short-lived caching with stable asset names and missing defence-in-depth response policies are documented as lower-severity deployment gaps.

Full evidence, exact reproduction, hashes, headers, browser results, and required remediation are in [`.factory/verification-2.md`](verification-2.md).

## Verification summary

- Clean detached checkout at the candidate SHA; Node `v22.23.2`, npm `10.9.8`.
- `npm ci`: PASS, 0 vulnerabilities.
- `npm test`: PASS — 6/6 unit checks; 9 browser checks passed, 1 intentional skip.
- `npm run build`: PASS — strict TypeScript and exact Vite production build; `dist/` produced.
- No lint script exists; `npm audit --omit=dev` and `git diff --check` passed.
- Independent normal, boundary, and recovery checks covered delivery creation, 2 MiB + 8-byte SHA-256, service limits/removal, acknowledgement acceptance/decline, response verification, PDF/JSON/archive export, reload persistence, deletion, valid reimport, corrupted manifest, invalid response, and invalid license.
- Desktop 1366×900, mobile 390×844, keyboard-only operation, visible focus, reduced motion, no overflow, and live core/legal axe scans were checked. Axe serious/critical: 0. Normal-flow console/page errors: 0.
- PWA manifest: valid. Versioned service-worker cache, update toast, offline reload, and offline saved receipt: PASS.
- Privacy: core flow had no cross-origin requests or file uploads. Optional license verification contacted only the expected Sociobot API and observed the once-per-day cache.
- Lighthouse mobile live: 100 Performance / 100 Accessibility / 100 Best Practices / 100 SEO; LCP 1.0 s, CLS 0, TBT 10 ms.
- Bundles: JS 41,938 bytes raw; CSS 17,063 bytes raw; mobile AVIF hero 19,182 bytes — all within budget.

## How to rerun

```sh
npm ci
npm test
npm run build
npm run preview
```

Then run the live smoke check:

```sh
/opt/fleet/lib/verify-url.sh https://delivery-acceptance-receipt.sociobot.in/ /tmp/delivery-receipt-evidence
```

## Next step

Reject and report malformed archives before any IndexedDB write, make bundle import atomic, add invalid-archive persistence/reload regression tests, redeploy, and run a fresh independent verification. Do not release this candidate as accepted.
