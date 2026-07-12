import { readableOn } from '../color'
import { MAX_SCREENSHOTS } from '../template'
import type { TKey } from '../i18n'

interface Props {
  count: number
  index: number
  /** The selected chip is filled with the current screenshot's own highlight color. */
  highlightColor: string
  onSelect: (index: number) => void
  onAdd: () => void
  onDelete: () => void
  t: (key: TKey, params?: Record<string, string | number>) => string
}

/**
 * Sizes shrink with the viewport rather than wrapping or overflowing, so the whole strip stays on
 * one line down to the narrowest phone. The clamp maxima are the sizes on any normal screen — 36px
 * chips, 44px arrows — and the vw term only ever pulls them below that.
 */
const CHIP_SIZE = 'h-[clamp(1.75rem,10vw,2.25rem)] w-[clamp(1.75rem,10vw,2.25rem)]'
const ARROW_SIZE = 'h-[clamp(2.25rem,12vw,2.75rem)] w-[clamp(2.25rem,12vw,2.75rem)]'

const round = 'flex shrink-0 items-center justify-center rounded-full font-semibold transition'

const idle =
  'bg-slate-200 text-slate-700 hover:bg-slate-300 hover:text-slate-900 active:scale-95 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'

/** At the ends of the deck the arrow stays put, greyed and inert, rather than jumping away. */
const spent = 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-600'

/**
 * Each chip is laid out inside a box as tall as an arrow, which is what lets the selected chip
 * align to the arrows' top edge and the rest to their centerline at any size — the offset between
 * the two is half the size difference, and the clamp above means that difference is not a constant.
 */
const LANE = 'h-[clamp(2.25rem,12vw,2.75rem)]'

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}

/**
 * Which chips a narrow screen shows: the selected screenshot with one either side, and — at the
 * ends of the deck, where there is no neighbor on one side — the three at that end. The count is
 * constant on purpose, so the row does not change width as the user pages through it.
 */
function narrowWindow(index: number, count: number): (i: number) => boolean {
  const start = Math.min(Math.max(index - 1, 0), Math.max(count - 3, 0))
  return (i) => i >= start && i <= start + 2
}

export function ScreenshotStrip({ count, index, highlightColor, onSelect, onAdd, onDelete, t }: Props) {
  const inWindow = narrowWindow(index, count)

  const arrow = (dir: 'left' | 'right') => {
    const to = dir === 'left' ? index - 1 : index + 1
    const live = to >= 0 && to < count
    return (
      <button
        data-strip-prev={dir === 'left' ? '' : undefined}
        data-strip-next={dir === 'right' ? '' : undefined}
        onClick={() => live && onSelect(to)}
        disabled={!live}
        aria-label={t(dir === 'left' ? 'previousScreenshot' : 'nextScreenshot')}
        className={`${round} ${ARROW_SIZE} ${live ? idle : spent}`}
      >
        <Chevron dir={dir} />
      </button>
    )
  }

  return (
    // The bottom padding is the room the delete chip hangs into: it is positioned out of flow,
    // so without it the strip would end above it and the chip would sit over whatever is below.
    <nav
      aria-label={t('screenshots')}
      className="flex shrink-0 items-center justify-center gap-[clamp(0.25rem,1.5vw,0.5rem)] pb-5"
    >
      {arrow('left')}

      {Array.from({ length: count }, (_, i) => {
        const on = i === index
        return (
          <div
            key={i}
            // The selected chip rides at the arrows' top edge, the rest on their centerline.
            // Hiding out-of-window chips in CSS keeps this a pure layout concern: the deck itself
            // does not know how wide the screen is.
            className={`${LANE} ${on ? 'items-start' : 'items-center'} ${
              inWindow(i) ? 'flex' : 'hidden sm:flex'
            }`}
          >
            {/* Shrink-wraps the chip, so the delete chip hangs from the chip itself and rides up
                with it — the gap between the two is the same wherever the chip sits. */}
            <div className="relative">
              <button
                data-strip-chip
                onClick={() => onSelect(i)}
                // The visible text is the number, so the accessible name has to contain it
                // (WCAG 2.5.3): "Screenshot 3", never a bare "Screenshot".
                aria-label={t('screenshotN', { n: i + 1 })}
                aria-current={on ? 'true' : undefined}
                style={on ? { backgroundColor: highlightColor, color: readableOn(highlightColor) } : undefined}
                className={`${round} ${CHIP_SIZE} text-[0.8125rem] ${on ? '' : idle}`}
              >
                {i + 1}
              </button>

              {/* Deleting the last screenshot would leave the device with no panel to render, and
                  that is what Reset is for — so the chip only appears once there is a set. */}
              {on && count > 1 && (
                <button
                  data-strip-delete
                  onClick={onDelete}
                  aria-label={t('deleteScreenshot', { n: i + 1 })}
                  className="absolute top-[calc(100%+0.25rem)] left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-500 active:scale-95"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )
      })}

      {/* Sits after the last chip, and goes away once the deck is full. It stays visible on a
          narrow screen even though the chips around it window out: it is the only way to add a
          screenshot, so hiding it would strand phone users on the one they started with. */}
      {count < MAX_SCREENSHOTS && (
        <button
          data-strip-add
          onClick={onAdd}
          aria-label={t('addScreenshot')}
          className={`${round} ${CHIP_SIZE} ${idle}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {arrow('right')}
    </nav>
  )
}
