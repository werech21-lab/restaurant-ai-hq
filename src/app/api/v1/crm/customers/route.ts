import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createCustomerHandler, listCustomersHandler } from '@/modules/crm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.crmCustomerRead, listCustomersHandler)
export const POST = protectedRoute(permissions.crmCustomerCreate, createCustomerHandler)
