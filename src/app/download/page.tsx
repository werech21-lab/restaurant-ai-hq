import Link from 'next/link'

export const metadata = {
  title: 'تحميل AetherBI',
  description: 'حمّل تطبيق AetherBI لسطح المكتب والجوال',
}

export default function DownloadPage() {
  return (
    <main className="min-h-screen bg-ink-950 px-4 py-16 text-mist-100">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link href="/" className="text-sm text-gold-300 hover:underline">
          ← العودة إلى AetherBI
        </Link>
        <h1 className="text-4xl font-black text-white">تحميل التطبيق</h1>
        <p className="text-mist-300 leading-8">
          استخدم AetherBI من المتصفح على أي جهاز، أو ثبّته كتطبيق تقدّمي (PWA) من قائمة المتصفح: «إضافة إلى الشاشة الرئيسية»
          على الموبايل، أو «Install app» على سطح المكتب (Chrome / Edge).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-gold-300/20 bg-ink-900/60 p-5">
            <h2 className="text-lg font-semibold text-gold-300">سطح المكتب</h2>
            <p className="mt-2 text-sm text-mist-300">Windows / macOS عبر متصفح Chromium — تثبيت بنقرة واحدة من شريط العنوان.</p>
            <Link href="/login" className="mt-4 inline-flex rounded-xl bg-gold-400 px-4 py-2 text-sm font-bold text-ink-950">
              فتح النظام ثم التثبيت
            </Link>
          </article>
          <article className="rounded-2xl border border-gold-300/20 bg-ink-900/60 p-5">
            <h2 className="text-lg font-semibold text-gold-300">الموبايل</h2>
            <p className="mt-2 text-sm text-mist-300">iOS Safari أو Android Chrome — أضف AetherBI إلى الشاشة الرئيسية للوصول السريع بدون متجر.</p>
            <a href="https://www.aetherbi.com" className="mt-4 inline-flex rounded-xl border border-white/20 px-4 py-2 text-sm text-white">
              فتح aetherbi.com على الجوال
            </a>
          </article>
        </div>
      </div>
    </main>
  )
}
