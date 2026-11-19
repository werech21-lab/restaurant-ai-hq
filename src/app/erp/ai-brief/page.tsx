import { cookies } from 'next/headers'
import { requirePageUser, resolveServerExecSessionRole } from '@/lib/auth/context'
import { canTriggerManualOdooSync } from '@/lib/auth/role-access-policy'
import { formatDateTime, type FormatLocale } from '@/lib/format'
import { StateBlock } from '@/components/ui/state-block'
import { parseStoredBrief } from '@/server/ai/consensus'
import { isBackgroundAnalysisEnabled, missingCouncilKeyNames } from '@/server/ai/env'
import { latestManualAtMs, manualRetryAt } from '@/server/ai/manual-run'
import { safeListDailyBriefs, type ListedDailyBrief } from '@/server/ai/persist'
import { odooWebBase } from '@/server/ai/source-links'
import { ReportBody } from './report-body'
import { RunBriefButton } from './run-button'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'تحليل أودو اليومي | فنتشر فودز',
  description: 'تقرير الخلفية من نماذج فريال على حقائق Odoo، مع حالة كل نموذج.',
}

async function resolvePageLocale(): Promise<FormatLocale> {
  try {
    const jar = await cookies()
    const raw =
      jar.get('NEXT_LOCALE')?.value ??
      jar.get('vf_lang')?.value ??
      jar.get('ai-hq-locale')?.value
    return raw === 'en' ? 'en' : 'ar'
  } catch {
    return 'ar'
  }
}

function StoredReport({
  brief,
  canExport,
  includeAdminRuns,
  locale,
}: {
  brief: ListedDailyBrief
  canExport: boolean
  includeAdminRuns: boolean
  locale: FormatLocale
}) {
  const isAr = locale !== 'en'
  const report = parseStoredBrief(brief.reply)
  const reportHref = `/erp/ai-brief#report-${brief.id}`
  return (
    <article
      id={`report-${brief.id}`}
      className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 dark:bg-[#101815] dark:ring-white/10"
    >
      <p className="text-xs text-slate-500 dark:text-slate-400">
        <a
          href={reportHref}
          className="rounded font-bold text-emerald-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:text-emerald-300"
        >
          <span dir="ltr" className="tabular-nums">
            {formatDateTime(brief.createdAt, { locale, showZone: true })}
          </span>{' '}
          · {brief.status}
        </a>
      </p>
      {report ? (
        <div className="mt-3">
          <ReportBody
            report={report}
            canExport={canExport}
            odooBase={odooWebBase(process.env.ODOO_URL)}
            reportHref={reportHref}
            includeAdminRuns={includeAdminRuns}
            locale={locale}
          />
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {isAr ? 'الصف المخزّن ليس تقريراً منظماً.' : 'Stored entry is not a structured report.'}
        </p>
      )}
    </article>
  )
}

export default async function AiBriefPage() {
  await requirePageUser('/erp/ai-brief')
  const locale = await resolvePageLocale()
  const isAr = locale !== 'en'
  const missingNow = missingCouncilKeyNames()
  const scheduleOn = isBackgroundAnalysisEnabled()
  const [role, listed] = await Promise.all([resolveServerExecSessionRole(), safeListDailyBriefs(14)])
  const { briefs, error } = listed
  const [latest, ...older] = briefs
  const canRun = role !== null && canTriggerManualOdooSync(role)
  const retryAt = manualRetryAt(
    latestManualAtMs(
      briefs.map((brief) => ({
        createdAtMs: brief.createdAt.getTime(),
        trigger: parseStoredBrief(brief.reply)?.trigger ?? null,
      })),
    ),
    Date.now(),
  )

  return (
    <div
      className="mx-auto w-full max-w-5xl min-w-0 overflow-x-hidden px-4 py-8"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <h1 className="text-xl font-black text-slate-900 dark:text-white">
        {isAr ? 'تحليل أودو اليومي' : 'Daily Odoo AI Brief'}
      </h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        {isAr ? (
          <>
            الجدول اليومي <span dir="ltr" className="tabular-nums">06:00</span> بتوقيت الكويت، وبجانبه تشغيل يدوي للمديرين التنفيذيين مرة كل عشر دقائق. نتائج البيانات والتوصيات تظهر فقط إذا دعمها نموذجان على الأقل واستندت إلى حقيقة Odoo. الرأي الاستشاري منفصل ومُعلَّم كرأي، ولا يُطبَّق.
          </>
        ) : (
          <>
            Daily schedule runs at <span dir="ltr" className="tabular-nums">06:00</span> Asia/Kuwait, plus manual executive runs once every 10 minutes. Findings and recommendations appear only with 2-of-3 consensus grounded in Odoo facts. Advisory notes are labeled as opinion and never auto-applied.
          </>
        )}
      </p>
      {!scheduleOn ? (
        <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:bg-[#141F1B] dark:text-slate-200">
          {isAr ? 'الجدول متوقف من الإعداد.' : 'Background schedule is disabled in configuration.'}
        </p>
      ) : null}
      {missingNow.length > 0 ? (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/45 dark:text-amber-100"
        >
          {isAr
            ? `غير مُهيأ. المفاتيح الناقصة: ${missingNow.join('، ')}.`
            : `Not configured. Missing keys: ${missingNow.join(', ')}.`}
        </p>
      ) : null}
      {canRun ? (
        <div className="mt-4">
          <RunBriefButton retryAt={retryAt} locale={locale} />
        </div>
      ) : null}
      {error ? (
        <div className="mt-6">
          <StateBlock
            state="error"
            locale={locale}
            title={isAr ? 'تعذّر قراءة التقارير المخزّنة.' : 'Unable to read stored AI briefs.'}
            description={
              isAr
                ? 'حدث خلل مؤقت أثناء استرجاع تقارير الإحاطة اليومية. يرجى التحديث لاحقاً.'
                : 'A temporary error occurred while retrieving stored daily briefs. Please refresh shortly.'
            }
          />
        </div>
      ) : null}
      {!error && !latest ? (
        <div className="mt-6">
          <StateBlock
            state="empty"
            locale={locale}
            title={isAr ? 'لا يوجد تقرير مخزّن بعد.' : 'No stored brief yet.'}
            description={
              isAr
                ? 'سيظهر أحدث تقرير تحليل يومي من أودو 17 هنا فور إكماله.'
                : 'The latest Odoo 17 daily AI council brief will appear here once completed.'
            }
          />
        </div>
      ) : null}
      {latest ? (
        <div className="mt-6">
          <StoredReport
            brief={latest}
            canExport={canRun}
            includeAdminRuns={role === 'admin'}
            locale={locale}
          />
        </div>
      ) : null}
      {older.length > 0 ? (
        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-black text-slate-900 dark:text-white">
            {isAr ? 'تقارير سابقة' : 'Previous Briefs'}
          </h2>
          {older.map((brief) => (
            <details
              key={brief.id}
              className="rounded-2xl bg-white p-3 ring-1 ring-slate-200 dark:bg-[#101815] dark:ring-white/10"
            >
              <summary className="cursor-pointer rounded text-sm font-bold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:text-slate-200">
                <span dir="ltr" className="tabular-nums">
                  {formatDateTime(brief.createdAt, { locale, showZone: true })}
                </span>{' '}
                · {brief.status}
              </summary>
              <div className="mt-3">
                <StoredReport
                  brief={brief}
                  canExport={canRun}
                  includeAdminRuns={role === 'admin'}
                  locale={locale}
                />
              </div>
            </details>
          ))}
        </section>
      ) : null}
    </div>
  )
}
