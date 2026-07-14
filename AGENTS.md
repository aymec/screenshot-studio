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
npx tsc -b         # typecheck
```

Typecheck with `tsc -b`, **not** `tsc --noEmit`. The root `tsconfig.json` is a solution file with
`"files": []`, so `--noEmit` checks *nothing* and exits 0 however broken the code is.

## The one rule that matters

**The canvas is the product.** `render()` in `src/render.ts` draws the panel onto a real
1242 × 2688 `<canvas>`; the preview is that same canvas scaled with CSS, and export is
`canvas.toBlob()`. Preview and export are therefore the same pixels. Do not reintroduce a second
rendering path (DOM-to-image, an offscreen copy, a separate export canvas) — the whole design
depends on there being exactly one.

"Export all" obeys this too. It walks **every device's** deck, so the canvas is resized to each
preset in turn, draws each screenshot, and awaits `toPng` between them — then puts its own size and
the selected screenshot back at the end. It is a loop over the one canvas, not a second renderer.

It hands back a **single zip** (`src/zip.ts`), not one download per screenshot — a browser blocks
or prompts on a burst of downloads, and ten loose PNGs are a mess to find. Entries are *stored*,
not deflated: PNGs are already compressed, so a compressing dependency would buy nothing. A
screenshot with no image is an empty frame nobody uploads, so it is left out of the zip, but the
numbering still follows the deck the user sees on the chips.

## One deck of screenshots per device

A device holds up to `MAX_SCREENSHOTS` (10, the store limit) marketing screenshots, and exactly one
is on the canvas at a time — the strip under the preview (`ScreenshotStrip`) switches between them.
Each screenshot carries its **own full `Design` and its own image**; nothing is shared between them,
so restyling one never touches the others.

- The decks are `Record<deviceId, Slide[]>` in `App.tsx`. Screenshots are keyed by device for the
  same reason a single one was: a phone capture center-cropped into a tablet's screen is not
  shippable. Switching device swaps the whole deck, and each deck remembers its own cursor.
- A `Slide` keeps the **bytes** of its capture, not just the decoded `HTMLImageElement`. An image
  element can only be turned back into a file by re-encoding it through a canvas, which would save
  a recompressed PNG of the user's file rather than the file itself. Everything that stores an
  image stores those bytes; `blobToImage()` is the one way back.
- An edit is applied to the `(deviceId, index)` **captured when the edit was made**, not read back
  from state when the work finishes. That is what keeps a slow image decode from landing on
  whichever screenshot the user has switched to since.
- Exports are numbered (`…-iphone-6.5-3.png`): a device's screenshots are an ordered set in a store
  listing, and every export would otherwise overwrite the last.
- The file input clears its own `value` after each pick. The same capture on two screenshots is
  ordinary here, and re-picking an unchanged value fires no `change` event at all — the click just
  appears to do nothing.

The strip's shape is part of the spec, and `scripts/verify-screenshots.mjs` pins all of it:

- The arrows are always present and merely *disabled* at the ends. They do not vanish, because a
  button that disappears shifts the whole row sideways as the user pages through it.
- Chips are 36px, the arrows 44px. The selected chip aligns to the arrows' *top* edge and the
  unselected ones to their centerline, which is what makes the selected one read as raised. Both
  live in a lane as tall as an arrow (`items-start` / `items-center`) rather than being nudged by a
  fixed offset: the chips shrink with the viewport, so the offset between the two is not constant.
- Below `sm` the row **windows** to three chips instead of wrapping: ten do not fit a phone. At the
  ends of the deck the window *slides* (`1 2 3`, `8 9 10`) rather than shrinking, so the row never
  changes width. The add chip is exempt from the window — it is the only way to add a screenshot,
  and hiding it would strand phone users on the one they started with.
- Narrower still, the chips and arrows shrink (`clamp(…, vw, …)`) rather than overflow. The clamp
  maxima are the sizes above; the vw term only ever pulls them below.
- Delete is a 16px chip hanging 4px under the selected chip (from the chip itself, so it rides up
  with it), behind a yes/no `ConfirmModal` — it throws away an image, a caption, and colors. It is
  absent on a deck of one: a device must have a screenshot to render, and clearing one is what
  "Delete all" is for.
- "Export all" raises `BusyOverlay` for the length of the loop. The canvas is the preview, so the
  user watches it flip through the whole deck as it renders; without the spinner that reads as the
  app malfunctioning. The overlay also blocks edits mid-loop, which would otherwise land in the zip.

Below `lg` the floating controls button sits *above* the strip (`bottom-24`), not beside it. It may
overlap the bottom of the preview, which costs nothing, and that leaves the preview and the chips
the full width. The panel's own bottom padding (`pb-40`) tracks that offset so its last control can
still scroll clear of the button.

## A project is kept in two places

Every device's decks together are a **project**. It is stored twice, for two different lifetimes,
and `src/project.ts` is the only place that converts between live state and a stored record — so
both go through the same `sanitizeDesign` on the way back in.

**The database (`src/db.ts`) — survives a reload.** localStorage cannot hold a project: it stores
strings, ~5MB of them, and a phone capture is several MB of binary that would have to be base64'd.
That is why images used to vanish on reload. IndexedDB holds them as bytes.

- Three stores. `projects` holds the decks and a *key* per image; `images` holds the bytes; `slots`
  holds each project's id/name/mtime. **Do not put the bytes back into the project record.** One
  record means every keystroke of a caption rewrites every image, which forces a debounce, and a
  debounce loses races — change a color, reload fast, and the unwritten record loads back over the
  edit. Keyed apart, a design write is a few hundred bytes and happens on *every* edit.
- An image is written once, under the key its `Shot` has carried since the file was picked, and
  images nothing points at are collected on the next save. Do not reuse a key across projects.
- The **selected device is not restored from the project.** It lives in localStorage, read
  synchronously. Taking it from the project too gives it two sources of truth, and the stale one
  wins: switch device, reload, and you get bounced back. A project the user *loads* does select its
  device — that is a deliberate act, not a boot.
- The first render waits on `hydrated` exactly as it waits on `fontsReady`. localStorage still
  holds the designs, as the fallback for a browser that refuses a database and as the migration
  path for anyone who used the app before it stored images.

**The .zip (`toZip`/`fromZip`) — survives the browser.** One `project.json` manifest plus one entry
per image, which the user can back up, move, or hand to someone else.

- The manifest is the stored record plus `kind`, `version`, and the name/type of each image. A
  slide's `image` is the *path of an entry in the archive*, not a database key — and on load those
  paths are given **fresh keys**, or two projects would both claim `images/iphone-6.5/1.png` and the
  second one's picture would be silently dropped in favor of the first one's bytes.
- Image paths are indexed, never derived from the caption the way the PNG export names its files.
  Captions collide, can be empty, and can be entirely CJK.
- It carries the device **id**, never the preset's geometry. A stale file must not be able to bring
  back a `screen.radius` and reintroduce the corner bleed `verify-frames.mjs` exists to catch.
- Everything in the file is untrusted — it is a file on disk anyone can edit, possibly written by
  another build. Kind and version are checked, designs are sanitized, and a missing image costs its
  screenshot's picture, not the load.
- `src/unzip.ts` reads what *other* tools write, not just what `zip.ts` writes: a project unzipped,
  edited, and re-zipped in Finder comes back deflated, inside a folder, next to a `__MACOSX/`
  sidecar. It reads the central directory (a one-pass writer leaves the local headers' sizes zeroed)
  and checksums every entry.

The three exports — this screenshot, every screenshot of every device, the whole project — sit
behind one `ExportMenu`. It is a real menu (arrows, Enter, Escape, click-outside), and its items
**disable rather than disappear**: rows that move between one opening and the next have to be read
every time. Loading a project is deliberately *not* in it — it is not an export, and it replaces
everything on every device, so it is its own button behind a `ConfirmModal`.

"Delete all" clears every device's deck **and deletes the project from the database**, so it really
does put the app back where it started. (It began life as "Reset", resetting the selected
screenshot's design only, which left the images and every other screenshot in place.) It deletes the
stored project outright rather than letting the autosave overwrite it — the autosave writes what
state holds, and the point is that nothing should be left holding it.

Its confirmation offers **Save project and delete** as the way out, and that is one outcome, not
two: it writes the zip and *then* deletes. The alternative — saving and leaving the dialog up for a
second decision — is a detour out of a dialog the user is already in. **If the save fails, nothing
is deleted**, and the panel says so; deleting first, or deleting anyway, is how you lose somebody's
project. The three buttons say what they do (`Save project and delete` / `Delete without saving` /
`Cancel`) because the labels are what people read and the paragraph above them is not.

Three `ConfirmModal`s are mounted at once and **fade rather than unmount**, so each takes a `name`
(`data-confirm="delete-all"`). Without it, "the yes button" is whichever one is first in the DOM: a
`page.click('[data-confirm-yes]')` hits the *closed* dialog's coordinates, and since the dialogs
have different heights it lands on whatever is underneath. Always scope to the dialog.

## Dead space is not a control

The blocks holding the word chips, the three color rows, and the file drop zone are `<div>`s
(`Section`), never `<label>`s. A `<label>` forwards a click from *anywhere inside it* — including
the empty space beside the control — to the first control it contains: beside the word chips that
silently toggles the first word, beside a color row it pops the OS color picker, and around the
file input it opens the file picker twice (once from the label, once from our own `click()`). Use
`Field` only for a block with exactly one control in it, and give the controls in a `Section` their
own accessible names. `verify-ui.mjs` clicks that dead space and asserts nothing happens.

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
| `scripts/verify-screenshots.mjs` | the deck: chips, chevrons, the 10 cap, per-slide isolation, export all |
| `scripts/verify-responsive.mjs` | desktop dock vs. mobile slide-over, the floating button |
| `scripts/verify-theme.mjs` | light/dark, OS default, persistence |
| `scripts/verify-i18n.mjs` | all 10 locales, browser detection, `<html lang>` |
| `scripts/verify-cjk.mjs` | CJK segmentation, no injected spaces |
| `scripts/verify-project.mjs` | a project survives a reload, and a save/wipe/load round trip |

A script that seeds a design into localStorage **must clear the database in the same breath**
(`scripts/storage.mjs`), immediately before the reload it is preparing. IndexedDB outranks
localStorage, so otherwise the project autosaved by the previous page load hydrates over the design
under test and the script quietly checks the wrong thing. It has to be right before the reload,
because anything that changes state puts a project straight back.

Run the relevant ones after a change, and keep Lighthouse at 100 on accessibility (`chrome-devtools`
MCP, or the Lighthouse CLI) — **with the export menu open as well as closed**, since a11y bugs hide
in the states an audit of the resting page never reaches. Two accessibility rules are easy to break:
every visible-text control's accessible name must *contain* its visible text (WCAG 2.5.3), and text
needs 4.5:1 against its background in **both** themes (white on `bg-blue-600` is 3.76:1 and fails —
the primary button is `bg-blue-700`).

If a render change is intentional, re-record the golden with
`node scripts/verify-render.mjs --update` and eyeball the new image before committing it.

Fixtures in `tests/fixtures/` are synthetic (`npm run fixture` redraws them). Do not vendor real
apps' screenshots into this repo.

## Deployment

`VITE_SITE_URL` in `.env` is the single source of truth for the public URL. It feeds
`scripts/gen-seo.mjs` (which generates `robots.txt`, `sitemap.xml`, `llms.txt` into `public/` on
every dev/build) and the canonical/Open Graph tags in `index.html`. `public/CNAME` carries the
custom domain for GitHub Pages. Change the URL in `.env` and nowhere else.
