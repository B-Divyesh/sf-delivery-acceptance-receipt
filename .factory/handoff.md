# Delivery Receipt — repair handoff

## Result

The repair is complete for the local-first delivery-to-client-response job.

- Implementation SHA: `cbd2bc673d7549f8a019d6f66cd15e5ff3827fde`
- Documentation report SHA: recorded in `.factory/documentation-sha.txt` after this report commit
- Live URL: <https://delivery-acceptance-receipt.sociobot.in/>
- Deployment: Static Web Apps production deployment succeeded on 2026-09-05 UTC.

The product lets freelancers record delivered files or services, send a fixed acknowledgement page, verify a client acceptance or decline, and export the receipt. It does not hold files, money, or credentials.

## What changed

- Added isolated `/demo` with a realistic Northstar Coffee receipt, accepted response, persistent sample banner, Reset demo, and Start for real. Demo data uses `demo:delivery-receipt`; real records use `delivery-receipt`.
- Validated every imported archive row before writing and imported the checked bundle in one IndexedDB transaction. Accepted or declined records require their matching response. Invalid data is rejected without changing current records.
- Added nine demo-backed public claims in `.factory/claims.json`, a claim runner, and outcome-based browser checks.
- Removed the unavailable Studio offer, checkout link, and license code. The free core product remains usable without an account.
- Rewrote first-screen and empty-state copy in plain language; added the copy audit and catalog description.
- Added real acknowledgement routes, route-specific titles, focus movement, announcements, standard header/footer, metadata, social preview, Apple icon, designed 404, Static Web Apps policies, immutable hashed assets, and manifest MIME configuration.
- Generated the service worker from the production asset list and retained update notification, offline shell, reduced motion, visible focus, and 44 px phone targets.

## Previous finding disposition

| Finding | Disposition |
| --- | --- |
| R1 sample sandbox | Fixed: `/demo` is isolated and populated. |
| R2 malformed archive corruption | Fixed: strict validation and atomic import preserve existing records. |
| R3 missing claim tests | Fixed: nine declared claims each have a tagged browser test and command. |
| R4 broken Studio checkout | Fixed by removing the unavailable offer and all license UI. |
| R5 plain words and first screen | Fixed: audience, sample action, facts, and copy audit added. |
| R6 phone touch targets | Fixed: auxiliary links are 44 px minimum. |
| R7 acknowledgement routing/title/focus | Fixed: path routes, titles, focus, and announcements added. |
| R8 designed 404 | Fixed: deliberate HTTP 404 renders the recovery page. |
| R9 metadata and shared skeleton | Fixed: canonical, OG/Twitter, icons, sitemap, header/footer, and legal metadata added. |
| R10 cache policy and manifest MIME | Fixed: hashed assets are immutable; manifest is `application/manifest+json`. |
| R11 response security policies | Fixed: CSP, Permissions Policy, COOP, and CORP are live response headers. |

## Verification

In a clean detached worktree at the implementation SHA, `npm ci`, `npm test`, `npm run build`, `npm run test:claims`, `npm audit --omit=dev`, and `git diff --check` all passed. `npm test` ran 7 Vitest checks and 28 desktop/phone Playwright checks. Each of the nine declared claim commands passed from `/demo`. The production build writes `dist/`.

Live verification passed:

- `verify-url.sh` found HTTPS 200, title, language, one H1, main landmark, image alt text, labelled buttons, and no home-page console errors.
- Fresh desktop first screen names the job, freelancers as the audience, and **Try it with sample data** as the first action. All three facts are visible before scrolling.
- Fresh phone at 393×727 has no horizontal overflow. The heading, audience, sample action, and facts finish at 717 px, before the viewport bottom.
- The live demo showed its banner, Northstar Coffee receipt, accepted response, Reset demo, and Start for real. Reset reseeded only demo data; a separately created real receipt remained and no sample record appeared in real storage.
- A live sender created a receipt, a separate client browser declined it, the sender verified the returned response code, and the live PDF started `%PDF-1.4`.
- A fresh controlled live context loaded `/demo`, went offline, reloaded, and created and sealed a receipt while controlled by the service worker.
- Axe on `/`, `/demo`, `/privacy/`, and `/terms/` returned zero serious or critical violations.
- `/not-a-real-route` returns HTTP 404 with the designed recovery page. The browser records the intentional network 404 for that navigation; the page itself has its title, H1, recovery link, and no script error.
- Home response includes CSP, Permissions Policy, COOP, CORP, referrer policy, and nosniff. The manifest is `application/manifest+json`; hashed JavaScript is immutable for one year.
- Every public file in deployed `dist/` matched the implementation build byte-for-byte.
- Lighthouse mobile: Performance 100, Accessibility 100, Best Practices 100, SEO 100. FCP 1.0 s, LCP 1.1 s, TBT 30 ms, CLS 0.

## Known dependency

The researched monetization is a one-time purchase, but the registered Sociobot Studio checkout returned 404 during review. It is not advertised or simulated in this release. Enabling a paid Studio tier requires a working product registration in the Sociobot billing API and a separate end-to-end checkout verification. This does not affect the free core receipt workflow.

## Useful files

- `.factory/claims.json` — public claims and commands.
- `.factory/demo.md` — demo URL, sample, reset, and storage isolation.
- `.factory/copy-audit.md` — landing copy audit and terminology.
- `README.md` — local setup, testing, build, and deployment instructions.
