"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { deleteRole, saveRole } from "@/app/actions/roles";
import { Modal } from "@/components/modal";
import { Alert, PageHeader, PaginationBar, btnPrimary } from "@/components/erp-ui";
import { SectionCard } from "@/components/ui/section-card";
import { StateBlock } from "@/components/ui/state-block";
import { ExportCsvButton } from "@/components/ui/export-button";
import { formatInt, type FormatLocale } from "@/lib/format";
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

const dsInputClass =
  "ds-focus-ring w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] disabled:cursor-not-allowed disabled:opacity-60";
const dsLabelClass = "mb-1 block text-sm font-semibold text-[var(--ds-text-secondary)]";
const dsGhostBtnClass =
  "ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-primary)] transition hover:bg-[var(--ds-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50";
const dsDangerBtnClass =
  "ds-focus-ring inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--ds-negative-border)] bg-[var(--ds-negative-bg)] px-4 py-2 text-sm font-semibold text-[var(--ds-negative)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

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
    <div className="w-full overflow-x-auto rounded-xl border border-[var(--ds-border-hairline)]">
      <table className="w-full min-w-[460px] border-collapse text-sm">
        <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] text-xs font-bold text-[var(--ds-text-secondary)]">
          <tr>
            <th className="px-3.5 py-2.5 text-start">{en ? "Module" : "القسم"}</th>
            {actions.map(([, label]) => (
              <th key={label} className="px-3 py-2.5 text-center">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--ds-border-hairline)] text-[var(--ds-text-primary)]">
          {MODULES.map((module) => {
            const moduleTitle = t(module.labelKey);
            const row = rows.find((item) => item.module === module.key) ?? {
              module: module.key,
              canView: false,
              canCreate: false,
              canEdit: false,
              canDelete: false,
            };
            return (
              <tr key={module.key} className="hover:bg-[var(--ds-bg-hover)]">
                <td className="px-3.5 py-2.5 font-semibold">{moduleTitle}</td>
                {actions.map(([key, actionLabel]) => (
                  <td key={key} className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${moduleTitle} — ${actionLabel}`}
                      disabled={disabled}
                      checked={row[key]}
                      className="h-4 w-4 accent-emerald-600"
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
  const fmtLocale: FormatLocale = en ? "en" : "ar";
  const [creating, setCreating] = useState(false);

  return (
    <div dir={en ? "ltr" : "rtl"} className="min-w-0 space-y-5">
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
              <button type="button" className={`${btnPrimary} ds-focus-ring`} onClick={() => setCreating(true)}>
                <Plus size={16} aria-hidden />
                {t("iam.role.new")}
              </button>
            ) : null}
          </div>
        }
      />

      <div className="grid min-w-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <SectionCard locale={fmtLocale} padded={false}>
          <form method="get" className="flex gap-2 border-b border-[var(--ds-border-hairline)] p-3">
            <input
              name="q"
              defaultValue={q}
              aria-label={en ? "Search roles" : "بحث عن دور"}
              placeholder={en ? "Search roles" : "بحث عن دور"}
              className={dsInputClass}
            />
            <button type="submit" className={`${btnPrimary} ds-focus-ring shrink-0`}>
              {t("admin.searchButton")}
            </button>
          </form>

          {rows.length === 0 ? (
            <div className="p-4">
              <StateBlock state="empty" compact locale={fmtLocale} title={t("iam.role.empty")} />
            </div>
          ) : (
            <div className="divide-y divide-[var(--ds-border-hairline)]">
              {rows.map((role) => {
                const active = selected?.id === role.id;
                const countStr = formatInt(role.userCount, fmtLocale);
                return (
                  <a
                    key={role.id}
                    href={pageHref("/roles", { q, page, role: role.id })}
                    aria-current={active ? "page" : undefined}
                    className={`ds-focus-ring block px-4 py-3 transition-colors ${
                      active
                        ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-[#04130D]"
                        : "bg-[var(--ds-bg-surface)] text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
                    }`}
                  >
                    <p className="font-bold">{role.name}</p>
                    <p
                      className={`mt-0.5 text-xs ${
                        active ? "text-white/90 dark:text-[#04130D]/80" : "text-[var(--ds-text-muted)]"
                      }`}
                    >
                      <span dir="ltr" className="ds-num tabular-nums">
                        {countStr}
                      </span>{" "}
                      {en ? (role.userCount === 1 ? "user" : "users") : "مستخدم"}
                      {role.isAdmin ? (en ? " • Admin" : " • مدير") : ""}
                    </p>
                  </a>
                );
              })}
            </div>
          )}
          <PaginationBar path="/roles" params={{ q, role: selected?.id }} page={page} total={total} />
        </SectionCard>

        {selected ? (
          <RoleEditor
            key={selected.id}
            role={selected}
            canEdit={canEdit}
            canDelete={canDelete}
            onDone={() => router.refresh()}
          />
        ) : (
          <SectionCard locale={fmtLocale}>
            <StateBlock
              state="empty"
              locale={fmtLocale}
              title={en ? "No role selected" : "لم يتم اختيار دور"}
              description={
                en ? "Select a role to view its permission matrix." : "اختر دوراً لعرض مصفوفة الصلاحيات."
              }
            />
          </SectionCard>
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
  const fmtLocale: FormatLocale = en ? "en" : "ar";
  const savingLabel = t("trade.saving");
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [isAdmin, setIsAdmin] = useState(role.isAdmin);
  const [permissions, setPermissions] = useState(role.permissions);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    <SectionCard title={role.name} subtitle={role.description || undefined} locale={fmtLocale}>
      <div className="space-y-4">
        {error ? <Alert kind="error">{error}</Alert> : null}
        {message ? <Alert kind="ok">{message}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={dsLabelClass}>{t("iam.role.name")}</label>
            <input
              className={dsInputClass}
              value={name}
              disabled={!canEdit}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <label className={dsLabelClass}>{t("iam.role.description")}</label>
            <input
              className={dsInputClass}
              value={description}
              disabled={!canEdit}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--ds-text-primary)]">
          <input
            type="checkbox"
            checked={isAdmin}
            disabled={!canEdit}
            className="h-4 w-4 accent-emerald-600"
            onChange={(event) => {
              const checked = event.target.checked;
              setIsAdmin(checked);
              if (checked) {
                setPermissions(
                  emptyPermissions().map((row) => ({
                    ...row,
                    canView: true,
                    canCreate: true,
                    canEdit: true,
                    canDelete: true,
                  })),
                );
              }
            }}
          />
          {en
            ? "System admin (bypasses the matrix and has all permissions)"
            : "مدير نظام (يتجاوز المصفوفة ويملك كل الصلاحيات)"}
        </label>

        <Matrix rows={permissions} disabled={!canEdit || isAdmin} onChange={setPermissions} />

        <div className="flex flex-wrap items-center gap-2">
          {canEdit ? (
            <button type="button" className={`${btnPrimary} ds-focus-ring`} disabled={pending} onClick={save}>
              {pending ? savingLabel : en ? "Save permissions" : "حفظ الصلاحيات"}
            </button>
          ) : null}
          {canDelete ? (
            confirmDelete ? (
              <>
                <button
                  type="button"
                  className={dsDangerBtnClass}
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    const result = await deleteRole(role.id);
                    setPending(false);
                    if (!result.ok) {
                      setError(result.message);
                      setConfirmDelete(false);
                    } else {
                      onDone();
                    }
                  }}
                >
                  <Trash2 size={16} aria-hidden />
                  {en ? `Confirm delete ${role.name}` : `تأكيد حذف ${role.name}`}
                </button>
                <button
                  type="button"
                  className={dsGhostBtnClass}
                  onClick={() => setConfirmDelete(false)}
                >
                  {t("erp.cancel")}
                </button>
              </>
            ) : (
              <button
                type="button"
                className={dsDangerBtnClass}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={16} aria-hidden />
                {en ? "Delete role" : "حذف الدور"}
              </button>
            )
          ) : null}
          <a href="/roles" className={dsGhostBtnClass}>
            {en ? "All roles" : "كل الأدوار"}
          </a>
        </div>
      </div>
    </SectionCard>
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
          <label className={dsLabelClass}>{t("iam.role.name")}</label>
          <input className={dsInputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <label className={dsLabelClass}>{t("iam.role.description")}</label>
          <input
            className={dsInputClass}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--ds-text-primary)]">
          <input
            type="checkbox"
            checked={isAdmin}
            className="h-4 w-4 accent-emerald-600"
            onChange={(event) => {
              const checked = event.target.checked;
              setIsAdmin(checked);
              if (checked) {
                setPermissions(
                  emptyPermissions().map((row) => ({
                    ...row,
                    canView: true,
                    canCreate: true,
                    canEdit: true,
                    canDelete: true,
                  })),
                );
              }
            }}
          />
          {en ? "System admin" : "مدير نظام"}
        </label>
        <Matrix rows={permissions} disabled={isAdmin} onChange={setPermissions} />
        <button
          type="button"
          className={`${btnPrimary} ds-focus-ring`}
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
