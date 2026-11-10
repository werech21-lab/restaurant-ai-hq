'use client'

import { Fragment, type ReactNode } from 'react'

/**
 * Structured renderer for Feryal replies: markdown-style tables, bullet/numbered lists,
 * headings, **bold** and highlighted KWD / % metrics. Plain prose renders unchanged.
 */
const METRIC_RE = /(\*\*[^*]+\*\*|[+\-−]?\d[\d,]*(?:\.\d+)?\s?(?:KWD|د\.ك|دينار(?:اً)? كويتي(?:اً)?|%|pp))/g
const METRIC_TEST = /^[+\-−]?\d[\d,]*(?:\.\d+)?\s?(?:KWD|د\.ك|دينار(?:اً)? كويتي(?:اً)?|%|pp)$/

function inline(text: string, keyBase: string): ReactNode[] {
  const parts = text.split(METRIC_RE)
  return parts.map((part, i) => {
    if (!part) return null
    const key = `${keyBase}-${i}`
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={key} className="font-semibold text-slate-900 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (METRIC_TEST.test(part)) {
      const positive = part.trim().startsWith('+')
      return (
        <span
          key={key}
          className={`ae-num mx-0.5 rounded-md px-1 py-px text-[0.95em] font-bold ${positive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200'}`}
        >
          {part}
        </span>
      )
    }
    return <Fragment key={key}>{part}</Fragment>
  })
}

function parseTable(lines: string[]) {
  const rows = lines
    .filter((l) => !/^[\s|:-]+$/.test(l))

    .map((l) =>
      l
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim()),
    )
  return { head: rows[0] ?? [], body: rows.slice(1) }
}

export function FeryalRichText({ text }: { text: string; lang?: 'ar' | 'en' }) {
  const lines = (text || '').replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let k = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const tableLines: string[] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        tableLines.push(lines[i])
        i += 1
      }
      const { head, body } = parseTable(tableLines)
      blocks.push(
        <div key={`t${k++}`} className="my-2 overflow-x-auto rounded-xl ring-1 ring-slate-200/80 dark:ring-slate-700/60">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/5">
                {head.map((h, hi) => (
                  <th key={hi} className="px-2.5 py-1.5 text-start font-semibold text-slate-600 dark:text-slate-300">
                    {inline(h, `th${k}-${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {body.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="px-2.5 py-1.5 text-slate-700 dark:text-slate-200">
                      {inline(c, `td${k}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }
    if (/^\s*([-•*]|\d+[.)])\s+/.test(line)) {
      const items: string[] = []
      const ordered = /^\s*\d+[.)]\s+/.test(line)
      while (i < lines.length && /^\s*([-•*]|\d+[.)])\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-•*]|\d+[.)])\s+/, ''))
        i += 1
      }
      const ListTag = ordered ? 'ol' : 'ul'
      blocks.push(
        <ListTag key={`l${k++}`} className={`my-1.5 space-y-1 ps-5 ${ordered ? 'list-decimal' : 'list-disc'} marker:text-sky-500`}>
          {items.map((it, ii) => (
            <li key={ii} className="leading-relaxed">
              {inline(it, `li${k}-${ii}`)}
            </li>
          ))}
        </ListTag>,
      )
      continue
    }
    if (/^\s*#{1,4}\s+/.test(line)) {
      blocks.push(
        <p key={`h${k++}`} className="mt-2 text-[13px] font-semibold tracking-tight text-slate-900 dark:text-white">
          {inline(line.replace(/^\s*#{1,4}\s+/, ''), `h${k}`)}
        </p>,
      )
      i += 1
      continue
    }
    if (!line.trim()) {
      i += 1
      continue
    }
    blocks.push(
      <p key={`p${k++}`} className="leading-relaxed">
        {inline(line, `p${k}`)}
      </p>,
    )
    i += 1
  }
  return <div className="space-y-1.5">{blocks}</div>
}
