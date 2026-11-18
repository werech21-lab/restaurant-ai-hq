import {
  isExhibitionGroupReported,
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  APPROVED_CHANNEL_IDS,
  getBranchLabel,
  getBrandLabel,
  getChannelLabel,
  type GlobalBranch,
  type GlobalBrand,
  type GlobalChannel,
  type GlobalWorkspaceSlice,
} from '@/lib/aether/global-filter-engine'
import type { OdooBucketSummary, OdooLiveSummary } from '@/lib/odoo/live-sync-core'
import type { KpiProvenanceKind } from '@/components/erp/KpiProvenanceBadge'
import { formatInt, formatKwd, formatPct } from '@/lib/format'

export interface ReportColumn {
  key: string
  labelAr: string
  labelEn: string
  align?: 'left' | 'center' | 'right'
  isCurrency?: boolean
  isPercent?: boolean
  isBadge?: boolean
}

export interface ReportKpi {
  labelAr: string
  labelEn: string
  value: string
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  subtextAr?: string
  subtextEn?: string
  odooModel?: string
  provenanceKind?: KpiProvenanceKind
  queryOrFormula?: string
}

export interface ReportBreakdownItem {
  labelAr: string
  labelEn: string
  value: number
  percent: number
  color: string
}

export interface EnterpriseReportDef {
  id: string
  departmentId: string
  titleAr: string
  titleEn: string
  code: string
  sourceState: 'odoo-live'
  odooModel?: string
  summaryAr: string
  summaryEn: string
  headlineMetricAr: string
  headlineMetricEn: string
  recordCount: number
  auditedDate: string
  glIncomplete?: boolean
  kpis: ReportKpi[]
  breakdownTitleAr: string
  breakdownTitleEn: string
  breakdown: ReportBreakdownItem[]
  columns: ReportColumn[]
  rows: Record<string, string | number>[]
}

export interface EnterpriseDepartmentDef {
  id: string
  titleAr: string
  titleEn: string
  icon: string
  accentColor: string
  descriptionAr: string
  descriptionEn: string
  reports: EnterpriseReportDef[]
}

const BRAND_COLORS: Record<string, string> = {
  'china-garden': '#f59e0b',
  franks: '#ef4444',
  tahina: '#10b981',
  'farm-brown': '#84cc16',
  'noodle-bar': '#06b6d4',
  'karak-cafeteria': '#8b5cf6',
}

function resolveActiveBucket(
  workspace: GlobalWorkspaceSlice,
  liveSummary: OdooLiveSummary | null,
): OdooBucketSummary | null {
  if (!liveSummary || !liveSummary.connected) return null
  const p = workspace.filters.period
  if (p === 'custom') return liveSummary.customBucket ?? liveSummary.buckets?.month ?? null
  return liveSummary.buckets?.[p] ?? null
}

function fmtKwd(v: number | null | undefined, isAr: boolean): string {
  if (v === null || v === undefined || !Number.isFinite(v)) {
    return isAr ? 'غير متوفر' : 'Unavailable'
  }
  return formatKwd(v, isAr ? 'ar' : 'en')
}

/**
 * Builds the live departmental reports directory strictly from `useGlobalFilter()`
 * (`workspace` + `liveSummary`) with ZERO static October figures.
 */
export function buildLiveEnterpriseDepartments(
  workspace: GlobalWorkspaceSlice,
  liveSummary: OdooLiveSummary | null,
  isAr = true,
): EnterpriseDepartmentDef[] {
  const bucket = resolveActiveBucket(workspace, liveSummary)
  const connected = Boolean(workspace.odooConnected && !workspace.noData)
  const rangeStr = `${workspace.dateRange.from} → ${workspace.dateRange.to}`

  const isSubScoped =
    workspace.filters.brand !== 'all' ||
    workspace.filters.branch !== 'all' ||
    workspace.filters.channel !== 'all' ||
    workspace.filters.kuwaitSlice !== 'all'

  const rawTotalSales = connected
    ? isSubScoped
      ? workspace.nullableSalesKwd
      : bucket
        ? bucket.totals.netSalesKwd
        : workspace.nullableSalesKwd
    : 0
  const rawTotalOrders = connected
    ? isSubScoped
      ? workspace.nullableOrders
      : bucket
        ? bucket.totals.orders
        : workspace.nullableOrders
    : 0
  const totalsUnavailable = connected && (rawTotalSales === null || rawTotalOrders === null)
  const totalSales = rawTotalSales ?? 0
  const totalOrders = rawTotalOrders ?? 0
  const aov =
    !totalsUnavailable && totalOrders > 0
      ? Math.round((totalSales / totalOrders) * 1000) / 1000
      : 0

  // 1. Brand Sales Report (6 approved brands)
  const brandRows =
    connected && !totalsUnavailable && bucket?.byBrand !== null
      ? APPROVED_BRAND_IDS.map((brandId) => {
          const bktHit = bucket?.byBrand?.[brandId]
          const summaryHit = (liveSummary?.brands ?? []).find((b) => b.id === brandId)
          const net = bktHit?.netKwd ?? summaryHit?.netKwd ?? 0
          const ord = bktHit?.orders ?? 0
          const share = totalSales > 0 ? (net / totalSales) * 100 : 0
          return {
            id: brandId,
            labelAr: getBrandLabel(brandId as GlobalBrand, true),
            labelEn: getBrandLabel(brandId as GlobalBrand, false),
            net,
            ord,
            share,
            aov: ord > 0 ? Math.round((net / ord) * 1000) / 1000 : 0,
          }
        }).sort((a, b) => b.net - a.net)
      : []

  // 2. Branch Sales Report (7 approved branches + school-canteens + exhibition booths + explicit «غير منسوب لفرع»)
  const targetBranchIds: readonly Exclude<GlobalBranch, 'all'>[] =
    workspace.filters.branch === 'all'
      ? [
          ...APPROVED_BRANCH_IDS,
          'school-canteens',
          ...(isExhibitionGroupReported(bucket) ? (['exhibitions'] as const) : []),
        ]
      : [workspace.filters.branch]
  const branchRows =
    connected && !totalsUnavailable && bucket?.byLocation !== null
      ? [
          ...targetBranchIds.map((branchId) => {
            const loc = bucket?.mappedByLocation?.[branchId] ?? bucket?.byLocation?.[branchId]
            const summaryHit = (liveSummary?.branches ?? []).find((b) => b.id === branchId)
            const net =
              workspace.filters.branch !== 'all' && isSubScoped
                ? totalSales
                : (loc?.netKwd ?? summaryHit?.netSalesKwd ?? 0)
            const ord =
              workspace.filters.branch !== 'all' && isSubScoped
                ? totalOrders
                : (loc?.orders ?? summaryHit?.orders ?? 0)
            const share = totalSales > 0 ? (net / totalSales) * 100 : 0
            return {
              id: branchId,
              labelAr: getBranchLabel(branchId as GlobalBranch, true),
              labelEn: getBranchLabel(branchId as GlobalBranch, false),
              net,
              ord,
              share,
              aov: ord > 0 ? Math.round((net / ord) * 1000) / 1000 : 0,
            }
          }),
          ...(workspace.filters.branch === 'all'
            ? [
                {
                  id: 'unattributed',
                  labelAr: 'غير منسوب لفرع',
                  labelEn: 'Unattributed to Branch',
                  net: bucket?.unattributedBranch?.netSalesKwd ?? workspace.unattributedSalesKwd,
                  ord: bucket?.unattributedBranch?.orders ?? workspace.unattributedOrders,
                  share:
                    totalSales > 0
                      ? ((bucket?.unattributedBranch?.netSalesKwd ??
                          workspace.unattributedSalesKwd) /
                          totalSales) *
                        100
                      : 0,
                  aov:
                    (bucket?.unattributedBranch?.orders ?? workspace.unattributedOrders) > 0
                      ? Math.round(
                          ((bucket?.unattributedBranch?.netSalesKwd ??
                            workspace.unattributedSalesKwd) /
                            (bucket?.unattributedBranch?.orders ?? workspace.unattributedOrders)) *
                            1000,
                        ) / 1000
                      : 0,
                },
              ]
            : []),
        ]
      : []

  // 3. Channel Sales Report (8 approved channels)
  const channelRows =
    connected && bucket?.uiChannels !== null
      ? APPROVED_CHANNEL_IDS.map((channelId) => {
          const hit = bucket?.uiChannels?.[channelId]
          const net = hit?.netKwd ?? 0
          const ord = hit?.orders ?? 0
          const share = totalSales > 0 ? (net / totalSales) * 100 : 0
          return {
            id: channelId,
            labelAr: getChannelLabel(channelId as GlobalChannel, true),
            labelEn: getChannelLabel(channelId as GlobalChannel, false),
            net,
            ord,
            share,
          }
        }).sort((a, b) => b.net - a.net)
      : []

  const acc = workspace.accounting
  const rec = workspace.receivables

  const glRows: Record<string, string | number>[] =
    connected && acc.available
      ? [
          {
            lineItem: isAr ? 'الإيرادات الدفترية المرحلة' : 'Posted GL Revenue',
            model: 'account.move.line',
            amount: formatKwd(acc.totalRevenueKwd, { showUnit: false }),
            pctOfRev: '100.0%',
            status: isAr ? 'مرحّل' : 'Posted',
          },
          {
            lineItem: isAr ? 'تكلفة البضاعة المباعة المرحلة (COGS)' : 'Posted GL COGS',
            model: 'account.move.line',
            amount: formatKwd(acc.cogsKwd, { showUnit: false }),
            pctOfRev: formatPct(acc.cogsPct),
            status: isAr ? 'مرحّل' : 'Posted',
          },
          {
            lineItem: isAr ? 'عمولات منصات التوصيل' : 'Aggregator Commissions',
            model: 'account.move.line',
            amount:
              workspace.aggregatorCommissionUnposted || acc.aggregatorCommissionUnposted
                ? 'غير مُرحَّل بعد'
                : formatKwd(acc.deliveryCommissionsKwd, { showUnit: false }),
            pctOfRev:
              workspace.aggregatorCommissionUnposted || acc.aggregatorCommissionUnposted
                ? 'غير مُرحَّل بعد'
                : formatPct(acc.deliveryCommPct),
            status:
              workspace.aggregatorCommissionUnposted || acc.aggregatorCommissionUnposted
                ? 'غير مُرحَّل بعد'
                : isAr
                  ? 'مرحّل'
                  : 'Posted',
          },
          {
            lineItem: isAr ? 'المصاريف التشغيلية والإهلاك المرحلة' : 'Posted OPEX & Depreciation',
            model: 'account.move.line',
            amount: formatKwd(acc.otherOpexAndDepreciationKwd, { showUnit: false }),
            pctOfRev: formatPct(acc.opexRentDeprPct),
            status: workspace.glIncomplete ? 'قيود غير مكتملة لهذه الفترة' : isAr ? 'مرحّل' : 'Posted',
          },
          {
            lineItem: isAr ? 'صافي النتيجة التشغيلية المرحلة' : 'Posted Operating Result',
            model: 'account.move.line',
            amount: formatKwd(acc.operatingProfitKwd, { showUnit: false }),
            pctOfRev: formatPct(acc.netProfitPct),
            status: workspace.glIncomplete ? 'قيود غير مكتملة لهذه الفترة' : isAr ? 'مرحّل' : 'Posted',
          },
        ]
      : []

  const arRows: Record<string, string | number>[] =
    connected && !rec.unavailable
      ? rec.byAccount.map((r) => ({
          code: r.accountCode,
          accountName: isAr ? r.labelAr || r.accountName : r.labelEn || r.accountName,
          lineCount: r.linesCount,
          netResidualKwd: r.residualKwd.toFixed(3),
        }))
      : []
  const brandsReportUnavailable = connected && (totalsUnavailable || bucket?.byBrand === null)
  const branchesReportUnavailable = connected && (totalsUnavailable || bucket?.byLocation === null)

  return [
    {
      id: 'sales',
      titleAr: 'المبيعات والفروع والقنوات (Odoo POS)',
      titleEn: 'Sales, Branches & Channels (Odoo POS)',
      icon: '📊',
      accentColor: '#10b981',
      descriptionAr: 'تقارير المبيعات الفعلية للعلامات الـ 6 والفروع الـ 7 (+ غير منسوب لفرع) وقنوات التحصيل من Odoo POS حسب الفترة المختارة.',
      descriptionEn: 'Actual POS sales across the 6 brands, 7 branches (+ Unattributed), and payment channels from Odoo for the selected period.',
      reports: [
        {
          id: 'brand-channel-sales',
          departmentId: 'sales',
          titleAr: 'مبيعات العلامات التجارية الست حسب الفترة',
          titleEn: 'Six Brands POS Sales Performance',
          code: 'VF-POS-01',
          sourceState: 'odoo-live',
          odooModel: 'pos.order',
          summaryAr: 'صافي المبيعات وعدد الطلبات ومتوسط التذكرة لكل علامة تجارية من أوامر نقاط البيع في Odoo.',
          summaryEn: 'Net sales, order counts, and average ticket per brand from Odoo POS orders.',
          headlineMetricAr: !connected
            ? 'لا توجد بيانات من Odoo لهذه الفترة'
            : brandsReportUnavailable
              ? 'غير متاح'
              : fmtKwd(totalSales, true),
          headlineMetricEn: !connected
            ? 'No data from Odoo for this period'
            : brandsReportUnavailable
              ? '—'
              : fmtKwd(totalSales, false),
          recordCount: brandRows.length,
          auditedDate: rangeStr,
          kpis: connected
            ? [
                {
                  labelAr: 'صافي المبيعات',
                  labelEn: 'Net POS Sales',
                  value: totalsUnavailable ? (isAr ? 'غير متاح' : '—') : fmtKwd(totalSales, isAr),
                  odooModel: 'pos.order',
                  provenanceKind: 'فعلي',
                  queryOrFormula: "SUM(pos.order.amount_total - amount_tax) WHERE state IN ('paid','done','invoiced')",
                },
                {
                  labelAr: 'إجمالي الطلبات',
                  labelEn: 'Total Orders',
                  value: totalsUnavailable
                    ? isAr
                      ? 'غير متاح'
                      : '—'
                    : formatInt(totalOrders),
                  odooModel: 'pos.order',
                  provenanceKind: 'فعلي',
                  queryOrFormula: "COUNT(pos.order) WHERE state IN ('paid','done','invoiced')",
                },
                {
                  labelAr: 'متوسط الفاتورة',
                  labelEn: 'Average Ticket',
                  value: totalsUnavailable ? (isAr ? 'غير متاح' : '—') : fmtKwd(aov, isAr),
                  odooModel: 'pos.order',
                  provenanceKind: 'محسوب بمعادلة',
                  queryOrFormula: 'صافي المبيعات ÷ إجمالي الطلبات',
                },
              ]
            : [],
          breakdownTitleAr: 'مساهمة العلامات التجارية الست في مبيعات الفترة',
          breakdownTitleEn: 'Revenue Share by Brand',
          breakdown: brandRows.map((b) => ({
            labelAr: b.labelAr,
            labelEn: b.labelEn,
            value: b.net,
            percent: Number(b.share.toFixed(1)),
            color: BRAND_COLORS[b.id] ?? '#10b981',
          })),
          columns: [
            { key: 'brand', labelAr: 'العلامة التجارية', labelEn: 'Brand', align: 'left' },
            { key: 'orders', labelAr: 'الطلبات', labelEn: 'Orders', align: 'center' },
            { key: 'netSales', labelAr: 'صافي المبيعات (د.ك)', labelEn: 'Net Sales (KWD)', align: 'right', isCurrency: true },
            { key: 'sharePercent', labelAr: 'الحصة %', labelEn: 'Share %', align: 'center', isPercent: true },
            { key: 'avgOrderValue', labelAr: 'متوسط التذكرة (د.ك)', labelEn: 'AOV (KWD)', align: 'right', isCurrency: true },
          ],
          rows: brandRows.map((b) => ({
            brand: isAr ? b.labelAr : b.labelEn,
            orders: b.ord,
            netSales: b.net.toFixed(3),
            sharePercent: formatPct(b.share),
            avgOrderValue: b.aov.toFixed(3),
          })),
        },
        {
          id: 'branch-sales-breakdown',
          departmentId: 'sales',
          titleAr: 'مبيعات الفروع السبعة + غير منسوب لفرع',
          titleEn: 'Seven Operating Branches + Unattributed Sales',
          code: 'VF-POS-02',
          sourceState: 'odoo-live',
          odooModel: 'pos.order',
          summaryAr: 'توزيع المبيعات على الفروع السبعة المعتمدة بالإضافة إلى سطر مستقل للمبيعات غير المربوطة بفرع تشغيلي.',
          summaryEn: 'Sales across the 7 approved branches plus a standalone row for POS configs not mapped to a physical branch.',
          headlineMetricAr: !connected
            ? 'لا توجد بيانات من Odoo لهذه الفترة'
            : branchesReportUnavailable
              ? 'غير متاح'
              : `${fmtKwd(workspace.unattributedSalesKwd, true)} غير منسوب`,
          headlineMetricEn: !connected
            ? 'No data from Odoo for this period'
            : branchesReportUnavailable
              ? '—'
              : `${fmtKwd(workspace.unattributedSalesKwd, false)} unattributed`,
          recordCount: branchRows.length,
          auditedDate: rangeStr,
          kpis: connected
            ? [
                {
                  labelAr: 'إجمالي مبيعات الفترة',
                  labelEn: 'Total Period Sales',
                  value: branchesReportUnavailable
                    ? isAr
                      ? 'غير متاح'
                      : '—'
                    : fmtKwd(totalSales, isAr),
                  odooModel: 'pos.order',
                  provenanceKind: 'فعلي',
                  queryOrFormula: 'SUM(pos.order net sales)',
                },
                {
                  labelAr: 'غير منسوب لفرع',
                  labelEn: 'Unattributed to Branch',
                  value: branchesReportUnavailable
                    ? isAr
                      ? 'غير متاح'
                      : '—'
                    : fmtKwd(
                        bucket?.unattributedBranch?.netSalesKwd ?? workspace.unattributedSalesKwd,
                        isAr,
                      ),
                  odooModel: 'pos.order',
                  provenanceKind: 'فعلي',
                  queryOrFormula: 'SUM(pos.order) WHERE config_id NOT IN 7 physical branch mappings',
                },
              ]
            : [],
          breakdownTitleAr: 'توزيع المبيعات حسب الفرع',
          breakdownTitleEn: 'Sales Share by Branch',
          breakdown: branchRows.map((b) => ({
            labelAr: b.labelAr,
            labelEn: b.labelEn,
            value: b.net,
            percent: Number(b.share.toFixed(1)),
            color: b.id === 'unattributed' ? '#f59e0b' : '#0ea5e9',
          })),
          columns: [
            { key: 'branch', labelAr: 'الفرع', labelEn: 'Branch', align: 'left' },
            { key: 'orders', labelAr: 'الطلبات', labelEn: 'Orders', align: 'center' },
            { key: 'netSales', labelAr: 'صافي المبيعات (د.ك)', labelEn: 'Net Sales (KWD)', align: 'right', isCurrency: true },
            { key: 'sharePercent', labelAr: 'الحصة %', labelEn: 'Share %', align: 'center', isPercent: true },
            { key: 'avgOrderValue', labelAr: 'متوسط التذكرة (د.ك)', labelEn: 'AOV (KWD)', align: 'right', isCurrency: true },
          ],
          rows: branchRows.map((b) => ({
            branch: isAr ? b.labelAr : b.labelEn,
            orders: b.ord,
            netSales: b.net.toFixed(3),
            sharePercent: formatPct(b.share),
            avgOrderValue: b.aov.toFixed(3),
          })),
        },
        {
          id: 'channel-sales-breakdown',
          departmentId: 'sales',
          titleAr: 'تحصيلات قنوات البيع ومنصات التوصيل (pos.payment)',
          titleEn: 'Sales Channels & Aggregator Payments (pos.payment)',
          code: 'VF-POS-03',
          sourceState: 'odoo-live',
          odooModel: 'pos.payment',
          summaryAr: 'المبالغ الفعلية المحصلة عبر طرق الدفع ومنصات التوصيل المسجلة في Odoo POS.',
          summaryEn: 'Actual tender amounts collected per POS payment method in Odoo.',
          headlineMetricAr: !connected
            ? 'لا توجد بيانات من Odoo لهذه الفترة'
            : bucket?.uiChannels === null
              ? 'غير متاح'
              : `${channelRows.length} قنوات`,
          headlineMetricEn: !connected
            ? 'No data from Odoo for this period'
            : bucket?.uiChannels === null
              ? '—'
              : `${channelRows.length} channels`,
          recordCount: channelRows.length,
          auditedDate: rangeStr,
          kpis: connected
            ? [
                {
                  labelAr: 'عمولات التطبيقات المرحلة',
                  labelEn: 'Posted Aggregator Commissions',
                  value: workspace.aggregatorCommissionUnposted
                    ? 'غير مُرحَّل بعد'
                    : fmtKwd(acc.deliveryCommissionsKwd, isAr),
                  odooModel: 'account.move.line',
                  provenanceKind: 'فعلي',
                  queryOrFormula: 'account.move.line posted aggregator commission accounts',
                },
              ]
            : [],
          breakdownTitleAr: 'توزيع التحصيلات حسب القناة',
          breakdownTitleEn: 'Payments Share by Channel',
          breakdown: channelRows.map((c) => ({
            labelAr: c.labelAr,
            labelEn: c.labelEn,
            value: c.net,
            percent: Number(c.share.toFixed(1)),
            color: '#6366f1',
          })),
          columns: [
            { key: 'channel', labelAr: 'القناة', labelEn: 'Channel', align: 'left' },
            { key: 'payments', labelAr: 'عمليات الدفع', labelEn: 'Payments', align: 'center' },
            { key: 'amountKwd', labelAr: 'المبلغ (د.ك)', labelEn: 'Amount (KWD)', align: 'right', isCurrency: true },
            { key: 'sharePercent', labelAr: 'الحصة %', labelEn: 'Share %', align: 'center', isPercent: true },
          ],
          rows: channelRows.map((c) => ({
            channel: isAr ? c.labelAr : c.labelEn,
            payments: c.ord,
            amountKwd: c.net.toFixed(3),
            sharePercent: formatPct(c.share),
          })),
        },
      ],
    },
    {
      id: 'finance',
      titleAr: 'المالية والأرباح والذمم (Odoo GL)',
      titleEn: 'Finance, P&L & Receivables (Odoo GL)',
      icon: '🏛️',
      accentColor: '#0ea5e9',
      descriptionAr: 'ملخص الأرباح والخسائر المرحل والذمم المدينة المفتوحة من قيود account.move.line في Odoo.',
      descriptionEn: 'Posted General Ledger P&L and open receivables directly from Odoo account.move.line.',
      reports: [
        {
          id: 'gl-profit-loss',
          departmentId: 'finance',
          titleAr: 'ملخص الأرباح والخسائر الدفتري المرحل',
          titleEn: 'Posted General Ledger Profit & Loss',
          code: 'VF-FIN-01',
          sourceState: 'odoo-live',
          odooModel: 'account.move.line',
          glIncomplete: workspace.glIncomplete,
          summaryAr: 'الإيرادات والتكاليف المرحلة فعلياً في حسابات الأستاذ العام للفترة المختارة دون أي نسب تقديرية.',
          summaryEn: 'Strictly posted Odoo general ledger income and expense balances with zero synthetic ratios.',
          headlineMetricAr:
            connected && acc.available
              ? fmtKwd(acc.operatingProfitKwd, true)
              : connected && workspace.glIncomplete
                ? 'قيود غير مكتملة لهذه الفترة'
                : 'لا توجد بيانات من Odoo لهذه الفترة',
          headlineMetricEn:
            connected && acc.available
              ? fmtKwd(acc.operatingProfitKwd, false)
              : connected && workspace.glIncomplete
                ? 'Incomplete GL entries for this period'
                : 'No data from Odoo for this period',
          recordCount: glRows.length,
          auditedDate: rangeStr,
          kpis:
            connected && acc.available
              ? [
                  {
                    labelAr: 'الإيراد المرحل',
                    labelEn: 'Posted Revenue',
                    value: fmtKwd(acc.totalRevenueKwd, isAr),
                    odooModel: 'account.move.line',
                    provenanceKind: 'فعلي',
                    queryOrFormula: "SUM(credit - debit) ON income accounts WHERE parent_state='posted'",
                  },
                  {
                    labelAr: 'تكلفة البضاعة المرحلة',
                    labelEn: 'Posted COGS',
                    value: fmtKwd(acc.cogsKwd, isAr),
                    odooModel: 'account.move.line',
                    provenanceKind: 'فعلي',
                    queryOrFormula: "SUM(debit - credit) ON direct_cost accounts WHERE parent_state='posted'",
                  },
                  {
                    labelAr: 'عمولات التطبيقات المرحلة',
                    labelEn: 'Posted Aggregator Commissions',
                    value:
                      workspace.aggregatorCommissionUnposted || acc.aggregatorCommissionUnposted
                        ? 'غير مُرحَّل بعد'
                        : fmtKwd(acc.deliveryCommissionsKwd, isAr),
                    odooModel: 'account.move.line',
                    provenanceKind: 'فعلي',
                    queryOrFormula: 'account.move.line posted aggregator commission accounts',
                  },
                  {
                    labelAr: 'صافي النتيجة المرحلة',
                    labelEn: 'Posted Operating Result',
                    value: fmtKwd(acc.operatingProfitKwd, isAr),
                    subtextAr: workspace.glIncomplete ? 'قيود غير مكتملة لهذه الفترة' : undefined,
                    odooModel: 'account.move.line',
                    provenanceKind: 'محسوب بمعادلة',
                    queryOrFormula: 'الإيراد المرحل − تكلفة البضاعة − عمولات التوصيل − المصاريف المرحلة',
                  },
                ]
              : connected && workspace.glIncomplete
                ? [
                    {
                      labelAr: 'عمولات التطبيقات المرحلة',
                      labelEn: 'Posted Aggregator Commissions',
                      value:
                        workspace.aggregatorCommissionUnposted || acc.aggregatorCommissionUnposted
                          ? 'غير مُرحَّل بعد'
                          : fmtKwd(acc.deliveryCommissionsKwd, isAr),
                      odooModel: 'account.move.line',
                      provenanceKind: 'فعلي',
                      queryOrFormula: 'account.move.line posted aggregator commission accounts',
                    },
                    {
                      labelAr: 'صافي النتيجة المرحلة',
                      labelEn: 'Posted Operating Result',
                      value: isAr ? 'قيود غير مكتملة لهذه الفترة' : 'Incomplete GL entries for this period',
                      subtextAr: 'قيود غير مكتملة لهذه الفترة',
                      odooModel: 'account.move.line',
                      provenanceKind: 'محسوب بمعادلة',
                      queryOrFormula: 'الإيراد المرحل − تكلفة البضاعة − عمولات التوصيل − المصاريف المرحلة',
                    },
                  ]
                : [],
          breakdownTitleAr: 'بنود قائمة الدخل المرحلة',
          breakdownTitleEn: 'Posted Income Statement Lines',
          breakdown: [],
          columns: [
            { key: 'lineItem', labelAr: 'البند المحاسبي', labelEn: 'GL Line Item', align: 'left' },
            { key: 'model', labelAr: 'المصدر', labelEn: 'Odoo Model', align: 'center' },
            { key: 'amount', labelAr: 'المبلغ (د.ك)', labelEn: 'Amount (KWD)', align: 'right', isCurrency: true },
            { key: 'pctOfRev', labelAr: 'نسبة من الإيراد', labelEn: '% of Revenue', align: 'center' },
            { key: 'status', labelAr: 'حالة القيد', labelEn: 'Posting Status', align: 'center', isBadge: true },
          ],
          rows: glRows,
        },
        {
          id: 'ar-aging-ledger',
          departmentId: 'finance',
          titleAr: 'الذمم المدينة المفتوحة وأعمار الديون',
          titleEn: 'Open Accounts Receivable & Aging',
          code: 'VF-FIN-02',
          sourceState: 'odoo-live',
          odooModel: 'account.move.line',
          summaryAr: 'أرصدة حسابات الذمم المدينة غير المسواة من Odoo شاملة الذمم الموجبة ومقاصة التسويات الدائنة.',
          summaryEn: 'Unreconciled receivable account balances from Odoo including gross positive AR and credit clearing offsets.',
          headlineMetricAr: !connected
            ? 'لا توجد بيانات من Odoo لهذه الفترة'
            : rec.unavailable
              ? 'غير متاح'
              : fmtKwd(rec.openReceivableKwd, true),
          headlineMetricEn: !connected
            ? 'No data from Odoo for this period'
            : rec.unavailable
              ? '—'
              : fmtKwd(rec.openReceivableKwd, false),
          recordCount: arRows.length,
          auditedDate: `${rec.fromDate} → ${rec.toDate}`,
          kpis: connected
            ? [
                {
                  labelAr: 'صافي الذمم المفتوحة',
                  labelEn: 'Net Open AR',
                  value: rec.unavailable
                    ? isAr
                      ? 'غير متاح'
                      : '—'
                    : fmtKwd(rec.openReceivableKwd, isAr),
                  odooModel: 'account.move.line',
                  provenanceKind: 'فعلي',
                  queryOrFormula: rec.reconciliationFormulaAr,
                },
                {
                  labelAr: 'الذمم المدينة الموجبة',
                  labelEn: 'Gross Positive AR',
                  value: rec.unavailable
                    ? isAr
                      ? 'غير متاح'
                      : '—'
                    : fmtKwd(rec.grossPositiveReceivableKwd, isAr),
                  odooModel: 'account.move.line',
                  provenanceKind: 'فعلي',
                  queryOrFormula: "SUM(amount_residual > 0) WHERE account_type='asset_receivable' AND reconciled=false",
                },
                {
                  labelAr: 'مقاصة التسويات الدائنة',
                  labelEn: 'Credit Clearing Offset',
                  value: rec.unavailable
                    ? isAr
                      ? 'غير متاح'
                      : '—'
                    : fmtKwd(rec.creditClearingOffsetKwd, isAr),
                  odooModel: 'account.move.line',
                  provenanceKind: 'فعلي',
                  queryOrFormula: "ABS(SUM(amount_residual < 0)) WHERE account_type='asset_receivable' AND reconciled=false",
                },
              ]
            : [],
          breakdownTitleAr: 'تفصيل حسابات الذمم المدينة',
          breakdownTitleEn: 'Receivable Accounts Breakdown',
          breakdown: [],
          columns: [
            { key: 'code', labelAr: 'رمز الحساب', labelEn: 'Code', align: 'center' },
            { key: 'accountName', labelAr: 'اسم الحساب', labelEn: 'Account Name', align: 'left' },
            { key: 'lineCount', labelAr: 'السطور المفتوحة', labelEn: 'Open Lines', align: 'center' },
            { key: 'netResidualKwd', labelAr: 'الصافي المتبقي (د.ك)', labelEn: 'Net Residual (KWD)', align: 'right', isCurrency: true },
          ],
          rows: arRows,
        },
      ],
    },
  ]
}

export const ENTERPRISE_DEPARTMENTS: EnterpriseDepartmentDef[] = []

export function getAllEnterpriseReports(
  workspace?: GlobalWorkspaceSlice,
  liveSummary?: OdooLiveSummary | null,
  isAr = true,
): EnterpriseReportDef[] {
  if (!workspace) return []
  return buildLiveEnterpriseDepartments(workspace, liveSummary ?? null, isAr).flatMap(
    (d) => d.reports,
  )
}

export function getReportById(
  id: string,
  workspace?: GlobalWorkspaceSlice,
  liveSummary?: OdooLiveSummary | null,
  isAr = true,
): EnterpriseReportDef | null {
  if (!workspace) return null
  const all = getAllEnterpriseReports(workspace, liveSummary, isAr)
  return all.find((r) => r.id === id) ?? null
}
