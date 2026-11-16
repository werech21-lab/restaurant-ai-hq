'use client'

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#090d14] px-4 py-16 text-slate-100">
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-800 bg-[#101622] p-8 text-center shadow-2xl">
        <h1 className="text-xl font-black text-white">تعذر تحميل الصفحة</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          حدث خطأ أثناء عرض هذه الشاشة. لم يتم استبدال البيانات بمصدر آخر. أعد المحاولة، أو ارجع بعد أن تختفي المشكلة.
        </p>
        {error?.digest ? (
          <p className="mt-2 font-mono text-[10px] text-slate-500">ID: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            className="rounded-xl bg-emerald-500 px-5 py-2 text-xs font-bold text-black transition hover:bg-emerald-400"
            onClick={() => reset()}
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    </div>
  )
}
