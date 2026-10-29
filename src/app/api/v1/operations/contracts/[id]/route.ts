import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { updateContractHandler } from '@/modules/operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const PATCH = protectedRoute(permissions.opsContractManage, updateContractHandler)
