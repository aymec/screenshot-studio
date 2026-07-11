/**
 * Exercises the editor controls against the running dev server and asserts the
 * canvas actually reacts: image upload, background color, highlight color, word
 * toggling, caption edits, and the PNG export path.
 *
 * Usage: npm run dev  (in one shell)
 *        node scripts/verify-ui.mjs
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync, copyFileSync, existsSync } from 'node:fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// Provision our own fixture: `prebuild` deletes public/__parity so test images never ship,
// which means we cannot assume a previous script left it behind.
const SOURCE = 'public/__parity/source.png'
if (!existsSync(SOURCE)) {
  mkdirSync('public/__parity', { recursive: true })
  copyFileSync('/Users/aymc/projects/habit-tracker/assets/screenshots/ios_en_1_home.PNG', SOURCE)
}
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 1500, height: 950 },
})
const page = await browser.newPage()

const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle0' })

const pixel = (x, y) =>
  page.evaluate(
    ([x, y]) => {
      const d = document.querySelector('canvas').getContext('2d').getImageData(x, y, 1, 1).data
      return `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`
    },
    [x, y],
  )


// Count pixels of a color in the caption band (above the phone). Wording-independent, so
// changing the default caption can't silently invalidate these checks.
const bandCount = (hex) =>
  page.evaluate((hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    const c = document.querySelector('canvas')
    const d = c.getContext('2d').getImageData(0, 0, c.width, 483).data
    let n = 0
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - r) < 20 && Math.abs(d[i + 1] - g) < 20 && Math.abs(d[i + 2] - b) < 20) n++
    }
    return n
  }, hex)

const checks = []
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

// 1. Default template renders: background + highlighted caption.
check('default background is #001027', (await pixel(5, 5)) === '#001027', await pixel(5, 5))
const highlightPx = await bandCount('#007AFF')
check('caption highlight is drawn', highlightPx > 500, `${highlightPx} highlight px in the caption band`)
const whitePx = await bandCount('#FFFFFF')
check('caption plain text is drawn', whitePx > 500, `${whitePx} white px in the caption band`)

// 2. Image upload lands inside the phone screen.
const before = await pixel(620, 1500)
await (await page.$('input[type=file]')).uploadFile('public/__parity/source.png')
// Wait for real image pixels: the empty-state placeholder is already != background,
// so "not the background color" would be true before the upload even lands.
await page.waitForFunction(
  () => {
    const d = document.querySelector('canvas').getContext('2d').getImageData(620, 1500, 1, 1).data
    return d[0] > 200 && d[1] > 200 && d[2] > 200
  },
  { timeout: 10000 },
)
check('uploaded screenshot appears in frame', (await pixel(620, 1500)) !== before, `${before} -> ${await pixel(620, 1500)}`)

// 2b. One click on the dropzone must activate the file input exactly once (a <label>
//     wrapper used to forward the click and open the OS picker twice).
await page.evaluate(() => {
  window.__opens = 0
  const input = document.querySelector('input[type=file]')
  input.addEventListener('click', (e) => {
    window.__opens++
    e.preventDefault() // don't open a real OS picker during the test
  })
})
await page.click('div[class*="border-dashed"]')
await new Promise((r) => setTimeout(r, 200))
const opens = await page.evaluate(() => window.__opens)
check('file picker opens exactly once per click', opens === 1, `opened ${opens}x`)

// 2c. The screenshot's rounded corners must stay hidden behind the bezel: no pixel may
//     differ from the background where the frame PNG is fully transparent (outside the phone).
const leaks = await page.evaluate(async () => {
  const canvas = document.querySelector('canvas')
  const img = new Image()
  img.src = '/src/assets/iphone-frame.png'
  await img.decode()

  const fc = document.createElement('canvas')
  fc.width = canvas.width
  fc.height = canvas.height
  // Composite the frame exactly where the renderer puts it.
  fc.getContext('2d').drawImage(img, 78, 483, 1087, 2189)

  const F = fc.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
  const C = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data

  // The frame is transparent in two places: outside the phone body, and the screen aperture
  // (where the screenshot is *supposed* to show). Flood-fill inward from the canvas border
  // through transparent pixels — whatever it reaches is "outside the phone".
  const { width: w, height: h } = canvas
  const outside = new Uint8Array(w * h)
  const stack = []
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const p = y * w + x
    if (outside[p] || F[p * 4 + 3] !== 0) return
    outside[p] = 1
    stack.push(p)
  }
  for (let x = 0; x < w; x++) {
    push(x, 0)
    push(x, h - 1)
  }
  for (let y = 0; y < h; y++) {
    push(0, y)
    push(w - 1, y)
  }
  while (stack.length) {
    const p = stack.pop()
    const x = p % w
    const y = (p / w) | 0
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }

  // A leak = anything other than the background outside the phone body. Restricted to the
  // phone's vertical span so the caption (which also sits over transparent frame) isn't counted.
  let leaked = 0
  for (let y = 546; y < 2600; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      if (!outside[p]) continue
      const i = p * 4
      const isBg = C[i] === 0 && C[i + 1] === 16 && C[i + 2] === 39
      if (!isBg) leaked++
    }
  }
  return leaked
})
check('screenshot corners stay behind the frame', leaks === 0, `${leaks} px outside the phone body`)

// 3. Background color control.
await page.evaluate(() => {
  const input = [...document.querySelectorAll('input[type=text]')].find((i) =>
    i.value.startsWith('#00'),
  )
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, '#7B2D8E')
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
await new Promise((r) => setTimeout(r, 300))
check('background color control repaints canvas', (await pixel(5, 5)) === '#7b2d8e', await pixel(5, 5))

// 4. Word chips toggle the highlight.
const chips = await page.$$('[data-word-chip]')
await chips[0].click() // the highlighted word -> off
await new Promise((r) => setTimeout(r, 300))
const afterOff = await bandCount('#007AFF')
check('toggling the word off removes the highlight entirely', afterOff === 0, `${afterOff} highlight px left`)

await chips[1].click() // a different word -> on
await new Promise((r) => setTimeout(r, 300))
const afterOn = await bandCount('#007AFF')
check('toggling another word on re-applies the highlight', afterOn > 500, `${afterOn} highlight px`)

// 5. Caption edit re-wraps.
await page.evaluate(() => {
  const ta = document.querySelector('textarea')
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
  setter.call(ta, 'Track every\nsingle habit')
  ta.dispatchEvent(new Event('input', { bubbles: true }))
})
await new Promise((r) => setTimeout(r, 300))
const words = await page.$$eval('[data-word-chip]', (bs) =>
  bs.map((b) => b.textContent).filter((t) => !t.includes('Export') && !t.includes('Reset')),
)
check('caption edit refreshes word chips', words.join(' ') === 'Track every single habit', words.join(' '))

// 6. Export produces a real 1242x2688 PNG.
const png = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'))
const bytes = Buffer.from(png.split(',')[1], 'base64')
const w = bytes.readUInt32BE(16)
const h = bytes.readUInt32BE(20)
check('export is a 1242x2688 PNG', w === 1242 && h === 2688, `${w}x${h}, ${(bytes.length / 1024).toFixed(0)}KB`)

// 7. Design persists across reload.
await page.reload({ waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 500))
check('design persists across reload', (await pixel(5, 5)) === '#7b2d8e', await pixel(5, 5))

check('no console errors', errors.length === 0, errors.join(' | ') || 'clean')

await page.screenshot({ path: '/tmp/studio-ui.png' })
console.log('\nUI screenshot: /tmp/studio-ui.png')

await browser.close()
const failed = checks.filter((c) => !c.pass).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
