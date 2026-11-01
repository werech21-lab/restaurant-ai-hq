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
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);

  return (
    <div>
      <PageHeader
        title="المستخدمون"
        description="إضافة الحسابات وتغيير الأدوار أو إيقافها دون حذف أثر الحركات."
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportCsvButton kind="users" filename="users.csv" />
            {canCreate ? (
              <button type="button" className={btnPrimary} onClick={() => setEditing("new")}>
                <Plus size={16} />
                مستخدم جديد
              </button>
            ) : null}
          </div>
        }
      />
      <DataCard>
        <form method="get" className="flex flex-wrap gap-2 border-b border-white/10 p-4">
          <input name="q" defaultValue={q} placeholder="بحث بالاسم أو البريد" className={`${fieldClass} max-w-sm`} />
          <button className={btnPrimary}>بحث</button>
          <a href="/users" className={btnGhost}>
            مسح
          </a>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-mist-400">
                <th className="px-4 py-3 text-right font-semibold">الاسم</th>
                <th className="px-4 py-3 text-right font-semibold">البريد</th>
                <th className="px-4 py-3 text-right font-semibold">الدور</th>
                <th className="px-4 py-3 text-right font-semibold">الحالة</th>
                <th className="px-4 py-3 text-right font-semibold">تاريخ الإنشاء</th>
                <th className="px-4 py-3 text-right font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-mist-400">
                    لا يوجد مستخدمون مطابقون.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-white/10 last:border-0">
                    <td className="px-4 py-3 font-semibold">{row.name}</td>
                    <td className="px-4 py-3" dir="ltr">
                      {row.email}
                    </td>
                    <td className="px-4 py-3">{row.roleName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold text-white ${row.isActive ? "bg-emerald-600" : "bg-red-600"}`}
                      >
                        {row.isActive ? "نشط" : "موقوف"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.createdAtLabel}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {canEdit ? (
                          <button type="button" className={btnGhost} onClick={() => setEditing(row)}>
                            <Pencil size={14} />
                            تعديل
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            className={btnDanger}
                            onClick={async () => {
                              if (!confirm(`حذف ${row.name}؟`)) return;
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
  const [role, setRole] = useState<SearchHit | null>(row ? { id: row.roleId, label: row.roleName } : null);
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
    <Modal title={row ? "تعديل مستخدم" : "مستخدم جديد"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error ? <Alert kind="error">{error}</Alert> : null}
        <div>
          <label className={labelClass}>الاسم</label>
          <input name="name" defaultValue={row?.name ?? ""} className={fieldClass} required />
        </div>
        <div>
          <label className={labelClass}>البريد الإلكتروني</label>
          <input name="email" type="email" dir="ltr" defaultValue={row?.email ?? ""} className={`${fieldClass} text-left`} required />
        </div>
        <div>
          <label className={labelClass}>{row ? "كلمة مرور جديدة (اختياري)" : "كلمة المرور"}</label>
          <input name="password" type="password" dir="ltr" className={`${fieldClass} text-left`} placeholder="123456" />
        </div>
        <SearchSelect
          label="الدور"
          placeholder="ابحث عن دور"
          selectedLabel={role?.label}
          search={searchRoles}
          onSelect={setRole}
        />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
          الحساب نشط
        </label>
        <button className={btnPrimary} disabled={pending}>
          {pending ? "جارٍ الحفظ..." : "حفظ"}
        </button>
      </form>
    </Modal>
  );
}
