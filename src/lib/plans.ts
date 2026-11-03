import { MODULES } from "@/lib/modules";

export const PLAN_LABEL: Record<string, string> = {
  ENTERPRISE: "مؤسسات",
  LIFETIME: "رخصة مؤسسية دائمة",
};

export function modulesForPlan(_plan?: string) {
  // Venture Foods Restaurant Management Co. W.L.L. owns an unrestricted enterprise lifetime license.
  return MODULES.map((item) => item.key);
}

export function parseModules(_raw?: string, _plan?: string) {
  return MODULES.map((item) => item.key);
}
