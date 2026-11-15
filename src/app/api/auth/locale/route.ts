import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { EXEC_SESSION_COOKIE, verifyExecSessionToken } from '@/lib/auth/exec-session'
import { getSavedUserLocale, saveUserLocale, type AccountLocale } from '@/lib/auth/user-locale-store'

const LOCALE_COOKIE_NAMES = ['NEXT_LOCALE', 'ai-hq-locale', 'vf_lang'] as const
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export async function GET() {
  const jar = await cookies()
  const session = await verifyExecSessionToken(jar.get(EXEC_SESSION_COOKIE)?.value)
  const accountLocale = getSavedUserLocale(session?.sub)
  const cookieRaw =
    jar.get('NEXT_LOCALE')?.value ||
    jar.get('ai-hq-locale')?.value ||
    jar.get('vf_lang')?.value
  const cookieLocale: AccountLocale | null =
    cookieRaw === 'en' || cookieRaw === 'ar' ? cookieRaw : null

  const resolved: AccountLocale = accountLocale ?? cookieLocale ?? 'ar'
  return NextResponse.json({
    ok: true,
    locale: resolved,
    accountPersisted: Boolean(accountLocale),
  })
}

export async function POST(request: NextRequest) {
  let nextLocale: AccountLocale = 'ar'
  try {
    const body = (await request.json()) as { locale?: unknown }
    if (body?.locale === 'en' || body?.locale === 'ar') {
      nextLocale = body.locale
    } else {
      return NextResponse.json({ ok: false, error: 'invalid_locale' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }

  const jar = await cookies()
  const session = await verifyExecSessionToken(jar.get(EXEC_SESSION_COOKIE)?.value)
  if (session?.sub) {
    saveUserLocale(session.sub, nextLocale)
  }

  const response = NextResponse.json({
    ok: true,
    locale: nextLocale,
    savedForAccount: session?.sub ?? null,
  })

  for (const cookieName of LOCALE_COOKIE_NAMES) {
    response.cookies.set(cookieName, nextLocale, {
      path: '/',
      maxAge: ONE_YEAR_SECONDS,
      sameSite: 'lax',
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
    })
  }

  return response
}
