import Link from "next/link";
import { PageHeader, PaginationBar } from "@/components/erp-ui";
import { btnPrimary } from "@/components/erp-ui-classes";
import { SectionCard, StateBlock } from "@/components/ui";
import { ExportCsvButton } from "@/components/ui/export-button";
import { UNAVAILABLE_DASH, formatDateTime, formatInt, getUnavailableTooltip } from "@/lib/format";
import { moduleNavLabel } from "@/lib/i18n/auto-translate";
import type { Locale } from "@/lib/i18n";
import { MODULES } from "@/lib/modules";

export type AuditRow = {
  id: string;
  createdAt: Date | string;
  module: string;
  action: string;
  details: string;
  user: { name: string | null; email: string | null } | null;
};

export type AuditViewProps = {
  locale: Locale;
  q: string;
  moduleKey: string;
  page: number;
  total: number;
  rows: AuditRow[];
  hasError?: boolean;
};

function UnavailableDash({ tooltip }: { tooltip: string }) {
  return (
    <span
      dir="ltr"
      title={tooltip}
      aria-label={tooltip}
      data-unavailable="true"
      className="ds-num tabular-nums"
      style={{ color: "var(--ds-unavailable)" }}
    >
      {UNAVAILABLE_DASH}
    </span>
  );
}

export function AuditLogView({
  locale,
  q,
  moduleKey,
  page,
  total,
  rows,
  hasError = false,
}: AuditViewProps) {
  const isAr = locale !== "en";
  const dir = isAr ? "rtl" : "ltr";
  const label = (ar: string, en: string) => (isAr ? ar : en);
  const unavailableTooltip = getUnavailableTooltip(locale);

  if (hasError) {
    return (
      <div dir={dir} className="space-y-4 min-w-0">
        <PageHeader
          title={label("سجل العمليات والاستعلامات", "System Activity Log")}
          description={label(
            "كل عملية ينفذها الموظفون: إنشاء وتعديل وحذف وفواتير وسندات.",
            "Every action by staff: create, update, delete, invoices, and vouchers.",
          )}
        />
        <StateBlock
          state="error"
          locale={locale}
          title={label("تعذّر تحميل سجل العمليات", "Unable to load activity log")}
          description={label(
            "حدث خلل مؤقت أثناء قراءة السجلات. يرجى إعادة المحاولة.",
            "A temporary issue occurred while loading activity entries. Please try again.",
          )}
        />
      </div>
    );
  }

  return (
    <div dir={dir} className="space-y-4 min-w-0">
      <PageHeader
        title={label("سجل العمليات والاستعلامات", "System Activity Log")}
        description={label(
          "كل عملية ينفذها الموظفون: إنشاء وتعديل وحذف وفواتير وسندات.",
          "Every action by staff: create, update, delete, invoices, and vouchers.",
        )}
        actions={
          <ExportCsvButton
            kind="audit"
            filename="activity-log.csv"
            label={label("تصدير سجل العمليات (CSV)", "Export Activity Log (CSV)")}
          />
        }
      />

      <SectionCard
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span>{label("العمليات المسجلة", "Recorded Operations")}</span>
            <span
              dir="ltr"
              className="ds-num rounded-full border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-2.5 py-0.5 text-xs font-bold tabular-nums"
            >
              {formatInt(total, locale)}
            </span>
          </span>
        }
        locale={locale}
        padded={false}
      >
        <form
          method="get"
          className="flex flex-wrap items-center gap-2.5 border-b border-[var(--ds-border-hairline)] p-4"
        >
          <input
            name="q"
            defaultValue={q}
            aria-label={label("بحث بالموظف أو التفاصيل", "Search by user or details")}
            placeholder={label("بحث بالموظف أو التفاصيل", "Search by user or details")}
            className="ds-focus-ring min-w-[200px] flex-1 rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)] sm:max-w-sm"
          />
          <select
            name="filter"
            defaultValue={moduleKey}
            aria-label={label("تصفية حسب القسم", "Filter by module")}
            className="ds-focus-ring rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2 text-sm text-[var(--ds-text-primary)] sm:max-w-52"
          >
            <option value="">{label("كل الأقسام", "All modules")}</option>
            {MODULES.map((item) => (
              <option key={item.key} value={item.key}>
                {moduleNavLabel(locale, item.labelKey)}
              </option>
            ))}
          </select>
          <button type="submit" className={`${btnPrimary} ds-focus-ring`}>
            {label("بحث", "Search")}
          </button>
          <Link
            href="/audit"
            className="ds-focus-ring rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-4 py-2 text-sm font-semibold text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
          >
            {label("مسح", "Clear")}
          </Link>
        </form>

        {rows.length === 0 ? (
          <div className="p-4">
            <StateBlock
              state="empty"
              locale={locale}
              title={label("لا توجد عمليات مطابقة", "No matching activity entries")}
              description={label(
                "جرّب مسح فلاتر البحث أو اختيار قسم آخر.",
                "Try clearing your search filters or selecting another module.",
              )}
              action={
                <Link
                  href="/audit"
                  className="ds-focus-ring rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--ds-text-primary)]"
                >
                  {label("عرض كل السجلات", "View all entries")}
                </Link>
              }
            />
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)]">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("التاريخ (الكويت)", "Timestamp (Kuwait)")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("الموظف", "User")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("القسم", "Module")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("الإجراء", "Action")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-start text-xs font-bold text-[var(--ds-text-secondary)]">
                    {label("التفاصيل", "Details")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ds-border-hairline)]">
                {rows.map((row) => {
                  const formattedTime = formatDateTime(row.createdAt, { locale });
                  const modMeta = MODULES.find((item) => item.key === row.module);
                  return (
                    <tr key={row.id} className="hover:bg-[var(--ds-bg-hover)]">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formattedTime === UNAVAILABLE_DASH ? (
                          <UnavailableDash tooltip={unavailableTooltip} />
                        ) : (
                          <span dir="ltr" className="ds-num tabular-nums text-[var(--ds-text-primary)]">
                            {formattedTime}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[var(--ds-text-primary)]">
                          {row.user?.name || <UnavailableDash tooltip={unavailableTooltip} />}
                        </p>
                        <p className="ds-caption" dir="ltr">
                          {row.user?.email || <UnavailableDash tooltip={unavailableTooltip} />}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-[var(--ds-text-primary)]">
                        {modMeta ? moduleNavLabel(locale, modMeta.labelKey) : row.module}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[var(--ds-text-primary)]">{row.action}</td>
                      <td className="px-4 py-3 text-[var(--ds-text-secondary)]">
                        {row.details || <UnavailableDash tooltip={unavailableTooltip} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <PaginationBar path="/audit" params={{ q, filter: moduleKey }} page={page} total={total} />
      </SectionCard>
    </div>
  );
}
