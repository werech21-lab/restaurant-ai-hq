'use server'

import { revalidatePath } from 'next/cache'
import * as kds from '@/services/kds.service'

export async function sendToKitchenAction(input: Parameters<typeof kds.createKitchenTicket>[0]) {
  const result = await kds.createKitchenTicket(input)
  if (result.ok) revalidatePath('/kds')
  return result
}

export async function startPrepAction(ticketId: string) {
  const result = await kds.startPrep(ticketId)
  if (result.ok) revalidatePath('/kds')
  return result
}

export async function toggleItemDoneAction(itemId: string, isDone: boolean) {
  const result = await kds.toggleItemDone(itemId, isDone)
  if (result.ok) revalidatePath('/kds')
  return result
}

export async function markReadyAction(ticketId: string) {
  const result = await kds.markReady(ticketId)
  if (result.ok) revalidatePath('/kds')
  return result
}

export async function bumpTicketAction(ticketId: string) {
  const result = await kds.bumpTicket(ticketId)
  if (result.ok) revalidatePath('/kds')
  return result
}
