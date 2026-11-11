'use client'

import { Fragment, type ReactNode } from 'react'

/**
 * Structured renderer for Feryal replies in the executive studio.
 * Turns markdown-style headings, numbered/bullet lists, **bold** terms and pipe tables into clean
 * sections, highlights the expected-outcome section, and never leaves raw markdown symbols on screen.
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
        <strong key={key} className="font-bold text-slate-900 dark:text-white">
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
        if (!/^[\s|:-]+$/.test(lines[i])) rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
        i += 1
      }
      const [head, ...body] = rows
      blocks.push(
        <div key={`${keyBase}-t${k++}`} className="overflow-x-auto rounded-xl ring-1 ring-slate-200/80 dark:ring-slate-700/60">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/5">
                {(head ?? []).map((h, hi) => (
                  <th key={hi} className="px-3 py-2 text-start font-semibold text-slate-600 dark:text-slate-300">
                    {inline(h, `${keyBase}-th${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {body.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 text-slate-700 dark:text-slate-200">
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
        <Tag key={`${keyBase}-l${k++}`} className={`space-y-2 ps-6 ${ordered ? 'list-decimal marker:font-semibold marker:text-slate-500' : 'list-disc marker:text-emerald-600'}`}>
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
    <div className="space-y-4">
      {sections.map((s, si) => {
        const outcome = !!s.title && OUTCOME_RE.test(s.title)
        const body = renderBody(s.lines, `s${si}`)
        if (outcome) {
          return (
            <div key={si} className="space-y-2.5 rounded-xl bg-emerald-50/70 p-4 ring-1 ring-emerald-500/20 dark:bg-emerald-950/30">
              <div className="text-[13px] font-bold tracking-tight text-emerald-800 dark:text-emerald-300">{s.title}</div>
              <div className="space-y-2.5 text-emerald-950 dark:text-emerald-50">{body}</div>
            </div>
          )
        }
        return (
          <div key={si} className="space-y-2.5">
            {s.title && <div className="text-[13px] font-bold tracking-tight text-slate-500 dark:text-slate-400">{s.title}</div>}
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
