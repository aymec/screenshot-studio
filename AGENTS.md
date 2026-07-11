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

Geometry lives in `src/template.ts` (`DevicePreset`) and was measured from the GIMP template this
tool replaces. Changing these numbers changes the output, so change them deliberately:

- Canvas 1242 × 2688; frame 1087 × 2189 at (78, 483); screen 946 × 2054 at (148, 546).
- `screen.radius` is **140**. It must exceed the frame PNG's screen aperture (~135px) or the
  screenshot's corners poke out past the bezel, but stay under ~150px or the rounding eats into the
  visible screen. Both failure modes are subtle; `verify-ui.mjs` flood-fills from the canvas border
  through the frame's transparent pixels to prove nothing leaks outside the phone body.
- The caption is centered by its **ink box** (`actualBoundingBox*`), not font metrics, within the
  band between the canvas top and the frame. That is what keeps it optically centered across fonts.

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
