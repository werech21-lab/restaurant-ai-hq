'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { bumpTicketAction, markReadyAction, startPrepAction, toggleItemDoneAction } from '@/app/actions/kds'
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
  if (mins > 15) return 'border-red-500/80 bg-red-950/40 shadow-[0_0_24px_rgba(239,68,68,0.35)] animate-pulse'
  if (mins >= 8) return 'border-amber-400/70 bg-amber-950/30'
  return 'border-[#8cc63f]/50 bg-[#102016]/80'
}

function timerLabel(createdAt: string) {
  const sec = Math.max(0, Math.floor(elapsedMs(createdAt) / 1000))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function KdsBoard() {
  const { locale, t } = useI18n()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [stats, setStats] = useState({ avgPrepMinutes: 0, completed24h: 0 })
  const [scopeLabel, setScopeLabel] = useState('')
  const [error, setError] = useState('')
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
      setError('')
    } catch {
      setError(locale === 'en' ? 'Unable to load kitchen tickets' : 'تعذر تحميل تذاكر المطبخ')
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
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-gold-300/15 bg-[#07090f]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
          <a href="/dashboard" className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-mist-300">
            {t('nav.backSystem')}
          </a>
          <h1 className="text-lg font-black text-gold-300">{locale === 'en' ? 'Kitchen Display' : 'شاشة المطبخ'}</h1>
          <LanguageSwitch />
          {/* Scope bar purged */}
          <span className="rounded-full border border-[#8cc63f]/30 bg-[#8cc63f]/10 px-3 py-1 text-xs font-bold text-[#8cc63f]">
            {scopeLabel}
          </span>
          <div className="ms-auto flex gap-3 text-xs text-mist-300">
            <span>
              {locale === 'en' ? 'Avg prep' : 'متوسط التحضير'}: <strong className="text-mist-100">{stats.avgPrepMinutes}m</strong>
            </span>
            <span>
              24h: <strong className="text-mist-100">{stats.completed24h}</strong>
            </span>
          </div>
        </div>
      </header>

      {error ? <p className="px-4 py-3 text-sm text-red-300">{error}</p> : null}

      <main className="mx-auto grid max-w-[1600px] gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {tickets.length === 0 ? (
          <p className="col-span-full rounded-2xl border border-dashed border-white/15 p-10 text-center text-mist-400">
            {locale === 'en' ? 'Waiting for POS kitchen tickets…' : 'بانتظار تذاكر من نقطة البيع…'}
          </p>
        ) : (
          tickets.map((ticket) => (
            <article key={ticket.id} className={`flex flex-col rounded-2xl border-2 p-4 ${slaClass(ticket.createdAt)}`} data-now={now}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-2xl font-black tracking-wide" dir="ltr">
                    {ticket.ticketNumber}
                  </p>
                  <p className="text-xs text-mist-300">
                    {(ticket.brandCode || '—') + ' · ' + (ticket.branchCode || '—')}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-mist-100">
                    {ticket.orderType}
                    {ticket.tableNo ? ` · #${ticket.tableNo}` : ''}
                  </p>
                </div>
                <div className="rounded-xl bg-black/40 px-3 py-2 text-center">
                  <p className="text-[10px] uppercase text-mist-400">SLA</p>
                  <p className="font-mono text-xl font-black" dir="ltr">
                    {timerLabel(ticket.createdAt)}
                  </p>
                  <p className="text-[10px] font-bold text-mist-300">{ticket.status}</p>
                </div>
              </div>

              <ul className="flex-1 space-y-2">
                {ticket.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          await toggleItemDoneAction(item.id, !item.isDone)
                          await refresh()
                        })
                      }
                      className={`flex w-full items-start justify-between rounded-xl border px-3 py-2 text-start ${
                        item.isDone ? 'border-white/5 bg-black/20 text-mist-500 line-through' : 'border-white/10 bg-black/30'
                      }`}
                    >
                      <span>
                        <span className="block text-lg font-black">{item.name}</span>
                        {item.note ? <span className="block text-xs text-amber-200">{item.note}</span> : null}
                      </span>
                      <span className="text-xl font-black" dir="ltr">
                        ×{item.quantity}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {ticket.notes ? <p className="mt-3 rounded-lg bg-black/30 px-3 py-2 text-sm text-amber-100">{ticket.notes}</p> : null}

              <div className="mt-4 grid grid-cols-1 gap-2">
                {ticket.status === 'NEW' ? (
                  <button
                    type="button"
                    className="rounded-xl bg-[#8cc63f] px-4 py-3 text-sm font-black text-ink-950"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await startPrepAction(ticket.id)
                        await refresh()
                      })
                    }
                  >
                    {locale === 'en' ? 'Start Prep' : 'بدء التحضير'}
                  </button>
                ) : null}
                {ticket.status !== 'READY' && ticket.status !== 'BUMPED' ? (
                  <button
                    type="button"
                    className="rounded-xl border border-amber-300/40 bg-amber-400/15 px-4 py-3 text-sm font-black text-amber-100"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await markReadyAction(ticket.id)
                        await refresh()
                      })
                    }
                  >
                    {locale === 'en' ? 'Ready / Bump queue' : 'الطلب جاهز للتسليم'}
                  </button>
                ) : null}
                {ticket.status === 'READY' ? (
                  <button
                    type="button"
                    className="rounded-xl bg-gold-400 px-4 py-3 text-sm font-black text-ink-950"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await bumpTicketAction(ticket.id)
                        await refresh()
                      })
                    }
                  >
                    {locale === 'en' ? 'Bump / Clear' : 'إزالة من الشاشة'}
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
