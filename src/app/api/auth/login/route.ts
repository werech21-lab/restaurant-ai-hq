import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  authenticateExecutiveCredentials,
  createExecSessionToken,
  EXEC_SESSION_COOKIE,
  execCookieOptions,
  isSecureRequest,
  sanitizeExecNextPath,
  verifyExecutiveCredentials,
  type ExecSessionRole,
} from '@/lib/auth/exec-session'
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSessionToken,
} from '@/lib/session'

const ROBOTS_HEADER = 'noindex, nofollow, noarchive'
const PERMISSIONS_POLICY_HEADER =
  'camera=(self), microphone=(self), geolocation=(), browsing-topics=()'

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
        email: String(body?.email ?? '').trim().toLowerCase(),
        password: typeof body?.password === 'string' ? body.password : '',
        next: typeof body?.next === 'string' ? body.next : '',
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
        email: String(formData.get('email') ?? '').trim().toLowerCase(),
        password: String(formData.get('password') ?? ''),
        next: String(formData.get('next') ?? ''),
      }
    } catch {
      return { email: '', password: '', next: '' }
    }
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    return {
      email: String(body?.email ?? '').trim().toLowerCase(),
      password: typeof body?.password === 'string' ? body.password : '',
      next: typeof body?.next === 'string' ? body.next : '',
    }
  } catch {
    return { email: '', password: '', next: '' }
  }
}

export async function POST(request: Request) {
  const { email, password, next } = await parseLoginCredentials(request)
  const safeNext = sanitizeExecNextPath(next, '/erp')

  let authenticatedEmail: string | null = null
  let authenticatedRole: ExecSessionRole = 'executive'
  let prismaUserId: string | null = null

  if (email && password) {
    const isExecValid = await verifyExecutiveCredentials(email, password)
    if (isExecValid) {
      const matched = await authenticateExecutiveCredentials(email, password)
      if (matched.valid) {
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
            authenticatedEmail = dbUser.email.trim().toLowerCase()
            authenticatedRole = 'executive'
            prismaUserId = dbUser.id
          }
        }
      } catch {
        // Prisma SQLite may be unavailable in serverless environments; never break login.
      }
    }
  }

  if (!authenticatedEmail) {
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
        headers: {
          'X-Robots-Tag': ROBOTS_HEADER,
          'Permissions-Policy': PERMISSIONS_POLICY_HEADER,
          'Cache-Control': 'no-store',
        },
      },
    )
  }

  const isSecure = isSecureRequest(request)
  const execToken = await createExecSessionToken(
    authenticatedEmail,
    authenticatedRole,
  )
  const response = NextResponse.json(
    {
      ok: true,
      role: authenticatedRole,
      redirectTo: safeNext || '/erp',
    },
    {
      status: 200,
      headers: {
        'X-Robots-Tag': ROBOTS_HEADER,
        'Permissions-Policy': PERMISSIONS_POLICY_HEADER,
        'Cache-Control': 'no-store',
      },
    },
  )

  response.cookies.set(
    EXEC_SESSION_COOKIE,
    execToken,
    execCookieOptions(isSecure),
  )

  if (prismaUserId) {
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
