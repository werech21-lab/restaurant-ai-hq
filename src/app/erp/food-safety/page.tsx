import { requirePageUser } from '@/lib/auth/context'
import FoodSafetyHub from '@/modules/food-safety/ui/FoodSafetyHub'

export const dynamic = 'force-dynamic'

export default async function FoodSafetyPage() {
  await requirePageUser('/erp/food-safety')
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <FoodSafetyHub />
    </main>
  )
}
