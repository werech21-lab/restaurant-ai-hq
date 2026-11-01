import { Suspense } from "react";
import { connection } from "next/server";
import { PayCheckout } from "@/app/pay/[token]/pay-checkout";
import { cardClass } from "@/components/erp-ui";
import { getCompany } from "@/lib/company";
import { STATUS_LABEL, formatMoney } from "@/lib/format";
import { PROVIDER_LABEL } from "@/lib/gateways";
import { getPublicPayment } from "@/services/payment-gateway.service";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { payLinkText, payUrl, waLink } from "@/lib/whatsapp";

export const metadata = { title: "دفع إلكتروني | نظام ERP" };

async function PayContent({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const company = await getCompany();
  const payment = await getPublicPayment(token);
  if (!payment) {
    return (
      <section className={`${cardClass} mx-auto max-w-lg p-8 text-center`}>
        <h1 className="text-xl font-bold">رابط الدفع غير موجود</h1>
      </section>
    );
  }
  const { link } = payment;
  const title = link.invoice ? `فاتورة ${link.invoice.invoiceNumber}` : link.organization ? `اشتراك ${link.organization.name}` : "عملية دفع";
  const party = link.invoice?.customer.name ?? company.name;
  return (
    <section className={`${cardClass} mx-auto max-w-lg p-6`}>
      <p className="text-sm font-semibold text-blue-700">{company.name}</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">دفع إلكتروني</h1>
      <p className="mt-2 text-sm text-slate-600">{title}</p>
      <p className="text-sm text-slate-600">{party}</p>
      <p className="mt-4 text-3xl font-bold text-slate-900">{formatMoney(link.amount, link.currency)}</p>
      <p className="mt-1 text-sm text-slate-500">
        {PROVIDER_LABEL[link.gatewayProvider] ?? link.gatewayProvider} • {STATUS_LABEL[link.status] ?? link.status}
      </p>
      {link.invoice?.customer.phone ? (
        <div className="mt-4">
          <WhatsAppButton
            label="إرسال رابط الدفع عبر واتساب"
            href={waLink(
              link.invoice.customer.phone,
              payLinkText({
                name: link.invoice.customer.name,
                number: link.invoice.invoiceNumber,
                amount: formatMoney(link.amount, link.currency),
                url: payUrl(link.token),
              }),
            )}
          />
        </div>
      ) : null}
      <div className="mt-5">
        {link.status === "EXPIRED" ? (
          <p className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white">انتهت صلاحية الرابط. اطلب رابطاً جديداً.</p>
        ) : (
          <PayCheckout
            token={link.token}
            methods={payment.methods}
            isTestMode={payment.isTestMode}
            providerActive={payment.providerActive}
            paid={link.status === "PAID"}
          />
        )}
      </div>
    </section>
  );
}

export default function PublicPayPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <Suspense fallback={<p className="text-center text-sm font-semibold text-slate-600">جارٍ تحميل صفحة الدفع...</p>}>
        <PayContent params={params} />
      </Suspense>
    </main>
  );
}
