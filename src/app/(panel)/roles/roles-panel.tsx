"use client";

import { useMemo, useState } from "react";
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
import { useI18n } from "@/lib/i18n";
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

function Matrix({
  rows,
  disabled,
  onChange,
}: {
  rows: PermissionSnapshot[];
  disabled?: boolean;
  onChange: (next: PermissionSnapshot[]) => void;
}) {
  const { locale, t } = useI18n();
  const en = locale === "en";
  const actions = useMemo(
    () =>
      [
        ["canView", en ? "View" : "عرض"],
        ["canCreate", en ? "Create" : "إضافة"],
        ["canEdit", en ? "Edit" : "تعديل"],
        ["canDelete", en ? "Delete" : "حذف"],
      ] as const,
    [en],
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-mist-400">
            <th className="px-3 py-2 text-right font-semibold">{en ? "Module" : "القسم"}</th>
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
              <tr key={module.key} className="border-b border-white/10 last:border-0">
                <td className="px-3 py-2 font-semibold">{t(module.labelKey)}</td>
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
  const { locale, t } = useI18n();
  const en = locale === "en";
  const [creating, setCreating] = useState(false);
  return (
    <div>
      <PageHeader
        title={t("nav.roles")}
        description={
          en
            ? "View, create, edit, and delete matrix per module — applied to users immediately."
            : "مصفوفة عرض وإضافة وتعديل وحذف لكل قسم، وتُطبَّق فوراً على المستخدمين."
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <ExportCsvButton kind="roles" filename="roles.csv" />
            {canCreate ? (
              <button type="button" className={btnPrimary} onClick={() => setCreating(true)}>
                <Plus size={16} />
                {t("iam.role.new")}
              </button>
            ) : null}
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <DataCard>
          <form method="get" className="flex gap-2 border-b border-white/10 p-3">
            <input
              name="q"
              defaultValue={q}
              placeholder={en ? "Search roles" : "بحث عن دور"}
              className={fieldClass}
            />
            <button className={btnPrimary}>{t("admin.searchButton")}</button>
          </form>
          <div>
            {rows.map((role) => (
              <a
                key={role.id}
                href={pageHref("/roles", { q, page, role: role.id })}
                className={`block border-b border-white/10 px-4 py-3 ${selected?.id === role.id ? "bg-[#00a99d] text-white" : "bg-ink-900/80"}`}
              >
                <p className="font-bold">{role.name}</p>
                <p className={`text-xs ${selected?.id === role.id ? "text-white" : "text-mist-400"}`}>
                  {en
                    ? `${role.userCount} user${role.userCount === 1 ? "" : "s"}${role.isAdmin ? " • Admin" : ""}`
                    : `${role.userCount} مستخدم ${role.isAdmin ? "• مدير" : ""}`}
                </p>
              </a>
            ))}
            {rows.length === 0 ? <p className="p-4 text-sm text-mist-400">{t("iam.role.empty")}</p> : null}
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
            <p className="p-6 text-sm text-mist-400">
              {en ? "Select a role to view its permission matrix." : "اختر دوراً لعرض مصفوفة الصلاحيات."}
            </p>
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
  const { locale, t } = useI18n();
  const en = locale === "en";
  const savingLabel = t("trade.saving");
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
    setMessage(result.message || t("suite.saved"));
    onDone();
  }

  return (
    <DataCard>
      <div className="space-y-4 p-5">
        {error ? <Alert kind="error">{error}</Alert> : null}
        {message ? <Alert kind="ok">{message}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{t("iam.role.name")}</label>
            <input className={fieldClass} value={name} disabled={!canEdit} onChange={(event) => setName(event.target.value)} />
          </div>
          <div>
            <label className={labelClass}>{t("iam.role.description")}</label>
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
          {en
            ? "System admin (bypasses the matrix and has all permissions)"
            : "مدير نظام (يتجاوز المصفوفة ويملك كل الصلاحيات)"}
        </label>
        <Matrix rows={permissions} disabled={!canEdit || isAdmin} onChange={setPermissions} />
        <div className="flex gap-2">
          {canEdit ? (
            <button type="button" className={btnPrimary} disabled={pending} onClick={save}>
              {pending ? savingLabel : en ? "Save permissions" : "حفظ الصلاحيات"}
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              className={btnDanger}
              onClick={async () => {
                if (!confirm(en ? `Delete role ${role.name}?` : `حذف دور ${role.name}؟`)) return;
                const result = await deleteRole(role.id);
                if (!result.ok) setError(result.message);
                else onDone();
              }}
            >
              <Trash2 size={16} />
              {en ? "Delete role" : "حذف الدور"}
            </button>
          ) : null}
          <a href="/roles" className={btnGhost}>
            {en ? "All roles" : "كل الأدوار"}
          </a>
        </div>
      </div>
    </DataCard>
  );
}

function CreateRole({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { locale, t } = useI18n();
  const en = locale === "en";
  const savingLabel = t("trade.saving");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState(emptyPermissions());
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <Modal title={t("iam.role.new")} onClose={onClose} wide>
      <div className="space-y-3">
        {error ? <Alert kind="error">{error}</Alert> : null}
        <div>
          <label className={labelClass}>{t("iam.role.name")}</label>
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t("iam.role.description")}</label>
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
          {en ? "System admin" : "مدير نظام"}
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
          {pending ? savingLabel : en ? "Create role" : "إنشاء الدور"}
        </button>
      </div>
    </Modal>
  );
}
