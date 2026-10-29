import LoginScreen from '@/app/login/LoginForm'
import { safeNextPath } from '@/lib/safe-next'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const query = await searchParams
  const next = safeNextPath(Array.isArray(query.next) ? query.next[0] : query.next)
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-[#30363d] bg-[#1c2128] p-6">
        <LoginScreen next={next} />
      </section>
    </main>
  )
}
