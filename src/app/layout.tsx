import type { Metadata, Viewport } from 'next'
import { cookies, headers } from 'next/headers'
import { IBM_Plex_Sans_Arabic, Inter, Cairo } from 'next/font/google'
import { GlobalAutoTranslator } from '@/components/GlobalAutoTranslator'
import { MobileBottomNav } from '@/components/mobile-bottom-nav'
import { PwaRegister } from '@/components/pwa-register'
import { EXEC_SESSION_COOKIE, verifyExecSessionToken } from '@/lib/auth/exec-session'
import { getSavedUserLocale } from '@/lib/auth/user-locale-store'
import { LanguageProvider, type Locale } from '@/lib/i18n'
import { ThemeProvider, type Theme } from '@/lib/theme'
import './globals.css'
import './aether-v2.css'
import './v35-tokens.css'
import './v35-shell.css'

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
    { media: '(prefers-color-scheme: light)', color: '#F1F5FC' },
    { media: '(prefers-color-scheme: dark)', color: '#080E1D' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL('https://aetherbi.com'),
  title: 'إيثر لذكاء الأعمال | فنتشر فودز',
  description: 'المنصة التنفيذية لذكاء الأعمال والحوكمة المالية لشركة فنتشر فودز لإدارة المطاعم',
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
    title: 'إيثر لذكاء الأعمال | فنتشر فودز',
    description: 'المنصة التنفيذية لذكاء الأعمال والحوكمة المالية لشركة فنتشر فودز لإدارة المطاعم',
    url: 'https://aetherbi.com',
    siteName: 'AetherBI',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let locale: Locale = 'ar'
  // Phase 5 · Item 8: Light is the default; a saved user choice (cookie/localStorage) still wins.
  let theme: Theme = 'light'
  let nonce: string | undefined
  try {
    const headerStore = await headers()
    nonce = headerStore.get('x-nonce') ?? undefined
    const cookieStore = await cookies()
    const execSession = await verifyExecSessionToken(cookieStore.get(EXEC_SESSION_COOKIE)?.value)
    const savedAccountLocale = getSavedUserLocale(execSession?.sub)
    const raw =
      cookieStore.get('NEXT_LOCALE')?.value ||
      cookieStore.get('ai-hq-locale')?.value ||
      cookieStore.get('vf_lang')?.value ||
      savedAccountLocale ||
      ''
    locale = raw === 'en' ? 'en' : 'ar'
    const themeCookie =
      cookieStore.get('aetherbi_theme_mode')?.value ||
      cookieStore.get('ai-hq-theme')?.value
    theme = themeCookie === 'dark' ? 'dark' : 'light'
  } catch {
    // Keep safe defaults when cookie/header store is unavailable during cold start.
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
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{localStorage.removeItem('aetherbi_scope_brand');localStorage.removeItem('aetherbi_scope_branch');localStorage.removeItem('aetherbi_scope_brand_id');localStorage.removeItem('aetherbi_scope_branch_id');localStorage.removeItem('vf_brand_id');localStorage.removeItem('vf_branch_id');if(document.cookie.indexOf('vf_brand_id')!==-1){document.cookie='vf_brand_id=;path=/;max-age=0;expires=Thu, 01 Jan 1970 00:00:00 GMT';document.cookie='vf_branch_id=;path=/;max-age=0;expires=Thu, 01 Jan 1970 00:00:00 GMT';}var qp='';try{qp=(new URLSearchParams(window.location.search).get('lang')||'').toLowerCase();}catch(_){}var ck=(document.cookie.match(/(?:^|;\\s*)(?:NEXT_LOCALE|ai-hq-locale|vf_lang)=(ar|en)(?:;|$)/)||[])[1]||'';var sl=localStorage.getItem('ai-hq-locale')||localStorage.getItem('NEXT_LOCALE')||localStorage.getItem('aetherbi_locale')||ck||'';var ssrLang=document.documentElement.lang==='en'?'en':'ar';var l=(qp==='ar'||qp==='en')?qp:(sl==='en'?'en':(sl==='ar'?'ar':ssrLang));document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr';var t=localStorage.getItem('aetherbi_theme_mode')||localStorage.getItem('ai-hq-theme')||(document.cookie.match(/(?:^|;\\s*)(?:aetherbi_theme_mode|ai-hq-theme)=([^;]+)/)||[])[1]||'light';if(t!=='dark'){t='light';}document.documentElement.dataset.theme=t;if(t==='light'){document.documentElement.classList.add('light','light-mode');document.documentElement.classList.remove('dark');}else{document.documentElement.classList.add('dark');document.documentElement.classList.remove('light','light-mode');}if(localStorage.getItem('aetherbi_rail_collapsed_v1')==='true'){document.documentElement.dataset.railCollapsed='true';}}catch(e){}})();`,
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
