'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
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
  'ae-bento-card rounded-2xl bg-white p-3.5 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const KPI_CLS =
  'ae-kpi-card rounded-2xl bg-white p-3.5 sm:p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04),0_1px_2px_rgba(15,23,42,0.02)] ring-1 ring-slate-900/[0.04] dark:bg-[#101C17] dark:ring-emerald-500/10'
const SUBCARD_CLS =
  'rounded-2xl bg-[#F6F7F8] ring-1 ring-slate-900/[0.03] dark:bg-[#0B1410] dark:ring-emerald-500/[0.08]'
const SEGMENT_TRACK_CLS =
  'flex max-w-full items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-neutral-100/90 dark:bg-white/[0.06]'
const SEGMENT_BTN_CLS =
  'shrink-0 whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-150 cursor-pointer'
const SEGMENT_BTN_ACTIVE_CLS =
  'bg-white font-semibold text-emerald-900 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.05] dark:bg-emerald-500/20 dark:text-emerald-200 dark:ring-emerald-400/25'
const SEGMENT_BTN_IDLE_CLS =
  'text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
const TABLE_SCROLL_CLS = 'overflow-x-auto -mx-3.5 px-3.5 sm:mx-0 sm:px-0'
const INPUT_CLS =
  'h-10 w-full rounded-xl bg-[#F6F7F8] px-3.5 text-[14px] font-medium text-neutral-900 ring-1 ring-slate-200/80 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600/30 dark:bg-[#0B1410] dark:text-white dark:ring-emerald-500/15 dark:focus:bg-[#101C17]'

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
  return isAr ? '🔴 سلبي حرج' : '🔴 Critical'
}

function starString(stars: number): string {
  const s = Math.max(1, Math.min(5, Math.round(stars)))
  return '★'.repeat(s) + '☆'.repeat(5 - s)
}

export function SocialReviewsStudio() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
  const { filters, workspace } = useGlobalFilter()
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
  const [toastMsg, setToastMsg] = useState<{ ar: string; en: string } | null>(null)

  // Add review form state (inherits global Brand & Branch automatically when scoped)
  const [newChannel, setNewChannel] = useState<ReviewChannelId>('talabat')
  const [newStars, setNewStars] = useState(5)
  const [newTag, setNewTag] = useState<ReviewIssueTag>('excellent-quality')
  const [newHandle, setNewHandle] = useState('')
  const [newComment, setNewComment] = useState('')

  const resolvedBrand: BrandId = useMemo(
    () =>
      filters.brand !== 'all' && (APPROVED_BRAND_IDS as readonly string[]).includes(filters.brand)
        ? (filters.brand as BrandId)
        : 'china-garden',
    [filters.brand],
  )

  const resolvedBranch: BranchId = useMemo(
    () =>
      filters.branch !== 'all' && (APPROVED_BRANCH_IDS as readonly string[]).includes(filters.branch)
        ? (filters.branch as BranchId)
        : 'salmiya',
    [filters.branch],
  )

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
  }, [
    channelFilter,
    sentimentFilter,
    searchQuery,
    filters.brand,
    filters.branch,
    filters.channel,
    filters.period,
    filters.kuwaitSlice,
  ])

  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedReviews = useMemo(
    () => filteredReviews.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredReviews, safePage],
  )

  const markAck = useCallback((id: string) => {
    setAcknowledgedIds((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
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
        if (!item.acknowledged) markAck(item.id)
        setTimeout(() => setCopiedReplyId(null), 2000)
      } catch {}
    },
    [isAr, markAck],
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
      if (!item.acknowledged) markAck(item.id)
      setToastMsg({
        ar: `تم تصعيد التقييم السلبي (${item.customerHandle}) إلى جرس المدير 🔔`,
        en: `Escalated critical review (${item.customerHandle}) to Manager Bell 🔔`,
      })
      window.setTimeout(() => setToastMsg(null), 3200)
    },
    [markAck, requestApproval],
  )

  const handleAddCustomReview = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!newComment.trim()) return
      const sentiment: ReviewSentiment =
        newStars >= 4 ? 'positive' : newStars === 3 ? 'neutral' : 'negative'
      const bAr = getBrandLabel(resolvedBrand, true)
      const bEn = getBrandLabel(resolvedBrand, false)
      const brAr = getBranchLabel(resolvedBranch, true)
      const brEn = getBranchLabel(resolvedBranch, false)
      const handle = newHandle.trim() || '@guest_kw'

      const rec: OmnichannelReviewItem = {
        id: `sr-custom-${Date.now()}`,
        channelId: newChannel,
        brandId: resolvedBrand,
        branchId: resolvedBranch,
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
        unreadAlert: sentiment === 'negative',
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
    [customReviews, newChannel, newComment, newHandle, newStars, newTag, resolvedBranch, resolvedBrand],
  )

  const activeScorecards =
    scorecardView === 'brands' ? snap.brandScorecards : snap.branchScorecards

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-[1920px] mx-auto space-y-6 pb-12 font-sans text-[14px] sm:text-[15px] text-neutral-900 antialiased dark:text-slate-100"
    >
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/95 px-4 py-3 text-[14px] font-medium text-emerald-950 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/60 dark:text-emerald-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{isAr ? toastMsg.ar : toastMsg.en}</span>
          </div>
          <button
            type="button"
            onClick={() => openDrawer('approvals')}
            className="cursor-pointer rounded-xl border border-emerald-300/70 bg-white px-3 py-1 text-[12.5px] font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-[#101C17] dark:text-emerald-200"
          >
            {isAr ? 'فتح جرس المدير' : 'Open Bell'}
          </button>
        </div>
      )}

      {/* ───────────── 1. Slim Contextual Bar ───────────── */}
      <div className={`${CARD_CLS} !p-3.5 sm:!p-4`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <MessageSquare className="h-4 w-4" />
            </span>
            <p className="min-w-0 text-[13px] sm:text-[13.5px] font-medium leading-snug text-slate-600 dark:text-slate-300">
              {isAr
                ? `طلبات · كيتا · جاهز · ديليفرو · كاري/سنونو · جوجل · إنستغرام · تيك توك · إكس • ${workspace.subtitleAr}`
                : `Talabat · Keeta · Jahez · Deliveroo · Cari · Google · IG · TikTok · X • ${workspace.subtitleEn}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="btn-colored inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-emerald-600 px-3.5 text-[13px] font-semibold text-white shadow-xs transition hover:bg-emerald-700"
              style={{ color: '#FFFFFF' }}
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>{isAr ? '+ توثيق تعليق مرصود' : '+ Log Spotted Review'}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Add Review Form (inherits active Global Brand/Branch, zero duplicate dropdowns) */}
        {showAddForm && (
          <form onSubmit={handleAddCustomReview} className={`mt-3.5 space-y-3.5 p-3.5 sm:p-4 ${SUBCARD_CLS}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'توثيق تعليق جديد:' : 'Log Spotted Review:'}
                </span>
                <span className="rounded-xl bg-white px-2.5 py-0.5 text-[12px] font-semibold text-neutral-700 ring-1 ring-slate-900/[0.05] dark:bg-[#101C17] dark:text-slate-300 dark:ring-emerald-500/15">
                  {getBrandLabel(resolvedBrand, isAr)} · {getBranchLabel(resolvedBranch, isAr)}
                </span>
              </div>

              <div role="tablist" className={SEGMENT_TRACK_CLS}>
                {[5, 4, 3, 2, 1].map((s) => {
                  const active = newStars === s
                  return (
                    <button
                      key={s}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        setNewStars(s)
                        if (s >= 4) setNewTag('excellent-quality')
                        else if (s === 3) setNewTag('portion-value')
                        else setNewTag('delivery-delay')
                      }}
                      className={`${SEGMENT_BTN_CLS} !px-2.5 !py-1.5 tabular-nums ${
                        active ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                      }`}
                    >
                      {s}★
                    </button>
                  )
                })}
              </div>
            </div>

            <div role="tablist" className={SEGMENT_TRACK_CLS}>
              {REVIEW_CHANNELS.map((c) => {
                const active = newChannel === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setNewChannel(c.id)}
                    className={`${SEGMENT_BTN_CLS} ${
                      active ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                    }`}
                  >
                    {isAr ? c.ar : c.en}
                  </button>
                )
              })}
            </div>

            <div role="tablist" className={SEGMENT_TRACK_CLS}>
              {(Object.keys(ISSUE_TAG_LABELS) as ReviewIssueTag[]).map((k) => {
                const active = newTag === k
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setNewTag(k)}
                    className={`${SEGMENT_BTN_CLS} ${
                      active ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                    }`}
                  >
                    {isAr ? ISSUE_TAG_LABELS[k].ar : ISSUE_TAG_LABELS[k].en}
                  </button>
                )
              })}
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
                className="btn-colored h-10 shrink-0 cursor-pointer rounded-xl bg-emerald-600 px-4 text-[13px] font-bold text-white hover:bg-emerald-700"
                style={{ color: '#FFFFFF' }}
              >
                {isAr ? 'حفظ ✓' : 'Save ✓'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ───────────── 2. KPI Summary Row (`2x2` Mobile Grid) ───────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className={KPI_CLS}>
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[12.5px] sm:text-[13.5px] font-medium text-neutral-500 dark:text-slate-400">
              {isAr ? 'متوسط التقييم العام' : 'Average Star Rating'}
            </span>
            <Star className="h-4 w-4 shrink-0 text-amber-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-xl sm:text-3xl font-semibold tracking-tight text-neutral-950 dark:text-white">
              {snap.avgStars.toFixed(2)}
            </span>
            <span className="text-[12.5px] sm:text-[14px] font-bold text-amber-500">★ / 5.0</span>
          </div>
          <p className="mt-1.5 text-[13px] sm:text-[12.5px] leading-snug text-neutral-500 tabular-nums dark:text-slate-400">
            {isAr
              ? `إجمالي ${snap.totalReviews} تقييم مرصود`
              : `Across ${snap.totalReviews} reviews`}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[12.5px] sm:text-[13.5px] font-semibold text-emerald-800 dark:text-emerald-300">
              {isAr ? '🟢 إيجابي (إشادة)' : '🟢 Positive'}
            </span>
            <ThumbsUp className="h-4 w-4 shrink-0 text-emerald-600" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-xl sm:text-3xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-300">
              {snap.positivePct.toFixed(1)}%
            </span>
            <span className="text-[12px] font-semibold text-neutral-500">
              ({snap.positiveCount})
            </span>
          </div>
          <p className="mt-1.5 text-[13px] sm:text-[12.5px] leading-snug text-neutral-500 dark:text-slate-400">
            {isAr ? 'ثبات الطعم وسرعة أسطولنا' : 'Flavor consistency & speed'}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[12.5px] sm:text-[13.5px] font-semibold text-amber-800 dark:text-amber-200">
              {isAr ? '🟡 محايد وتحسين' : '🟡 Neutral'}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-xl sm:text-3xl font-semibold tracking-tight text-amber-700 dark:text-amber-300">
              {snap.neutralPct.toFixed(1)}%
            </span>
            <span className="text-[12px] font-semibold text-neutral-500">
              ({snap.neutralCount})
            </span>
          </div>
          <p className="mt-1.5 text-[13px] sm:text-[12.5px] leading-snug text-neutral-500 dark:text-slate-400">
            {isAr ? 'ملاحظات اعتيادية للتحسين' : 'Routine constructive notes'}
          </p>
        </div>

        <div className={KPI_CLS}>
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[12.5px] sm:text-[13.5px] font-semibold text-rose-700 dark:text-rose-300">
              {isAr ? '🔴 سلبي حرج' : '🔴 Critical'}
            </span>
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
            <span className="text-xl sm:text-3xl font-semibold tracking-tight text-rose-700 dark:text-rose-300">
              {snap.negativePct.toFixed(1)}%
            </span>
            <span className="rounded-lg bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              {snap.negativeCount}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] sm:text-[12.5px] leading-snug text-rose-700/90 dark:text-rose-300/90">
            {isAr ? 'مؤهل لشارة تصعيد ↗ بالأسفل' : 'Flagged for Escalate ↗'}
          </p>
        </div>
      </section>

      {/* ───────────── 3. Brand & Branch Scorecard Grid ───────────── */}
      <section className={CARD_CLS}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <h2 className="text-[16px] sm:text-[17px] font-extrabold text-neutral-950 dark:text-white">
              {isAr
                ? 'بطاقات أداء السمعة: أبرز نقاط الإشادة مقابل الجذر الرئيسي للشكاوى'
                : 'Brand & Branch Reputation Scorecards: Top Praise vs Complaint Root Cause'}
            </h2>
            <p className="text-[13px] sm:text-[13.5px] text-neutral-500 dark:text-slate-400">
              {isAr
                ? 'قارن التقييم وتوزيع المشاعر بين البراندات الـ 6 والفروع الـ 7'
                : 'Compare star ratings, sentiment split, praise, and root-cause bottlenecks'}
            </p>
          </div>

          <div role="tablist" className={SEGMENT_TRACK_CLS}>
            <button
              type="button"
              role="tab"
              aria-selected={scorecardView === 'brands'}
              onClick={() => setScorecardView('brands')}
              className={`${SEGMENT_BTN_CLS} ${
                scorecardView === 'brands' ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
              }`}
            >
              {isAr ? 'البراندات الـ ٦' : '6 Brands'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={scorecardView === 'branches'}
              onClick={() => setScorecardView('branches')}
              className={`${SEGMENT_BTN_CLS} ${
                scorecardView === 'branches' ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
              }`}
            >
              {isAr ? 'الفروع الـ ٧' : '7 Branches'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeScorecards.map((sc) => (
            <div
              key={sc.id}
              className={`border border-neutral-200/60 p-4 dark:border-white/[0.06] ${SUBCARD_CLS}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-extrabold text-neutral-950 dark:text-white">
                  {isAr ? sc.ar : sc.en}
                </span>
                <div className="flex items-center gap-2 tabular-nums">
                  <span className="rounded-full border border-neutral-200/70 bg-white px-2.5 py-0.5 text-[13px] font-extrabold text-neutral-900 dark:border-white/[0.08] dark:bg-[#101C17] dark:text-white">
                    {sc.avgStars.toFixed(2)} <span className="text-amber-500">★</span>
                  </span>
                  <span className="text-[12px] font-semibold text-neutral-500">
                    ({sc.totalReviews})
                  </span>
                </div>
              </div>

              <div className="mt-2.5 flex items-center gap-3 text-[12.5px] font-bold tabular-nums">
                <span className="text-emerald-700 dark:text-emerald-300">🟢 {sc.positiveCount}</span>
                <span className="text-amber-700 dark:text-amber-300">🟡 {sc.neutralCount}</span>
                <span className="text-rose-700 dark:text-rose-300">🔴 {sc.negativeCount}</span>
              </div>

              <div className="mt-3 space-y-1.5 rounded-xl border border-neutral-200/60 bg-white p-3 text-[13px] leading-relaxed dark:border-white/[0.06] dark:bg-[#101C17]">
                <div>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">
                    {isAr ? 'أبرز إشادة: ' : 'Top Praise: '}
                  </span>
                  <span className="text-neutral-700 dark:text-slate-300">
                    {isAr ? sc.topPraiseAr : sc.topPraiseEn}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-rose-700 dark:text-rose-400">
                    {isAr ? 'أهم ملاحظة: ' : 'Key Note: '}
                  </span>
                  <span className="text-neutral-700 dark:text-slate-300">
                    {isAr ? sc.topComplaintAr : sc.topComplaintEn}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── 4. Unified Verbatim Reviews Table (12/page, Quiet Rows + Escalate Only on Red) ───────────── */}
      <section className={CARD_CLS}>
        <div className="flex flex-col gap-3 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[17px] font-extrabold text-neutral-950 dark:text-white">
              {isAr
                ? 'سجل التعليقات والتقييمات الموحد (١٢ تقييم لكل صفحة)'
                : 'Unified Verbatim Reviews & Comments Table (12 / Page)'}
            </h2>
            <p className="text-[13.5px] text-neutral-500 dark:text-slate-400">
              {isAr
                ? 'اضغط على سطر الرد الجاهز لنسخه فوراً — وتظهر شارة التصعيد فقط للتقييمات السلبية الحرجة 🔴'
                : 'Click any ready-reply line to copy — Escalate ↗ appears strictly on Red critical outliers'}
            </p>
          </div>

          <div className="flex max-w-full flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isAr
                    ? 'بحث في التعليقات أو الحساب أو الفرع...'
                    : 'Search comment, handle, or branch...'
                }
                className={`${INPUT_CLS} h-9 ps-9 text-[13px]`}
              />
            </div>

            <div role="tablist" className={SEGMENT_TRACK_CLS}>
              {(
                [
                  { id: 'all', ar: `الكل (${snap.totalReviews})`, en: `All (${snap.totalReviews})` },
                  { id: 'positive', ar: `🟢 (${snap.positiveCount})`, en: `🟢 (${snap.positiveCount})` },
                  { id: 'neutral', ar: `🟡 (${snap.neutralCount})`, en: `🟡 (${snap.neutralCount})` },
                  { id: 'negative', ar: `🔴 (${snap.negativeCount})`, en: `🔴 (${snap.negativeCount})` },
                ] as const
              ).map((s) => {
                const active = sentimentFilter === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSentimentFilter(s.id)}
                    className={`${SEGMENT_BTN_CLS} ${
                      active ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                    }`}
                  >
                    {isAr ? s.ar : s.en}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Horizontal Touch-Scrollable Review Platform Segmented Control */}
        <div role="tablist" className={`mb-4 ${SEGMENT_TRACK_CLS}`}>
          <button
            type="button"
            role="tab"
            aria-selected={channelFilter === 'all'}
            onClick={() => setChannelFilter('all')}
            className={`${SEGMENT_BTN_CLS} ${
              channelFilter === 'all' ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
            }`}
          >
            {isAr ? 'كل مصادر التقييم' : 'All Review Sources'}
          </button>

          {snap.channelPills.map((pill) => {
            const active = channelFilter === pill.channelId
            return (
              <button
                key={pill.channelId}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() =>
                  setChannelFilter((prev) => (prev === pill.channelId ? 'all' : pill.channelId))
                }
                className={`inline-flex items-center gap-1.5 tabular-nums ${SEGMENT_BTN_CLS} ${
                  active ? SEGMENT_BTN_ACTIVE_CLS : SEGMENT_BTN_IDLE_CLS
                }`}
              >
                <span>{isAr ? pill.ar : pill.en}</span>
                <span className="text-xs opacity-80">{pill.avgStars.toFixed(1)}★</span>
              </button>
            )
          })}
        </div>

        <div className={TABLE_SCROLL_CLS}>
          <table className="w-full min-w-[1040px] border-collapse text-start text-[14px] sm:text-[14.5px] tabular-nums">
            <thead>
              <tr className="border-b border-neutral-200/80 bg-[#F6F7F8] text-[12.5px] font-bold text-neutral-600 dark:border-white/[0.08] dark:bg-[#0B1410] dark:text-slate-300">
                <th className="sticky start-0 z-10 bg-[#F6F7F8] px-3.5 py-3 text-start whitespace-nowrap dark:bg-[#0B1410]">
                  {isAr ? 'المنصة والعميل' : 'Platform & Guest'}
                </th>
                <th className="px-3.5 py-3 text-start whitespace-nowrap">{isAr ? 'المطعم والفرع' : 'Brand & Branch'}</th>
                <th className="px-3 py-3 text-start whitespace-nowrap">{isAr ? 'التقييم والتصنيف' : 'Rating & Tag'}</th>
                <th className="px-3.5 py-3 text-start whitespace-nowrap">{isAr ? 'نص التعليق والرد الجاهز' : 'Verbatim Review & Ready Reply'}</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">{isAr ? 'الحالة' : 'Sentiment'}</th>
                <th className="px-3.5 py-3 text-end whitespace-nowrap">{isAr ? 'الإجراء' : 'Action'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.05]">
              {paginatedReviews.map((rev) => {
                const escalated = getApprovalByRef(`social-review-escalation-${rev.id}`)
                const isCopied = copiedReplyId === rev.id
                return (
                  <tr
                    key={rev.id}
                    className="align-top transition hover:bg-[#F6F7F8]/70 dark:hover:bg-white/[0.03]"
                  >
                    <td className="sticky start-0 z-10 bg-white px-3.5 py-3.5 whitespace-nowrap dark:bg-[#101C17]">
                      <div className="font-bold text-neutral-950 dark:text-white">
                        {isAr ? rev.channelAr : rev.channelEn}
                      </div>
                      <div className="text-[12.5px] font-medium text-neutral-600 dark:text-slate-300">
                        {rev.customerHandle}
                      </div>
                      <div className="text-[13px] text-neutral-400">{rev.timestamp}</div>
                    </td>

                    <td className="px-3.5 py-3.5 whitespace-nowrap">
                      <div className="font-semibold text-neutral-900 dark:text-white">
                        {isAr ? rev.brandAr : rev.brandEn}
                      </div>
                      <div className="text-[12.5px] text-neutral-500 dark:text-slate-400">
                        {isAr ? rev.branchAr : rev.branchEn}
                      </div>
                    </td>

                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <div className="text-[13.5px] font-bold text-amber-500">
                        {starString(rev.stars)}{' '}
                        <span className="text-[12px] text-neutral-500 dark:text-slate-400">
                          ({rev.stars}.0)
                        </span>
                      </div>
                      <div className="mt-0.5 text-[12.5px] font-medium text-neutral-600 dark:text-slate-300">
                        {isAr ? rev.issueTagAr : rev.issueTagEn}
                      </div>
                    </td>

                    <td className="max-w-[520px] px-3.5 py-3.5">
                      <p className="text-[14px] sm:text-[14.5px] font-medium leading-relaxed text-neutral-900 dark:text-slate-100">
                        “{isAr ? rev.commentAr : rev.commentEn}”
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopyReply(rev)}
                        title={isAr ? 'اضغط لنسخ الرد الجاهز' : 'Click to copy ready reply'}
                        className="mt-1.5 inline-flex max-w-full cursor-pointer items-center gap-1.5 text-start text-[12.5px] text-neutral-500 transition hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-300"
                      >
                        {isCopied ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        )}
                        <span className="truncate">
                          {isCopied
                            ? isAr
                              ? 'تم نسخ الرد الجاهز ✓'
                              : 'Ready reply copied ✓'
                            : isAr
                              ? `رد جاهز: ${rev.readyReplyAr}`
                              : `Reply: ${rev.readyReplyEn}`}
                        </span>
                      </button>
                    </td>

                    <td className="px-3 py-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ${sentimentBadgeCls(rev.sentiment)}`}
                      >
                        {sentimentLabel(rev.sentiment, isAr)}
                      </span>
                    </td>

                    <td className="px-3.5 py-3.5 text-end whitespace-nowrap">
                      {rev.sentiment === 'negative' ? (
                        escalated ? (
                          <button
                            type="button"
                            onClick={() => openDrawer('approvals')}
                            className="inline-flex h-8 cursor-pointer items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-3 text-[12.5px] font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/50 dark:text-emerald-300"
                          >
                            {isAr ? 'تم التصعيد ✓' : 'Escalated ✓'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleEscalateNegative(rev)}
                            className="inline-flex h-8 cursor-pointer items-center rounded-full border border-rose-200/80 bg-rose-50/70 px-3 text-[12.5px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200"
                          >
                            {isAr ? 'تصعيد ↗' : 'Escalate ↗'}
                          </button>
                        )
                      ) : (
                        <span className="select-none text-neutral-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer (12 reviews/page) */}
        <div
          className={`mt-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px] font-semibold text-neutral-600 tabular-nums dark:text-slate-300 ${SUBCARD_CLS}`}
        >
          <span>
            {isAr
              ? `عرض ${filteredReviews.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filteredReviews.length)} من أصل ${filteredReviews.length} تقييم وتعليق`
              : `Showing ${filteredReviews.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filteredReviews.length)} of ${filteredReviews.length} reviews`}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl border border-neutral-200/70 bg-white px-3 text-[12.5px] font-bold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#101C17] dark:text-slate-200"
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
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-xl border border-neutral-200/70 bg-white px-3 text-[12.5px] font-bold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.08] dark:bg-[#101C17] dark:text-slate-200"
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
