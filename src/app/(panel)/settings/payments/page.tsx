import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { GatewayForm } from "@/app/(panel)/settings/payments/gateway-form";
import { Forbidden, PageHeader, PageSkeleton } from "@/components/erp-ui";
import { StateBlock } from "@/components/ui";
import { requireUser } from "@/lib/erp-auth";
import { GATEWAY_PROVIDERS, maskSecret, parseMethods } from "@/lib/gateways";
import { getLocale, tx } from "@/lib/i18n/server";
import { can, firstAllowedHref } from "@/lib/permissions";
import { listGatewayConfigs } from "@/services/payment-gateway.service";

export const metadata = { title: "بوابات الدفع | نظام ERP" };

async function PaymentsSettingsContent() {
  await connection();
  const locale = await getLocale();
  const resolvedLocale = locale === "en" ? "en" : "ar";
  const dir = resolvedLocale === "en" ? "ltr" : "rtl";
  const user = await requireUser();
  if (!can(user, "payments", "view") && !can(user, "saas", "view")) {
    return <Forbidden href={firstAllowedHref(user)} />;
  }

  let configs: Awaited<ReturnType<typeof listGatewayConfigs>> = [];
  let hasError = false;
  try {
    configs = await listGatewayConfigs();
  } catch {
    hasError = true;
  }

  if (hasError) {
    return (
      <div dir={dir} className="space-y-4">
        <PageHeader
          title={tx(resolvedLocale, "بوابات الدفع", "Payment Gateways")}
          description={tx(
            resolvedLocale,
            "ماي فاتورة وسترايب وتاب. كي نت وفيزا وأبل باي تُفعَّل لكل بوابة.",
            "MyFatoorah, Stripe, and Tap. KNET, Visa/Mastercard, and Apple Pay are configured per provider.",
          )}
        />
        <StateBlock
          state="error"
          locale={resolvedLocale}
          title={tx(resolvedLocale, "تعذّر تحميل إعدادات بوابات الدفع", "Unable to load payment gateways")}
        />
      </div>
    );
  }

  const byProvider = new Map(configs.map((row) => [row.provider, row]));
  const canEdit = can(user, "payments", "edit") || can(user, "saas", "edit");

  return (
    <div dir={dir} className="w-full max-w-none space-y-5">
      <PageHeader
        title={tx(resolvedLocale, "بوابات الدفع", "Payment Gateways")}
        description={tx(
          resolvedLocale,
          "ماي فاتورة وسترايب وتاب. كي نت وفيزا وأبل باي تُفعَّل لكل بوابة. الويب هوك يتوقع الترويسة x-erp-signature.",
          "MyFatoorah, Stripe, and Tap. Enable KNET, Visa/Mastercard, and Apple Pay per provider. Webhooks expect header x-erp-signature.",
        )}
        actions={
          <Link
            href="/payments"
            className="ds-focus-ring rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-3.5 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-500/45 dark:text-emerald-300"
          >
            {tx(resolvedLocale, "روابط الدفع", "Payment Links")}
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {GATEWAY_PROVIDERS.map((provider) => {
          const row = byProvider.get(provider);
          return (
            <GatewayForm
              key={provider}
              locale={resolvedLocale}
              provider={provider}
              maskedKey={maskSecret(row?.apiKey ?? "")}
              maskedSecret={maskSecret(row?.webhookSecret ?? "")}
              isTestMode={row?.isTestMode ?? true}
              isActive={row?.isActive ?? false}
              methods={parseMethods(row?.supportedMethods ?? "[]")}
              canEdit={canEdit}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function PaymentsSettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton title="Payment Gateways" />}>
      <PaymentsSettingsContent />
    </Suspense>
  );
}
