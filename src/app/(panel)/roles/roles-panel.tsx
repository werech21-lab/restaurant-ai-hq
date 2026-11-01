"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { deleteRole, saveRole } from "@/app/actions/roles";
import { Modal } from "@/components/modal";
import { ExportCsvButton } from "@/components/ui/export-button";
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
import { pageHref } from "@/lib/pagination";
import { MODULES } from "@/lib/modules";
import { emptyPermissions, type PermissionSnapshot } from "@/lib/permissions";

export type RoleRow = {
  id: string;
  name: string;
  description: string;
  isAdmin: boolean;
  userCount: number;
};

const actions = [
  ["canView", "عرض"],
  ["canCreate", "إضافة"],
  ["canEdit", "تعديل"],
  ["canDelete", "حذف"],
] as const;

function Matrix({
  rows,
  disabled,
  onChange,
}: {
  rows: PermissionSnapshot[];
  disabled?: boolean;
  onChange: (next: PermissionSnapshot[]) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="px-3 py-2 text-right font-semibold">القسم</th>
            {actions.map(([, label]) => (
              <th key={label} className="px-3 py-2 text-center font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULES.map((module) => {
            const row = rows.find((item) => item.module === module.key) ?? {
              module: module.key,
              canView: false,
              canCreate: false,
              canEdit: false,
              canDelete: false,
            };
            return (
              <tr key={module.key} className="border-b border-slate-200 last:border-0">
                <td className="px-3 py-2 font-semibold">{module.label}</td>
                {actions.map(([key]) => (
                  <td key={key} className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={row[key]}
                      onChange={(event) =>
                        onChange(
                          MODULES.map((item) => {
                            const current = rows.find((entry) => entry.module === item.key) ?? {
                              module: item.key,
                              canView: false,
                              canCreate: false,
                              canEdit: false,
                              canDelete: false,
                            };
                            if (item.key !== module.key) return current;
                            return { ...current, [key]: event.target.checked };
                          }),
                        )
                      }
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RolesPanel({
  rows,
  selected,
  page,
  total,
  q,
  canCreate,
  canEdit,
  canDelete,
}: {
  rows: RoleRow[];
  selected: (RoleRow & { permissions: PermissionSnapshot[] }) | null;
  page: number;
  total: number;
  q: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  return (
    <div>
      <PageHeader
        title="الأدوار والصلاحيات"
        description="مصفوفة عرض وإضافة وتعديل وحذف لكل قسم، وتُطبَّق فوراً على المستخدمين."
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportCsvButton kind="roles" filename="roles.csv" />
            {canCreate ? (
              <button type="button" className={btnPrimary} onClick={() => setCreating(true)}>
                <Plus size={16} />
                دور جديد
              </button>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <DataCard>
          <form method="get" className="flex gap-2 border-b border-slate-200 p-3">
            <input name="q" defaultValue={q} placeholder="بحث عن دور" className={fieldClass} />
            <button className={btnPrimary}>بحث</button>
          </form>
          <div>
            {rows.map((role) => (
              <a
                key={role.id}
                href={pageHref("/roles", { q, page, role: role.id })}
                className={`block border-b border-slate-200 px-4 py-3 ${selected?.id === role.id ? "bg-blue-600 text-white" : "bg-white"}`}
              >
                <p className="font-bold">{role.name}</p>
                <p className={`text-xs ${selected?.id === role.id ? "text-white" : "text-slate-500"}`}>
                  {role.userCount} مستخدم {role.isAdmin ? "• مدير" : ""}
                </p>
              </a>
            ))}
            {rows.length === 0 ? <p className="p-4 text-sm text-slate-500">لا توجد أدوار.</p> : null}
          </div>
          <PaginationBar path="/roles" params={{ q, role: selected?.id }} page={page} total={total} />
        </DataCard>
        {selected ? (
          <RoleEditor
            key={selected.id}
            role={selected}
            canEdit={canEdit}
            canDelete={canDelete}
            onDone={() => router.refresh()}
          />
        ) : (
          <DataCard>
            <p className="p-6 text-sm text-slate-600">اختر دوراً لعرض مصفوفة الصلاحيات.</p>
          </DataCard>
        )}
      </div>
      {creating ? (
        <CreateRole
          onClose={() => setCreating(false)}
          onDone={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function RoleEditor({
  role,
  canEdit,
  canDelete,
  onDone,
}: {
  role: RoleRow & { permissions: PermissionSnapshot[] };
  canEdit: boolean;
  canDelete: boolean;
  onDone: () => void;
}) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [isAdmin, setIsAdmin] = useState(role.isAdmin);
  const [permissions, setPermissions] = useState(role.permissions);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setError("");
    const result = await saveRole({ id: role.id, name, description, isAdmin, permissions });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMessage(result.message || "تم الحفظ");
    onDone();
  }

  return (
    <DataCard>
      <div className="space-y-4 p-5">
        {error ? <Alert kind="error">{error}</Alert> : null}
        {message ? <Alert kind="ok">{message}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>اسم الدور</label>
            <input className={fieldClass} value={name} disabled={!canEdit} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className={labelClass}>الوصف</label>
            <input
              className={fieldClass}
              value={description}
              disabled={!canEdit}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={isAdmin}
            disabled={!canEdit}
            onChange={(event) => {
              const checked = event.target.checked;
              setIsAdmin(checked);
              if (checked) {
                setPermissions(emptyPermissions().map((row) => ({ ...row, canView: true, canCreate: true, canEdit: true, canDelete: true })));
              }
            }}
          />
          مدير نظام (يتجاوز المصفوفة ويملك كل الصلاحيات)
        </label>
        <Matrix rows={permissions} disabled={!canEdit || isAdmin} onChange={setPermissions} />
        <div className="flex gap-2">
          {canEdit ? (
            <button type="button" className={btnPrimary} disabled={pending} onClick={save}>
              {pending ? "جارٍ الحفظ..." : "حفظ الصلاحيات"}
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              className={btnDanger}
              onClick={async () => {
                if (!confirm(`حذف دور ${role.name}؟`)) return;
                const result = await deleteRole(role.id);
                if (!result.ok) setError(result.message);
                else onDone();
              }}
            >
              <Trash2 size={16} />
              حذف الدور
            </button>
          ) : null}
          <a href="/roles" className={btnGhost}>
            كل الأدوار
          </a>
        </div>
      </div>
    </DataCard>
  );
}

function CreateRole({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState(emptyPermissions());
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <Modal title="دور جديد" onClose={onClose} wide>
      <div className="space-y-3">
        {error ? <Alert kind="error">{error}</Alert> : null}
        <div>
          <label className={labelClass}>اسم الدور</label>
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <label className={labelClass}>الوصف</label>
          <input className={fieldClass} value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={(event) => {
              const checked = event.target.checked;
              setIsAdmin(checked);
              if (checked) {
                setPermissions(emptyPermissions().map((row) => ({ ...row, canView: true, canCreate: true, canEdit: true, canDelete: true })));
              }
            }}
          />
          مدير نظام
        </label>
        <Matrix rows={permissions} disabled={isAdmin} onChange={setPermissions} />
        <button
          type="button"
          className={btnPrimary}
          disabled={pending}
          onClick={async () => {
            setPending(true);
            const result = await saveRole({ name, description, isAdmin, permissions });
            setPending(false);
            if (!result.ok) setError(result.message);
            else onDone();
          }}
        >
          {pending ? "جارٍ الحفظ..." : "إنشاء الدور"}
        </button>
      </div>
    </Modal>
  );
}
