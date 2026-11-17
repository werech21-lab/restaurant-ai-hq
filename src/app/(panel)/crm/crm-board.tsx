"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { convertQuotationAction, moveLeadAction, saveLeadAction, saveQuotationAction, sendQuotationAction } from "@/app/actions/crm";
import { Alert, btnPrimary, labelClass } from "@/components/erp-ui";
import { SectionCard, StateBlock } from "@/components/ui";
import { formatKwd } from "@/lib/format";

const STAGES = [
  { key: "NEW", labelAr: "جديدة", labelEn: "New" },
  { key: "QUALIFIED", labelAr: "مؤهلة", labelEn: "Qualified" },
  { key: "PROPOSAL", labelAr: "عرض", labelEn: "Proposal" },
  { key: "WON", labelAr: "رابحة", labelEn: "Won" },
  { key: "LOST", labelAr: "خاسرة", labelEn: "Lost" },
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

const inputCls =
  "ds-surface-subtle ds-focus-ring w-full rounded-xl px-3 py-2 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]";

export function CrmBoard({
  leads,
  canEdit,
  customers,
  products,
  canCreate,
  locale = "ar",
}: {
  leads: LeadCard[];
  canEdit: boolean;
  canCreate: boolean;
  customers: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string; price: number }>;
  locale?: "ar" | "en";
}) {
  const router = useRouter();
  const isAr = locale !== "en";
  const resolvedLocale = isAr ? "ar" : "en";
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
      setMessage(result.message || (isAr ? "تم الحفظ" : "Saved"));
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
      setMessage(result.message || (isAr ? "تم إنشاء العرض" : "Quotation created"));
      router.refresh();
    }
  }

  const quoteTotal = (Number(quantity) || 0) * (Number(price) || 0);

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="space-y-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      {message ? <Alert kind="ok">{message}</Alert> : null}

      <div className="grid gap-3 xl:grid-cols-5">
        {STAGES.map((stage) => {
          const stageLeads = leads.filter((lead) => lead.stage === stage.key);
          return (
            <SectionCard
              key={stage.key}
              locale={resolvedLocale}
              title={isAr ? stage.labelAr : stage.labelEn}
              actions={
                <span dir="ltr" className="ds-num rounded-full border border-[var(--ds-border-hairline)] px-2 py-0.5 text-xs font-bold tabular-nums">
                  {stageLeads.length}
                </span>
              }
            >
              {stageLeads.length === 0 ? (
                <StateBlock
                  state="empty"
                  locale={resolvedLocale}
                  compact
                  minHeightClass="min-h-[96px]"
                  title={isAr ? "لا توجد فرص" : "No leads"}
                  description={isAr ? "اسحب أو أضف فرصة جديدة لهذه المرحلة." : "Add or advance a lead into this stage."}
                />
              ) : (
                <div className="space-y-2.5">
                  {stageLeads.map((lead) => {
                    const index = STAGES.findIndex((item) => item.key === lead.stage);
                    return (
                      <article
                        key={lead.id}
                        className="ds-surface-subtle rounded-xl p-3 space-y-1"
                      >
                        <p className="font-bold text-sm" style={{ color: "var(--ds-text-primary)" }}>
                          {lead.title}
                        </p>
                        <p className="text-xs" style={{ color: "var(--ds-text-secondary)" }}>
                          {lead.contactName}
                        </p>
                        <p dir="ltr" className="ds-num text-sm font-bold tabular-nums" style={{ color: "var(--ds-accent)" }}>
                          {lead.expectedLabel}
                        </p>
                        <p className="text-xs" style={{ color: "var(--ds-text-muted)" }}>
                          {lead.owner}
                        </p>
                        {canEdit ? (
                          <div className="mt-2 flex flex-wrap gap-1.5 pt-1">
                            {index > 0 ? (
                              <button
                                type="button"
                                className="ds-surface ds-focus-ring min-h-8 rounded-lg px-2.5 py-1 text-xs font-semibold hover:bg-[var(--ds-bg-hover)]"
                                onClick={() => move(lead.id, STAGES[index - 1].key)}
                              >
                                {isAr ? "السابقة" : "Prev"}
                              </button>
                            ) : null}
                            {index < STAGES.length - 1 ? (
                              <button
                                type="button"
                                className="ds-focus-ring min-h-8 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                                onClick={() => move(lead.id, STAGES[index + 1].key)}
                              >
                                {isAr ? "التالية" : "Next"}
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          );
        })}
      </div>

      {canCreate ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard locale={resolvedLocale} title={isAr ? "فرصة جديدة" : "New Lead"}>
            <form onSubmit={addLead} className="space-y-3">
              <input
                name="title"
                aria-label={isAr ? "عنوان الفرصة" : "Lead title"}
                className={inputCls}
                placeholder={isAr ? "عنوان الفرصة" : "Lead title"}
                required
              />
              <input
                name="contactName"
                aria-label={isAr ? "جهة الاتصال" : "Contact name"}
                className={inputCls}
                placeholder={isAr ? "جهة الاتصال" : "Contact name"}
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  name="phone"
                  aria-label={isAr ? "الهاتف" : "Phone"}
                  className={inputCls}
                  placeholder={isAr ? "الهاتف" : "Phone"}
                />
                <input
                  name="email"
                  aria-label={isAr ? "البريد الإلكتروني" : "Email"}
                  className={inputCls}
                  placeholder={isAr ? "البريد الإلكتروني" : "Email"}
                />
              </div>
              <input
                name="expectedValue"
                aria-label={isAr ? "القيمة المتوقعة (د.ك)" : "Expected value (KWD)"}
                dir="ltr"
                className={inputCls}
                placeholder={isAr ? "القيمة المتوقعة (د.ك)" : "Expected value (KWD)"}
                defaultValue="0"
              />
              <select
                name="stage"
                aria-label={isAr ? "المرحلة" : "Stage"}
                className={inputCls}
                defaultValue="NEW"
              >
                {STAGES.map((stage) => (
                  <option key={stage.key} value={stage.key}>
                    {isAr ? stage.labelAr : stage.labelEn}
                  </option>
                ))}
              </select>
              <input
                name="notes"
                aria-label={isAr ? "ملاحظات" : "Notes"}
                className={inputCls}
                placeholder={isAr ? "ملاحظات" : "Notes"}
              />
              <button className={`${btnPrimary} ds-focus-ring min-h-10`} disabled={pending}>
                {isAr ? "حفظ الفرصة" : "Save Lead"}
              </button>
            </form>
          </SectionCard>

          <SectionCard locale={resolvedLocale} title={isAr ? "عرض سعر جديد" : "New Quotation"}>
            <form onSubmit={addQuote} className="space-y-3">
              <div>
                <label className={labelClass}>{isAr ? "العميل" : "Customer"}</label>
                <select
                  name="customerId"
                  aria-label={isAr ? "العميل" : "Customer"}
                  className={inputCls}
                  defaultValue=""
                >
                  <option value="">{isAr ? "بدون عميل حالي" : "No existing customer"}</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>{isAr ? "الفرصة" : "Lead"}</label>
                <select
                  name="leadId"
                  aria-label={isAr ? "الفرصة" : "Lead"}
                  className={inputCls}
                  defaultValue=""
                >
                  <option value="">{isAr ? "بدون فرصة" : "No linked lead"}</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.title}
                    </option>
                  ))}
                </select>
              </div>
              <select
                aria-label={isAr ? "الصنف" : "Product"}
                className={inputCls}
                value={productId}
                onChange={(event) => {
                  setProductId(event.target.value);
                  const product = products.find((item) => item.id === event.target.value);
                  if (product) setPrice(String(product.price));
                }}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  dir="ltr"
                  aria-label={isAr ? "الكمية" : "Quantity"}
                  className={inputCls}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
                <input
                  dir="ltr"
                  aria-label={isAr ? "السعر (د.ك)" : "Unit price (KWD)"}
                  className={inputCls}
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                />
              </div>
              <input
                name="validUntil"
                type="date"
                aria-label={isAr ? "صالح حتى تاريخ" : "Valid until"}
                className={inputCls}
              />
              <input
                name="notes"
                aria-label={isAr ? "ملاحظة العرض" : "Quote notes"}
                className={inputCls}
                placeholder={isAr ? "ملاحظة العرض" : "Quote notes"}
              />
              <p className="text-sm font-semibold" style={{ color: "var(--ds-text-primary)" }}>
                {isAr ? "الإجمالي" : "Total"}:{" "}
                <span dir="ltr" className="ds-num tabular-nums" style={{ color: "var(--ds-accent)" }}>
                  {formatKwd(quoteTotal, { locale: resolvedLocale })}
                </span>
              </p>
              <button className={`${btnPrimary} ds-focus-ring min-h-10`} disabled={pending}>
                {isAr ? "حفظ العرض" : "Save Quotation"}
              </button>
            </form>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}

export function QuoteActions({
  id,
  status,
  locale = "ar",
}: {
  id: string;
  status: string;
  locale?: "ar" | "en";
}) {
  const router = useRouter();
  const isAr = locale !== "en";
  const [error, setError] = useState("");

  if (status === "CONVERTED") {
    return (
      <span className="text-xs font-semibold" style={{ color: "var(--ds-positive)" }}>
        {isAr ? "تم التحويل" : "Converted"}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      {error ? (
        <span className="text-xs font-semibold" style={{ color: "var(--ds-negative)" }}>
          {error}
        </span>
      ) : null}
      <a
        className="ds-focus-ring text-xs font-semibold hover:underline"
        style={{ color: "var(--ds-accent)" }}
        href={`/crm/quotes/${id}/print`}
      >
        {isAr ? "طباعة العرض" : "Print quote"}
      </a>
      {status === "DRAFT" ? (
        <button
          type="button"
          className="ds-focus-ring text-xs font-semibold hover:underline"
          style={{ color: "var(--ds-accent)" }}
          onClick={async () => {
            const result = await sendQuotationAction(id);
            if (!result.ok) setError(result.message);
            else router.refresh();
          }}
        >
          {isAr ? "تعليم كمُرسل" : "Mark as sent"}
        </button>
      ) : null}
      <button
        type="button"
        className="ds-focus-ring min-h-8 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
        onClick={async () => {
          const result = await convertQuotationAction(id);
          if (!result.ok) setError(result.message);
          else if (result.id) router.push(`/sales/${result.id}/print`);
          else router.refresh();
        }}
      >
        {isAr ? "تحويل إلى فاتورة مبيعات" : "Convert to sales invoice"}
      </button>
    </div>
  );
}
