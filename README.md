# Screenshot Studio

A fully client-side generator for App Store marketing screenshots. No backend, no API — pick a
background color, write a caption, highlight a word, drop in a screenshot, export a PNG.

It replaces the GIMP XCF template + Script-Fu batch flow (`replace_screenshot.sh` /
`replace_layer.scm`) previously used for the OnTrack App Store assets, and reproduces that
template's design exactly.

## The template

A panel is a 1242 × 2688 iPhone 6.5" canvas with four layers, drawn bottom-up:

1. **Background** — a flat fill.
2. **Screenshot** — your uploaded image, aspect-filled and center-cropped into the phone's screen
   rect, clipped to rounded corners.
3. **iPhone frame** — a transparent PNG whose bezel overlaps the screenshot.
4. **Caption** — a short sentence centered in the band between the top of the canvas and the top
   of the phone, with any words you choose drawn in the highlight color.

All the geometry lives in `src/template.ts` (`DevicePreset`). It was measured from the original
XCF, and it's the only thing you need to touch to add another device size.

## Architecture

The panel is drawn onto a real 1242 × 2688 `<canvas>` by one pure function, `render()` in
`src/render.ts`. The preview you see is that same canvas scaled down with CSS, and export is
`canvas.toBlob()` — so **the preview is exactly what you export**, with no separate rasterizer to
disagree with the DOM.

- `src/template.ts` — device geometry, fonts, and the `Design` model
- `src/render.ts` — the canvas renderer (caption layout, cover-fit, export)
- `src/components/ControlsPanel.tsx` — the editor UI
- `src/App.tsx` — wiring + `localStorage` persistence

Stack: Vite, React 19, TypeScript, Tailwind v4.

## Fonts

The original template used **SF Pro Display** (the macOS system font), so that's the default, and
it matches the existing OnTrack screenshots to within 0.3%. It renders differently off Apple
platforms. **Inter** is bundled with the app, so pick it if you need exports to be identical on
any machine.

## Usage

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static bundle in dist/ — deploy anywhere
```

## Verification

Two headless-Chrome scripts drive the real app (start `npm run dev` first):

```bash
npm run verify                  # parity: rebuild the original panel and diff it against the
                                # known-good GIMP export, pixel by pixel
node scripts/verify-ui.mjs      # exercise every control and the export path
```

`npm run verify` reproduces `OnTrack_EN_iPhone_1.png` from its original source screenshot and
compares them. They agree to within ~2% of pixels, all of it text antialiasing; the caption's ink
bounding boxes land within 2px of the original.

Both scripts read the reference assets from the `habit-tracker` repo (see the paths at the top of
`scripts/verify-parity.mjs`).
