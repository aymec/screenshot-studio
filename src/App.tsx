import { useCallback, useEffect, useRef, useState } from 'react'
import { BusyOverlay } from './components/BusyOverlay'
import { ConfirmModal } from './components/ConfirmModal'
import { ControlsPanel } from './components/ControlsPanel'
import { InfoModal } from './components/InfoModal'
import { ScreenshotStrip } from './components/ScreenshotStrip'
import { download, exportPng, loadImage, render, toPng } from './render'
import { zip } from './zip'
import {
  DEFAULT_DESIGN,
  DEFAULT_PRESET,
  MAX_SCREENSHOTS,
  PRESETS,
  presetById,
  type Design,
} from './template'
import { useTheme } from './theme'
import { useI18n } from './i18n'

const STORAGE_KEY = 'screenshot-studio:design'
const DEVICE_KEY = 'screenshot-studio:device'

/** One marketing screenshot: the panel's design, and the phone capture dropped into it. */
interface Slide {
  design: Design
  /** The image and the file it came from. Never persisted — it lives only in this session. */
  shot: { img: HTMLImageElement; name: string } | null
}

/** A device's screenshots, in the order they will be exported. Every device has its own. */
type Decks = Record<string, Slide[]>

const blankDeck = (): Slide[] => [{ design: DEFAULT_DESIGN, shot: null }]

/**
 * Restore each device's designs. Only the designs are stored — an image is a live
 * HTMLImageElement, so a reload always starts with empty screens.
 *
 * Storage from before this app had more than one screenshot per device holds a single
 * shared Design; it is lifted into every device's first slide rather than dropped.
 */
function loadDecks(): Decks {
  const decks: Decks = Object.fromEntries(PRESETS.map((p) => [p.id, blankDeck()]))
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return decks
    const parsed: unknown = JSON.parse(raw)

    const slidesOf = (designs: Partial<Design>[]): Slide[] =>
      designs
        .slice(0, MAX_SCREENSHOTS)
        .map((d) => ({ design: { ...DEFAULT_DESIGN, ...d }, shot: null }))

    // The one-design-per-app shape: a bare object with a caption in it.
    if (parsed && typeof parsed === 'object' && 'sentence' in parsed) {
      const legacy = slidesOf([parsed as Partial<Design>])
      for (const p of PRESETS) decks[p.id] = legacy
      return decks
    }

    for (const [id, designs] of Object.entries((parsed ?? {}) as Record<string, Partial<Design>[]>)) {
      // A preset dropped from a later build leaves designs nothing can be rendered into.
      if (!(id in decks) || !Array.isArray(designs) || designs.length === 0) continue
      decks[id] = slidesOf(designs)
    }
  } catch {
    // Corrupt or unavailable storage: fall back to the template defaults.
  }
  return decks
}

/** The design is the user's; the device is which panel it is rendered into. Stored apart. */
function loadDeviceId(): string {
  try {
    // presetById falls back to the default, so a preset dropped from a later build — or any
    // junk in storage — cannot leave the app with no geometry to render.
    return presetById(localStorage.getItem(DEVICE_KEY) ?? '').id
  } catch {
    return DEFAULT_PRESET.id
  }
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40) || 'screenshot'

/** Exports are numbered: a device's screenshots are uploaded to the store as an ordered set. */
const filename = (design: Design, presetId: string, n: number) =>
  `${slug(design.sentence)}-${presetId}-${n}.png`

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [deviceId, setDeviceId] = useState<string>(loadDeviceId)
  const preset = presetById(deviceId)
  // Keyed by device: a screenshot is of one device, and center-cropping a phone capture into
  // a tablet's screen produces a panel nobody would ship. Switching devices therefore shows
  // that device's own screenshots, from the empty state until one is dropped in.
  const [decks, setDecks] = useState<Decks>(loadDecks)
  // Which screenshot of each device is on the canvas. Per device, so switching to a tablet
  // and back returns to the screenshot the user was editing, not to its first one.
  const [cursors, setCursors] = useState<Record<string, number>>({})
  const [frame, setFrame] = useState<HTMLImageElement | null>(null)
  const [fontsReady, setFontsReady] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [exporting, setExporting] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { lang, setLang, t } = useI18n()

  const deck = decks[deviceId] ?? blankDeck()
  const index = Math.min(cursors[deviceId] ?? 0, deck.length - 1)
  const slide = deck[index]
  const design = slide.design

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setPanelOpen(false)
      setInfoOpen(false)
      setConfirmDelete(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Drop the old frame as soon as the device changes: it was drawn for the previous
  // geometry, and rendering it into the new one would stretch it across a mismatched body
  // for a frame or two. `cancelled` keeps a slow load from a device the user already
  // switched away from landing on top of the current one.
  useEffect(() => {
    let cancelled = false
    setFrame(null)
    loadImage(preset.frame.src)
      .then((img) => {
        if (!cancelled) setFrame(img)
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [preset.frame.src])

  useEffect(() => {
    try {
      localStorage.setItem(DEVICE_KEY, deviceId)
    } catch {
      // Private mode: the choice just won't survive a reload.
    }
  }, [deviceId])

  // The first paint must wait for the webfont, or the caption measures and draws
  // in a fallback face and the layout shifts once Inter arrives.
  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true))
  }, [])

  useEffect(() => {
    const designs = Object.fromEntries(
      Object.entries(decks).map(([id, slides]) => [id, slides.map((s) => s.design)]),
    )
    localStorage.setItem(STORAGE_KEY, JSON.stringify(designs))
  }, [decks])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !fontsReady) return
    render(ctx, { preset, design, screenshot: slide.shot?.img ?? null, frame })
  }, [preset, design, slide, frame, fontsReady])

  /** Replace the screenshot the edit was made on, leaving the rest of the deck alone. */
  const patchSlide = useCallback(
    (device: string, at: number, f: (slide: Slide) => Slide) =>
      setDecks((prev) => {
        const slides = prev[device] ?? blankDeck()
        if (at >= slides.length) return prev
        return { ...prev, [device]: slides.map((s, i) => (i === at ? f(s) : s)) }
      }),
    [],
  )

  const patch = useCallback(
    (p: Partial<Design>) =>
      patchSlide(deviceId, index, (s) => ({ ...s, design: { ...s.design, ...p } })),
    [patchSlide, deviceId, index],
  )

  // Must be a functional update: computing the next list from the `design` in a closure
  // would make two toggles in the same tick collapse into one.
  const toggleWord = useCallback(
    (i: number) =>
      patchSlide(deviceId, index, (s) => ({
        ...s,
        design: {
          ...s.design,
          highlightIndices: s.design.highlightIndices.includes(i)
            ? s.design.highlightIndices.filter((n) => n !== i)
            : [...s.design.highlightIndices, i],
        },
      })),
    [patchSlide, deviceId, index],
  )

  const select = useCallback(
    (i: number) => setCursors((c) => ({ ...c, [deviceId]: i })),
    [deviceId],
  )

  // A new screenshot starts as a copy of the one being viewed, minus its image: the set is
  // meant to look like one set, and re-picking the colors and type for each is not the work
  // the user came here to do. Everything on it is still theirs to change.
  const handleAdd = useCallback(() => {
    setDecks((prev) => {
      const slides = prev[deviceId] ?? blankDeck()
      if (slides.length >= MAX_SCREENSHOTS) return prev
      const from = slides[Math.min(index, slides.length - 1)]
      return { ...prev, [deviceId]: [...slides, { design: { ...from.design }, shot: null }] }
    })
    setCursors((c) => ({ ...c, [deviceId]: Math.min(deck.length, MAX_SCREENSHOTS - 1) }))
  }, [deviceId, index, deck.length])

  // Drop the selected screenshot. The cursor stays where it is unless it fell off the end, which
  // lands the user on the screenshot that slid into the gap — the one they were looking toward.
  const handleDelete = useCallback(() => {
    setDecks((prev) => {
      const slides = prev[deviceId] ?? blankDeck()
      if (slides.length <= 1) return prev
      return { ...prev, [deviceId]: slides.filter((_, i) => i !== index) }
    })
    setCursors((c) => ({ ...c, [deviceId]: Math.max(0, Math.min(index, deck.length - 2)) }))
    setConfirmDelete(false)
  }, [deviceId, index, deck.length])

  // The image belongs to the screenshot that was on the canvas when it was dropped, which is
  // the one captured here — not whichever one is selected by the time the file decodes.
  const handleImage = useCallback(
    (file: File) => {
      const device = deviceId
      const at = index
      const reader = new FileReader()
      reader.onload = async () => {
        const img = await loadImage(reader.result as string)
        patchSlide(device, at, (s) => ({ ...s, shot: { img, name: file.name } }))
      }
      reader.readAsDataURL(file)
    },
    [patchSlide, deviceId, index],
  )

  const handleExport = useCallback(() => {
    if (canvasRef.current) {
      exportPng(canvasRef.current, filename(design, preset.id, index + 1))
    }
  }, [design, preset.id, index])

  // Draw each screenshot into the one real canvas in turn, collect the PNGs, and hand back a
  // single zip — ten separate downloads is a browser permission prompt and a mess of a folder.
  // A screenshot with no image in it is an empty frame nobody would upload, so it is skipped,
  // but the numbering follows the deck: it is what the user sees on the chips.
  // The canvas is left on the wrong screenshot for the length of the loop, which the render
  // effect puts back — export and preview stay the same pixels either way.
  const handleExportAll = useCallback(async () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    setExporting(true)
    // Let the overlay paint before the loop starts drawing over the canvas, or the user watches
    // the preview flip through the deck with nothing to explain why.
    await new Promise(requestAnimationFrame)

    try {
      const entries = []
      for (const [i, s] of deck.entries()) {
        if (!s.shot) continue
        render(ctx, { preset, design: s.design, screenshot: s.shot.img, frame })
        const png = await toPng(canvas)
        if (png) {
          entries.push({
            name: filename(s.design, preset.id, i + 1),
            data: new Uint8Array(await png.arrayBuffer()),
          })
        }
      }
      render(ctx, { preset, design, screenshot: slide.shot?.img ?? null, frame })

      if (entries.length) download(zip(entries), `${preset.id}-screenshots.zip`)
    } finally {
      // Even if a screenshot fails to encode, the app must not be left behind the overlay.
      setExporting(false)
    }
  }, [deck, preset, frame, design, slide])

  const handleReset = useCallback(
    () => patchSlide(deviceId, index, (s) => ({ ...s, design: DEFAULT_DESIGN })),
    [patchSlide, deviceId, index],
  )

  return (
    <div className="flex h-full bg-slate-100 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* The preview is always on screen and takes all the space it can, with the screenshot
          switcher under it. Below `lg` the panel slides over it from the right. */}
      {/* Vertical padding stays small at every width — the preview is the product, and every pixel
          spent above or below it is a pixel it does not get. Desktop only widens the side gutters. */}
      <main className="flex flex-1 flex-col items-center justify-center gap-3 overflow-hidden p-3 lg:gap-4 lg:px-8 lg:py-3">
        {/* min-h-0 lets the canvas shrink inside the column instead of overflowing it. */}
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {/* Intrinsic size is the true export size; CSS max-* scales it down for preview. */}
          <canvas
            ref={canvasRef}
            width={preset.canvas.w}
            height={preset.canvas.h}
            className="max-h-full max-w-full rounded-lg shadow-2xl ring-1 ring-slate-300 dark:ring-slate-800"
            style={{ width: 'auto', height: 'auto' }}
          />
        </div>

        <ScreenshotStrip
          count={deck.length}
          index={index}
          highlightColor={design.highlightColor}
          onSelect={select}
          onAdd={handleAdd}
          onDelete={() => setConfirmDelete(true)}
          t={t}
        />
      </main>

      <div
        onClick={() => setPanelOpen(false)}
        className={`fixed inset-0 z-10 bg-black/60 transition-opacity duration-300 lg:hidden ${
          panelOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <ControlsPanel
        design={design}
        preset={preset}
        onDevice={setDeviceId}
        onChange={patch}
        onImage={handleImage}
        onExport={handleExport}
        onExportAll={handleExportAll}
        // An empty frame is not a screenshot anyone uploads, so a deck with no images at all has
        // nothing to zip — the button says so rather than downloading an empty file.
        canExportAll={deck.some((s) => s.shot)}
        onReset={handleReset}
        count={deck.length}
        index={index}
        hasImage={!!slide.shot}
        imageName={slide.shot?.name ?? null}
        open={panelOpen}
        onInfo={() => setInfoOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        t={t}
        lang={lang}
        onLang={setLang}
        onToggleWord={toggleWord}
      />

      {/* Stays pinned above the panel (z-30 > the panel's z-20) and toggles it, so it is
          the single control for opening and closing. The panel reserves bottom padding so
          its last control can scroll clear of this button.

          It floats clear above the strip rather than beside it: overlapping the bottom corner of
          the preview costs nothing, while sharing the strip's line would squeeze the chips. */}
      <button
        onClick={() => setPanelOpen((o) => !o)}
        aria-label={panelOpen ? t('closeControls') : t('showControls')}
        aria-expanded={panelOpen}
        className="fixed right-5 bottom-24 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-500 active:scale-95 lg:hidden"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          {panelOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      <BusyOverlay open={exporting} t={t} />

      <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)} t={t} />

      <ConfirmModal
        open={confirmDelete}
        title={t('deleteScreenshot', { n: index + 1 })}
        body={t('deleteScreenshotBody')}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        t={t}
      />
    </div>
  )
}
