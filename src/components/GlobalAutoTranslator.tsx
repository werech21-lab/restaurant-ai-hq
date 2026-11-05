'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { ARABIC_RE, translateArabicText } from '@/lib/i18n/comprehensive-ar-en-map'

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'aria-description'] as const
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'SVG', 'PATH'])
const ORIGINAL_ATTR = 'data-original-ar'
const ATTR_ORIGINAL_PREFIX = 'data-original-ar-'
const VALUE_ORIGINAL = 'data-original-ar-value'

/** Pages that already localize via React locale state — never mutate their DOM. */
const REACT_I18N_PATHS = ['/dashboard', '/reports', '/erp/aggregator-radar', '/erp/food-safety', '/erp/sales-scorecard', '/erp/menu-engineering']

function isReactI18nPath(pathname: string | null): boolean {
  if (!pathname) return false
  return REACT_I18N_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function shouldSkip(node: Node): boolean {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement
    if (SKIP_TAGS.has(el.tagName)) return true
    if (el.closest?.('[data-no-translate], [data-language-switch], [data-live-timer], [data-countdown]')) return true
    if (el.isContentEditable) return true
  }
  return false
}

function rememberOriginal(el: HTMLElement, key: string, value: string) {
  if (!el.getAttribute(key)) el.setAttribute(key, value)
}

/**
 * Mutate text node value only — never createElement / removeChild / replaceChild.
 * That keeps React's virtual DOM from colliding with the translator.
 */
function translateTextNode(node: Text, toEn: boolean) {
  const parent = node.parentElement
  if (!parent || shouldSkip(parent)) return
  const current = node.nodeValue ?? ''
  if (!current.trim()) return
  // Pure timers / numbers — leave alone
  if (/^[\d\s:./\-–—+%°hmsHMS]+$/.test(current.trim())) return

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

  if (el instanceof HTMLOptionElement || el.tagName === 'OPTGROUP') {
    const label = el.getAttribute('label')
    if (label && ARABIC_RE.test(label)) {
      const storeKey = `${ATTR_ORIGINAL_PREFIX}label`
      if (toEn) {
        rememberOriginal(el, storeKey, label)
        el.setAttribute('label', translateArabicText(label))
      } else {
        const original = el.getAttribute(storeKey)
        if (original != null) el.setAttribute('label', original)
      }
    }
  }

  if (el instanceof HTMLButtonElement || el instanceof HTMLLabelElement || el instanceof HTMLSpanElement) {
    const text = el.childNodes.length === 1 && el.childNodes[0]?.nodeType === Node.TEXT_NODE ? el.textContent : null
    if (text && ARABIC_RE.test(text)) {
      if (toEn) {
        rememberOriginal(el, VALUE_ORIGINAL, text)
        const next = translateArabicText(text)
        if (next !== text && el.firstChild?.nodeType === Node.TEXT_NODE) {
          el.firstChild.nodeValue = next
        }
      } else {
        const original = el.getAttribute(VALUE_ORIGINAL)
        if (original != null && el.firstChild?.nodeType === Node.TEXT_NODE) {
          el.firstChild.nodeValue = original
        }
      }
    }
  }
}

function translateTitle(toEn: boolean, titleOriginalRef: { current: string | null }) {
  if (toEn) {
    if (ARABIC_RE.test(document.title)) {
      if (titleOriginalRef.current == null) titleOriginalRef.current = document.title
      document.title = translateArabicText(document.title)
    } else if (titleOriginalRef.current && ARABIC_RE.test(titleOriginalRef.current)) {
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
  // Snapshot child list once — never mutate structure while iterating.
  const children = root.childNodes
  for (let i = 0; i < children.length; i++) {
    const child = children.item(i)
    if (child) walk(child, toEn)
  }
}

/**
 * Safety-net AR→EN wipe. Never creates/removes DOM nodes.
 * Debounced + skipped on React-i18n live dashboards to avoid Virtual DOM fights.
 */
export function GlobalAutoTranslator() {
  const { locale } = useI18n()
  const pathname = usePathname()
  const titleOriginalRef = useRef<string | null>(null)
  const busyRef = useRef(false)
  const pendingRef = useRef(false)
  const rafRef = useRef(0)
  const timerRef = useRef(0)

  useEffect(() => {
    if (isReactI18nPath(pathname)) {
      return
    }

    const toEn = locale === 'en'

    const flush = () => {
      pendingRef.current = false
      if (busyRef.current) return
      busyRef.current = true
      try {
        if (document.body) walk(document.body, toEn)
        translateTitle(toEn, titleOriginalRef)
      } catch {
        // Never let the translator crash the app.
      } finally {
        busyRef.current = false
      }
    }

    const schedule = () => {
      if (pendingRef.current) return
      pendingRef.current = true
      window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        rafRef.current = window.requestAnimationFrame(flush)
      }, 150)
    }

    flush()
    const boot1 = window.setTimeout(flush, 200)
    const boot2 = window.setTimeout(flush, 800)

    const observer = new MutationObserver((mutations) => {
      // Ignore pure characterData (live countdowns) — those are numbers/timers.
      let needsRun = false
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') continue
        const target = mutation.target
        if (target.nodeType === Node.ELEMENT_NODE && shouldSkip(target)) continue
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          needsRun = true
          break
        }
        if (mutation.type === 'attributes') {
          const attr = mutation.attributeName
          if (!attr) continue
          const el = mutation.target as HTMLElement
          const value = el.getAttribute(attr) ?? ''
          if (ARABIC_RE.test(value)) {
            needsRun = true
            break
          }
        }
      }
      if (needsRun) schedule()
    })

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: false,
      attributes: true,
      attributeFilter: [...ATTRS, 'label'],
    })

    return () => {
      observer.disconnect()
      window.clearTimeout(boot1)
      window.clearTimeout(boot2)
      window.clearTimeout(timerRef.current)
      window.cancelAnimationFrame(rafRef.current)
    }
  }, [locale, pathname])

  return null
}
