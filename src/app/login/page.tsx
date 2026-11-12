import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/app/login/login-form'
import { LoginHero } from '@/app/login/login-hero'
import {
  EXEC_SESSION_COOKIE,
  sanitizeExecNextPath,
  verifyExecSessionToken,
} from '@/lib/auth/exec-session'

export const metadata: Metadata = {
  title: 'Sign in | Venture Foods · Aether BI',
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
  searchParams?: Promise<{ next?: string | string[] }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined
  const rawNext = Array.isArray(resolvedParams?.next)
    ? resolvedParams?.next[0]
    : resolvedParams?.next
  const safeNext = sanitizeExecNextPath(rawNext, '/erp')

  try {
    const jar = await cookies()
    const existing = await verifyExecSessionToken(
      jar.get(EXEC_SESSION_COOKIE)?.value,
    )
    if (existing) {
      redirect(safeNext)
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

  return (
    <main className="grid min-h-screen w-full min-w-0 overflow-x-hidden bg-[#F6F7F8] text-slate-900 dark:bg-[#090F15] dark:text-slate-100 lg:grid-cols-2">
      <section className="flex min-w-0 items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
        <div className="w-full max-w-md min-w-0">
          <LoginForm nextPath={safeNext} />
        </div>
      </section>
      <LoginHero />
    </main>
  )
}
