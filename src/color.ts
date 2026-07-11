/** WCAG relative luminance of a #rrggbb color. */
function luminance(hex: string): number {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim())
  if (!m) return 0
  const n = parseInt(m[1], 16)
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  )
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/**
 * Black or white — whichever reads better on `background`.
 *
 * The highlight color is user-chosen, so a fixed label color can't stay legible: white on
 * the default #007AFF is only 4.0:1, below the 4.5:1 WCAG AA minimum for body text.
 */
export function readableOn(background: string): string {
  const bg = luminance(background)
  return contrast(bg, 1) >= contrast(bg, 0) ? '#FFFFFF' : '#0A0F1C'
}
