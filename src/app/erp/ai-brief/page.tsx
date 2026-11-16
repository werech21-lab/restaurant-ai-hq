import { requirePageUser, resolveServerExecSessionRole } from '@/lib/auth/context'
import { canTriggerManualOdooSync } from '@/lib/auth/role-access-policy'
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

function formatKuwait(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuwait',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

function StoredReport({
  brief,
  canExport,
  includeAdminRuns,
}: {
  brief: ListedDailyBrief
  canExport: boolean
  includeAdminRuns: boolean
}) {
  const report = parseStoredBrief(brief.reply)
  const reportHref = `/erp/ai-brief#report-${brief.id}`
  return (
    <article id={`report-${brief.id}`} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <p className="text-xs text-slate-500">
        <a href={reportHref} className="font-bold text-sky-800 underline">
          {formatKuwait(brief.createdAt)} · {brief.status}
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
          />
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-600">الصف المخزّن ليس تقريراً منظماً.</p>
      )}
    </article>
  )
}

export default async function AiBriefPage() {
  await requirePageUser('/erp/ai-brief')
  const missingNow = missingCouncilKeyNames()
  const scheduleOn = isBackgroundAnalysisEnabled()
  const [role, listed] = await Promise.all([resolveServerExecSessionRole(), safeListDailyBriefs(14)])
  const { briefs, error } = listed
  const [latest, ...older] = briefs
  const canRun = canTriggerManualOdooSync(role)
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
    <main className="mx-auto w-full max-w-5xl px-4 py-8" dir="rtl">
      <h1 className="text-xl font-black text-slate-900">تحليل أودو اليومي</h1>
      <p className="mt-2 text-sm text-slate-600">
        الجدول اليومي <span dir="ltr">06:00</span> بتوقيت الكويت، وبجانبه تشغيل يدوي للمديرين التنفيذيين مرة كل عشر دقائق. نتائج البيانات والتوصيات تظهر فقط إذا دعمها نموذجان على الأقل واستندت إلى حقيقة Odoo. الرأي الاستشاري منفصل ومُعلَّم كرأي، ولا يُطبَّق.
      </p>
      {!scheduleOn ? (
        <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-800">الجدول متوقف من الإعداد.</p>
      ) : null}
      {missingNow.length > 0 ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
          غير مُهيأ. المفاتيح الناقصة: {missingNow.join('، ')}.
        </p>
      ) : null}
      {canRun ? (
        <div className="mt-4">
          <RunBriefButton retryAt={retryAt} />
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-amber-900">تعذّر قراءة التقارير المخزّنة.</p> : null}
      {!error && !latest ? <p className="mt-6 text-sm text-slate-600">لا يوجد تقرير مخزّن بعد.</p> : null}
      {latest ? (
        <div className="mt-6">
          <StoredReport brief={latest} canExport={canRun} includeAdminRuns={role === 'admin'} />
        </div>
      ) : null}
      {older.length > 0 ? (
        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-black text-slate-900">تقارير سابقة</h2>
          {older.map((brief) => (
            <details key={brief.id} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
              <summary className="cursor-pointer text-sm font-bold text-slate-800">
                {formatKuwait(brief.createdAt)} · {brief.status}
              </summary>
              <div className="mt-3">
                <StoredReport brief={brief} canExport={canRun} includeAdminRuns={role === 'admin'} />
              </div>
            </details>
          ))}
        </section>
      ) : null}
    </main>
  )
}
