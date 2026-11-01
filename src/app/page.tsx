import AetherLanding from '@/components/marketing/AetherLanding'
import { getCurrentUser } from '@/lib/erp-auth'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const user = await getCurrentUser()
  return <AetherLanding signedIn={Boolean(user)} />
}
