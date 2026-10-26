import { redirect } from 'next/navigation'
import ProductManager, { type ProductRow } from '@/app/admin/ProductManager'
import { createClient } from '@/lib/supabase/server'
import { supabaseEnv } from '@/lib/supabase/env'

export default async function AdminPage() {
  if (!supabaseEnv()) redirect('/login')
  const supabase = createClient()
  if (!supabase) redirect('/login')

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.from('products').select('id, name, category, price, available').order('created_at', { ascending: false })
  const products: ProductRow[] = (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    category: String(row.category),
    price: Number(row.price),
    available: Boolean(row.available),
  }))

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 sm:px-6">
      <ProductManager products={products} />
    </main>
  )
}
