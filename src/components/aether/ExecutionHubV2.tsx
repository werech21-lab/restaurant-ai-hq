'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ClipboardCheck, Loader2, Send, Sparkles } from 'lucide-react'
import { BRANCHES, CHANNELS, LEDGER, feryalHref, fmt } from '@/lib/aether/ledger'
import { FERYAL_PROPOSALS } from '@/lib/feryal-gemini-brain'
import { Badge, Num, SectionHeader, useLang } from '@/components/aether/ui'

type Status = 'pending' | 'running' | 'done'

/** Owner, week and dispatch action for each Odoo-grounded proposal. */
const PLAN_META: Record<string, { week: number; ownerEn: string; ownerAr: string; action: string }> = {
  'delivery-promo': { week: 1, ownerEn: 'Marketing & Channels', ownerAr: 'التسويق وإدارة القنوات', action: 'dispatch_keeta_cap' },
  'beverage-attach': { week: 2, ownerEn: 'Operations & POS', ownerAr: 'العمليات ونقاط البيع', action: 'dispatch_combo_drinks' },
  'food-cost': { week: 3, ownerEn: 'Central Kitchen & QC', ownerAr: 'المطبخ المركزي والجودة', action: 'dispatch_operations_plan' },
  'menu-focus': { week: 4, ownerEn: 'Menu Engineering', ownerAr: 'هندسة المنيو', action: 'dispatch_combo_drinks' },
}

export function ExecutionHubV2() {
  const { isAr, T } = useLang()
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [log, setLog] = useState<{ time: string; msg: string }[]>([])

  const dispatch = async (id: string) => {
    const meta = PLAN_META[id]
    if (!meta) return
    setStatus((s) => ({ ...s, [id]: 'running' }))
    try {
      const res = await fetch('/api/feryal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'composio', actionType: meta.action, lang: isAr ? 'ar' : 'en' }),
      })
      const data = await res.json()
      if (data?.success) {
        setStatus((s) => ({ ...s, [id]: 'done' }))
        const time = new Date().toLocaleTimeString(isAr ? 'ar-KW' : 'en-US', { hour: '2-digit', minute: '2-digit' })
        setLog((l) => [{ time, msg: String(data.message ?? '') }, ...l])
      } else {
        setStatus((s) => ({ ...s, [id]: 'pending' }))
      }
    } catch {
      setStatus((s) => ({ ...s, [id]: 'pending' }))
    }
  }

  const locations = [...BRANCHES].sort((a, b) => b.sales - a.sales)

  return (
    <div className="ae-stagger space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <section className="ae-tile flex flex-col gap-3 p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <Badge tone="emerald">{T('Odoo-grounded execution', 'تنفيذ مبني على بيانات أودو')}</Badge>
          <h1 className="ae-h text-2xl text-slate-900 dark:text-white">{T('Execution Hub', 'مركز التنفيذ')}</h1>
          <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            {T(
              "Feryal's four verified proposals as a four-week execution plan with owners, plus the Odoo restaurant location table.",
              'مقترحات فريال الأربعة الموثقة كخطة تنفيذ على أربعة أسابيع مع المسؤولين، إضافة إلى جدول مواقع المطاعم في أودو.',
            )}
          </p>
        </div>
        <Link href="/erp/feryal-ai" className="ae-pill-dark">
          <Sparkles className="h-3.5 w-3.5" />
          {T('Open Feryal studio', 'فتح استوديو فريال')}
        </Link>
      </section>

      <section className="ae-tile space-y-4 p-5">
        <SectionHeader icon={<ClipboardCheck className="h-4 w-4" />} title={T('Four-week execution plan', 'خطة التنفيذ على أربعة أسابيع')} subtitle={T(`Expected outcomes computed from Odoo · ${LEDGER.periodLabelEn}`, `النتائج المتوقعة محسوبة من أودو · ${LEDGER.periodLabelAr}`)} />
        <div className="w-full overflow-x-auto rounded-xl">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="text-slate-500">
                <th className="px-3 py-2.5 text-start font-semibold">{T('Week', 'الأسبوع')}</th>
                <th className="px-3 py-2.5 text-start font-semibold">{T('Owner', 'المسؤول')}</th>
                <th className="px-3 py-2.5 text-start font-semibold">{T('Proposal', 'المقترح')}</th>
                <th className="px-3 py-2.5 text-start font-semibold">{T('Expected result', 'النتيجة المتوقعة')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{T('Monthly KWD', 'شهرياً د.ك')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{T('Action', 'الإجراء')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {FERYAL_PROPOSALS.map((p) => {
                const meta = PLAN_META[p.id]
                const st = status[p.id] ?? 'pending'
                return (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">{T(`Week ${meta?.week ?? '—'}`, `الأسبوع ${meta?.week ?? '—'}`)}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{isAr ? meta?.ownerAr : meta?.ownerEn}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900 dark:text-white">{isAr ? p.titleAr : p.titleEn}</td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{isAr ? p.outcomeAr : p.outcomeEn}</td>
                    <td className="px-3 py-3 text-end"><Num className="text-emerald-700 dark:text-emerald-400">+{fmt(p.monthlyKwd)}</Num></td>
                    <td className="px-3 py-3 text-end">
                      <div className="flex justify-end gap-2">
                        <Link href={feryalHref(isAr ? p.promptAr : p.promptEn)} className="ae-pill-light ae-pill-sm">
                          {T('Discuss', 'مناقشة')}
                        </Link>
                        <button type="button" disabled={st !== 'pending'} onClick={() => dispatch(p.id)} className="ae-pill-dark ae-pill-sm disabled:opacity-60">
                          {st === 'running' ? <Loader2 className="h-3 w-3 animate-spin" /> : st === 'done' ? <CheckCircle2 className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                          {st === 'done' ? T('Dispatched', 'تم الإرسال') : T('Dispatch to team', 'إرسال للفريق')}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {log.length > 0 && (
          <ul className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
            {log.map((l, i) => (
              <li key={i}>
                <span className="font-mono text-slate-400">{l.time}</span> · {l.msg}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="ae-tile space-y-4 p-5">
        <SectionHeader icon={<ClipboardCheck className="h-4 w-4" />} title={T(`Restaurant locations · ${LEDGER.periodLabelEn}`, `مواقع المطاعم · ${LEDGER.periodLabelAr}`)} subtitle={T('Odoo POS sales and Branches analytic plan', 'مبيعات نقاط البيع في أودو وخطة الفروع التحليلية')} />
        <div className="w-full overflow-x-auto rounded-xl">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className="text-slate-500">
                <th className="px-3 py-2.5 text-start font-semibold">#</th>
                <th className="px-3 py-2.5 text-start font-semibold">{T('Location', 'الموقع')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{T('POS net KWD', 'صافي نقاط البيع د.ك')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{T('Orders', 'الطلبات')}</th>
                <th className="px-3 py-2.5 text-start font-semibold">{T('Top channel', 'القناة الأبرز')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{T('Operating profit KWD', 'الربح التشغيلي د.ك')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{T('Margin', 'الهامش')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {locations.map((b, i) => {
                const ch = CHANNELS.find((c) => c.id === b.topChannel)
                return (
                  <tr key={b.id}>
                    <td className="px-3 py-3 font-mono text-slate-400">{i + 1}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900 dark:text-white">{isAr ? b.ar : b.en}</td>
                    <td className="px-3 py-3 text-end"><Num>{fmt(b.sales, 3)}</Num></td>
                    <td className="px-3 py-3 text-end"><Num className="text-slate-500">{fmt(b.orders)}</Num></td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{ch ? (isAr ? ch.ar : ch.en) : '—'}</td>
                    <td className="px-3 py-3 text-end"><Num className="text-emerald-700 dark:text-emerald-400">{fmt(b.profit, 3)}</Num></td>
                    <td className="px-3 py-3 text-end"><Badge tone={b.tone}>{fmt(b.marginPct, 1)}%</Badge></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
