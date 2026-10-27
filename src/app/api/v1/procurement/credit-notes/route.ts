import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createCreditNoteHandler, listCreditNotesHandler } from '@/modules/procurement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.procurementCreditNoteRead, listCreditNotesHandler)
export const POST = protectedRoute(permissions.procurementCreditNoteCreate, createCreditNoteHandler)
