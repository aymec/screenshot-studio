/**
 * Golden-image regression for the renderer.
 *
 * Drives the running app in headless Chrome with a fixed design and the synthetic
 * fixture screenshot, exports the canvas, and diffs it against tests/fixtures/golden-panel.png.
 * Any change to the geometry, caption layout, font metrics, corner masking or layer order
 * shows up here as a pixel difference.
 *
 * The geometry this locks in (canvas 1242x2688; frame 1087x2189 at 78,483; screen
 * 946x2054 at 148,546; caption centered in the band above the phone) was originally derived
 * from — and validated pixel-for-pixel against — the GIMP template this tool replaces.
 * The golden preserves that result without vendoring anyone's app screenshots.
 *
 * Usage: npm run dev  (in one shell)
 *        node scripts/verify-render.mjs            # check
 *        node scripts/verify-render.mjs --update   # re-record the golden
 */
import puppeteer from 'puppeteer-core'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = 'http://localhost:5173/'
const FIXTURE = 'tests/fixtures/sample-screenshot.png'
const GOLDEN = 'tests/fixtures/golden-panel.png'
const update = process.argv.includes('--update')

// A fixed design, so the golden is deterministic and independent of the app's defaults.
const DESIGN = {
  backgroundColor: '#001027',
  sentence: 'MyApp\nis the Best App',
  highlightIndices: [0],
  highlightColor: '#007AFF',
  textColor: '#FFFFFF',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 119,
  fontWeight: 800,
  lineHeight: 1.32,
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
page.on('pageerror', (e) => console.error('  [pageerror]', e.message))

await page.goto(URL, { waitUntil: 'networkidle0' })
await page.evaluate((d) => {
  localStorage.clear()
  localStorage.setItem('screenshot-studio:design', JSON.stringify(d))
}, DESIGN)
await page.reload({ waitUntil: 'networkidle0' })

const input = await page.$('input[type=file]')
await input.uploadFile(FIXTURE)
await page.waitForFunction(
  () => {
    const d = document.querySelector('canvas').getContext('2d').getImageData(620, 1500, 1, 1).data
    return d[0] > 200 && d[1] > 200 && d[2] > 200
  },
  { timeout: 10000 },
)

const png = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png'))
const bytes = Buffer.from(png.split(',')[1], 'base64')

if (update || !existsSync(GOLDEN)) {
  writeFileSync(GOLDEN, bytes)
  console.log(`Recorded golden: ${GOLDEN} (${(bytes.length / 1024).toFixed(0)}KB)`)
  await browser.close()
  process.exit(0)
}

// Diff in the page, where we have a canvas to decode both PNGs with.
const golden = `data:image/png;base64,${readFileSync(GOLDEN).toString('base64')}`
const result = await page.evaluate(async (goldenUrl) => {
  const decode = async (src) => {
    const img = new Image()
    img.src = src
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width
    c.height = img.height
    c.getContext('2d').drawImage(img, 0, 0)
    return { data: c.getContext('2d').getImageData(0, 0, c.width, c.height).data, w: img.width, h: img.height }
  }
  const mine = document.querySelector('canvas')
  const A = mine.getContext('2d').getImageData(0, 0, mine.width, mine.height).data
  const B = await decode(goldenUrl)

  if (mine.width !== B.w || mine.height !== B.h) {
    return { sizeMismatch: `${mine.width}x${mine.height} vs golden ${B.w}x${B.h}` }
  }

  let diff = 0
  let maxDelta = 0
  for (let i = 0; i < A.length; i += 4) {
    const d =
      Math.abs(A[i] - B.data[i]) + Math.abs(A[i + 1] - B.data[i + 1]) + Math.abs(A[i + 2] - B.data[i + 2])
    if (d > 24) diff++
    if (d > maxDelta) maxDelta = d
  }
  return {
    size: `${mine.width}x${mine.height}`,
    diffPixels: diff,
    diffPercent: ((diff / (mine.width * mine.height)) * 100).toFixed(3),
    maxDelta,
  }
}, golden)

await browser.close()

if (result.sizeMismatch) {
  console.log(`FAIL  canvas size changed — ${result.sizeMismatch}`)
  process.exit(1)
}

// Text antialiasing is not bit-stable across runs; anything structural is far larger.
const pass = Number(result.diffPercent) < 0.05
console.log(
  `${pass ? 'PASS' : 'FAIL'}  render matches golden — ${result.diffPixels} px differ ` +
    `(${result.diffPercent}%), max channel delta ${result.maxDelta}, ${result.size}`,
)
if (!pass) {
  console.log('\nIf the change was intentional, re-record with: node scripts/verify-render.mjs --update')
}
process.exit(pass ? 0 : 1)
