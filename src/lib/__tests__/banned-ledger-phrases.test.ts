import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.join(process.cwd(), 'src')
const BANNED = ['قيود ' + 'غير مكتملة', 'غير ' + 'متاح بعد', 'قيد ' + 'المطابقة']

function filesUnder(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) out.push(...filesUnder(full))
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(full)
  }
  return out
}

describe('banned ledger phrases', () => {
  it('does not keep the incomplete-ledger, not-yet, or reconciliation phrases in src', () => {
    const hits: string[] = []
    for (const file of filesUnder(ROOT)) {
      const text = readFileSync(file, 'utf8')
      for (const phrase of BANNED) {
        if (text.includes(phrase)) hits.push(`${path.relative(process.cwd(), file)}:${phrase}`)
      }
    }
    expect(hits).toEqual([])
  })
})
