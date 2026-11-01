import { cardClass } from "@/components/erp-ui";

export function StatCard({
  href,
  label,
  value,
  danger,
}: {
  href?: string;
  label: string;
  value: string;
  danger?: boolean;
}) {
  const body = (
    <>
      <p className="text-sm font-semibold text-mist-400">{label}</p>
      <p className={`mt-3 text-2xl font-bold ${danger ? "text-red-600" : "text-mist-100"}`}>{value}</p>
    </>
  );
  if (!href) {
    return <section className={`${cardClass} p-5`}>{body}</section>;
  }
  return (
    <a href={href} className={`${cardClass} block p-5 transition hover:border-blue-600`}>
      {body}
    </a>
  );
}
