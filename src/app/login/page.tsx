import { LoginForm } from '@/app/login/login-form'
import { LoginHero } from '@/app/login/login-hero'
import { ensureOfficialAdmin } from '@/lib/ensure-official-admin'

export const metadata = { title: 'Sign in | Venture Foods · AetherBI' }
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  try {
    await ensureOfficialAdmin()
  } catch {
    // DB may be warming; login form still works for existing users.
  }
  return (
    <div className="grid min-h-screen bg-ink-950 text-mist-100 lg:grid-cols-2">
      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </section>
      <LoginHero />
    </div>
  )
}
