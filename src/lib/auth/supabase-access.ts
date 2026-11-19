import { cache } from 'react'
import { resolveAccessRole } from '@/lib/auth/role-source'
import type { ExecRole } from '@/lib/auth/exec-role-meta'
import { createClient } from '@/lib/supabase/server'

export type SupabaseExecAccess =
  | { status: 'anonymous' }
  | { status: 'rejected'; email: string | null }
  | { status: 'allowed'; userId: string; email: string | null; role: ExecRole }

/**
 * A Supabase session is not an executive session. Access is granted only when
 * the email is on the named-account allowlist or AETHER_ADMIN_EMAILS.
 * Anyone else is rejected. Public sign-ups must be disabled in the Supabase
 * dashboard; this code does not change that project setting.
 */
export const resolveSupabaseExecAccess = cache(async (): Promise<SupabaseExecAccess> => {
  try {
    const supabase = await createClient()
    if (!supabase) return { status: 'anonymous' }
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return { status: 'anonymous' }
    const email = data.user.email ?? null
    const role = resolveAccessRole({ email })
    if (!role) return { status: 'rejected', email }
    return { status: 'allowed', userId: data.user.id, email, role }
  } catch {
    return { status: 'anonymous' }
  }
})
