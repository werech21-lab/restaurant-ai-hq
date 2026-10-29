import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { bookAppointmentHandler, listAppointmentsHandler } from '@/modules/hr'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.hrAppointmentRead, listAppointmentsHandler)
export const POST = protectedRoute(permissions.hrAppointmentManage, bookAppointmentHandler)
