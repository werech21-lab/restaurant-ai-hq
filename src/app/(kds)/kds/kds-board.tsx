'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { bumpTicketAction, markReadyAction, startPrepAction, toggleItemDoneAction } from '@/app/actions/kds'
import { StateBlock } from '@/components/ui'
import { formatInt, getUnavailableTooltip, UNAVAILABLE_DASH } from '@/lib/format'
import { LanguageSwitch, useI18n } from '@/lib/i18n'

type Ticket = {
  id: string
  ticketNumber: string
  brandCode: string | null
  branchCode: string | null
  orderType: string
  tableNo: string
  status: string
  notes: string
  createdAt: string
  startedAt: string | null
  readyAt: string | null
  items: Array<{ id: string; name: string; quantity: number; note: string; isDone: boolean }>
}

function elapsedMs(createdAt: string) {
  return Date.now() - new Date(createdAt).getTime()
}

function slaClass(createdAt: string) {
  const mins = elapsedMs(createdAt) / 60000
  if (mins > 15) return 'border-red-500/85 bg-red-950/60 shadow-[0_0_24px_rgba(239,68,68,0.35)]'
  if (mins >= 8) return 'border-amber-400/80 bg-amber-950/45'
  return 'border-emerald-400/60 bg-[#102016]'
}

function timerLabel(createdAt: string) {
  const sec = Math.max(0, Math.floor(elapsedMs(createdAt) / 1000))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function statusLabel(status: string, isEn: boolean): string {
  if (status === 'NEW') return isEn ? 'NEW' : 'جديد'
  if (status === 'IN_PREP' || status === 'PREPARING') return isEn ? 'PREPARING' : 'قيد التحضير'
  if (status === 'READY') return isEn ? 'READY' : 'جاهز'
  if (status === 'BUMPED') return isEn ? 'BUMPED' : 'تم التسليم'
  return status
}

export function KdsBoard() {
  const { locale, t } = useI18n()
  const isEn = locale === 'en'
  const uiLocale = isEn ? 'en' : 'ar'
  const unavailableTip = getUnavailableTooltip(uiLocale)

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [stats, setStats] = useState({ avgPrepMinutes: 0, completed24h: 0 })
  const [scopeLabel, setScopeLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [pending, start] = useTransition()
  const [now, setNow] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/kds/tickets', { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const json = (await res.json()) as {
        data: { tickets: Ticket[]; stats: { avgPrepMinutes: number; completed24h: number }; scopeLabelAr: string; scopeLabelEn: string }
      }
      setTickets(json.data.tickets)
      setStats(json.data.stats)
      setScopeLabel(locale === 'en' ? json.data.scopeLabelEn : json.data.scopeLabelAr)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [locale])

  useEffect(() => {
    void refresh()
    const poll = window.setInterval(() => void refresh(), 4000)
    const clock = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      window.clearInterval(poll)
      window.clearInterval(clock)
    }
  }, [refresh])

  return (
    <div dir={isEn ? 'ltr' : 'rtl'} className="min-h-screen bg-[#07090f] text-slate-50">
      <header className="sticky top-0 z-20 border-b border-white/15 bg-[#090E0C]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
          <a
            href="/dashboard"
            className="ds-focus-ring inline-flex min-h-11 items-center rounded-xl border border-white/20 bg-[#141F1B] px-4 py-2 text-sm font-bold text-slate-100 hover:border-emerald-400/50"
          >
            {t('nav.backSystem')}
          </a>
          <h1 className="text-lg font-black text-amber-300 sm:text-xl">
            {isEn ? 'Kitchen Display' : 'شاشة المطبخ'}
          </h1>
          <LanguageSwitch />
          {scopeLabel ? (
            <span className="inline-flex min-h-11 items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3.5 py-1.5 text-xs font-bold text-emerald-200">
              {scopeLabel}
            </span>
          ) : null}
          <div className="ms-auto flex flex-wrap items-center gap-4 text-sm text-slate-200">
            <span>
              {isEn ? 'Avg prep' : 'متوسط التحضير'}:{' '}
              <strong dir="ltr" className="ds-num font-black text-white tabular-nums">
                {formatInt(stats.avgPrepMinutes, uiLocale)}m
              </strong>
            </span>
            <span>
              {isEn ? '24h completed' : 'منجز 24 ساعة'}:{' '}
              <strong dir="ltr" className="ds-num font-black text-white tabular-nums">
                {formatInt(stats.completed24h, uiLocale)}
              </strong>
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {error ? (
          <div className="col-span-full">
            <StateBlock
              state="error"
              locale={uiLocale}
              title={isEn ? 'Unable to load kitchen tickets' : 'تعذر تحميل تذاكر المطبخ'}
              onRetry={() => void refresh()}
            />
          </div>
        ) : null}

        {loading ? (
          <div className="col-span-full">
            <StateBlock
              state="loading"
              locale={uiLocale}
              title={isEn ? 'Loading kitchen tickets…' : 'جارٍ تحميل تذاكر المطبخ…'}
              skeletonRows={4}
            />
          </div>
        ) : tickets.length === 0 ? (
          <div className="col-span-full">
            <StateBlock
              state="empty"
              locale={uiLocale}
              title={isEn ? 'Waiting for POS kitchen tickets…' : 'بانتظار تذاكر من نقطة البيع…'}
              description={
                isEn
                  ? 'Active kitchen prep orders will appear here automatically as they arrive.'
                  : 'ستظهر تذاكر التحضير الجديدة هنا تلقائياً فور إرسالها من نقطة البيع.'
              }
            />
          </div>
        ) : (
          tickets.map((ticket) => (
            <article
              key={ticket.id}
              className={`flex flex-col rounded-2xl border-2 p-4 text-slate-50 ${slaClass(ticket.createdAt)}`}
              data-now={now}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="ds-num text-2xl font-black tracking-wide text-white tabular-nums" dir="ltr">
                    {ticket.ticketNumber}
                  </p>
                  <p className="text-xs font-medium text-slate-200">
                    {ticket.brandCode ? ticket.brandCode : <span title={unavailableTip}>{UNAVAILABLE_DASH}</span>}
                    {' · '}
                    {ticket.branchCode ? ticket.branchCode : <span title={unavailableTip}>{UNAVAILABLE_DASH}</span>}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-100">
                    {ticket.orderType}
                    {ticket.tableNo ? (
                      <span dir="ltr" className="ds-num tabular-nums">
                        {` · #${ticket.tableNo}`}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="rounded-xl border border-white/15 bg-black/55 px-3 py-2 text-center">
                  <p className="text-xs font-semibold uppercase text-slate-300">SLA</p>
                  <p className="ds-num font-mono text-xl font-black text-white tabular-nums" dir="ltr">
                    {timerLabel(ticket.createdAt)}
                  </p>
                  <p className="text-xs font-bold text-emerald-300">
                    {statusLabel(ticket.status, isEn)}
                  </p>
                </div>
              </div>

              <ul className="flex-1 space-y-2">
                {ticket.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={pending}
                      aria-pressed={item.isDone}
                      aria-label={
                        isEn
                          ? `Toggle ${item.name} (${item.isDone ? 'done' : 'pending'})`
                          : `تحديد حالة ${item.name}`
                      }
                      onClick={() =>
                        start(async () => {
                          await toggleItemDoneAction(item.id, !item.isDone)
                          await refresh()
                        })
                      }
                      className={`ds-focus-ring flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-start transition ${
                        item.isDone
                          ? 'border-white/10 bg-black/30 text-slate-400 line-through'
                          : 'border-white/20 bg-black/45 text-white hover:border-emerald-400/60'
                      }`}
                    >
                      <span>
                        <span className="block text-base font-black sm:text-lg">{item.name}</span>
                        {item.note ? <span className="block text-xs font-semibold text-amber-200">{item.note}</span> : null}
                      </span>
                      <span className="ds-num shrink-0 text-xl font-black tabular-nums" dir="ltr">
                        ×{formatInt(item.quantity, uiLocale)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {ticket.notes ? (
                <p className="mt-3 rounded-xl border border-amber-400/30 bg-black/45 px-3 py-2 text-sm font-medium text-amber-100">
                  {ticket.notes}
                </p>
              ) : null}

              <div className="mt-4 grid grid-cols-1 gap-2">
                {ticket.status === 'NEW' ? (
                  <button
                    type="button"
                    className="ds-focus-ring min-h-11 rounded-xl bg-emerald-400 px-4 py-3 text-base font-black text-slate-950 hover:bg-emerald-300 disabled:opacity-50"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await startPrepAction(ticket.id)
                        await refresh()
                      })
                    }
                  >
                    {isEn ? 'Start Prep' : 'بدء التحضير'}
                  </button>
                ) : null}
                {ticket.status !== 'READY' && ticket.status !== 'BUMPED' ? (
                  <button
                    type="button"
                    className="ds-focus-ring min-h-11 rounded-xl border-2 border-amber-300/70 bg-amber-400/20 px-4 py-3 text-base font-black text-amber-100 hover:bg-amber-400/30 disabled:opacity-50"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await markReadyAction(ticket.id)
                        await refresh()
                      })
                    }
                  >
                    {isEn ? 'Ready / Bump queue' : 'الطلب جاهز للتسليم'}
                  </button>
                ) : null}
                {ticket.status === 'READY' ? (
                  <button
                    type="button"
                    className="ds-focus-ring min-h-11 rounded-xl bg-amber-300 px-4 py-3 text-base font-black text-slate-950 hover:bg-amber-200 disabled:opacity-50"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await bumpTicketAction(ticket.id)
                        await refresh()
                      })
                    }
                  >
                    {isEn ? 'Bump / Clear' : 'إزالة من الشاشة'}
                  </button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </main>
    </div>
  )
}
