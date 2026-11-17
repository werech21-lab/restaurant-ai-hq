'use client'

import { useEffect, useState } from 'react'
import { Download, Smartphone } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

type InstallPrompt = Event & { prompt: () => Promise<void> }

export function InstallCard() {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    const ua = navigator.userAgent
    const apple = /iPad|iPhone|iPod/.test(ua)
    const nav = navigator as Navigator & { standalone?: boolean }
    setIos(apple && !nav.standalone)
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPrompt)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const installLabel = isAr ? 'تثبيت التطبيق الآن' : 'Install App Now'

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="space-y-3">
      {prompt ? (
        <button
          type="button"
          aria-label={installLabel}
          onClick={async () => {
            await prompt.prompt()
            setPrompt(null)
          }}
          className="ds-motion ds-focus-ring inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
        >
          <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{installLabel}</span>
        </button>
      ) : (
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {isAr
            ? 'من أندرويد أو الكمبيوتر افتح الصفحة في Chrome أو Edge ثم اضغط تثبيت التطبيق عندما يظهر.'
            : 'On Android or Desktop, open this page in Chrome or Edge and choose Install App when prompted.'}
        </p>
      )}
      {ios ? (
        <div className="ds-surface-subtle flex items-start gap-2.5 rounded-xl p-3 text-sm font-medium text-slate-800 dark:text-slate-200">
          <Smartphone
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400"
            aria-hidden="true"
          />
          <p>
            {isAr
              ? 'على آيفون: اضغط زر المشاركة Share بالأسفل، ثم اختر Add to Home Screen إضافة إلى الشاشة الرئيسية.'
              : 'On iPhone / iPad: tap the Share button at the bottom, then select Add to Home Screen.'}
          </p>
        </div>
      ) : null}
    </div>
  )
}
