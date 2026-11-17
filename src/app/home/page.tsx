import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { HomeFallback } from '@/app/home/home-fallback'
import { requireUser } from '@/lib/erp-auth'
import { firstAllowedHref } from '@/lib/permissions'

async function Go() {
  await connection()
  const user = await requireUser()
  redirect(firstAllowedHref(user))
  return null
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <Go />
    </Suspense>
  )
}
