import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createContractHandler, listContractsHandler } from '@/modules/operations'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.opsContractRead, listContractsHandler)
export const POST = protectedRoute(permissions.opsContractManage, createContractHandler)
