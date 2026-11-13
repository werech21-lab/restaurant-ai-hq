import { cookies } from 'next/headers'
import type { Locale } from '@/lib/i18n'

const LOCALE_COOKIES = ['NEXT_LOCALE', 'ai-hq-locale', 'vf_lang'] as const

/** Server locale from cookies (defaults to EN; AR only when explicitly set). */
export async function getLocale(): Promise<Locale> {
  try {
    const store = await cookies()
    for (const key of LOCALE_COOKIES) {
      const value = store.get(key)?.value
      if (value === 'en' || value === 'ar') return value
    }
  } catch {
    // Cookie store unavailable during cold start.
  }
  return 'en'
}

/** Strict bilingual pick — never mix languages. */
export function tx(locale: Locale, ar: string, en: string) {
  return locale === 'en' ? en : ar
}

export function moneyFor(locale: Locale, value: number) {
  const safe = Number.isFinite(value) ? value : 0
  const negative = safe < 0
  const [whole, fraction] = Math.abs(safe).toFixed(3).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const amount = `${negative ? '-' : ''}${grouped}.${fraction}`
  return locale === 'en' ? `KWD ${amount}` : `${amount} د.ك`
}

export function monthFor(locale: Locale, date: Date) {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ar-KW', {
    timeZone: 'Asia/Kuwait',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function dateFor(locale: Locale, value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ar-KW', {
    timeZone: 'Asia/Kuwait',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date)
}

export function datetimeFor(locale: Locale, value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'ar-KW', {
    timeZone: 'Asia/Kuwait',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}
