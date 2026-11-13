'use client'

import { useMemo, useState } from 'react'
import type { HrEmployeeSummary } from './HrExecutiveReportsHub'
import { calculateKuwaitEosb } from './hr-enterprise-data'

type LetterKind =
  | 'SALARY_CERTIFICATE'
  | 'TO_WHOM_IT_MAY_CONCERN'
  | 'KUWAIT_EMPLOYMENT_CONTRACT'
  | 'OFFICIAL_WARNING_LETTER'
  | 'FINAL_CLEARANCE_SETTLEMENT'

type Props = {
  en: boolean
  employees: HrEmployeeSummary[]
}

export function HrOfficialLettersHub({ en, employees }: Props) {
  const [letterKind, setLetterKind] = useState<LetterKind>('SALARY_CERTIFICATE')
  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[0]?.id || '')
  const [addressedTo, setAddressedTo] = useState<string>('National Bank of Kuwait (NBK)')
  const [warningReason, setWarningReason] = useState<string>(
    en
      ? 'Unexcused lateness during peak branch operating hours'
      : 'تأخر غير مبرر عن موعد بداية الوردية خلال ساعات الذروة التشغيلية بالفرع',
  )

  const selectedEmp = useMemo(
    () => employees.find((e) => e.id === selectedEmpId) || employees[0],
    [employees, selectedEmpId],
  )

  const todayIso = new Date().toISOString().slice(0, 10)
  const basic = selectedEmp?.basicSalary ?? 250
  const allow = selectedEmp?.allowances ?? 65
  const ded = selectedEmp?.deductions ?? 0
  const totalRemuneration = basic + allow
  const netPay = Math.max(0, totalRemuneration - ded)
  const civilId = selectedEmp?.civilId || '292041508821'
  const iban =
    selectedEmp?.iban ||
    `KW81NBOK000000000000${(selectedEmp?.code || '1001').replace(/\D/g, '').padStart(10, '0').slice(-10)}`

  const eosbPreview = useMemo(
    () =>
      calculateKuwaitEosb({
        hireDate: selectedEmp?.hireDate || '2021-05-01',
        lastWorkingDate: todayIso,
        basicSalaryKwd: basic,
        allowancesKwd: allow,
        reason: 'TERMINATION',
        unusedLeaveDays: 24,
        workedDaysInFinalMonth: 18,
        outstandingLoanKwd: ded,
      }),
    [selectedEmp?.hireDate, todayIso, basic, allow, ded],
  )

  const LETTER_TYPES: Array<{ key: LetterKind; ar: string; en: string }> = [
    {
      key: 'SALARY_CERTIFICATE',
      ar: '📜 شهادة راتب رسمية (Salary Certificate)',
      en: '📜 Official Salary Certificate',
    },
    {
      key: 'TO_WHOM_IT_MAY_CONCERN',
      ar: '🏛️ شهادة لمن يهمه الأمر (To Whom It May Concern)',
      en: '🏛️ To Whom It May Concern Certificate',
    },
    {
      key: 'KUWAIT_EMPLOYMENT_CONTRACT',
      ar: '⚖️ عقد عمل كويتي رسمي ثنائي اللغة (Kuwait Labor Contract)',
      en: '⚖️ Bilingual Kuwait Employment Contract (Law 6/2010)',
    },
    {
      key: 'OFFICIAL_WARNING_LETTER',
      ar: '⚠️ كتاب إنذار رسمي (Official Warning Letter)',
      en: '⚠️ Official Disciplinary Warning Letter',
    },
    {
      key: 'FINAL_CLEARANCE_SETTLEMENT',
      ar: '🧾 نموذج إخلاء طرف ومخالصة نهائية (Final Clearance & Settlement)',
      en: '🧾 Final Clearance & EOSB Settlement Form',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="no-print rounded-3xl border border-white/10 bg-[#0f141c] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              {en
                ? '1-Click Bilingual Official HR Letters & Contracts Generator'
                : 'توليد وطباعة الشهادات والكتب الرسمية والعقود الفورية'}
            </p>
            <h2 className="mt-1 text-lg font-black text-white">
              {en
                ? '🖨️ Venture Foods W.L.L. Official Letterhead Document Studio'
                : '🖨️ منصة إصدار الشهادات والعقود بترويسة شركة فنتشر فودز لإدارة المطاعم ذ.م.م.'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-xs font-black text-ink-950 shadow-lg hover:brightness-110"
          >
            {en ? '🖨️ Print / Export Official PDF Now' : '🖨️ طباعة / حفظ الوثيقة الرسمية PDF الآن'}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {LETTER_TYPES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setLetterKind(item.key)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                letterKind === item.key
                  ? 'border border-emerald-400 bg-emerald-500/20 text-emerald-200'
                  : 'border border-white/10 bg-[#131924] text-mist-300 hover:border-white/25'
              }`}
            >
              {en ? item.en : item.ar}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block text-xs font-semibold text-mist-300">
            {en ? 'Select Employee (166 Staff)' : 'اختر الموظف من السجل (166 موظفاً)'}
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-[#131924] px-3 py-2 text-xs text-white"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  [{e.code}] {e.name} — {e.jobTitle}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold text-mist-300">
            {en ? 'Addressed Entity / Bank / Embassy' : 'الجهة الموجه إليها الكتاب / البنك / السفارة'}
            <input
              value={addressedTo}
              onChange={(e) => setAddressedTo(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-[#131924] px-3 py-2 text-xs text-white"
            />
          </label>

          {letterKind === 'OFFICIAL_WARNING_LETTER' ? (
            <label className="block text-xs font-semibold text-mist-300">
              {en ? 'Infraction / Warning Subject' : 'موضوع المخالفة / سبب الإنذار'}
              <input
                value={warningReason}
                onChange={(e) => setWarningReason(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-[#131924] px-3 py-2 text-xs text-white"
              />
            </label>
          ) : null}
        </div>
      </div>

      {/* Official Bilingual Letterhead Printable Sheet */}
      <article className="mx-auto max-w-4xl rounded-3xl border border-gold-300/30 bg-[#0d1118] p-8 text-mist-100 shadow-2xl print:border-black print:bg-white print:text-black">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-gold-400/40 pb-5">
          <div>
            <p className="text-base font-black tracking-wide text-gold-300 print:text-black">
              VENTURE FOODS RESTAURANT MANAGEMENT W.L.L.
            </p>
            <p className="text-xs text-mist-300 print:text-gray-700">
              State of Kuwait · Commercial Reg. & PAM File: PAM-2018-70001 · Tel: +965 22469500
            </p>
            <p className="text-xs text-mist-400 print:text-gray-600">
              China Garden · The Noodle Bar · Karak Cafeteria · Farm Brown · Frank&apos;s Steak · Tahina
            </p>
          </div>
          <div className="text-end">
            <p className="text-base font-black text-gold-300 print:text-black">
              شركة فنتشر فودز لإدارة المطاعم ذ.م.م.
            </p>
            <p className="text-xs text-mist-300 print:text-gray-700">
              دولة الكويت · الإدارة العامة للشؤون الإدارية والموارد البشرية
            </p>
            <p className="mt-1 font-mono text-xs text-emerald-300 print:text-black" dir="ltr">
              Ref: VF/HR/{new Date().getFullYear()}/{selectedEmp?.code || '1001'} · Date: {todayIso}
            </p>
          </div>
        </header>

        {letterKind === 'SALARY_CERTIFICATE' ? (
          <div className="mt-6 space-y-5 text-sm leading-relaxed">
            <h3 className="text-center text-lg font-black text-white underline underline-offset-8 print:text-black">
              {en
                ? 'OFFICIAL SALARY CERTIFICATE / شهادة راتب رسمية'
                : 'شهادة راتب رسمية / OFFICIAL SALARY CERTIFICATE'}
            </h3>
            <p>
              <strong>{en ? 'To:' : 'السادة /'}</strong> {addressedTo}
            </p>
            <p>
              {en
                ? `This is to certify that Mr./Ms. ${selectedEmp?.name} (Employee Barcode: ${selectedEmp?.code}, Kuwait Civil ID: ${civilId}) is currently employed with Venture Foods Restaurant Management W.L.L. since ${selectedEmp?.hireDate} in the capacity of "${selectedEmp?.jobTitle}" assigned to (${selectedEmp?.department}).`
                : `تشهد شركة فنتشر فودز لإدارة المطاعم ذ.م.م. بأن السيد/السيدة ${selectedEmp?.name} (رقم البصمة: ${selectedEmp?.code}، الرقم المدني الكويتي: ${civilId}) يعمل لدينا منذ تاريخ ${selectedEmp?.hireDate} بوظيفة «${selectedEmp?.jobTitle}» في (${selectedEmp?.department}) ولا يزال على رأس عمله حتى تاريخه.`}
            </p>
            <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/30 print:border-gray-400 print:bg-gray-50">
              <table className="w-full text-xs">
                <tbody>
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-2.5 font-semibold">
                      {en ? 'Basic Monthly Salary' : 'الراتب الأساسي الشهري'}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-emerald-300 print:text-black" dir="ltr">
                      {basic.toFixed(3)} KWD
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-2.5 font-semibold">
                      {en ? 'Monthly Fixed Allowances' : 'البدلات الشهرية الثابتة'}
                    </td>
                    <td className="px-4 py-2.5 font-mono font-bold text-emerald-300 print:text-black" dir="ltr">
                      {allow.toFixed(3)} KWD
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-2.5 font-semibold">
                      {en ? 'Monthly Deductions' : 'الاستقطاعات الشهرية'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-amber-300 print:text-black" dir="ltr">
                      {ded.toFixed(3)} KWD
                    </td>
                  </tr>
                  <tr className="border-b border-white/10 bg-emerald-950/30 print:bg-gray-100">
                    <td className="px-4 py-2.5 font-black">
                      {en ? 'Net Monthly Salary Transferred via WPS' : 'صافي الراتب الشهري المحول عبر حماية الأجور'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm font-black text-gold-300 print:text-black" dir="ltr">
                      {netPay.toFixed(3)} KWD
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold">
                      {en ? 'Designated Bank & IBAN' : 'البنك المعتمد ورقم الآيبان IBAN'}
                    </td>
                    <td className="px-4 py-2.5 font-mono" dir="ltr">
                      {selectedEmp?.bankName || 'National Bank of Kuwait (NBK)'} · {iban}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-mist-300 print:text-gray-700">
              {en
                ? 'This certificate has been issued upon the employee request without any legal or financial liability on the part of Venture Foods Restaurant Management W.L.L.'
                : 'أُعطيت له هذه الشهادة بناءً على طلبه دون أدنى مسؤولية مالية أو قانونية على شركة فنتشر فودز لإدارة المطاعم ذ.م.م. تجاه حقوق الغير.'}
            </p>
          </div>
        ) : null}

        {letterKind === 'TO_WHOM_IT_MAY_CONCERN' ? (
          <div className="mt-6 space-y-5 text-sm leading-relaxed">
            <h3 className="text-center text-lg font-black text-white underline underline-offset-8 print:text-black">
              {en
                ? 'TO WHOM IT MAY CONCERN / شهادة لمن يهمه الأمر'
                : 'شهادة لمن يهمه الأمر / TO WHOM IT MAY CONCERN'}
            </h3>
            <p>
              {en
                ? `Venture Foods Restaurant Management W.L.L. hereby certifies that ${selectedEmp?.name} (Civil ID: ${civilId}, Employee Code: ${selectedEmp?.code}) holds a valid Article 18 residency and is actively employed with our company as "${selectedEmp?.jobTitle}" since ${selectedEmp?.hireDate} with a total monthly package of ${totalRemuneration.toFixed(3)} KWD.`
                : `تشهد شركة فنتشر فودز لإدارة المطاعم ذ.م.م. بأن الموظف / ${selectedEmp?.name} (الرقم المدني: ${civilId}، رقم البصمة: ${selectedEmp?.code}) يعمل على كفالتنا بموجب إقامة صالحة (مادة 18 - القطاع الأهلي) بمهنة «${selectedEmp?.jobTitle}» منذ تاريخ ${selectedEmp?.hireDate} وبراتب إجمالي شهري قدره ${totalRemuneration.toFixed(3)} د.ك.`}
            </p>
            <p>
              {en
                ? `This letter is issued for submission to (${addressedTo}) without any obligation on the company.`
                : `صدرت هذه الشهادة لتقديمها إلى (${addressedTo}) بناءً على طلب المذكور دون تحمل الشركة أي التزامات مالية تجاه الغير.`}
            </p>
          </div>
        ) : null}

        {letterKind === 'KUWAIT_EMPLOYMENT_CONTRACT' ? (
          <div className="mt-6 space-y-4 text-xs leading-relaxed">
            <h3 className="text-center text-base font-black text-white underline underline-offset-8 print:text-black">
              {en
                ? 'STATE OF KUWAIT — PRIVATE SECTOR EMPLOYMENT CONTRACT (LAW NO. 6 OF 2010)'
                : 'عقد عمل في القطاع الأهلي — دولة الكويت (وفق أحكام القانون رقم 6 لسنة 2010)'}
            </h3>
            <div className="grid gap-3 rounded-2xl border border-white/15 bg-black/30 p-4 sm:grid-cols-2">
              <div>
                <p className="font-bold text-gold-300">
                  {en ? 'First Party (Employer):' : 'الطرف الأول (صاحب العمل):'}
                </p>
                <p>Venture Foods Restaurant Management W.L.L. — Kuwait</p>
                <p>Represented by: HR &amp; Admin Department</p>
              </div>
              <div>
                <p className="font-bold text-gold-300">
                  {en ? 'Second Party (Employee):' : 'الطرف الثاني (العامل):'}
                </p>
                <p>
                  {selectedEmp?.name} · Barcode: {selectedEmp?.code}
                </p>
                <p>Civil ID: {civilId} · Position: {selectedEmp?.jobTitle}</p>
              </div>
            </div>
            <ol className="list-decimal space-y-2 ps-5">
              <li>
                {en
                  ? `Article 1 (Scope & Location): The Second Party agrees to work for the First Party as "${selectedEmp?.jobTitle}" across its assigned brand/branch (${selectedEmp?.department}) in the State of Kuwait effective from ${selectedEmp?.hireDate}.`
                  : `البند الأول (الوظيفة ومقر العمل): يلتزم الطرف الثاني بالعمل لدى الطرف الأول بوظيفة «${selectedEmp?.jobTitle}» في (${selectedEmp?.department}) بدولة الكويت اعتباراً من تاريخ ${selectedEmp?.hireDate}.`}
              </li>
              <li>
                {en
                  ? `Article 2 (Probation Period): The employee is subject to a statutory probation period not exceeding 100 working days in accordance with Article 24 of Kuwait Labor Law No. 6/2010.`
                  : `البند الثاني (فترة التجربة): يخضع الطرف الثاني لفترة تجربة قانونية لا تتجاوز 100 يوم عمل فعلي وفقاً للمادة (24) من قانون العمل الكويتي رقم 6 لسنة 2010.`}
              </li>
              <li>
                {en
                  ? `Article 3 (Remuneration & WPS): The First Party shall pay a monthly Basic Salary of ${basic.toFixed(3)} KWD plus Fixed Allowances of ${allow.toFixed(3)} KWD (Total: ${totalRemuneration.toFixed(3)} KWD), transferred monthly via the Wage Protection System (WPS) to IBAN (${iban}).`
                  : `البند الثالث (الأجر وحماية الأجور): يتقاضى الطرف الثاني راتباً أساسياً شهرياً قدره ${basic.toFixed(3)} د.ك بالإضافة إلى بدلات قدرها ${allow.toFixed(3)} د.ك (الإجمالي: ${totalRemuneration.toFixed(3)} د.ك) يحول شهرياً عبر نظام حماية الأجور (WPS) لحساب الآيبان (${iban}).`}
              </li>
              <li>
                {en
                  ? `Article 4 (Working Hours, Annual Leave & EOSB): Working hours, overtime rates (1.25x / 1.50x / 2.00x), paid annual leave (30 days after 9 months of service), sick leave tiers, and End-of-Service Indemnity are governed strictly by Kuwait Labor Law No. 6 of 2010.`
                  : `البند الرابع (ساعات العمل والإجازات ونهاية الخدمة): تسري أحكام قانون العمل الكويتي رقم 6 لسنة 2010 بشأن ساعات العمل والعمل الإضافي والإجازة السنوية المدفوعة (30 يوماً) ومكافأة نهاية الخدمة.`}
              </li>
            </ol>
          </div>
        ) : null}

        {letterKind === 'OFFICIAL_WARNING_LETTER' ? (
          <div className="mt-6 space-y-4 text-sm leading-relaxed">
            <h3 className="text-center text-lg font-black text-amber-300 underline underline-offset-8 print:text-black">
              {en
                ? 'OFFICIAL DISCIPLINARY WARNING NOTICE / كتاب إنذار إداري رسمي'
                : 'كتاب إنذار إداري رسمي / OFFICIAL DISCIPLINARY WARNING NOTICE'}
            </h3>
            <p>
              <strong>{en ? 'Employee:' : 'الموظف:'}</strong> {selectedEmp?.name} ({selectedEmp?.code}) ·{' '}
              {selectedEmp?.jobTitle} ({selectedEmp?.department})
            </p>
            <p>
              <strong>{en ? 'Subject / Violation:' : 'موضوع المخالفة:'}</strong> {warningReason}
            </p>
            <p>
              {en
                ? 'Pursuant to the Kuwait Labor Law No. 6 of 2010 (Disciplinary Regulations) and Venture Foods operational standards, this notice serves as a formal written warning recorded in your HR dossier. Repeated infractions may result in statutory wage deductions or termination of service.'
                : 'استناداً إلى لائحة الجزاءات المعتمدة من الهيئة العامة للقوى العاملة وأحكام قانون العمل الكويتي رقم 6 لسنة 2010، يوجه إليكم هذا الإنذار الكتابي الرسمي ويودع في ملفكم الوظيفي، مع التنبيه المشدد بعدم تكرار المخالفة تلافياً لتوقيع عقوبات الخصم القانوني أو إنهاء الخدمات.'}
            </p>
          </div>
        ) : null}

        {letterKind === 'FINAL_CLEARANCE_SETTLEMENT' ? (
          <div className="mt-6 space-y-4 text-xs leading-relaxed">
            <h3 className="text-center text-base font-black text-white underline underline-offset-8 print:text-black">
              {en
                ? 'FINAL CLEARANCE & END-OF-SERVICE SETTLEMENT DEED / إقرار مخالصة نهائية وإخلاء طرف'
                : 'إقرار مخالصة نهائية وإخلاء طرف شامل / FINAL CLEARANCE & EOSB SETTLEMENT'}
            </h3>
            <p>
              {en
                ? `Employee: ${selectedEmp?.name} (${selectedEmp?.code}) · Civil ID: ${civilId} · Hire Date: ${selectedEmp?.hireDate} · Last Working Date: ${todayIso} (${eosbPreview.years}y ${eosbPreview.months}m ${eosbPreview.days}d).`
                : `الموظف: ${selectedEmp?.name} (${selectedEmp?.code}) · الرقم المدني: ${civilId} · تاريخ التعيين: ${selectedEmp?.hireDate} · تاريخ آخر يوم عمل: ${todayIso} (مدة الخدمة: ${eosbPreview.years} سنة و ${eosbPreview.months} شهر و ${eosbPreview.days} يوم).`}
            </p>
            <div className="overflow-hidden rounded-2xl border border-white/15 bg-black/30">
              <table className="w-full text-xs">
                <tbody>
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-2">{en ? 'Payable End-of-Service Indemnity (EOSB)' : 'صافي مكافأة نهاية الخدمة المستحقة'}</td>
                    <td className="px-4 py-2 font-mono font-bold text-emerald-300" dir="ltr">
                      {eosbPreview.netIndemnityPayableKwd.toFixed(3)} KWD
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-2">{en ? 'Unused Annual Leave Encashment (26-day divisor)' : 'بدل رصيد الإجازات غير المستعملة (على أساس 26 يوماً)'}</td>
                    <td className="px-4 py-2 font-mono font-bold text-emerald-300" dir="ltr">
                      {eosbPreview.leaveEncashmentKwd.toFixed(3)} KWD
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-2">{en ? 'Worked Days Salary in Final Month' : 'راتب أيام العمل الفعلية في الشهر الأخير'}</td>
                    <td className="px-4 py-2 font-mono font-bold text-emerald-300" dir="ltr">
                      {eosbPreview.finalMonthSalaryKwd.toFixed(3)} KWD
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="px-4 py-2">{en ? 'Less: Outstanding Loans / Advances' : 'يُخصم: رصيد السلف والعهد المتبقية'}</td>
                    <td className="px-4 py-2 font-mono text-amber-300" dir="ltr">
                      -{eosbPreview.outstandingLoanKwd.toFixed(3)} KWD
                    </td>
                  </tr>
                  <tr className="bg-emerald-950/30">
                    <td className="px-4 py-2.5 font-black">{en ? 'FINAL NET SETTLEMENT PAYABLE' : 'صافي المخالصة النهائية المستحق للصرف'}</td>
                    <td className="px-4 py-2.5 font-mono text-sm font-black text-gold-300" dir="ltr">
                      {eosbPreview.finalSettlementNetKwd.toFixed(3)} KWD
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              {en
                ? 'Declaration: I, the undersigned employee, acknowledge receipt of my full statutory dues, salaries, overtime, annual leave balance, and End-of-Service Indemnity under Kuwait Labor Law No. 6/2010, and hereby release Venture Foods Restaurant Management W.L.L. from any further claims.'
                : 'إقرار إبراء ذمة: أقر أنا الموقع أدناه باستلامي كافة مستحقاتي المالية والعمالية من رواتب وأجور إضافية وبدل إجازات ومكافأة نهاية الخدمة كاملة وفق أحكام قانون العمل الكويتي رقم 6 لسنة 2010، وأبرئ ذمة شركة فنتشر فودز لإدارة المطاعم ذ.م.م. إبراءً شاملاً ونهائياً.'}
            </p>
          </div>
        ) : null}

        {/* Official Signature Block */}
        <footer className="mt-10 grid grid-cols-3 gap-4 border-t border-white/15 pt-6 text-xs">
          <div>
            <p className="font-bold text-white print:text-black">
              {en ? 'HR & Admin Manager' : 'مديرة الموارد البشرية والشؤون الإدارية'}
            </p>
            <p className="mt-1 text-mist-300 print:text-gray-700">Sheyam Hekmat</p>
            <p className="text-xs text-mist-400" dir="ltr">
              sheyamh@venturefoodskw.com
            </p>
          </div>
          <div className="text-center">
            <p className="font-bold text-gold-300 print:text-black">
              {en ? 'Official Company Stamp' : 'الختم الرسمي للشركة'}
            </p>
            <div className="mx-auto mt-2 flex h-14 w-36 items-center justify-center rounded-xl border border-dashed border-gold-400/50 text-xs font-bold text-gold-300 print:border-black print:text-black">
              VENTURE FOODS W.L.L. · KUWAIT
            </div>
          </div>
          <div className="text-end">
            <p className="font-bold text-white print:text-black">
              {en ? 'Employee Signature / Thumbprint' : 'توقيع وبصمة الموظف'}
            </p>
            <p className="mt-1 text-mist-300 print:text-gray-700">{selectedEmp?.name}</p>
            <p className="text-xs font-mono text-mist-400" dir="ltr">
              Civil ID: {civilId}
            </p>
          </div>
        </footer>
      </article>
    </div>
  )
}
