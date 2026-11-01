import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { paymentStatus, round2 } from "../src/lib/format";
import { MODULES as MODULE_DEFS } from "../src/lib/modules";
import { clearEnterprise, seedEnterprise } from "./bootstrap";

const prisma = new PrismaClient();
const MODULES = MODULE_DEFS.map((item) => item.key);

function permissionsFor(full: boolean, write: string[], viewOnly: string[] = []) {
  return MODULES.map((module) => {
    if (full) {
      return { module, canView: true, canCreate: true, canEdit: true, canDelete: true };
    }
    const writeOn = write.includes(module);
    const viewOn = writeOn || viewOnly.includes(module);
    return {
      module,
      canView: viewOn,
      canCreate: writeOn,
      canEdit: writeOn,
      canDelete: writeOn,
    };
  });
}

async function main() {
  const passwordHash = await bcrypt.hash("123456", 10);

    await prisma.$transaction(async (tx) => {
    await clearEnterprise(tx);
    await tx.paymentTransaction.deleteMany();
    await tx.activityLog.deleteMany();
    await tx.salesInvoiceItem.deleteMany();
    await tx.salesInvoice.deleteMany();
    await tx.purchaseOrderItem.deleteMany();
    await tx.purchaseOrder.deleteMany();
    await tx.stockMovement.deleteMany();
    await tx.warehouse.deleteMany();
    await tx.product.deleteMany();
    await tx.category.deleteMany();
    await tx.customer.deleteMany();
    await tx.supplier.deleteMany();
    await tx.user.deleteMany();
    await tx.permission.deleteMany();
    await tx.role.deleteMany();

    const roles = [
      {
        name: "مدير النظام",
        description: "صلاحيات كاملة على كل وحدات النظام",
        isAdmin: true,
        permissions: permissionsFor(true, []),
        user: { name: "أحمد المدير", email: "admin@erp.com" },
      },
      {
        name: "محاسب",
        description: "المشتريات والمبيعات والمحاسبة والتقارير",
        isAdmin: false,
        permissions: permissionsFor(false, ["purchases", "sales", "accounting"], ["reports", "audit", "automations", "crm", "hr", "payments"]),
        user: { name: "سارة المحاسبة", email: "accountant@erp.com" },
      },
      {
        name: "أمين مخزن",
        description: "المخزون والمستودعات",
        isAdmin: false,
        permissions: permissionsFor(false, ["inventory", "warehouses"]),
        user: { name: "خالد أمين المخزن", email: "store@erp.com" },
      },
      {
        name: "مندوب مبيعات",
        description: "فواتير البيع ونقطة البيع وروابط الدفع",
        isAdmin: false,
        permissions: permissionsFor(false, ["sales", "pos", "crm", "payments"]),
        user: { name: "ليلى المبيعات", email: "sales@erp.com" },
      },
    ];

    let adminId = "";
    let adminRoleId = "";
    for (const role of roles) {
      const created = await tx.role.create({
        data: {
          name: role.name,
          description: role.description,
          isAdmin: role.isAdmin,
          permissions: { create: role.permissions },
          users: {
            create: {
              name: role.user.name,
              email: role.user.email,
              passwordHash,
              isActive: true,
            },
          },
        },
        include: { users: true },
      });
      if (role.isAdmin) {
        adminId = created.users[0].id;
        adminRoleId = created.id;
      }
    }

    // Official AetherBI admin (additive — does not replace admin@erp.com).
    const aetherHash = await bcrypt.hash("AetherAdmin#2026!", 10);
    await tx.user.create({
      data: {
        name: "Aether Super Admin",
        email: "admin@aetherbi.com",
        passwordHash: aetherHash,
        isActive: true,
        roleId: adminRoleId,
      },
    });

    const categoryInput = [
      { key: "elec", name: "معدات مطابخ", description: "أجهزة تحضير وطهي لفروع المطاعم" },
      { key: "office", name: "تغليف وتقديم", description: "عبوات، أكواب، ومستلزمات الخدمة" },
      { key: "food", name: "مواد غذائية طازجة", description: "لحوم، خضار، وأساسيات المطبخ" },
      { key: "parts", name: "مشروبات وكرك", description: "شاي، قهوة، ومشروبات الفروع" },
    ];
    const categoryIds = new Map<string, string>();
    for (const category of categoryInput) {
      const created = await tx.category.create({
        data: { name: category.name, description: category.description },
      });
      categoryIds.set(category.key, created.id);
    }

    const productInput = [
      { code: "EL-1001", name: "قلاية ضغط صناعية", cat: "elec", cost: 185.5, sell: 245.0, open: 10, reorder: 3 },
      { code: "EL-1002", name: "ثلاجة عرض أفقية", cat: "elec", cost: 320.0, sell: 410.0, open: 8, reorder: 2 },
      { code: "EL-1003", name: "خلاط صناعي للمطبخ", cat: "elec", cost: 45.0, sell: 68.0, open: 40, reorder: 15 },
      { code: "OF-2001", name: "علبة تغليف ورقية كبيرة", cat: "office", cost: 0.085, sell: 0.14, open: 100, reorder: 30 },
      { code: "OF-2002", name: "أكواب ورقية 12 أونصة", cat: "office", cost: 0.045, sell: 0.08, open: 5, reorder: 20 },
      { code: "OF-2003", name: "صواني تقديم ستانلس", cat: "office", cost: 4.5, sell: 7.25, open: 12, reorder: 4 },
      { code: "FD-3001", name: "أرز بسمتي 5 كجم", cat: "food", cost: 2.75, sell: 3.9, open: 50, reorder: 20 },
      { code: "FD-3002", name: "زيت قلي نباتي 16 لتر", cat: "food", cost: 6.5, sell: 8.75, open: 6, reorder: 25 },
      { code: "FD-3003", name: "دجاج طازج كرتون 10 كجم", cat: "food", cost: 9.5, sell: 12.5, open: 60, reorder: 15 },
      { code: "PT-4001", name: "شاي كرك فاخر 1 كجم", cat: "parts", cost: 3.25, sell: 4.9, open: 3, reorder: 10 },
      { code: "PT-4002", name: "طحينة شاورما 5 كجم", cat: "parts", cost: 5.5, sell: 7.8, open: 6, reorder: 3 },
      { code: "PT-4003", name: "نودلز صيني مجفف 5 كجم", cat: "parts", cost: 2.1, sell: 3.4, open: 80, reorder: 20 },
      { code: "EL-1004", name: "شواية ستيك غاز", cat: "elec", cost: 145.0, sell: 195.0, open: 14, reorder: 4 },
      { code: "OF-2004", name: "مناديل طاولات فاخرة", cat: "office", cost: 1.1, sell: 1.85, open: 2, reorder: 12 },
      { code: "FD-3004", name: "خضار مشكلة طازجة", cat: "food", cost: 1.65, sell: 2.4, open: 30, reorder: 8 },
    ];
    const productIds = new Map<string, string>();
    for (const product of productInput) {
      const created = await tx.product.create({
        data: {
          code: product.code,
          name: product.name,
          categoryId: categoryIds.get(product.cat)!,
          costPrice: product.cost,
          sellingPrice: product.sell,
          openingStock: product.open,
          currentStock: product.open,
          reorderLevel: product.reorder,
          createdAt: new Date("2026-09-01T08:00:00"),
        },
      });
      productIds.set(product.code, created.id);
      await tx.stockMovement.create({
        data: {
          productId: created.id,
          type: "OPENING",
          quantity: product.open,
          balanceAfter: product.open,
          reference: "OPENING",
          note: "رصيد افتتاحي",
          createdById: adminId,
          createdAt: new Date("2026-09-01T08:00:00"),
        },
      });
    }

    const supplierInput = [
      { key: "tech", name: "معدات المطابخ الكويتية", phone: "50001122", email: "kitchen@suppliers.kw" },
      { key: "paper", name: "تعبئة وتغليف الخليج", phone: "50002233", email: "pack@suppliers.kw" },
      { key: "parts", name: "تموينات فنتشر المركزية", phone: "50003344", email: "central@venturefoods.kw" },
      { key: "food", name: "مزارع ولحوم الكويت", phone: "50004455", email: "fresh@suppliers.kw" },
    ];
    const supplierIds = new Map<string, string>();
    for (const supplier of supplierInput) {
      const created = await tx.supplier.create({
        data: { name: supplier.name, phone: supplier.phone, email: supplier.email, balance: 0 },
      });
      supplierIds.set(supplier.key, created.id);
    }

    const customerInput = [
      { key: "rowad", name: "كاترينغ الأعمال — السالمية", phone: "55001122", email: "catering@customers.kw" },
      { key: "school", name: "عقود شركات — الشرق", phone: "55002233", email: "corporate@customers.kw" },
      { key: "shop", name: "توصيل فارم براون — حولي", phone: "55003344", email: "farmbrown@customers.kw" },
      { key: "workshop", name: "توصيل شاورما طحينة — الفروانية", phone: "55004455", email: "shawarma@customers.kw" },
    ];
    const customerIds = new Map<string, string>();
    for (const customer of customerInput) {
      const created = await tx.customer.create({
        data: { name: customer.name, phone: customer.phone, email: customer.email, balance: 0 },
      });
      customerIds.set(customer.key, created.id);
    }

    async function purchase(input: {
      orderNumber: string;
      supplier: string;
      createdAt: string;
      paidAmount: number;
      items: { code: string; quantity: number; unitCost: number }[];
    }) {
      const total = round2(input.items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0));
      const paid = round2(input.paidAmount);
      const due = round2(total - paid);
      await tx.purchaseOrder.create({
        data: {
          orderNumber: input.orderNumber,
          supplierId: supplierIds.get(input.supplier)!,
          totalAmount: total,
          paidAmount: paid,
          status: paymentStatus(total, paid),
          createdAt: new Date(input.createdAt),
          items: {
            create: input.items.map((item) => ({
              productId: productIds.get(item.code)!,
              quantity: item.quantity,
              unitCost: item.unitCost,
              totalCost: round2(item.quantity * item.unitCost),
            })),
          },
        },
      });
      for (const item of input.items) {
        const updated = await tx.product.update({
          where: { id: productIds.get(item.code)! },
          data: { currentStock: { increment: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: productIds.get(item.code)!,
            type: "IN",
            quantity: item.quantity,
            balanceAfter: updated.currentStock,
            reference: input.orderNumber,
            note: `أمر شراء ${input.orderNumber}`,
            createdById: adminId,
            createdAt: new Date(input.createdAt),
          },
        });
      }
      if (due > 0) {
        await tx.supplier.update({
          where: { id: supplierIds.get(input.supplier)! },
          data: { balance: { increment: due } },
        });
      }
      if (paid > 0) {
        await tx.paymentTransaction.create({
          data: {
            type: "PAYMENT",
            partyType: "SUPPLIER",
            partyId: supplierIds.get(input.supplier)!,
            amount: paid,
            reference: input.orderNumber,
            note: `سند صرف على أمر شراء ${input.orderNumber}`,
            createdById: adminId,
            createdAt: new Date(input.createdAt),
          },
        });
      }
      await tx.activityLog.create({
        data: {
          userId: adminId,
          action: "CREATE",
          module: "purchases",
          details: `أمر شراء ${input.orderNumber} بإجمالي ${total}`,
          createdAt: new Date(input.createdAt),
        },
      });
    }

    async function sale(input: {
      invoiceNumber: string;
      customer: string;
      createdAt: string;
      paidAmount: number;
      discount?: number;
      items: { code: string; quantity: number; unitPrice: number }[];
    }) {
      const subtotal = round2(input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
      const discount = round2(input.discount ?? 0);
      const total = round2(subtotal - discount);
      const paid = round2(input.paidAmount);
      const due = round2(total - paid);
      await tx.salesInvoice.create({
        data: {
          invoiceNumber: input.invoiceNumber,
          customerId: customerIds.get(input.customer)!,
          subtotal,
          discount,
          totalAmount: total,
          paidAmount: paid,
          status: paymentStatus(total, paid),
          createdAt: new Date(input.createdAt),
          items: {
            create: input.items.map((item) => ({
              productId: productIds.get(item.code)!,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: round2(item.quantity * item.unitPrice),
            })),
          },
        },
      });
      for (const item of input.items) {
        const updated = await tx.product.update({
          where: { id: productIds.get(item.code)! },
          data: { currentStock: { decrement: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: productIds.get(item.code)!,
            type: "OUT",
            quantity: item.quantity,
            balanceAfter: updated.currentStock,
            reference: input.invoiceNumber,
            note: `فاتورة مبيعات ${input.invoiceNumber}`,
            createdById: adminId,
            createdAt: new Date(input.createdAt),
          },
        });
      }
      if (due > 0) {
        await tx.customer.update({
          where: { id: customerIds.get(input.customer)! },
          data: { balance: { increment: due } },
        });
      }
      if (paid > 0) {
        await tx.paymentTransaction.create({
          data: {
            type: "RECEIPT",
            partyType: "CUSTOMER",
            partyId: customerIds.get(input.customer)!,
            amount: paid,
            reference: input.invoiceNumber,
            note: `سند قبض على فاتورة ${input.invoiceNumber}`,
            createdById: adminId,
            createdAt: new Date(input.createdAt),
          },
        });
      }
      await tx.activityLog.create({
        data: {
          userId: adminId,
          action: "CREATE",
          module: "sales",
          details: `فاتورة ${input.invoiceNumber} بصافي ${total}`,
          createdAt: new Date(input.createdAt),
        },
      });
    }

    await purchase({
      orderNumber: "PO-00001",
      supplier: "parts",
      createdAt: "2026-09-20T10:00:00",
      paidAmount: 200,
      items: [{ code: "PT-4002", quantity: 2, unitCost: 220 }],
    });
    await purchase({
      orderNumber: "PO-00002",
      supplier: "tech",
      createdAt: "2026-10-10T11:30:00",
      paidAmount: 8000,
      items: [
        { code: "EL-1001", quantity: 5, unitCost: 2500 },
        { code: "EL-1003", quantity: 20, unitCost: 25 },
      ],
    });
    await purchase({
      orderNumber: "PO-00003",
      supplier: "paper",
      createdAt: "2026-10-12T09:15:00",
      paidAmount: 1200,
      items: [
        { code: "OF-2001", quantity: 40, unitCost: 12 },
        { code: "OF-2003", quantity: 4, unitCost: 180 },
      ],
    });
    await tx.activityLog.create({
      data: {
        userId: adminId,
        action: "OPENING",
        module: "inventory",
        details: "تسجيل الأرصدة الافتتاحية لخمسة عشر صنفاً",
        createdAt: new Date("2026-09-01T08:05:00"),
      },
    });
    await sale({
      invoiceNumber: "INV-00001",
      customer: "rowad",
      createdAt: "2026-10-18T13:00:00",
      paidAmount: 2000,
      discount: 150,
      items: [
        { code: "EL-1001", quantity: 2, unitPrice: 3200 },
        { code: "EL-1003", quantity: 10, unitPrice: 45 },
      ],
    });
    await sale({
      invoiceNumber: "INV-00002",
      customer: "school",
      createdAt: "2026-10-22T12:10:00",
      paidAmount: 860,
      items: [
        { code: "OF-2001", quantity: 30, unitPrice: 18 },
        { code: "FD-3001", quantity: 10, unitPrice: 32 },
      ],
    });
    await sale({
      invoiceNumber: "INV-00003",
      customer: "shop",
      createdAt: "2026-10-28T16:40:00",
      paidAmount: 0,
      items: [
        { code: "PT-4003", quantity: 15, unitPrice: 12 },
        { code: "FD-3003", quantity: 5, unitPrice: 13 },
      ],
    });
    await seedEnterprise(tx, adminId);
  }, { timeout: 60000 });

  const low = await prisma.$queryRaw<Array<{ count: number | bigint }>>`
    SELECT COUNT(*) as count FROM Product WHERE currentStock <= reorderLevel
  `;
  console.log("Seed completed", { lowStock: Number(low[0]?.count ?? 0) });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
