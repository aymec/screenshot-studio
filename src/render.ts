import type { Design, DevicePreset } from './template'
import { tokenizeLines } from './text'

/** A caption line: its tokens, each tagged with the color it draws in and its own spacing. */
interface Line {
  parts: { text: string; color: string; spaceBefore: boolean }[]
}

const fontOf = (d: Design) => `${d.fontWeight} ${d.fontSize}px ${d.fontFamily}`

/**
 * Lay the sentence out into lines. Explicit newlines are honored as hard breaks (the
 * source GIMP template broke its two-line caption by hand); any hard line that
 * still overflows is greedy-wrapped to the caption's max width.
 *
 * Tokens carry their own `spaceBefore`, so Japanese and Chinese — which have word
 * boundaries but no spaces — are wrapped per word without spaces being injected.
 */
function layout(ctx: CanvasRenderingContext2D, preset: DevicePreset, design: Design): Line[] {
  const colorAt = (i: number) =>
    design.highlightIndices.includes(i) ? design.highlightColor : design.textColor

  const lines: Line[] = []
  let wordIndex = 0

  for (const tokens of tokenizeLines(design.sentence)) {
    if (tokens.length === 0) {
      lines.push({ parts: [] }) // preserve deliberate blank lines
      continue
    }

    let current: Line = { parts: [] }
    let currentText = ''

    for (const token of tokens) {
      const gap = token.spaceBefore ? ' ' : ''
      const candidate = currentText ? `${currentText}${gap}${token.text}` : token.text
      if (currentText && ctx.measureText(candidate).width > preset.caption.maxWidth) {
        lines.push(current)
        // First token of a new line never renders a leading space.
        current = { parts: [{ text: token.text, color: colorAt(wordIndex), spaceBefore: false }] }
        currentText = token.text
      } else {
        current.parts.push({
          text: token.text,
          color: colorAt(wordIndex),
          spaceBefore: token.spaceBefore && current.parts.length > 0,
        })
        currentText = candidate
      }
      wordIndex++
    }
    lines.push(current)
  }

  return lines
}

/** Width of a line, counting only the spaces the language actually uses. */
function lineWidth(ctx: CanvasRenderingContext2D, line: Line): number {
  if (line.parts.length === 0) return 0
  const space = ctx.measureText(' ').width
  return line.parts.reduce(
    (sum, p) => sum + ctx.measureText(p.text).width + (p.spaceBefore ? space : 0),
    0,
  )
}

/** The line's text as it will actually be drawn, for ink measurement. */
const lineText = (line: Line) =>
  line.parts.map((p) => (p.spaceBefore ? ' ' : '') + p.text).join('')

function drawCaption(ctx: CanvasRenderingContext2D, preset: DevicePreset, design: Design) {
  ctx.font = fontOf(design)
  ctx.textBaseline = 'alphabetic'

  const lines = layout(ctx, preset, design)
  if (lines.length === 0) return

  const spacing = design.fontSize * design.lineHeight
  const space = ctx.measureText(' ').width

  // Center the block by its real ink box, not by font metrics: this is what makes
  // the caption look optically centered in the band regardless of the font chosen.
  const first = ctx.measureText(lineText(lines[0]) || 'X')
  const last = ctx.measureText(lineText(lines[lines.length - 1]) || 'X')
  const ascent = first.actualBoundingBoxAscent
  const descent = last.actualBoundingBoxDescent

  const blockHeight = (lines.length - 1) * spacing + ascent + descent
  const band = preset.caption
  const bandHeight = band.bottom - band.top
  let baseline = band.top + (bandHeight - blockHeight) / 2 + ascent

  for (const line of lines) {
    let x = (preset.canvas.w - lineWidth(ctx, line)) / 2
    for (const part of line.parts) {
      if (part.spaceBefore) x += space
      ctx.fillStyle = part.color
      ctx.fillText(part.text, x, baseline)
      x += ctx.measureText(part.text).width
    }
    baseline += spacing
  }
}

/** Draw `img` into the rect, aspect-filling and center-cropping it (CSS object-fit: cover). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource & { width: number; height: number },
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

export interface RenderInput {
  preset: DevicePreset
  design: Design
  screenshot: HTMLImageElement | null
  frame: HTMLImageElement | null
}

/**
 * Draw the whole panel. Layer order mirrors the GIMP template: background, then
 * the screenshot (clipped to rounded corners), then the phone frame on top so its
 * bezel overlaps the screenshot, then the caption.
 */
export function render(ctx: CanvasRenderingContext2D, input: RenderInput) {
  const { preset, design, screenshot, frame } = input
  const { canvas, screen } = preset

  ctx.clearRect(0, 0, canvas.w, canvas.h)

  ctx.fillStyle = design.backgroundColor
  ctx.fillRect(0, 0, canvas.w, canvas.h)

  ctx.save()
  ctx.beginPath()
  ctx.roundRect(screen.x, screen.y, screen.w, screen.h, screen.radius)
  ctx.clip()
  if (screenshot) {
    drawCover(ctx, screenshot, screen.x, screen.y, screen.w, screen.h)
  } else {
    // Empty state: a neutral screen so the phone still reads as a phone.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.fillRect(screen.x, screen.y, screen.w, screen.h)
  }
  ctx.restore()

  if (frame) {
    ctx.drawImage(frame, preset.frame.x, preset.frame.y, preset.frame.w, preset.frame.h)
  }

  drawCaption(ctx, preset, design)
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 64)}`))
    img.src = src
  })
}

export function exportPng(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
