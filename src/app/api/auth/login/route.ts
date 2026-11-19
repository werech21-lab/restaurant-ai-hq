import { createHash, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  buildRateLimitedJsonResponse,
  ENTERPRISE_API_SECURITY_HEADERS,
  extractClientIp,
  loginAccountFailureLimiter,
  loginIpFailureLimiter,
} from '@/lib/auth/api-guard'
import {
  authenticateExecutiveCredentials,
  createExecSessionToken,
  EXEC_SESSION_COOKIE,
  execCookieOptions,
  resolveExecRoleProfile,
  sanitizeExecNextPath,
  type ExecRole,
} from '@/lib/auth/exec-session'
import { maskEmail, NO_ACCESS_REASON, resolveAccessRole } from '@/lib/auth/role-source'
import { SessionSecretMissingError } from '@/lib/auth/session-secret'
import { logger } from '@/lib/logger'
import { NO_ACCESS_MESSAGE } from '@/app/login/login-error-message'
import { resolvePostLoginRedirectForRole } from '@/lib/auth/role-access-policy'
import { checkRequestOrigin } from '@/lib/http-origin'
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSessionToken,
} from '@/lib/session'

function constantTimeVerifyTag(tagA: string, tagB: string): boolean {
  const d1 = createHash('sha256').update(tagA).digest()
  const d2 = createHash('sha256').update(tagB).digest()
  return timingSafeEqual(d1, d2) && tagA.length === tagB.length
}

async function parseJsonCredentials(request: Request): Promise<{
  email: string
  password: string
  next: string
}> {
  try {
    const body = (await request.json()) as Record<string, unknown>
    return {
      email: String(body?.email ?? '').trim().toLowerCase().slice(0, 160),
      password:
        typeof body?.password === 'string'
          ? body.password.trim().slice(0, 256)
          : '',
      next: typeof body?.next === 'string' ? body.next.trim().slice(0, 256) : '',
    }
  } catch {
    return { email: '', password: '', next: '' }
  }
}

async function parseLoginCredentials(request: Request): Promise<{
  email: string
  password: string
  next: string
}> {
  const contentType = (request.headers.get('content-type') || '').toLowerCase()

  if (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/x-www-form-urlencoded')
  ) {
    try {
      const formData = await request.formData()
      return {
        email: String(formData.get('email') ?? '').trim().toLowerCase().slice(0, 160),
        password: String(formData.get('password') ?? '').trim().slice(0, 256),
        next: String(formData.get('next') ?? '').trim().slice(0, 256),
      }
    } catch {
      return { email: '', password: '', next: '' }
    }
  }

  return parseJsonCredentials(request)
}

export async function POST(request: NextRequest) {
  // Refuse cross-site login CSRF when browser Origin / Sec-Fetch-Site headers are present
  const hasOriginMeta =
    Boolean(request.headers.get('origin')) || Boolean(request.headers.get('sec-fetch-site'))
  if (hasOriginMeta) {
    const originVerdict = checkRequestOrigin(request)
    if (!originVerdict.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Cross-origin login refused',
          errorAr: 'تم رفض طلب تسجيل الدخول من مصدر خارجي غير مصرح به.',
        },
        { status: 403, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }
  }

  const clientIp = extractClientIp(request)
  const ipKey = `ip:${clientIp}`
  const ipBlocked = loginIpFailureLimiter.peekBlocked(ipKey)
  if (ipBlocked.blocked) {
    return buildRateLimitedJsonResponse(ipBlocked.retryAfterSeconds)
  }

  const { email, password, next } = await parseLoginCredentials(request)
  const accountKey = `acct:${clientIp}:${email || 'anonymous'}`
  const blockedCheck = loginAccountFailureLimiter.peekBlocked(accountKey)
  if (blockedCheck.blocked) {
    return buildRateLimitedJsonResponse(blockedCheck.retryAfterSeconds)
  }

  const safeNext = sanitizeExecNextPath(next, '/erp')

  let authenticatedEmail: string | null = null
  let authenticatedRole: ExecRole | null = null
  let prismaUserId: string | null = null
  let passwordMatchedWithoutRole: string | null = null

  if (email && password) {
    const matched = await authenticateExecutiveCredentials(email, password)
    if (matched.valid) {
      if (constantTimeVerifyTag(matched.email, email)) {
        authenticatedEmail = matched.email
        authenticatedRole = matched.role
      }
    } else if (password.length >= 8 && email !== 'admin@aetherbi.com') {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            isActive: true,
            passwordHash: true,
            role: { select: { name: true, isAdmin: true } },
          },
        })
        if (dbUser && dbUser.isActive && dbUser.passwordHash) {
          const matches = await bcrypt.compare(password, dbUser.passwordHash)
          if (matches) {
            const normalizedDbEmail = dbUser.email.trim().toLowerCase()
            const role = resolveAccessRole({
              email: normalizedDbEmail,
              roleName: dbUser.role?.name,
              isAdmin: dbUser.role?.isAdmin,
            })
            if (role) {
              authenticatedEmail = normalizedDbEmail
              authenticatedRole = role
              prismaUserId = dbUser.id
            } else {
              passwordMatchedWithoutRole = normalizedDbEmail
            }
          }
        }
      } catch {
        // Prisma DB may be unavailable in serverless environments; never break executive login.
      }
    }
  }

  if (passwordMatchedWithoutRole && !authenticatedRole) {
    logger.warn('access_role_missing', { email: maskEmail(passwordMatchedWithoutRole) })
    return NextResponse.json(
      {
        ok: false,
        reason: NO_ACCESS_REASON,
        errorAr: NO_ACCESS_MESSAGE.ar,
        errorEn: NO_ACCESS_MESSAGE.en,
      },
      { status: 403, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  if (!authenticatedEmail || !authenticatedRole) {
    loginIpFailureLimiter.check(ipKey)
    const failDecision = loginAccountFailureLimiter.check(accountKey)
    if (!failDecision.allowed) {
      return buildRateLimitedJsonResponse(failDecision.retryAfterSeconds)
    }
    return NextResponse.json(
      {
        ok: false,
        errorAr:
          'بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.',
        errorEn:
          'Invalid credentials. Please check your email and password.',
      },
      {
        status: 401,
        headers: ENTERPRISE_API_SECURITY_HEADERS,
      },
    )
  }

  loginAccountFailureLimiter.reset(accountKey)

  const isProduction = process.env.NODE_ENV === 'production'
  const profile = resolveExecRoleProfile(authenticatedRole)
  const roleScopedRedirect = resolvePostLoginRedirectForRole(
    authenticatedRole,
    next ? safeNext : '',
  )
  let execToken: string
  try {
    execToken = await createExecSessionToken(authenticatedEmail, authenticatedRole)
  } catch (err) {
    if (err instanceof SessionSecretMissingError) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Authentication is not configured.',
          errorAr: 'تسجيل الدخول غير مهيأ على الخادم. راجع مسؤول النظام.',
        },
        { status: 503, headers: ENTERPRISE_API_SECURITY_HEADERS },
      )
    }
    throw err
  }
  const response = NextResponse.json(
    {
      ok: true,
      role: authenticatedRole,
      nameAr: profile.nameAr,
      nameEn: profile.nameEn,
      titleAr: profile.titleAr,
      titleEn: profile.titleEn,
      redirectTo: roleScopedRedirect,
    },
    {
      status: 200,
      headers: ENTERPRISE_API_SECURITY_HEADERS,
    },
  )

  response.cookies.set(EXEC_SESSION_COOKIE, execToken, execCookieOptions(isProduction))

  if (prismaUserId && authenticatedRole !== 'auditor') {
    try {
      const legacyToken = await signSessionToken(prismaUserId, authenticatedRole)
      response.cookies.set(SESSION_COOKIE, legacyToken, {
        ...sessionCookieOptions,
        secure: isProduction,
      })
    } catch {
      // Primary exec session cookie is already issued.
    }
  }

  return response
}
