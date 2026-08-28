# Delivery Receipt

Delivery Receipt is a local-first PWA for freelancers who want a neutral record of a handoff before a payment dispute. It fingerprints selected files with SHA-256 (without uploading or retaining their contents), records completed services, creates a portable client acknowledgement page, captures acceptance or decline, and exports actual PDF and JSON evidence.

Live: <https://delivery-acceptance-receipt.sociobot.in>

## How it works

1. Enter the engagement and add file fingerprints or completed services.
2. Seal the manifest and send its acknowledgement link alongside the actual work through your normal delivery channel.
3. The client reviews the locked manifest and returns a portable response code.
4. Import the code into the local receipt to verify that its receipt ID, manifest hash, decision, response time, and response hash match.

Receipts and client responses live in IndexedDB. Use “Export all JSON” for backup or transfer. The client link includes receipt metadata and hashes, but never file contents. The PWA works offline after its first successful load.

This product records evidence; it does not provide escrow, collections, identity verification, legal advice, or a guarantee of legal effect.

## Free and Studio

The free deck includes unlimited receipts, streaming file hashing, client responses, standard PDF/JSON export, backup/import, and offline use. Studio is a one-time ₹499 license that removes the small Delivery Receipt PDF footer and enables a custom studio footer. Checkout and license verification use only the Sociobot billing API; no payment provider is embedded in the app.

## Develop

Requirements: Node.js 22+ and npm.

```sh
npm ci
npm run dev
```

Useful commands:

```sh
npm test       # unit + desktop/mobile Playwright + axe + offline checks
npm run build  # reproducible static build in ./dist
npm run preview
```

Playwright is pinned to 1.58.2. If its Chromium browser is not already available, run `npx playwright install chromium`.

## Deploy

Run `npm ci && npm run build`, then publish the contents of `dist/` at the domain root. `dist/index.html` is the static entry point; `/privacy/` and `/terms/` are independent static entries. The service worker expects a root deployment and versioned cache names.

## Privacy and design

There are no analytics, ads, third-party runtime scripts, or remote fonts. The only optional background request verifies a locally stored Studio license with `api.sociobot.in` at most once per day. See [privacy](https://delivery-acceptance-receipt.sociobot.in/privacy/) and [terms](https://delivery-acceptance-receipt.sociobot.in/terms/).

The product-specific cassette-zine system and generated-art provenance are documented in [`.factory/design.md`](.factory/design.md). The researched scope is in [`.factory/brief.json`](.factory/brief.json).

## License

MIT. See [LICENSE](LICENSE).
