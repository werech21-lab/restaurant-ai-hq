"use client";

export default function PanelError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h2 className="text-xl font-bold text-slate-900">تعذر إكمال العملية</h2>
      <p className="mt-2 text-sm text-slate-600">حدث خطأ أثناء تحميل البيانات. أعد المحاولة.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
