export const MODULES = [
  { key: "dashboard", label: "لوحة التحكم", href: "/dashboard" },
  { key: "users", label: "المستخدمون", href: "/users" },
  { key: "roles", label: "الأدوار والصلاحيات", href: "/roles" },
  { key: "inventory", label: "المخزون", href: "/inventory" },
  { key: "warehouses", label: "المستودعات", href: "/warehouses" },
  { key: "purchases", label: "المشتريات", href: "/purchases" },
  { key: "sales", label: "المبيعات", href: "/sales" },
  { key: "crm", label: "علاقات العملاء", href: "/crm" },
  { key: "pos", label: "نقطة البيع", href: "/pos" },
  { key: "hr", label: "الموارد البشرية", href: "/hr" },
  { key: "accounting", label: "المحاسبة", href: "/accounting" },
  { key: "automations", label: "الأتمتة", href: "/automations" },
  { key: "app-builder", label: "مدير التطبيقات", href: "/app-builder" },
  { key: "reports", label: "التقارير", href: "/reports" },
  { key: "audit", label: "سجل الرقابة", href: "/audit" },
  { key: "saas", label: "المنصة والاشتراكات", href: "/saas" },
  { key: "payments", label: "المدفوعات الإلكترونية", href: "/payments" },
] as const;

export const LOCKED_MODULES = ["dashboard", "users", "roles", "app-builder"] as const;

export type ModuleKey = (typeof MODULES)[number]["key"];
export type PermissionAction = "view" | "create" | "edit" | "delete";

export const MODULE_KEYS: ModuleKey[] = MODULES.map((item) => item.key);
