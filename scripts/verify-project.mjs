/**
 * Checks that the user's work survives a reload — the images included, which is the whole point
 * of storing projects in IndexedDB rather than designs in localStorage.
 *
 * Usage: npm run dev  (in one shell)
 *        node scripts/verify-project.mjs
 */
import puppeteer from 'puppeteer-core'
import { resetStorage } from './storage.mjs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = 'http://localhost:5173/'
const FIXTURE = 'tests/fixtures/sample-screenshot.png'
const OTHER = 'tests/fixtures/golden-panel.png'

const checks = []
const check = (name, pass, detail) => {
  checks.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
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

await page.goto(URL, { waitUntil: 'networkidle0' })
await resetStorage(page)
await page.reload({ waitUntil: 'networkidle0' })

/** The canvas, as a PNG data URL: the pixels the user would export. */
const canvasPng = () => page.evaluate(() => document.querySelector('canvas').toDataURL())
const dropZone = () => page.$eval('div[class*="border-dashed"]', (el) => el.textContent)
const upload = async (file) => {
  const before = await canvasPng()
  await (await page.$('input[type=file]')).uploadFile(file)
  await page.waitForFunction(
    (b) => document.querySelector('canvas').toDataURL() !== b,
    { timeout: 10000 },
    before,
  )
}
const chips = () =>
  page.$$eval('[data-strip-chip]', (els) => els.map((e) => e.textContent.trim()))

// Build a project worth losing: an image and a custom color on the iPhone's first screenshot,
// a second screenshot with its own image, and a third device left alone.
await upload(FIXTURE)
// React installs its own `value` setter, so an assignment has to go through the native one or
// the component never sees the change.
await page.evaluate(() => {
  const input = [...document.querySelectorAll('input[type=text]')].find((i) =>
    i.value.startsWith('#00'),
  )
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, '#7B2D8E')
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.waitForFunction(() => {
  const d = document.querySelector('canvas').getContext('2d').getImageData(5, 5, 1, 1).data
  return d[0] === 0x7b && d[1] === 0x2d && d[2] === 0x8e
})

await page.click('[data-strip-add]')
await page.waitForFunction(() => document.querySelectorAll('[data-strip-chip]').length === 2)
await upload(OTHER)

// The iPad gets its own screenshot, to prove a whole project comes back and not just one device.
await page.select('[data-device-select]', 'ipad-13')
await page.waitForFunction(() => document.querySelector('canvas').width === 2064)
await upload(FIXTURE)
const ipadBefore = await canvasPng()

await page.select('[data-device-select]', 'iphone-6.5')
await page.waitForFunction(() => document.querySelector('canvas').width === 1242)
const iphoneBefore = await canvasPng()
const iphoneFile = await dropZone()

// The reload. Before this commit every image was gone at this point.
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForSelector('canvas')
await page.waitForFunction(
  (before) => document.querySelector('canvas').toDataURL() === before,
  { timeout: 10000 },
  iphoneBefore,
).catch(() => {})

check(
  'the screenshot on the canvas is the same pixels after a reload',
  (await canvasPng()) === iphoneBefore,
)
check('its file name comes back with it', (await dropZone()) === iphoneFile, await dropZone())
check('the deck still holds both screenshots', (await chips()).length === 2, (await chips()).join(' '))

// The second screenshot of the deck kept its own, different image.
await page.click('[data-strip-chip]:nth-of-type(1)')
const [first, second] = await page.$$('[data-strip-chip]')
await second.click()
await page.waitForFunction(
  () => document.querySelector('div[class*="border-dashed"]').textContent.includes('golden-panel'),
  { timeout: 10000 },
)
check('the second screenshot kept its own image', (await dropZone()).includes('golden-panel.png'))
await first.click()

// And the other device's deck came back too.
await page.select('[data-device-select]', 'ipad-13')
await page.waitForFunction(() => document.querySelector('canvas').width === 2064)
check('the other device kept its screenshot too', (await canvasPng()) === ipadBefore)

// A screenshot the user deletes must not leave its image on the disk forever.
await page.select('[data-device-select]', 'iphone-6.5')
await page.waitForFunction(() => document.querySelector('canvas').width === 1242)
const imageCount = () =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open('screenshot-studio')
        request.onsuccess = () => {
          const tx = request.result.transaction('images', 'readonly')
          const count = tx.objectStore('images').count()
          count.onsuccess = () => {
            request.result.close()
            resolve(count.result)
          }
        }
      }),
  )
check('the images are stored, one per screenshot', (await imageCount()) === 3, `${await imageCount()} images`)

const [, chip2] = await page.$$('[data-strip-chip]')
await chip2.click()
await page.click('[data-strip-delete]')
await page.click('[data-confirm-yes]')
await page.waitForFunction(() => document.querySelectorAll('[data-strip-chip]').length === 1)
// The save that follows the delete is what collects the garbage.
await page.waitForFunction(
  () =>
    new Promise((resolve) => {
      const request = indexedDB.open('screenshot-studio')
      request.onsuccess = () => {
        const tx = request.result.transaction('images', 'readonly')
        const count = tx.objectStore('images').count()
        count.onsuccess = () => {
          request.result.close()
          resolve(count.result === 2)
        }
      }
    }),
  { timeout: 5000 },
).catch(() => {})
check(
  'deleting a screenshot drops its image from storage',
  (await imageCount()) === 2,
  `${await imageCount()} images left`,
)

check('no console errors', errors.length === 0, errors[0])

await browser.close()
const failed = checks.filter((p) => !p).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
