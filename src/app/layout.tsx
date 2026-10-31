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
  metadataBase: new URL('https://aetherbi.com'),
  title: 'Aether BI',
  description: 'Aether BI — لوحة قيادة مجموعة المطاعم على aetherbi.com',
  openGraph: {
    title: 'Aether BI',
    description: 'Aether BI — لوحة قيادة مجموعة المطاعم على aetherbi.com',
    url: 'https://aetherbi.com',
    siteName: 'Aether BI',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const locale: Locale = cookieStore.get('ai-hq-locale')?.value === 'en' ? 'en' : 'ar'
  const theme: Theme = cookieStore.get('ai-hq-theme')?.value === 'light' ? 'light' : 'dark'

  return (
    <html lang={locale} dir={locale === 'en' ? 'ltr' : 'rtl'} data-theme={theme} className={cairo.variable} suppressHydrationWarning>
      <body className={`${cairo.className} bg-ink-950 font-cairo text-mist-100 antialiased`} suppressHydrationWarning>
        <ThemeProvider initialTheme={theme}>
          <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
