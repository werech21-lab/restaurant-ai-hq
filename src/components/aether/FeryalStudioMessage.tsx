'use client'

import { Fragment, type ReactNode } from 'react'
import type { FrozenMessageScope } from '@/lib/feryal-chat-store'

/**
 * Structured renderer for Feryal replies in the unified executive studio.
 * Turns markdown-style headings, numbered/bullet lists, **bold** terms and pipe tables into calm
 * sections at readable 15px typography, wraps wide playbook tables in horizontal scroll containers,
 * renders immutable frozen scope snapshots, and leaves zero raw markdown symbols.
 */
const OUTCOME_RE =
  /النتائج المتوقعة|النتيجة المتوقعة|الفايدة المتوقعة|رأي فريال التنفيذي|القرار التنفيذي لفريال|expected outcome|expected kwd gain|feryal['’]?s executive opinion/i

const NOWRAP_COLUMN_HEADER_RE =
  /change|%|kwd|د\.?\s*ك|دينار|base|conservative|stress|feryal\s*rec|rec\.|recommended|current|proposed|suggested|price|increase|delta|revenue|sales|qty|quantity|orders|tier|abc|action|verdict|status|sku|code|السعر|التغيير|أساسي|متحفظ|ضغط|توصية|مقترح|الإيراد|المبيعات|الكمية|الطلبات|الفئة|الإجراء|القرار|الحالة|الكود/i

const NUMERIC_OR_METRIC_CELL_RE =
  /(?:kwd|kd|د\.?\s*ك|%|^[+-]?[\d,.\s]+$|\btier\s*[abc]\b|\[ri[a-z]{2}\d+\])/i

function clean(text: string) {
  return text.replace(/`+/g, '').replace(/^#+\s*/, '').replace(/__/g, '')
}

export function shouldNowrapPlaybookCell(headerText: string, cellText: string): boolean {
  const cleanHeader = clean(headerText).replace(/\*+/g, '').trim()
  const cleanCell = clean(cellText).replace(/\*+/g, '').trim()
  if (NOWRAP_COLUMN_HEADER_RE.test(cleanHeader)) return true
  if (NUMERIC_OR_METRIC_CELL_RE.test(cleanCell)) return true
  return cleanCell.length > 0 && cleanCell.length <= 48
}

export function formatFrozenScopeBadgeText(scope: FrozenMessageScope, isAr = false): string {
  const parts: string[] = []
  const brand = scope.brandScope?.trim()
  if (brand) parts.push(brand)

  const branch = scope.branchScope?.trim()
  if (
    branch &&
    branch !== 'All Branches' &&
    branch !== 'كل الفروع' &&
    branch.toLowerCase() !== 'all'
  ) {
    parts.push(branch)
  }

  const channel = scope.channelScope?.trim()
  if (
    channel &&
    channel !== 'All Channels' &&
    channel !== 'كل القنوات' &&
    channel.toLowerCase() !== 'all'
  ) {
    parts.push(channel)
  }

  const period = scope.periodLabel?.trim()
  const from = scope.dateFrom?.trim() ?? ''
  const to = scope.dateTo?.trim() ?? ''
  const dateWindow =
    from && to
      ? from === to
        ? from
        : `${from} → ${to}`
      : from || to

  if (period) {
    const alreadyHasDates = Boolean(from && period.includes(from))
    parts.push(dateWindow && !alreadyHasDates ? `${period} (${dateWindow})` : period)
  } else if (dateWindow) {
    parts.push(dateWindow)
  }

  const prefix = isAr ? 'النطاق:' : 'Scope:'
  return `${prefix} ${parts.join(' · ')}`
}

function inline(text: string, keyBase: string): ReactNode[] {
  const parts = clean(text).split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (!part) return null
    const key = `${keyBase}-${i}`
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-neutral-950 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <Fragment key={key}>{part.replace(/\*+/g, '')}</Fragment>
  })
}

type Section = { title: string | null; lines: string[] }

function headingOf(line: string): string | null {
  const t = line.trim()
  let m = t.match(/^#{1,6}\s+(.+?)\s*:?\s*$/)
  if (m) return m[1].replace(/\*\*/g, '').trim()
  m = t.match(/^\*\*(.+?)\*\*\s*:?\s*$/)
  if (m) return m[1].trim()
  m = t.match(/^\d+[.)]\s+\*\*(.+?)\*\*\s*:?\s*$/)
  if (m) return m[1].trim()
  return null
}

function splitSections(text: string): Section[] {
  const sections: Section[] = [{ title: null, lines: [] }]
  for (const raw of (text || '').replace(/\r/g, '').split('\n')) {
    const h = headingOf(raw)
    if (h) sections.push({ title: h.replace(/:$/, ''), lines: [] })
    else sections[sections.length - 1].lines.push(raw)
  }
  return sections.filter((s) => s.title || s.lines.some((l) => l.trim()))
}

function renderBody(lines: string[], keyBase: string): ReactNode[] {
  const blocks: ReactNode[] = []
  let i = 0
  let k = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i += 1
      continue
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        if (!/^[\s|:-]+$/.test(lines[i])) {
          rows.push(
            lines[i]
              .trim()
              .replace(/^\||\|$/g, '')
              .split('|')
              .map((c) => c.trim()),
          )
        }
        i += 1
      }
      const [head, ...body] = rows
      blocks.push(
        <div
          key={`${keyBase}-t${k++}`}
          data-feryal-table-scroll="true"
          className="w-full overflow-x-auto rounded-lg border border-slate-200/80 dark:border-slate-700/80 my-3 bg-white dark:bg-[#111A22]"
        >
          <table className="min-w-max w-full border-collapse text-sm tabular-nums">
            <thead>
              <tr className="border-b border-slate-200/80 bg-[#F7F7F8] dark:border-slate-700/80 dark:bg-[#0D1614]">
                {(head ?? []).map((h, hi) => (
                  <th
                    key={hi}
                    className="whitespace-nowrap tabular-nums px-3.5 py-2.5 text-start font-semibold text-neutral-700 dark:text-slate-200"
                  >
                    {inline(h, `${keyBase}-th${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.06]">
              {body.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => {
                    const nowrapCell = shouldNowrapPlaybookCell(head?.[ci] ?? '', c)
                    return (
                      <td
                        key={ci}
                        className={`px-3.5 py-2.5 text-neutral-800 dark:text-slate-200 ${
                          nowrapCell ? 'whitespace-nowrap tabular-nums' : 'min-w-[220px]'
                        }`}
                      >
                        {inline(c, `${keyBase}-td${ri}-${ci}`)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }
    if (/^\s*([-•*]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line)
      const items: string[] = []
      while (i < lines.length && /^\s*([-•*]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-•*]|\d+[.)])\s+/, ''))
        i += 1
      }
      const Tag = ordered ? 'ol' : 'ul'
      blocks.push(
        <Tag
          key={`${keyBase}-l${k++}`}
          className={`space-y-2 ps-6 ${
            ordered
              ? 'list-decimal marker:font-semibold marker:text-emerald-700 dark:marker:text-emerald-400'
              : 'list-disc marker:text-emerald-600 dark:marker:text-emerald-400'
          }`}
        >
          {items.map((it, ii) => (
            <li key={ii} className="ps-1">
              {inline(it, `${keyBase}-li${ii}`)}
            </li>
          ))}
        </Tag>,
      )
      continue
    }
    blocks.push(<p key={`${keyBase}-p${k++}`}>{inline(line, `${keyBase}-p${k}`)}</p>)
    i += 1
  }
  return blocks
}

export function FeryalStudioMessage({
  text,
  frozenScope,
  isAr = false,
}: {
  text: string
  frozenScope?: FrozenMessageScope
  isAr?: boolean
}) {
  const sections = splitSections(text)
  return (
    <div className="min-w-0 space-y-4 text-[15px] leading-[1.85] [overflow-wrap:anywhere]">
      {frozenScope ? (
        <div
          data-frozen-scope="true"
          data-scope-brand={frozenScope.brandScope}
          data-scope-period={frozenScope.periodLabel}
          data-scope-from={frozenScope.dateFrom}
          data-scope-to={frozenScope.dateTo}
          className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/90 px-2.5 py-1 text-xs font-semibold text-slate-700 tabular-nums dark:border-slate-700/80 dark:bg-[#0D1614] dark:text-slate-200"
        >
          <span>{formatFrozenScopeBadgeText(frozenScope, isAr)}</span>
        </div>
      ) : null}
      {sections.map((s, si) => {
        const outcome = !!s.title && OUTCOME_RE.test(s.title)
        const body = renderBody(s.lines, `s${si}`)
        if (outcome) {
          return (
            <div
              key={si}
              className="min-w-0 space-y-2.5 rounded-2xl bg-emerald-50/80 p-4 ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:ring-emerald-500/25"
            >
              <div className="text-[13.5px] font-semibold tracking-tight text-emerald-800 dark:text-emerald-300">
                {s.title}
              </div>
              <div className="min-w-0 space-y-2.5 text-emerald-950 dark:text-emerald-50">{body}</div>
            </div>
          )
        }
        return (
          <div key={si} className="min-w-0 space-y-2.5">
            {s.title && (
              <div className="text-[13.5px] font-semibold tracking-tight text-neutral-500 dark:text-slate-400">
                {s.title}
              </div>
            )}
            {body}
          </div>
        )
      })}
    </div>
  )
}

/** Plain text for clipboard copies: markdown symbols removed, section titles kept. */
export function feryalPlainText(text: string) {
  return (text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/^#{1,6}\s+/, '').replace(/\*\*/g, '').replace(/`+/g, ''))
    .join('\n')
    .trim()
}
