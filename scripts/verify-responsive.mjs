/**
 * Checks the responsive shell: the preview is always visible, the panel sits on the
 * right, and below `lg` it collapses into a burger-triggered slide-over.
 *
 * Usage: npm run dev  (in one shell)
 *        node scripts/verify-responsive.mjs
 */
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })

const checks = []
const check = (name, pass, detail) => {
  checks.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const box = (page, sel) =>
  page.$eval(sel, (el) => {
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), right: Math.round(r.right), w: Math.round(r.width), visible: r.width > 0 }
  })

const visible = (page, sel) =>
  page.$eval(sel, (el) => {
    const s = getComputedStyle(el)
    return s.display !== 'none' && s.visibility !== 'hidden'
  })

// ---------- Desktop ----------
{
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 400))

  const aside = await box(page, 'aside')
  const canvas = await box(page, 'canvas')
  const vw = 1440

  check('desktop: panel is on the RIGHT of the preview', aside.x > canvas.right - 1, `canvas ends ${canvas.right}, panel starts ${aside.x}`)
  check('desktop: panel is fully on screen', aside.right <= vw + 1 && aside.x < vw, `x=${aside.x} right=${aside.right}`)
  check('desktop: preview is visible', canvas.visible && canvas.w > 100, `canvas ${canvas.w}px wide`)
  check('desktop: no burger button', !(await visible(page, 'button[aria-expanded]')), 'hidden at lg+')

  // Info + theme now live inside the panel, under the title — no info FAB anymore.
  check('desktop: no info FAB floating on the page', (await page.$$('button[aria-label="About this site"]')).length === 1, 'only the in-panel one')
  const infoBtn = await box(page, 'button[aria-label="About this site"]')
  check('desktop: info button is inside the panel', infoBtn.x >= aside.x, `info x=${infoBtn.x}, panel x=${aside.x}`)

  // It opens the modal, and the modal closes again.
  check('desktop: modal starts closed', !(await page.$eval('[role=dialog]', (el) => getComputedStyle(el).opacity !== '0')))
  await page.click('button[aria-label="About this site"]')
  await new Promise((r) => setTimeout(r, 300))
  check('desktop: info button opens the modal', await page.$eval('[role=dialog]', (el) => getComputedStyle(el).opacity === '1'))
  await page.screenshot({ path: '/tmp/studio-info-modal.png' })

  await page.click('button[aria-label="Close info"]')
  await new Promise((r) => setTimeout(r, 300))
  check('desktop: modal closes', await page.$eval('[role=dialog]', (el) => getComputedStyle(el).opacity === '0'))

  await page.screenshot({ path: '/tmp/studio-desktop.png' })
  await page.close()
}

// ---------- Mobile ----------
{
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 400))
  const vw = 390

  const closed = await box(page, 'aside')
  check('mobile: panel starts hidden off-screen', closed.x >= vw - 1, `panel x=${closed.x}, viewport ${vw}`)

  const canvas = await box(page, 'canvas')
  check('mobile: preview still visible', canvas.visible && canvas.w > 50, `canvas ${canvas.w}px wide`)

  const fab = await visible(page, 'button[aria-expanded]')
  check('mobile: burger button is present', fab)

  const fabBox = await box(page, 'button[aria-expanded]')
  const fabPos = await page.$eval('button[aria-expanded]', (el) => {
    const r = el.getBoundingClientRect()
    return { bottomGap: Math.round(innerHeight - r.bottom), rightGap: Math.round(innerWidth - r.right) }
  })
  check('mobile: burger sits on the right', fabPos.rightGap < 40, `${fabPos.rightGap}px from right`)

  // It floats above the screenshot strip rather than beside it, so the preview and the chips get
  // the full width. Overlapping the bottom of the preview is fine; overlapping the chips is not.
  const overStrip = await page.evaluate(() => {
    const fab = document.querySelector('button[aria-expanded]').getBoundingClientRect()
    const nav = document.querySelector('nav').getBoundingClientRect()
    const hits = (a, b) => !(a.bottom <= b.top || a.top >= b.bottom || a.right <= b.left || a.left >= b.right)
    return { overlaps: hits(fab, nav), gap: Math.round(nav.top - fab.bottom) }
  })
  check('mobile: burger clears the screenshot strip', !overStrip.overlaps, `${overStrip.gap}px above the chips`)

  // Open it.
  await page.click('button[aria-expanded]')
  await new Promise((r) => setTimeout(r, 100))
  const midSlide = await box(page, 'aside')
  await new Promise((r) => setTimeout(r, 500))
  const opened = await box(page, 'aside')

  check('mobile: burger opens the panel', opened.x < vw - 100, `panel x=${opened.x}`)
  check('mobile: panel animates in (not an instant jump)', midSlide.x > opened.x, `mid-slide x=${midSlide.x} -> settled x=${opened.x}`)

  const transition = await page.$eval('aside', (el) => getComputedStyle(el).transitionProperty)
  check('mobile: slide is a transform transition', transition.includes('transform'), transition)

  const canvasOpen = await box(page, 'canvas')
  check('mobile: preview still on screen with panel open', canvasOpen.visible && canvasOpen.x < opened.x, `canvas x=${canvasOpen.x}`)

  // The burger stays visible and on top of the panel — it is the only close control now.
  const fabState = await page.$eval('button[aria-expanded]', (el) => {
    const s = getComputedStyle(el)
    return { opacity: s.opacity, pointerEvents: s.pointerEvents, z: Number(s.zIndex) }
  })
  const zPanel = await page.$eval('aside', (el) => Number(getComputedStyle(el).zIndex))
  check(
    'mobile: burger stays visible above the open panel',
    fabState.opacity === '1' && fabState.pointerEvents !== 'none' && fabState.z > zPanel,
    `opacity=${fabState.opacity}, fab z=${fabState.z} > panel z=${zPanel}`,
  )

  // There is no X inside the panel any more (the FAB carries that label while open).
  const xInPanel = await page.$$eval('aside button', (bs) =>
    bs.filter((b) => b.getAttribute('aria-label') === 'Close controls').length,
  )
  check('mobile: panel itself has no close button', xInPanel === 0, `${xInPanel} X buttons in the panel`)

  // Scrolled to the bottom, the last control must clear the floating button.
  const clearance = await page.evaluate(() => {
    const aside = document.querySelector('aside')
    aside.scrollTop = aside.scrollHeight
    const buttons = [...aside.querySelectorAll('button')]
    const last = buttons[buttons.length - 1].getBoundingClientRect()
    const fab = document.querySelector('button[aria-expanded]').getBoundingClientRect()
    const overlaps = !(last.bottom < fab.top || last.top > fab.bottom || last.right < fab.left || last.left > fab.right)
    return { overlaps, lastBottom: Math.round(last.bottom), fabTop: Math.round(fab.top), visible: last.bottom <= innerHeight + 1 }
  })
  check(
    'mobile: last control scrolls clear of the burger',
    !clearance.overlaps && clearance.visible,
    `last control ends at ${clearance.lastBottom}, burger starts at ${clearance.fabTop}`,
  )

  await page.screenshot({ path: '/tmp/studio-mobile-open.png' })

  // The burger closes the panel too.
  await page.click('button[aria-expanded]')
  await new Promise((r) => setTimeout(r, 500))
  check('mobile: burger closes the panel', (await box(page, 'aside')).x >= vw - 1)

  // Re-open, then close via the backdrop.
  await page.click('button[aria-expanded]')
  await new Promise((r) => setTimeout(r, 500))
  await page.mouse.click(20, 400)
  await new Promise((r) => setTimeout(r, 500))
  const reclosed = await box(page, 'aside')
  check('mobile: tapping the backdrop closes it', reclosed.x >= vw - 1, `panel x=${reclosed.x}`)

  await page.screenshot({ path: '/tmp/studio-mobile-closed.png' })
  await page.close()
  void fabBox
}

await browser.close()
const failed = checks.filter((c) => !c).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
