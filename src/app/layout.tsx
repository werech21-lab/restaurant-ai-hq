import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { Cairo } from 'next/font/google'
import { GlobalAutoTranslator } from '@/components/GlobalAutoTranslator'
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://aetherbi.com'),
  title: 'AetherBI',
  description: 'AetherBI Enterprise ERP & BI — Accounting, Inventory, POS, HR, and AI',
  applicationName: 'AetherBI ERP',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'AetherBI ERP', statusBarStyle: 'black-translucent' },
  openGraph: {
    title: 'AetherBI',
    description: 'AetherBI Enterprise ERP & BI على aetherbi.com',
    url: 'https://aetherbi.com',
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
    const themeCookie =
      cookieStore.get('aetherbi_theme_mode')?.value ||
      cookieStore.get('ai-hq-theme')?.value
    theme = themeCookie === 'light' ? 'light' : 'dark'
  } catch {
    // Keep safe defaults when cookie store is unavailable during cold start.
  }

  return (
    <html
      lang={locale}
      dir={locale === 'en' ? 'ltr' : 'rtl'}
      data-theme={theme}
      className={`${cairo.variable} ${theme === 'light' ? 'light-mode' : 'dark'}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('aetherbi_theme_mode')||localStorage.getItem('ai-hq-theme')||(document.cookie.match(/(?:^|;\\s*)(?:aetherbi_theme_mode|ai-hq-theme)=([^;]+)/)||[])[1]||'dark';document.documentElement.dataset.theme=t;if(t==='light'){document.documentElement.classList.add('light-mode');document.documentElement.classList.remove('dark');}else{document.documentElement.classList.add('dark');document.documentElement.classList.remove('light-mode');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${cairo.className} min-h-full font-cairo antialiased md:pb-0`} suppressHydrationWarning>
        <ThemeProvider initialTheme={theme}>
          <LanguageProvider initialLocale={locale}>
            <GlobalAutoTranslator />
            {children}
            <MobileBottomNav />
            <PwaRegister />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
