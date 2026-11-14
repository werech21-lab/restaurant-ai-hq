import { createHash, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import {
  buildRateLimitedJsonResponse,
  ENTERPRISE_API_SECURITY_HEADERS,
  extractClientIp,
  loginAccountFailureLimiter,
  loginIpAttemptLimiter,
} from '@/lib/auth/api-guard'
import {
  authenticateExecutiveCredentials,
  createExecSessionToken,
  EXEC_SESSION_COOKIE,
  execCookieOptions,
  isSecureRequest,
  resolveExecRoleProfile,
  sanitizeExecNextPath,
  verifyExecutiveCredentials,
  type ExecSessionRole,
} from '@/lib/auth/exec-session'
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

async function parseLoginCredentials(request: Request): Promise<{
  email: string
  password: string
  next: string
}> {
  const contentType = (request.headers.get('content-type') || '').toLowerCase()

  if (contentType.includes('application/json')) {
    try {
      const body = (await request.json()) as Record<string, unknown>
      return {
        email: String(body?.email ?? '').trim().toLowerCase().slice(0, 160),
        password: typeof body?.password === 'string' ? body.password.slice(0, 256) : '',
        next: typeof body?.next === 'string' ? body.next.slice(0, 256) : '',
      }
    } catch {
      return { email: '', password: '', next: '' }
    }
  }

  if (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/x-www-form-urlencoded')
  ) {
    try {
      const formData = await request.formData()
      return {
        email: String(formData.get('email') ?? '').trim().toLowerCase().slice(0, 160),
        password: String(formData.get('password') ?? '').slice(0, 256),
        next: String(formData.get('next') ?? '').slice(0, 256),
      }
    } catch {
      return { email: '', password: '', next: '' }
    }
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    return {
      email: String(body?.email ?? '').trim().toLowerCase().slice(0, 160),
      password: typeof body?.password === 'string' ? body.password.slice(0, 256) : '',
      next: typeof body?.next === 'string' ? body.next.slice(0, 256) : '',
    }
  } catch {
    return { email: '', password: '', next: '' }
  }
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
  const ipDecision = loginIpAttemptLimiter.check(`ip:${clientIp}`)
  if (!ipDecision.allowed) {
    return buildRateLimitedJsonResponse(ipDecision.retryAfterSeconds)
  }

  const { email, password, next } = await parseLoginCredentials(request)
  const accountKey = `acct:${clientIp}:${email || 'anonymous'}`
  const blockedCheck = loginAccountFailureLimiter.peekBlocked(accountKey)
  if (blockedCheck.blocked) {
    return buildRateLimitedJsonResponse(blockedCheck.retryAfterSeconds)
  }

  const safeNext = sanitizeExecNextPath(next, '/erp')

  let authenticatedEmail: string | null = null
  let authenticatedRole: ExecSessionRole = 'admin'
  let prismaUserId: string | null = null

  if (email && password) {
    const isExecValid = await verifyExecutiveCredentials(email, password)
    if (isExecValid) {
      const matched = await authenticateExecutiveCredentials(email, password)
      if (matched.valid && constantTimeVerifyTag(matched.email, email)) {
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
          },
        })
        if (dbUser && dbUser.isActive && dbUser.passwordHash) {
          const matches = await bcrypt.compare(password, dbUser.passwordHash)
          if (matches) {
            const normalizedDbEmail = dbUser.email.trim().toLowerCase()
            authenticatedEmail = normalizedDbEmail
            authenticatedRole = normalizedDbEmail.includes('auditor') ? 'auditor' : 'admin'
            prismaUserId = dbUser.id
          }
        }
      } catch {
        // Prisma DB may be unavailable in serverless environments; never break executive login.
      }
    }
  }

  if (!authenticatedEmail) {
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

  const isSecure = isSecureRequest(request)
  const profile = resolveExecRoleProfile(authenticatedRole)
  const roleScopedRedirect = resolvePostLoginRedirectForRole(
    authenticatedRole,
    next ? safeNext : '',
  )
  const execToken = await createExecSessionToken(
    authenticatedEmail,
    authenticatedRole,
  )
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

  response.cookies.set(
    EXEC_SESSION_COOKIE,
    execToken,
    execCookieOptions(isSecure),
  )

  if (prismaUserId && authenticatedRole !== 'auditor') {
    try {
      const legacyToken = await signSessionToken(prismaUserId)
      response.cookies.set(SESSION_COOKIE, legacyToken, {
        ...sessionCookieOptions,
        secure: isSecure,
      })
    } catch {
      // Primary exec session cookie is already issued.
    }
  }

  return response
}
