import { permissions } from '@/lib/auth/permissions'
import { protectedRoute } from '@/lib/api/route'
import { createJournalEntryHandler, listJournalEntriesHandler } from '@/modules/finance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = protectedRoute(permissions.financeJournalRead, listJournalEntriesHandler)
export const POST = protectedRoute(permissions.financeJournalCreate, createJournalEntryHandler)
