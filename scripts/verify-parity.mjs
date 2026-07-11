/**
 * Parity check: rebuild the original GIMP-made panel in the app and diff it
 * against the known-good reference export.
 *
 * Drives the running dev server in headless Chrome, uploads the same source
 * screenshot the GIMP template used, then compares the app's canvas against
 * assets/reference.png pixel by pixel — plus the ink bounding boxes of the
 * highlighted and plain words, which is what actually catches font/geometry drift.
 *
 * Usage: npm run dev  (in one shell)
 *        node scripts/verify-parity.mjs
 */
import puppeteer from 'puppeteer-core'
import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = 'http://localhost:5173/'
const HABIT = '/Users/aymc/projects/habit-tracker/assets/screenshots'

// Serve the reference + source through Vite so the page can read their pixels.
mkdirSync('public/__parity', { recursive: true })
copyFileSync(`${HABIT}/OnTrack_EN_iPhone_1.png`, 'public/__parity/reference.png')
copyFileSync(`${HABIT}/ios_en_1_home.PNG`, 'public/__parity/source.png')

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
page.on('console', (m) => m.type() === 'error' && console.error('  [console]', m.text()))
page.on('pageerror', (e) => console.error('  [pageerror]', e.message))

await page.goto(URL, { waitUntil: 'networkidle0' })

// Recreate the original OnTrack panel explicitly. The app's default caption is a neutral
// placeholder now, so this can no longer lean on DEFAULT_DESIGN.
const ONTRACK = {
  backgroundColor: '#001027',
  sentence: 'OnTrack\nHabit Tracker',
  highlightIndices: [0],
  highlightColor: '#007AFF',
  textColor: '#FFFFFF',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 119,
  fontWeight: 800,
  lineHeight: 1.32,
}
await page.evaluate((design) => {
  localStorage.clear()
  localStorage.setItem('screenshot-studio:design', JSON.stringify(design))
}, ONTRACK)
await page.reload({ waitUntil: 'networkidle0' })

const input = await page.$('input[type=file]')
await input.uploadFile('public/__parity/source.png')
await page.waitForFunction(() => {
  const c = document.querySelector('canvas')
  if (!c) return false
  // The screenshot has landed once the middle of the phone screen is no longer the flat background.
  const d = c.getContext('2d').getImageData(620, 1500, 1, 1).data
  return !(d[0] === 0 && d[1] === 16 && d[2] === 39)
}, { timeout: 10000 })

const result = await page.evaluate(async () => {
  const canvas = document.querySelector('canvas')
  const ref = new Image()
  ref.src = '/__parity/reference.png'
  await ref.decode()

  const rc = document.createElement('canvas')
  rc.width = ref.width
  rc.height = ref.height
  rc.getContext('2d').drawImage(ref, 0, 0)

  const A = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
  const B = rc.getContext('2d').getImageData(0, 0, rc.width, rc.height).data
  const { width: w, height: h } = canvas

  let diffPixels = 0
  let totalDelta = 0
  for (let i = 0; i < A.length; i += 4) {
    const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])
    totalDelta += d
    if (d > 24) diffPixels++
  }

  // Ink bounding boxes of the caption words, in both images.
  const bbox = (data, target, tol, y1) => {
    let minx = 1e9, maxx = -1, miny = 1e9, maxy = -1
    for (let y = 0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        if (
          Math.abs(data[i] - target[0]) < tol &&
          Math.abs(data[i + 1] - target[1]) < tol &&
          Math.abs(data[i + 2] - target[2]) < tol
        ) {
          if (x < minx) minx = x
          if (x > maxx) maxx = x
          if (y < miny) miny = y
          if (y > maxy) maxy = y
        }
      }
    }
    return { x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1 }
  }

  const BLUE = [0, 122, 255]
  const WHITE = [255, 255, 255]
  return {
    size: `${w}x${h}`,
    refSize: `${ref.width}x${ref.height}`,
    diffPixels,
    diffPercent: ((diffPixels / (w * h)) * 100).toFixed(2),
    meanDelta: (totalDelta / (w * h)).toFixed(2),
    highlight: { ours: bbox(A, BLUE, 40, 483), ref: bbox(B, BLUE, 40, 483) },
    plain: { ours: bbox(A, WHITE, 20, 483), ref: bbox(B, WHITE, 20, 483) },
    png: canvas.toDataURL('image/png'),
  }
})

const { png, ...metrics } = result
console.log(JSON.stringify(metrics, null, 2))
writeFileSync('/tmp/parity-export.png', Buffer.from(png.split(',')[1], 'base64'))
console.log('\nExport written to /tmp/parity-export.png')

await browser.close()
