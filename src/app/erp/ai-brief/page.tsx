import { requirePageUser, resolveServerExecSessionRole } from '@/lib/auth/context'
import { canTriggerManualOdooSync } from '@/lib/auth/role-access-policy'
import { GLOBAL_BRAND_OPTIONS, GLOBAL_BRANCH_OPTIONS } from '@/lib/aether/global-filter-engine'
import { githubIssueDraft, parseStoredBrief } from '@/server/ai/consensus'
import { isBackgroundAnalysisEnabled, missingCouncilKeyNames } from '@/server/ai/env'
import { latestManualAtMs, manualRetryAt } from '@/server/ai/manual-run'
import { safeListDailyBriefs, type ListedDailyBrief } from '@/server/ai/persist'
import type { BriefCitation, StoredBriefReport } from '@/server/ai/brief-types'
import { CopyIssueDraft } from './copy-draft'
import { RunBriefButton } from './run-button'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'تحليل أودو اليومي | فنتشر فودز',
  description: 'تقرير الخلفية من نماذج فريال على حقائق Odoo، مع حالة كل نموذج.',
}

const METRIC_LABELS: Record<string, string> = {
  net_sales_kwd: 'صافي المبيعات',
  orders: 'الطلبات',
  brand_net_sales_kwd: 'صافي مبيعات العلامة',
  product_net_sales_kwd: 'صافي مبيعات المنتج',
  hourly_net_sales_kwd: 'صافي مبيعات الساعة',
  cogs_kwd: 'تكلفة المبيعات',
  delivery_commission_kwd: 'عمولة التوصيل',
  purchase_total_kwd: 'إجمالي المشتريات',
  open_receivable_kwd: 'الذمم المدينة المفتوحة',
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

function scopeLabel(scope: string): string {
  const branch = GLOBAL_BRANCH_OPTIONS.find((item) => item.id === scope)
  if (branch && branch.id !== 'all') return branch.ar
  const brand = GLOBAL_BRAND_OPTIONS.find((item) => item.id === scope)
  if (brand && brand.id !== 'all') return brand.ar
  if (scope === 'company') return 'الشركة'
  if (scope === 'unattributed') return 'غير منسوب لفرع'
  return scope
}

function CitationList({ citations }: { citations: BriefCitation[] }) {
  if (citations.length === 0) return null
  return (
    <ul className="mt-2 space-y-1">
      {citations.map((citation, index) => (
        <li key={`${citation.metric}-${citation.period}-${citation.scope}-${index}`} className="text-xs text-slate-600">
          <span>{METRIC_LABELS[citation.metric] ?? citation.metric}</span>
          <span> · </span>
          <span dir="ltr">{citation.period}</span>
          <span> · </span>
          <span>{scopeLabel(citation.scope)}</span>
          <span> · </span>
          <span dir="ltr" className="font-mono">
            {citation.value} {citation.unit}
          </span>
        </li>
      ))}
    </ul>
  )
}

const ADVISORY_LABELS = {
  organization: 'التنظيم',
  strategic_plan: 'الخطة',
  app_capability: 'قدرة مقترحة للتطبيق',
} as const

function ReportBody({ report, canExport }: { report: StoredBriefReport; canExport: boolean }) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-black text-slate-900">حالة النماذج</h2>
        <div className="mt-2 overflow-x-auto rounded-2xl ring-1 ring-slate-200">
          <table className="min-w-full border-collapse text-start text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-bold">المزود</th>
                <th className="px-3 py-2 font-bold">النموذج</th>
                <th className="px-3 py-2 font-bold">الحالة</th>
                <th className="px-3 py-2 font-bold">الرمز</th>
              </tr>
            </thead>
            <tbody>
              {report.models.map((model) => (
                <tr key={model.provider} className="border-t border-slate-100">
                  <td className="px-3 py-2">{model.provider}</td>
                  <td className="px-3 py-2 font-mono" dir="ltr">
                    {model.modelId || '—'}
                  </td>
                  <td className="px-3 py-2 font-mono">{model.status}</td>
                  <td className="px-3 py-2 font-mono">{model.errorCode ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {report.configuration === 'not_configured' ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
          غير مُهيأ. المفاتيح الناقصة: {report.missingKeys.join('، ') || '—'}. لم يُستدعَ أي نموذج.
        </p>
      ) : null}

      {report.odoo === 'not_linked' && report.configuration === 'configured' ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Odoo غير مرتبط لهذه الفترة. لا توجد نتائج، ولم يُستدعَ أي نموذج.
        </p>
      ) : null}

      {report.sections.length > 0 ? (
        <section>
          <h2 className="text-sm font-black text-slate-900">مصادر Odoo</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {report.sections.map((section) => (
              <li key={section.id}>
                <span className="font-mono">{section.id}</span>
                <span> · </span>
                <span className="font-mono">{section.status}</span>
                {section.noteAr ? <span> · {section.noteAr}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-black text-slate-900">أ) نتائج البيانات</h2>
        <p className="mt-1 text-xs text-slate-500">تظهر فقط إذا استندت إلى حقيقة Odoo ودعمها نموذجان على الأقل.</p>
        {report.findings.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">لا توجد نتيجة بيانات يدعمها نموذجان.</p>
        ) : (
          <div className="mt-2 space-y-3">
            {report.findings.map((finding, index) => (
              <article key={index} className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                <CitationList citations={finding.citations} />
                {finding.notes.map((note, noteIndex) => (
                  <p key={noteIndex} className="mt-2 text-sm text-slate-800">
                    <span className="font-mono text-xs text-slate-500" dir="ltr">
                      {note.provider}/{note.modelId}
                    </span>
                    <span> — {note.text}</span>
                  </p>
                ))}
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-black text-slate-900">ب) التوصيات والحلول</h2>
        <p className="mt-1 text-xs text-slate-500">كل توصية تذكر حقيقة Odoo ويؤيدها نموذجان على الأقل.</p>
        {report.recommendations.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">لا توجد توصية يدعمها نموذجان على الأقل.</p>
        ) : (
          <div className="mt-2 space-y-3">
            {report.recommendations.map((item, index) => (
              <article key={index} className="rounded-2xl bg-white p-3 ring-1 ring-emerald-200">
                <CitationList citations={item.citations} />
                {item.supporters.map((supporter, supporterIndex) => (
                  <p key={supporterIndex} className="mt-2 text-sm text-slate-800">
                    <span className="font-mono text-xs text-slate-500" dir="ltr">
                      {supporter.provider}/{supporter.modelId}
                    </span>
                    <span> — {supporter.solution}</span>
                  </p>
                ))}
              </article>
            ))}
          </div>
        )}
      </section>

      {report.unadoptedFindings.length > 0 ? (
        <section>
          <h2 className="text-sm font-black text-slate-500">ملاحظة لم تبلغ إجماع نموذجين</h2>
          <div className="mt-2 space-y-3">
            {report.unadoptedFindings.map((item, index) => (
              <article key={index} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <CitationList citations={item.citations} />
                <p className="mt-2 text-sm text-slate-600">
                  <span dir="ltr">{item.provider}/{item.modelId}</span> — {item.text}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl bg-violet-50 p-3 ring-1 ring-violet-200">
        <h2 className="text-sm font-black text-violet-950">ج) رأي استشاري — ليس بياناً من Odoo</h2>
        <p className="mt-1 text-xs text-violet-900">رأي النماذج عن التنظيم والخطة وقدرات يمكن إضافتها لاحقاً. لا يُطبَّق شيء تلقائياً.</p>
        {report.advisory.length === 0 ? (
          <p className="mt-2 text-sm text-violet-900">لا يوجد رأي اجتاز الفحص.</p>
        ) : (
          <div className="mt-2 space-y-3">
            {report.advisory.map((item, index) => (
              <article key={index} className="rounded-xl bg-white p-3">
                <p className="text-xs font-bold text-violet-900">رأي · {ADVISORY_LABELS[item.topic]}</p>
                <p className="mt-1 text-sm text-slate-800">
                  <span className="font-mono text-xs text-slate-500" dir="ltr">{item.provider}/{item.modelId}</span>
                  <span> — {item.text}</span>
                </p>
              </article>
            ))}
          </div>
        )}
        {report.proposals.length > 0 ? (
          <div className="mt-4 space-y-3">
            <h3 className="text-sm font-black text-violet-950">مقترحات بحالة proposed</h3>
            <p className="text-xs text-violet-900">مسودة للنسخ فقط. لم يُكتب كود ولم يُنشر شيء.</p>
            {report.proposals.map((proposal) => (
              <article key={proposal.id} className="rounded-xl bg-white p-3">
                <p className="font-mono text-xs text-slate-500">proposed · opinion · {proposal.provider}/{proposal.modelId}</p>
                <p className="mt-1 text-sm text-slate-800">{proposal.text}</p>
                {canExport ? <CopyIssueDraft draft={githubIssueDraft(proposal)} /> : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {report.disputed.length > 0 ? (
        <section>
          <h2 className="text-sm font-black text-amber-900">متنازع — لا يُعرض كحقيقة</h2>
          <div className="mt-2 space-y-3">
            {report.disputed.map((item, index) => (
              <article key={index} className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
                <CitationList citations={item.citations} />
                {item.support.map((supporter, supporterIndex) => (
                  <p key={`s-${supporterIndex}`} className="mt-2 text-sm text-slate-800">
                    دعم · <span dir="ltr">{supporter.provider}/{supporter.modelId}</span> — {supporter.solution}
                  </p>
                ))}
                {item.dispute.map((supporter, supporterIndex) => (
                  <p key={`d-${supporterIndex}`} className="mt-2 text-sm text-slate-800">
                    اعتراض · <span dir="ltr">{supporter.provider}/{supporter.modelId}</span> — {supporter.solution}
                  </p>
                ))}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {report.dropped.length > 0 ? (
        <section>
          <h2 className="text-sm font-black text-slate-500">لم يُعتمد — دعمه نموذج واحد</h2>
          <div className="mt-2 space-y-3">
            {report.dropped.map((item, index) => (
              <article key={index} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <CitationList citations={item.citations} />
                <p className="mt-2 text-sm text-slate-600">
                  <span dir="ltr">{item.provider}/{item.modelId}</span> — {item.solution}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

function StoredReport({ brief, canExport }: { brief: ListedDailyBrief; canExport: boolean }) {
  const report = parseStoredBrief(brief.reply)
  return (
    <article className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <p className="text-xs text-slate-500">
        {formatKuwait(brief.createdAt)} · {brief.status}
      </p>
      {report ? (
        <div className="mt-3">
          <ReportBody report={report} canExport={canExport} />
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
          <StoredReport brief={latest} canExport={canRun} />
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
                <StoredReport brief={brief} canExport={canRun} />
              </div>
            </details>
          ))}
        </section>
      ) : null}
    </main>
  )
}
