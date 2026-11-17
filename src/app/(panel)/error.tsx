'use client'

export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-ink-900">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">تعذر إكمال العملية</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        حدث خطأ أثناء تحميل البيانات. لم يتم إخفاء الفشل أو استبداله ببيانات أخرى.
      </p>
      {error?.digest ? (
        <p className="mt-2 font-mono text-[10px] text-slate-500">ID: {error.digest}</p>
      ) : null}
      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  )
}
