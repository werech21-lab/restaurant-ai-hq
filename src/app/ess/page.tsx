import { EssPortalClient } from './ess-client'

export const metadata = { title: 'Employee Self-Service | Venture Foods' }

export default function EssPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-emerald-50/40 px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        <EssPortalClient />
      </div>
    </main>
  )
}
