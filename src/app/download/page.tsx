import { Suspense } from 'react'
import { headers } from 'next/headers'
import { connection } from 'next/server'
import { DownloadView } from '@/app/download/download-view'
import { StateBlock } from '@/components/ui/state-block'
import { qrDataUrl } from '@/lib/qr'

export const metadata = {
  title: 'مركز تحميل AetherBI ERP | AetherBI Download Center',
}

async function DownloadContent() {
  await connection()
  const requestHeaders = await headers()
  const host =
    requestHeaders.get('x-forwarded-host') ||
    requestHeaders.get('host') ||
    'localhost:3000'
  const proto = requestHeaders.get('x-forwarded-proto') || 'http'
  const pageUrl = `${proto}://${host}/download`
  const qr = await qrDataUrl(pageUrl)
  return <DownloadView qrDataUrl={qr} pageUrl={pageUrl} />
}

export default function DownloadPage() {
  return (
    <Suspense
      fallback={
        <main
          className="flex min-h-screen items-center justify-center p-6"
          style={{
            backgroundColor: 'var(--ds-bg-canvas)',
            color: 'var(--ds-text-primary)',
          }}
        >
          <div className="w-full max-w-md">
            <StateBlock
              state="loading"
              locale="ar"
              title="جارٍ تحميل مركز التحميل…"
            />
          </div>
        </main>
      }
    >
      <DownloadContent />
    </Suspense>
  )
}
