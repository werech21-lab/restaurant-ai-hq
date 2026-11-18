import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { AdvisorReport } from '@/lib/feryal-context-types'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'

// TODO(advisor-council): Build scheduled background advisor generation cron storing CFO, Delivery, HR, Inventory & Seasons AdvisorReport rows in Prisma.

const DEFAULT_COMPANY_CONTEXT_REL_PATH = path.join('src', 'content', 'feryal', 'company-context.md')

const advisorReportSchema = z.object({
  advisor: z.enum(['cfo', 'delivery', 'hr', 'inventory', 'seasons']),
  period: z.object({
    from: z.string().trim().min(1),
    to: z.string().trim().min(1),
  }),
  evidence: z.array(
    z.object({
      text: z.string().trim().min(1),
      numbers: z.array(
        z.object({
          value: z.number().finite(),
          section: z.string().trim().min(1),
        }),
      ),
      section: z.string().trim().min(1),
    }),
  ),
  rootCauses: z.array(
    z.object({
      text: z.string().trim().min(1),
      kind: z.literal('hypothesis'),
    }),
  ),
  proposals: z.array(
    z.object({
      text: z.string().trim().min(1),
      owner: z.string().trim().min(1).optional(),
      kind: z.literal('proposal'),
    }),
  ),
})

const companyContextCache = new Map<string, { mtimeMs: number; content: string }>()

export function clearFeryalCompanyContextCache(): void {
  companyContextCache.clear()
}

function sanitizeAdvisorReport(report: AdvisorReport): AdvisorReport {
  return {
    advisor: report.advisor,
    period: { from: report.period.from, to: report.period.to },
    evidence: report.evidence.filter((item) => !isExcludedOdooEntity(item.text)),
    rootCauses: report.rootCauses.filter((item) => !isExcludedOdooEntity(item.text)),
    proposals: report.proposals.filter(
      (item) => !isExcludedOdooEntity(item.text) && !isExcludedOdooEntity(item.owner),
    ),
  }
}

/**
 * Loads the latest structured Advisor Council reports (CFO, Delivery, HR, Inventory, Seasons).
 * Until the scheduled background advisor cron + Prisma table are added, returns `[]` safely
 * (or parses validated reports when provided via `storedReports`).
 */
export async function loadLatestAdvisorReports(storedReports?: unknown): Promise<AdvisorReport[]> {
  if (!Array.isArray(storedReports) || storedReports.length === 0) {
    return []
  }

  const reports: AdvisorReport[] = []
  for (const raw of storedReports) {
    const parsed = advisorReportSchema.safeParse(raw)
    if (parsed.success) {
      reports.push(sanitizeAdvisorReport(parsed.data))
    }
  }
  return reports
}

/**
 * Reads Venture Foods strategic company context markdown with mtime-checked memory caching
 * and graceful empty-string fallback if the file is absent or unreadable.
 */
export function loadFeryalCompanyContext(customPath?: string): string {
  const targetPath = customPath
    ? path.resolve(customPath)
    : path.resolve(process.cwd(), DEFAULT_COMPANY_CONTEXT_REL_PATH)

  try {
    const stat = statSync(targetPath)
    if (!stat.isFile()) return ''
    const cached = companyContextCache.get(targetPath)
    if (cached && cached.mtimeMs === stat.mtimeMs) {
      return cached.content
    }
    const content = readFileSync(targetPath, 'utf8').trim()
    companyContextCache.set(targetPath, { mtimeMs: stat.mtimeMs, content })
    return content
  } catch {
    return ''
  }
}
