/**
 * Regenerates tests/fixtures/sample-screenshot.png — a synthetic, generic phone screenshot
 * used by the verification scripts. It is drawn from scratch (no real app's UI), so the
 * repo ships no third-party screenshots.
 *
 * The size matches a real iPhone capture (1206 x 2622) so the cover-fit path is exercised
 * the same way a genuine screenshot would exercise it.
 *
 * Usage: node scripts/gen-fixture.mjs
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync, writeFileSync } from 'node:fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()

const dataUrl = await page.evaluate(() => {
  const W = 1206
  const H = 2622
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const x = c.getContext('2d')

  const round = (px, py, w, h, r) => {
    x.beginPath()
    x.roundRect(px, py, w, h, r)
  }

  // Page background.
  x.fillStyle = '#F1F2F6'
  x.fillRect(0, 0, W, H)

  // Status bar + nav bar.
  x.fillStyle = '#FFFFFF'
  x.fillRect(0, 0, W, 300)
  x.fillStyle = '#111827'
  x.font = '600 46px system-ui, sans-serif'
  x.textBaseline = 'middle'
  x.fillText('9:41', 90, 110)
  x.font = '700 56px system-ui, sans-serif'
  x.textAlign = 'center'
  x.fillText('Dashboard', W / 2, 235)
  x.textAlign = 'left'

  // Dynamic Island.
  x.fillStyle = '#000000'
  round(W / 2 - 125, 60, 250, 90, 45)
  x.fill()

  // Cards with progress rings.
  const cards = [
    { label: 'Activity', value: 0.8, text: '8 / 10' },
    { label: 'Focus', value: 1, text: '5 / 5' },
    { label: 'Reading', value: 0.15, text: '3 / 20' },
  ]
  let cy = 380
  for (const card of cards) {
    x.fillStyle = '#FFFFFF'
    x.shadowColor = 'rgba(15, 23, 42, 0.08)'
    x.shadowBlur = 30
    x.shadowOffsetY = 8
    round(70, cy, W - 140, 420, 40)
    x.fill()
    x.shadowColor = 'transparent'
    x.shadowBlur = 0
    x.shadowOffsetY = 0

    x.fillStyle = '#111827'
    x.font = '600 48px system-ui, sans-serif'
    x.fillText(card.label, 130, cy + 80)

    // Ring.
    const rx = W - 250
    const ry = cy + 210
    x.lineWidth = 26
    x.strokeStyle = '#E5E7EB'
    x.beginPath()
    x.arc(rx, ry, 105, 0, Math.PI * 2)
    x.stroke()
    x.strokeStyle = '#0A84FF'
    x.lineCap = 'round'
    x.beginPath()
    x.arc(rx, ry, 105, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * card.value)
    x.stroke()

    x.fillStyle = '#111827'
    x.font = '600 42px system-ui, sans-serif'
    x.textAlign = 'center'
    x.fillText(card.text, rx, ry)
    x.textAlign = 'left'

    cy += 470
  }

  // Primary button.
  x.fillStyle = '#0A84FF'
  round(90, H - 480, W - 180, 130, 30)
  x.fill()
  x.fillStyle = '#FFFFFF'
  x.font = '700 50px system-ui, sans-serif'
  x.textAlign = 'center'
  x.fillText('Add Entry', W / 2, H - 413)

  // Tab bar.
  x.fillStyle = '#FFFFFF'
  x.fillRect(0, H - 260, W, 260)
  x.fillStyle = '#0A84FF'
  x.font = '600 38px system-ui, sans-serif'
  x.fillText('Home', W / 2 - 200, H - 160)
  x.fillStyle = '#9CA3AF'
  x.fillText('Settings', W / 2 + 200, H - 160)

  // Home indicator.
  x.fillStyle = '#111827'
  round(W / 2 - 140, H - 60, 280, 14, 7)
  x.fill()

  return c.toDataURL('image/png')
})

mkdirSync('tests/fixtures', { recursive: true })
writeFileSync('tests/fixtures/sample-screenshot.png', Buffer.from(dataUrl.split(',')[1], 'base64'))
console.log('wrote tests/fixtures/sample-screenshot.png')

await browser.close()
