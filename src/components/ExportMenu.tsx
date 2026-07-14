import { useEffect, useRef, useState } from 'react'

export interface ExportItem {
  id: string
  label: string
  onSelect: () => void
  disabled?: boolean
}

interface Props {
  label: string
  items: ExportItem[]
}

/**
 * The three ways out of the app — this screenshot, every screenshot, the whole project — behind one
 * button. They were three buttons stacked in the panel, which made the least-used one as loud as
 * the one people came for, and left no room for the third.
 *
 * It is a menu, not a `<select>` and not a stack of divs: `<select>` is for choosing a value, and
 * these are actions. So it carries what a menu owes a keyboard: arrows move, Enter picks, Escape
 * closes and hands focus back to the button that opened it, and a click anywhere else dismisses it.
 *
 * Items disable rather than disappear. A menu whose rows move around under the cursor between one
 * opening and the next is a menu you have to read every time.
 */
export function ExportMenu({ label, items }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const options = useRef<(HTMLButtonElement | null)[]>([])

  const enabled = items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0)

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }

  // Opening puts focus on the first item the user can actually pick, so the keyboard is usable
  // from the moment the menu appears.
  useEffect(() => {
    if (!open) return
    const first = enabled[0] ?? 0
    setActive(first)
    options.current[first]?.focus()
    // `enabled` is derived from items, which do not change while the menu is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // A click anywhere else is a dismissal, not a selection. Focus stays where the user clicked.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const move = (by: number) => {
    if (enabled.length === 0) return
    const at = enabled.indexOf(active)
    const next = enabled[(at + by + enabled.length) % enabled.length]
    setActive(next)
    options.current[next]?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        // The app closes the controls panel on Escape; from in here that is not what was meant.
        e.stopPropagation()
        close()
        break
      case 'ArrowDown':
        e.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        move(-1)
        break
      case 'Home':
        e.preventDefault()
        move(enabled[0] - active)
        break
      case 'End':
        e.preventDefault()
        move(enabled[enabled.length - 1] - active)
        break
    }
  }

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        data-export-menu
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(e) => {
          // Arrowing into a closed menu opens it, which is what a menu button does.
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setOpen(true)
          }
        }}
        // blue-700, not the blue-600 the old export button used: white on blue-600 is 3.76:1,
        // under the 4.5:1 AA threshold for text this size. It was always under it — the button
        // simply predates anyone measuring it.
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-600 active:bg-blue-800"
      >
        {label}
        {/* Decorative: the button's accessible name has to be the word the user reads on it. */}
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2 4.5L6 8.5L10 4.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          data-export-list
          aria-label={label}
          // Above the button: it sits at the bottom of the panel, and a menu dropping *down* from
          // it would open into the edge of the window.
          className="absolute bottom-full left-0 z-40 mb-2 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
        >
          {items.map((item, i) => (
            <button
              key={item.id}
              ref={(el) => {
                options.current[i] = el
              }}
              type="button"
              role="menuitem"
              data-export-item={item.id}
              disabled={item.disabled}
              tabIndex={i === active ? 0 : -1}
              onClick={() => {
                close(false)
                item.onSelect()
              }}
              className="block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus:bg-slate-100 focus:outline-none disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:bg-slate-700 dark:disabled:text-slate-500 dark:disabled:hover:bg-transparent"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
