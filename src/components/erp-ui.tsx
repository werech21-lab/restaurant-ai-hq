'use client'

import { pageCount, pageHref, PAGE_SIZE } from "@/lib/pagination";
import { statusTone } from "@/lib/format";
import { useI18n, type MessageKey } from "@/lib/i18n";

const STATUS_I18N: Record<string, MessageKey> = {
  DRAFT: 'status.draft',
  PAID: 'status.paid',
  PARTIAL: 'status.partial',
  UNPAID: 'status.unpaid',
  PENDING: 'status.pending',
}

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-l from-[#8cc63f] to-[#00a99d] px-4 py-2 text-sm font-semibold text-ink-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-gold-300/25 bg-ink-900/70 px-4 py-2 text-sm font-semibold text-mist-100 transition hover:border-gold-300/50 hover:text-gold-300";
export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60";
export const btnMuted =
  "inline-flex items-center justify-center rounded-lg border border-white/10 bg-ink-800 px-4 py-2 text-sm font-semibold text-mist-500";
export const fieldClass =
  "w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-[#8cc63f]/60";
export const labelClass = "mb-1 block text-sm font-semibold text-mist-300";
export const cardClass =
  "rounded-2xl border border-gold-300/15 bg-ink-900/80 text-mist-100 shadow-[var(--shadow-card)]";
export const tableHeadClass = "bg-ink-800/90 text-mist-300";
export const tableCellClass = "text-mist-100";
export const mutedTextClass = "text-mist-400";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-mist-100">{title}</h1>
        {description ? <p className="mt-1 text-sm text-mist-400">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function DataCard({ children }: { children: React.ReactNode }) {
  return <div className={cx(cardClass, "w-full max-w-none overflow-hidden")}>{children}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n()
  const key = STATUS_I18N[status]
  return (
    <span className={cx("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", statusTone(status))}>
      {key ? t(key) : status}
    </span>
  );
}

export function LowStockBadge() {
  const { t } = useI18n()
  return (
    <span className="inline-flex rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">
      {t('status.lowStock')}
    </span>
  );
}

export function Alert({ kind, children }: { kind: "error" | "ok"; children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className={cx(
        "rounded-lg px-3 py-2 text-sm font-semibold text-white",
        kind === "error" ? "bg-red-600" : "bg-emerald-600",
      )}
    >
      {children}
    </p>
  );
}

export function PaginationBar({
  path,
  params,
  page,
  total,
}: {
  path: string;
  params: Record<string, string | number | undefined>;
  page: number;
  total: number;
}) {
  const { locale } = useI18n()
  const pages = pageCount(total);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const prev = pageHref(path, { ...params, page: page - 1 });
  const next = pageHref(path, { ...params, page: page + 1 });
  const empty = locale === 'en' ? 'No records' : 'لا توجد سجلات'
  const range = locale === 'en' ? `Showing ${from}–${to} of ${total}` : `عرض ${from}–${to} من ${total}`
  const prevLabel = locale === 'en' ? 'Previous' : 'السابق'
  const nextLabel = locale === 'en' ? 'Next' : 'التالي'
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-sm">
      <span className="text-mist-400">{total === 0 ? empty : range}</span>
      <div className="flex items-center gap-2">
        {page <= 1 ? <span className={btnMuted}>{prevLabel}</span> : <a className={btnGhost} href={prev}>{prevLabel}</a>}
        <span className="min-w-16 text-center font-semibold text-mist-100">
          {page} / {pages}
        </span>
        {page >= pages ? <span className={btnMuted}>{nextLabel}</span> : <a className={btnGhost} href={next}>{nextLabel}</a>}
      </div>
    </div>
  );
}

export function PageSkeleton({ title }: { title: string }) {
  const { locale } = useI18n()
  return (
    <div className="space-y-4">
      <div className="h-10 w-48 rounded-lg bg-ink-800" />
      <div className={cx(cardClass, "p-6")}>
        <p className="text-sm font-semibold text-mist-300">
          {locale === 'en' ? `Loading ${title}…` : `جارٍ تحميل ${title}...`}
        </p>
      </div>
    </div>
  );
}

export function DisabledModule({ title }: { title: string }) {
  const { locale, t } = useI18n()
  return (
    <div className={cx(cardClass, "p-8 text-center")}>
      <h2 className="text-xl font-bold text-mist-100">
        {locale === 'en' ? `${title} is disabled` : `${title} معطلة`}
      </h2>
      <p className="mt-2 text-sm text-mist-400">
        {locale === 'en'
          ? 'Enable the module from App Builder to restore its screens.'
          : 'فعّل الوحدة من مدير التطبيقات لتظهر شاشاتها وتعود للعمل.'}
      </p>
      <a href="/app-builder" className={cx(btnPrimary, "mt-5")}>
        {t('nav.app-builder')}
      </a>
    </div>
  );
}

export function Forbidden({ href }: { href: string }) {
  const { locale } = useI18n()
  return (
    <div className={cx(cardClass, "p-8 text-center")}>
      <h2 className="text-xl font-bold text-mist-100">
        {locale === 'en' ? 'You do not have permission to view this page' : 'ليست لديك صلاحية عرض هذه الصفحة'}
      </h2>
      <p className="mt-2 text-sm text-mist-400">
        {locale === 'en'
          ? 'Ask a system admin to grant the required role permission.'
          : 'اطلب من مدير النظام منح الصلاحية المناسبة لدورك.'}
      </p>
      <a href={href} className={cx(btnPrimary, "mt-5")}>
        {locale === 'en' ? 'Go to your home page' : 'الانتقال إلى صفحتك'}
      </a>
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-mist-400">{children}</p>;
}
