export function WhatsAppButton({ href, label }: { href: string; label: string }) {
  if (!href) return <span className="text-xs font-semibold text-slate-500">أضف هاتف العميل بالصيغة الدولية لإرسال واتساب</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="no-print inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white"
    >
      {label}
    </a>
  );
}
