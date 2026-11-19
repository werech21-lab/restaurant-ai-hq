import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Founder rule: a page, tab, or card with no real source is removed.
 * These phrases are the empty-source card, in both languages.
 * Live "Odoo is down" and "device offline" copy is a different sentence and is not in this list.
 */
const BANNED_PHRASES = [
  'Unlinked from Source',
  'Not Linked to a Source',
  'Not Linked to a Data Source',
  'Not linked to a data source',
  'Not linked to a KDS',
  'Not linked yet',
  'Unlinked source',
  'Unlinked BoM',
  'External Ad Platforms',
  'Influencer Attribution',
  'Source not connected',
  'غير مربوط بمصدر',
  'غير مربوطة بمصدر',
  'المصدر غير مربوط',
  'لا يوجد مصدر',
  'ما في مصدر',
] as const

const SCAN_ROOTS = ['src/app', 'src/components', 'src/modules', 'src/lib'] as const

function walk(dir: string, out: string[]) {
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__' || entry === 'council') continue
    const full = path.join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full, out)
      continue
    }
    if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
}

describe('no empty-source placeholder cards', () => {
  it('keeps /erp/demand-forecast and the real marketing tab', () => {
    const forecast = readFileSync(
      path.resolve(__dirname, '../../app/erp/demand-forecast/page.tsx'),
      'utf8',
    )
    expect(forecast).toContain('DemandForecastPanel')
    const cores = readFileSync(
      path.resolve(__dirname, '../../components/aether/CoresHubStudio.tsx'),
      'utf8',
    )
    expect(cores).toContain('Recorded POS Line Discounts')
    expect(cores).toContain('Manual Campaign Date Window Comparison')
    expect(cores).not.toContain('External Ad Platforms')
    expect(cores).not.toContain('Influencer Attribution')
  })

  it('fails when a rendered page, component, module, or translation contains an empty-source phrase', () => {
    const repo = path.resolve(__dirname, '../../..')
    const files: string[] = []
    for (const root of SCAN_ROOTS) walk(path.join(repo, root), files)
    const hits: string[] = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      for (const phrase of BANNED_PHRASES) {
        if (text.includes(phrase)) hits.push(`${path.relative(repo, file)}: ${phrase}`)
      }
    }
    expect(hits).toEqual([])
  })
})
