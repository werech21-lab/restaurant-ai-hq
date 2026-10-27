import { sessionRoute } from '@/lib/api/route'
import { acceptInvitationHandler } from '@/lib/iam/handlers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Signed-in session only: the person has no company yet. The token, the confirmed email and the company's own rules decide. */
export const POST = sessionRoute(acceptInvitationHandler)
