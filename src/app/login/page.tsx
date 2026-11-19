import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/app/login/login-form'
import { LoginHero } from '@/app/login/login-hero'
import { messageForLoginReason } from '@/app/login/login-error-message'
import {
  EXEC_SESSION_COOKIE,
  sanitizeExecNextPath,
  verifyExecSessionToken,
} from '@/lib/auth/exec-session'
import { resolvePostLoginRedirectForRole } from '@/lib/auth/role-access-policy'
import { resolveSupabaseExecAccess } from '@/lib/auth/supabase-access'
import { LanguageSwitch } from '@/lib/i18n'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'

export const metadata: Metadata = {
  title: 'تسجيل الدخول | فنتشر فودز · إيثر لذكاء الأعمال',
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
}

export const dynamic = 'force-dynamic'

type LoginPageProps = {
  searchParams?: Promise<{ next?: string | string[]; reason?: string | string[] }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined
  const rawNext = Array.isArray(resolvedParams?.next)
    ? resolvedParams?.next[0]
    : resolvedParams?.next
  const rawReason = Array.isArray(resolvedParams?.reason)
    ? resolvedParams?.reason[0]
    : resolvedParams?.reason
  const explicitNext = rawNext ? sanitizeExecNextPath(rawNext, '') : ''
  let accessDenied = messageForLoginReason(rawReason)

  try {
    const jar = await cookies()
    const existing = await verifyExecSessionToken(
      jar.get(EXEC_SESSION_COOKIE)?.value,
    )
    if (existing) {
      redirect(resolvePostLoginRedirectForRole(existing.role, explicitNext))
    }
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'digest' in err &&
      String((err as { digest?: string }).digest).startsWith('NEXT_REDIRECT')
    ) {
      throw err
    }
  }

  if (!accessDenied) {
    try {
      const access = await resolveSupabaseExecAccess()
      if (access.status === 'rejected') accessDenied = messageForLoginReason('no_access')
    } catch {
      // A missing Supabase client is a normal login page, not a crash.
    }
  }

  if (!accessDenied) {
    try {
      const jar = await cookies()
      const legacy = jar.get(SESSION_COOKIE)?.value
      if (legacy && !(await verifySessionToken(legacy))) {
        accessDenied = messageForLoginReason('no_access')
      }
    } catch {
      // Cookie store can be unavailable during static analysis.
    }
  }

  return (
    <main className="relative grid min-h-screen w-full min-w-0 overflow-x-hidden bg-[#F6F7F8] text-slate-900 dark:bg-[#090E0C] dark:text-slate-100 lg:grid-cols-2">
      {/* Prominent 1-click top-corner AR / EN language pill before sign-in */}
      <div className="fixed end-4 top-4 z-40 sm:end-6 sm:top-5">
        <LanguageSwitch />
      </div>
      <section className="flex min-w-0 items-center justify-center px-4 pb-8 pt-16 sm:px-8 lg:px-12 lg:py-8">
        <div className="w-full max-w-md min-w-0">
          <LoginForm nextPath={explicitNext} initialError={accessDenied} />
        </div>
      </section>
      <LoginHero />
    </main>
  )
}
