# Delivery Receipt — visual system

## Thesis: the handoff tape

The product looks like a cassette-era zine assembled for a careful studio handoff: warm copy paper, black registration ink, a blue rubber stamp, fluorescent catalog stickers, halftone grain, and the physical logic of a tape label. This is not nostalgia as decoration. A cassette is a portable, finite recording; the interface uses that metaphor to explain the product's job—a small record passed from maker to client, with a side A (delivery) and side B (response).

The treatment is intentionally single-mode. The paper surface is part of the product's identity and supports a stable print/PDF translation; controls still use clear system-level light/dark focus cues, but there is no separate dark theme.

## Palette

| Token | Value | Use |
| --- | --- | --- |
| paper / background | `#f2e7cf` | warm uncoated stock |
| paper raised | `#fff8e9` | forms and receipt sheets |
| ink | `#171512` | primary type and rules |
| muted ink | `#655b4d` | supporting copy (7:1 on paper) |
| cobalt | `#2448a8` | primary action and stamped state |
| cobalt dark | `#193375` | hover and focus |
| acid label | `#d9e44c` | highlighter and current step |
| signal orange | `#c8492e` | warnings, offline status |
| success | `#286446` | accepted state |
| danger | `#9b3028` | declined/errors |

All body text combinations target WCAG AA (4.5:1 minimum). Color is always paired with a word, icon, border treatment, or pattern.

## Typography

- Display: `Arial Narrow`, `Roboto Condensed`, `Franklin Gothic Condensed`, sans-serif. Uppercase is restricted to short labels, using tight cassette-spine proportions.
- Working text: `Courier New`, `Nimbus Mono PS`, monospace. The fixed rhythm makes hashes, dates, and manifests easy to compare.
- No webfonts ship; the two system stacks avoid a network request and keep first load/print deterministic. Body is 16px minimum, 1.55 line height, and readable measures stay below 72 characters.

Type scale: 16 / 18 / 22 / 32 / clamp(40–68) px. Numerals and hash rows use tabular figures.

## Spacing, shape, and depth

The base unit is 4px, used primarily as 8 / 12 / 16 / 24 / 32 / 48 / 64. Sheets are separated by space before borders. Corners are mostly 0–6px, recalling cut paper and label stock rather than software cards. Hard 3px rules and 4px offset shadows create physical layers. A single column at 390px becomes an asymmetric 7/5 desktop grid. Touch targets are at least 44px.

## Interaction grammar

- The main flow reads like a deck: `01 Log it → 02 Seal it → 03 Get the answer`.
- Adding a file behaves like placing a track on a tape: a short progress label changes from “Reading” to “Hashed”, then the immutable digest appears.
- Statuses use stamp language—Draft, Sent, Accepted, Declined—with both text and geometry.
- Acknowledgement is a separate “Side B” composition with the supplied manifest visually locked. The client can respond but cannot edit what was delivered.
- Destructive record removal names the record and asks for confirmation. Import/export and response-code workflows keep ownership visible.

## Motion

Motion has physical origin: new rows slide down 8px while fading in; a completed hash receives one 160ms stamp-scale emphasis; toasts rise from the bottom edge over 220ms. Nothing loops. Under `prefers-reduced-motion: reduce`, transforms and smooth scrolling are removed and state changes become immediate opacity changes.

## Original asset plan and provenance

The hero illustration is a generated editorial still life: a clear cassette whose label becomes a delivery manifest, a blue ACCEPTED stamp, clipped paper, and visible halftone grain. It clarifies “portable record of a handoff” without pretending the app stores files. Hand-authored SVG pictograms cover interface actions; they use simple tape, file, check, and seal geometry and are not derived from third-party icon libraries.

### Prompt sheet

- Subject: one transparent compact cassette used as a delivery record, paper manifest fragments, check marks without readable words, a rubber acceptance stamp shape.
- World/materials: late-1980s independent print studio, uncoated cream paper, translucent plastic, black toner, torn fluorescent label stock, coarse halftone.
- Light/lens: overhead editorial still life, shallow physical shadows, even daylight, 50mm feel.
- Palette words: warm paper, registration black, photocopier cobalt, acid yellow-green, restrained signal orange.
- Composition: landscape, primary object right-of-center, usable paper-negative-space on the left, no interface mockup.
- Negative list: no people, hands, brands, logos, watermarks, readable text, fake app UI, gradients, neon cyberpunk, glossy 3D render.

Generated with the factory image deployment (`/opt/fleet/lib/gen-image.sh`, Azure OpenAI image model) on 2026-08-28. Original generated work commissioned for this product. Final source prompt is stored beside the source image in `assets/src/hero-cassette.json`; WebP derivatives are optimized locally and reviewed for unwanted text, symbols, brands, and visual seams.

## Print/PDF

Exported receipts translate the same language into monochrome-safe paper: title, state word, manifest, digest, timestamps, and evidence disclaimer. Decorative texture drops out, and no meaning depends on color.
