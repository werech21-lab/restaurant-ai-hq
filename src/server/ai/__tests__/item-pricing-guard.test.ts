import { describe, expect, it } from 'vitest'
import { guardAnswerAgainstFacts } from '@/server/ai/number-guard'
import { callProvider } from '@/server/ai/providers'
import { runFeryalCouncil, type RunCouncilOptions } from '@/server/ai/council'

const facts = [
  { value: '10.501', metric: 'item_net_kwd', period: '2026-01-01..2026-11-19' },
  { value: '100', metric: 'item_qty' },
  { value: '1', metric: 'item_unit_price_kwd' },
]

describe('numeric guard grounding', () => {
  it('accepts half-up rounding and thousands separators of a verified figure', () => {
    expect(guardAnswerAgainstFacts('الصافي 10.50 د.ك', facts).ok).toBe(true)
    expect(guardAnswerAgainstFacts('الصافي 10.501', facts).ok).toBe(true)
    expect(guardAnswerAgainstFacts('الصافي ١٬٢٣٤٫٥٠', [{ value: '1234.5' }]).ok).toBe(true)
    expect(guardAnswerAgainstFacts('الصافي 10.51', facts).ok).toBe(false)
  })

  it('accepts a labeled user price and the weighted revenue delta, and rejects an unlabeled one', () => {
    const question = 'proposed price for Spring Roll: 1.250'
    const labeled =
      'Odoo Verified Actuals 100 qty at 1.000. Proposed / User Input 1.250. Revenue delta 25.000 KWD.'
    expect(guardAnswerAgainstFacts(labeled, facts, { question }).ok).toBe(true)
    const unlabeled = 'Raise Spring Roll to 1.250 and the delta is 25.000.'
    expect(guardAnswerAgainstFacts(unlabeled, facts, { question }).ok).toBe(false)
    expect(guardAnswerAgainstFacts('هامش 40%', facts, { question }).offending).toContain('40')
  })

  it('does not treat a single-period increase as a direction contradiction', () => {
    const result = guardAnswerAgainstFacts(
      'Proposed / User Input 1.250 would increase revenue by 25.000',
      facts,
      { question: 'proposed price for Spring Roll: 1.250' },
    )
    expect(result.ok).toBe(true)
    expect(result.offending).not.toContain('DIRECTION')
  })
})

describe('google rate limit', () => {
  const input = {
    provider: 'google' as const,
    apiKey: 'test-google-key-00000001',
    model: 'gemini-test',
    system: 'sys',
    user: 'user',
    timeoutMs: 5_000,
  }

  it('retries a 429 and then accepts the next response', async () => {
    let calls = 0
    const result = await callProvider({
      ...input,
      sleepImpl: async () => undefined,
      fetchImpl: async () => {
        calls += 1
        if (calls < 3) return new Response('{}', { status: 429, headers: { 'retry-after': '0' } })
        return new Response(
          JSON.stringify({
            modelVersion: 'gemini-test',
            candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }],
            usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
          }),
          { status: 200 },
        )
      },
    })
    expect(calls).toBe(3)
    expect(result.status).toBe('ok')
    expect(result.errorCode).toBeNull()
    expect(result.text).toContain('ok')
  })

  it('stops at HTTP_RATE_LIMIT when every attempt is refused', async () => {
    let calls = 0
    const result = await callProvider({
      ...input,
      sleepImpl: async () => undefined,
      fetchImpl: async () => {
        calls += 1
        return new Response('{}', { status: 429 })
      },
    })
    expect(calls).toBe(3)
    expect(result).toMatchObject({ status: 'error', errorCode: 'HTTP_RATE_LIMIT' })
  })

  it('does not retry a non-Google 429', async () => {
    let calls = 0
    const result = await callProvider({
      ...input,
      provider: 'anthropic',
      apiKey: 'test-anthropic-key-0001',
      sleepImpl: async () => {
        throw new Error('should not sleep')
      },
      fetchImpl: async () => {
        calls += 1
        return new Response('{}', { status: 429 })
      },
    })
    expect(calls).toBe(1)
    expect(result.errorCode).toBe('HTTP_RATE_LIMIT')
  })
})

describe('council grounded explanation', () => {
  it('does not mark a rounded verified figure as GUARD_REJECTED', async () => {
    const agreed = JSON.stringify({
      comparison: {
        subject_id: 'avenues',
        relation: 'better',
        object_id: 'salmiya',
        metric: 'net_sales',
        cited_fact_ids: ['fact-net', 'fact-salmiya'],
      },
    })
    const fetchImpl: typeof fetch = async (url) => {
      const host = String(url)
      const text = host.includes('generativelanguage') ? 'الصافي 10.50' : agreed
      if (host.includes('api.anthropic.com')) {
        return new Response(
          JSON.stringify({ model: 'claude-sonnet-4-6', content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 } }),
          { status: 200 },
        )
      }
      if (host.includes('generativelanguage')) {
        return new Response(
          JSON.stringify({
            modelVersion: 'gemini',
            candidates: [{ content: { parts: [{ text }] } }],
            usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
          }),
          { status: 200 },
        )
      }
      return new Response(
        JSON.stringify({ model: 'grok', choices: [{ message: { content: text } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }),
        { status: 200 },
      )
    }
    const askOdoo = async () => ({
      reply: 'صافي المبيعات 10.5',
      status: 'answered' as const,
      executedQueries: [],
      verifier: { valid: true, extractedNumbers: [10.5], unverifiedNumbers: [] },
      toolNumbers: [10.5],
      period: { from: '2026-11-15', to: '2026-11-15' },
      source: null,
      facts: [
        {
          id: 'fact-net',
          metric: 'net_sales',
          period: '2026-11-15',
          date: '2026-11-15',
          unit: 'KWD',
          value: '10.5',
          entityType: 'branch',
          entityId: 'avenues',
          entityName: 'avenues',
        },
        {
          id: 'fact-salmiya',
          metric: 'net_sales',
          period: '2026-11-15',
          date: '2026-11-15',
          unit: 'KWD',
          value: '4',
          entityType: 'branch',
          entityId: 'salmiya',
          entityName: 'salmiya',
        },
      ],
      auditEntry: null,
    })
    const result = await runFeryalCouncil(
      { question: 'كم صافي المبيعات؟', userId: 'user-1' },
      {
        askOdoo: askOdoo as unknown as RunCouncilOptions['askOdoo'],
        fetchImpl,
        sleepImpl: async () => undefined,
        timeoutMs: 1_000,
        keys: { anthropic: 'test-anthropic-key-0001', google: 'test-google-key-00000001', xai: 'test-grok-key-0000000001' },
        models: { anthropic: 'claude-sonnet-4-6', google: 'gemini', xai: 'grok-4.5' },
        persist: async () => undefined,
      },
    )
    const google = result.participants.find((item) => item.provider === 'google')
    expect(google?.errorCode).not.toBe('GUARD_REJECTED')
    expect(google?.status).toBe('ok')
    expect(result.reply).not.toContain('AI analytical explanation is currently unavailable')
  })
})
