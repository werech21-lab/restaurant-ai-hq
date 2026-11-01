import { VENTURE_FOODS } from "@/lib/venture-foods";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function BrandLogo({
  className,
  markClassName,
  showText = true,
  tone = "dark",
}: {
  className?: string;
  markClassName?: string;
  showText?: boolean;
  tone?: "dark" | "light" | "print";
}) {
  const title = tone === "dark" ? "text-mist-100" : "text-slate-900";
  const sub = tone === "dark" ? "text-[#8cc63f]" : "text-slate-600";
  const src = tone === "dark" ? "/venture-foods-logo-dark.svg" : "/venture-foods-logo.svg";
  return (
    <div className={cx("flex items-center gap-3", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={VENTURE_FOODS.nameEn} className={cx("h-11 w-auto object-contain", markClassName)} />
      {showText ? (
        <div className="min-w-0">
          <p className={cx("truncate text-sm font-bold leading-5", title)}>{VENTURE_FOODS.nameAr}</p>
          <p className={cx("truncate text-[11px] font-semibold tracking-wide", sub)} dir="ltr">
            Venture Foods · Kuwait
          </p>
        </div>
      ) : null}
    </div>
  );
}

export { VENTURE_FOODS };
