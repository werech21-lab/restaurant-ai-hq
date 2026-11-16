import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ReportBody } from '@/app/erp/ai-brief/report-body'
import { assembleBriefReport, githubIssueDraft, reviewModelText } from '@/server/ai/consensus'
import type { BriefFact } from '@/server/ai/brief-types'

const FACT: BriefFact = {
  id: 'net_sales_kwd|company|2026-11-15',
  metric: 'net_sales_kwd',
  period: '2026-11-15',
  scope: 'company',
  value: '40.5',
  unit: 'KWD',
}

const FORBIDDEN = /api\.github\.com|octokit|vercel\s+--prod|child_process|writeFile/

async function sources(dir: string): Promise<{ rel: string; text: string }[]> {
  const out: { rel: string; text: string }[] = []
  async function walk(current: string) {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === '__tests__' || entry.name === 'node_modules') continue
        await walk(full)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name)) continue
      out.push({ rel: path.relative(process.cwd(), full), text: await readFile(full, 'utf8') })
    }
  }
  await walk(dir)
  return out
}

describe('phase 5 proposals never auto-apply', () => {
  it('stores an app idea as proposed opinion and leaves it unapplied', () => {
    const text = JSON.stringify({
      findings: [{ factIds: [FACT.id], text: 'صافي 40.5' }],
      recommendations: [],
      advisory: [
        { topic: 'app_capability', text: 'أضف صفحة متابعة للفروع المرتبطة.' },
        { topic: 'organization', text: 'رتب المتابعة اليومية.' },
      ],
    })
    const model = reviewModelText({ provider: 'anthropic', modelId: 'claude-test', text, facts: [FACT] })
    const report = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'manual',
      periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
      sections: [],
      facts: [FACT],
      models: [model, { ...model, provider: 'google', modelId: 'gemini-test' }],
    })
    expect(report.proposals).toEqual([])
    expect(report.advisory).toEqual([])
    expect(JSON.stringify(report)).not.toContain('أضف صفحة متابعة للفروع المرتبطة.')
    expect(JSON.stringify(report)).not.toContain('رتب المتابعة اليومية.')
    const draft = githubIssueDraft({
      id: 'draft-1',
      text: 'أضف صفحة متابعة للفروع المرتبطة.',
      provider: 'anthropic',
      modelId: 'claude-test',
      status: 'proposed',
      kind: 'opinion',
    })
    expect(draft).toContain('Status: proposed')
    expect(draft).toContain('Kind: opinion, not an Odoo data finding')
    expect(draft).toContain('A person reviews this draft. The council does not write code and does not deploy.')
    expect(draft).not.toMatch(FORBIDDEN)
  })

  it('exports the draft as text for a person and does not call GitHub', async () => {
    const files = [
      ...(await sources(path.join(process.cwd(), 'src/server/ai'))),
      ...(await sources(path.join(process.cwd(), 'src/app/erp/ai-brief'))),
      ...(await sources(path.join(process.cwd(), 'src/app/api/erp/ai-brief'))),
      ...(await sources(path.join(process.cwd(), 'src/app/api/cron'))),
    ]
    const hits = files.filter((file) => FORBIDDEN.test(file.text)).map((file) => file.rel)
    expect(hits).toEqual([])
    const button = await readFile(path.join(process.cwd(), 'src/app/erp/ai-brief/copy-draft.tsx'), 'utf8')
    expect(button).toContain('navigator.clipboard.writeText')
    expect(button).not.toContain('fetch(')
  })

  it('shows the draft to an executive and hides the export from other roles', () => {
    const reviewed = reviewModelText({
      provider: 'anthropic',
      modelId: 'claude-test',
      text: JSON.stringify({
        findings: [],
        recommendations: [],
        advisory: [{ topic: 'app_capability', text: 'أضف صفحة متابعة للفروع المرتبطة.' }],
      }),
      facts: [FACT],
    })
    const report = assembleBriefReport({
      generatedAt: '2026-11-16T03:00:00.000Z',
      trigger: 'manual',
      periods: { yesterday: '2026-11-15', prior: '2026-11-14' },
      sections: [],
      facts: [FACT],
      models: [reviewed],
    })
    const visible = renderToStaticMarkup(
      createElement(ReportBody, {
        report,
        canExport: true,
        odooBase: null,
        reportHref: '/erp/ai-brief#report-brief-1',
        includeAdminRuns: false,
      }),
    )
    expect(visible).not.toContain('أضف صفحة متابعة للفروع المرتبطة.')
    expect(visible).not.toContain('نسخ مسودة GitHub')
    expect(visible).toContain('لا توجد مقترحات')
    const hidden = renderToStaticMarkup(
      createElement(ReportBody, {
        report,
        canExport: false,
        odooBase: null,
        reportHref: '/erp/ai-brief#report-brief-1',
        includeAdminRuns: false,
      }),
    )
    expect(hidden).not.toContain('نسخ مسودة GitHub')
  })
})
