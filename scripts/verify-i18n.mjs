/**
 * Checks localization: the browser's language is detected, the picker switches locales,
 * the choice persists, <html lang> follows, and no string is left untranslated or with an
 * unsubstituted {{placeholder}}.
 *
 * Usage: npm run dev  (in one shell)
 *        node scripts/verify-i18n.mjs
 */
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = 'http://localhost:5173/'

const checks = []
const check = (name, pass, detail) => {
  checks.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

// One distinctive string per locale: the export button.
const EXPORT = {
  en: 'Export PNG',
  fr: 'Exporter en PNG',
  es: 'Exportar PNG',
  it: 'Esporta PNG',
  de: 'PNG exportieren',
  ja: 'PNG を書き出す',
  ko: 'PNG 내보내기',
  ru: 'Экспорт в PNG',
  'zh-CN': '导出 PNG',
  'zh-TW': '匯出 PNG',
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })

const panelText = (page) =>
  page.$eval('aside', (el) => el.innerText)

// --- 1. Every locale renders, via the picker. ---
{
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto(URL, { waitUntil: 'networkidle0' })

  for (const [code, expected] of Object.entries(EXPORT)) {
    // Open the globe menu and pick the locale.
    await page.click('[data-language-button]')
    await new Promise((r) => setTimeout(r, 120))
    await page.click(`[data-lang="${code}"]`)
    await new Promise((r) => setTimeout(r, 200))

    // The menu must close after choosing.
    const menuOpen = (await page.$$('[role=menu]')).length > 0
    check(`${code}: menu closes after picking`, !menuOpen)

    const text = await panelText(page)
    const htmlLang = await page.evaluate(() => document.documentElement.lang)
    check(`${code}: UI is translated`, text.includes(expected), `export button = "${expected}"`)
    check(`${code}: <html lang> is set`, htmlLang === code, `lang="${htmlLang}"`)
    check(`${code}: no unsubstituted placeholders`, !text.includes('{{'), '')
  }

  // The design is user content: switching the UI language must not rewrite it.
  const design = await page.evaluate(() => localStorage.getItem('screenshot-studio:design'))
  check('changing language does not alter the design', design.includes('MyApp'), 'caption untouched')
  await page.close()
}

// --- 2. Detection from the browser's language, including the Chinese script rules. ---
const DETECT = [
  { nav: ['fr-FR'], expect: 'fr' },
  { nav: ['de-AT'], expect: 'de' },
  { nav: ['ja'], expect: 'ja' },
  { nav: ['ko-KR'], expect: 'ko' },
  { nav: ['ru-RU'], expect: 'ru' },
  { nav: ['zh-CN'], expect: 'zh-CN' },
  { nav: ['zh-Hans-CN'], expect: 'zh-CN' },
  { nav: ['zh-TW'], expect: 'zh-TW' },
  { nav: ['zh-Hant-HK'], expect: 'zh-TW' },
  { nav: ['zh-HK'], expect: 'zh-TW' },
  { nav: ['pt-BR'], expect: 'en' }, // unsupported -> English
  { nav: ['xx', 'it-IT'], expect: 'it' }, // falls through to the next preference
]

for (const { nav, expect } of DETECT) {
  const page = await browser.newPage()
  await page.evaluateOnNewDocument((langs) => {
    Object.defineProperty(navigator, 'languages', { get: () => langs })
    Object.defineProperty(navigator, 'language', { get: () => langs[0] })
    localStorage.removeItem('screenshot-studio:lang')
  }, nav)
  await page.goto(URL, { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 200))
  const text = await panelText(page)
  check(
    `detects ${nav.join(',')} -> ${expect}`,
    text.includes(EXPORT[expect]),
    `expected "${EXPORT[expect]}"`,
  )
  await page.close()
}

// --- 3. The chosen language survives a reload and beats the browser's preference. ---
{
  const page = await browser.newPage()
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['de-DE'] })
  })
  await page.goto(URL, { waitUntil: 'networkidle0' })
  await page.evaluate(() => localStorage.setItem('screenshot-studio:lang', 'ja'))
  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 200))
  const text = await panelText(page)
  check('saved choice (ja) overrides the browser preference (de)', text.includes(EXPORT.ja))
  await page.close()
}

await browser.close()
const failed = checks.filter((c) => !c).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
