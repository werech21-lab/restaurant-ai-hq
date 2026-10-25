import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { Cairo } from 'next/font/google'
import { LanguageProvider, type Locale } from '@/lib/i18n'
import { ThemeProvider, type Theme } from '@/lib/theme'
import './globals.css'

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  display: 'swap',
  variable: '--font-cairo',
})

export const metadata: Metadata = {
  title: 'Restaurant Group AI HQ',
  description: 'المقر المركزي الذكي لإدارة مجموعة المطاعم',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale: Locale = cookies().get('ai-hq-locale')?.value === 'en' ? 'en' : 'ar'
  const theme: Theme = cookies().get('ai-hq-theme')?.value === 'light' ? 'light' : 'dark'

  return (
    <html lang={locale} dir={locale === 'en' ? 'ltr' : 'rtl'} data-theme={theme} className={cairo.variable}>
      <body className={`${cairo.className} bg-ink-950 font-cairo text-mist-100 antialiased`}>
        <ThemeProvider initialTheme={theme}>
          <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
