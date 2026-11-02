'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { ARABIC_RE, translateArabicText } from '@/lib/i18n/auto-dictionary'

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA'])
const ORIGINAL_ATTR = 'data-original-ar'
const ATTR_ORIGINAL_PREFIX = 'data-original-ar-'

function shouldSkip(node: Node): boolean {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement
    if (SKIP_TAGS.has(el.tagName)) return true
    if (el.closest?.('[data-no-translate], [data-language-switch]')) return true
    if (el.isContentEditable) return true
  }
  return false
}

function rememberOriginal(el: HTMLElement, key: string, value: string) {
  if (!el.getAttribute(key)) el.setAttribute(key, value)
}

function translateTextNode(node: Text, toEn: boolean) {
  const parent = node.parentElement
  if (!parent || shouldSkip(parent)) return
  const current = node.nodeValue ?? ''
  if (!current.trim()) return

  if (toEn) {
    if (!ARABIC_RE.test(current)) return
    rememberOriginal(parent, ORIGINAL_ATTR, current)
    const next = translateArabicText(current)
    if (next !== current) node.nodeValue = next
    return
  }

  const original = parent.getAttribute(ORIGINAL_ATTR)
  if (original != null && ARABIC_RE.test(original)) {
    node.nodeValue = original
  }
}

function translateAttributes(el: HTMLElement, toEn: boolean) {
  if (shouldSkip(el)) return
  for (const attr of ATTRS) {
    const value = el.getAttribute(attr)
    if (value == null) continue
    const storeKey = `${ATTR_ORIGINAL_PREFIX}${attr}`
    if (toEn) {
      if (!ARABIC_RE.test(value)) continue
      rememberOriginal(el, storeKey, value)
      const next = translateArabicText(value)
      if (next !== value) el.setAttribute(attr, next)
    } else {
      const original = el.getAttribute(storeKey)
      if (original != null) el.setAttribute(attr, original)
    }
  }
}

function translateTitle(toEn: boolean, titleOriginalRef: { current: string | null }) {
  if (toEn) {
    if (ARABIC_RE.test(document.title)) {
      if (titleOriginalRef.current == null) titleOriginalRef.current = document.title
      document.title = translateArabicText(document.title)
    } else if (titleOriginalRef.current && ARABIC_RE.test(titleOriginalRef.current)) {
      // React may have already set a mixed title — keep EN mapping of original.
      document.title = translateArabicText(titleOriginalRef.current)
    }
  } else if (titleOriginalRef.current != null) {
    document.title = titleOriginalRef.current
  }
}

function walk(root: Node, toEn: boolean) {
  if (shouldSkip(root)) return
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, toEn)
    return
  }
  if (root.nodeType === Node.ELEMENT_NODE) {
    translateAttributes(root as HTMLElement, toEn)
  }
  const children = Array.from(root.childNodes)
  for (const child of children) walk(child, toEn)
}

/**
 * Client-side safety net: when locale === "en", wipe residual Arabic from the live DOM
 * (server HTML, DB labels, hard-coded strings). Switching back to AR restores originals.
 */
export function GlobalAutoTranslator() {
  const { locale } = useI18n()
  const pathname = usePathname()
  const titleOriginalRef = useRef<string | null>(null)
  const busyRef = useRef(false)

  useEffect(() => {
    const toEn = locale === 'en'

    const run = () => {
      if (busyRef.current) return
      busyRef.current = true
      try {
        walk(document.body, toEn)
        translateTitle(toEn, titleOriginalRef)
      } finally {
        busyRef.current = false
      }
    }

    run()
    const raf = window.requestAnimationFrame(run)
    const t1 = window.setTimeout(run, 50)
    const t2 = window.setTimeout(run, 250)
    const t3 = window.setTimeout(run, 800)

    const observer = new MutationObserver((mutations) => {
      if (!toEn) {
        // Still allow AR restore on subtree inserts that already carry originals.
        run()
        return
      }
      let needs = false
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          const text = mutation.target.nodeValue ?? ''
          if (ARABIC_RE.test(text)) {
            needs = true
            break
          }
        }
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          needs = true
          break
        }
        if (mutation.type === 'attributes') {
          const el = mutation.target as HTMLElement
          const attr = mutation.attributeName
          if (attr && ATTRS.includes(attr as (typeof ATTRS)[number])) {
            const value = el.getAttribute(attr) ?? ''
            if (ARABIC_RE.test(value)) {
              needs = true
              break
            }
          }
        }
      }
      if (needs) run()
    })

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRS],
    })

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [locale, pathname])

  return null
}
