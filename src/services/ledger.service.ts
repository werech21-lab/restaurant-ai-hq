import { prisma } from "@/lib/db";
import { round2 } from "@/lib/format";

export type LedgerLine = {
  id: string;
  at: Date;
  kind: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
};

export type Statement = {
  id: string;
  name: string;
  phone: string;
  email: string;
  storedBalance: number;
  lines: LedgerLine[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
};

type RawMove = {
  id: string;
  at: Date;
  order: number;
  kind: string;
  reference: string;
  debit: number;
  credit: number;
};

function build(moves: RawMove[], direction: "customer" | "supplier"): LedgerLine[] {
  const sorted = [...moves].sort((a, b) => a.at.getTime() - b.at.getTime() || a.order - b.order || a.reference.localeCompare(b.reference));
  let balance = 0;
  return sorted.map((move) => {
    balance =
      direction === "customer"
        ? round2(balance + move.debit - move.credit)
        : round2(balance + move.credit - move.debit);
    return {
      id: move.id,
      at: move.at,
      kind: move.kind,
      reference: move.reference,
      debit: move.debit,
      credit: move.credit,
      balance,
    };
  });
}

function summarize(lines: LedgerLine[], storedBalance: number, party: { id: string; name: string; phone: string | null; email: string | null }): Statement {
  const totalDebit = round2(lines.reduce((sum, line) => sum + line.debit, 0));
  const totalCredit = round2(lines.reduce((sum, line) => sum + line.credit, 0));
  const closingBalance = lines.length ? lines[lines.length - 1].balance : 0;
  return {
    id: party.id,
    name: party.name,
    phone: party.phone ?? "",
    email: party.email ?? "",
    storedBalance,
    lines,
    totalDebit,
    totalCredit,
    closingBalance: round2(closingBalance),
  };
}

export async function customerStatement(id: string) {
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return null;
  const [invoices, payments] = await Promise.all([
    prisma.salesInvoice.findMany({ where: { customerId: id } }),
    prisma.paymentTransaction.findMany({ where: { partyType: "CUSTOMER", partyId: id, type: "RECEIPT" } }),
  ]);
  const lines = build(
    [
      ...invoices.map((invoice) => ({
        id: invoice.id,
        at: invoice.createdAt,
        order: 0,
        kind: "فاتورة مبيعات",
        reference: invoice.invoiceNumber,
        debit: invoice.totalAmount,
        credit: 0,
      })),
      ...payments.map((payment) => ({
        id: payment.id,
        at: payment.createdAt,
        order: 1,
        kind: "سند قبض",
        reference: payment.reference ?? "",
        debit: 0,
        credit: payment.amount,
      })),
    ],
    "customer",
  );
  return summarize(lines, customer.balance, customer);
}

export async function supplierStatement(id: string) {
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  if (!supplier) return null;
  const [orders, payments] = await Promise.all([
    prisma.purchaseOrder.findMany({ where: { supplierId: id } }),
    prisma.paymentTransaction.findMany({ where: { partyType: "SUPPLIER", partyId: id, type: "PAYMENT" } }),
  ]);
  const lines = build(
    [
      ...orders.map((order) => ({
        id: order.id,
        at: order.createdAt,
        order: 0,
        kind: "أمر شراء",
        reference: order.orderNumber,
        debit: 0,
        credit: order.totalAmount,
      })),
      ...payments.map((payment) => ({
        id: payment.id,
        at: payment.createdAt,
        order: 1,
        kind: "سند صرف",
        reference: payment.reference ?? "",
        debit: payment.amount,
        credit: 0,
      })),
    ],
    "supplier",
  );
  return summarize(lines, supplier.balance, supplier);
}
