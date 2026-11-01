import type { Prisma } from "@prisma/client";
import { round2 } from "@/lib/format";

export const ACCOUNTS = {
  cash: "1100",
  bank: "1200",
  receivable: "1300",
  inventory: "1400",
  payable: "2100",
  capital: "3100",
  sales: "4100",
  cogs: "5100",
  salaries: "5200",
  vat: "2200",
} as const;

type Tx = Prisma.TransactionClient;

export type EntryLine = { code: string; debit: number; credit: number };

function unbalanced(message: string): never {
  throw new Error(`ERR:${message}`);
}

export async function postEntry(
  tx: Tx,
  input: {
    description: string;
    referenceType: string;
    referenceId?: string;
    createdById: string;
    date?: Date;
    lines: EntryLine[];
  },
) {
  const usable = input.lines
    .map((line) => ({ code: line.code, debit: round2(line.debit), credit: round2(line.credit) }))
    .filter((line) => line.debit > 0.001 || line.credit > 0.001);
  if (usable.length < 2) unbalanced("القيد يحتاج سطرين على الأقل");
  for (const line of usable) {
    if (line.debit < 0 || line.credit < 0) unbalanced("لا يُقبل مبلغ سالب في القيد");
    if (line.debit > 0.001 && line.credit > 0.001) unbalanced("سطر القيد لا يجمع مديناً ودائناً معاً");
  }
  const debit = round2(usable.reduce((sum, line) => sum + line.debit, 0));
  const credit = round2(usable.reduce((sum, line) => sum + line.credit, 0));
  if (Math.abs(debit - credit) > 0.009) {
    unbalanced(`القيد غير متوازن. المدين ${debit} والدائن ${credit}`);
  }

  const accounts = await tx.account.findMany({ where: { code: { in: usable.map((line) => line.code) } } });
  const byCode = new Map(accounts.map((account) => [account.code, account]));
  for (const line of usable) {
    if (!byCode.get(line.code)) unbalanced(`الحساب ${line.code} غير موجود في شجرة الحسابات`);
  }

  const count = await tx.journalEntry.count();
  const entry = await tx.journalEntry.create({
    data: {
      entryNumber: `JE-${String(count + 1).padStart(5, "0")}`,
      date: input.date ?? new Date(),
      description: input.description,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      isPosted: true,
      createdById: input.createdById,
      lines: {
        create: usable.map((line) => ({
          accountId: byCode.get(line.code)!.id,
          debit: line.debit,
          credit: line.credit,
        })),
      },
    },
  });

  for (const line of usable) {
    const account = byCode.get(line.code)!;
    const delta =
      account.type === "ASSET" || account.type === "EXPENSE"
        ? round2(line.debit - line.credit)
        : round2(line.credit - line.debit);
    if (Math.abs(delta) > 0) {
      await tx.account.update({ where: { id: account.id }, data: { balance: { increment: delta } } });
    }
  }
  return entry;
}

export async function postSaleJournals(
  tx: Tx,
  input: {
    invoiceId: string;
    invoiceNumber: string;
    total: number;
    paid: number;
    due: number;
    cogs: number;
    paymentMethod: string;
    createdById: string;
    date?: Date;
  },
) {
  const tender = input.paymentMethod === "CARD" ? ACCOUNTS.bank : ACCOUNTS.cash;
  const lines: EntryLine[] = [];
  if (input.paid > 0.001) lines.push({ code: tender, debit: input.paid, credit: 0 });
  if (input.due > 0.001) lines.push({ code: ACCOUNTS.receivable, debit: input.due, credit: 0 });
  lines.push({ code: ACCOUNTS.sales, debit: 0, credit: input.total });
  await postEntry(tx, {
    description: `فاتورة مبيعات ${input.invoiceNumber}`,
    referenceType: "SALES_INVOICE",
    referenceId: input.invoiceId,
    createdById: input.createdById,
    date: input.date,
    lines,
  });
  if (input.cogs > 0.001) {
    await postEntry(tx, {
      description: `تكلفة بضاعة فاتورة ${input.invoiceNumber}`,
      referenceType: "COGS",
      referenceId: input.invoiceId,
      createdById: input.createdById,
      date: input.date,
      lines: [
        { code: ACCOUNTS.cogs, debit: input.cogs, credit: 0 },
        { code: ACCOUNTS.inventory, debit: 0, credit: input.cogs },
      ],
    });
  }
}

export async function postPurchaseJournal(
  tx: Tx,
  input: {
    orderId: string;
    orderNumber: string;
    total: number;
    paid: number;
    due: number;
    createdById: string;
    date?: Date;
  },
) {
  const lines: EntryLine[] = [{ code: ACCOUNTS.inventory, debit: input.total, credit: 0 }];
  if (input.paid > 0.001) lines.push({ code: ACCOUNTS.cash, debit: 0, credit: input.paid });
  if (input.due > 0.001) lines.push({ code: ACCOUNTS.payable, debit: 0, credit: input.due });
  await postEntry(tx, {
    description: `أمر شراء ${input.orderNumber}`,
    referenceType: "PURCHASE_ORDER",
    referenceId: input.orderId,
    createdById: input.createdById,
    date: input.date,
    lines,
  });
}

export async function postReceiptJournal(
  tx: Tx,
  input: { amount: number; reference: string; createdById: string; referenceId?: string; method?: string },
) {
  const debitAccount = input.method === "BANK" ? ACCOUNTS.bank : ACCOUNTS.cash;
  await postEntry(tx, {
    description: `سند قبض ${input.reference}`,
    referenceType: "RECEIPT",
    referenceId: input.referenceId,
    createdById: input.createdById,
    lines: [
      { code: debitAccount, debit: input.amount, credit: 0 },
      { code: ACCOUNTS.receivable, debit: 0, credit: input.amount },
    ],
  });
}

export async function postPayrollJournal(
  tx: Tx,
  input: { amount: number; reference: string; createdById: string; method?: string; referenceId?: string; date?: Date },
) {
  const creditAccount = input.method === "BANK" ? ACCOUNTS.bank : ACCOUNTS.cash;
  await postEntry(tx, {
    description: `صرف رواتب ${input.reference}`,
    referenceType: "PAYROLL",
    referenceId: input.referenceId,
    createdById: input.createdById,
    date: input.date,
    lines: [
      { code: ACCOUNTS.salaries, debit: input.amount, credit: 0 },
      { code: creditAccount, debit: 0, credit: input.amount },
    ],
  });
}

export async function postPaymentJournal(tx: Tx, input: { amount: number; reference: string; createdById: string; referenceId?: string }) {
  await postEntry(tx, {
    description: `سند صرف ${input.reference}`,
    referenceType: "PAYMENT",
    referenceId: input.referenceId,
    createdById: input.createdById,
    lines: [
      { code: ACCOUNTS.payable, debit: input.amount, credit: 0 },
      { code: ACCOUNTS.cash, debit: 0, credit: input.amount },
    ],
  });
}
