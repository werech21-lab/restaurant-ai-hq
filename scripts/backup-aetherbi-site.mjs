/**
 * Pulls https://www.aetherbi.com into aetherbi-website-backup/ for local archival.
 * Usage: node scripts/backup-aetherbi-site.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'aetherbi-website-backup')
const origin = 'https://www.aetherbi.com'

await mkdir(outDir, { recursive: true })
await mkdir(path.join(outDir, 'assets'), { recursive: true })

const home = await fetch(origin, { redirect: 'follow' })
if (!home.ok) throw new Error(`Homepage fetch failed: ${home.status}`)
const html = await home.text()
await writeFile(path.join(outDir, 'index.html'), html, 'utf8')

const assetUrls = new Set()
for (const match of html.matchAll(/(?:href|src)="(\/_next\/[^"]+)"/g)) {
  assetUrls.add(match[1])
}

const downloaded = []
for (const rel of [...assetUrls].slice(0, 40)) {
  try {
    const res = await fetch(new URL(rel, origin))
    if (!res.ok) continue
    const name = rel.replace(/\?.*$/, '').replace(/\//g, '__').replace(/^__/, '')
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(path.join(outDir, 'assets', name), buf)
    downloaded.push({ rel, bytes: buf.length, status: res.status })
  } catch (error) {
    downloaded.push({ rel, error: error instanceof Error ? error.message : String(error) })
  }
}

const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? ''
const description = html.match(/name="description" content="([^"]*)"/)?.[1] ?? ''
const branding = {
  capturedAt: new Date().toISOString(),
  origin,
  title,
  description,
  lang: html.includes('lang="ar"') ? 'ar' : 'unknown',
  dir: html.includes('dir="rtl"') ? 'rtl' : 'ltr',
  theme: html.includes('data-theme="dark"') ? 'dark' : 'unknown',
  assetCount: downloaded.length,
  downloaded,
  visualIdentity: {
    primaryFont: 'Cairo',
    paletteHint: ['ink-950', 'gold accents', 'mist text', 'dark executive BI'],
    productName: 'Aether BI / AetherBI',
  },
}
await writeFile(path.join(outDir, 'branding.json'), JSON.stringify(branding, null, 2), 'utf8')
process.stdout.write(`Backed up ${origin} → ${outDir} (${downloaded.length} assets)\n`)
