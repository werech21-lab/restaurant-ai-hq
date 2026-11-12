'use client'

import { Fragment, type ReactNode } from 'react'

/**
 * Structured renderer for Feryal replies in the unified executive studio.
 * Turns markdown-style headings, numbered/bullet lists, **bold** terms and pipe tables into calm
 * sections at readable 15px typography, highlights expected outcomes, and leaves zero raw markdown symbols.
 */
const OUTCOME_RE = /النتائج المتوقعة|النتيجة المتوقعة|الفايدة المتوقعة|expected outcome|expected kwd gain/i

function clean(text: string) {
  return text.replace(/`+/g, '').replace(/^#+\s*/, '').replace(/__/g, '')
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
          className="overflow-x-auto rounded-2xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-neutral-200/70 dark:bg-[#111A22] dark:ring-emerald-500/15"
        >
          <table className="w-full text-[14.5px] sm:text-[15px]">
            <thead>
              <tr className="bg-[#F7F7F8] dark:bg-[#0D1614]">
                {(head ?? []).map((h, hi) => (
                  <th
                    key={hi}
                    className="px-3.5 py-2.5 text-start font-semibold text-neutral-600 dark:text-slate-300"
                  >
                    {inline(h, `${keyBase}-th${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.06]">
              {body.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="px-3.5 py-2.5 text-neutral-800 dark:text-slate-200">
                      {inline(c, `${keyBase}-td${ri}-${ci}`)}
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

export function FeryalStudioMessage({ text }: { text: string }) {
  const sections = splitSections(text)
  return (
    <div className="space-y-4 text-[15px] leading-[1.85]">
      {sections.map((s, si) => {
        const outcome = !!s.title && OUTCOME_RE.test(s.title)
        const body = renderBody(s.lines, `s${si}`)
        if (outcome) {
          return (
            <div
              key={si}
              className="space-y-2.5 rounded-2xl bg-emerald-50/80 p-4 ring-1 ring-emerald-500/20 dark:bg-emerald-950/40 dark:ring-emerald-500/25"
            >
              <div className="text-[13.5px] font-semibold tracking-tight text-emerald-800 dark:text-emerald-300">
                {s.title}
              </div>
              <div className="space-y-2.5 text-emerald-950 dark:text-emerald-50">{body}</div>
            </div>
          )
        }
        return (
          <div key={si} className="space-y-2.5">
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
