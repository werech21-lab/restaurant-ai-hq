import { cache } from "react";
import { prisma } from "@/lib/db";
import { MODULES } from "@/lib/modules";
import { parseModules } from "@/lib/plans";

export type CompanyProfile = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  currency: string;
  taxRate: number;
  taxNumber: string;
  phone: string;
  address: string;
  invoiceFooter: string;
  enabledModules: string[];
  subscriptionEndsAt: string;
};

export const getCompany = cache(async (): Promise<CompanyProfile> => {
  const org =
    (await prisma.organization.findFirst({ where: { isDefault: true } })) ??
    (await prisma.organization.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } }));
  if (!org) {
    return {
      id: "",
      name: "مؤسسة النور",
      slug: "noor",
      plan: "ENTERPRISE",
      currency: "SAR",
      taxRate: 0,
      taxNumber: "",
      phone: "",
      address: "",
      invoiceFooter: "شكراً لتعاملكم مع مؤسسة النور",
      enabledModules: MODULES.map((item) => item.key),
      subscriptionEndsAt: "",
    };
  }
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    plan: org.plan,
    currency: org.currency,
    taxRate: org.taxRate,
    taxNumber: org.taxNumber ?? "",
    phone: org.phone ?? "",
    address: org.address ?? "",
    invoiceFooter: org.invoiceFooter ?? "",
    enabledModules: parseModules(org.enabledModules, org.plan),
    subscriptionEndsAt: org.subscriptionEndsAt ? org.subscriptionEndsAt.toISOString() : "",
  };
});
