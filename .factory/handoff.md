# Delivery Receipt — verification 3 handoff

## Result

Independent verification result: **FAIL**.

- Findings: 3 medium
- Untested claims: 2
- Implementation reviewed: `cbd2bc673d7549f8a019d6f66cd15e5ff3827fde`
- Documentation baseline: `7e09a53291d85698736dfca54f541f7cf6bae77c`
- Live URL: <https://delivery-acceptance-receipt.sociobot.in/>
- Full report: `.factory/verification-3.md`

No product code was changed.

## What was verified

- Fresh desktop and 393×727 phone first screens state the job, name freelancers, and lead with **Try it with sample data**. All three facts fit before scrolling.
- The Northstar sample is populated, labelled, resettable, and isolated from a separately created real receipt.
- Normal delivery, 2 MiB boundary hashing, client decline, invalid and valid response codes, persistence, PDF, malformed import recovery, and damaged links work live.
- Offline reload, receipt creation, acknowledgement, sender verification, PDF export, and the service-worker update notice work live.
- Routes, titles, H1 focus, legal pages, internal links, deliberate 404, security headers, MIME type, immutable caching, reduced motion, reflow, and same-origin privacy checks passed.
- Axe returned zero serious or critical violations on all four public routes.
- Lighthouse mobile scored 100/100/100/100. FCP and LCP were 1.2 s, TBT 70 ms, and CLS 0.
- All 25 deployable files matched the clean candidate build byte-for-byte.
- `npm ci`, `npm test`, `npm run build`, all nine declared claim commands, `npm audit --omit=dev`, and `git diff --check` exited successfully in a detached checkout at the implementation SHA.

## Findings left

1. Four home/legal content links are only 18 px high on a phone. The contract requires 44×44 px targets.
2. `offline-reload` can pass by seeing the pre-existing sample receipt heading. It does not assert that a new offline receipt was created, and it does not cover the broader offline response/PDF status text.
3. `local-only` captures requests only during `/demo` load. It does not perform the demo flow named by the claim.

The last two items leave two claims untested even though their commands exit successfully. Details and exact evidence are in `.factory/verification-3.md`.

## How to reproduce

```sh
npm ci
npm test
npm run build
npm run test:claims
```

At 393 px wide, measure **Read the privacy policy** on `/` or `/demo`; its hit box is about 220.8×18 px. The privacy and terms email links are about 182.4×18 px.

Read `tests/e2e/app.spec.ts` for `@claim:offline-reload` and `@claim:local-only`. The first checks a heading that exists before the attempted offline creation. The second ends after page load.

## Next steps

- Repair and test the four content-link targets.
- Strengthen the two claim tests to assert their full observable outcomes.
- Re-run independent live verification. Acceptance requires zero findings and zero untested claims.
