import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'
import { canTriggerManualOdooSync } from '@/lib/auth/role-access-policy'
import { GET as cronGet } from '@/app/api/cron/ai-daily-brief/route'
import { RunBriefButton } from '@/app/erp/ai-brief/run-button'
import { isBackgroundAnalysisEnabled, missingCouncilKeyNames } from '@/server/ai/env'
import { MANUAL_RUN_COOLDOWN_MS, latestManualAtMs, manualRetryAt } from '@/server/ai/manual-run'
import { callProvider, type ProviderId } from '@/server/ai/providers'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => undefined }),
}))

const KEY = 'phase-two-test-key-0001'
const ORIGINAL_CRON = process.env.CRON_SECRET
const ORIGINAL_FLAG = process.env.AI_DAILY_BRIEF_ENABLED

afterEach(() => {
  if (ORIGINAL_CRON == null) delete process.env.CRON_SECRET
  else process.env.CRON_SECRET = ORIGINAL_CRON
  if (ORIGINAL_FLAG == null) delete process.env.AI_DAILY_BRIEF_ENABLED
  else process.env.AI_DAILY_BRIEF_ENABLED = ORIGINAL_FLAG
})

function providerPayload(provider: ProviderId): unknown {
  if (provider === 'anthropic') {
    return { model: 'claude-test', content: [{ type: 'text', text: 'noted' }] }
  }
  if (provider === 'google') {
    return { modelVersion: 'gemini-test', candidates: [{ content: { parts: [{ text: 'noted' }] } }] }
  }
  return { model: 'grok-test', choices: [{ message: { content: 'noted' } }] }
}

describe('phase 2 background council', () => {
  it('schedules the morning analysis at 06:00 Asia/Kuwait', async () => {
    const raw = await readFile(path.join(process.cwd(), 'vercel.json'), 'utf8')
    const body = JSON.parse(raw) as { crons: { path: string; schedule: string }[] }
    const job = body.crons.find((cron) => cron.path === '/api/cron/ai-daily-brief')
    expect(job?.schedule).toBe('0 3 * * *')
  })

  it('keeps the daily job on unless the flag is explicitly off', () => {
    expect(isBackgroundAnalysisEnabled('')).toBe(true)
    expect(isBackgroundAnalysisEnabled(undefined)).toBe(true)
    expect(isBackgroundAnalysisEnabled('0')).toBe(false)
    expect(isBackgroundAnalysisEnabled('off')).toBe(false)
  })

  it('refuses the cron without its secret and skips the run when the flag is off', async () => {
    delete process.env.CRON_SECRET
    const denied = await cronGet(new NextRequest('https://app.example/api/cron/ai-daily-brief'))
    expect(denied.status).toBe(401)

    process.env.CRON_SECRET = 'phase-two-cron-secret'
    process.env.AI_DAILY_BRIEF_ENABLED = '0'
    const skipped = await cronGet(
      new NextRequest('https://app.example/api/cron/ai-daily-brief', {
        headers: { authorization: 'Bearer phase-two-cron-secret' },
      }),
    )
    expect(skipped.status).toBe(200)
    await expect(skipped.json()).resolves.toMatchObject({ ok: true, skipped: true })
  })

  it('does not apply the manual cooldown to the scheduled route', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/app/api/cron/ai-daily-brief/route.ts'), 'utf8')
    expect(source).toContain("trigger: 'schedule'")
    expect(source).not.toContain('manualRetryAt')
    expect(source).not.toContain('RATE_LIMIT')
  })

  it('calls Claude, Gemini, and Grok on the server and skips a missing key', async () => {
    const seen: string[] = []
    const fetchImpl: typeof fetch = async (input) => {
      seen.push(String(input))
      const provider = seen.length === 1 ? 'anthropic' : seen.length === 2 ? 'google' : 'xai'
      return new Response(JSON.stringify(providerPayload(provider)), { status: 200 })
    }
    const shared = { apiKey: KEY, model: 'configured-model', system: 'system', user: 'user', timeoutMs: 1000, fetchImpl }
    const anthropic = await callProvider({ ...shared, provider: 'anthropic' })
    const google = await callProvider({ ...shared, provider: 'google', fetchImpl: async (input) => {
      seen.push(String(input))
      return new Response(JSON.stringify(providerPayload('google')), { status: 200 })
    } })
    const xai = await callProvider({ ...shared, provider: 'xai', fetchImpl: async (input) => {
      seen.push(String(input))
      return new Response(JSON.stringify(providerPayload('xai')), { status: 200 })
    } })
    expect(anthropic.modelId).toBe('claude-test')
    expect(google.modelId).toBe('gemini-test')
    expect(xai.modelId).toBe('grok-test')
    expect(seen.some((url) => url.startsWith('https://api.anthropic.com/'))).toBe(true)
    expect(seen.some((url) => url.startsWith('https://generativelanguage.googleapis.com/'))).toBe(true)
    expect(seen.some((url) => url.startsWith('https://api.x.ai/'))).toBe(true)

    const calls: string[] = []
    const skipped = await callProvider({
      ...shared,
      provider: 'anthropic',
      apiKey: 'short',
      fetchImpl: async (input) => {
        calls.push(String(input))
        return new Response('{}')
      },
    })
    expect(skipped.status).toBe('error')
    expect(skipped.errorCode).toBe('MISSING_API_KEY')
    expect(calls).toEqual([])
    expect(missingCouncilKeyNames({ anthropic: '', google: '', xai: '' })).toEqual([
      'ANTHROPIC_API_KEY',
      'GEMINI_API_KEY',
      'XAI_API_KEY',
    ])
  })

  it('limits a manual run to executives and to once every ten minutes', async () => {
    const route = await readFile(path.join(process.cwd(), 'src/app/api/erp/ai-brief/run/route.ts'), 'utf8')
    expect(route).toContain("trigger: 'manual'")
    expect(route).toContain('canTriggerManualOdooSync')
    expect(MANUAL_RUN_COOLDOWN_MS).toBe(10 * 60 * 1000)
    for (const role of ['admin', 'gm', 'dgm', 'ops', 'cfo'] as const) {
      expect(canTriggerManualOdooSync(role)).toBe(true)
    }
    for (const role of ['marketing', 'supply', 'auditor'] as const) {
      expect(canTriggerManualOdooSync(role)).toBe(false)
    }
    const now = Date.parse('2026-11-16T03:00:00.000Z')
    const rows = [
      { createdAtMs: now - 60_000, trigger: 'schedule' as const },
      { createdAtMs: now - 60_000, trigger: 'manual' as const },
    ]
    expect(latestManualAtMs(rows)).toBe(now - 60_000)
    expect(manualRetryAt(latestManualAtMs(rows), now)).toBe(new Date(now - 60_000 + MANUAL_RUN_COOLDOWN_MS).toISOString())
    expect(manualRetryAt(latestManualAtMs([{ createdAtMs: now - 60_000, trigger: 'schedule' }]), now)).toBeNull()
  })

  it('renders the manual run button against the executive route', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/app/erp/ai-brief/run-button.tsx'), 'utf8')
    expect(source).toContain("fetch('/api/erp/ai-brief/run', { method: 'POST' })")
    const idle = renderToStaticMarkup(createElement(RunBriefButton, { retryAt: null }))
    expect(idle).toContain('تشغيل التحليل الآن')
    const later = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    const cooling = renderToStaticMarkup(createElement(RunBriefButton, { retryAt: later }))
    expect(cooling).toContain('disabled')
    expect(cooling).toContain('التشغيل اليدوي متاح عند')
  })
})
