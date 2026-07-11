import { useCallback, useEffect, useRef, useState } from 'react'
import { ControlsPanel } from './components/ControlsPanel'
import { InfoModal } from './components/InfoModal'
import { exportPng, loadImage, render } from './render'
import { DEFAULT_DESIGN, IPHONE_65, type Design } from './template'
import { useTheme } from './theme'
import { useI18n } from './i18n'

const STORAGE_KEY = 'screenshot-studio:design'

function loadDesign(): Design {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_DESIGN, ...(JSON.parse(raw) as Partial<Design>) }
  } catch {
    // Corrupt or unavailable storage: fall back to the template defaults.
  }
  return DEFAULT_DESIGN
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40) || 'screenshot'

export default function App() {
  const preset = IPHONE_65
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [design, setDesign] = useState<Design>(loadDesign)
  const [screenshot, setScreenshot] = useState<HTMLImageElement | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)
  const [frame, setFrame] = useState<HTMLImageElement | null>(null)
  const [fontsReady, setFontsReady] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const { lang, setLang, t } = useI18n()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setPanelOpen(false)
      setInfoOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    loadImage(preset.frame.src).then(setFrame).catch(console.error)
  }, [preset.frame.src])

  // The first paint must wait for the webfont, or the caption measures and draws
  // in a fallback face and the layout shifts once Inter arrives.
  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true))
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(design))
  }, [design])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !fontsReady) return
    render(ctx, { preset, design, screenshot, frame })
  }, [preset, design, screenshot, frame, fontsReady])

  const patch = useCallback((p: Partial<Design>) => setDesign((d) => ({ ...d, ...p })), [])

  // Must be a functional update: computing the next list from the `design` in a closure
  // would make two toggles in the same tick collapse into one.
  const toggleWord = useCallback((i: number) => {
    setDesign((d) => ({
      ...d,
      highlightIndices: d.highlightIndices.includes(i)
        ? d.highlightIndices.filter((n) => n !== i)
        : [...d.highlightIndices, i],
    }))
  }, [])

  const handleImage = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = async () => {
      const img = await loadImage(reader.result as string)
      setScreenshot(img)
      setImageName(file.name)
    }
    reader.readAsDataURL(file)
  }, [])

  const handleExport = useCallback(() => {
    if (canvasRef.current) exportPng(canvasRef.current, `${slug(design.sentence)}.png`)
  }, [design.sentence])

  const handleReset = useCallback(() => setDesign(DEFAULT_DESIGN), [])

  return (
    <div className="flex h-full bg-slate-100 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* The preview is always on screen and takes all the space it can; the FAB floats over it.
          Below `lg` the panel slides over it from the right. */}
      <main className="flex flex-1 items-center justify-center overflow-hidden p-3 lg:p-8">
        {/* Intrinsic size is the true export size; CSS max-* scales it down for preview. */}
        <canvas
          ref={canvasRef}
          width={preset.canvas.w}
          height={preset.canvas.h}
          className="max-h-full max-w-full rounded-lg shadow-2xl ring-1 ring-slate-300 dark:ring-slate-800"
          style={{ width: 'auto', height: 'auto' }}
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
        onChange={patch}
        onImage={handleImage}
        onExport={handleExport}
        onReset={handleReset}
        hasImage={!!screenshot}
        imageName={imageName}
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
          its last control can scroll clear of this button. */}
      <button
        onClick={() => setPanelOpen((o) => !o)}
        aria-label={panelOpen ? t('closeControls') : t('showControls')}
        aria-expanded={panelOpen}
        className="fixed right-5 bottom-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-500 active:scale-95 lg:hidden"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          {panelOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      <InfoModal open={infoOpen} onClose={() => setInfoOpen(false)} t={t} />
    </div>
  )
}
