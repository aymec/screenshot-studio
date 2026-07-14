/**
 * Drives the screenshot strip: chips, chevrons at the ends, the add chip, the 10-screenshot
 * cap, per-screenshot design isolation, per-device decks, centering, and export-all.
 */
import { execSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
import { resetStorage } from './storage.mjs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SOURCE = 'tests/fixtures/sample-screenshot.png'
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
await resetStorage(page)
await page.reload({ waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 400))

const checks = []
const check = (name, pass, detail) => {
  checks.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}
const settle = () => new Promise((r) => setTimeout(r, 250))
const n = (sel) => page.$$eval(sel, (e) => e.length)
const has = async (sel) => (await n(sel)) > 0
const pixel = (x, y) =>
  page.evaluate(
    ([x, y]) => {
      const d = document.querySelector('canvas').getContext('2d').getImageData(x, y, 1, 1).data
      return `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`
    },
    [x, y],
  )
const setBg = async (hex) => {
  await page.evaluate((hex) => {
    const input = [...document.querySelectorAll('input[type=text]')][0]
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, hex)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, hex)
  await settle()
}
// Is the strip centered in the viewport?
const centering = () =>
  page.evaluate(() => {
    const nav = document.querySelector('nav')
    const r = nav.getBoundingClientRect()
    const main = document.querySelector('main').getBoundingClientRect()
    return Math.abs((r.left + r.right) / 2 - (main.left + main.right) / 2)
  })

const disabled = (sel) => page.$eval(sel, (b) => b.disabled)

// 1. A fresh app has one screenshot: both arrows present but spent, one chip, one add chip.
check('starts with a single chip', (await n('[data-strip-chip]')) === 1)
check('prev chevron is always on screen', await has('[data-strip-prev]'))
check('next chevron is always on screen', await has('[data-strip-next]'))
check('prev is disabled on the first screenshot', await disabled('[data-strip-prev]'))
check('next is disabled on the last screenshot', await disabled('[data-strip-next]'))
check('add chip is offered', await has('[data-strip-add]'))
check('no "Export all" with one screenshot', !(await has('[data-export-all]')))

// 2. The selected chip carries the highlight color.
const chipBg = () =>
  page.$$eval('[data-strip-chip]', (bs) =>
    bs.map((b) => ({ bg: getComputedStyle(b).backgroundColor, cur: b.getAttribute('aria-current') })),
  )
const one = (await chipBg())[0]
check('selected chip is filled with the highlight color', one.bg === 'rgb(0, 122, 255)' && one.cur === 'true', `${one.bg}`)

// 3. Add a screenshot -> 2 chips, selection moves to it, prev enables, next stays spent.
await page.click('[data-strip-add]')
await settle()
check('add chip appends a screenshot', (await n('[data-strip-chip]')) === 2)
check('the new screenshot is selected', (await chipBg())[1].cur === 'true')
check('prev enables once past the first', !(await disabled('[data-strip-prev]')))
check('next stays disabled on the last one', await disabled('[data-strip-next]'))
check('"Export all" appears with 2 screenshots', await has('[data-export-all]'))
check('"Export all" is disabled while no screenshot has an image', await disabled('[data-export-all]'))

// 3b. Geometry: every chip is 36px and the arrows 44px; the selected chip aligns to the arrows'
//     top edge, and the unselected ones to their centerline.
const geom = () =>
  page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect()
      return { w: Math.round(r.width), top: Math.round(r.top), mid: Math.round((r.top + r.bottom) / 2) }
    }
    return {
      selected: box(document.querySelector('[data-strip-chip][aria-current]')),
      other: box(document.querySelector('[data-strip-chip]:not([aria-current])')),
      prev: box(document.querySelector('[data-strip-prev]')),
      next: box(document.querySelector('[data-strip-next]')),
    }
  })
const g = await geom()
check(
  'chips are 36px and the arrows 44px',
  g.selected.w === 36 && g.other.w === 36 && g.prev.w === 44 && g.next.w === 44,
  `chips ${g.selected.w}/${g.other.w}px, arrows ${g.prev.w}/${g.next.w}px`,
)
check(
  'the selected chip aligns to the top of the arrows',
  g.selected.top === g.prev.top && g.selected.top === g.next.top,
  `selected top ${g.selected.top}, arrows ${g.prev.top}/${g.next.top}`,
)
check(
  'the unselected chips are centered with the arrows',
  g.other.mid === g.prev.mid && g.other.top > g.selected.top,
  `others center ${g.other.mid}, arrows ${g.prev.mid}`,
)

// 4. Designs are per screenshot.
await setBg('#7B2D8E')
check('screenshot 2 takes the new background', (await pixel(5, 5)) === '#7b2d8e', await pixel(5, 5))
await page.click('[data-strip-prev]')
await settle()
check('screenshot 1 kept its own background', (await pixel(5, 5)) === '#001027', await pixel(5, 5))
check('next enables when not on the last', !(await disabled('[data-strip-next]')))
check('prev is disabled again back on the first', await disabled('[data-strip-prev]'))

// 5. Images are per screenshot: upload on 1, screenshot 2 stays empty.
await (await page.$('input[type=file]')).uploadFile(SOURCE)
await page.waitForFunction(() => {
  const d = document.querySelector('canvas').getContext('2d').getImageData(620, 1500, 1, 1).data
  return d[0] > 200 && d[1] > 200 && d[2] > 200
}, { timeout: 10000 })
const shot1 = await pixel(620, 1500)
await page.click('[data-strip-next]')
await settle()
const shot2 = await pixel(620, 1500)
check('the image lands only on the screenshot it was dropped on', shot1 !== shot2, `1: ${shot1}, 2: ${shot2}`)

// 6. The cap: fill to 10, the add chip goes away.
for (let i = 2; i < 10; i++) {
  await page.click('[data-strip-add]')
  await settle()
}
check('deck fills to 10 screenshots', (await n('[data-strip-chip]')) === 10)
check('add chip disappears at 10', !(await has('[data-strip-add]')))
check('centered with a full strip', (await centering()) < 2, `${(await centering()).toFixed(1)}px off center`)
await page.screenshot({ path: '/tmp/strip-full.png' })

// 7. Centering holds at both ends of the deck.
// Clicked through the DOM, not the mouse: in the narrow view below, the chips outside the
// window are hidden, and a real click cannot reach them.
const chip = (i) =>
  page.evaluate((i) => document.querySelectorAll('[data-strip-chip]')[i].click(), i)
await chip(0)
await settle()
const offFirst = await centering()
check('centered on the first screenshot', offFirst < 2, `${offFirst.toFixed(1)}px off center`)

// 8. Decks are per device: switching to the iPad shows its own single screenshot.
await page.select('[data-device-select]', 'ipad-13')
await settle()
check('a different device starts with its own single screenshot', (await n('[data-strip-chip]')) === 1)
await page.select('[data-device-select]', 'iphone-6.5')
await settle()
check('switching back restores the iPhone deck', (await n('[data-strip-chip]')) === 10)

// 9. Persistence: every screenshot's design survives a reload, and so does its image — the
//    project lives in IndexedDB, which holds the bytes, not just the designs.
await page.reload({ waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 600))
check('the whole deck persists across reload', (await n('[data-strip-chip]')) === 10)
await chip(1)
await settle()
check('each screenshot persists its own design', (await pixel(5, 5)) === '#7b2d8e', await pixel(5, 5))

// 10. Export all: one zip, holding only the screenshots that actually have an image, each
//     numbered by its place in the deck. Screenshot 1 came back from storage with its image, so
//     the export is already live; screenshot 5 gets one too, to prove the numbering.
check(
  '"Export all" is still live after a reload, because the image came back',
  !(await disabled('[data-export-all]')),
)
const upload = async (i) => {
  await chip(i)
  await settle()
  // The same file, twice: this is the case that only works because the file input clears its
  // own value — a second pick of an unchanged value fires no change event at all.
  await (await page.$('input[type=file]')).uploadFile(SOURCE)
  await page.waitForFunction(() => {
    const d = document.querySelector('canvas').getContext('2d').getImageData(620, 1500, 1, 1).data
    return d[0] > 200 && d[1] > 200 && d[2] > 200
  }, { timeout: 10000 })
}
await upload(0)
await upload(4)
check('"Export all" enables once a screenshot has an image', !(await disabled('[data-export-all]')))

// Catch the blob the app hands to the browser instead of letting it hit the downloads folder.
await page.evaluate(() => {
  window.__downloads = []
  const create = URL.createObjectURL
  URL.createObjectURL = (blob) => {
    window.__downloads.push(blob)
    return create.call(URL, blob)
  }
  HTMLAnchorElement.prototype.click = function () {
    window.__names = [...(window.__names ?? []), this.download]
  }
})
check('nothing is spinning before the export starts', !(await has('[data-busy]')))
await page.click('[data-export-all]')
// The canvas visibly flips through the deck while it renders, so the spinner has to be up for it.
const spun = await page
  .waitForSelector('[data-busy]', { timeout: 5000 })
  .then(() => true)
  .catch(() => false)
check('the export raises a spinner while it works', spun)
await page.waitForSelector('[data-busy]', { hidden: true, timeout: 15000 })
check('the spinner comes down when the export is done', !(await has('[data-busy]')))
await new Promise((r) => setTimeout(r, 500))

const result = await page.evaluate(async () => {
  const blobs = window.__downloads
  if (blobs.length !== 1) return { count: blobs.length }
  const bytes = new Uint8Array(await blobs[0].arrayBuffer())
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return { count: 1, names: window.__names, type: blobs[0].type, b64: btoa(binary) }
})
check('export all hands back exactly one file', result.count === 1, `${result.count} downloads`)
check('that file is a zip', result.type === 'application/zip' && result.names[0] === 'iphone-6.5-screenshots.zip', `${result.type}, ${result.names?.[0]}`)

const zipPath = '/tmp/strip-export.zip'
writeFileSync(zipPath, Buffer.from(result.b64, 'base64'))
// The real unzip is the judge: a zip only this app can read is not a zip.
const listed = execSync(`unzip -Z1 ${zipPath}`).toString().trim().split('\n')
check('the zip is valid to a real unzip', execSync(`unzip -t ${zipPath}`).toString().includes('No errors'))
check('it holds only the screenshots that have an image', listed.length === 2, listed.join(', '))
check(
  'entries keep the deck numbering',
  listed[0].endsWith('-iphone-6.5-1.png') && listed[1].endsWith('-iphone-6.5-5.png'),
  listed.join(', '),
)
const extracted = execSync(`unzip -p ${zipPath} '${listed[0]}'`, { maxBuffer: 64e6 })
check(
  'the PNGs inside are the real 1242x2688 panels',
  extracted.readUInt32BE(16) === 1242 && extracted.readUInt32BE(20) === 2688,
  `${extracted.readUInt32BE(16)}x${extracted.readUInt32BE(20)}, ${(extracted.length / 1024).toFixed(0)}KB`,
)
check('the canvas is put back on the selected screenshot', (await pixel(620, 1500)) !== '#001027')

// 11. Narrow view: the strip windows down to the neighbors instead of wrapping.
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
await page.reload({ waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 600))
const shown = () =>
  page.evaluate(() => {
    const vis = (el) => el.getBoundingClientRect().width > 0
    const chips = [...document.querySelectorAll('[data-strip-chip]')].filter(vis)
    const nav = document.querySelector('nav').getBoundingClientRect()
    // The delete chip hangs below the row on purpose, so it is not part of the row's own height.
    const row = [...document.querySelectorAll('nav button:not([data-strip-delete])')]
      .filter(vis)
      .map((el) => el.getBoundingClientRect())
    const tallest = Math.max(...row.map((r) => r.height))
    const spanned = Math.max(...row.map((r) => r.bottom)) - Math.min(...row.map((r) => r.top))
    return {
      labels: chips.map((c) => c.textContent),
      // A wrap is what makes the buttons span more vertically than the tallest one of them.
      wrapped: spanned > tallest + 2,
      chipWidth: Math.round(chips[0].getBoundingClientRect().width),
      overflows: nav.left < 0 || nav.right > innerWidth,
    }
  })
await chip(3) // the fourth screenshot, in the middle of the deck
await settle()
const mid = await shown()
check('narrow: only the selected screenshot and its neighbors show', mid.labels.join(' ') === '3 4 5', mid.labels.join(' '))
check('narrow: the strip stays on one row', !mid.wrapped)
check('narrow: the strip fits the viewport', !mid.overflows)
check('narrow: still centered', (await centering()) < 2, `${(await centering()).toFixed(1)}px off center`)
await page.screenshot({ path: '/tmp/strip-narrow.png' })

// At the ends of the deck there is no neighbor on one side, so the window slides rather than
// shrinking: three chips are on screen wherever the user is.
await chip(0)
await settle()
const first = await shown()
check('narrow: the first screenshot still shows three chips', first.labels.join(' ') === '1 2 3', first.labels.join(' '))
await chip(9)
await settle()
const last = await shown()
check('narrow: the last screenshot still shows three chips', last.labels.join(' ') === '8 9 10', last.labels.join(' '))

// 12. Narrower still: the chips shrink instead of overflowing.
await page.setViewport({ width: 320, height: 700, isMobile: true, hasTouch: true })
await new Promise((r) => setTimeout(r, 400))
const tiny = await shown()
check('tiny: the chips shrink below 36px', tiny.chipWidth < 36, `${tiny.chipWidth}px chips at 320px wide`)
check('tiny: the strip still fits, unwrapped', !tiny.overflows && !tiny.wrapped)
await page.screenshot({ path: '/tmp/strip-tiny.png' })

// 13. Delete: the chip under the selected screenshot, behind a yes/no confirmation.
await page.setViewport({ width: 1500, height: 950 })
await new Promise((r) => setTimeout(r, 400))
const del = () => page.$('[data-strip-delete]')
const shownModal = () => page.$eval('[data-confirm]', (el) => getComputedStyle(el).opacity === '1')
const delGeom = await page.evaluate(() => {
  const d = document.querySelector('[data-strip-delete]').getBoundingClientRect()
  const c = document.querySelector('[data-strip-chip][aria-current]').getBoundingClientRect()
  const a = document.querySelector('[data-strip-prev]').getBoundingClientRect()
  return {
    size: Math.round(d.width),
    gap: Math.round(d.top - c.bottom),
    offCenter: Math.abs((d.left + d.right) / 2 - (c.left + c.right) / 2),
    // It rides up with the selected chip, so it clears the arrows' bottom by the same 4px.
    belowArrows: Math.round(d.top - a.bottom),
  }
})
check(
  'the delete chip is 16px, 4px under the selected chip and centered on it',
  delGeom.size === 16 && delGeom.gap === 4 && delGeom.offCenter < 1,
  `${delGeom.size}px, ${delGeom.gap}px below the chip, ${delGeom.offCenter.toFixed(1)}px off center`,
)
check('the confirmation starts closed', !(await shownModal()))

await (await del()).click()
await settle()
check('the delete chip opens a confirmation', await shownModal())

await page.click('[data-confirm-no]')
await settle()
check('answering no keeps the screenshot', !(await shownModal()) && (await n('[data-strip-chip]')) === 10)

await (await del()).click()
await settle()
await page.click('[data-confirm-yes]')
await settle()
check('answering yes deletes the screenshot', (await n('[data-strip-chip]')) === 9)
check('the confirmation closes on yes', !(await shownModal()))
check('the add chip comes back once there is room', await has('[data-strip-add]'))

// The deletion is of the screenshot the user was on: it was the last one (10), so the cursor
// lands on the new last one, and the deck now ends at 9.
const labels = await page.$$eval('[data-strip-chip]', (bs) => bs.map((b) => b.textContent).join(' '))
check('the remaining screenshots renumber', labels === '1 2 3 4 5 6 7 8 9', labels)
check('the deletion survives a reload', await (async () => {
  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 600))
  return (await n('[data-strip-chip]')) === 9
})())

// A one-screenshot deck has nothing to delete down to: that is what Reset is for.
while ((await n('[data-strip-chip]')) > 1) {
  await (await del()).click()
  await settle()
  await page.click('[data-confirm-yes]')
  await settle()
}
check('the last screenshot cannot be deleted', !(await del()), 'no delete chip on a deck of one')

check('no console errors', errors.length === 0, errors.join(' | ') || 'clean')

await browser.close()
const failed = checks.filter((c) => !c).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
