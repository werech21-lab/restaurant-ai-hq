'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ProductInput = {
  name: string
  category: string
  price: string
  available: boolean
}

export type ActionResult = { ok: true } | { ok: false; error: 'name' | 'price' | 'request' | 'config' }

function parsed(input: ProductInput): { error: 'name' | 'price' } | { value: { name: string; category: string; price: number; available: boolean } } {
  const name = input.name.trim()
  const category = input.category.trim() || 'عام'
  const price = Number(input.price)
  if (!name) return { error: 'name' }
  if (!Number.isFinite(price) || price < 0) return { error: 'price' }
  return { value: { name, category, price, available: input.available } }
}

export async function saveProduct(input: ProductInput, id?: string): Promise<ActionResult> {
  const supabase = createClient()
  if (!supabase) return { ok: false, error: 'config' }
  const result = parsed(input)
  if ('error' in result) return { ok: false, error: result.error }

  const query = id
    ? supabase.from('products').update(result.value).eq('id', id)
    : supabase.from('products').insert(result.value)
  const { error } = await query
  if (error) return { ok: false, error: 'request' }
  revalidatePath('/admin')
  return { ok: true }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const supabase = createClient()
  if (!supabase) return { ok: false, error: 'config' }
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) return { ok: false, error: 'request' }
  revalidatePath('/admin')
  return { ok: true }
}

export async function signOut() {
  const supabase = createClient()
  if (supabase) await supabase.auth.signOut()
  redirect('/login')
}
