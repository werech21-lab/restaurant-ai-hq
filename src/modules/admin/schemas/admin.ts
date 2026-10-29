import { z } from 'zod'
import { flagKeys } from '@/lib/auth/member-flags'

export const accountStatuses = ['active', 'suspended', 'revoked', 'deleted'] as const
export const adminRoles = ['owner', 'admin', 'manager', 'accountant', 'operations', 'viewer', 'approver'] as const
export const activityModules = ['finance', 'inventory', 'procurement', 'sales', 'kitchen', 'delivery', 'ai', 'admin', 'hr', 'operations'] as const

export const permissionFlagsSchema = z.object({
  can_approve_po: z.boolean(),
  can_post_journal: z.boolean(),
  can_manage_users: z.boolean(),
  can_execute_ai: z.boolean(),
  can_export_reports: z.boolean(),
  can_approve_invoice: z.boolean(),
  can_manage_inventory: z.boolean(),
}).strict()

export const createAccountSchema = z.object({
  email: z.string().trim().email().max(254),
  displayName: z.string().trim().min(1).max(200),
  role: z.enum(adminRoles),
  flags: permissionFlagsSchema.optional(),
  branchScope: z.string().uuid().nullable().optional(),
}).strict()

export const updateAccountSchema = z.object({
  version: z.number().int().nonnegative(),
  role: z.enum(adminRoles).optional(),
  status: z.enum(accountStatuses).optional(),
  flags: permissionFlagsSchema.optional(),
  branchScope: z.string().uuid().nullable().optional(),
}).strict()

export const userParamsSchema = z.object({ userId: z.string().uuid() }).strict()

export const listActivityQuerySchema = z.object({
  module: z.enum(activityModules).optional(),
  q: z.string().trim().max(80).optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
}).strict()

export const updateSecuritySchema = z.object({
  version: z.number().int().nonnegative(),
  sessionMinutes: z.number().int().min(15).max(720),
  booksLocked: z.boolean(),
}).strict()

export type CreateAccountInput = z.infer<typeof createAccountSchema>
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>
export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>
export type UpdateSecurityInput = z.infer<typeof updateSecuritySchema>

export const storedFlagKeys: readonly string[] = flagKeys
