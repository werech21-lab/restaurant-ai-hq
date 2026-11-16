'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-screen items-center justify-center bg-[#090d14] p-4 font-cairo text-slate-100">
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-[#101622] p-8 text-center shadow-2xl">
          <h1 className="text-xl font-black text-white">تعذر تحميل المنظومة</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            حدث خطأ ولم يتم عرض بيانات بديلة. أعد المحاولة عندما تكون الصفحة جاهزة.
          </p>
          {error?.digest ? (
            <p className="mt-2 font-mono text-[10px] text-slate-500">ID: {error.digest}</p>
          ) : null}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              className="rounded-xl bg-emerald-500 px-5 py-2 text-xs font-bold text-black transition hover:bg-emerald-400"
              onClick={() => reset()}
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
