import type { TKey } from '../i18n'

interface Props {
  open: boolean
  /** What is about to be destroyed, spelled out — "Delete screenshot 3?" beats "Are you sure?". */
  title: string
  body: string
  onConfirm: () => void
  onCancel: () => void
  t: (key: TKey, params?: Record<string, string | number>) => string
}

/** Yes/no gate in front of anything that throws work away. */
export function ConfirmModal({ open, title, body, onConfirm, onCancel, t }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-confirm
      className={`fixed inset-0 z-40 flex items-center justify-center p-4 transition-opacity duration-200 ${
        open ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />

      <div
        className={`relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 ${
          open ? 'scale-100' : 'scale-95'
        }`}
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{body}</p>

        <div className="mt-5 flex gap-2">
          {/* The destructive answer is the one that carries the warning color. */}
          <button
            data-confirm-yes
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white transition hover:bg-red-500 active:bg-red-700"
          >
            {t('yes')}
          </button>
          <button
            data-confirm-no
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t('no')}
          </button>
        </div>
      </div>
    </div>
  )
}
