import LoginScreen from '@/app/login/LoginForm'
import { safeNextPath } from '@/lib/safe-next'
import { supabaseEnv } from '@/lib/supabase/env'

export default function LoginPage({ searchParams }: { searchParams: { next?: string | string[] } }) {
  const next = safeNextPath(Array.isArray(searchParams.next) ? searchParams.next[0] : searchParams.next)
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-[#30363d] bg-[#1c2128] p-6">
        <LoginScreen ready={Boolean(supabaseEnv())} next={next} />
      </section>
    </main>
  )
}
