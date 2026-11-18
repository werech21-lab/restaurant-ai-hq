/**
 * English mode shows Arabic UI strings through the AR→EN map. The map had machine-garbled entries
 * ("Card ml Leadership — alerts PAM .", "Jahez" for «جاهزة» = ready, "g" for «إجمالي» = total), and the
 * fallback replaced Arabic fragments inside words. These guards keep both from coming back.
 */
import fs from 'node:fs'
import { execSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { COMPREHENSIVE_AR_EN, replaceWholeArabicPhrase, translateArabicText } from '@/lib/i18n/comprehensive-ar-en-map'

const UNIT_WORDS = /(^|\s)(مل|جم|لتر|غ)(\s|$)/
const GARBLE = /(^|\s)(ml|litre|g)(\s|[.,:)]|$)|^\s*[|·—]|\s[|·]\s*$|\(\s*\)/

describe('AR→EN map quality (strings that the UI really renders)', () => {
  const files = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'", { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !f.includes('__tests__') && !f.includes('/i18n/'))
  const corpus = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n')
  const used = Object.entries(COMPREHENSIVE_AR_EN).filter(([ar]) => corpus.includes(ar) && !/test\(|=>|\)\s*return|\.push\(|\?\.\[|\[$|\S\|\S|\|$/.test(ar))

  it('no rendered string translates to unit-fragment garbage (ml / g / litre) or a dangling separator', () => {
    const bad = used.filter(([ar, en]) => GARBLE.test(en) && !UNIT_WORDS.test(ar)).map(([ar, en]) => `${ar} => ${en}`)
    expect(bad).toEqual([])
  })

  it('«جاهز/جاهزة» (ready) is never translated as the Jahez platform unless the text names the platform', () => {
    const bad = used.filter(([ar, en]) => /\bJahez\b/.test(en) && /جاهز[ةا]?(?=[\s.:،]|$)/.test(ar) && !/(طلبات|كيتا|سنونو|ديليفرو)/.test(ar))
    expect(bad.map(([ar, en]) => `${ar} => ${en}`)).toEqual([])
  })
})

describe('translateArabicText', () => {
  it('translates page titles with the brand name', () => {
    expect(translateArabicText('تسجيل الدخول | فنتشر فودز · إيثر لذكاء الأعمال')).toBe('Sign in | Venture Foods · AetherBI')
    expect(translateArabicText('إيثر لذكاء الأعمال | فنتشر فودز')).toBe('AetherBI | Venture Foods')
  })

  it('fixed entries read as proper English', () => {
    expect(translateArabicText('الرسالة جاهزة للنسخ. لا يوجد رقم هاتف صالح للعميل، ولم يُرسل شيء تلقائيًا.')).toBe('The message is ready to copy. The customer has no valid phone number, and nothing was sent automatically.')
    expect(translateArabicText('إجمالي')).toBe('Total')
    expect(translateArabicText('عملاء')).toBe('Customers')
  })

  it('never replaces an Arabic fragment inside a longer word', () => {
    expect(replaceWholeArabicPhrase('عمل كامل', 'مل', 'ml')).toBe('عمل كامل')
    expect(replaceWholeArabicPhrase('الطلبات جاهزة', 'جاهز', 'Jahez')).toBe('الطلبات جاهزة')
    expect(replaceWholeArabicPhrase('مل', 'مل', 'ml')).toBe('ml')
    expect(replaceWholeArabicPhrase('والمخزون', 'المخزون', 'Inventory')).toBe('and Inventory')
  })

  it('leftover punctuation is never shown as a translation', () => {
    expect(translateArabicText('؟؟')).not.toMatch(/^[.|·]/)
  })
})
