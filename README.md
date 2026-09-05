# Delivery Receipt

Delivery Receipt helps freelancers record delivered files or services, ask a client to accept or decline the listed delivery, and export the result. It is a local-first PWA. It does not hold files, money, or credentials.

Try the isolated sample: <https://delivery-acceptance-receipt.sociobot.in/demo>

## Use it

1. Add the project details and fingerprint files or list completed services.
2. Seal the receipt and send its acknowledgement link with the actual delivery.
3. The client checks the fixed list, accepts or declines it, and sends back a response code.
4. Verify the response code and download PDF or JSON records.

The core app needs no account. File bytes are hashed in the browser and are not uploaded. Receipt records remain in browser storage until deleted. After the first visit, receipt creation works offline. Shared acknowledgement links contain receipt metadata and hashes, not file bytes.

Use **Try it with sample data** or `/demo` to open a completed Northstar Coffee handoff. Demo records use a separate `demo:delivery-receipt` IndexedDB database. Resetting the sample never changes real records.

This product records evidence only. It is not escrow, payment collection, legal advice, identity verification, or a guarantee of legal effect. Legal effect depends on the agreement and jurisdiction.

## Develop and verify

Requirements: Node.js 22+ and npm. Playwright Chromium 1.58.2 is pinned. If needed, run `npx playwright install chromium`.

```sh
npm ci
npm test
npm run build
npm run test:claims
```

`npm test` runs unit tests plus desktop and phone browser coverage. `npm run test:claims` runs every command in [`.factory/claims.json`](.factory/claims.json) from the sample entry point.

## Deploy

Build with `npm run build` and publish `dist/` at the domain root. The build includes the service worker, manifest, immutable hashed application assets, `staticwebapp.config.json`, and the designed `404.html` response. The static deployment must preserve the headers, content type, route rewrites, 404 override, and one-site origin described by that configuration.

## Privacy and design

See [privacy](https://delivery-acceptance-receipt.sociobot.in/privacy/) and [terms](https://delivery-acceptance-receipt.sociobot.in/terms/). The product-specific cassette-print visual system and image provenance are in [`.factory/design.md`](.factory/design.md). Demo details are in [`.factory/demo.md`](.factory/demo.md).

## License

MIT. See [LICENSE](LICENSE).
