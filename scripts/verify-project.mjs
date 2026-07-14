/**
 * The two ways a project is kept, end to end:
 *
 * - the browser's database, so the work survives a reload, images included;
 * - the .zip, so it survives the browser — saved, wiped, and opened back to the same pixels.
 *
 * Usage: npm run dev  (in one shell)
 *        node scripts/verify-project.mjs
 */
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
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

/* ---------------------------------------------------------------------------------------------
 * The project file. The database survives a reload; this has to survive the browser.
 * ------------------------------------------------------------------------------------------- */

// Put the deck back to two screenshots, so the file has something to carry.
await page.click('[data-strip-add]')
await page.waitForFunction(() => document.querySelectorAll('[data-strip-chip]').length === 2)
await upload(OTHER)
await page.select('[data-device-select]', 'iphone-6.5')
await page.waitForFunction(() => document.querySelector('canvas').width === 1242)

const [firstChip] = await page.$$('[data-strip-chip]')
await firstChip.click()
await page.waitForFunction(
  () => document.querySelector('div[class*="border-dashed"]').textContent.includes('sample-screenshot'),
  { timeout: 10000 },
)
const savedIphone = await canvasPng()
await page.select('[data-device-select]', 'ipad-13')
await page.waitForFunction(() => document.querySelector('canvas').width === 2064)
const savedIpad = await canvasPng()
await page.select('[data-device-select]', 'iphone-6.5')
await page.waitForFunction(() => document.querySelector('canvas').width === 1242)

// Catch the download instead of letting it land in the downloads folder.
await page.evaluate(() => {
  window.__saved = null
  const create = URL.createObjectURL
  URL.createObjectURL = (blob) => {
    window.__saved = blob
    return create.call(URL, blob)
  }
  HTMLAnchorElement.prototype.click = function () {
    window.__name = this.download
  }
})

const openMenu = async () => {
  await page.click('[data-export-menu]')
  await page.waitForSelector('[data-export-list]')
}
await openMenu()
await page.click('[data-export-item="project"]')
await page.waitForFunction(() => window.__saved !== null, { timeout: 20000 })

const saved = await page.evaluate(async () => {
  const bytes = new Uint8Array(await window.__saved.arrayBuffer())
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return { name: window.__name, type: window.__saved.type, b64: btoa(binary) }
})
check(
  'saving a project hands back one dated zip',
  saved.type === 'application/zip' && /^screenshot-studio-project-\d{4}-\d{2}-\d{2}\.zip$/.test(saved.name),
  `${saved.type}, ${saved.name}`,
)

const zipPath = '/tmp/studio-project.zip'
writeFileSync(zipPath, Buffer.from(saved.b64, 'base64'))
// The real unzip is the judge: an archive only this app can read is not an archive.
check('the zip is valid to a real unzip', execSync(`unzip -t ${zipPath}`).toString().includes('No errors'))

const listed = execSync(`unzip -Z1 ${zipPath}`).toString().trim().split('\n')
check(
  'it holds a manifest and one entry per image',
  listed.length === 4 && listed[0] === 'project.json',
  listed.join(', '),
)
check(
  'images are filed under their device, not named after the caption',
  listed.includes('images/iphone-6.5/1.png') &&
    listed.includes('images/iphone-6.5/2.png') &&
    listed.includes('images/ipad-13/1.png'),
  listed.join(', '),
)

const manifest = JSON.parse(execSync(`unzip -p ${zipPath} project.json`).toString())
check('the manifest says what it is', manifest.kind === 'screenshot-studio-project' && manifest.version === 1)
check(
  'it carries the device by id, never its geometry',
  manifest.deviceId === 'iphone-6.5' && !JSON.stringify(manifest).includes('radius'),
)
check(
  'every screenshot carries its own full design',
  manifest.devices['iphone-6.5'].slides[0].design.backgroundColor === '#7B2D8E' &&
    manifest.devices['iphone-6.5'].slides[0].design.sentence.includes('MyApp'),
  manifest.devices['iphone-6.5'].slides[0].design.backgroundColor,
)
check(
  'each image records the file it came from',
  manifest.images['images/iphone-6.5/1.png'].name === 'sample-screenshot.png',
  JSON.stringify(manifest.images['images/iphone-6.5/1.png']),
)

// Now throw everything away — the database included — and open the file back.
await resetStorage(page)
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForSelector('canvas')
check('after wiping, the canvas is back to the empty template', (await canvasPng()) !== savedIphone)

const projectInput = async () => await page.$('input[accept=".zip,application/zip"]')
await (await projectInput()).uploadFile(zipPath)
await page.waitForSelector('[data-confirm-yes]', { visible: true })
check('loading asks before it replaces the current work', true)
await page.click('[data-confirm-yes]')
await page.waitForFunction(() => !document.querySelector('[data-busy]'), { timeout: 30000 })
await new Promise((r) => setTimeout(r, 400))

check('the loaded project is the same pixels it was saved as', (await canvasPng()) === savedIphone)
check('the deck comes back whole', (await chips()).length === 2, (await chips()).join(' '))
check(
  'the file name of each image survives the round trip',
  (await dropZone()).includes('sample-screenshot.png'),
  await dropZone(),
)
await page.select('[data-device-select]', 'ipad-13')
await page.waitForFunction(() => document.querySelector('canvas').width === 2064)
check('the other device came back too', (await canvasPng()) === savedIpad)

// A loaded project is saved on arrival, so closing the tab does not lose what was just opened.
await page.reload({ waitUntil: 'networkidle0' })
await page.waitForSelector('canvas')
await new Promise((r) => setTimeout(r, 600))
await page.select('[data-device-select]', 'iphone-6.5')
await page.waitForFunction(() => document.querySelector('canvas').width === 1242)
check('a loaded project is kept, so a reload does not undo the load', (await canvasPng()) === savedIphone)

// A file that is not a project says so, and leaves the work alone.
const intact = await canvasPng()
await (await projectInput()).uploadFile('tests/fixtures/sample-screenshot.png')
await page.waitForSelector('[data-confirm-yes]', { visible: true })
await page.click('[data-confirm-yes]')
await page.waitForSelector('[data-load-error]', { timeout: 15000 })
check('a file that is not a zip is reported, not swallowed', await page.$eval('[data-load-error]', (e) => e.textContent.length > 0))
check('and the work in progress is untouched', (await canvasPng()) === intact)

check('no console errors', errors.length === 0, errors[0])

await browser.close()
const failed = checks.filter((p) => !p).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
