"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { searchRoles } from "@/app/actions/search";
import { deleteUser, saveUser } from "@/app/actions/users";
import { Modal } from "@/components/modal";
import { SearchSelect } from "@/components/search-select";
import { Alert, PageHeader, PaginationBar, btnPrimary } from "@/components/erp-ui";
import { SectionCard } from "@/components/ui/section-card";
import { StateBlock } from "@/components/ui/state-block";
import { ExportCsvButton } from "@/components/ui/export-button";
import {
  UNAVAILABLE_DASH,
  formatInt,
  getUnavailableTooltip,
  type FormatLocale,
} from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { displayRoleName, displayTeamName } from "@/lib/venture-foods-team";
import type { SearchHit } from "@/lib/types";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  roleId: string;
  roleName: string;
  createdAtLabel: string;
};

const dsInputClass =
  "ds-focus-ring w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]";
const dsLabelClass = "mb-1 block text-sm font-semibold text-[var(--ds-text-secondary)]";
const dsGhostBtnClass =
  "ds-focus-ring inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-3.5 py-1.5 text-sm font-semibold text-[var(--ds-text-primary)] transition hover:bg-[var(--ds-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50";
const dsDangerBtnClass =
  "ds-focus-ring inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] px-3 py-1.5 text-sm font-semibold text-[var(--ds-negative)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export function UsersPanel({
  rows,
  page,
  total,
  q,
  canCreate,
  canEdit,
  canDelete,
}: {
  rows: UserRow[];
  page: number;
  total: number;
  q: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { locale } = useI18n();
  const en = locale === "en";
  const fmtLocale: FormatLocale = en ? "en" : "ar";
  const unavailableTooltip = getUnavailableTooltip(fmtLocale);
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <div dir={en ? "ltr" : "rtl"} className="w-full max-w-none min-w-0 space-y-5">
      <PageHeader
        title={en ? "Users & Permissions Management" : "إدارة المستخدمين والصلاحيات"}
        description={
          en
            ? "Create accounts, assign roles, and manage permissions for Venture Foods Restaurant Management Co. W.L.L."
            : "إدارة حسابات المستخدمين وتعيين الأدوار والصلاحيات لشركة فنتشر فودز لإدارة المطاعم ذ.م.م."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportCsvButton
              kind="users"
              filename="users.csv"
              label={en ? "Export Users CSV" : "تصدير كشف المستخدمين (CSV)"}
            />
            {canCreate ? (
              <button
                type="button"
                className={`${btnPrimary} ds-focus-ring`}
                onClick={() => setEditing("new")}
              >
                <Plus size={16} aria-hidden />
                {en ? "New User" : "إضافة مستخدم جديد"}
              </button>
            ) : null}
          </div>
        }
      />

      {actionError ? <Alert kind="error">{actionError}</Alert> : null}

      <SectionCard
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span>{en ? "Registered Accounts" : "الحسابات المسجّلة"}</span>
            <span
              dir="ltr"
              className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-2.5 py-0.5 text-xs font-bold tabular-nums"
            >
              {formatInt(total, fmtLocale)}
            </span>
          </span>
        }
        locale={fmtLocale}
        padded={false}
      >
        <form
          method="get"
          className="flex flex-wrap items-center gap-2.5 border-b border-[var(--ds-border-hairline)] p-4"
        >
          <input
            name="q"
            defaultValue={q}
            aria-label={en ? "Search by name or email" : "البحث بالاسم أو البريد الإلكتروني"}
            placeholder={en ? "Search by name or email..." : "البحث بالاسم أو البريد الإلكتروني..."}
            className={`${dsInputClass} min-w-[200px] flex-1 sm:max-w-md`}
          />
          <button type="submit" className={`${btnPrimary} ds-focus-ring`}>
            {en ? "Search" : "بحث"}
          </button>
          <a href="/users" className={dsGhostBtnClass}>
            {en ? "Clear" : "إلغاء التصفية"}
          </a>
        </form>

        {rows.length === 0 ? (
          <div className="p-4">
            <StateBlock
              state="empty"
              locale={fmtLocale}
              title={en ? "No matching users" : "لا يوجد مستخدمون مطابقون"}
              description={
                en
                  ? "Try clearing the search query or create a new account."
                  : "جرّب مسح عبارة البحث أو إضافة حساب جديد."
              }
            />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] text-xs font-bold text-[var(--ds-text-secondary)]">
                <tr>
                  <th className="px-4 py-3 text-start">{en ? "Name" : "اسم المستخدم"}</th>
                  <th className="px-4 py-3 text-start">{en ? "Email" : "البريد الإلكتروني"}</th>
                  <th className="px-4 py-3 text-start">{en ? "Role" : "الدور والصلاحية"}</th>
                  <th className="px-4 py-3 text-start">{en ? "Status" : "الحالة"}</th>
                  <th className="px-4 py-3 text-start">{en ? "Created At" : "تاريخ الإنشاء"}</th>
                  <th className="px-4 py-3 text-start">{en ? "Actions" : "الإجراءات"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ds-border-hairline)] text-[var(--ds-text-primary)]">
                {rows.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-[var(--ds-bg-hover)]">
                    <td className="px-4 py-3 font-semibold">
                      {displayTeamName(row.name, locale)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--ds-text-secondary)]">
                      {row.email ? (
                        <span dir="ltr">{row.email}</span>
                      ) : (
                        <span
                          dir="ltr"
                          title={unavailableTooltip}
                          aria-label={unavailableTooltip}
                          data-unavailable="true"
                          style={{ color: "var(--ds-unavailable)" }}
                        >
                          {UNAVAILABLE_DASH}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--ds-text-secondary)]">
                      {displayRoleName(row.roleName, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                          row.isActive
                            ? "border-[var(--ds-positive-border)] bg-[var(--ds-positive-bg)] text-[var(--ds-positive)]"
                            : "border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] text-[var(--ds-negative)]"
                        }`}
                      >
                        {row.isActive ? (en ? "Active" : "نشط ومفعّل") : en ? "Inactive" : "موقوف"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--ds-text-secondary)]">
                      <span dir="ltr" className="ds-num whitespace-nowrap tabular-nums">
                        {row.createdAtLabel || UNAVAILABLE_DASH}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {canEdit ? (
                          <button
                            type="button"
                            className={dsGhostBtnClass}
                            onClick={() => setEditing(row)}
                          >
                            <Pencil size={14} aria-hidden />
                            {en ? "Edit" : "تعديل"}
                          </button>
                        ) : null}
                        {canDelete ? (
                          confirmDeleteId === row.id ? (
                            <>
                              <button
                                type="button"
                                className={dsDangerBtnClass}
                                disabled={busyId === row.id}
                                onClick={async () => {
                                  setActionError("");
                                  setBusyId(row.id);
                                  const result = await deleteUser(row.id);
                                  setBusyId(null);
                                  setConfirmDeleteId(null);
                                  if (!result.ok) setActionError(result.message);
                                  else router.refresh();
                                }}
                              >
                                <Trash2 size={14} aria-hidden />
                                {en ? "Confirm" : "تأكيد"}
                              </button>
                              <button
                                type="button"
                                className={dsGhostBtnClass}
                                onClick={() => setConfirmDeleteId(null)}
                              >
                                {en ? "Cancel" : "إلغاء"}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className={dsDangerBtnClass}
                              aria-label={
                                en
                                  ? `Delete ${displayTeamName(row.name, locale)}`
                                  : `حذف ${displayTeamName(row.name, locale)}`
                              }
                              title={
                                en
                                  ? `Delete ${displayTeamName(row.name, locale)}`
                                  : `حذف ${displayTeamName(row.name, locale)}`
                              }
                              onClick={() => setConfirmDeleteId(row.id)}
                            >
                              <Trash2 size={14} aria-hidden />
                            </button>
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <PaginationBar path="/users" params={{ q }} page={page} total={total} />
      </SectionCard>

      {editing ? (
        <UserDialog
          row={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function UserDialog({
  row,
  onClose,
  onSaved,
}: {
  row: UserRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { locale } = useI18n();
  const en = locale === "en";
  const [role, setRole] = useState<SearchHit | null>(
    row ? { id: row.roleId, label: displayRoleName(row.roleName, locale) } : null,
  );
  const [active, setActive] = useState(row?.isActive ?? true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const result = await saveUser({
      id: row?.id,
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      password: row ? "" : String(form.get("password") || ""),
      roleId: role?.id ?? "",
      isActive: active,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved();
  }

  return (
    <Modal
      title={row ? (en ? "Edit User" : "تعديل بيانات المستخدم") : en ? "New User" : "إضافة مستخدم جديد"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        {error ? <Alert kind="error">{error}</Alert> : null}
        <div>
          <label className={dsLabelClass}>{en ? "Name" : "الاسم الثلاثي"}</label>
          <input
            name="name"
            defaultValue={row ? displayTeamName(row.name, locale) : ""}
            className={dsInputClass}
            required
          />
        </div>
        <div>
          <label className={dsLabelClass}>{en ? "Email" : "البريد الإلكتروني المؤسسي"}</label>
          <input
            name="email"
            type="email"
            dir="ltr"
            defaultValue={row?.email ?? ""}
            className={`${dsInputClass} text-left`}
            required
          />
        </div>
        {row ? (
          <p className="text-xs text-[var(--ds-text-muted)]">
            {en ? "The current password stays as it is." : "كلمة المرور الحالية تبقى كما هي."}
          </p>
        ) : (
          <div>
            <label className={dsLabelClass}>{en ? "Password" : "كلمة المرور"}</label>
            <input
              name="password"
              type="password"
              dir="ltr"
              className={`${dsInputClass} text-left`}
              placeholder={en ? "Enter explicit password" : "أدخل كلمة مرور صريحة"}
            />
          </div>
        )}
        <SearchSelect
          label={en ? "Role" : "الدور الوظيفي والصلاحيات"}
          placeholder={en ? "Search for a role" : "ابحث عن الدور الوظيفي..."}
          selectedLabel={role?.label}
          search={searchRoles}
          onSelect={setRole}
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--ds-text-primary)]">
          <input
            type="checkbox"
            checked={active}
            className="h-4 w-4 accent-emerald-600"
            onChange={(event) => setActive(event.target.checked)}
          />
          {en ? "Account active" : "الحساب نشط ومفعّل"}
        </label>
        <button className={`${btnPrimary} ds-focus-ring`} disabled={pending}>
          {pending ? (en ? "Saving…" : "جارٍ الحفظ...") : en ? "Save" : "حفظ التغييرات"}
        </button>
      </form>
    </Modal>
  );
}
