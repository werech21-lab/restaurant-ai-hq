import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createBrandHandler, listBrandsHandler } from '@/modules/org'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.orgBrandRead, listBrandsHandler)
export const POST = protectedRoute(permissions.orgBrandManage, createBrandHandler)
