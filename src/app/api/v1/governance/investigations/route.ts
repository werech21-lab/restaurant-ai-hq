import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { listInquiriesHandler, openInquiryHandler } from '@/modules/governance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.govInquiryRead, listInquiriesHandler)
export const POST = protectedRoute(permissions.govInquiryManage, openInquiryHandler)
