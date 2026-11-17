import { Suspense } from 'react'
import { connection } from 'next/server'
import { PayView } from '@/app/pay/[token]/pay-view'
import { StateBlock } from '@/components/ui/state-block'
import { getCompany } from '@/lib/company'
import { formatKwd } from '@/lib/format'
import { getLocale } from '@/lib/i18n/server'
import { payLinkText, payUrl, waLink } from '@/lib/whatsapp'
import { getPublicPayment } from '@/services/payment-gateway.service'

export const metadata = {
  title: 'دفع إلكتروني | AetherBI Online Payment',
}

const LINK_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000

async function PayContent({ params }: { params: Promise<{ token: string }> }) {
  await connection()
  const [{ token }, locale, company] = await Promise.all([
    params,
    getLocale(),
    getCompany(),
  ])

  let payment: Awaited<ReturnType<typeof getPublicPayment>> = null
  try {
    payment = await getPublicPayment(token)
  } catch {
    return <PayView state="error" />
  }

  if (!payment) {
    return <PayView state="notFound" />
  }

  const { link } = payment
  const titleAr = link.invoice
    ? `فاتورة ${link.invoice.invoiceNumber}`
    : link.organization
      ? `اشتراك ${link.organization.name}`
      : 'عملية دفع'
  const titleEn = link.invoice
    ? `Invoice ${link.invoice.invoiceNumber}`
    : link.organization
      ? `Subscription · ${link.organization.name}`
      : 'Payment'
  const partyName = link.invoice?.customer.name ?? company.name
  const expiresAt = new Date(link.createdAt.getTime() + LINK_VALIDITY_MS)
  const formattedForWa = formatKwd(link.amount, locale)
  const whatsappHref = link.invoice?.customer.phone
    ? waLink(
        link.invoice.customer.phone,
        payLinkText({
          name: link.invoice.customer.name,
          number: link.invoice.invoiceNumber,
          amount: formattedForWa,
          url: payUrl(link.token),
        }),
      )
    : undefined

  return (
    <PayView
      state="ready"
      data={{
        token: link.token,
        companyName: company.name,
        titleAr,
        titleEn,
        partyName,
        amount: link.amount,
        gatewayProvider: link.gatewayProvider,
        status: link.status,
        createdAtIso: link.createdAt.toISOString(),
        paidAtIso: link.paidAt ? link.paidAt.toISOString() : null,
        expiresAtIso: expiresAt.toISOString(),
        methods: payment.methods,
        isTestMode: payment.isTestMode,
        providerActive: payment.providerActive,
        whatsappHref: whatsappHref || undefined,
      }}
    />
  )
}

export default function PublicPayPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
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
              title="جارٍ تحميل صفحة الدفع…"
            />
          </div>
        </main>
      }
    >
      <PayContent params={params} />
    </Suspense>
  )
}
