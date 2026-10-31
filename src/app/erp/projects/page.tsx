import { readSessionPermissions, requirePageUser } from '@/lib/auth/context'
import ProjectsHub from '@/modules/suite/ui/ProjectsHub'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  await requirePageUser('/erp/projects')
  const permissions = await readSessionPermissions()
  const query = await searchParams
  const tab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <ProjectsHub permissions={permissions} initialTab={tab ?? 'project'} />
    </main>
  )
}
