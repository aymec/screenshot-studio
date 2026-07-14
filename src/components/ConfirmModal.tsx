import type { TKey } from '../i18n'

interface Props {
  open: boolean
  /**
   * Which confirmation this is. Several of them are mounted at once — they fade rather than
   * unmount — so "the yes button" is ambiguous without it, to a test and to anything else
   * reaching into the page.
   */
  name: string
  /** What is about to be destroyed, spelled out — "Delete screenshot 3?" beats "Are you sure?". */
  title: string
  body: string
  onConfirm: () => void
  onCancel: () => void
  /**
   * The way out that keeps the work: "Save project and delete". It is the whole outcome in one
   * tap, not a detour — a dialog that tells you to go and save first, having already interrupted
   * you, is a dead end you have to cancel out of.
   *
   * Given one, the buttons stack and this one leads: of the two that destroy something, it is the
   * one that leaves the user a copy.
   */
  rescue?: { label: string; onSelect: () => void }
  /** Overrides for the two default answers, where "yes" and "no" do not say enough. */
  confirmLabel?: string
  cancelLabel?: string
  t: (key: TKey, params?: Record<string, string | number>) => string
}

const destructive =
  'w-full rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white transition hover:bg-red-500 active:bg-red-700'
// blue-700: white on blue-600 is 3.76:1, under the 4.5:1 AA floor for text this size.
const primary =
  'w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-600 active:bg-blue-800'
const quiet =
  'w-full rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

/** Yes/no gate in front of anything that throws work away. */
export function ConfirmModal({
  open,
  name,
  title,
  body,
  onConfirm,
  onCancel,
  rescue,
  confirmLabel,
  cancelLabel,
  t,
}: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-confirm={name}
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

        {/* Two answers sit side by side; three read as a list of outcomes, and the labels are too
            long to share a line anyway. */}
        <div className={`mt-5 flex gap-2 ${rescue ? 'flex-col' : ''}`}>
          {rescue && (
            <button data-confirm-save onClick={rescue.onSelect} className={primary}>
              {rescue.label}
            </button>
          )}
          {/* The destructive answer is the one that carries the warning color. */}
          <button data-confirm-yes onClick={onConfirm} className={destructive}>
            {confirmLabel ?? t('yes')}
          </button>
          <button data-confirm-no onClick={onCancel} className={quiet}>
            {cancelLabel ?? t('no')}
          </button>
        </div>
      </div>
    </div>
  )
}
