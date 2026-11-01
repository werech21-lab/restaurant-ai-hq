import { createHash } from 'crypto'
import { getCurrentUser } from '@/lib/erp-auth'
import { permissions } from '@/lib/auth/permissions'
import { db } from '@/lib/pg'
import type { AccessUser } from '@/lib/permissions'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Deterministic UUID for panel→Postgres bridge (does not create a Supabase user). */
export function panelBridgeUserId(panelUserId: string): string {
  const hex = createHash('sha256').update(`aether-panel-bridge:${panelUserId}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export async function getPanelSessionUser(): Promise<AccessUser | null> {
  try {
    return await getCurrentUser()
  } catch {
    return null
  }
}

export function panelBridgePermissionSet(): ReadonlySet<string> {
  return new Set(Object.values(permissions))
}

/** Active tenant for panel admins: env override, else first active company. */
export async function resolvePanelBridgeTenantId(): Promise<string | null> {
  const fromEnv = process.env.AETHER_BRIDGE_TENANT_ID?.trim()
  if (fromEnv && UUID_RE.test(fromEnv)) return fromEnv
  try {
    const result = await db.query<{ id: string }>(
      `select id::text as id from tenants where status = 'active' order by created_at asc nulls last limit 1`,
    )
    return result.rows[0]?.id ?? null
  } catch {
    return null
  }
}
