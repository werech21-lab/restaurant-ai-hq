import { Suspense } from 'react'
import { connection } from 'next/server'
import { KdsBoard } from '@/app/(kds)/kds/kds-board'
import { requireUser } from '@/lib/erp-auth'
import { Forbidden } from '@/components/erp-ui'
import { isModuleEnabled } from '@/lib/modules-db'
import { can, firstAllowedHref } from '@/lib/permissions'

export const metadata = { title: 'Kitchen KDS | AetherBI' }
export const dynamic = 'force-dynamic'

async function KdsContent() {
  await connection()
  const user = await requireUser()
  if (!can(user, 'kds', 'view') && !can(user, 'pos', 'view')) return <Forbidden href={firstAllowedHref(user)} />
  if (!(await isModuleEnabled('kds')) && !(await isModuleEnabled('pos'))) {
    return <div className="p-8 text-center font-bold text-mist-100">شاشة المطبخ معطلة</div>
  }
  return <KdsBoard />
}

export default function KdsPage() {
  return (
    <Suspense fallback={<div className="p-8 font-bold text-mist-100">Loading KDS…</div>}>
      <KdsContent />
    </Suspense>
  )
}
