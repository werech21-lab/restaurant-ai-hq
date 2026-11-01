import AetherLanding from '@/components/marketing/AetherLanding'
import { getCurrentUser } from '@/lib/erp-auth'

export const dynamic = 'force-dynamic'

export default async function Home() {
  let signedIn = false
  try {
    const user = await getCurrentUser()
    signedIn = Boolean(user)
  } catch {
    // Landing must render even if Prisma/session lookup is cold or unavailable.
    signedIn = false
  }
  return <AetherLanding signedIn={signedIn} />
}
