/**
 * Japanese and Chinese are written without spaces, so a whitespace split would make the
 * whole caption a single unhighlightable chip. These checks pin the segmentation: the
 * caption breaks into real words, each is independently highlightable, and the renderer
 * does NOT inject spaces the language doesn't use.
 *
 * Usage: npm run dev  (in one shell)
 *        node scripts/verify-cjk.mjs
 */
import puppeteer from 'puppeteer-core'
import { resetStorage } from './storage.mjs'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const checks = []
const check = (name, pass, detail) => {
  checks.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' })
await resetStorage(page)
await page.reload({ waitUntil: 'networkidle0' })

const setCaption = async (text) => {
  await page.evaluate((v) => {
    const ta = document.querySelector('textarea')
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(ta, v)
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  }, text)
  await new Promise((r) => setTimeout(r, 300))
}

const chips = () => page.$$eval('[data-word-chip]', (bs) => bs.map((b) => b.textContent))

// Set the highlight to exactly these chip indices, whatever was highlighted before. (A chip
// is "on" when the app has given it an inline background color.)
const setHighlight = async (indices) => {
  await page.evaluate((want) => {
    const all = [...document.querySelectorAll('[data-word-chip]')]
    all.forEach((b, i) => {
      const on = b.style.backgroundColor !== ''
      if (on !== want.includes(i)) b.click()
    })
  }, indices)
  await new Promise((r) => setTimeout(r, 400))
}

// How many pixels of the highlight color appear in the caption band.
const highlightPx = () =>
  page.evaluate(() => {
    const c = document.querySelector('canvas')
    const d = c.getContext('2d').getImageData(0, 0, c.width, 483).data
    let n = 0
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - 0) < 20 && Math.abs(d[i + 1] - 122) < 20 && Math.abs(d[i + 2] - 255) < 20) n++
    }
    return n
  })

const CASES = [
  { lang: 'Japanese', text: '毎日の習慣を記録', minChips: 3 },
  { lang: 'Simplified Chinese', text: '记录你的每日习惯', minChips: 3 },
  { lang: 'Traditional Chinese', text: '記錄你的每日習慣', minChips: 3 },
  { lang: 'Korean', text: '매일 습관을 기록하세요', minChips: 3 },
]

for (const { lang, text, minChips } of CASES) {
  await setCaption(text)
  const cs = await chips()

  check(`${lang}: caption splits into multiple words`, cs.length >= minChips, `${cs.length} chips: ${cs.join(' | ')}`)
  check(`${lang}: chips reassemble into the caption`, cs.join('').replace(/\s/g, '') === text.replace(/\s/g, ''), cs.join(''))

  // Nothing highlighted -> no highlight color anywhere in the caption.
  await setHighlight([])
  const none = await highlightPx()

  // Just the first word.
  await setHighlight([0])
  const one = await highlightPx()

  // Every word.
  await setHighlight(cs.map((_, i) => i))
  const all = await highlightPx()

  check(`${lang}: highlight is off when no word is picked`, none === 0, `${none}px`)
  check(
    `${lang}: a single word can be highlighted on its own`,
    one > 200 && one < all,
    `none=${none}px, 1 word=${one}px, all=${all}px`,
  )

  await setHighlight([])
}

// The renderer must not invent spaces: a CJK caption must be no wider than the glyphs.
await setCaption('毎日の習慣を記録')
const spacing = await page.evaluate(() => {
  const c = document.querySelector('canvas')
  const ctx = c.getContext('2d')
  const d = ctx.getImageData(0, 0, c.width, 483).data
  // Ink bounding box of the caption.
  let minx = 1e9, maxx = -1
  for (let y = 0; y < 483; y++) {
    for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4
      const lit = d[i] > 60 || d[i + 1] > 60 || d[i + 2] > 60
      const bg = d[i] === 0 && d[i + 1] === 16 && d[i + 2] === 39
      if (lit && !bg) {
        if (x < minx) minx = x
        if (x > maxx) maxx = x
      }
    }
  }
  // What the string measures as one run, with no injected spaces.
  ctx.font = '800 119px system-ui, -apple-system, sans-serif'
  const natural = ctx.measureText('毎日の習慣を記録').width
  return { inkWidth: maxx - minx + 1, natural: Math.round(natural) }
})
// 8 glyphs: 7 injected spaces would blow the width out by ~30%+. Allow a small ink/advance delta.
check(
  'no spaces are injected between CJK characters',
  Math.abs(spacing.inkWidth - spacing.natural) < spacing.natural * 0.06,
  `drawn ${spacing.inkWidth}px vs natural ${spacing.natural}px`,
)

// Toggling several chips within one tick must apply every toggle: a closure-based
// update would collapse them and leave the wrong words highlighted.
await setCaption('毎日の習慣を記録')
await page.evaluate(() => {
  const all = [...document.querySelectorAll('[data-word-chip]')]
  all.forEach((b) => b.style.backgroundColor !== '' && b.click()) // clear
})
await new Promise((r) => setTimeout(r, 300))
await page.evaluate(() => {
  // Two toggles, same tick.
  const all = [...document.querySelectorAll('[data-word-chip]')]
  all[0].click()
  all[2].click()
})
await new Promise((r) => setTimeout(r, 400))
const batched = await page.evaluate(() =>
  [...document.querySelectorAll('[data-word-chip]')].map((b) => b.style.backgroundColor !== ''),
)
check(
  'rapid toggles in one tick all apply',
  batched[0] === true && batched[2] === true && batched[1] === false,
  `highlighted = [${batched.map((v, i) => (v ? i : null)).filter((v) => v !== null)}]`,
)

// Latin still behaves: spaces preserved, words separate.
await setCaption('MyApp is the Best App')
const latin = await chips()
check('Latin still splits on words', latin.join(' ') === 'MyApp is the Best App', latin.join(' '))

// Punctuation glues to its word instead of becoming its own chip.
await setCaption('毎日の習慣を記録。')
const punct = await chips()
check('punctuation does not become its own chip', !punct.includes('。') && punct.some((c) => c.includes('。')), punct.join(' | '))

await browser.close()
const failed = checks.filter((c) => !c).length
console.log(`\n${checks.length - failed}/${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
