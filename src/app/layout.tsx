import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { Cairo } from 'next/font/google'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { PwaRegister } from '@/components/pwa-register'
import { LanguageProvider, type Locale } from '@/lib/i18n'
import { ThemeProvider, type Theme } from '@/lib/theme'
import './globals.css'

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-cairo',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.aetherbi.com'),
  title: 'AetherBI',
  description: 'AetherBI Enterprise ERP & BI — المحاسبة، المخزون، POS، الموارد البشرية والذكاء الاصطناعي',
  applicationName: 'AetherBI ERP',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'AetherBI ERP', statusBarStyle: 'black-translucent' },
  openGraph: {
    title: 'AetherBI',
    description: 'AetherBI Enterprise ERP & BI على www.aetherbi.com',
    url: 'https://www.aetherbi.com',
    siteName: 'AetherBI',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let locale: Locale = 'ar'
  let theme: Theme = 'dark'
  try {
    const cookieStore = await cookies()
    const raw =
      cookieStore.get('NEXT_LOCALE')?.value ||
      cookieStore.get('ai-hq-locale')?.value ||
      cookieStore.get('vf_lang')?.value
    locale = raw === 'en' ? 'en' : 'ar'
    theme = cookieStore.get('ai-hq-theme')?.value === 'light' ? 'light' : 'dark'
  } catch {
    // Keep safe defaults when cookie store is unavailable during cold start.
  }

  return (
    <html lang={locale} dir={locale === 'en' ? 'ltr' : 'rtl'} data-theme={theme} className={cairo.variable} suppressHydrationWarning>
      <body className={`${cairo.className} min-h-full bg-ink-950 font-cairo text-mist-100 antialiased md:pb-0`} suppressHydrationWarning>
        <ThemeProvider initialTheme={theme}>
          <LanguageProvider initialLocale={locale}>
            {children}
            <MobileBottomNav />
            <PwaRegister />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
