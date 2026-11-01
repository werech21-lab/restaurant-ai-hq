"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { CustomFields } from "@/components/custom-fields";
import { DocumentForm } from "@/components/document-form";
import { customSummary, parseCustom, readCustom } from "@/lib/custom";
import { ExportCsvButton } from "@/components/ui/export-button";
import { Modal } from "@/components/modal";
import {
  Alert,
  DataCard,
  PageHeader,
  PaginationBar,
  StatusBadge,
  btnDanger,
  btnGhost,
  btnPrimary,
  fieldClass,
  labelClass,
} from "@/components/erp-ui";
import { useI18n } from "@/lib/i18n";
import { pageHref } from "@/lib/pagination";
import type { ActionResult, DocumentInput, PartyInput, SearchHit } from "@/lib/types";

export type OrderRow = {
  id: string;
  number: string;
  party: string;
  dateLabel: string;
  totalLabel: string;
  paidLabel: string;
  status: string;
};

export type PartyRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  balance: number;
  balanceLabel: string;
  customData?: string;
};

export function TradePanel({
  basePath,
  title,
  description,
  tab,
  q,
  page,
  total,
  status,
  orders,
  parties,
  canCreate,
  canEdit,
  canDelete,
  createLabel,
  partyNoun,
  partyPlural,
  paymentTitle,
  paymentHint,
  mode,
  priceKey,
  submitLabel,
  searchParties,
  createDocument,
  saveParty,
  removeParty,
  recordPayment,
  confirmDraft,
}: {
  basePath: string;
  title: string;
  description: string;
  tab: string;
  q: string;
  page: number;
  total: number;
  status: string;
  orders: OrderRow[];
  parties: PartyRow[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  createLabel: string;
  partyNoun: string;
  partyPlural: string;
  paymentTitle: string;
  paymentHint: string;
  mode: "purchase" | "sale";
  priceKey: "costPrice" | "sellingPrice";
  submitLabel: string;
  searchParties: (query: string) => Promise<SearchHit[]>;
  createDocument: (input: DocumentInput) => Promise<ActionResult>;
  saveParty: (input: PartyInput) => Promise<ActionResult>;
  removeParty: (id: string) => Promise<ActionResult>;
  recordPayment: (id: string, amount: number) => Promise<ActionResult>;
  confirmDraft?: (id: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const en = locale === "en";
  const active = tab === "parties" ? "parties" : "documents";
  const [creating, setCreating] = useState(false);
  const [party, setParty] = useState<PartyRow | "new" | null>(null);
  const [paying, setPaying] = useState<PartyRow | null>(null);

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportCsvButton
              kind={mode === "sale" ? "sales" : "purchases"}
              filename={mode === "sale" ? "sales.csv" : "purchases.csv"}
            />
            {active === "documents" && canCreate ? (
              <button type="button" className={btnPrimary} onClick={() => setCreating(true)}>
                <Plus size={16} />
                {createLabel}
              </button>
            ) : null}
            {active === "parties" && canCreate ? (
              <button type="button" className={btnPrimary} onClick={() => setParty("new")}>
                <Plus size={16} />
                {en ? `New ${partyNoun}` : `${partyNoun} جديد`}
              </button>
            ) : null}
          </div>
        }
      />
      <div className="mb-4 flex gap-2">
        <a href={pageHref(basePath, { tab: "documents" })} className={active === "documents" ? btnPrimary : btnGhost}>
          {mode === "sale"
            ? en
              ? "Sales invoices"
              : "فواتير البيع"
            : en
              ? "Purchase orders"
              : "أوامر الشراء"}
        </a>
        <a href={pageHref(basePath, { tab: "parties" })} className={active === "parties" ? btnPrimary : btnGhost}>
          {partyPlural}
        </a>
      </div>
      <DataCard>
        <form method="get" className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
          <input type="hidden" name="tab" value={active} />
          <input
            name="q"
            defaultValue={q}
            placeholder={t("action.search")}
            className={`${fieldClass} max-w-sm`}
          />
          {active === "documents" ? (
            <select name="status" defaultValue={status} className={`${fieldClass} max-w-48`}>
              <option value="">{en ? "All statuses" : "كل الحالات"}</option>
              <option value="PAID">{t("status.paid")}</option>
              <option value="PARTIAL">{t("status.partial")}</option>
              <option value="UNPAID">{t("status.unpaid")}</option>
              {mode === "purchase" ? <option value="DRAFT">{t("status.draft")}</option> : null}
            </select>
          ) : null}
          <button className={btnPrimary}>{t("action.search")}</button>
          <a href={pageHref(basePath, { tab: active })} className={btnGhost}>
            {t("action.clear")}
          </a>
        </form>
        <div className="overflow-x-auto">
          {active === "documents" ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-4 py-3 text-right font-semibold">{en ? "Number" : "الرقم"}</th>
                  <th className="px-4 py-3 text-right font-semibold">{partyNoun}</th>
                  <th className="px-4 py-3 text-right font-semibold">{en ? "Date" : "التاريخ"}</th>
                  <th className="px-4 py-3 text-right font-semibold">{en ? "Total" : "الإجمالي"}</th>
                  <th className="px-4 py-3 text-right font-semibold">{en ? "Paid" : "المدفوع"}</th>
                  <th className="px-4 py-3 text-right font-semibold">{en ? "Status" : "الحالة"}</th>
                  <th className="px-4 py-3 text-right font-semibold">{en ? "Actions" : "إجراءات"}</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                      {en ? "No matching documents." : "لا توجد مستندات مطابقة."}
                    </td>
                  </tr>
                ) : (
                  orders.map((row) => (
                    <tr key={row.id} className="border-b border-slate-200 last:border-0">
                      <td className="px-4 py-3 font-semibold" dir="ltr">
                        {row.number}
                      </td>
                      <td className="px-4 py-3">{row.party}</td>
                      <td className="px-4 py-3">{row.dateLabel}</td>
                      <td className="px-4 py-3">{row.totalLabel}</td>
                      <td className="px-4 py-3">{row.paidLabel}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <a
                            className="font-semibold text-blue-700"
                            href={pageHref(basePath, { tab: active, q, status, page, doc: row.id })}
                          >
                            {en ? "Details" : "التفاصيل"}
                          </a>
                          <a className="inline-flex items-center gap-1 font-semibold text-blue-700" href={`${basePath}/${row.id}/print`}>
                            <Printer size={14} />
                            {en ? "View & print invoice" : "عرض وطباعة الفاتورة"}
                          </a>
                          {row.status === "DRAFT" && confirmDraft ? (
                            <button
                              type="button"
                              className="font-semibold text-blue-700"
                              onClick={async () => {
                                const result = await confirmDraft(row.id);
                                if (!result.ok) window.alert(result.message);
                                else router.refresh();
                              }}
                            >
                              {en ? "Confirm draft & receive stock" : "اعتماد المسودة واستلام المخزون"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-4 py-3 text-right font-semibold">{en ? "Name" : "الاسم"}</th>
                  <th className="px-4 py-3 text-right font-semibold">{en ? "Phone" : "الهاتف"}</th>
                  <th className="px-4 py-3 text-right font-semibold">{en ? "Email" : "البريد"}</th>
                  <th className="px-4 py-3 text-right font-semibold">
                    {mode === "sale"
                      ? en
                        ? "Customer balance"
                        : "مديونية العميل"
                      : en
                        ? "Payable to supplier"
                        : "مستحق للمورد"}
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">{en ? "Actions" : "إجراءات"}</th>
                </tr>
              </thead>
              <tbody>
                {parties.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                      {en ? "No results." : "لا توجد نتائج."}
                    </td>
                  </tr>
                ) : (
                  parties.map((row) => (
                    <tr key={row.id} className="border-b border-slate-200 last:border-0">
                      <td className="px-4 py-3">
                        <a className="font-semibold text-blue-700" href={mode === "sale" ? `/sales/customers/${row.id}` : `/purchases/suppliers/${row.id}`}>
                          {row.name}
                        </a>
                        {customSummary(row.customData) ? <p className="text-xs text-slate-500">{customSummary(row.customData)}</p> : null}
                      </td>
                      <td className="px-4 py-3" dir="ltr">
                        {row.phone || "—"}
                      </td>
                      <td className="px-4 py-3" dir="ltr">
                        {row.email || "—"}
                      </td>
                      <td className="px-4 py-3 font-bold">{row.balanceLabel}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {canEdit && row.balance > 0 ? (
                            <button type="button" className={btnPrimary} onClick={() => setPaying(row)}>
                              <Banknote size={14} />
                              {paymentTitle}
                            </button>
                          ) : null}
                          {canEdit ? (
                            <button type="button" className={btnGhost} onClick={() => setParty(row)}>
                              <Pencil size={14} />
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button
                              type="button"
                              className={btnDanger}
                              onClick={async () => {
                                if (!confirm(en ? `Delete ${row.name}?` : `حذف ${row.name}؟`)) return;
                                const result = await removeParty(row.id);
                                if (!result.ok) alert(result.message);
                                else router.refresh();
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        <PaginationBar path={basePath} params={{ tab: active, q, status: active === "documents" ? status : "" }} page={page} total={total} />
      </DataCard>
      {creating ? (
        <Modal title={submitLabel} onClose={() => setCreating(false)} wide>
          <DocumentForm
            mode={mode}
            partyLabel={partyNoun}
            partyPlaceholder={en ? `Search ${partyNoun}` : `ابحث عن ${partyNoun}`}
            searchParties={searchParties}
            priceKey={priceKey}
            submitLabel={submitLabel}
            onSubmit={async (input) => {
              const result = await createDocument(input);
              if (result.ok) {
                setCreating(false);
                router.refresh();
              }
              return result;
            }}
          />
        </Modal>
      ) : null}
      {party ? (
        <PartyDialog
          title={party === "new" ? (en ? `New ${partyNoun}` : `${partyNoun} جديد`) : en ? `Edit ${partyNoun}` : `تعديل ${partyNoun}`}
          row={party === "new" ? null : party}
          entityType={mode === "sale" ? "CUSTOMER" : "SUPPLIER"}
          onClose={() => setParty(null)}
          onSave={async (input) => {
            const result = await saveParty(input);
            if (result.ok) {
              setParty(null);
              router.refresh();
            }
            return result;
          }}
        />
      ) : null}
      {paying ? (
        <PaymentDialog
          title={paymentTitle}
          hint={paymentHint}
          balanceLabel={paying.balanceLabel}
          max={paying.balance}
          onClose={() => setPaying(null)}
          onSave={async (amount) => {
            const result = await recordPayment(paying.id, amount);
            if (result.ok) {
              setPaying(null);
              router.refresh();
            }
            return result;
          }}
        />
      ) : null}
    </div>
  );
}

function PartyDialog({
  title,
  row,
  entityType,
  onClose,
  onSave,
}: {
  title: string;
  row: PartyRow | null;
  entityType: "CUSTOMER" | "SUPPLIER";
  onClose: () => void;
  onSave: (input: PartyInput) => Promise<ActionResult>;
}) {
  const { locale, t } = useI18n();
  const en = locale === "en";
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customData = readCustom(form);
    setPending(true);
    const result = await onSave({
      id: row?.id,
      name: String(form.get("name") || ""),
      phone: String(form.get("phone") || ""),
      email: String(form.get("email") || ""),
      ...(Object.keys(customData).length > 0 ? { customData } : {}),
    });
    setPending(false);
    if (!result.ok) setError(result.message);
  }
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error ? <Alert kind="error">{error}</Alert> : null}
        <div>
          <label className={labelClass}>{en ? "Name" : "الاسم"}</label>
          <input name="name" defaultValue={row?.name ?? ""} className={fieldClass} required />
        </div>
        <div>
          <label className={labelClass}>{en ? "Phone" : "الهاتف"}</label>
          <input name="phone" dir="ltr" defaultValue={row?.phone ?? ""} className={`${fieldClass} text-left`} />
        </div>
        <div>
          <label className={labelClass}>{en ? "Email" : "البريد"}</label>
          <input name="email" dir="ltr" defaultValue={row?.email ?? ""} className={`${fieldClass} text-left`} />
        </div>
        <CustomFields entityType={entityType} initial={parseCustom(row?.customData)} />
        <button className={btnPrimary} disabled={pending}>
          {pending ? (en ? "Saving…" : "جارٍ الحفظ...") : t("action.save")}
        </button>
      </form>
    </Modal>
  );
}

function PaymentDialog({
  title,
  hint,
  balanceLabel,
  max,
  onClose,
  onSave,
}: {
  title: string;
  hint: string;
  balanceLabel: string;
  max: number;
  onClose: () => void;
  onSave: (amount: number) => Promise<ActionResult>;
}) {
  const { locale } = useI18n();
  const en = locale === "en";
  const [amount, setAmount] = useState(String(max));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          const result = await onSave(Number(amount));
          setPending(false);
          if (!result.ok) setError(result.message);
        }}
      >
        {error ? <Alert kind="error">{error}</Alert> : null}
        <p className="text-sm text-slate-600">{hint}</p>
        <p className="font-bold text-slate-900">
          {en ? "Current balance:" : "الرصيد الحالي:"} {balanceLabel}
        </p>
        <div>
          <label className={labelClass}>{en ? "Amount" : "المبلغ"}</label>
          <input dir="ltr" className={fieldClass} value={amount} onChange={(event) => setAmount(event.target.value)} />
        </div>
        <button className={btnPrimary} disabled={pending}>
          {pending ? (en ? "Posting…" : "جارٍ التسجيل...") : en ? "Record payment" : "تسجيل الدفعة"}
        </button>
      </form>
    </Modal>
  );
}
