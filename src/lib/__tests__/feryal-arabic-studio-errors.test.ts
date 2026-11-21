import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FERYAL_DOCUMENT_UPLOAD_CONNECTION_ERROR_AR,
  FERYAL_LATIN_FREE_STUDIO_ERRORS,
  FERYAL_PRICE_SHEET_EXTRACT_ERROR_AR,
  FERYAL_QUERY_LOG_LOAD_ERROR_AR,
  FERYAL_REMATCH_CONNECTION_ERROR_AR,
  FERYAL_REMATCH_LAST_30_DAYS_ERROR_AR,
  FERYAL_RERUN_SIMULATION_ERROR_AR,
  FERYAL_GOVERNANCE_ALERTS_LOAD_ERROR_AR,
  FERYAL_UNSUPPORTED_INTAKE_FILE_ERROR_AR,
  FERYAL_VISUAL_ATTACHMENT_ERROR_AR,
} from '@/components/erp/feryal-studio-errors'
import {
  buildFeryalConnectionErrorOutcome,
  FERYAL_CONNECTION_ERROR_AR,
  FERYAL_CONNECTION_ERROR_EN,
} from '@/lib/feryal-intent'

const LATIN_LETTERS = /[A-Za-z]/
const CONNECTION_ERROR_BADGE_AR = 'تعذّر الاتصال'

const STUDIO_PATH = path.join(process.cwd(), 'src/components/erp/feryal-governance-studio.tsx')

describe('Feryal studio failures stay Arabic', () => {
  it('returns the Arabic connection outcome for both locales and keeps the English constant exported', () => {
    expect(FERYAL_CONNECTION_ERROR_EN).toBe(FERYAL_CONNECTION_ERROR_AR)
    for (const isAr of [true, false]) {
      const outcome = buildFeryalConnectionErrorOutcome(isAr)
      expect(outcome.replyText).toBe(FERYAL_CONNECTION_ERROR_AR)
      expect(outcome.modelBadge).toBe(CONNECTION_ERROR_BADGE_AR)
      expect(outcome.replyStatus).toBe('connection_error')
    }
  })

  it('contains no Latin letters in the connection outcome or the studio failure copy', () => {
    const texts = [
      ...FERYAL_LATIN_FREE_STUDIO_ERRORS,
      buildFeryalConnectionErrorOutcome(true).replyText,
      buildFeryalConnectionErrorOutcome(true).modelBadge,
      buildFeryalConnectionErrorOutcome(false).replyText,
      buildFeryalConnectionErrorOutcome(false).modelBadge,
    ]
    expect(texts.length).toBeGreaterThan(0)
    for (const text of texts) {
      expect(text).not.toMatch(LATIN_LETTERS)
    }
    expect(FERYAL_DOCUMENT_UPLOAD_CONNECTION_ERROR_AR).toBe(
      'تعذّر الاتصال بخدمة استخراج الجداول — أعد المحاولة.',
    )
    expect(FERYAL_REMATCH_LAST_30_DAYS_ERROR_AR).toBe(
      'تعذّر إعادة مطابقة الأصناف على آخر 30 يوماً — يرجى المحاولة مرة أخرى.',
    )
    expect(FERYAL_REMATCH_CONNECTION_ERROR_AR).toBe(
      'تعذّر الاتصال لإعادة المطابقة على آخر 30 يوماً — أعد المحاولة.',
    )
    expect(FERYAL_RERUN_SIMULATION_ERROR_AR).toBe(
      'تعذّر إعادة التشغيل على آخر 30 يوماً — يرجى المحاولة مرة أخرى.',
    )
    expect(FERYAL_VISUAL_ATTACHMENT_ERROR_AR).toBe('تعذر تجهيز المرفق البصري.')
    expect(FERYAL_PRICE_SHEET_EXTRACT_ERROR_AR).toContain('تعذّر استخراج جدول الأسعار')
    expect(FERYAL_GOVERNANCE_ALERTS_LOAD_ERROR_AR).toBe('تعذّر جلب تنبيهات الحوكمة حالياً')
    expect(FERYAL_QUERY_LOG_LOAD_ERROR_AR).toBe('تعذّر تحميل سجل الاستعلامات حالياً')
    expect(FERYAL_LATIN_FREE_STUDIO_ERRORS).not.toContain(FERYAL_UNSUPPORTED_INTAKE_FILE_ERROR_AR)
    expect(FERYAL_UNSUPPORTED_INTAKE_FILE_ERROR_AR).toMatch(/\.xlsx/)
  })

  it('studio catch and error notices no longer switch to an English sentence', () => {
    const studio = readFileSync(STUDIO_PATH, 'utf8')
    const removedEnglish = [
      'Could not process visual attachment.',
      'Could not extract price rows from the uploaded file',
      'Connection failed while uploading document',
      'Unsupported file format',
      'Could not re-match items on Last 30 Days',
      'Connection failed while re-matching on Last 30 Days',
      'Could not re-run simulation on Last 30 Days',
      'Unable to load governance alerts right now',
      'Unable to load Odoo query log right now',
    ]
    for (const english of removedEnglish) {
      expect(studio).not.toContain(english)
    }
    expect(studio).toContain('FERYAL_DOCUMENT_UPLOAD_CONNECTION_ERROR_AR')
    expect(studio).toContain('FERYAL_REMATCH_LAST_30_DAYS_ERROR_AR')
    expect(studio).toContain('FERYAL_REMATCH_CONNECTION_ERROR_AR')
    expect(studio).toContain('FERYAL_RERUN_SIMULATION_ERROR_AR')
    expect(studio).toContain('FERYAL_UNSUPPORTED_INTAKE_FILE_ERROR_AR')
    expect(studio).toContain('FERYAL_VISUAL_ATTACHMENT_ERROR_AR')
    expect(studio).toContain('FERYAL_PRICE_SHEET_EXTRACT_ERROR_AR')
    expect(studio).toContain('FERYAL_GOVERNANCE_ALERTS_LOAD_ERROR_AR')
    expect(studio).toContain('FERYAL_QUERY_LOG_LOAD_ERROR_AR')
  })
})
