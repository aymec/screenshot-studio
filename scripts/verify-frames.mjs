/**
 * Per-device geometry check: every preset's frame, screen rect and corner radius agree.
 *
 * Drives the real app once per device — picking it from the device select, uploading the
 * fixture — and then reads the canvas back and asserts the two ways a preset's `screen.radius`
 * can be wrong. Both are subtle enough to miss by eye:
 *
 *   leak — the screenshot's corners poke out past the phone's rounded body, because the mask
 *          is rounded *less* than the body is. Seen as non-background pixels outside the body.
 *   gap  — the mask is rounded *more* than the frame's screen aperture, so the background
 *          shows through at the corners of the screen. Seen as background pixels inside the
 *          aperture.
 *
 * The frame PNG is transparent in exactly two places — outside the phone body, and the screen
 * aperture — so flood-filling its alpha tells the two regions apart: from the canvas border
 * inward is "outside the body"; from the middle of the screen outward is "the aperture".
 *
 * The geometry below is restated from src/template.ts on purpose. A check that imports the
 * numbers it is checking would pass no matter what they were.
 *
 * Usage: npm run dev  (in one shell)
 *        node scripts/verify-frames.mjs
 */
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = 'http://localhost:5173/'
const FIXTURE = 'tests/fixtures/sample-screenshot.png'
// Any second, visibly different image: used only to tell one device's screenshot from another's.
const GOLDEN = 'tests/fixtures/golden-panel.png'

const BG = { r: 0, g: 16, b: 39 } // #001027
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

const DEVICES = [
  { id: 'iphone-6.5',     src: '/src/assets/iphone-frame.png',         canvas: [1242, 2688], frame: [78, 483, 1087, 2189],  screen: [148, 546, 946, 2054] },
  { id: 'ipad-13',        src: '/src/assets/ipad-frame.png',           canvas: [2064, 2752], frame: [173, 479, 1718, 2220], screen: [258, 557, 1548, 2064] },
  { id: 'android-phone',  src: '/src/assets/android-phone-frame.png',  canvas: [1512, 2688], frame: [255, 513, 1007, 2128], screen: [278, 543, 955, 2074] },
  { id: 'android-tablet', src: '/src/assets/android-tablet-frame.png', canvas: [1548, 2752], frame: [100, 561, 1349, 2055], screen: [168, 639, 1211, 1899] },
]

let failures = 0
const check = (name, ok, detail) => {
  if (!ok) failures++
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
page.on('pageerror', (e) => console.error('  [pageerror]', e.message))

await page.goto(URL, { waitUntil: 'networkidle0' })
await page.evaluate((d) => {
  localStorage.clear()
  localStorage.setItem('screenshot-studio:design', JSON.stringify(d))
}, DESIGN)

for (const device of DEVICES) {
  console.log(`\n${device.id}`)

  // Select the device through the real control, then reload so the app starts on it: that
  // also proves the choice is persisted, which is how a user gets back to it.
  await page.select('[data-device-select]', device.id)
  await page.reload({ waitUntil: 'networkidle0' })

  const selected = await page.$eval('[data-device-select]', (el) => el.value)
  check('device is selected and restored after reload', selected === device.id, selected)

  const [cw, ch] = device.canvas
  const size = await page.$eval('canvas', (c) => [c.width, c.height])
  check('canvas is the export size', size[0] === cw && size[1] === ch, `${size[0]} × ${size[1]}`)

  // Upload into the screen and wait for real image pixels: the empty-state placeholder is
  // already != background, so "not the background" would be true before the upload lands.
  const [sx, sy, sw, sh] = device.screen
  const probe = [Math.round(sx + sw / 2), Math.round(sy + sh / 2)]
  await (await page.$('input[type=file]')).uploadFile(FIXTURE)
  await page.waitForFunction(
    ([x, y]) => {
      const d = document.querySelector('canvas').getContext('2d').getImageData(x, y, 1, 1).data
      return d[0] > 200 && d[1] > 200 && d[2] > 200
    },
    { timeout: 10000 },
    probe,
  )

  const result = await page.evaluate(async (device, BG) => {
    const canvas = document.querySelector('canvas')
    const { width: w, height: h } = canvas

    const img = new Image()
    img.src = device.src
    await img.decode()

    // Composite the frame exactly where the renderer puts it, so its alpha lines up with
    // the canvas we are about to read.
    const fc = document.createElement('canvas')
    fc.width = w
    fc.height = h
    fc.getContext('2d').drawImage(img, ...device.frame)

    const F = fc.getContext('2d').getImageData(0, 0, w, h).data
    const C = canvas.getContext('2d').getImageData(0, 0, w, h).data

    const fill = (seeds) => {
      const seen = new Uint8Array(w * h)
      const stack = []
      const push = (x, y) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return
        const p = y * w + x
        if (seen[p] || F[p * 4 + 3] !== 0) return
        seen[p] = 1
        stack.push(p)
      }
      for (const [x, y] of seeds) push(x, y)
      while (stack.length) {
        const p = stack.pop()
        const x = p % w
        const y = (p / w) | 0
        push(x + 1, y)
        push(x - 1, y)
        push(x, y + 1)
        push(x, y - 1)
      }
      return seen
    }

    const border = []
    for (let x = 0; x < w; x++) border.push([x, 0], [x, h - 1])
    for (let y = 0; y < h; y++) border.push([0, y], [w - 1, y])
    const outside = fill(border)

    const [sx, sy, sw, sh] = device.screen
    const aperture = fill([[Math.round(sx + sw / 2), Math.round(sy + sh / 2)]])

    const isBg = (i) => C[i] === BG.r && C[i + 1] === BG.g && C[i + 2] === BG.b

    // Leak: anything that is not the background, outside the phone body. Restricted to the
    // phone's own vertical span so the caption — which also sits over transparent frame —
    // is not counted as a leak.
    const [, fy, , fh] = device.frame
    let leak = 0
    for (let y = fy; y < Math.min(fy + fh, h); y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x
        if (outside[p] && !isBg(p * 4)) leak++
      }
    }

    // Gap: the background showing through the screen aperture.
    let gap = 0
    let apertureArea = 0
    for (let p = 0; p < w * h; p++) {
      if (!aperture[p]) continue
      apertureArea++
      if (isBg(p * 4)) gap++
    }

    return { leak, gap, apertureArea }
  }, device, BG)

  check('aperture was found in the frame', result.apertureArea > 100000, `${result.apertureArea} px`)
  check('screenshot stays inside the phone body', result.leak === 0, `${result.leak} px outside the body`)
  check('screenshot covers the whole screen', result.gap === 0, `${result.gap} background px inside the aperture`)
}

// A screenshot is of one device: a phone capture center-cropped into a tablet's screen is not
// a panel anyone would ship. So each device keeps its own, and switching between them shows
// the one that was dropped in for that device — or the empty state, never another device's.
console.log('\nscreenshots are per-device')

const IPHONE = DEVICES[0]
const IPAD = DEVICES[1]
const centre = (d) => [Math.round(d.screen[0] + d.screen[2] / 2), Math.round(d.screen[1] + d.screen[3] / 2)]
const pixel = ([x, y]) =>
  page.evaluate(
    ([x, y]) => [...document.querySelector('canvas').getContext('2d').getImageData(x, y, 1, 1).data.slice(0, 3)],
    [x, y],
  )
// The fixture is white in the middle; the empty state is the background under a 8% white wash.
const hasShot = (px) => px[0] > 200 && px[1] > 200 && px[2] > 200
const dropZoneName = () =>
  page.$eval('div[class*="border-dashed"]', (el) => el.textContent)

await page.evaluate(() => localStorage.removeItem('screenshot-studio:device'))
await page.reload({ waitUntil: 'networkidle0' })

// The iPhone gets a screenshot; the iPad has never been given one.
await (await page.$('input[type=file]')).uploadFile(FIXTURE)
await page.waitForFunction(
  ([x, y]) => {
    const d = document.querySelector('canvas').getContext('2d').getImageData(x, y, 1, 1).data
    return d[0] > 200 && d[1] > 200 && d[2] > 200
  },
  { timeout: 10000 },
  centre(IPHONE),
)
check('iPhone shows its screenshot', hasShot(await pixel(centre(IPHONE))))
check('iPhone drop zone offers to replace', (await dropZoneName()).includes('sample-screenshot.png'))

// Switching device must NOT carry the iPhone's screenshot over to the iPad.
await page.select('[data-device-select]', IPAD.id)
await page.waitForFunction((w) => document.querySelector('canvas').width === w, {}, IPAD.canvas[0])
check('iPad does not inherit the iPhone screenshot', !hasShot(await pixel(centre(IPAD))))
check(
  'iPad drop zone is back to the empty state',
  !(await dropZoneName()).includes('sample-screenshot.png'),
  await dropZoneName(),
)

// Give the iPad its own, distinct image.
await (await page.$('input[type=file]')).uploadFile(GOLDEN)
await page.waitForFunction(
  () => document.querySelector('div[class*="border-dashed"]').textContent.includes('golden-panel.png'),
  { timeout: 10000 },
)
check('iPad shows its own screenshot', (await dropZoneName()).includes('golden-panel.png'))

// Going back and forth shows each device its own image, not the other's.
await page.select('[data-device-select]', IPHONE.id)
await page.waitForFunction((w) => document.querySelector('canvas').width === w, {}, IPHONE.canvas[0])
check('iPhone still has its own screenshot', hasShot(await pixel(centre(IPHONE))))
check('iPhone kept its own file', (await dropZoneName()).includes('sample-screenshot.png'))

await page.select('[data-device-select]', IPAD.id)
await page.waitForFunction((w) => document.querySelector('canvas').width === w, {}, IPAD.canvas[0])
check('iPad kept its own file', (await dropZoneName()).includes('golden-panel.png'))

await browser.close()
console.log(failures === 0 ? '\nAll devices OK' : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
