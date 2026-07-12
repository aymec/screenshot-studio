# Screenshot Studio — notes for coding agents

A client-side generator for App Store marketing screenshots: a phone screenshot goes into an
iPhone frame, a caption sits above it with selected words highlighted, and the result exports as a
1242 × 2688 PNG. Vite + React 19 + TypeScript + Tailwind v4. No backend, and no network calls at
runtime — keep it that way.

## Commands

```bash
npm run dev        # http://localhost:5173 (the verify scripts need this running)
npm run build      # tsc -b && vite build
npm run lint       # oxlint
npx tsc --noEmit   # typecheck
```

## The one rule that matters

**The canvas is the product.** `render()` in `src/render.ts` draws the panel onto a real
1242 × 2688 `<canvas>`; the preview is that same canvas scaled with CSS, and export is
`canvas.toBlob()`. Preview and export are therefore the same pixels. Do not reintroduce a second
rendering path (DOM-to-image, an offscreen copy, a separate export canvas) — the whole design
depends on there being exactly one.

## Layout invariants

Geometry lives in `src/template.ts` (`DevicePreset`), one preset per device. A preset's rects and
its bundled frame asset were authored against each other, so they only mean anything together:
the frame is drawn at `frame`, and `screen` is the hole in it. Changing these numbers changes the
output, so change them deliberately.

- The four presets: iPhone 6.5" (1242 × 2688), iPad Pro 13" (2064 × 2752), Android phone
  (1512 × 2688), Android tablet (1548 × 2752). The iPhone is the default.
- `screen.radius` sits between two failure modes, and the safe window differs per frame because it
  depends on how far the screen rect overhangs that frame's screen aperture. **Too small** and the
  screenshot's square corners poke out past the phone's rounded body. **Too large** and the mask
  pulls in tighter than the aperture, so the background bleeds through as a hairline at the screen's
  corners — invisible on a dark background, obvious on a bright one. The iPhone shipped at 140
  against a 133px aperture and had exactly that bleed at its two bottom corners; it is now 130.
  Don't round the corners more to make them "look right" — measure.
- `scripts/verify-frames.mjs` proves both, for every device, by flood-filling the frame's alpha:
  from the canvas border inward is outside the body; from the middle of the screen outward is the
  aperture. Run it if you touch any geometry.
- The caption is centered by its **ink box** (`actualBoundingBox*`), not font metrics, within the
  band between the canvas top and the frame. That is what keeps it optically centered across fonts.
  The caption is the same size on every device, so `Design.fontSize` is shared, not per-device.

## Captions are not whitespace-delimited

`src/text.ts` tokenizes with `Intl.Segmenter`. Japanese and Chinese have word boundaries but no
spaces, so a `split(/\s+/)` would collapse a caption into one unhighlightable token *and* the
renderer would inject spaces the language never uses. Each `Token` carries `spaceBefore` recording
whether real whitespace preceded it; the renderer only draws a space when that flag is set. Never
"simplify" this back to a whitespace split.

Highlight state (`design.highlightIndices`) indexes into these tokens. Toggling must go through a
**functional** state update (`setDesign(d => …)`) — computing the next list from a closure makes two
toggles in one tick collapse into one.

## Colors

Tailwind v4 emits `oklch()`. Anything that measures color must handle it: the canvas 2D color
parser silently ignores `oklch`, and naively regexing digits out of the string yields nonsense.
This has produced false test results twice. `readableOn()` in `src/color.ts` picks black or white
for a chip label against a user-chosen highlight color, because a fixed label color cannot stay
above the 4.5:1 WCAG AA threshold for every hue.

## Verification

There are no unit tests. Everything is checked by driving the real app in headless Chrome
(`puppeteer-core` against the system Chrome). Start `npm run dev` first, then run any of:

| script | covers |
| --- | --- |
| `npm run verify` | golden-image regression of the rendered panel |
| `scripts/verify-frames.mjs` | every device: canvas size, corner leaks, aperture bleed |
| `scripts/verify-ui.mjs` | every control, corner leaks, export, persistence |
| `scripts/verify-responsive.mjs` | desktop dock vs. mobile slide-over, the floating button |
| `scripts/verify-theme.mjs` | light/dark, OS default, persistence |
| `scripts/verify-i18n.mjs` | all 10 locales, browser detection, `<html lang>` |
| `scripts/verify-cjk.mjs` | CJK segmentation, no injected spaces |

Run the relevant ones after a change, and keep Lighthouse at 100 on accessibility (`chrome-devtools`
MCP, or the Lighthouse CLI). Two accessibility rules are easy to break: every visible-text control's
accessible name must *contain* its visible text (WCAG 2.5.3), and muted text needs 4.5:1 against its
background in **both** themes.

If a render change is intentional, re-record the golden with
`node scripts/verify-render.mjs --update` and eyeball the new image before committing it.

Fixtures in `tests/fixtures/` are synthetic (`npm run fixture` redraws them). Do not vendor real
apps' screenshots into this repo.

## Deployment

`VITE_SITE_URL` in `.env` is the single source of truth for the public URL. It feeds
`scripts/gen-seo.mjs` (which generates `robots.txt`, `sitemap.xml`, `llms.txt` into `public/` on
every dev/build) and the canonical/Open Graph tags in `index.html`. `public/CNAME` carries the
custom domain for GitHub Pages. Change the URL in `.env` and nowhere else.
