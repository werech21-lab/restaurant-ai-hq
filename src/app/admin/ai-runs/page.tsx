import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SectionCard } from '@/components/ui/section-card'
import { StateBlock } from '@/components/ui/state-block'
import { EXEC_SESSION_COOKIE, verifyExecSessionToken } from '@/lib/auth/exec-session'
import {
  UNAVAILABLE_DASH,
  formatDateTime,
  formatInt,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { getLocale, tx } from '@/lib/i18n/server'
import { safeListAiRuns, type ListedAiRun, type ListedDailyBrief } from '@/server/ai/persist'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: tx(locale, 'سجل تحليل فريال | AetherBI', 'Feryal AI Run Log | AetherBI'),
  }
}

function statusLabel(status: ListedAiRun['status'], isAr: boolean): string {
  if (status === 'ok') return isAr ? 'مكتمل' : 'ok'
  if (status === 'guard_rejected') return isAr ? 'مرفوض رقابياً' : 'guard_rejected'
  return isAr ? 'خطأ' : 'error'
}

function UnavailableSpan({ tooltip }: { tooltip: string }) {
  return (
    <span
      dir="ltr"
      title={tooltip}
      aria-label={tooltip}
      data-unavailable="true"
      className="ds-num tabular-nums"
      style={{ color: 'var(--ds-unavailable)' }}
    >
      {UNAVAILABLE_DASH}
    </span>
  )
}

export default async function AiRunsPage() {
  const jar = await cookies()
  const session = await verifyExecSessionToken(jar.get(EXEC_SESSION_COOKIE)?.value)
  if (!session) redirect('/login')

  const locale = await getLocale()
  const isAr = locale !== 'en'
  const fmtLocale: FormatLocale = isAr ? 'ar' : 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const unavailableTooltip = getUnavailableTooltip(fmtLocale)

  if (session.role !== 'admin') {
    return (
      <div className="min-h-screen bg-[var(--ds-bg-canvas)] text-[var(--ds-text-primary)]">
        <main className="mx-auto min-w-0 w-full max-w-5xl px-4 py-8" dir={dir}>
          <h1 className="mb-4 text-xl font-black text-[var(--ds-text-primary)]">
            {isAr ? 'سجل تحليل فريال' : 'Feryal AI Run Log'}
          </h1>
          <StateBlock
            state="forbidden"
            locale={fmtLocale}
            title={isAr ? 'هذه الصفحة لمسؤول النظام فقط.' : 'This page is restricted to administrators.'}
          />
        </main>
      </div>
    )
  }

  const { runs, brief, error, source } = await safeListAiRuns(100)

  return (
    <div className="min-h-screen bg-[var(--ds-bg-canvas)] text-[var(--ds-text-primary)]">
      <main className="mx-auto min-w-0 w-full max-w-6xl space-y-5 px-4 py-8" dir={dir}>
        <div className="ds-surface rounded-2xl p-4 sm:p-6">
          <h1 className="text-xl font-black text-[var(--ds-text-primary)]">
            {isAr ? 'سجل تحليل فريال' : 'Feryal AI Run Log'}
          </h1>
          <p className="mt-2 text-sm text-[var(--ds-text-muted)]">
            {isAr
              ? 'كل صف هو استدعاء مزود واحد. معرّف النموذج هو القيمة التي أرجعتها واجهة المزود. التكلفة تقدير بالميكرو دولار.'
              : 'Each row records a single provider invocation. Model ID reflects the provider response. Estimated cost is reported in micro-USD.'}{' '}
            {source === 'postgres'
              ? isAr
                ? 'المصدر: Postgres.'
                : 'Source: Postgres.'
              : isAr
                ? 'المصدر: قاعدة اللوحة (ترحيل 0047 يضيف الجدول على Postgres عند تطبيقه).'
                : 'Source: panel database (migration 0047 adds the Postgres table when applied).'}
          </p>
        </div>

        <BriefPanel brief={brief} locale={fmtLocale} />

        {error ? (
          <StateBlock
            state="error"
            locale={fmtLocale}
            title={isAr ? 'تعذّر قراءة السجل حالياً' : 'Unable to read AI run log'}
            description={
              isAr
                ? 'حدث خلل مؤقت أثناء استعلام سجل التشغيل.'
                : 'A temporary error occurred while reading run telemetry.'
            }
          />
        ) : runs.length === 0 ? (
          <StateBlock
            state="empty"
            locale={fmtLocale}
            title={isAr ? 'لا توجد عمليات تحليل بعد' : 'No AI runs recorded yet'}
          />
        ) : (
          <SectionCard
            title={
              <span className="flex flex-wrap items-center gap-2">
                <span>{isAr ? 'سجل الاستدعاءات' : 'Invocation History'}</span>
                <span
                  dir="ltr"
                  className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-2.5 py-0.5 text-xs font-bold tabular-nums"
                >
                  {formatInt(runs.length, fmtLocale)}
                </span>
              </span>
            }
            locale={fmtLocale}
            padded={false}
          >
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-start text-xs">
                <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] text-[var(--ds-text-secondary)]">
                  <tr>
                    <th className="px-3 py-2.5 text-start font-bold">
                      {isAr ? 'الوقت (الكويت)' : 'Time (Kuwait)'}
                    </th>
                    <th className="px-3 py-2.5 text-start font-bold">
                      {isAr ? 'المستخدم' : 'User'}
                    </th>
                    <th className="px-3 py-2.5 text-start font-bold">
                      {isAr ? 'بصمة السؤال' : 'Prompt Hash'}
                    </th>
                    <th className="px-3 py-2.5 text-start font-bold">
                      {isAr ? 'المزود' : 'Provider'}
                    </th>
                    <th className="px-3 py-2.5 text-start font-bold">
                      {isAr ? 'النموذج' : 'Model'}
                    </th>
                    <th className="px-3 py-2.5 text-end font-bold">
                      {isAr ? 'زمن الاستجابة' : 'Latency (ms)'}
                    </th>
                    <th className="px-3 py-2.5 text-end font-bold">
                      {isAr ? 'الدخول' : 'Tokens In'}
                    </th>
                    <th className="px-3 py-2.5 text-end font-bold">
                      {isAr ? 'الخروج' : 'Tokens Out'}
                    </th>
                    <th className="px-3 py-2.5 text-end font-bold">
                      {isAr ? 'التكلفة التقديرية (µUSD)' : 'Est. Cost (µUSD)'}
                    </th>
                    <th className="px-3 py-2.5 text-start font-bold">
                      {isAr ? 'الحالة' : 'Status'}
                    </th>
                    <th className="px-3 py-2.5 text-start font-bold">
                      {isAr ? 'الخطأ' : 'Error'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ds-border-hairline)] text-[var(--ds-text-primary)]">
                  {runs.map((run) => (
                    <tr key={run.id} className="hover:bg-[var(--ds-bg-hover)]">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span dir="ltr" className="ds-num tabular-nums">
                          {formatDateTime(run.createdAt, fmtLocale)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">{run.userId || <UnavailableSpan tooltip={unavailableTooltip} />}</td>
                      <td className="px-3 py-2.5 font-mono">
                        <span dir="ltr">{run.questionHash.slice(0, 12)}</span>
                      </td>
                      <td className="px-3 py-2.5">{run.provider}</td>
                      <td className="px-3 py-2.5 font-mono">
                        {run.modelId ? <span dir="ltr">{run.modelId}</span> : <UnavailableSpan tooltip={unavailableTooltip} />}
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        <span dir="ltr" className="ds-num tabular-nums">
                          {formatInt(run.latencyMs, fmtLocale)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        {run.tokensIn !== null && run.tokensIn !== undefined ? (
                          <span dir="ltr" className="ds-num tabular-nums">
                            {formatInt(run.tokensIn, fmtLocale)}
                          </span>
                        ) : (
                          <UnavailableSpan tooltip={unavailableTooltip} />
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        {run.tokensOut !== null && run.tokensOut !== undefined ? (
                          <span dir="ltr" className="ds-num tabular-nums">
                            {formatInt(run.tokensOut, fmtLocale)}
                          </span>
                        ) : (
                          <UnavailableSpan tooltip={unavailableTooltip} />
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        {run.estCostMicroUsd !== null && run.estCostMicroUsd !== undefined ? (
                          <span dir="ltr" className="ds-num tabular-nums">
                            {formatInt(run.estCostMicroUsd, fmtLocale)}
                          </span>
                        ) : (
                          <UnavailableSpan tooltip={unavailableTooltip} />
                        )}
                      </td>
                      <td className="px-3 py-2.5">{statusLabel(run.status, isAr)}</td>
                      <td className="px-3 py-2.5">
                        {run.errorCode ? (
                          <span dir="ltr" className="font-mono">
                            {run.errorCode}
                          </span>
                        ) : (
                          <UnavailableSpan tooltip={unavailableTooltip} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </main>
    </div>
  )
}

function BriefPanel({ brief, locale }: { brief: ListedDailyBrief | null; locale: FormatLocale }) {
  const isAr = locale !== 'en'
  return (
    <SectionCard
      title={isAr ? 'تقرير التحليل اليومي' : 'Daily Executive Brief'}
      locale={locale}
    >
      <p className="text-xs text-[var(--ds-text-muted)]">
        {brief ? (
          <>
            <span dir="ltr" className="ds-num tabular-nums">
              {formatDateTime(brief.createdAt, locale)}
            </span>{' '}
            — {brief.status}
          </>
        ) : isAr ? (
          'لا يوجد تقرير مخزّن.'
        ) : (
          'No stored brief.'
        )}
      </p>
      <a
        href="/erp/ai-brief"
        className="ds-focus-ring mt-2 inline-block text-sm font-bold text-[var(--ds-accent)] underline"
      >
        {isAr ? 'صفحة التقرير' : 'Open Brief Page'}
      </a>
    </SectionCard>
  )
}
