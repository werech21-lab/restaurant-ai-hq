import AetherLanding from '@/components/marketing/AetherLanding'
import { readSessionPermissions } from '@/lib/auth/context'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const permissions = await readSessionPermissions()
  return <AetherLanding signedIn={permissions.length > 0} />
}
