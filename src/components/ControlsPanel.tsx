import { useEffect, useRef, useState } from 'react'
import { readableOn } from '../color'
import { FONTS, PRESETS, type Design, type DevicePreset } from '../template'
import { tokenize } from '../text'
import type { Theme } from '../theme'
import type { LoadFailure } from '../project'
import { LANGUAGES, type Lang, type TKey } from '../i18n'
import { ExportMenu } from './ExportMenu'

interface Props {
  design: Design
  preset: DevicePreset
  onDevice: (id: string) => void
  onChange: (patch: Partial<Design>) => void
  onImage: (file: File) => void
  onExport: () => void
  onExportAll: () => void
  /** False when not one screenshot on any device has an image: nothing to put in the zip. */
  canExportAll: boolean
  onSaveProject: () => void
  onLoadProject: (file: File) => void
  /** Why the last project file would not open, if one would not. */
  loadError: LoadFailure | null
  onReset: () => void
  /** The browser refused to store the project's images: the user's work is not being kept. */
  storageFull: boolean
  /** Everything in the panel edits screenshot `index` of the device's `count` screenshots. */
  count: number
  index: number
  hasImage: boolean
  imageName: string | null
  /** Only meaningful below `lg`, where the panel is a slide-over. */
  open: boolean
  onInfo: () => void
  theme: Theme
  onToggleTheme: () => void
  t: (key: TKey, params?: Record<string, string | number>) => string
  lang: Lang
  onLang: (lang: Lang) => void
  onToggleWord: (index: number) => void
}

const legend =
  'mb-1.5 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400'

const control =
  'rounded border border-slate-300 bg-white text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={legend}>{label}</span>
      {children}
    </label>
  )
}

/**
 * Same look as Field, but a plain div — for anything that is not one single control.
 *
 * A <label> forwards a click anywhere inside it, including the dead space beside the control, to
 * the first control it contains. Around a row of word chips that silently toggles the first word;
 * around a color row it pops the OS color picker; and around the file input it would open the file
 * picker twice, once from the label and once from our own click(). None of that is a click the
 * user made, so these blocks are divs and their controls carry their own accessible names.
 */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className={legend}>{label}</span>
      {children}
    </div>
  )
}

function ColorInput({
  value,
  label,
  onChange,
}: {
  value: string
  label: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-9 w-12 cursor-pointer rounded border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-800"
      />
      <input
        type="text"
        value={value}
        aria-label={`${label} (hex)`}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className={`w-28 px-2 py-1.5 font-mono text-sm ${control}`}
      />
    </div>
  )
}

/** Classic globe: a circle with an equator, a meridian, and two latitude lines. */
function GlobeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="9.5" />
      <ellipse cx="12" cy="12" rx="4" ry="9.5" />
      <path d="M2.5 12h19" />
      <path d="M4.4 6.8h15.2M4.4 17.2h15.2" />
    </svg>
  )
}

/** Language picker: a globe button that drops down the list of locales. */
function LanguageMenu({
  lang,
  onLang,
  t,
}: {
  lang: Lang
  onLang: (lang: Lang) => void
  t: (key: TKey) => string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = LANGUAGES.find((l) => l.code === lang)

  // Dismiss on an outside click or Escape, like any menu.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        data-language-button
        onClick={() => setOpen((o) => !o)}
        // The accessible name must contain the visible text (WCAG 2.5.3), so speech-input
        // users can say what they see: "Language: English", not just "Language".
        aria-label={current ? `${t('language')}: ${current.label}` : t('language')}
        aria-haspopup="menu"
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        <GlobeIcon />
        {current?.label ?? t('language')}
      </button>

      {/* Right-anchored: the globe sits near the panel's edge, so a left-anchored menu
          would hang off it. */}
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-1.5 max-h-72 w-44 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800"
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              role="menuitemradio"
              aria-checked={l.code === lang}
              data-lang={l.code}
              onClick={() => {
                onLang(l.code)
                setOpen(false)
              }}
              className={`block w-full px-3 py-1.5 text-left text-sm transition ${
                l.code === lang
                  ? 'font-semibold text-blue-700 dark:text-blue-300'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Small icon+label button used for the info and theme controls under the title. */
function HeaderButton({
  onClick,
  label,
  ariaLabel,
  children,
}: {
  onClick: () => void
  label: string
  ariaLabel?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      {children}
      {label}
    </button>
  )
}

export function ControlsPanel({
  design,
  preset,
  onDevice,
  onChange,
  onImage,
  onExport,
  onExportAll,
  canExportAll,
  onSaveProject,
  onLoadProject,
  loadError,
  onReset,
  storageFull,
  count,
  index,
  hasImage,
  imageName,
  open,
  onInfo,
  theme,
  onToggleTheme,
  t,
  lang,
  onLang,
  onToggleWord,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const projectInput = useRef<HTMLInputElement>(null)
  const wordList = tokenize(design.sentence).map((tok) => tok.text)
  const size = `${preset.canvas.w} × ${preset.canvas.h}`

  const pickFile = (files: FileList | null) => {
    const file = files?.[0]
    if (file && file.type.startsWith('image/')) onImage(file)
  }

  return (
    <aside
      className={`fixed inset-y-0 right-0 z-20 flex w-[min(22.5rem,88vw)] flex-col gap-5 overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl transition-transform duration-300 ease-out lg:static lg:z-auto lg:w-90 lg:shrink-0 lg:translate-x-0 lg:shadow-none dark:border-slate-800 dark:bg-slate-900 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Screenshot Studio</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('brandSubtitle', { store: preset.store, size })}
        </p>

        {/* Info + theme, directly under the title. */}
        <div className="mt-3 flex flex-wrap gap-2">
          <HeaderButton onClick={onInfo} label={t('about')} ariaLabel={t('aboutTitle')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9.5" />
              <path d="M12 11v5.5" />
              <path d="M12 7.4v.2" strokeWidth="2.6" />
            </svg>
          </HeaderButton>

          <HeaderButton
            onClick={onToggleTheme}
            label={theme === 'dark' ? t('light') : t('dark')}
            ariaLabel={theme === 'dark' ? t('switchToLight') : t('switchToDark')}
          >
            {theme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="4.5" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />
              </svg>
            )}
          </HeaderButton>

          <LanguageMenu lang={lang} onLang={onLang} t={t} />
        </div>
      </div>

      {/* First control in the panel: the device decides the canvas everything else is laid
          out against, so it is the choice that comes before the rest of the design. */}
      <Field label={t('device')}>
        <select
          data-device-select
          value={preset.id}
          onChange={(e) => onDevice(e.target.value)}
          className={`w-full px-2 py-1.5 text-sm ${control}`}
        >
          {[...new Set(PRESETS.map((p) => p.store))].map((store) => (
            <optgroup key={store} label={store}>
              {PRESETS.filter((p) => p.store === store).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {p.canvas.w} × {p.canvas.h}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      {/* Every control below this point edits the selected screenshot, so the panel names it. */}
      <Section label={count > 1 ? t('screenshotN', { n: index + 1 }) : t('screenshot')}>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            pickFile(e.dataTransfer.files)
          }}
          className="cursor-pointer rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-5 text-center transition hover:border-blue-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800"
        >
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {hasImage ? t('replaceImage') : t('dropImage')}
          </p>
          {imageName && (
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{imageName}</p>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          // Clearing the value is what lets the same file be picked twice — putting one capture
          // on two screenshots is ordinary here. Without it the second pick leaves the input's
          // value untouched, no change event fires, and the click appears to do nothing.
          onChange={(e) => {
            pickFile(e.target.files)
            e.target.value = ''
          }}
        />
      </Section>

      <Field label={t('caption')}>
        <textarea
          value={design.sentence}
          onChange={(e) => onChange({ sentence: e.target.value })}
          rows={2}
          className={`w-full resize-none px-3 py-2 text-sm ${control}`}
        />
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
          {t('captionHint')}
        </span>
      </Field>

      <Section label={t('highlightedWords')}>
        <div className="flex flex-wrap gap-1.5">
          {wordList.length === 0 && (
            <span className="text-sm text-slate-500 dark:text-slate-400">{t('noWords')}</span>
          )}
          {wordList.map((word, i) => {
            const on = design.highlightIndices.includes(i)
            return (
              <button
                key={`${word}-${i}`}
                data-word-chip
                onClick={() => onToggleWord(i)}
                style={
                  on
                    ? {
                        backgroundColor: design.highlightColor,
                        color: readableOn(design.highlightColor),
                      }
                    : undefined
                }
                className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                  on
                    ? ''
                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {word}
              </button>
            )
          })}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-4">
        <Section label={t('backgroundColor')}>
          <ColorInput
            value={design.backgroundColor}
            label={t('backgroundColor')}
            onChange={(v) => onChange({ backgroundColor: v })}
          />
        </Section>
        <Section label={t('highlightColor')}>
          <ColorInput
            value={design.highlightColor}
            label={t('highlightColor')}
            onChange={(v) => onChange({ highlightColor: v })}
          />
        </Section>
        <Section label={t('textColor')}>
          <ColorInput
            value={design.textColor}
            label={t('textColor')}
            onChange={(v) => onChange({ textColor: v })}
          />
        </Section>
      </div>

      <Field label={t('font')}>
        <select
          value={design.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          className={`w-full px-2 py-1.5 text-sm ${control}`}
        >
          {FONTS.map((f) => (
            <option key={f.id} value={f.stack}>
              {f.id === 'system' ? t('fontSystem') : f.id === 'inter' ? t('fontInter') : f.label}
            </option>
          ))}
        </select>
      </Field>


      <Field label={t('size', { value: design.fontSize })}>
        <input
          type="range"
          min={40}
          max={220}
          value={design.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          className="w-full accent-blue-600"
        />
      </Field>

      <Field label={t('weight', { value: design.fontWeight })}>
        <input
          type="range"
          min={400}
          max={800}
          step={100}
          value={design.fontWeight}
          onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}
          className="w-full accent-blue-600"
        />
      </Field>

      <Field label={t('lineHeight', { value: design.lineHeight.toFixed(2) })}>
        <input
          type="range"
          min={0.9}
          max={2}
          step={0.01}
          value={design.lineHeight}
          onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
          className="w-full accent-blue-600"
        />
      </Field>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        {/* Silence here would be a lie: the user would go on editing a project the browser is no
            longer keeping, and only find out on the reload that loses it. */}
        {storageFull && (
          <p
            role="status"
            data-storage-full
            className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            {t('storageFull')}
          </p>
        )}
        {/* A file that would not open, said where the user asked for it. The work in progress is
            untouched, so this is a dead end and not a state to get out of. */}
        {loadError && (
          <p
            role="alert"
            data-load-error
            className="rounded-lg bg-rose-100 px-3 py-2 text-xs font-medium text-rose-900 dark:bg-rose-950 dark:text-rose-200"
          >
            {t(
              loadError === 'too-new'
                ? 'loadErrorTooNew'
                : loadError === 'not-a-project'
                  ? 'loadErrorNotAProject'
                  : 'loadErrorUnreadable',
            )}
          </p>
        )}

        <ExportMenu
          label={t('export')}
          items={[
            {
              id: 'one',
              label: t('exportThis'),
              onSelect: onExport,
              // An empty frame is not a screenshot anyone uploads.
              disabled: !hasImage,
            },
            {
              id: 'all',
              label: t('exportAll'),
              onSelect: onExportAll,
              disabled: !canExportAll,
            },
            {
              id: 'project',
              // Always available: a project with no images in it yet is still captions, colors,
              // and type the user does not want to lose.
              label: t('saveProject'),
              onSelect: onSaveProject,
            },
          ]}
        />

        {/* Load is not in the export menu. It is not an export, and it replaces everything on
            every device — an action like that does not belong behind a caret next to three that
            only ever hand you a file. */}
        <button
          data-load-project
          onClick={() => projectInput.current?.click()}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {t('loadProject')}
        </button>
        <input
          ref={projectInput}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onLoadProject(file)
            // Clear it, or picking the same project twice fires no change event at all.
            e.target.value = ''
          }}
        />

        <button
          onClick={onReset}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          {t('reset')}
        </button>
      </div>
    </aside>
  )
}
