import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  EXEC_SESSION_COOKIE,
  verifyExecSessionToken,
} from '@/lib/auth/exec-session'
import { resolveRoleDefaultHome } from '@/lib/auth/role-access-policy'

export const dynamic = 'force-dynamic'

/**
 * Root entrypoint: middleware redirects unauthenticated requests to /login
 * and authenticated requests to their role's default home route.
 */
export default async function RootPage(): Promise<never> {
  const jar = await cookies()
  const session = await verifyExecSessionToken(
    jar.get(EXEC_SESSION_COOKIE)?.value,
  )
  if (!session) {
    redirect('/login')
  }
  redirect(resolveRoleDefaultHome(session.role))
}
