import { describe, expect, it } from 'vitest'
import {
  detectTargetChannelFromQuestion,
  normalizeArabicText,
  resolveFeryalQuestionPeriod,
} from '@/lib/feryal-intent'

// 12:00 Asia/Kuwait on 2026-11-15
const NOW = Date.parse('2026-11-15T09:00:00.000Z')

describe('Phase 5 · Item 3 — Feryal Gulf/Kuwaiti dialect', () => {
  it('canonicalises colloquial period words', () => {
    expect(normalizeArabicText('كم مبيعات امبارح؟')).toContain('امس')
    expect(normalizeArabicText('مبيعات هالشهر')).toContain('هذا الشهر')
    expect(normalizeArabicText('هالاسبوع')).toBe('هذا الاسبوع')
  })

  it('"امبارح" resolves to yesterday (Kuwait time)', () => {
    const p = resolveFeryalQuestionPeriod('كم مبيعات امبارح؟', NOW)
    expect(p.from).toBe('2026-11-14')
    expect(p.to).toBe('2026-11-14')
  })

  it('"هالشهر" resolves to the current month window', () => {
    const p = resolveFeryalQuestionPeriod('كم مبيعات هالشهر؟', NOW)
    expect(p.from).toBe('2026-11-01')
  })

  it('bare TGO / TMP and Keeta spellings map to their channels', () => {
    expect(detectTargetChannelFromQuestion('كم مبيعات TGO امبارح').channelId).toBe('talabat-tgo')
    expect(detectTargetChannelFromQuestion('طلبات TMP هالشهر').channelId).toBe('talabat-tmp')
    expect(detectTargetChannelFromQuestion('مبيعات كيتا اليوم').channelId).toBe('keeta')
    expect(detectTargetChannelFromQuestion('مبيعات كييتا اليوم').channelId).toBe('keeta')
  })

  it('does not double-prefix already-qualified Talabat codes', () => {
    expect(normalizeArabicText('talabat tgo')).toBe('talabat tgo')
    expect(normalizeArabicText('talabat-tgo')).toBe('talabat-tgo')
  })
})
