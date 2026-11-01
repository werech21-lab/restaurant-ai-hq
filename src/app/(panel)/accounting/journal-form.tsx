"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveManualJournal } from "@/app/actions/accounting";
import { Alert, btnPrimary, fieldClass, labelClass } from "@/components/erp-ui";

type AccountOption = { id: string; code: string; name: string };

export function ManualJournalForm({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState([
    { accountId: accounts[0]?.id ?? "", debit: "", credit: "" },
    { accountId: accounts[1]?.id ?? accounts[0]?.id ?? "", debit: "", credit: "" },
  ]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await saveManualJournal({
      description,
      lines: lines.map((line) => ({
        accountId: line.accountId,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
      })),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push("/accounting?tab=journals");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      <div>
        <label className={labelClass}>وصف القيد</label>
        <input className={fieldClass} value={description} onChange={(event) => setDescription(event.target.value)} required />
      </div>
      {lines.map((line, index) => (
        <div key={index} className="grid gap-2 md:grid-cols-3">
          <select
            className={fieldClass}
            value={line.accountId}
            onChange={(event) =>
              setLines((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, accountId: event.target.value } : item)))
            }
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code} — {account.name}
              </option>
            ))}
          </select>
          <input
            dir="ltr"
            className={fieldClass}
            placeholder="مدين"
            value={line.debit}
            onChange={(event) =>
              setLines((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, debit: event.target.value } : item)))
            }
          />
          <input
            dir="ltr"
            className={fieldClass}
            placeholder="دائن"
            value={line.credit}
            onChange={(event) =>
              setLines((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, credit: event.target.value } : item)))
            }
          />
        </div>
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
          onClick={() => setLines((current) => [...current, { accountId: accounts[0]?.id ?? "", debit: "", credit: "" }])}
        >
          سطر جديد
        </button>
        <button className={btnPrimary} disabled={pending}>
          {pending ? "جارٍ الترحيل..." : "ترحيل القيد"}
        </button>
      </div>
    </form>
  );
}
