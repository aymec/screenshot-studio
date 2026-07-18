import { useCallback, useEffect, useRef, useState } from 'react'
import { BusyOverlay } from './components/BusyOverlay'
import { ConfirmModal } from './components/ConfirmModal'
import { ControlsPanel } from './components/ControlsPanel'
import { InfoModal } from './components/InfoModal'
import { ScreenshotStrip } from './components/ScreenshotStrip'
import { blobToImage, download, exportPng, loadImage, render, toPng } from './render'
import { zip } from './zip'
import {
  CURRENT_SLOT,
  deleteProject,
  getImages,
  getProject,
  isQuotaError,
  requestPersistence,
  saveProject,
} from './db'
import {
  blankDeck,
  emptyDecks,
  fromProject,
  fromZip,
  imageKeys,
  ProjectLoadError,
  sanitizeDesign,
  toProject,
  toZip,
  type Decks,
  type LoadFailure,
  type Slide,
} from './project'
import { DEFAULT_PRESET, MAX_SCREENSHOTS, PRESETS, presetById, type Design } from './template'
import { useTheme } from './theme'
import { useI18n } from './i18n'

const STORAGE_KEY = 'screenshot-studio:design'
const DEVICE_KEY = 'screenshot-studio:device'

/** The project the app autosaves into as it is edited. */
const PROJECT_NAME = 'Untitled project'

/**
 * Restore each device's designs from localStorage.
 *
 * This is no longer where the user's work lives — IndexedDB is, images included, and it wins as
 * soon as it has been read. But it is read *synchronously*, so it is what the app holds during
 * the first paint, it is what a browser that refuses to open a database keeps forever, and it is
 * what the first autosave migrates into the database on an existing user's next visit.
 *
 * Storage from before this app had more than one screenshot per device holds a single
 * shared Design; it is lifted into every device's first slide rather than dropped.
 */
function loadDecks(): Decks {
  const decks = emptyDecks()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return decks
    const parsed: unknown = JSON.parse(raw)

    const slidesOf = (designs: Partial<Design>[]): Slide[] =>
      designs.slice(0, MAX_SCREENSHOTS).map((d) => ({ design: sanitizeDesign(d), shot: null }))

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
  // The database is read asynchronously, so — exactly like the webfont — the first render waits
  // for it. Painting before it lands would show the user the empty template for a frame and then
  // snap to their actual work.
  const [hydrated, setHydrated] = useState(false)
  const [storageFull, setStorageFull] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  // The project file could not be written, so nothing was deleted. The user has to hear that.
  const [saveFailed, setSaveFailed] = useState(false)
  // What the app is busy doing, if anything. All three raise the same overlay: each one takes long
  // enough to look like a hang, and each one must block edits that would otherwise land in the
  // middle of it — a design change mid-export would be drawn into the zip.
  const [busy, setBusy] = useState<'export' | 'save' | 'load' | null>(null)
  // The project file waiting on the user's answer to "this replaces everything — go ahead?".
  const [pendingProject, setPendingProject] = useState<File | null>(null)
  const [loadError, setLoadError] = useState<LoadFailure | null>(null)
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
      setConfirmDeleteAll(false)
      setPendingProject(null)
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

  // Read the work in progress — designs *and* images — back out of the database. Every image is
  // decoded before any of it reaches state, so the decks land in one write: there is no window in
  // which half a project is on screen.
  //
  // The selected device is deliberately *not* restored from here. It is already persisted, in
  // localStorage, and read synchronously; taking it from the project as well would give it two
  // sources of truth, and the stale one would win — switch device, reload before the autosave
  // debounce has run, and the app would bounce you back to the device you just left. A project
  // the user explicitly *loads* does select its device: that is a deliberate act, not a boot.
  useEffect(() => {
    let cancelled = false
    getProject(CURRENT_SLOT)
      .then(async (project) => {
        if (!project || cancelled) return
        const restored = await fromProject(project, await getImages(imageKeys(project)))
        if (cancelled) return
        setDecks(restored.decks)
        setCursors(restored.cursors)
      })
      // No database (private mode, or a browser that refuses one): the designs loaded from
      // localStorage stand, which is the behavior this app had before it stored images at all.
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHydrated(true)
      })
    // A hint, not a guarantee, and nothing waits on the answer.
    void requestPersistence()
    return () => {
      cancelled = true
    }
  }, [])

  // Autosave, on every edit and with no debounce: what gets written here is the designs, a few
  // hundred bytes, because the images are keyed separately and each is written only once. A
  // debounce would buy nothing and cost correctness — a reload can outrun it, and the record it
  // had not yet written would load back over the edit the user just made.
  //
  // It cannot run before hydration, or the empty template the app starts with would be written
  // straight over the project it is in the middle of reading.
  useEffect(() => {
    if (!hydrated) return
    const { project, images } = toProject(CURRENT_SLOT, PROJECT_NAME, decks, cursors, deviceId)
    saveProject(project, images)
      .then(() => setStorageFull(false))
      .catch((e) => {
        // Out of quota is the one failure the user has to hear about: their images are not being
        // kept, and only they can decide what to do about it.
        if (isQuotaError(e)) setStorageFull(true)
        else console.error(e)
      })
  }, [decks, cursors, deviceId, hydrated])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !fontsReady || !hydrated) return
    render(ctx, { preset, design, screenshot: slide.shot?.img ?? null, frame })
  }, [preset, design, slide, frame, fontsReady, hydrated])

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
      const load = async () => {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const img = await blobToImage(bytes, file.type)
        // The key is minted here, once, and travels with the image for as long as it is on this
        // screenshot. The bytes under it never change, so a save can skip rewriting them.
        patchSlide(device, at, (s) => ({
          ...s,
          shot: { key: crypto.randomUUID(), img, name: file.name, bytes, type: file.type },
        }))
      }
      load().catch(console.error)
    },
    [patchSlide, deviceId, index],
  )

  const handleExport = useCallback(() => {
    if (canvasRef.current) {
      void exportPng(canvasRef.current, filename(design, preset.id, index + 1))
    }
  }, [design, preset.id, index])

  // Draw every screenshot of every device into the one real canvas in turn, collect the PNGs, and
  // hand back a single zip — a store listing is uploaded per device, and a burst of separate
  // downloads is a browser permission prompt and a mess of a folder.
  //
  // It walks the devices, not just the selected one, so the whole listing comes out in one click.
  // That means the canvas has to *become* each device in turn: its size is the export size, so it
  // is resized per preset and put back at the end, along with the screenshot that was on it. It is
  // still one canvas and one render path — preview and export remain the same pixels.
  //
  // A screenshot with no image is an empty frame nobody would upload, so it is skipped, but the
  // numbering follows the deck: it is what the user sees on the chips.
  const handleExportAll = useCallback(async () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    setBusy('export')
    // Let the overlay paint before the loop starts drawing over the canvas, or the user watches
    // the preview flip through every device with nothing to explain why.
    await new Promise(requestAnimationFrame)

    let archive: Blob | null = null
    try {
      const entries = []
      for (const p of PRESETS) {
        const slides = decks[p.id] ?? []
        if (!slides.some((s) => s.shot)) continue

        // Each device's frame is drawn against its own geometry; the browser has them cached.
        const deviceFrame = await loadImage(p.frame.src)
        canvas.width = p.canvas.w
        canvas.height = p.canvas.h

        for (const [i, s] of slides.entries()) {
          if (!s.shot) continue
          render(ctx, { preset: p, design: s.design, screenshot: s.shot.img, frame: deviceFrame })
          const png = await toPng(canvas)
          if (png) {
            entries.push({
              name: filename(s.design, p.id, i + 1),
              data: new Uint8Array(await png.arrayBuffer()),
            })
          }
        }
      }

      // Put the canvas back where the user left it: it is the preview they are looking at.
      canvas.width = preset.canvas.w
      canvas.height = preset.canvas.h
      render(ctx, { preset, design, screenshot: slide.shot?.img ?? null, frame })

      if (entries.length) archive = zip(entries)
    } finally {
      // Even if a screenshot fails to encode, the app must not be left behind the overlay.
      setBusy(null)
    }
    // Raise the save panel (in the desktop app) only after the overlay is gone, not behind it.
    if (archive) await download(archive, 'screenshots.zip')
  }, [decks, preset, frame, design, slide])

  // The project as a file: one zip holding a manifest and every image, across every device. The
  // database survives a reload; this survives the browser — it can be backed up, moved to another
  // machine, or handed to someone else.
  //
  // Building is kept separate from writing so the (synchronous, fast) build runs under the busy
  // overlay while the OS save panel that follows does not. It throws rather than swallowing a
  // failure, because one caller deletes the user's work once the save that follows succeeds — a
  // build that quietly produced nothing would take the project with it.
  const buildProject = useCallback((): { blob: Blob; name: string } => {
    const entries = toZip(decks, cursors, deviceId, PROJECT_NAME)
    // The user's own date, not UTC's: saving late in the evening east of Greenwich would
    // otherwise stamp the file with yesterday.
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    return { blob: zip(entries), name: `screenshot-studio-project-${day}.zip` }
  }, [decks, cursors, deviceId])

  const handleSaveProject = useCallback(async () => {
    setSaveFailed(false)
    setBusy('save')
    await new Promise(requestAnimationFrame)
    let project: { blob: Blob; name: string }
    try {
      project = buildProject()
    } catch (e) {
      console.error(e)
      setSaveFailed(true)
      return
    } finally {
      setBusy(null)
    }
    // Writing is its own step, after the overlay: a dismissed save panel just means no file.
    try {
      await download(project.blob, project.name)
    } catch (e) {
      console.error(e)
      setSaveFailed(true)
    }
  }, [buildProject])

  // Opening a project throws away everything currently on every device, so it is asked about
  // first. The file is held until the answer comes back.
  const handleLoadProject = useCallback((file: File) => {
    setLoadError(null)
    setPendingProject(file)
  }, [])

  const confirmLoadProject = useCallback(async () => {
    const file = pendingProject
    setPendingProject(null)
    if (!file) return

    setBusy('load')
    await new Promise(requestAnimationFrame)
    try {
      const restored = await fromZip(file)
      // Every image in the archive is decoded before any of this lands, so the whole project
      // appears at once rather than filling in screenshot by screenshot.
      setDecks(restored.decks)
      setCursors(restored.cursors)
      // Unlike a reload, this *is* a deliberate act: the project says which device it was being
      // worked on, and that is where the user expects to be put down.
      setDeviceId(restored.deviceId)
    } catch (e) {
      // A file that cannot be opened leaves the work in progress exactly as it was.
      setLoadError(e instanceof ProjectLoadError ? e.reason : 'unreadable')
    } finally {
      setBusy(null)
    }
  }, [pendingProject])

  // Start over: every device back to one blank screenshot, and the project dropped from storage.
  //
  // The stored project is deleted outright rather than left for the autosave to overwrite: the
  // autosave writes what state holds, and the point here is that nothing should be left holding it.
  // The blank state it then writes carries no image keys, so the images go with it.
  const deleteEverything = useCallback(() => {
    setConfirmDeleteAll(false)
    setLoadError(null)
    setDecks(emptyDecks())
    setCursors({})
    setDeviceId(DEFAULT_PRESET.id)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Private mode: there was nothing there to remove.
    }
    deleteProject(CURRENT_SLOT).catch(console.error)
  }, [])

  // The way out that keeps the work: write the file, *then* delete. One tap, one outcome — the
  // alternative, saving and leaving the dialog up for a second decision, is a detour that leaves
  // the user wondering whether the save happened.
  //
  // If the save fails, nothing is deleted. Deleting first, or deleting anyway, is how you lose
  // somebody's project.
  const handleSaveAndDeleteAll = useCallback(async () => {
    setSaveFailed(false)
    setBusy('save')
    await new Promise(requestAnimationFrame)
    let project: { blob: Blob; name: string }
    try {
      project = buildProject()
    } catch (e) {
      console.error(e)
      // Close the dialog on the way out, or the message explaining what went wrong is behind it.
      setConfirmDeleteAll(false)
      setSaveFailed(true)
      return
    } finally {
      setBusy(null)
    }
    let saved: boolean
    try {
      saved = await download(project.blob, project.name)
    } catch (e) {
      console.error(e)
      setConfirmDeleteAll(false)
      setSaveFailed(true)
      return
    }
    // In the desktop app the save panel can be dismissed: that is neither a failure nor a save, so
    // keep everything and leave the confirmation up for the user to choose how to leave.
    if (!saved) return
    deleteEverything()
  }, [buildProject, deleteEverything])

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
        // An empty frame is not a screenshot anyone uploads, so a project with no images at all
        // has nothing to zip — the menu item says so rather than downloading an empty file.
        canExportAll={Object.values(decks).some((slides) => slides.some((s) => s.shot))}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
        loadError={loadError}
        onDeleteAll={() => setConfirmDeleteAll(true)}
        saveFailed={saveFailed}
        storageFull={storageFull}
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
        data-panel-toggle
        onClick={() => setPanelOpen((o) => !o)}
        aria-label={panelOpen ? t('closeControls') : t('showControls')}
        aria-expanded={panelOpen}
        className="fixed right-5 bottom-24 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-500 active:scale-95 lg:hidden"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          {panelOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      <BusyOverlay
        open={busy !== null}
        message={busy === 'save' ? t('savingProject') : busy === 'load' ? t('loadingProject') : t('exporting')}
      />

      <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)} t={t} />

      <ConfirmModal
        open={confirmDelete}
        name="delete-screenshot"
        title={t('deleteScreenshot', { n: index + 1 })}
        body={t('deleteScreenshotBody')}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        t={t}
      />

      {/* This throws away every screenshot on every device, and the copy in storage with them.
          Nothing about a button in the panel's footer says that on its own — and the answers say
          what they do, since the button labels are what people read and the paragraph is not. */}
      <ConfirmModal
        open={confirmDeleteAll}
        name="delete-all"
        title={t('deleteAllTitle')}
        body={t('deleteAllBody')}
        rescue={{ label: t('deleteAllSave'), onSelect: handleSaveAndDeleteAll }}
        confirmLabel={t('deleteAllConfirm')}
        cancelLabel={t('cancel')}
        onConfirm={deleteEverything}
        onCancel={() => setConfirmDeleteAll(false)}
        t={t}
      />

      {/* Opening a project replaces every screenshot on every device, which is not something to
          discover afterwards. */}
      <ConfirmModal
        open={pendingProject !== null}
        name="load-project"
        title={t('loadProjectTitle')}
        body={t('loadProjectBody')}
        onConfirm={confirmLoadProject}
        onCancel={() => setPendingProject(null)}
        t={t}
      />
    </div>
  )
}
