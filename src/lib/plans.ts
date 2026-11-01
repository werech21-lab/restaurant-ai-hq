import { MODULES } from "@/lib/modules";

export const PLAN_LABEL: Record<string, string> = {
  STARTER: "البداية",
  PRO: "احترافية",
  ENTERPRISE: "مؤسسات",
};

export function modulesForPlan(plan: string) {
  const all = MODULES.map((item) => item.key);
  if (plan === "STARTER") return ["dashboard", "inventory", "sales", "pos", "payments"];
  if (plan === "PRO") {
    return ["dashboard", "inventory", "warehouses", "purchases", "sales", "pos", "crm", "accounting", "reports", "payments"];
  }
  return [...all];
}

export function parseModules(raw: string, plan: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string") && parsed.length > 0) {
      return parsed as string[];
    }
  } catch {
    return modulesForPlan(plan);
  }
  return modulesForPlan(plan);
}
