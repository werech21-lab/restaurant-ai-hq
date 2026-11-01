import { Suspense } from "react";
import { connection } from "next/server";
import { GatewayForm } from "@/app/(panel)/settings/payments/gateway-form";
import { requireUser } from "@/lib/erp-auth";
import { Forbidden, PageHeader, PageSkeleton } from "@/components/erp-ui";
import { GATEWAY_PROVIDERS, maskSecret, parseMethods } from "@/lib/gateways";
import { can, firstAllowedHref } from "@/lib/permissions";
import { listGatewayConfigs } from "@/services/payment-gateway.service";

export const metadata = { title: "بوابات الدفع | نظام ERP" };

async function PaymentsSettingsContent() {
  await connection();
  const user = await requireUser();
  if (!can(user, "payments", "view") && !can(user, "saas", "view")) return <Forbidden href={firstAllowedHref(user)} />;
  const configs = await listGatewayConfigs();
  const byProvider = new Map(configs.map((row) => [row.provider, row]));
  const canEdit = can(user, "payments", "edit") || can(user, "saas", "edit");
  return (
    <div>
      <PageHeader
        title="بوابات الدفع"
        description="ماي فاتورة وسترايب وتاب. كي نت وفيزا وأبل باي تُفعَّل لكل بوابة. الويب هوك يتوقع الترويسة x-erp-signature."
        actions={
          <a href="/payments" className="text-sm font-semibold text-blue-700">
            روابط الدفع
          </a>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {GATEWAY_PROVIDERS.map((provider) => {
          const row = byProvider.get(provider);
          return (
            <GatewayForm
              key={provider}
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
    <Suspense fallback={<PageSkeleton title="بوابات الدفع" />}>
      <PaymentsSettingsContent />
    </Suspense>
  );
}
