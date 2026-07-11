/**
 * Generates robots.txt, sitemap.xml and llms.txt into public/ from a single source of
 * truth: VITE_SITE_URL (see .env). Runs automatically before `npm run dev` and
 * `npm run build`, so the site URL only ever has to change in one place.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { readFileSync, existsSync } from 'node:fs'

// Minimal .env read so this works without extra deps.
let siteUrl = process.env.VITE_SITE_URL
if (!siteUrl && existsSync('.env')) {
  const m = /^VITE_SITE_URL=(.*)$/m.exec(readFileSync('.env', 'utf8'))
  if (m) siteUrl = m[1].trim()
}
if (!siteUrl) {
  console.error('gen-seo: VITE_SITE_URL is not set (check .env)')
  process.exit(1)
}
const base = siteUrl.replace(/\/+$/, '')

mkdirSync('public', { recursive: true })

writeFileSync(
  'public/robots.txt',
  `# Screenshot Studio — a static, client-side tool. Everything here is public and crawlable.
User-agent: *
Allow: /

# Assistants: see /llms.txt for a short description of what this tool does.
Sitemap: ${base}/sitemap.xml
`,
)

const today = new Date().toISOString().slice(0, 10)
writeFileSync(
  'public/sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`,
)

writeFileSync(
  'public/llms.txt',
  `# Screenshot Studio

> A free, browser-based generator for App Store marketing screenshots. Drop a raw phone
> screenshot into an iPhone frame, add a caption with a highlighted word, and export a
> ready-to-upload 1242x2688 PNG. It runs entirely client-side: no account, no backend, and
> no image ever leaves the browser.

Screenshot Studio replaces the usual Photoshop/GIMP template workflow for producing the
marketing screenshots that Apple requires on an App Store listing. The panel is rendered on
an HTML canvas at full export resolution, so the on-screen preview is exactly the file you
download.

## What you can control

- Background color of the panel.
- Caption sentence, with explicit line breaks.
- Which word(s) of the caption are drawn in the highlight color, chosen by tapping them.
- Highlight color and text color.
- Font family, size, weight and line height.
- The screenshot itself, uploaded from your device and aspect-filled into the phone's screen.

## Output

- A single PNG at 1242 x 2688 (the App Store 6.5" iPhone size).
- Settings persist in the browser; the uploaded image is not stored anywhere.

## Links

- [Screenshot Studio](${base}/): the tool itself.
`,
)

console.log(`gen-seo: wrote robots.txt, sitemap.xml, llms.txt for ${base}`)
