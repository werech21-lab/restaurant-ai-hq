import { EssPortalClient } from './ess-client'

export const metadata = { title: 'Employee Self-Service | Venture Foods' }

export default function EssPage() {
  return (
    <main
      className="min-h-screen px-4 py-6 sm:py-8"
      style={{
        backgroundColor: 'var(--ds-bg-canvas)',
        color: 'var(--ds-text-primary)',
      }}
    >
      <div className="mx-auto w-full max-w-lg min-w-0">
        <EssPortalClient />
      </div>
    </main>
  )
}
