'use client'

import Image from 'next/image'
import {
  ArrowLeft,
  ArrowRight,
  Database,
  MonitorDown,
  QrCode,
  ShieldCheck,
} from 'lucide-react'
import { InstallCard } from '@/app/download/install-card'
import { StateBlock } from '@/components/ui/state-block'
import { UNAVAILABLE_DASH, getUnavailableTooltip } from '@/lib/format'
import { LanguageSwitch, useI18n } from '@/lib/i18n'

export type DownloadViewProps = {
  qrDataUrl: string
  pageUrl: string
}

export function DownloadView({ qrDataUrl, pageUrl }: DownloadViewProps) {
  const { locale } = useI18n()
  const isAr = locale !== 'en'
  const dir = isAr ? 'rtl' : 'ltr'
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight
  const unavailableTip = getUnavailableTooltip(locale)

  return (
    <main
      dir={dir}
      className="relative min-h-screen w-full min-w-0 overflow-x-hidden bg-[#F6F7F8] px-4 pb-12 pt-16 text-slate-900 sm:px-6 sm:pt-14 dark:bg-[#090E0C] dark:text-slate-100"
    >
      <div className="fixed end-4 top-4 z-40 sm:end-6 sm:top-5">
        <LanguageSwitch />
      </div>

      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>AetherBI Enterprise ERP · Venture Foods</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
            {isAr
              ? 'مركز تحميل تطبيقات AetherBI ERP'
              : 'AetherBI ERP Download Center'}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {isAr
              ? 'مشغّل سطح مكتب Windows، التثبيت الفوري للجوال والكمبيوتر، وتصدير النسخة الاحتياطية لمدير النظام.'
              : 'Windows desktop launcher, instant PWA mobile & desktop installation, and administrator backup export.'}
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className="ds-surface flex min-w-0 flex-col justify-between gap-4 rounded-2xl p-5 sm:p-6">
            <div className="space-y-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <MonitorDown className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                {isAr
                  ? 'نسخة سطح المكتب لـ Windows'
                  : 'Windows Desktop Launcher'}
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {isAr
                  ? 'ملف تشغيل يفتح المنصة في نافذة تطبيق مستقلة بلا أشرطة المتصفح.'
                  : 'Lightweight launcher script that opens the ERP in a standalone app window.'}
              </p>
            </div>
            <a
              href="/api/download/windows-launcher"
              aria-label={
                isAr
                  ? 'تحميل مشغّل سطح المكتب AetherBI-ERP-Desktop.bat'
                  : 'Download Windows launcher AetherBI-ERP-Desktop.bat'
              }
              className="ds-motion ds-focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#04130D] dark:hover:bg-emerald-400"
            >
              <MonitorDown className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span dir="ltr">AetherBI-ERP-Desktop.bat</span>
            </a>
          </section>

          <section className="ds-surface flex min-w-0 flex-col justify-between gap-4 rounded-2xl p-5 sm:p-6">
            <div className="space-y-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <QrCode className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                {isAr
                  ? 'تثبيت فوري على الجهاز'
                  : 'Instant Device Installation'}
              </h2>
              <InstallCard />
            </div>

            <div className="space-y-2 pt-2">
              {qrDataUrl ? (
                <div
                  className="inline-block rounded-xl border border-slate-200 p-2"
                  style={{ backgroundColor: '#FFFFFF' }}
                >
                  <Image
                    unoptimized
                    src={qrDataUrl}
                    alt={
                      isAr
                        ? 'رمز QR لصفحة التحميل'
                        : 'Download center QR code'
                    }
                    width={160}
                    height={160}
                    className="h-40 w-40"
                  />
                </div>
              ) : (
                <StateBlock
                  state="unavailable"
                  compact
                  locale={locale}
                  title={isAr ? 'رمز QR غير متاح' : 'QR code unavailable'}
                />
              )}
              <p
                dir="ltr"
                className="break-all text-xs tabular-nums text-slate-600 dark:text-slate-400"
              >
                {pageUrl || (
                  <span title={unavailableTip} data-unavailable="true">
                    {UNAVAILABLE_DASH}
                  </span>
                )}
              </p>
            </div>
          </section>

          <section className="ds-surface flex min-w-0 flex-col justify-between gap-4 rounded-2xl p-5 sm:p-6">
            <div className="space-y-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                <Database className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                {isAr
                  ? 'نسخة المشروع والبيانات'
                  : 'Project & Data Backup Export'}
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {isAr
                  ? 'ملف JSON يتضمن بيانات الأعمال وصيغة SQL بدون كلمات المرور أو مفاتيح البوابات. متاح لمدير النظام بعد تسجيل الدخول.'
                  : 'Portable JSON & SQL backup excluding passwords and gateway secrets. Restricted to signed-in system administrators.'}
              </p>
            </div>
            <a
              href="/api/download/backup"
              aria-label={
                isAr
                  ? 'تنزيل النسخة الاحتياطية JSON'
                  : 'Download JSON backup'
              }
              className="ds-motion ds-focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 dark:border-white/15 dark:bg-[#141F1B] dark:text-slate-100 dark:hover:bg-[#1E2E28]"
            >
              <Database className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {isAr ? 'تنزيل النسخة الاحتياطية' : 'Download Backup'}
              </span>
            </a>
          </section>
        </div>

        <div>
          <a
            href="/login"
            aria-label={
              isAr ? 'الانتقال إلى دخول النظام' : 'Go to ERP Sign In'
            }
            className="ds-motion ds-focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:border-emerald-500/40 hover:text-emerald-700 dark:border-white/15 dark:bg-[#101815] dark:text-slate-100 dark:hover:text-emerald-300"
          >
            <span>{isAr ? 'دخول النظام' : 'Sign in to ERP'}</span>
            <ArrowIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          </a>
        </div>
      </div>
    </main>
  )
}
