import type { Prisma } from "@prisma/client";
import { MODULES } from "../src/lib/modules";
import { round2 } from "../src/lib/format";
import { postPurchaseJournal, postSaleJournals, postPayrollJournal } from "../src/services/accounting.engine";
import { payrollMath } from "../src/services/hr.engine";
import { modulesForPlan } from "../src/lib/plans";
import { runLowStockRules } from "../src/services/automation.engine";
import { adjustWarehouseStock } from "../src/services/warehouse.engine";

type Tx = Prisma.TransactionClient;

const CHART: Array<{ code: string; name: string; type: string; parent?: string }> = [
  { code: "1000", name: "الأصول", type: "ASSET" },
  { code: "1100", name: "الصندوق", type: "ASSET", parent: "1000" },
  { code: "1200", name: "البنك والبطاقات", type: "ASSET", parent: "1000" },
  { code: "1300", name: "العملاء", type: "ASSET", parent: "1000" },
  { code: "1400", name: "المخزون", type: "ASSET", parent: "1000" },
  { code: "2000", name: "الخصوم", type: "LIABILITY" },
  { code: "2100", name: "الموردون", type: "LIABILITY", parent: "2000" },
  { code: "2200", name: "ضريبة القيمة المضافة", type: "LIABILITY", parent: "2000" },
  { code: "3000", name: "حقوق الملكية", type: "EQUITY" },
  { code: "3100", name: "رأس المال", type: "EQUITY", parent: "3000" },
  { code: "4000", name: "الإيرادات", type: "REVENUE" },
  { code: "4100", name: "إيراد المبيعات", type: "REVENUE", parent: "4000" },
  { code: "5000", name: "المصروفات", type: "EXPENSE" },
  { code: "5100", name: "تكلفة المبيعات", type: "EXPENSE", parent: "5000" },
  { code: "5200", name: "مصروف الرواتب", type: "EXPENSE", parent: "5000" },
];

const MODULE_COPY: Record<string, string> = {
  dashboard: "مؤشرات المبيعات والمشتريات والربح",
  users: "حسابات الموظفين",
  roles: "مصفوفة الصلاحيات",
  inventory: "الأصناف والحركات وحد الطلب",
  warehouses: "الفروع والتحويل المخزني",
  purchases: "أوامر الشراء والموردون",
  sales: "فواتير البيع والعملاء",
  pos: "كاشير المبيعات السريعة",
  accounting: "شجرة الحسابات وقيود اليومية",
  crm: "الفرص البيعية وعروض الأسعار",
  hr: "الموظفون والحضور والرواتب",
  saas: "الشركات والباقات والاشتراكات",
  payments: "روابط الدفع وبوابات كي نت وفيزا وأبل باي",
  automations: "قواعد التشغيل الآلي",
  "app-builder": "تفعيل الوحدات والحقول المخصصة",
  reports: "الأرباح والديون وتقييم المخزون",
  audit: "سجل نشاط الموظفين",
};

export async function seedEnterprise(tx: Tx, adminId: string) {
  const ids = new Map<string, string>();
  for (const account of CHART) {
    const created = await tx.account.create({
      data: {
        code: account.code,
        name: account.name,
        type: account.type,
        parentId: account.parent ? ids.get(account.parent) : undefined,
        balance: 0,
      },
    });
    ids.set(account.code, created.id);
  }

  const invoices = await tx.salesInvoice.findMany({ include: { items: { include: { product: true } } } });
  for (const invoice of invoices) {
    const due = round2(invoice.totalAmount - invoice.paidAmount);
    const cogs = round2(invoice.items.reduce((sum, item) => sum + item.quantity * item.product.costPrice, 0));
    const paymentMethod = invoice.paidAmount <= 0.001 ? "CREDIT" : due <= 0.001 ? "CASH" : "MIXED";
    await postSaleJournals(tx, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.totalAmount,
      paid: invoice.paidAmount,
      due,
      cogs,
      paymentMethod,
      createdById: adminId,
      date: invoice.createdAt,
    });
  }

  const orders = await tx.purchaseOrder.findMany();
  for (const order of orders) {
    if (order.status === "DRAFT") continue;
    const due = round2(order.totalAmount - order.paidAmount);
    await postPurchaseJournal(tx, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.totalAmount,
      paid: order.paidAmount,
      due,
      createdById: adminId,
      date: order.createdAt,
    });
  }

  const main = await tx.warehouse.create({
    data: { name: "المستودع المركزي — الشويخ", location: "الكويت · الشويخ الصناعية", managerName: "خالد أمين المخزن", isDefault: true },
  });
  const branch = await tx.warehouse.create({
    data: { name: "مخزن فروع حولي", location: "الكويت · حولي", managerName: "ليلى المبيعات", isDefault: false },
  });
  const products = await tx.product.findMany();
  for (const product of products) {
    if (product.currentStock > 0) {
      await tx.warehouseStock.create({
        data: { warehouseId: main.id, productId: product.id, quantity: product.currentStock },
      });
    }
  }
  await tx.salesInvoice.updateMany({ data: { warehouseId: main.id } });
  await tx.stockMovement.updateMany({ data: { warehouseId: main.id } });

  const mouse = products.find((product) => product.code === "EL-1003");
  if (mouse && mouse.currentStock >= 10) {
    await adjustWarehouseStock(tx, main.id, mouse.id, -10);
    await adjustWarehouseStock(tx, branch.id, mouse.id, 10);
    await tx.stockTransfer.create({
      data: {
        transferNumber: "TR-00001",
        fromWarehouseId: main.id,
        toWarehouseId: branch.id,
        note: "تحويل افتتاحي لفرع المبيعات",
        createdById: adminId,
        items: { create: [{ productId: mouse.id, quantity: 10 }] },
      },
    });
    await tx.stockMovement.create({
      data: {
        productId: mouse.id,
        type: "TRANSFER_OUT",
        quantity: 10,
        balanceAfter: mouse.currentStock,
        reference: "TR-00001",
        note: "تحويل إلى فرع المبيعات",
        warehouseId: main.id,
        createdById: adminId,
      },
    });
    await tx.stockMovement.create({
      data: {
        productId: mouse.id,
        type: "TRANSFER_IN",
        quantity: 10,
        balanceAfter: mouse.currentStock,
        reference: "TR-00001",
        note: "تحويل من المستودع الرئيسي",
        warehouseId: branch.id,
        createdById: adminId,
      },
    });
  }

  for (const module of MODULES) {
    await tx.appModule.create({
      data: {
        key: module.key,
        name: module.label,
        description: MODULE_COPY[module.key] ?? module.label,
        isEnabled: true,
      },
    });
  }

  await tx.customFieldDefinition.create({
    data: { entityType: "PRODUCT", fieldName: "تاريخ انتهاء الصلاحية", fieldType: "DATE" },
  });
  await tx.customFieldDefinition.create({
    data: { entityType: "CUSTOMER", fieldName: "الرقم الضريبي", fieldType: "TEXT" },
  });
  await tx.product.update({
    where: { code: "FD-3002" },
    data: { customData: JSON.stringify({ "تاريخ انتهاء الصلاحية": "2027-06-30" }) },
  });
  await tx.customer.update({
    where: { id: (await tx.customer.findFirstOrThrow({ where: { name: "كاترينغ الأعمال — السالمية" } })).id },
    data: { customData: JSON.stringify({ "الرقم الضريبي": "KW-VF-2026-001" }) },
  });
  await tx.customer.create({
    data: { name: "عميل نقدي - الصندوق", phone: "", email: "", balance: 0 },
  });

  const supplier = await tx.supplier.findFirstOrThrow({ where: { name: "تموينات فنتشر المركزية" } });
  await tx.automationRule.create({
    data: {
      name: "إعادة طلب عند النقص",
      trigger: "STOCK_BELOW_REORDER",
      action: "DRAFT_PURCHASE",
      supplierId: supplier.id,
      isActive: true,
    },
  });
  const lowProducts = products.filter((product) => product.currentStock <= product.reorderLevel + 0.0001);
  for (const product of lowProducts) {
    await runLowStockRules(tx, product.id, adminId);
  }

  const ends = new Date("2027-10-31T00:00:00.000Z");
  await tx.organization.create({
    data: {
      name: "شركة فنتشر فودز لإدارة المطاعم ذ.م.م.",
      slug: "venture-foods",
      plan: "ENTERPRISE",
      currency: "KWD",
      taxRate: 0,
      taxNumber: "KW-VF-2026-001",
      phone: "+96522000000",
      address: "دولة الكويت",
      invoiceFooter: "شكراً لتعاملكم مع شركة فنتشر فودز لإدارة المطاعم ذ.م.م.",
      enabledModules: JSON.stringify(modulesForPlan("ENTERPRISE")),
      isDefault: true,
      isActive: true,
      subscriptionEndsAt: ends,
    },
  });
  await tx.organization.create({
    data: {
      name: "فنتشر فودز — فرع تشاينا جاردن",
      slug: "china-garden-kw",
      plan: "PRO",
      currency: "KWD",
      taxRate: 0,
      taxNumber: "KW-VF-CG-01",
      address: "الكويت · السالمية",
      enabledModules: JSON.stringify(modulesForPlan("PRO")),
      isActive: true,
      subscriptionEndsAt: new Date("2027-03-01T00:00:00.000Z"),
    },
  });
  await tx.organization.create({
    data: {
      name: "فنتشر فودز — كرك كافتيريا",
      slug: "karak-cafeteria-kw",
      plan: "STARTER",
      currency: "KWD",
      taxRate: 0,
      enabledModules: JSON.stringify(modulesForPlan("STARTER")),
      isActive: true,
      subscriptionEndsAt: new Date("2026-12-31T00:00:00.000Z"),
    },
  });

  const schoolLead = await tx.lead.create({
    data: {
      title: "عقد كاترينغ شركات — مدينة الكويت",
      contactName: "مدير المشتريات",
      phone: "55000111",
      email: "corporate-lead@venturefoods.kw",
      expectedValue: 4500,
      stage: "PROPOSAL",
      assignedToId: adminId,
      notes: "عرض توريد يومي لفروع المكاتب",
    },
  });
  await tx.lead.create({
    data: {
      title: "توريد مركزي لفروع حولي",
      contactName: "كاترينغ الأعمال — السالمية",
      phone: "0551112233",
      expectedValue: 8000,
      stage: "QUALIFIED",
      assignedToId: adminId,
    },
  });
  await tx.lead.create({
    data: { title: "مناقصة بلدية", contactName: "لجنة المشتريات", expectedValue: 42000, stage: "NEW", assignedToId: adminId },
  });
  await tx.lead.create({
    data: { title: "صفقة ملغاة", contactName: "عميل سابق", expectedValue: 1200, stage: "LOST", assignedToId: adminId },
  });

  const rowad = await tx.customer.findFirst({ where: { name: "مكتب رواد الأعمال" } });
  const laptop = products.find((product) => product.code === "EL-1001");
  const quoteMouse = products.find((product) => product.code === "EL-1003");
  if (rowad && laptop) {
    await tx.quotation.create({
      data: {
        quoteNumber: "QT-00001",
        customerId: rowad.id,
        leadId: schoolLead.id,
        totalAmount: laptop.sellingPrice,
        validUntil: new Date("2026-12-31T00:00:00.000Z"),
        status: "SENT",
        notes: "عرض لابتوب واحد، الأسعار لا تشمل ضريبة الشركة",
        createdById: adminId,
        items: {
          create: [{ productId: laptop.id, quantity: 1, unitPrice: laptop.sellingPrice, totalPrice: laptop.sellingPrice }],
        },
      },
    });
  }
  if (quoteMouse) {
    await tx.quotation.create({
      data: {
        quoteNumber: "QT-00002",
        leadId: schoolLead.id,
        totalAmount: round2(quoteMouse.sellingPrice * 10),
        status: "DRAFT",
        notes: "عرض ماوس للفرع",
        createdById: adminId,
        items: {
          create: [{ productId: quoteMouse.id, quantity: 10, unitPrice: quoteMouse.sellingPrice, totalPrice: round2(quoteMouse.sellingPrice * 10) }],
        },
      },
    });
  }

  const staff = [
    { code: "EMP-001", name: "نورة الموارد", jobTitle: "مدير موارد بشرية", department: "الموارد البشرية", phone: "0501002001", basicSalary: 2500, allowances: 300, deductions: 0 },
    { code: "EMP-002", name: "فهد المبيعات", jobTitle: "مندوب مبيعات", department: "المبيعات", phone: "0501002002", basicSalary: 1800, allowances: 200, deductions: 50 },
    { code: "EMP-003", name: "ليلى الحسابات", jobTitle: "محاسب", department: "المالية", phone: "0501002003", basicSalary: 2200, allowances: 150, deductions: 0 },
  ];
  const employees = [];
  for (const person of staff) {
    employees.push(
      await tx.employee.create({
        data: { ...person, hireDate: new Date("2024-01-15T00:00:00.000Z"), status: "ACTIVE" },
      }),
    );
  }
  const octoberDays = [1, 2, 5];
  for (const employee of employees) {
    for (const day of octoberDays) {
      const late = employee.code === "EMP-002" && day === 2;
      await tx.attendance.create({
        data: {
          employeeId: employee.id,
          date: new Date(Date.UTC(2026, 9, day)),
          status: late ? "LATE" : "PRESENT",
          checkIn: new Date(Date.UTC(2026, 9, day, late ? 7 : 5, 0)),
          checkOut: new Date(Date.UTC(2026, 9, day, 13, 0)),
          hoursWorked: late ? 6 : 8,
        },
      });
    }
  }
  await tx.attendance.create({
    data: {
      employeeId: employees[1].id,
      date: new Date(Date.UTC(2026, 8, 3)),
      status: "ABSENT",
      hoursWorked: 0,
    },
  });

  let septemberNet = 0;
  for (const employee of employees) {
    const absentDays = employee.code === "EMP-002" ? 1 : 0;
    const lateDays = 0;
    const math = payrollMath({
      basicSalary: employee.basicSalary,
      allowances: employee.allowances,
      deductions: employee.deductions,
      absentDays,
      lateDays,
    });
    septemberNet = round2(septemberNet + math.netSalary);
    await tx.payroll.create({
      data: {
        month: 9,
        year: 2026,
        employeeId: employee.id,
        basicSalary: employee.basicSalary,
        totalAllowances: employee.allowances,
        totalDeductions: math.totalDeductions,
        netSalary: math.netSalary,
        absentDays,
        lateDays,
        status: "PAID",
        paidAt: new Date("2026-09-30T12:00:00.000Z"),
      },
    });
    const october = payrollMath({
      basicSalary: employee.basicSalary,
      allowances: employee.allowances,
      deductions: employee.deductions,
      absentDays: 0,
      lateDays: employee.code === "EMP-002" ? 1 : 0,
    });
    await tx.payroll.create({
      data: {
        month: 10,
        year: 2026,
        employeeId: employee.id,
        basicSalary: employee.basicSalary,
        totalAllowances: employee.allowances,
        totalDeductions: october.totalDeductions,
        netSalary: october.netSalary,
        absentDays: 0,
        lateDays: employee.code === "EMP-002" ? 1 : 0,
        status: "DRAFT",
      },
    });
  }
  await postPayrollJournal(tx, {
    amount: septemberNet,
    reference: "2026-09",
    createdById: adminId,
    method: "CASH",
    referenceId: "2026-09",
    date: new Date("2026-09-30T12:00:00.000Z"),
  });

  await tx.paymentGatewayConfig.createMany({
    data: [
      {
        provider: "MYFATOORAH",
        apiKey: "test_myfatoorah_demo",
        webhookSecret: "whsec_myfatoorah_demo",
        isTestMode: true,
        isActive: true,
        supportedMethods: JSON.stringify(["KNET", "VISA_MASTER", "APPLE_PAY"]),
      },
      {
        provider: "STRIPE",
        apiKey: "sk_test_demo",
        webhookSecret: "whsec_stripe_demo",
        isTestMode: true,
        isActive: false,
        supportedMethods: JSON.stringify(["VISA_MASTER", "APPLE_PAY"]),
      },
      {
        provider: "TAP",
        apiKey: "sk_test_tap_demo",
        webhookSecret: "whsec_tap_demo",
        isTestMode: true,
        isActive: false,
        supportedMethods: JSON.stringify(["KNET", "VISA_MASTER"]),
      },
    ],
  });
  const dueInvoice = await tx.salesInvoice.findFirst({ where: { invoiceNumber: "INV-00003" } });
  const noor = await tx.organization.findFirst({ where: { slug: "noor" } });
  const starter = await tx.organization.findFirst({ where: { slug: "starter-shop" } });
  if (dueInvoice && noor) {
    await tx.paymentLink.create({
      data: {
        token: "demo-pay-inv-00003",
        invoiceId: dueInvoice.id,
        organizationId: noor.id,
        amount: round2(dueInvoice.totalAmount - dueInvoice.paidAmount),
        currency: "SAR",
        status: "PENDING",
        gatewayProvider: "MYFATOORAH",
      },
    });
  }
  if (starter) {
    await tx.paymentLink.create({
      data: {
        token: "demo-pay-starter-sub",
        organizationId: starter.id,
        amount: 29,
        currency: "USD",
        status: "PENDING",
        gatewayProvider: "MYFATOORAH",
      },
    });
  }
}

export async function clearEnterprise(tx: Tx) {
  await tx.siteVisit.deleteMany();
  await tx.notificationSetting.deleteMany();
  await tx.paymentLink.deleteMany();
  await tx.paymentGatewayConfig.deleteMany();
  await tx.quotationItem.deleteMany();
  await tx.quotation.deleteMany();
  await tx.payroll.deleteMany();
  await tx.attendance.deleteMany();
  await tx.employee.deleteMany();
  await tx.lead.deleteMany();
  await tx.organization.deleteMany();
  await tx.journalEntryLine.deleteMany();
  await tx.journalEntry.deleteMany();
  await tx.systemNotification.deleteMany();
  await tx.stockTransferItem.deleteMany();
  await tx.stockTransfer.deleteMany();
  await tx.warehouseStock.deleteMany();
  await tx.automationRule.deleteMany();
  await tx.customFieldDefinition.deleteMany();
  await tx.appModule.deleteMany();
  await tx.account.updateMany({ data: { parentId: null } });
  await tx.account.deleteMany();
}
