import { APPROVED_BRANCH_IDS, APPROVED_BRAND_IDS } from '@/lib/aether/global-filter-engine'
import type {
  BriefCitation,
  BriefSection,
  FactSource,
  FactSourceGap,
  OdooDomainOperator,
  OdooDomainTerm,
  OdooDomainValue,
  OdooSourceModel,
  StoredBriefReport,
} from './brief-types'
import { ODOO_SOURCE_MODELS } from './brief-types'

const KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000

const DOMAIN_FIELDS = new Set([
  'date_order',
  'order_id.date_order',
  'state',
  'order_id.state',
  'product_id',
  'session_id.config_id',
  'order_id.session_id.config_id',
  'company_id',
  'parent_state',
  'date',
  'account_id.account_type',
  'reconciled',
  'product_id.pos_categ_id',
])

const OPERATORS = new Set<OdooDomainOperator>(['=', '!=', '>', '>=', '<', '<=', 'in', 'not in'])

const APP_ROUTES: Record<string, string> = {
  net_sales_kwd: '/erp/weekday-comparison',
  orders: '/erp/weekday-comparison',
  brand_net_sales_kwd: '/erp/weekday-comparison',
  hourly_net_sales_kwd: '/erp/cores',
  product_net_sales_kwd: '/erp/menu-engineering',
  cogs_kwd: '/accounting',
  delivery_commission_kwd: '/erp/aggregator-radar',
  purchase_total_kwd: '/erp/cost-intelligence',
  open_receivable_kwd: '/erp/receivables',
}

const SECTION_METRIC: Record<string, string> = {
  sales: 'net_sales_kwd',
  prior_period: 'net_sales_kwd',
  products: 'product_net_sales_kwd',
  hours: 'hourly_net_sales_kwd',
  cogs: 'cogs_kwd',
  commissions: 'delivery_commission_kwd',
  purchases: 'purchase_total_kwd',
  receivables: 'open_receivable_kwd',
  receivables_aging: 'open_receivable_kwd',
}

const GAP_TEXT: Record<FactSourceGap, string> = {
  missing_config_ids: 'the Odoo record ids for this filter are not on this fact',
  brand_unresolved: 'brand is an app id, not an Odoo record id',
  commission_classifier: 'commission accounts are classified in the ledger helper; no account id is stored on this fact',
  aging_unverified: 'partner ageing is unverified and has no Odoo domain on this report',
  missing_product_id: 'product id is not on this fact',
}

export interface PeriodOdooIds {
  companyId: number | null
  configIdsByBranch: Record<string, number[]>
  excludedConfigIds: number[]
  excludedPosCategoryIds: number[]
}

export interface SourceLink {
  kind: 'odoo' | 'app' | 'report'
  label: string
  href: string | null
  model: string | null
  domainText: string | null
}

export interface ReportSectionNote {
  id: 'cleanliness' | 'analysis' | 'guard' | 'recommendations' | 'advisory' | 'proposals'
  titleAr: string
  recommendationAr: string
  links: SourceLink[]
}

export function positiveIds(values: readonly unknown[]): number[] {
  const out: number[] = []
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || out.includes(value)) continue
    out.push(value)
  }
  return out
}

export function sanitizePeriodOdooIds(raw: unknown): PeriodOdooIds | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  const byBranchRaw = record.configIdsByBranch
  const configIdsByBranch: Record<string, number[]> = {}
  if (byBranchRaw && typeof byBranchRaw === 'object' && !Array.isArray(byBranchRaw)) {
    for (const [branch, ids] of Object.entries(byBranchRaw)) {
      if (!(APPROVED_BRANCH_IDS as readonly string[]).includes(branch)) continue
      configIdsByBranch[branch] = positiveIds(Array.isArray(ids) ? ids : [])
    }
  }
  const companyId = positiveIds([record.companyId])[0] ?? null
  return {
    companyId,
    configIdsByBranch,
    excludedConfigIds: positiveIds(Array.isArray(record.excludedConfigIds) ? record.excludedConfigIds : []),
    excludedPosCategoryIds: positiveIds(Array.isArray(record.excludedPosCategoryIds) ? record.excludedPosCategoryIds : []),
  }
}

function odooUtcStamp(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
}

export function kuwaitDayWindow(fromDate: string, toDate = fromDate): { fromUtc: string; toExclusiveUtc: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || toDate < fromDate) return null
  const startUtcMs = Date.parse(`${fromDate}T00:00:00.000Z`) - KUWAIT_OFFSET_MS
  const endExclusiveUtcMs = Date.parse(`${toDate}T00:00:00.000Z`) + 86_400_000 - KUWAIT_OFFSET_MS
  return { fromUtc: odooUtcStamp(startUtcMs), toExclusiveUtc: odooUtcStamp(endExclusiveUtcMs) }
}

export function kuwaitHourWindow(date: string, hour: number): { fromUtc: string; toExclusiveUtc: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(hour) || hour < 0 || hour > 23) return null
  const startUtcMs = Date.parse(`${date}T00:00:00.000Z`) - KUWAIT_OFFSET_MS + hour * 3_600_000
  return { fromUtc: odooUtcStamp(startUtcMs), toExclusiveUtc: odooUtcStamp(startUtcMs + 3_600_000) }
}

function parsePeriod(period: string): { from: string; to: string } | null {
  const range = period.split('..')
  const from = range[0] ?? ''
  const to = range[1] || from
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return null
  return { from, to }
}

function term(field: string, operator: OdooDomainOperator, value: OdooDomainValue): OdooDomainTerm {
  return { field, operator, value }
}

function companyTerm(ids: PeriodOdooIds | null): OdooDomainTerm[] {
  return ids?.companyId ? [term('company_id', '=', ids.companyId)] : []
}

function orderWindow(period: string, hour: number | null): { fromUtc: string; toExclusiveUtc: string } | null {
  const parsed = parsePeriod(period)
  if (!parsed) return null
  if (hour != null) {
    if (parsed.from !== parsed.to) return null
    return kuwaitHourWindow(parsed.from, hour)
  }
  return kuwaitDayWindow(parsed.from, parsed.to)
}

function knownConfigIds(ids: PeriodOdooIds): number[] {
  const all = [...ids.excludedConfigIds]
  for (const branchIds of Object.values(ids.configIdsByBranch)) all.push(...branchIds)
  return positiveIds(all)
}

export function sourceForMetric(input: {
  metric: string
  period: string
  scope: string
  productId: number | null
  ids: PeriodOdooIds | null
}): FactSource {
  const scopeLabel = input.scope
  const productId = input.productId != null ? positiveIds([input.productId])[0] ?? null : null
  if (input.metric === 'open_receivable_kwd') {
    return {
      model: 'account.move.line',
      domain: [
        term('parent_state', '=', 'posted'),
        term('account_id.account_type', '=', 'asset_receivable'),
        term('reconciled', '=', false),
      ],
      records: [],
      gap: null,
      scopeLabel,
    }
  }
  if (input.metric === 'cogs_kwd') {
    const parsed = parsePeriod(input.period)
    return {
      model: 'account.move.line',
      domain: parsed
        ? [
            term('parent_state', '=', 'posted'),
            term('date', '>=', parsed.from),
            term('date', '<=', parsed.to),
            term('account_id.account_type', '=', 'expense_direct_cost'),
            ...companyTerm(input.ids),
          ]
        : [],
      records: [],
      gap: input.ids ? null : 'missing_config_ids',
      scopeLabel,
    }
  }
  if (input.metric === 'delivery_commission_kwd') {
    const parsed = parsePeriod(input.period)
    return {
      model: 'account.move.line',
      domain: parsed
        ? [term('parent_state', '=', 'posted'), term('date', '>=', parsed.from), term('date', '<=', parsed.to)]
        : [],
      records: [],
      gap: 'commission_classifier',
      scopeLabel,
    }
  }
  if (input.metric === 'purchase_total_kwd') {
    const window = orderWindow(input.period, null)
    return {
      model: 'purchase.order',
      domain: window
        ? [
            term('state', 'in', ['purchase', 'done']),
            term('date_order', '>=', window.fromUtc),
            term('date_order', '<', window.toExclusiveUtc),
            ...companyTerm(input.ids),
          ]
        : [],
      records: [],
      gap: input.ids ? null : 'missing_config_ids',
      scopeLabel,
    }
  }
  const hour = input.metric === 'hourly_net_sales_kwd' ? Number(input.scope) : null
  const window = orderWindow(input.period, Number.isInteger(hour) ? hour : null)
  if (input.metric === 'product_net_sales_kwd') {
    const lineWindow = orderWindow(input.period, null)
    const domain: OdooDomainTerm[] = []
    if (lineWindow) {
      domain.push(
        term('order_id.date_order', '>=', lineWindow.fromUtc),
        term('order_id.date_order', '<', lineWindow.toExclusiveUtc),
        term('order_id.state', 'in', ['paid', 'done', 'invoiced']),
      )
    }
    if (productId) domain.push(term('product_id', '=', productId))
    if (input.ids) {
      domain.push(...companyTerm(input.ids).map((item) => item))
      if (input.ids.excludedConfigIds.length > 0) {
        domain.push(term('order_id.session_id.config_id', 'not in', input.ids.excludedConfigIds))
      }
      if (input.ids.excludedPosCategoryIds.length > 0) {
        domain.push(term('product_id.pos_categ_id', 'not in', input.ids.excludedPosCategoryIds))
      }
    }
    return {
      model: 'pos.order.line',
      domain,
      records: productId ? [{ model: 'product.product', id: productId }] : [],
      gap: productId ? (input.ids ? null : 'missing_config_ids') : 'missing_product_id',
      scopeLabel,
    }
  }
  if (input.metric === 'brand_net_sales_kwd') {
    const lineWindow = orderWindow(input.period, null)
    return {
      model: 'pos.order.line',
      domain: lineWindow
        ? [
            term('order_id.date_order', '>=', lineWindow.fromUtc),
            term('order_id.date_order', '<', lineWindow.toExclusiveUtc),
            term('order_id.state', 'in', ['paid', 'done', 'invoiced']),
          ]
        : [],
      records: [],
      gap: 'brand_unresolved',
      scopeLabel,
    }
  }
  const orderDomain: OdooDomainTerm[] = []
  if (window) {
    orderDomain.push(
      term('date_order', '>=', window.fromUtc),
      term('date_order', '<', window.toExclusiveUtc),
      term('state', 'in', ['paid', 'done', 'invoiced']),
    )
  }
  let gap: FactSourceGap | null = input.ids ? null : 'missing_config_ids'
  if (input.ids && window) {
    orderDomain.push(...companyTerm(input.ids))
    if (input.scope !== 'company' && (APPROVED_BRANCH_IDS as readonly string[]).includes(input.scope)) {
      const branchIds = input.ids.configIdsByBranch[input.scope] ?? []
      if (branchIds.length > 0) orderDomain.push(term('session_id.config_id', 'in', branchIds))
      else gap = 'missing_config_ids'
    } else if (input.scope === 'unattributed') {
      const known = knownConfigIds(input.ids)
      if (known.length > 0) orderDomain.push(term('session_id.config_id', 'not in', known))
      else gap = 'missing_config_ids'
    } else if (input.scope !== 'company' && input.metric !== 'hourly_net_sales_kwd') {
      gap = 'missing_config_ids'
    } else if (input.ids.excludedConfigIds.length > 0) {
      orderDomain.push(term('session_id.config_id', 'not in', input.ids.excludedConfigIds))
    }
  }
  return {
    model: 'pos.order',
    domain: orderDomain,
    records: [],
    gap,
    scopeLabel,
  }
}

function isDomainValue(value: unknown): value is OdooDomainValue {
  if (typeof value === 'string' || typeof value === 'boolean') return true
  if (typeof value === 'number') return Number.isInteger(value) && value > 0
  if (!Array.isArray(value) || value.length === 0) return false
  if (value.every((item) => typeof item === 'string' && item.length > 0)) return true
  return value.every((item) => typeof item === 'number' && Number.isInteger(item) && item > 0)
}

export function parseFactSource(value: unknown): FactSource | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (!ODOO_SOURCE_MODELS.includes(record.model as OdooSourceModel)) return null
  if (!Array.isArray(record.domain)) return null
  const domain: OdooDomainTerm[] = []
  for (const entry of record.domain) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
    const termRecord = entry as Record<string, unknown>
    if (typeof termRecord.field !== 'string' || !DOMAIN_FIELDS.has(termRecord.field)) return null
    if (typeof termRecord.operator !== 'string' || !OPERATORS.has(termRecord.operator as OdooDomainOperator)) return null
    if (!isDomainValue(termRecord.value)) return null
    domain.push({
      field: termRecord.field,
      operator: termRecord.operator as OdooDomainOperator,
      value: termRecord.value,
    })
  }
  const records = Array.isArray(record.records)
    ? record.records.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
        const item = entry as Record<string, unknown>
        if (item.model !== 'product.product' || !positiveIds([item.id]).length) return []
        return [{ model: 'product.product' as const, id: positiveIds([item.id])[0] }]
      })
    : []
  const gap =
    record.gap === 'missing_config_ids' ||
    record.gap === 'brand_unresolved' ||
    record.gap === 'commission_classifier' ||
    record.gap === 'aging_unverified' ||
    record.gap === 'missing_product_id'
      ? record.gap
      : null
  return {
    model: record.model as OdooSourceModel,
    domain,
    records,
    gap,
    scopeLabel: typeof record.scopeLabel === 'string' ? record.scopeLabel : '',
  }
}

export function odooWebBase(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null
  if (url.pathname !== '/' && url.pathname !== '') return null
  return url.origin
}

function domainTuples(domain: readonly OdooDomainTerm[]): unknown[][] {
  return domain.map((item) => [item.field, item.operator, item.value])
}

export function formatDomain(source: FactSource): string {
  const body = source.domain
    .map((item) => {
      const value = Array.isArray(item.value) ? item.value.join(', ') : String(item.value)
      return `${item.field} ${item.operator} ${value}`
    })
    .join(' · ')
  const gap = source.gap ? GAP_TEXT[source.gap] : ''
  const scope = source.scopeLabel ? `scope ${source.scopeLabel}` : ''
  return [source.model, body, scope, gap].filter(Boolean).join(' · ')
}

function listHref(base: string | null, source: FactSource): string | null {
  if (!base || source.gap || source.domain.length === 0) return null
  const domain = encodeURIComponent(JSON.stringify(domainTuples(source.domain)))
  return `${base}/web#model=${source.model}&view_type=list&domain=${domain}`
}

function recordHref(base: string | null, model: 'product.product', id: number): string | null {
  if (!base || !positiveIds([id]).length) return null
  return `${base}/web#id=${id}&model=${model}&view_type=form`
}

export function linksForSource(source: FactSource | null, base: string | null): SourceLink[] {
  if (!source) {
    return [
      {
        kind: 'odoo',
        label: 'Odoo',
        href: null,
        model: null,
        domainText: 'no Odoo model is stored on this fact',
      },
    ]
  }
  const domainText = formatDomain(source)
  const links: SourceLink[] = []
  const list = listHref(base, source)
  links.push({
    kind: 'odoo',
    label: source.model,
    href: list,
    model: source.model,
    domainText,
  })
  for (const record of source.records) {
    links.push({
      kind: 'odoo',
      label: `${record.model} ${record.id}`,
      href: recordHref(base, record.model, record.id),
      model: record.model,
      domainText: `${record.model} id ${record.id}`,
    })
  }
  return links
}

export function linksForCitation(citation: Pick<BriefCitation, 'metric' | 'period' | 'scope' | 'source'>, base: string | null): SourceLink[] {
  const source =
    parseFactSource(citation.source) ??
    sourceForMetric({
      metric: citation.metric,
      period: citation.period,
      scope: citation.scope,
      productId: null,
      ids: null,
    })
  return linksForSource(source, base)
}

export function linksForFinding(finding: { citations: readonly BriefCitation[] }, base: string | null): SourceLink[] {
  const links = finding.citations.flatMap((citation) => linksForCitation(citation, base))
  return links.length > 0 ? links : linksForSource(null, base)
}

function approvedBranch(scope: string): string | null {
  return (APPROVED_BRANCH_IDS as readonly string[]).includes(scope) ? scope : null
}

function approvedBrand(scope: string): string | null {
  return (APPROVED_BRAND_IDS as readonly string[]).includes(scope) ? scope : null
}

function appHref(metric: string, citations: readonly Pick<BriefCitation, 'metric' | 'period' | 'scope'>[]): string | null {
  const path = APP_ROUTES[metric]
  if (!path) return null
  const periods = citations
    .filter((citation) => citation.metric === metric)
    .map((citation) => parsePeriod(citation.period))
    .filter((period): period is { from: string; to: string } => period != null)
  if (periods.length === 0) return path
  const scopes = citations.filter((citation) => citation.metric === metric).map((citation) => citation.scope)
  const uniqueScopes = [...new Set(scopes)]
  const branch = uniqueScopes.length === 1 ? approvedBranch(uniqueScopes[0] ?? '') : null
  const brand = uniqueScopes.length === 1 ? approvedBrand(uniqueScopes[0] ?? '') : null
  const params = new URLSearchParams()
  params.set('period', 'custom')
  const from = periods.map((period) => period.from).sort()[0] ?? periods[0].from
  const to = periods.map((period) => period.to).sort().at(-1) ?? periods[0].to
  params.set('from', from)
  params.set('to', to)
  if (branch) params.set('branch', branch)
  if (brand) params.set('brand', brand)
  if (path === '/erp/weekday-comparison') {
    const first = periods[0]
    const second = periods[1] ?? first
    const single = first.from === first.to && second.from === second.to
    params.set('gran', single ? 'single' : 'range')
    params.set('dateA', first.from)
    params.set('toA', first.to)
    params.set('dateB', second.from)
    params.set('toB', second.to)
    if (branch) params.set('branches', branch)
    if (brand) params.set('brands', brand)
  }
  return `${path}?${params.toString()}`
}

export function linksForRecommendation(
  item: { citations: readonly BriefCitation[] },
  base: string | null,
  reportHref: string,
): SourceLink[] {
  const links: SourceLink[] = [
    { kind: 'report', label: 'قيد التقرير المخزّن', href: reportHref, model: null, domainText: null },
  ]
  const metrics = [...new Set(item.citations.map((citation) => citation.metric))]
  for (const metric of metrics) {
    const href = appHref(metric, item.citations)
    if (!href) continue
    links.push({ kind: 'app', label: APP_ROUTES[metric] ?? href, href, model: null, domainText: null })
  }
  for (const citation of item.citations) links.push(...linksForCitation(citation, base))
  return dedupeLinks(links)
}

function dedupeLinks(links: SourceLink[]): SourceLink[] {
  const seen = new Set<string>()
  const out: SourceLink[] = []
  for (const link of links) {
    const key = `${link.kind}|${link.href ?? ''}|${link.domainText ?? ''}|${link.model ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(link)
  }
  return out
}

function reportLink(reportHref: string): SourceLink {
  return { kind: 'report', label: 'قيد التقرير المخزّن', href: reportHref, model: null, domainText: null }
}

function allCitations(report: StoredBriefReport): BriefCitation[] {
  return [
    ...report.findings.flatMap((item) => item.citations),
    ...report.unadoptedFindings.flatMap((item) => item.citations),
    ...report.recommendations.flatMap((item) => item.citations),
    ...report.disputed.flatMap((item) => item.citations),
    ...report.dropped.flatMap((item) => item.citations),
  ]
}

function sectionLinks(section: BriefSection, report: StoredBriefReport, base: string | null, reportHref: string): SourceLink[] {
  if (section.id === 'receivables_aging') {
    return [
      reportLink(reportHref),
      {
        kind: 'app',
        label: '/erp/receivables',
        href: '/erp/receivables',
        model: null,
        domainText: null,
      },
      {
        kind: 'odoo',
        label: 'account.move.line',
        href: null,
        model: 'account.move.line',
        domainText: `account.move.line · ${GAP_TEXT.aging_unverified}`,
      },
    ]
  }
  const metric = SECTION_METRIC[section.id] ?? ''
  const cited = allCitations(report).filter((citation) => citation.metric === metric)
  const odoo = cited.length > 0 ? cited.flatMap((citation) => linksForCitation(citation, base)) : []
  const period = report.periods?.yesterday ?? ''
  const derived =
    odoo.length > 0
      ? odoo
      : linksForSource(
          sourceForMetric({ metric, period, scope: 'company', productId: null, ids: null }),
          base,
        )
  const app = appHref(metric, cited.length > 0 ? cited : [{ metric, period, scope: 'company' }])
  return dedupeLinks([
    reportLink(reportHref),
    ...(app ? [{ kind: 'app' as const, label: app.split('?')[0] ?? app, href: app, model: null, domainText: null }] : []),
    ...derived,
  ])
}

export function reportSectionNotes(input: {
  report: StoredBriefReport
  base: string | null
  reportHref: string
  includeAdminRuns: boolean
}): ReportSectionNote[] {
  const { report, base, reportHref, includeAdminRuns } = input
  const cleanlinessLinks = report.sections.flatMap((section) => sectionLinks(section, report, base, reportHref))
  const analysisLinks = [reportLink(reportHref)]
  if (includeAdminRuns) {
    analysisLinks.push({
      kind: 'app',
      label: '/admin/ai-runs',
      href: '/admin/ai-runs',
      model: null,
      domainText: null,
    })
  }
  const guardLinks = dedupeLinks([
    reportLink(reportHref),
    ...report.findings.flatMap((finding) => linksForFinding(finding, base)),
    ...report.unadoptedFindings.flatMap((finding) => linksForFinding(finding, base)),
  ])
  const recommendationLinks = dedupeLinks([
    reportLink(reportHref),
    ...report.recommendations.flatMap((item) => linksForRecommendation(item, base, reportHref)),
  ])
  const statuses = report.sections.map((section) => `${section.id}: ${section.status}`).join('، ')
  const modelStates = report.models
    .map((model) => `${model.provider}: ${model.status}${model.errorCode ? ` (${model.errorCode})` : ''}`)
    .join('، ')
  return [
    {
      id: 'cleanliness',
      titleAr: 'حالة نظافة البيانات',
      recommendationAr: statuses
        ? `حالة أقسام هذا التقرير: ${statuses}. افتح رابط القسم، أو اسم النموذج ونص المجال عندما لا يوجد رابط، قبل قراءة أي رقم.`
        : 'لا توجد أقسام مصدر مخزّنة في هذا التقرير. لا يُستنتج رقم قبل ربط Odoo.',
      links: cleanlinessLinks.length > 0 ? dedupeLinks(cleanlinessLinks) : [reportLink(reportHref)],
    },
    {
      id: 'analysis',
      titleAr: 'التحليل الخلفي',
      recommendationAr:
        report.configuration === 'not_configured'
          ? `التحليل غير مُهيأ. المفاتيح الناقصة في هذا التقرير: ${report.missingKeys.join('، ') || '—'}. لا تُقرأ نتيجة قبل أن تعمل النماذج.`
          : `حالة النماذج في هذا التقرير: ${modelStates || '—'}. اعتمد النتيجة فقط عندما تكون حالة النموذج ran، ومعرف النموذج هو الظاهر في الجدول.`,
      links: analysisLinks,
    },
    {
      id: 'guard',
      titleAr: 'حارس الحقيقة',
      recommendationAr:
        'النتيجة تدخل قسم البيانات فقط إذا دعمها نموذجان، وكررت قيمة حقيقة Odoo، وظهر تحتها رابط المصدر. ملاحظة النموذج الواحد والملاحظة المتنازع عليها تبقى خارج قسم البيانات.',
      links: guardLinks,
    },
    {
      id: 'recommendations',
      titleAr: 'التوصيات والحلول',
      recommendationAr:
        'كل توصية أدناه مربوطة بصفحة التطبيق التي تعرض الفترة نفسها، وبقيد هذا التقرير المخزّن، وبمصدر Odoo للحقيقة المذكورة.',
      links: recommendationLinks,
    },
    {
      id: 'advisory',
      titleAr: 'الرأي الاستشاري',
      recommendationAr: 'هذا القسم رأي النماذج وليس بياناً من Odoo. لا يُطبَّق، ولا يُقرأ كرقم تشغيلي.',
      links: [reportLink(reportHref)],
    },
    {
      id: 'proposals',
      titleAr: 'المقترحات',
      recommendationAr:
        'كل مقترح حالته proposed. نسخ المسودة نص للمراجعة البشرية. المجلس لا يكتب كوداً ولا ينشر.',
      links: [reportLink(reportHref)],
    },
  ]
}

export function factForGuard<T extends { source?: FactSource | null }>(fact: T): Omit<T, 'source'> {
  const { source: _source, ...rest } = fact
  return rest
}
