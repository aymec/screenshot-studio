/**
 * Checks the light/dark theme: it defaults to the OS preference, the in-panel toggle
 * flips it, the choice survives a reload, and light mode is actually light.
 *
 * Usage: npm run dev  (in one shell)
 *        node scripts/verify-theme.mjs
 */
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = 'http://localhost:5173/'

const checks = []
const check = (name, pass, detail) => {
  checks.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })

const state = (page) =>
  page.evaluate(() => ({
    dark: document.documentElement.classList.contains('dark'),
    colorScheme: document.documentElement.style.colorScheme,
    bodyBg: getComputedStyle(document.querySelector('#root > div')).backgroundColor,
    panelBg: getComputedStyle(document.querySelector('aside')).backgroundColor,
    stored: localStorage.getItem('screenshot-studio:theme'),
  }))

// --- 1. Defaults to the OS preference, both ways. ---
for (const scheme of ['dark', 'light']) {
  const page = await browser.newPage()
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }])
  await page.goto(URL, { waitUntil: 'networkidle0' })
  await page.evaluate(() => localStorage.removeItem('screenshot-studio:theme'))
  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 300))
  const s = await state(page)
  check(`defaults to system preference (OS = ${scheme})`, s.dark === (scheme === 'dark'), `dark class = ${s.dark}`)
  check(`  nothing persisted until the user chooses (OS = ${scheme})`, s.stored === null, `stored = ${s.stored}`)
  await page.close()
}

// --- 2. Toggle flips it, and light mode is genuinely light. ---
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
await page.goto(URL, { waitUntil: 'networkidle0' })
await page.evaluate(() => localStorage.removeItem('screenshot-studio:theme'))
await page.reload({ waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 300))

const dark = await state(page)
check('starts dark (OS = dark)', dark.dark)

await page.click('button[aria-label="Switch to light mode"]')
await new Promise((r) => setTimeout(r, 300))
const light = await state(page)

// Tailwind v4 emits oklch(); its first channel IS perceptual lightness (0..1). Naively
// regexing digits out of an oklch string gives nonsense, so branch on the format.
const lum = (css) => {
  if (css.startsWith('oklch') || css.startsWith('oklab')) {
    return Number(css.match(/[\d.]+/)[0])
  }
  const [r, g, b] = css.match(/[\d.]+/g).slice(0, 3).map(Number)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}
check('toggle switches to light', !light.dark, `dark class = ${light.dark}`)
check('light mode is actually light', lum(light.bodyBg) > 0.7 && lum(light.panelBg) > 0.7, `app ${light.bodyBg}, panel ${light.panelBg}`)
check('dark mode was actually dark', lum(dark.bodyBg) < 0.2, dark.bodyBg)
check('color-scheme is set for native widgets', light.colorScheme === 'light', light.colorScheme)

// --- 3. The choice is remembered, and now beats the OS preference. ---
check('choice is persisted', light.stored === 'light', `stored = ${light.stored}`)
await page.reload({ waitUntil: 'networkidle0' })
await new Promise((r) => setTimeout(r, 300))
const afterReload = await state(page)
check('stays light after reload despite OS = dark', !afterReload.dark)

// --- 4. Toggling back works and the button label follows the state. ---
await page.click('button[aria-label="Switch to dark mode"]')
await new Promise((r) => setTimeout(r, 300))
check('toggles back to dark', (await state(page)).dark)

// --- 5. The toggle and info buttons live in the panel, under the title. ---
const layout = await page.evaluate(() => {
  const aside = document.querySelector('aside')
  const title = aside.querySelector('h1').getBoundingClientRect()
  const info = aside.querySelector('button[aria-label="About this site"]')?.getBoundingClientRect()
  const themeBtn = aside.querySelector('button[aria-label^="Switch to"]')?.getBoundingClientRect()
  return {
    inPanel: !!info && !!themeBtn,
    belowTitle: info && themeBtn ? info.top >= title.bottom && themeBtn.top >= title.bottom : false,
  }
})
check('info + theme buttons are inside the panel', layout.inPanel)
check('they sit below the panel title', layout.belowTitle)

await page.screenshot({ path: '/tmp/studio-dark.png' })
await page.click('button[aria-label="Switch to light mode"]')
await new Promise((r) => setTimeout(r, 400))
await page.screenshot({ path: '/tmp/studio-light.png' })

await browser.close()
const failed = checks.filter((c) => !c).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
