import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { IBM_Plex_Sans_Arabic, Inter, Cairo } from 'next/font/google'
import { GlobalAutoTranslator } from '@/components/GlobalAutoTranslator'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { PwaRegister } from '@/components/pwa-register'
import { LanguageProvider, type Locale } from '@/lib/i18n'
import { ThemeProvider, type Theme } from '@/lib/theme'
import './globals.css'
import './aether-v2.css'

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-ibm-plex-arabic',
  weight: ['400', '500', '600', '700'],
})

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['500', '600', '700', '800'],
})

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-cairo',
  weight: ['400', '500', '600', '700', '800', '900'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F7F8' },
    { media: '(prefers-color-scheme: dark)', color: '#09110E' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://aetherbi.com'),
  title: 'AetherBI',
  description: 'AetherBI Enterprise ERP & BI — Accounting, Inventory, POS, HR, and AI',
  applicationName: 'AetherBI ERP',
  manifest: '/manifest.json',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  appleWebApp: { capable: true, title: 'AetherBI ERP', statusBarStyle: 'black-translucent' },
  openGraph: {
    title: 'AetherBI',
    description: 'AetherBI Enterprise ERP & BI on aetherbi.com',
    url: 'https://aetherbi.com',
    siteName: 'AetherBI',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let locale: Locale = 'en'
  let theme: Theme = 'light'
  try {
    const cookieStore = await cookies()
    const raw =
      cookieStore.get('NEXT_LOCALE')?.value ||
      cookieStore.get('ai-hq-locale')?.value ||
      cookieStore.get('vf_lang')?.value
    locale = raw === 'ar' ? 'ar' : 'en'
    const themeCookie =
      cookieStore.get('aetherbi_theme_mode')?.value ||
      cookieStore.get('ai-hq-theme')?.value
    theme = themeCookie === 'dark' ? 'dark' : 'light'
  } catch {
    // Keep safe defaults when cookie store is unavailable during cold start.
  }

  return (
    <html
      lang={locale}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      data-theme={theme}
      className={`${ibmPlexArabic.variable} ${inter.variable} ${cairo.variable} font-sans ${theme === 'light' ? 'light light-mode' : 'dark'}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{localStorage.removeItem('aetherbi_scope_brand');localStorage.removeItem('aetherbi_scope_branch');localStorage.removeItem('aetherbi_scope_brand_id');localStorage.removeItem('aetherbi_scope_branch_id');localStorage.removeItem('vf_brand_id');localStorage.removeItem('vf_branch_id');if(document.cookie.indexOf('vf_brand_id')!==-1){document.cookie='vf_brand_id=;path=/;max-age=0;expires=Thu, 01 Jan 1970 00:00:00 GMT';document.cookie='vf_branch_id=;path=/;max-age=0;expires=Thu, 01 Jan 1970 00:00:00 GMT';}var qp='';try{qp=(new URLSearchParams(window.location.search).get('lang')||'').toLowerCase();}catch(_){}var sl=localStorage.getItem('ai-hq-locale')||localStorage.getItem('NEXT_LOCALE')||localStorage.getItem('aetherbi_locale')||'';var l=(qp==='ar'||qp==='en')?qp:(sl==='ar'?'ar':'en');document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr';var t=localStorage.getItem('aetherbi_theme_mode')||localStorage.getItem('ai-hq-theme')||(document.cookie.match(/(?:^|;\\s*)(?:aetherbi_theme_mode|ai-hq-theme)=([^;]+)/)||[])[1]||'light';document.documentElement.dataset.theme=t;if(t==='light'){document.documentElement.classList.add('light','light-mode');document.documentElement.classList.remove('dark');}else{document.documentElement.classList.add('dark');document.documentElement.classList.remove('light','light-mode');}if(localStorage.getItem('aetherbi_rail_collapsed_v1')==='true'){document.documentElement.dataset.railCollapsed='true';}}catch(e){}})();`,
          }}
        />
      </head>
      <body className={`${locale === 'ar' ? ibmPlexArabic.className : inter.className} min-h-full antialiased lg:pb-0`} suppressHydrationWarning>
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
