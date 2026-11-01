"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { convertQuotationAction, moveLeadAction, saveLeadAction, saveQuotationAction, sendQuotationAction } from "@/app/actions/crm";
import { Alert, btnPrimary, fieldClass, labelClass } from "@/components/erp-ui";
import { formatMoney } from "@/lib/format";

const STAGES = [
  { key: "NEW", label: "جديدة" },
  { key: "QUALIFIED", label: "مؤهلة" },
  { key: "PROPOSAL", label: "عرض" },
  { key: "WON", label: "رابحة" },
  { key: "LOST", label: "خاسرة" },
] as const;

export type LeadCard = {
  id: string;
  title: string;
  contactName: string;
  phone: string;
  expectedLabel: string;
  stage: string;
  owner: string;
};

export function CrmBoard({
  leads,
  canEdit,
  customers,
  products,
  canCreate,
}: {
  leads: LeadCard[];
  canEdit: boolean;
  canCreate: boolean;
  customers: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string; price: number }>;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState(String(products[0]?.price ?? 0));

  async function move(id: string, stage: string) {
    setError("");
    const result = await moveLeadAction(id, stage);
    if (!result.ok) setError(result.message);
    else router.refresh();
  }

  async function addLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const result = await saveLeadAction({
      title: String(form.get("title") || ""),
      contactName: String(form.get("contactName") || ""),
      phone: String(form.get("phone") || ""),
      email: String(form.get("email") || ""),
      expectedValue: Number(form.get("expectedValue") || 0),
      stage: String(form.get("stage") || "NEW"),
      notes: String(form.get("notes") || ""),
    });
    setPending(false);
    if (!result.ok) setError(result.message);
    else {
      setMessage(result.message || "تم الحفظ");
      event.currentTarget.reset();
      router.refresh();
    }
  }

  async function addQuote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const result = await saveQuotationAction({
      customerId: String(form.get("customerId") || ""),
      leadId: String(form.get("leadId") || ""),
      validUntil: String(form.get("validUntil") || ""),
      notes: String(form.get("notes") || ""),
      items: [{ productId, quantity: Number(quantity), price: Number(price) }],
    });
    setPending(false);
    if (!result.ok) setError(result.message);
    else {
      setMessage(result.message || "تم إنشاء العرض");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {message ? <Alert kind="ok">{message}</Alert> : null}
      <div className="grid gap-3 xl:grid-cols-5">
        {STAGES.map((stage) => (
          <section key={stage.key} className="rounded-2xl border border-slate-200 bg-white p-3">
            <h2 className="mb-3 font-bold">{stage.label}</h2>
            <div className="space-y-2">
              {leads.filter((lead) => lead.stage === stage.key).map((lead) => {
                const index = STAGES.findIndex((item) => item.key === lead.stage);
                return (
                  <article key={lead.id} className="rounded-xl border border-slate-200 p-3">
                    <p className="font-bold">{lead.title}</p>
                    <p className="text-sm text-slate-600">{lead.contactName}</p>
                    <p className="text-sm font-semibold text-blue-700">{lead.expectedLabel}</p>
                    <p className="text-xs text-slate-500">{lead.owner}</p>
                    {canEdit ? (
                      <div className="mt-2 flex gap-1">
                        {index > 0 ? (
                          <button type="button" className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold" onClick={() => move(lead.id, STAGES[index - 1].key)}>
                            السابقة
                          </button>
                        ) : null}
                        {index < STAGES.length - 1 ? (
                          <button type="button" className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-semibold text-white" onClick={() => move(lead.id, STAGES[index + 1].key)}>
                            التالية
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {canCreate ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={addLead} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-bold">فرصة جديدة</p>
            <input name="title" className={fieldClass} placeholder="عنوان الفرصة" required />
            <input name="contactName" className={fieldClass} placeholder="جهة الاتصال" required />
            <div className="grid grid-cols-2 gap-2">
              <input name="phone" className={fieldClass} placeholder="الهاتف" />
              <input name="email" className={fieldClass} placeholder="البريد" />
            </div>
            <input name="expectedValue" dir="ltr" className={fieldClass} placeholder="القيمة المتوقعة" defaultValue="0" />
            <select name="stage" className={fieldClass} defaultValue="NEW">
              {STAGES.map((stage) => (
                <option key={stage.key} value={stage.key}>{stage.label}</option>
              ))}
            </select>
            <input name="notes" className={fieldClass} placeholder="ملاحظات" />
            <button className={btnPrimary} disabled={pending}>حفظ الفرصة</button>
          </form>
          <form onSubmit={addQuote} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-bold">عرض سعر</p>
            <div>
              <label className={labelClass}>العميل</label>
              <select name="customerId" className={fieldClass} defaultValue="">
                <option value="">بدون عميل حالي</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>الفرصة</label>
              <select name="leadId" className={fieldClass} defaultValue="">
                <option value="">بدون فرصة</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>{lead.title}</option>
                ))}
              </select>
            </div>
            <select
              className={fieldClass}
              value={productId}
              onChange={(event) => {
                setProductId(event.target.value);
                const product = products.find((item) => item.id === event.target.value);
                if (product) setPrice(String(product.price));
              }}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input dir="ltr" className={fieldClass} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              <input dir="ltr" className={fieldClass} value={price} onChange={(event) => setPrice(event.target.value)} />
            </div>
            <input name="validUntil" type="date" className={fieldClass} />
            <input name="notes" className={fieldClass} placeholder="ملاحظة العرض" />
            <p className="text-sm font-semibold">الإجمالي {formatMoney(Number(quantity) * Number(price) || 0)}</p>
            <button className={btnPrimary} disabled={pending}>حفظ العرض</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function QuoteActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  if (status === "CONVERTED") return <span className="text-xs font-semibold text-emerald-700">تم التحويل</span>;
  return (
    <div className="flex flex-col items-start gap-1">
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
      <a className="font-semibold text-blue-700" href={`/crm/quotes/${id}/print`}>طباعة العرض</a>
      {status === "DRAFT" ? (
        <button type="button" className="font-semibold text-blue-700" onClick={async () => {
          const result = await sendQuotationAction(id);
          if (!result.ok) setError(result.message);
          else router.refresh();
        }}>تعليم كمُرسل</button>
      ) : null}
      <button
        type="button"
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white"
        onClick={async () => {
          const result = await convertQuotationAction(id);
          if (!result.ok) setError(result.message);
          else if (result.id) router.push(`/sales/${result.id}/print`);
          else router.refresh();
        }}
      >
        تحويل إلى فاتورة مبيعات
      </button>
    </div>
  );
}
