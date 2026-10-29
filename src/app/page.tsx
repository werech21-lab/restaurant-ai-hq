import HomeShell from '@/components/HomeShell'
import { readSessionPermissions } from '@/lib/auth/context'
import { devOwnerEnabled } from '@/lib/auth/dev-owner'
import { loadCommandCenter } from '@/lib/command-center'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const [metrics, permissions] = await Promise.all([loadCommandCenter(), readSessionPermissions()])
  return <HomeShell metrics={metrics} signedIn={permissions.length > 0} devEntry={devOwnerEnabled()} />
}
