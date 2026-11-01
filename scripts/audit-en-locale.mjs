/**
 * Zero-Arabic-in-EN audit for landing dictionary keys + landing component.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const i18nPath = path.join(root, 'src/lib/i18n.tsx')
const landingPath = path.join(root, 'src/components/marketing/AetherLanding.tsx')
const arabicRe = /[\u0600-\u06FF]/

const source = fs.readFileSync(i18nPath, 'utf8')
const enStart = source.indexOf('\nconst en:')
const altStart = source.indexOf('\nconst en =')
const start = enStart >= 0 ? enStart : altStart
if (start < 0) {
  console.error('FAIL: could not locate English dictionary')
  process.exit(1)
}

const keys = [
  'land.hero.bullet1',
  'land.hero.bullet2',
  'land.hero.bullet3',
  'land.feat.finance.title',
  'land.feat.inventory.title',
  'land.feat.pos.title',
  'land.feat.hr.title',
  'land.feat.crm.title',
  'land.feat.ai.title',
  'land.plan.enterprise.price',
  'land.plan.perMonth',
  'land.footer',
]

let failures = 0
const chunk = source.slice(start)
for (const key of keys) {
  const re = new RegExp(`'${key.replace(/\./g, '\\.')}':\\s*'([^']*)'`)
  const match = chunk.match(re)
  if (!match) {
    console.error(`FAIL: missing EN key ${key}`)
    failures += 1
    continue
  }
  if (arabicRe.test(match[1])) {
    console.error(`FAIL: Arabic leak in EN key ${key}: ${match[1]}`)
    failures += 1
  } else {
    console.log(`OK  ${key}`)
  }
}

const landing = fs.readFileSync(landingPath, 'utf8')
const literalAr = landing.match(/['"`][^'"`]*[\u0600-\u06FF][^'"`]*['"`]/g) || []
const suspicious = literalAr.filter((s) => !s.includes('land.') && !s.includes('t('))
if (suspicious.length) {
  console.error('FAIL: hardcoded Arabic literals in AetherLanding.tsx:')
  for (const s of suspicious.slice(0, 20)) console.error('  ', s)
  failures += suspicious.length
} else {
  console.log('OK  AetherLanding has no hardcoded Arabic string literals')
}

if (failures > 0) {
  console.error(`\nAudit failed with ${failures} issue(s).`)
  process.exit(1)
}
console.log('\nEN locale audit passed.')
