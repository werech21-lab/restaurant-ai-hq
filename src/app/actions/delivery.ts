'use server'

import { revalidatePath } from 'next/cache'
import * as delivery from '@/services/delivery.service'

export async function updatePlatformAction(input: Parameters<typeof delivery.updatePlatform>[0]) {
  const result = await delivery.updatePlatform(input)
  if (result.ok) revalidatePath('/delivery-hub')
  return result
}

export async function settlePlatformAction(input: { platformCode: string; brandCode?: string | null }) {
  const result = await delivery.settlePlatform(input)
  if (result.ok) {
    revalidatePath('/delivery-hub')
    revalidatePath('/accounting')
  }
  return result
}
