import { LoginForm } from "@/app/login/login-form";
import { VENTURE_FOODS } from "@/lib/venture-foods";

export const metadata = { title: "تسجيل الدخول | فنتشر فودز · AetherBI" };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen bg-ink-950 text-mist-100 lg:grid-cols-2">
      <section className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-center lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/venture-foods-logo-dark.svg" alt={VENTURE_FOODS.nameEn} className="h-16 w-auto" />
          </div>
          <LoginForm />
        </div>
      </section>
      <section className="relative hidden flex-col justify-between overflow-hidden border-s border-gold-300/15 bg-gradient-to-br from-ink-900 via-ink-950 to-[#0a1412] px-12 py-12 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(140,198,63,0.18),transparent_42%),radial-gradient(ellipse_at_90%_30%,rgba(0,169,157,0.16),transparent_45%)]" />
        <div className="relative z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/venture-foods-logo-dark.svg" alt={VENTURE_FOODS.nameEn} className="h-20 w-auto" />
          <h1 className="mt-8 text-3xl font-bold leading-snug text-mist-100">{VENTURE_FOODS.nameAr}</h1>
          <p className="mt-2 text-sm font-semibold text-[#8cc63f]" dir="ltr">
            {VENTURE_FOODS.nameEn}
          </p>
          <p className="mt-4 max-w-md text-mist-300">
            منظومة AetherBI لإدارة مجموعات المطاعم في الكويت: 6 براندات × 10 فروع، مخزون، مشتريات، POS، مالية بالدينار الكويتي (د.ك).
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-gold-300/20 bg-ink-900/60 p-4">
            <p className="text-mist-400">العملة</p>
            <p className="mt-1 font-bold text-gold-300">دينار كويتي · د.ك</p>
          </div>
          <div className="rounded-2xl border border-gold-300/20 bg-ink-900/60 p-4">
            <p className="text-mist-400">التغطية</p>
            <p className="mt-1 font-bold text-[#00a99d]">دولة الكويت · +965</p>
          </div>
        </div>
      </section>
    </div>
  );
}
