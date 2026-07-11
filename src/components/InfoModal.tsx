import type { TKey } from '../i18n'

interface Props {
  open: boolean
  onClose: () => void
  t: (key: TKey, params?: Record<string, string | number>) => string
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600/10 text-xs font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
        {n}
      </span>
      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        <span className="font-semibold text-slate-900 dark:text-slate-200">{title}</span> {children}
      </p>
    </li>
  )
}

export function InfoModal({ open, onClose, t }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('aboutTitle')}
      className={`fixed inset-0 z-40 flex items-center justify-center p-4 transition-opacity duration-200 ${
        open ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div
        className={`relative max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 shadow-2xl transition-transform duration-200 ${
          open ? 'scale-100' : 'scale-95'
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Screenshot Studio</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('modalTagline')}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('closeInfo')}
            className="-mt-1 -mr-1 rounded p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {t('modalIntro')}
        </p>

        <ol className="mt-5 space-y-3">
          {([1, 2, 3, 4, 5] as const).map((n) => (
            <Step key={n} n={n} title={t(`step${n}Title` as TKey)}>
              {t(`step${n}Body` as TKey)}
            </Step>
          ))}
        </ol>

        <p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {t('modalFootnote')}
        </p>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-500 active:bg-blue-700"
        >
          {t('gotIt')}
        </button>
      </div>
    </div>
  )
}
