import { GLOBAL_BRAND_OPTIONS, GLOBAL_BRANCH_OPTIONS } from '@/lib/aether/global-filter-engine'
import {
  UNAVAILABLE_DASH,
  formatInt,
  formatKwd,
  getUnavailableTooltip,
  type FormatLocale,
} from '@/lib/format'
import { githubIssueDraft } from '@/server/ai/consensus'
import type { BriefCitation, StoredBriefReport } from '@/server/ai/brief-types'
import {
  linksForCitation,
  linksForRecommendation,
  reportSectionNotes,
  type ReportSectionNote,
  type SourceLink,
} from '@/server/ai/source-links'
import { StateBlock } from '@/components/ui/state-block'
import { CopyIssueDraft } from './copy-draft'

const METRIC_LABELS: Record<string, { ar: string; en: string }> = {
  net_sales_kwd: { ar: 'صافي المبيعات', en: 'Net Sales' },
  orders: { ar: 'الطلبات', en: 'Orders' },
  brand_net_sales_kwd: { ar: 'صافي مبيعات العلامة', en: 'Brand Net Sales' },
  product_net_sales_kwd: { ar: 'صافي مبيعات المنتج', en: 'Product Net Sales' },
  hourly_net_sales_kwd: { ar: 'صافي مبيعات الساعة', en: 'Hourly Net Sales' },
  cogs_kwd: { ar: 'تكلفة المبيعات', en: 'COGS' },
  delivery_commission_kwd: { ar: 'عمولة التوصيل', en: 'Delivery Commission' },
  purchase_total_kwd: { ar: 'إجمالي المشتريات', en: 'Purchase Total' },
  open_receivable_kwd: { ar: 'الذمم المدينة المفتوحة', en: 'Open Receivables' },
}

function scopeLabel(scope: string, locale: FormatLocale): string {
  const isAr = locale !== 'en'
  const branch = GLOBAL_BRANCH_OPTIONS.find((item) => item.id === scope)
  if (branch && branch.id !== 'all') return isAr ? branch.ar : branch.en
  const brand = GLOBAL_BRAND_OPTIONS.find((item) => item.id === scope)
  if (brand && brand.id !== 'all') return isAr ? brand.ar : brand.en
  if (scope === 'company') return isAr ? 'الشركة' : 'Company'
  if (scope === 'unattributed') return isAr ? 'غير منسوب لفرع' : 'Unattributed'
  return scope
}

function formatCitationMetricValue(
  citation: BriefCitation,
  locale: FormatLocale,
): { text: string; unavailable: boolean } {
  const raw = (citation.value ?? '').trim()
  if (!raw || raw === UNAVAILABLE_DASH) {
    return { text: UNAVAILABLE_DASH, unavailable: true }
  }
  const num = Number(raw)
  if (!Number.isFinite(num)) {
    return {
      text: `${raw}${citation.unit ? ` ${citation.unit}` : ''}`,
      unavailable: false,
    }
  }
  if (citation.unit === 'KWD') {
    return { text: formatKwd(num, { locale }), unavailable: false }
  }
  if (citation.unit === 'orders') {
    const unitLabel = locale === 'ar' ? 'طلب' : 'orders'
    return { text: `${formatInt(num, { locale })} ${unitLabel}`, unavailable: false }
  }
  return {
    text: `${raw}${citation.unit ? ` ${citation.unit}` : ''}`,
    unavailable: false,
  }
}

function LinkList({ links }: { links: SourceLink[] }) {
  if (links.length === 0) return null
  return (
    <ul className="mt-2 space-y-2">
      {links.map((link, index) => (
        <li
          key={`${link.kind}-${link.href ?? link.domainText ?? link.label}-${index}`}
          className="text-xs text-slate-700 dark:text-slate-300"
        >
          {link.href ? (
            <a
              href={link.href}
              className="rounded font-bold text-emerald-700 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:text-emerald-300"
              {...(link.href.startsWith('https://') ? { target: '_blank', rel: 'noreferrer' } : {})}
            >
              {link.label}
            </a>
          ) : (
            <span className="font-bold">{link.model ?? link.label}</span>
          )}
          {link.domainText ? (
            <span className="mt-1 block break-all font-mono text-xs text-slate-600 dark:text-slate-400" dir="ltr">
              {link.domainText}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function SectionAdvice({ note }: { note: ReportSectionNote }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200 dark:bg-[#141F1B] dark:ring-white/10">
      <p className="text-sm text-slate-800 dark:text-slate-200">{note.recommendationAr}</p>
      <LinkList links={note.links} />
    </div>
  )
}

function CitationList({
  citations,
  odooBase,
  locale,
}: {
  citations: BriefCitation[]
  odooBase: string | null
  locale: FormatLocale
}) {
  if (citations.length === 0) return null
  const isAr = locale !== 'en'
  const unavailableTooltip = getUnavailableTooltip(locale)
  return (
    <ul className="mt-2 space-y-3">
      {citations.map((citation, index) => {
        const metricMeta = METRIC_LABELS[citation.metric]
        const metricLabel = metricMeta ? (isAr ? metricMeta.ar : metricMeta.en) : citation.metric
        const formatted = formatCitationMetricValue(citation, locale)
        return (
          <li
            key={`${citation.metric}-${citation.period}-${citation.scope}-${index}`}
            className="text-xs text-slate-600 dark:text-slate-300"
          >
            <span className="font-semibold text-slate-800 dark:text-slate-200">{metricLabel}</span>
            <span> · </span>
            <span dir="ltr" className="tabular-nums">
              {citation.period}
            </span>
            <span> · </span>
            <span>{scopeLabel(citation.scope, locale)}</span>
            <span> · </span>
            <span
              dir="ltr"
              data-unavailable={formatted.unavailable ? 'true' : undefined}
              title={formatted.unavailable ? unavailableTooltip : undefined}
              aria-label={formatted.unavailable ? unavailableTooltip : undefined}
              className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white"
            >
              {formatted.text}
            </span>
            <LinkList links={linksForCitation(citation, odooBase)} />
          </li>
        )
      })}
    </ul>
  )
}

const ADVISORY_LABELS = {
  organization: { ar: 'التنظيم', en: 'Organization' },
  strategic_plan: { ar: 'الخطة', en: 'Strategic Plan' },
  app_capability: { ar: 'قدرة مقترحة للتطبيق', en: 'Proposed App Capability' },
} as const

export function ReportBody({
  report,
  canExport,
  odooBase,
  reportHref,
  includeAdminRuns,
  locale = 'ar',
}: {
  report: StoredBriefReport
  canExport: boolean
  odooBase: string | null
  reportHref: string
  includeAdminRuns: boolean
  locale?: FormatLocale
}) {
  const isAr = locale !== 'en'
  const T = (ar: string, en: string) => (isAr ? ar : en)
  const notes = reportSectionNotes({ report, base: odooBase, reportHref, includeAdminRuns })
  const note = (id: ReportSectionNote['id']) => notes.find((item) => item.id === id)
  const totalModels = Math.max(report.models.length, 3)

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-6 min-w-0">
      {report.configuration === 'not_configured' ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-300/75 bg-amber-50 px-3.5 py-2.5 text-sm font-medium text-amber-950 dark:border-amber-500/35 dark:bg-amber-950/45 dark:text-amber-100"
        >
          {isAr
            ? `غير مُهيأ. المفاتيح الناقصة: ${report.missingKeys.join('، ') || UNAVAILABLE_DASH}. لم يُستدعَ أي نموذج.`
            : `Not configured. Missing keys: ${report.missingKeys.join(', ') || UNAVAILABLE_DASH}. No model was called.`}
        </div>
      ) : null}

      {report.odoo === 'not_linked' && report.configuration === 'configured' ? (
        <StateBlock
          state="unlinked"
          compact
          locale={locale}
          title={T('Odoo غير مرتبط لهذه الفترة', 'Odoo not linked for this period')}
          description={T(
            'لا توجد نتائج موثقة، ولم يُستدعَ أي نموذج ذكاء اصطناعي.',
            'No verified Odoo results are available; zero AI models were called.',
          )}
        />
      ) : null}

      <section>
        <h2 className="text-sm font-black text-slate-900 dark:text-white">
          {T('حالة نظافة البيانات', 'Data Cleanliness Status')}
        </h2>
        {note('cleanliness') ? (
          <div className="mt-2">
            <SectionAdvice note={note('cleanliness')!} />
          </div>
        ) : null}
        {report.sections.length > 0 ? (
          <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-300">
            {report.sections.map((section) => (
              <li key={section.id}>
                <span className="font-mono">{section.id}</span>
                <span> · </span>
                <span className="font-mono">{section.status}</span>
                {section.noteAr ? <span> · {section.noteAr}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section>
        <h2 className="text-sm font-black text-slate-900 dark:text-white">
          {T('التحليل الخلفي', 'Background Council Analysis')}
        </h2>
        {note('analysis') ? (
          <div className="mt-2">
            <SectionAdvice note={note('analysis')!} />
          </div>
        ) : null}
        <h3 className="mt-4 text-sm font-black text-slate-900 dark:text-white">
          {T('حالة النماذج', 'Model Status')}
        </h3>
        <div className="mt-2 overflow-x-auto rounded-2xl ring-1 ring-slate-200 dark:ring-white/10">
          <table className="min-w-full border-collapse text-start text-sm">
            <thead className="bg-slate-50 text-slate-600 dark:bg-[#141F1B] dark:text-slate-300">
              <tr>
                <th className="px-3 py-2 font-bold">{T('المزود', 'Provider')}</th>
                <th className="px-3 py-2 font-bold">{T('النموذج', 'Model')}</th>
                <th className="px-3 py-2 font-bold">{T('الحالة', 'Status')}</th>
                <th className="px-3 py-2 font-bold">{T('الرمز', 'Code')}</th>
              </tr>
            </thead>
            <tbody>
              {report.models.map((model) => (
                <tr key={model.provider} className="border-t border-slate-100 dark:border-white/10">
                  <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{model.provider}</td>
                  <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300" dir="ltr">
                    {model.modelId || UNAVAILABLE_DASH}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200">{model.status}</td>
                  <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">
                    {model.errorCode ?? UNAVAILABLE_DASH}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="mt-4 text-sm font-black text-slate-900 dark:text-white">
          {T('أ) نتائج البيانات', 'A) Data Findings')}
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {T(
            'تظهر فقط إذا استندت إلى حقيقة Odoo ودعمها نموذجان على الأقل، ومع كل رقم رابط مصدره.',
            'Shown only when backed by an Odoo fact and supported by at least 2 models, with source links for every figure.',
          )}
        </p>
        {report.findings.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {T('لا توجد نتيجة بيانات يدعمها نموذجان.', 'No data findings supported by 2+ models.')}
          </p>
        ) : (
          <div className="mt-2 space-y-3">
            {report.findings.map((finding, index) => (
              <article
                key={index}
                className="rounded-2xl bg-white p-3 ring-1 ring-slate-200 dark:bg-[#141F1B] dark:ring-white/10"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    data-consensus-badge="agreed"
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-500/25 dark:bg-emerald-950/60 dark:text-emerald-200"
                  >
                    <span dir="ltr" className="tabular-nums">
                      {finding.notes.length}/{totalModels}
                    </span>
                    <span>{T('إجماع المجلس', 'Council Consensus')}</span>
                  </span>
                </div>
                <CitationList citations={finding.citations} odooBase={odooBase} locale={locale} />
                {finding.notes.map((modelNote, noteIndex) => (
                  <p key={noteIndex} className="mt-2 text-sm text-slate-800 dark:text-slate-200">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                      {modelNote.provider}/{modelNote.modelId}
                    </span>
                    <span> — {modelNote.text}</span>
                  </p>
                ))}
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-black text-slate-900 dark:text-white">
          {T('حارس الحقيقة', 'Truth Guard')}
        </h2>
        {note('guard') ? (
          <div className="mt-2">
            <SectionAdvice note={note('guard')!} />
          </div>
        ) : null}
        {report.unadoptedFindings.length > 0 ? (
          <div className="mt-3 space-y-3">
            <h3 className="text-sm font-black text-slate-600 dark:text-slate-300">
              {T('ملاحظة لم تبلغ إجماع نموذجين', 'Single-model finding (below 2-of-3 consensus)')}
            </h3>
            {report.unadoptedFindings.map((item, index) => (
              <article
                key={index}
                className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-[#111A17] dark:ring-white/10"
              >
                <CitationList citations={item.citations} odooBase={odooBase} locale={locale} />
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  <span dir="ltr">
                    {item.provider}/{item.modelId}
                  </span>{' '}
                  — {item.text}
                </p>
              </article>
            ))}
          </div>
        ) : null}
        {report.disputed.length > 0 ? (
          <div className="mt-3 space-y-3" data-contradiction-flag="true">
            <h3 className="text-sm font-black text-amber-900 dark:text-amber-300">
              {T('متنازع — لا يُعرض كحقيقة', 'Contradictory / Disputed — Withheld from Facts')}
            </h3>
            {report.disputed.map((item, index) => (
              <article
                key={index}
                role="status"
                className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-300/70 dark:bg-amber-950/35 dark:ring-amber-500/30"
              >
                <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                  {T('تعارض إجراءات — لم يُعتمد أي طرف', 'Contradictory Actions Flagged — Neither Adopted')}
                </div>
                <CitationList citations={item.citations} odooBase={odooBase} locale={locale} />
                {item.support.map((supporter, supporterIndex) => (
                  <p key={`s-${supporterIndex}`} className="mt-2 text-sm text-slate-800 dark:text-slate-200">
                    {T('دعم', 'Support')} ·{' '}
                    <span dir="ltr">
                      {supporter.provider}/{supporter.modelId}
                    </span>{' '}
                    — {supporter.solution}
                  </p>
                ))}
                {item.dispute.map((supporter, supporterIndex) => (
                  <p key={`d-${supporterIndex}`} className="mt-2 text-sm text-slate-800 dark:text-slate-200">
                    {T('اعتراض', 'Dispute')} ·{' '}
                    <span dir="ltr">
                      {supporter.provider}/{supporter.modelId}
                    </span>{' '}
                    — {supporter.solution}
                  </p>
                ))}
              </article>
            ))}
          </div>
        ) : null}
        {report.dropped.length > 0 ? (
          <div className="mt-3 space-y-3">
            <h3 className="text-sm font-black text-slate-600 dark:text-slate-300">
              {T('لم يُعتمد — دعمه نموذج واحد', 'Withheld — Single-Model Proposal')}
            </h3>
            {report.dropped.map((item, index) => (
              <article
                key={index}
                className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-[#111A17] dark:ring-white/10"
              >
                <CitationList citations={item.citations} odooBase={odooBase} locale={locale} />
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  <span dir="ltr">
                    {item.provider}/{item.modelId}
                  </span>{' '}
                  — {item.solution}
                </p>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="text-sm font-black text-slate-900 dark:text-white">
          {T('ب) التوصيات والحلول', 'B) Recommendations & Actions')}
        </h2>
        {note('recommendations') ? (
          <div className="mt-2">
            <SectionAdvice note={note('recommendations')!} />
          </div>
        ) : null}
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {T(
            'كل توصية تذكر حقيقة Odoo ويؤيدها نموذجان على الأقل، وتربط بصفحة التطبيق وبقيد هذا التقرير.',
            'Every recommendation cites an Odoo fact supported by at least 2 models and links back to the ERP view.',
          )}
        </p>
        {report.recommendations.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {T('لا توجد توصية يدعمها نموذجان على الأقل.', 'No recommendation achieved 2-of-3 consensus.')}
          </p>
        ) : (
          <div className="mt-2 space-y-3">
            {report.recommendations.map((item, index) => (
              <article
                key={index}
                className="rounded-2xl bg-white p-3 ring-1 ring-emerald-200 dark:bg-[#141F1B] dark:ring-emerald-500/25"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span
                    data-consensus-badge="agreed"
                    className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-500/25 dark:bg-emerald-950/60 dark:text-emerald-200"
                  >
                    <span dir="ltr" className="tabular-nums">
                      {item.supporters.length}/{totalModels}
                    </span>
                    <span>{T('إجماع 2+', '2+ Consensus')}</span>
                  </span>
                </div>
                <CitationList citations={item.citations} odooBase={odooBase} locale={locale} />
                <LinkList
                  links={linksForRecommendation(item, odooBase, reportHref).filter(
                    (link) => link.kind !== 'odoo',
                  )}
                />
                {item.supporters.map((supporter, supporterIndex) => (
                  <p key={supporterIndex} className="mt-2 text-sm text-slate-800 dark:text-slate-200">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400" dir="ltr">
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

      <section className="rounded-2xl bg-violet-50 p-3 ring-1 ring-violet-200 dark:bg-violet-950/30 dark:ring-violet-500/25">
        <h2 className="text-sm font-black text-violet-950 dark:text-violet-200">
          {T('ج) رأي استشاري — ليس بياناً من Odoo', 'C) Advisory Opinion — Not an Odoo Statement')}
        </h2>
        {note('advisory') ? (
          <div className="mt-2">
            <SectionAdvice note={note('advisory')!} />
          </div>
        ) : null}
        <p className="mt-2 text-xs text-violet-900 dark:text-violet-300">
          {T('رأي. ليس بياناً من Odoo.', 'Opinion only. Not verified Odoo telemetry.')}
        </p>
        {report.advisory.length === 0 ? (
          <p className="mt-2 text-sm text-violet-900 dark:text-violet-300">
            {T('لا يوجد رأي اجتاز الفحص.', 'No advisory items passed review.')}
          </p>
        ) : (
          <div className="mt-2 space-y-3">
            {report.advisory.map((item, index) => (
              <article key={index} className="rounded-xl bg-white p-3 dark:bg-[#141F1B]">
                <p className="text-xs font-bold text-violet-900 dark:text-violet-300">
                  {T('رأي', 'Opinion')} · {isAr ? ADVISORY_LABELS[item.topic].ar : ADVISORY_LABELS[item.topic].en}
                </p>
                <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                    {item.provider}/{item.modelId}
                  </span>
                  <span> — {item.text}</span>
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-violet-50 p-3 ring-1 ring-violet-200 dark:bg-violet-950/30 dark:ring-violet-500/25">
        <h2 className="text-sm font-black text-violet-950 dark:text-violet-200">
          {T('مقترحات بحالة proposed', 'Proposed Capability Drafts')}
        </h2>
        {note('proposals') ? (
          <div className="mt-2">
            <SectionAdvice note={note('proposals')!} />
          </div>
        ) : null}
        <p className="mt-2 text-xs text-violet-900 dark:text-violet-300">
          {T('مسودة للنسخ فقط. لم يُكتب كود ولم يُنشر شيء.', 'Draft to copy only. No code written or deployed.')}
        </p>
        {report.proposals.length === 0 ? (
          <p className="mt-2 text-sm text-violet-900 dark:text-violet-300">
            {T('لا توجد مقترحات في هذا التقرير.', 'No proposals in this report.')}
          </p>
        ) : (
          <div className="mt-2 space-y-3">
            {report.proposals.map((proposal) => (
              <article key={proposal.id} className="rounded-xl bg-white p-3 dark:bg-[#141F1B]">
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400" dir="ltr">
                  proposed · opinion · {proposal.provider}/{proposal.modelId}
                </p>
                <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{proposal.text}</p>
                {canExport ? <CopyIssueDraft draft={githubIssueDraft(proposal)} locale={locale} /> : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

