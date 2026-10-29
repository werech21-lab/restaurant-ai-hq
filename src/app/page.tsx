import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import HomeShell from '@/components/HomeShell'
import { readSessionPermissions } from '@/lib/auth/context'
import { devOwnerEnabled, devOwnerShouldSignIn } from '@/lib/auth/dev-owner'
import { loadCommandCenter } from '@/lib/command-center'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const host = (await headers()).get('host')
  const [metrics, permissions] = await Promise.all([loadCommandCenter(), readSessionPermissions()])
  const signedIn = permissions.length > 0
  if (devOwnerShouldSignIn(signedIn, host)) redirect('/dev/owner?next=/')
  return <HomeShell metrics={metrics} signedIn={signedIn} devEntry={devOwnerEnabled()} />
}
