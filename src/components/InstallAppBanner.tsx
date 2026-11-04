'use client'

import { useEffect, useState } from 'react'
import { btnPrimary } from '@/components/erp-ui'
import { useI18n } from '@/lib/i18n'

const DISMISS_KEY = 'aetherbi_pwa_dismissed'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return true
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || Boolean(nav.standalone)
}

function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
  )
}

function isDismissed(): boolean {
  if (typeof window === 'undefined') return true
  try {
    if (window.localStorage.getItem(DISMISS_KEY) === 'true') return true
  } catch {}
  try {
    if (window.sessionStorage.getItem(DISMISS_KEY) === 'true') return true
  } catch {}
  try {
    if (typeof document !== 'undefined' && document.cookie.includes(`${DISMISS_KEY}=true`)) return true
  } catch {}
  return false
}

export function InstallAppBanner() {
  const { locale } = useI18n()
  const en = locale === 'en'
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(true)
  const [tip, setTip] = useState<string | null>(null)
  const [ios, setIos] = useState(false)

  function persistDismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, 'true')
    } catch {}
    try {
      window.sessionStorage.setItem(DISMISS_KEY, 'true')
    } catch {}
    try {
      const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:'
      document.cookie = `${DISMISS_KEY}=true; path=/; max-age=31536000; SameSite=Lax${isHttps ? '; Secure' : ''}`
    } catch {}
    setHidden(true)
    setDeferred(null)
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (isDismissed()) {
      setHidden(true)
      return
    }
    if (isStandalone()) {
      setHidden(true)
      return
    }
    setIos(isIosDevice())
    setHidden(false)

    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    const onInstalled = () => {
      persistDismiss()
    }
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (hidden) return null

  const copy = en
    ? {
        text: '📲 Install AetherBI ERP directly on your device for instant desktop & mobile access.',
        iosText:
          '📲 On iPhone: tap Share, then Add to Home Screen to install AetherBI ERP without the App Store.',
        install: 'Install App',
        dismiss: 'Dismiss ✕',
        tip: 'Use the install icon in the Chrome address bar (monitor icon next to the star), then this banner will hide.',
      }
    : {
        text: '📲 ثبّت تطبيق النظام مباشرة على جهازك للوصول السريع.',
        iosText:
          '📲 على آيفون: اضغط مشاركة ثم «إضافة إلى الشاشة الرئيسية» لتثبيت تطبيق النظام للوصول السريع.',
        install: 'تثبيت التطبيق الآن',
        dismiss: 'إغلاق ✕',
        tip: 'استخدم أيقونة التثبيت في شريط العنوان (أيقونة الجهاز بجانب النجمة)، ثم سيُخفى هذا الشريط.',
      }

  async function onInstall() {
    if (deferred) {
      try {
        await deferred.prompt()
        await deferred.userChoice
      } catch {
        // ignore prompt errors — still hide after attempt
      }
      setDeferred(null)
      persistDismiss()
      return
    }
    setTip(copy.tip)
    window.setTimeout(() => {
      persistDismiss()
    }, 4500)
  }

  return (
    <div
      className="no-print border-b border-slate-200 bg-white px-4 py-3 md:px-8"
      data-no-translate=""
      dir={en ? 'ltr' : 'rtl'}
      lang={en ? 'en' : 'ar'}
      style={{ unicodeBidi: 'isolate' }}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800" dir={en ? 'ltr' : 'rtl'}>
          {tip ? tip : ios ? copy.iosText : copy.text}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {!ios || deferred ? (
            <button type="button" className={btnPrimary} onClick={() => void onInstall()}>
              {copy.install}
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
            onClick={persistDismiss}
          >
            {copy.dismiss}
          </button>
        </div>
      </div>
    </div>
  )
}
