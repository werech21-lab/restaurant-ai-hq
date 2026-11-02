"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { searchRoles } from "@/app/actions/search";
import { deleteUser, saveUser } from "@/app/actions/users";
import { Modal } from "@/components/modal";
import { ExportCsvButton } from "@/components/ui/export-button";
import { SearchSelect } from "@/components/search-select";
import {
  Alert,
  DataCard,
  PageHeader,
  PaginationBar,
  btnDanger,
  btnGhost,
  btnPrimary,
  fieldClass,
  labelClass,
} from "@/components/erp-ui";
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
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);

  return (
    <div>
      <PageHeader
        title={en ? "Users Management" : "المستخدمون"}
        description={
          en
            ? "Create accounts, assign roles, or deactivate users while preserving full audit trails."
            : "إضافة الحسابات وتغيير الأدوار أو إيقافها دون حذف أثر الحركات."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportCsvButton kind="users" filename="users.csv" />
            {canCreate ? (
              <button type="button" className={btnPrimary} onClick={() => setEditing("new")}>
                <Plus size={16} />
                {en ? "+ New User" : "+ مستخدم جديد"}
              </button>
            ) : null}
          </div>
        }
      />
      <DataCard>
        <form method="get" className="flex flex-wrap gap-2 border-b border-white/10 p-4">
          <input
            name="q"
            defaultValue={q}
            placeholder={en ? "Search by name or email..." : "بحث بالاسم أو البريد"}
            className={`${fieldClass} max-w-sm`}
          />
          <button className={btnPrimary}>{en ? "Search" : "بحث"}</button>
          <a href="/users" className={btnGhost}>
            {en ? "Clear" : "مسح"}
          </a>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-mist-400">
                <th className="px-4 py-3 text-right font-semibold">{en ? "Name" : "الاسم"}</th>
                <th className="px-4 py-3 text-right font-semibold">{en ? "Email" : "البريد"}</th>
                <th className="px-4 py-3 text-right font-semibold">{en ? "Role" : "الدور"}</th>
                <th className="px-4 py-3 text-right font-semibold">{en ? "Status" : "الحالة"}</th>
                <th className="px-4 py-3 text-right font-semibold">{en ? "Created At" : "تاريخ الإنشاء"}</th>
                <th className="px-4 py-3 text-right font-semibold">{en ? "Actions" : "إجراءات"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-mist-400">
                    {en ? "No matching users." : "لا يوجد مستخدمون مطابقون."}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-white/10 last:border-0">
                    <td className="px-4 py-3 font-semibold">{displayTeamName(row.name, locale)}</td>
                    <td className="px-4 py-3" dir="ltr">
                      {row.email}
                    </td>
                    <td className="px-4 py-3">{displayRoleName(row.roleName, locale)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold text-white ${row.isActive ? "bg-emerald-600" : "bg-red-600"}`}
                      >
                        {row.isActive ? (en ? "Active" : "نشط") : en ? "Inactive" : "موقوف"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.createdAtLabel}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {canEdit ? (
                          <button type="button" className={btnGhost} onClick={() => setEditing(row)}>
                            <Pencil size={14} />
                            {en ? "Edit" : "تعديل"}
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            className={btnDanger}
                            onClick={async () => {
                              const label = displayTeamName(row.name, locale);
                              if (!confirm(en ? `Delete ${label}?` : `حذف ${label}؟`)) return;
                              const result = await deleteUser(row.id);
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
        </div>
        <PaginationBar path="/users" params={{ q }} page={page} total={total} />
      </DataCard>
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
      password: String(form.get("password") || ""),
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
    <Modal title={row ? (en ? "Edit User" : "تعديل مستخدم") : en ? "New User" : "مستخدم جديد"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error ? <Alert kind="error">{error}</Alert> : null}
        <div>
          <label className={labelClass}>{en ? "Name" : "الاسم"}</label>
          <input
            name="name"
            defaultValue={row ? displayTeamName(row.name, locale) : ""}
            className={fieldClass}
            required
          />
        </div>
        <div>
          <label className={labelClass}>{en ? "Email" : "البريد الإلكتروني"}</label>
          <input name="email" type="email" dir="ltr" defaultValue={row?.email ?? ""} className={`${fieldClass} text-left`} required />
        </div>
        <div>
          <label className={labelClass}>
            {row ? (en ? "New password (optional)" : "كلمة مرور جديدة (اختياري)") : en ? "Password" : "كلمة المرور"}
          </label>
          <input name="password" type="password" dir="ltr" className={`${fieldClass} text-left`} placeholder="123456" />
        </div>
        <SearchSelect
          label={en ? "Role" : "الدور"}
          placeholder={en ? "Search for a role" : "ابحث عن دور"}
          selectedLabel={role?.label}
          search={searchRoles}
          onSelect={setRole}
        />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          {en ? "Account active" : "الحساب نشط"}
        </label>
        <button className={btnPrimary} disabled={pending}>
          {pending ? (en ? "Saving…" : "جارٍ الحفظ...") : en ? "Save" : "حفظ"}
        </button>
      </form>
    </Modal>
  );
}
