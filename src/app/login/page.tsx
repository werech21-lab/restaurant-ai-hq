import { LoginForm } from '@/app/login/login-form'
import { LoginHero } from '@/app/login/login-hero'

export const metadata = { title: 'Sign in | فنتشر فودز · AetherBI' }

export default function LoginPage() {
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
