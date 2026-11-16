import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { EXEC_SESSION_COOKIE, verifyExecSessionToken } from '@/lib/auth/exec-session'
import { safeListAiRuns, type ListedAiRun, type ListedDailyBrief } from '@/server/ai/persist'

export const dynamic = 'force-dynamic'

function formatKuwait(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuwait',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

function statusLabel(status: ListedAiRun['status']): string {
  if (status === 'ok') return 'ok'
  if (status === 'guard_rejected') return 'guard_rejected'
  return 'error'
}

export default async function AiRunsPage() {
  const jar = await cookies()
  const session = await verifyExecSessionToken(jar.get(EXEC_SESSION_COOKIE)?.value)
  if (!session) redirect('/login')

  if (session.role !== 'admin') {
    return (
      <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8" dir="rtl">
        <h1 className="text-xl font-black text-slate-900">سجل تحليل فريال</h1>
        <p className="mt-3 text-sm text-slate-700">هذه الصفحة لمسؤول النظام فقط.</p>
      </main>
    )
  }

  const { runs, brief, error, source } = await safeListAiRuns(100)

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8" dir="rtl">
      <h1 className="text-xl font-black text-slate-900">سجل تحليل فريال</h1>
      <p className="mt-2 text-sm text-slate-600">
        كل صف هو استدعاء مزود واحد. معرّف النموذج هو القيمة التي أرجعتها واجهة المزود. التكلفة تقدير بالميكرو دولار.
        {source === 'postgres'
          ? ' المصدر: Postgres.'
          : ' المصدر: قاعدة اللوحة. ترحيل 0047 يضيف الجدول نفسه على Postgres عند تطبيقه.'}
      </p>
      {error ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          تعذّر قراءة السجل من قاعدة اللوحة.
        </p>
      ) : null}
      <BriefPanel brief={brief} />
      {runs.length === 0 && !error ? (
        <p className="mt-6 text-sm text-slate-600">لا توجد عمليات تحليل بعد.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-slate-200">
          <table className="min-w-full border-collapse text-start text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-bold">الوقت (الكويت)</th>
                <th className="px-3 py-2 font-bold">المستخدم</th>
                <th className="px-3 py-2 font-bold">بصمة السؤال</th>
                <th className="px-3 py-2 font-bold">المزود</th>
                <th className="px-3 py-2 font-bold">النموذج</th>
                <th className="px-3 py-2 font-bold">زمن الاستجابة</th>
                <th className="px-3 py-2 font-bold">الدخول</th>
                <th className="px-3 py-2 font-bold">الخروج</th>
                <th className="px-3 py-2 font-bold">التكلفة التقديرية</th>
                <th className="px-3 py-2 font-bold">الحالة</th>
                <th className="px-3 py-2 font-bold">الخطأ</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 whitespace-nowrap">{formatKuwait(run.createdAt)}</td>
                  <td className="px-3 py-2">{run.userId}</td>
                  <td className="px-3 py-2 font-mono">{run.questionHash.slice(0, 12)}</td>
                  <td className="px-3 py-2">{run.provider}</td>
                  <td className="px-3 py-2 font-mono">{run.modelId || '—'}</td>
                  <td className="px-3 py-2">{run.latencyMs}</td>
                  <td className="px-3 py-2">{run.tokensIn ?? '—'}</td>
                  <td className="px-3 py-2">{run.tokensOut ?? '—'}</td>
                  <td className="px-3 py-2">{run.estCostMicroUsd ?? '—'}</td>
                  <td className="px-3 py-2">{statusLabel(run.status)}</td>
                  <td className="px-3 py-2">{run.errorCode ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

function BriefPanel({ brief }: { brief: ListedDailyBrief | null }) {
  return (
    <section className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <h2 className="text-sm font-black text-slate-900">تقرير التحليل اليومي</h2>
      <p className="mt-1 text-xs text-slate-500">
        {brief ? `${formatKuwait(brief.createdAt)} — ${brief.status}` : 'لا يوجد تقرير مخزّن.'}
      </p>
      <a href="/erp/ai-brief" className="mt-2 inline-block text-sm font-bold text-slate-900 underline">
        صفحة التقرير
      </a>
    </section>
  )
}
