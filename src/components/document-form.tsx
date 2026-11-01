"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { searchProducts } from "@/app/actions/search";
import { CustomFields } from "@/components/custom-fields";
import { SearchSelect } from "@/components/search-select";
import { Alert, btnGhost, btnPrimary, fieldClass, labelClass } from "@/components/erp-ui";
import { formatMoney, formatQty } from "@/lib/format";
import type { ActionResult, DocumentInput, SearchHit } from "@/lib/types";

type Line = {
  uid: string;
  productId: string;
  label: string;
  quantity: string;
  price: string;
  stock: number;
};

export function DocumentForm({
  mode,
  partyLabel,
  partyPlaceholder,
  searchParties,
  priceKey,
  submitLabel,
  onSubmit,
}: {
  mode: "purchase" | "sale";
  partyLabel: string;
  partyPlaceholder: string;
  searchParties: (query: string) => Promise<SearchHit[]>;
  priceKey: "costPrice" | "sellingPrice";
  submitLabel: string;
  onSubmit: (input: DocumentInput) => Promise<ActionResult>;
}) {
  const [party, setParty] = useState<SearchHit | null>(null);
  const [paid, setPaid] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [lines, setLines] = useState<Line[]>([]);
  const [customData, setCustomData] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const total = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.price) || 0), 0);
  const discountValue = mode === "sale" ? Number(discount) || 0 : 0;
  const net = Math.max(0, total - discountValue);
  const paidValue = Number(paid) || 0;
  const due = Math.max(0, net - paidValue);

  function addProduct(hit: SearchHit) {
    if (lines.some((line) => line.productId === hit.id)) {
      setError("الصنف مضاف مسبقاً في المستند");
      return;
    }
    setError("");
    setLines((current) => [
      ...current,
      {
        uid: `${hit.id}-${current.length}`,
        productId: hit.id,
        label: `${hit.label}${hit.meta ? ` (${hit.meta})` : ""}`,
        quantity: "1",
        price: String(hit[priceKey] ?? 0),
        stock: hit.stock ?? 0,
      },
    ]);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await onSubmit({
      partyId: party?.id ?? "",
      paidAmount: paidValue,
      discount: discountValue,
      items: lines.map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity),
        price: Number(line.price),
      })),
      ...(mode === "sale" && Object.keys(customData).length > 0 ? { customData } : {}),
    });
    setPending(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      <SearchSelect
        label={partyLabel}
        placeholder={partyPlaceholder}
        selectedLabel={party?.label}
        search={searchParties}
        onSelect={setParty}
      />
      <SearchSelect label="إضافة صنف" placeholder="ابحث بالاسم أو الرمز" search={searchProducts} onSelect={addProduct} />
      {mode === "sale" ? <CustomFields entityType="INVOICE" onChange={setCustomData} /> : null}
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-3 py-2 text-right font-semibold">الصنف</th>
              <th className="px-3 py-2 text-right font-semibold">الكمية</th>
              <th className="px-3 py-2 text-right font-semibold">السعر</th>
              <th className="px-3 py-2 text-right font-semibold">الإجمالي</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  أضف صنفاً واحداً على الأقل
                </td>
              </tr>
            ) : null}
            {lines.map((line) => {
              const lineTotal = (Number(line.quantity) || 0) * (Number(line.price) || 0);
              const shortage = mode === "sale" && (Number(line.quantity) || 0) > line.stock;
              return (
                <tr key={line.uid} className="border-b border-slate-200 last:border-0">
                  <td className="px-3 py-2">
                    <p className="font-semibold text-slate-900">{line.label}</p>
                    {shortage ? (
                      <p className="text-xs font-bold text-red-600">أكبر من المتاح ({formatQty(line.stock)})</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      dir="ltr"
                      className={fieldClass}
                      value={line.quantity}
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((item) =>
                            item.uid === line.uid ? { ...item, quantity: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      dir="ltr"
                      className={fieldClass}
                      value={line.price}
                      onChange={(event) =>
                        setLines((current) =>
                          current.map((item) =>
                            item.uid === line.uid ? { ...item, price: event.target.value } : item,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2 font-semibold">{formatMoney(lineTotal)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-red-600"
                      onClick={() => setLines((current) => current.filter((item) => item.uid !== line.uid))}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {mode === "sale" ? (
          <div>
            <label className={labelClass}>الخصم</label>
            <input dir="ltr" className={fieldClass} value={discount} onChange={(event) => setDiscount(event.target.value)} />
          </div>
        ) : null}
        <div>
          <label className={labelClass}>{mode === "sale" ? "المبلغ المحصّل الآن" : "المبلغ المدفوع الآن"}</label>
          <input dir="ltr" className={fieldClass} value={paid} onChange={(event) => setPaid(event.target.value)} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">{mode === "sale" ? "الصافي بعد الخصم" : "الإجمالي"}</p>
          <p className="text-lg font-bold">{formatMoney(mode === "sale" ? net : total)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">المتبقي على الحساب</p>
          <p className="text-lg font-bold text-blue-700">{formatMoney(due)}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="submit" className={btnPrimary} disabled={pending}>
          <Plus size={16} />
          {pending ? "جارٍ الحفظ..." : submitLabel}
        </button>
        <span className={btnGhost}>عدد الأصناف: {lines.length}</span>
      </div>
    </form>
  );
}
