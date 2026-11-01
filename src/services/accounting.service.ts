import { writeActivity } from "@/lib/activity";
import { checkPermission } from "@/lib/erp-auth";
import { cleanText } from "@/lib/documents";
import { prisma } from "@/lib/db";
import { round2 } from "@/lib/format";
import { runTx, txError } from "@/lib/tx";
import { fail, ok } from "@/lib/types";
import { postEntry, type EntryLine } from "@/services/accounting.engine";

export async function chartOfAccounts() {
  return prisma.account.findMany({
    orderBy: { code: "asc" },
    include: { parent: { select: { code: true, name: true } } },
  });
}

export async function trialBalance() {
  const accounts = await prisma.account.findMany({ orderBy: { code: "asc" } });
  const rows = accounts.map((account) => {
    const debitNature = account.type === "ASSET" || account.type === "EXPENSE";
    const debit = debitNature ? Math.max(account.balance, 0) : Math.max(-account.balance, 0);
    const credit = debitNature ? Math.max(-account.balance, 0) : Math.max(account.balance, 0);
    return { ...account, debit: round2(debit), credit: round2(credit) };
  });
  return {
    rows,
    debit: round2(rows.reduce((sum, row) => sum + row.debit, 0)),
    credit: round2(rows.reduce((sum, row) => sum + row.credit, 0)),
  };
}

export async function listJournals(skip: number, take: number, q: string) {
  const where = q
    ? {
        OR: [
          { entryNumber: { contains: q } },
          { description: { contains: q } },
          { referenceType: { contains: q } },
        ],
      }
    : {};
  const [rows, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      skip,
      take,
      orderBy: { date: "desc" },
      include: { lines: { include: { account: true } }, createdBy: { select: { name: true } } },
    }),
    prisma.journalEntry.count({ where }),
  ]);
  return { rows, total };
}

export async function createManualJournal(input: {
  description: string;
  lines: Array<{ accountId: string; debit: number; credit: number }>;
}) {
  const gate = await checkPermission("accounting", "create");
  if (!gate.allowed || !gate.user) return fail(gate.message || "ممنوع");
  const description = cleanText(input.description, 200);
  if (description.length < 2) return fail("وصف القيد مطلوب");
  if (input.lines.length < 2) return fail("أضف سطرين على الأقل");
  const userId = gate.user.id;
  return runTx(async (tx) => {
    const accounts = await tx.account.findMany({ where: { id: { in: input.lines.map((line) => line.accountId) } } });
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const lines: EntryLine[] = input.lines.map((line) => {
      const account = byId.get(line.accountId);
      if (!account) txError("أحد الحسابات غير موجود");
      return { code: account.code, debit: Number(line.debit) || 0, credit: Number(line.credit) || 0 };
    });
    const entry = await postEntry(tx, {
      description,
      referenceType: "MANUAL",
      createdById: userId,
      lines,
    });
    await writeActivity(tx, {
      userId,
      action: "CREATE",
      module: "accounting",
      details: `قيد يدوي ${entry.entryNumber}: ${description}`,
    });
  });
}
