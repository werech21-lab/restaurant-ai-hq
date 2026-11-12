'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  MessageSquare,
  Plus,
  Search,
  Star,
  ThumbsUp,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { useGlobalFilter } from '@/components/aether/GlobalFilterContext'
import {
  APPROVED_BRANCH_IDS,
  APPROVED_BRAND_IDS,
  getBranchLabel,
  getBrandLabel,
} from '@/lib/aether/global-filter-engine'
import { useGovernance } from '@/components/erp/GovernanceBellDrawer'
import { OpsFilterSyncBar } from '@/components/erp/ops-expansion/OpsFilterSyncBar'
import {
  computeSocialReviewsSnapshot,
  ISSUE_TAG_LABELS,
  REVIEW_CHANNELS,
  SOCIAL_REVIEWS_ACK_STORAGE_KEY,
  SOCIAL_REVIEWS_CUSTOM_STORAGE_KEY,
  type BranchId,
  type BrandId,
  type EnrichedReviewItem,
  type OmnichannelReviewItem,
  type ReviewChannelId,
  type ReviewIssueTag,
  type ReviewSentiment,
} from '@/lib/ops-expansion-part2'

const PAGE_SIZE = 12

const CARD_CLS =
  'ae-bento-card rounded-2xl bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-900/[0.04] dark:bg-neutral-900 dark:ring-white/[0.06]'
const KPI_CLS =
  'ae-kpi-card rounded-2xl bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-900/[0.04] dark:bg-neutral-900 dark:ring-white/[0.06]'
const INPUT_CLS =
  'h-10 w-full rounded-xl bg-[#F7F7F8] px-3 text-[13px] font-medium text-neutral-900 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 dark:bg-neutral-950 dark:text-white'

function sentimentBadgeCls(sentiment: ReviewSentiment): string {
  if (sentiment === 'positive') {
    return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
  }
  if (sentiment === 'neutral') {
    return 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
  }
  return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
}

function sentimentLabel(sentiment: ReviewSentiment, isAr: boolean): string {
  if (sentiment === 'positive') return isAr ? '🟢 إيجابي' : '🟢 Positive'
  if (sentiment === 'neutral') return isAr ? '🟡 محايد' : '🟡 Neutral'
  return isAr ? '🔴 سلبي يحتاج تدخل' : '🔴 Negative — Action Needed'
}

function starString(stars: number): string {
  const s = Math.max(1, Math.min(5, Math.round(stars)))
  return '★'.repeat(s) + '☆'.repeat(5 - s)
}

export function SocialReviewsStudio() {
  const { locale } = useI18n()
  const isAr = locale === 'ar'
  const { workspace } = useGlobalFilter()
  const { requestApproval, getApprovalByRef, openDrawer } = useGovernance()

  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>([])
  const [customReviews, setCustomReviews] = useState<OmnichannelReviewItem[]>([])
  const [channelFilter, setChannelFilter] = useState<'all' | ReviewChannelId>('all')
  const [sentimentFilter, setSentimentFilter] = useState<'all' | ReviewSentiment>('all')
  const [scorecardView, setScorecardView] = useState<'brands' | 'branches'>('brands')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [copiedReplyId, setCopiedReplyId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  // Add review form state
  const [newChannel, setNewChannel] = useState<ReviewChannelId>('talabat')
  const [newBrand, setNewBrand] = useState<BrandId>('china-garden')
  const [newBranch, setNewBranch] = useState<BranchId>('salmiya')
  const [newStars, setNewStars] = useState(5)
  const [newTag, setNewTag] = useState<ReviewIssueTag>('excellent-quality')
  const [newHandle, setNewHandle] = useState('')
  const [newComment, setNewComment] = useState('')

  useEffect(() => {
    try {
      const rawAck = window.localStorage.getItem(SOCIAL_REVIEWS_ACK_STORAGE_KEY)
      if (rawAck) {
        const parsed = JSON.parse(rawAck)
        if (Array.isArray(parsed)) setAcknowledgedIds(parsed.map(String))
      }
      const rawCustom = window.localStorage.getItem(SOCIAL_REVIEWS_CUSTOM_STORAGE_KEY)
      if (rawCustom) {
        const parsed = JSON.parse(rawCustom)
        if (Array.isArray(parsed)) setCustomReviews(parsed)
      }
    } catch {}
  }, [])

  const ackSet = useMemo(() => new Set(acknowledgedIds), [acknowledgedIds])

  const snap = useMemo(
    () => computeSocialReviewsSnapshot(workspace, ackSet, customReviews),
    [workspace, ackSet, customReviews],
  )

  const filteredReviews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return snap.reviews.filter((r) => {
      if (channelFilter !== 'all' && r.channelId !== channelFilter) return false
      if (sentimentFilter !== 'all' && r.sentiment !== sentimentFilter) return false
      if (!q) return true
      return (
        r.commentAr.toLowerCase().includes(q) ||
        r.commentEn.toLowerCase().includes(q) ||
        r.customerHandle.toLowerCase().includes(q) ||
        r.brandAr.toLowerCase().includes(q) ||
        r.brandEn.toLowerCase().includes(q) ||
        r.branchAr.toLowerCase().includes(q) ||
        r.branchEn.toLowerCase().includes(q) ||
        r.channelAr.toLowerCase().includes(q) ||
        r.channelEn.toLowerCase().includes(q) ||
        r.issueTagAr.toLowerCase().includes(q) ||
        r.issueTagEn.toLowerCase().includes(q)
      )
    })
  }, [snap.reviews, channelFilter, sentimentFilter, searchQuery])

  useEffect(() => {
    setPage(1)
  }, [channelFilter, sentimentFilter, searchQuery, workspace.filters])

  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedReviews = useMemo(
    () => filteredReviews.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredReviews, safePage],
  )

  const toggleAck = useCallback((id: string) => {
    setAcknowledgedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      try {
        window.localStorage.setItem(SOCIAL_REVIEWS_ACK_STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  }, [])

  const handleCopyReply = useCallback(
    async (item: EnrichedReviewItem) => {
      const txt = isAr ? item.readyReplyAr : item.readyReplyEn
      try {
        await navigator.clipboard.writeText(txt)
        setCopiedReplyId(item.id)
        if (!item.acknowledged) toggleAck(item.id)
        setTimeout(() => setCopiedReplyId(null), 2000)
      } catch {}
    },
    [isAr, toggleAck],
  )

  const handleEscalateNegative = useCallback(
    (item: EnrichedReviewItem) => {
      requestApproval({
        refKey: `social-review-escalation-${item.id}`,
        domain: 'operations',
        titleAr: `تصعيد تقييم سلبي (${item.stars}★) — ${item.brandAr} (${item.branchAr}) على ${item.channelAr}`,
        titleEn: `Escalate Negative ${item.stars}★ Review — ${item.brandEn} (${item.branchEn}) on ${item.channelEn}`,
        summaryAr: `العميل (${item.customerHandle}): "${item.commentAr}" — التصنيف: ${item.issueTagAr}. طلب محاسبة مشرف الفرع واعتماد قسيمة تعويض للعميل للحفاظ على التقييم.`,
        summaryEn: `Customer (${item.customerHandle}): "${item.commentEn}" — Tag: ${item.issueTagEn}. Hold branch supervisor accountable & issue guest recovery voucher.`,
        departmentAr: 'رقابة السمعة الرقمية وتجربة العملاء',
        departmentEn: 'Omnichannel Reputation & CX',
        budgetOrCostKwd: 12,
        expectedMonthlyReturnKwd: 280,
        href: '/erp/social-reviews',
      })
      if (!item.acknowledged) toggleAck(item.id)
      openDrawer('approvals')
    },
    [openDrawer, requestApproval, toggleAck],
  )

  const handleAddCustomReview = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!newComment.trim()) return
      const sentiment: ReviewSentiment =
        newStars >= 4 ? 'positive' : newStars === 3 ? 'neutral' : 'negative'
      const bAr = getBrandLabel(newBrand, true)
      const bEn = getBrandLabel(newBrand, false)
      const brAr = getBranchLabel(newBranch, true)
      const brEn = getBranchLabel(newBranch, false)
      const handle = newHandle.trim() || '@guest_kw'

      const rec: OmnichannelReviewItem = {
        id: `sr-custom-${Date.now()}`,
        channelId: newChannel,
        brandId: newBrand,
        branchId: newBranch,
        customerHandle: handle,
        timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
        stars: newStars,
        sentiment,
        issueTag: newTag,
        commentAr: newComment.trim(),
        commentEn: newComment.trim(),
        readyReplyAr:
          sentiment === 'positive'
            ? `شكراً جزيلاً ${handle} على تقييمك الرائع لـ ${bAr} (${brAr})! يسعدنا خدمتك دائماً.`
            : `نعتذر منك بشدة ${handle} عن هذه الملاحظة في ${bAr} (${brAr}). تم توجيه مشرف الفرع فوراً للمعالجة والتعويض.`,
        readyReplyEn:
          sentiment === 'positive'
            ? `Thank you ${handle} for your kind feedback on ${bEn} (${brEn})!`
            : `Our sincere apologies ${handle} regarding ${bEn} (${brEn}). Branch management has been alerted immediately.`,
        unreadAlert: sentiment !== 'positive',
      }
      const next = [rec, ...customReviews]
      setCustomReviews(next)
      try {
        window.localStorage.setItem(SOCIAL_REVIEWS_CUSTOM_STORAGE_KEY, JSON.stringify(next))
      } catch {}
      setNewComment('')
      setNewHandle('')
      setShowAddForm(false)
    },
    [customReviews, newBranch, newBrand, newChannel, newComment, newHandle, newStars, newTag],
  )

  const activeScorecards =
    scorecardView === 'brands' ? snap.brandScorecards : snap.branchScorecards

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="mx-auto max-w-[1520px] space-y-5 pb-12">
      <OpsFilterSyncBar />

      {/* ───────────── 1. Header & Monitored Channels Pills (with Unread/Alert Counts) ───────────── */}
      <header className={CARD_CLS}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11.5px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <MessageSquare className="h-3.5 w-3.5" />
                {isAr
                  ? 'رصد موحد لكل منصات التواصل الاجتماعي وتطبيقات التوصيل وخرائط الفروع'
                  : 'Unified Omnichannel Delivery Apps, Maps & Social Media Radar'}
              </span>
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-neutral-950 sm:text-2xl dark:text-white">
              {isAr
                ? 'مركز مراقبة مواقع التواصل وتطبيقات التوصيل والتعليقات والتقييمات'
                : 'Social Media & Aggregator Reviews Command Center'}
            </h1>
            <p className="max-w-3xl text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-400">
              {isAr
                ? 'متابعة فورية لكل تعليق أو تقييم يُكتب عن أفرعنا الـ 7 ومطاعمنا وبرانداتنا الـ 6 في طلبات، كيتا، جاهز، ديليفرو، كاري/سنونو، خرائط جوجل، إنستغرام، تيك توك، ومنصة إكس.'
                : 'Monitors every customer review, star rating, and comment across Talabat, Keeta, Jahez, Deliveroo, Cari/Snoonu, Google Maps, Instagram, TikTok, and X.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="btn-colored inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-[12.5px] font-bold text-white shadow-sm transition hover:bg-emerald-700"
              style={{ color: '#FFFFFF' }}
            >
              <Plus className="h-4 w-4" />
              {isAr ? '+ توثيق تعليق مرصود' : '+ Log Spotted Review'}
            </button>
          </div>
        </div>

        {/* Monitored Channels Filterable Pills with Unread/Alert Counts */}
        <div className="mt-4 rounded-2xl bg-[#F7F7F8] p-3.5 dark:bg-neutral-950">
          <div className="mb-2 flex items-center justify-between text-[11.5px] font-bold text-neutral-500 dark:text-neutral-400">
            <span>
              {isAr
                ? 'قنوات الرصد المباشر (اضغط على المنصة للفرز):'
                : 'Monitored Channels (Click Pill to Filter):'}
            </span>
            <span className="tabular-nums text-rose-700 dark:text-rose-300">
              {isAr
                ? `تنبيهات غير مقروءة تحتاج متابعة: ${snap.unreadAlertsCount}`
                : `Unread Alerts: ${snap.unreadAlertsCount}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setChannelFilter('all')}
              className={`cursor-pointer rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
                channelFilter === 'all'
                  ? 'btn-colored bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-neutral-700 hover:bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-200'
              }`}
              style={channelFilter === 'all' ? { color: '#FFFFFF' } : undefined}
            >
              {isAr ? `الكل (${snap.totalReviews})` : `All Channels (${snap.totalReviews})`}
            </button>

            {snap.channelPills.map((pill) => {
              const active = channelFilter === pill.channelId
              return (
                <button
                  key={pill.channelId}
                  type="button"
                  onClick={() =>
                    setChannelFilter((prev) => (prev === pill.channelId ? 'all' : pill.channelId))
                  }
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition tabular-nums ${
                    active
                      ? 'btn-colored bg-emerald-600 text-white shadow-sm'
                      : 'bg-white text-neutral-800 hover:bg-neutral-100 dark:bg-neutral-900 dark:text-neutral-200'
                  }`}
                  style={active ? { color: '#FFFFFF' } : undefined}
                >
                  <span>{isAr ? pill.ar : pill.en}</span>
                  <span className="text-[11px] opacity-80">{pill.avgStars.toFixed(1)}★</span>
                  {pill.unreadAlertCount > 0 && (
                    <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10.5px] font-extrabold text-rose-700 dark:bg-rose-950/80 dark:text-rose-300">
                      {pill.unreadAlertCount}!
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Collapsible Add Review Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddCustomReview}
            className="mt-4 space-y-3 rounded-2xl bg-[#F7F7F8] p-4 dark:bg-neutral-950"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <select
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value as ReviewChannelId)}
                className={INPUT_CLS}
              >
                {REVIEW_CHANNELS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {isAr ? c.ar : c.en}
                  </option>
                ))}
              </select>

              <select
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value as BrandId)}
                className={INPUT_CLS}
              >
                {APPROVED_BRAND_IDS.map((b) => (
                  <option key={b} value={b}>
                    {getBrandLabel(b, isAr)}
                  </option>
                ))}
              </select>

              <select
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value as BranchId)}
                className={INPUT_CLS}
              >
                {APPROVED_BRANCH_IDS.map((br) => (
                  <option key={br} value={br}>
                    {getBranchLabel(br, isAr)}
                  </option>
                ))}
              </select>

              <select
                value={newStars}
                onChange={(e) => setNewStars(Number(e.target.value))}
                className={INPUT_CLS}
              >
                {[5, 4, 3, 2, 1].map((s) => (
                  <option key={s} value={s}>
                    {s} ★
                  </option>
                ))}
              </select>

              <select
                value={newTag}
                onChange={(e) => setNewTag(e.target.value as ReviewIssueTag)}
                className={INPUT_CLS}
              >
                {(Object.keys(ISSUE_TAG_LABELS) as ReviewIssueTag[]).map((k) => (
                  <option key={k} value={k}>
                    {isAr ? ISSUE_TAG_LABELS[k].ar : ISSUE_TAG_LABELS[k].en}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                placeholder={isAr ? 'حساب العميل (@handle)' : 'Customer Handle (@...)'}
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                className={`${INPUT_CLS} sm:w-56`}
              />
              <input
                type="text"
                required
                placeholder={isAr ? 'نص التعليق أو التقييم كما ورد...' : 'Verbatim customer comment...'}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className={`${INPUT_CLS} flex-1`}
              />
              <button
                type="submit"
                className="btn-colored h-10 shrink-0 cursor-pointer rounded-xl bg-emerald-600 px-4 text-[12.5px] font-bold text-white hover:bg-emerald-700"
                style={{ color: '#FFFFFF' }}
              >
                {isAr ? 'حفظ التعليق ✅' : 'Save Review ✅'}
              </button>
            </div>
          </form>
        )}
      </header>

      {/* ───────────── 2. KPI Summary Row ───────────── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-neutral-500 dark:text-neutral-400">
              {isAr ? 'متوسط التقييم العام الموزون' : 'Average Star Rating'}
            </span>
            <Star className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-extrabold text-neutral-950 dark:text-white">
              {snap.avgStars.toFixed(2)}
            </span>
            <span className="text-[13px] font-bold text-amber-500">★ / 5.0</span>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-500 tabular-nums">
            {isAr
              ? `إجمالي ${snap.totalReviews} تقييم وتعليق مرصود`
              : `Across ${snap.totalReviews} monitored reviews`}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-emerald-800 dark:text-emerald-300">
              {isAr ? '🟢 إيجابي (إشادة وجودة)' : '🟢 Positive Sentiment'}
            </span>
            <ThumbsUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">
              {snap.positivePct.toFixed(1)}%
            </span>
            <span className="text-[12px] font-semibold text-neutral-500">
              ({snap.positiveCount})
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-500">
            {isAr ? 'ثبات الطعم، الحصص الراهية، وسرعة أسطولنا' : 'Flavor consistency, portions & own-fleet speed'}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-amber-800 dark:text-amber-200">
              {isAr ? '🟡 محايد وملاحظات تحسين' : '🟡 Neutral / Constructive'}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">
              {snap.neutralPct.toFixed(1)}%
            </span>
            <span className="text-[12px] font-semibold text-neutral-500">
              ({snap.neutralCount})
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-500">
            {isAr ? 'انتظار طاولات الويكند أو صوص إضافي' : 'Weekend table waitlist or extra sauce notes'}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-bold text-rose-700 dark:text-rose-300">
              {isAr ? '🔴 سلبي يحتاج تدخل فوري' : '🔴 Negative — Needs Action'}
            </span>
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-extrabold text-rose-700 dark:text-rose-300">
              {snap.negativePct.toFixed(1)}%
            </span>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              {snap.negativeCount} {isAr ? 'شكوى' : 'alerts'}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-rose-700/90 dark:text-rose-300/90">
            {isAr ? 'محاسبة فورية للفرع أو مطالبة منصة التوصيل' : 'Immediate branch accountability & recovery'}
          </p>
        </div>
      </section>

      {/* ───────────── 3. Brand & Branch Scorecard Grid (Top Praise vs Top Complaint Root Cause) ───────────── */}
      <section className={CARD_CLS}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[15.5px] font-extrabold text-neutral-950 dark:text-white">
              {isAr
                ? 'بطاقات أداء السمعة: أبرز نقاط الإشادة مقابل الجذر الرئيسي للشكاوى'
                : 'Brand & Branch Reputation Scorecards: Top Praise vs Complaint Root Cause'}
            </h2>
            <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
              {isAr
                ? 'قارن التقييم وتوزيع المشاعر بين البراندات الـ 6 والفروع الـ 7'
                : 'Compare star ratings, sentiment split, praise, and root-cause bottlenecks'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-[#F7F7F8] p-1 dark:bg-neutral-950">
            <button
              type="button"
              onClick={() => setScorecardView('brands')}
              className={`cursor-pointer rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
                scorecardView === 'brands'
                  ? 'btn-colored bg-emerald-600 text-white shadow-sm'
                  : 'text-neutral-700 dark:text-neutral-300'
              }`}
              style={scorecardView === 'brands' ? { color: '#FFFFFF' } : undefined}
            >
              {isAr ? 'البراندات الـ ٦' : '6 Brands'}
            </button>
            <button
              type="button"
              onClick={() => setScorecardView('branches')}
              className={`cursor-pointer rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
                scorecardView === 'branches'
                  ? 'btn-colored bg-emerald-600 text-white shadow-sm'
                  : 'text-neutral-700 dark:text-neutral-300'
              }`}
              style={scorecardView === 'branches' ? { color: '#FFFFFF' } : undefined}
            >
              {isAr ? 'الفروع الـ ٧' : '7 Branches'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {activeScorecards.map((sc) => (
            <div
              key={sc.id}
              className="rounded-2xl bg-[#F7F7F8] p-4 dark:bg-neutral-950"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-extrabold text-neutral-950 dark:text-white">
                  {isAr ? sc.ar : sc.en}
                </span>
                <div className="flex items-center gap-2 tabular-nums">
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[12px] font-extrabold text-neutral-900 dark:bg-neutral-900 dark:text-white">
                    {sc.avgStars.toFixed(2)} <span className="text-amber-500">★</span>
                  </span>
                  <span className="text-[11px] font-semibold text-neutral-500">
                    ({sc.totalReviews})
                  </span>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-3 text-[11px] font-bold tabular-nums">
                <span className="text-emerald-700 dark:text-emerald-300">🟢 {sc.positiveCount}</span>
                <span className="text-amber-700 dark:text-amber-300">🟡 {sc.neutralCount}</span>
                <span className="text-rose-700 dark:text-rose-300">🔴 {sc.negativeCount}</span>
              </div>

              <div className="mt-3 space-y-1.5 rounded-xl bg-white p-3 text-[11.5px] leading-relaxed dark:bg-neutral-900">
                <div>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {isAr ? 'أبرز إشادة: ' : 'Top Praise: '}
                  </span>
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {isAr ? sc.topPraiseAr : sc.topPraiseEn}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-rose-700 dark:text-rose-400">
                    {isAr ? 'أهم سبب شكوى: ' : 'Root Complaint: '}
                  </span>
                  <span className="text-neutral-700 dark:text-neutral-300">
                    {isAr ? sc.topComplaintAr : sc.topComplaintEn}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── 4. Searchable, Filterable, Paginated Unified Review Feed (12/page) ───────────── */}
      <section className={CARD_CLS}>
        <div className="flex flex-col gap-3 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[15.5px] font-extrabold text-neutral-950 dark:text-white">
              {isAr
                ? 'سجل التعليقات والتقييمات الموحد (١٢ تقييم لكل صفحة)'
                : 'Unified Verbatim Reviews & Comments Feed (12 / Page)'}
            </h2>
            <p className="text-[12px] text-neutral-500 dark:text-neutral-400">
              {isAr
                ? 'انسخ رداً احترافياً جاهزاً بضغطة زر أو صعّد التقييم السلبي لجرس المدير لمحاسبة الفرع فوراً'
                : 'Copy ready professional reply in 1 click or escalate negative reviews to the Manager Bell'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', ar: 'كل التقييمات', en: 'All' },
                { id: 'positive', ar: '🟢 إيجابي', en: '🟢 Positive' },
                { id: 'neutral', ar: '🟡 محايد', en: '🟡 Neutral' },
                { id: 'negative', ar: '🔴 سلبي يحتاج تدخل', en: '🔴 Negative' },
              ] as const
            ).map((s) => {
              const active = sentimentFilter === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSentimentFilter(s.id)}
                  className={`cursor-pointer rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                    active
                      ? 'btn-colored bg-emerald-600 text-white shadow-sm'
                      : 'bg-[#F7F7F8] text-neutral-700 hover:bg-neutral-200/70 dark:bg-neutral-950 dark:text-neutral-300'
                  }`}
                  style={active ? { color: '#FFFFFF' } : undefined}
                >
                  {isAr ? s.ar : s.en}
                </button>
              )
            })}
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isAr
                ? 'ابحث في نص التعليق، اسم الحساب، المنصة، البراند، الفرع أو نوع الملاحظة...'
                : 'Search comment text, handle, platform, brand, branch, or issue tag...'
            }
            className={`${INPUT_CLS} ps-9`}
          />
        </div>

        <div className="space-y-3">
          {paginatedReviews.map((rev) => {
            const escalated = getApprovalByRef(`social-review-escalation-${rev.id}`)
            return (
              <article
                key={rev.id}
                className="rounded-2xl bg-[#F7F7F8] p-4 transition dark:bg-neutral-950"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-white px-2.5 py-1 text-[12px] font-extrabold text-neutral-900 dark:bg-neutral-900 dark:text-white">
                      {isAr ? rev.channelAr : rev.channelEn}
                    </span>
                    <span className="rounded-lg bg-white px-2.5 py-1 text-[12px] font-bold text-emerald-800 dark:bg-neutral-900 dark:text-emerald-300">
                      {isAr ? `${rev.brandAr} · ${rev.branchAr}` : `${rev.brandEn} · ${rev.branchEn}`}
                    </span>
                    <span className="rounded-lg bg-white px-2.5 py-1 text-[11.5px] font-semibold text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                      {isAr ? rev.issueTagAr : rev.issueTagEn}
                    </span>
                    <span className="text-[12px] font-bold text-neutral-700 dark:text-neutral-300">
                      {rev.customerHandle}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 tabular-nums">
                    <span className="text-[13px] font-bold text-amber-500">
                      {starString(rev.stars)} ({rev.stars}.0)
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${sentimentBadgeCls(rev.sentiment)}`}
                    >
                      {sentimentLabel(rev.sentiment, isAr)}
                    </span>
                    <span className="text-[11px] text-neutral-500">{rev.timestamp}</span>
                  </div>
                </div>

                <p className="mt-2.5 text-[13.5px] font-medium leading-relaxed text-neutral-900 dark:text-neutral-100">
                  “{isAr ? rev.commentAr : rev.commentEn}”
                </p>

                <div className="mt-3 flex flex-col gap-2.5 rounded-xl bg-white p-3 sm:flex-row sm:items-center sm:justify-between dark:bg-neutral-900">
                  <div className="text-[12px] leading-relaxed text-neutral-600 dark:text-neutral-300">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      {isAr ? 'الرد الجاهز: ' : 'Ready Reply: '}
                    </span>
                    {isAr ? rev.readyReplyAr : rev.readyReplyEn}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyReply(rev)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-[#F7F7F8] px-3 py-1.5 text-[11.5px] font-bold text-neutral-800 transition hover:bg-neutral-200/70 dark:bg-neutral-950 dark:text-neutral-200"
                    >
                      {copiedReplyId === rev.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copiedReplyId === rev.id
                        ? isAr
                          ? 'تم نسخ الرد ✅'
                          : 'Copied ✅'
                        : isAr
                          ? 'نسخ رد احترافي جاهز 📋'
                          : 'Copy Ready Reply 📋'}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleAck(rev.id)}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11.5px] font-bold transition ${
                        rev.acknowledged
                          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-[#F7F7F8] text-neutral-600 dark:bg-neutral-950 dark:text-neutral-400'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {rev.acknowledged
                        ? isAr
                          ? 'تمت المتابعة'
                          : 'Handled'
                        : isAr
                          ? 'تأشير كمقروء'
                          : 'Mark Read'}
                    </button>

                    {rev.sentiment !== 'positive' && (
                      <button
                        type="button"
                        onClick={() => handleEscalateNegative(rev)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-xl bg-rose-50 px-3 py-1.5 text-[11.5px] font-bold text-rose-700 transition hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300"
                      >
                        <Bell className="h-3.5 w-3.5" />
                        {escalated
                          ? isAr
                            ? 'تم التصعيد للمدير ✅'
                            : 'Escalated ✅'
                          : isAr
                            ? 'تصعيد التقييم السلبي لجرس المدير 🔔'
                            : 'Escalate to Manager 🔔'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        {/* Pagination Footer (12 reviews/page) */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#F7F7F8] px-4 py-2.5 text-[12px] font-semibold text-neutral-600 tabular-nums dark:bg-neutral-950 dark:text-neutral-300">
          <span>
            {isAr
              ? `عرض ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filteredReviews.length)} من أصل ${filteredReviews.length} تقييم وتعليق`
              : `Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filteredReviews.length)} of ${filteredReviews.length} reviews`}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-white px-2.5 text-[12px] font-bold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-900 dark:text-neutral-200"
            >
              {isAr ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              {isAr ? 'السابق' : 'Prev'}
            </button>
            <span className="px-2 font-extrabold text-neutral-900 dark:text-white">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg bg-white px-2.5 text-[12px] font-bold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-900 dark:text-neutral-200"
            >
              {isAr ? 'التالي' : 'Next'}
              {isAr ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
