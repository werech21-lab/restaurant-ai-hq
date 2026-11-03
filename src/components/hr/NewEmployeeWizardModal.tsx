'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveEmployeeAction } from '@/app/actions/hr'

type Props = {
  open: boolean
  onClose: () => void
  en: boolean
}

const BRANDS = [
  'China Garden',
  'The Noodle Bar',
  'Karak Cafeteria',
  'Farm Brown Bakery',
  "Frank's Steak Sandwiches",
  'Tahina Shawarma',
  'Venture Foods Central Kitchen',
  'HQ Administration & Finance',
]

const BRANCHES = [
  'Salmiya Branch',
  'Avenues Branch',
  '360 Mall Branch',
  'Assima Mall Branch',
  'Al-Kout Mall Branch',
  'Ardiya Branch',
  'Promenade Mall Branch',
  'Aswaq Al-Qurain Branch',
  'Farwaniya Branch',
  'Shuwaikh Branch',
  'Central Kitchen — Qurain',
]

const NATIONALITIES = [
  { en: 'Kuwait', ar: 'الكويت' },
  { en: 'India', ar: 'الهند' },
  { en: 'Philippines', ar: 'الفلبين' },
  { en: 'Egypt', ar: 'مصر' },
  { en: 'Nepal', ar: 'نيبال' },
  { en: 'Sri Lanka', ar: 'سريلانكا' },
  { en: 'Bangladesh', ar: 'بنغلاديش' },
  { en: 'Syria', ar: 'سوريا' },
  { en: 'Lebanon', ar: 'لبنان' },
  { en: 'Jordan', ar: 'الأردن' },
]

export function NewEmployeeWizardModal({ open, onClose, en }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Step 1: Personal, Passport & Kuwait Civil ID
  const [fullName, setFullName] = useState('')
  const [nationality, setNationality] = useState('India')
  const [civilId, setCivilId] = useState('294051208841')
  const [passportNo, setPassportNo] = useState('Z8849201')
  const [phone, setPhone] = useState('+965 97000000')
  const [civilIdExpiry, setCivilIdExpiry] = useState('2027-10-15')
  const [passportExpiry, setPassportExpiry] = useState('2029-05-20')

  // Step 2: Job, Brand, Branch & Biometric Barcode
  const [barcode, setBarcode] = useState(`1${Math.floor(170 + Math.random() * 800)}`)
  const [jobTitle, setJobTitle] = useState('Demi Chef de Partie')
  const [brand, setBrand] = useState(BRANDS[0])
  const [branch, setBranch] = useState(BRANCHES[0])
  const [hireDate, setHireDate] = useState(new Date().toISOString().slice(0, 10))
  const [workStatus, setWorkStatus] = useState<'ACTIVE' | 'ON_VACATION' | 'OVERSEAS_PIPELINE'>('ACTIVE')

  // Step 3: Salary Structure (0.000 KWD), IBAN & Bank
  const [basicSalary, setBasicSalary] = useState('250.000')
  const [housingAllowance, setHousingAllowance] = useState('40.000')
  const [transportAllowance, setTransportAllowance] = useState('20.000')
  const [foodAllowance, setFoodAllowance] = useState('15.000')
  const [fixedDeductions, setFixedDeductions] = useState('0.000')
  const [bankName, setBankName] = useState('National Bank of Kuwait (NBK)')
  const [iban, setIban] = useState('KW81NBOK0000000000002007694489')

  // Step 4: Documents & Custody Handover
  const [healthCardExpiry, setHealthCardExpiry] = useState('2027-06-30')
  const [workPermitExpiry, setWorkPermitExpiry] = useState('2027-10-15')
  const [custodyUniform, setCustodyUniform] = useState(true)
  const [custodyPhone, setCustodyPhone] = useState(false)
  const [custodyKnifeSet, setCustodyKnifeSet] = useState(true)
  const [custodyLockerKey, setCustodyLockerKey] = useState(true)

  if (!open) return null

  const totalAllowances =
    (Number(housingAllowance) || 0) + (Number(transportAllowance) || 0) + (Number(foodAllowance) || 0)
  const netMonthly = (Number(basicSalary) || 0) + totalAllowances - (Number(fixedDeductions) || 0)

  async function handleFinish() {
    if (!fullName.trim() || !barcode.trim()) {
      setError(en ? 'Employee Full Name and Biometric Barcode are required.' : 'اسم الموظف ورقم البصمة مطلوبان.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const deptComposite = `${brand} · ${branch} · ${nationality}`
      const res = await saveEmployeeAction({
        code: barcode.trim(),
        name: fullName.trim(),
        jobTitle: jobTitle.trim(),
        department: deptComposite,
        phone: phone.trim(),
        basicSalary: Number(basicSalary) || 0,
        allowances: totalAllowances,
        deductions: Number(fixedDeductions) || 0,
        status: workStatus,
        civilId: civilId.trim(),
        iban: iban.trim(),
        bankName: bankName.trim(),
        hireDate,
        civilIdExpiry,
        passportExpiry,
        healthCardExpiry,
        workPermitExpiry,
      })
      if (!res.ok) {
        setError(res.message || (en ? 'Failed to create employee.' : 'تعذر حفظ الموظف.'))
      } else {
        setSuccessMsg(
          en
            ? `Employee ${fullName} (${barcode}) onboarded successfully with NBK WPS & Kuwait compliance profile.`
            : `تم إنشاء وتعيين الموظف ${fullName} (${barcode}) بنجاح مع ربط حماية الأجور وملف الإقامة والبلدية.`,
        )
        router.refresh()
        setTimeout(() => {
          setSuccessMsg(null)
          onClose()
        }, 1200)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      dir={en ? 'ltr' : 'rtl'}
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-emerald-500/30 bg-[#0d1118] text-mist-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-[#111722] px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              {en
                ? 'Venture Foods W.L.L. · 4-Step Enterprise Onboarding Wizard'
                : 'شركة فنتشر فودز ذ.م.م. · معالج تعيين موظف جديد (4 خطوات)'}
            </p>
            <h3 className="mt-0.5 text-lg font-black text-white">
              {en ? '➕ New Employee & Contract Onboarding Wizard' : '➕ إنشاء موظف جديد وعقد عمل كويتي'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-bold text-mist-300 hover:bg-white/10"
          >
            {en ? 'Close ✕' : 'إغلاق ✕'}
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-4 gap-2 border-b border-white/10 bg-[#0a0d12] px-6 py-3 text-xs font-bold">
          {[
            {
              s: 1 as const,
              ar: '1. البيانات الشخصية والمدنية',
              en: '1. Personal, Passport & Civil ID',
            },
            {
              s: 2 as const,
              ar: '2. الوظيفة والبراند والبصمة',
              en: '2. Role, Brand, Branch & Barcode',
            },
            {
              s: 3 as const,
              ar: '3. هيكل الراتب والـ IBAN',
              en: '3. Salary (0.000 KWD) & NBK IBAN',
            },
            {
              s: 4 as const,
              ar: '4. الوثائق وتسليم العهد',
              en: '4. Documents & Custody Handover',
            },
          ].map((item) => (
            <button
              key={item.s}
              type="button"
              onClick={() => setStep(item.s)}
              className={`rounded-xl px-3 py-2 text-start transition ${
                step === item.s
                  ? 'border border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
                  : step > item.s
                    ? 'border border-emerald-500/20 bg-emerald-950/30 text-emerald-400'
                    : 'border border-white/10 bg-[#11161f] text-mist-400'
              }`}
            >
              {en ? item.en : item.ar}
            </button>
          ))}
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6 space-y-4">
          {error ? (
            <p className="rounded-xl border border-red-400/40 bg-red-950/50 px-4 py-2.5 text-sm font-semibold text-red-200">
              {error}
            </p>
          ) : null}
          {successMsg ? (
            <p className="rounded-xl border border-emerald-400/40 bg-emerald-950/50 px-4 py-2.5 text-sm font-semibold text-emerald-200">
              {successMsg}
            </p>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-mist-300 sm:col-span-2">
                {en ? 'Full Legal Name (as in Passport & Civil ID)' : 'الاسم الكامل للموظف (مطابق للجواز والبطاقة المدنية)'}
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={en ? 'e.g. Rajesh Kumar Sharma' : 'مثال: راجيش كومار شارما'}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm text-white"
                />
              </label>

              <label className="block text-xs font-semibold text-mist-300">
                {en ? 'Nationality' : 'الجنسية'}
                <select
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm text-white"
                >
                  {NATIONALITIES.map((n) => (
                    <option key={n.en} value={n.en}>
                      {en ? n.en : `${n.ar} (${n.en})`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-mist-300">
                {en ? 'Kuwait Civil ID Number (12 Digits)' : 'الرقم المدني الكويتي (12 رقماً)'}
                <input
                  dir="ltr"
                  value={civilId}
                  onChange={(e) => setCivilId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm font-mono text-white"
                />
              </label>

              <label className="block text-xs font-semibold text-mist-300">
                {en ? 'Passport Number' : 'رقم جواز السفر'}
                <input
                  dir="ltr"
                  value={passportNo}
                  onChange={(e) => setPassportNo(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm font-mono text-white"
                />
              </label>

              <label className="block text-xs font-semibold text-mist-300">
                {en ? 'Kuwait Mobile Number' : 'رقم الهاتف النقال (الكويت)'}
                <input
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm font-mono text-white"
                />
              </label>

              <label className="block text-xs font-semibold text-mist-300">
                {en ? 'Civil ID / Article 18 Residency Expiry' : 'تاريخ انتهاء البطاقة المدنية والإقامة (مادة 18)'}
                <input
                  type="date"
                  dir="ltr"
                  value={civilIdExpiry}
                  onChange={(e) => setCivilIdExpiry(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm text-white"
                />
              </label>

              <label className="block text-xs font-semibold text-mist-300">
                {en ? 'Passport Expiry Date' : 'تاريخ انتهاء جواز السفر'}
                <input
                  type="date"
                  dir="ltr"
                  value={passportExpiry}
                  onChange={(e) => setPassportExpiry(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm text-white"
                />
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-mist-300">
                {en ? 'Biometric Attendance Badge / Barcode' : 'رقم البصمة / الباركود الوظيفي (Barcode)'}
                <input
                  dir="ltr"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm font-mono text-emerald-300"
                />
              </label>

              <label className="block text-xs font-semibold text-mist-300">
                {en ? 'Job Title / Designation' : 'المسمى الوظيفي'}
                <input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm text-white"
                />
              </label>

              <label className="block text-xs font-semibold text-mist-300">
                {en ? 'Assigned Brand (6 Brands / CK)' : 'البراند التابع له'}
                <select
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm text-white"
                >
                  {BRANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-mist-300">
                {en ? 'Assigned Branch / Location' : 'الفرع / موقع العمل'}
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm text-white"
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-mist-300">
                {en ? 'Joining / Hire Date' : 'تاريخ المباشرة والتعيين'}
                <input
                  type="date"
                  dir="ltr"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm text-white"
                />
              </label>

              <label className="block text-xs font-semibold text-mist-300">
                {en ? 'Current Employment Status' : 'حالة العمل الحالية'}
                <select
                  value={workStatus}
                  onChange={(e) => setWorkStatus(e.target.value as 'ACTIVE' | 'ON_VACATION' | 'OVERSEAS_PIPELINE')}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm text-white"
                >
                  <option value="ACTIVE">{en ? 'Active on Duty (على رأس العمل)' : 'على رأس العمل (Active)'}</option>
                  <option value="ON_VACATION">
                    {en ? 'On Annual Vacation Abroad (في إجازة سفر)' : 'في إجازة سفر (On Vacation)'}
                  </option>
                  <option value="OVERSEAS_PIPELINE">
                    {en ? 'Overseas Visa 18 Pipeline (قيد الاستقدام من الخارج)' : 'قيد الاستقدام من الخارج (Visa 18)'}
                  </option>
                </select>
              </label>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-xs font-semibold text-mist-300">
                  {en ? 'Basic Salary (0.000 KWD)' : 'الراتب الأساسي (0.000 د.ك)'}
                  <input
                    dir="ltr"
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm font-mono text-emerald-300"
                  />
                </label>

                <label className="block text-xs font-semibold text-mist-300">
                  {en ? 'Housing Allowance (0.000 KWD)' : 'بدل السكن (0.000 د.ك)'}
                  <input
                    dir="ltr"
                    value={housingAllowance}
                    onChange={(e) => setHousingAllowance(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm font-mono text-white"
                  />
                </label>

                <label className="block text-xs font-semibold text-mist-300">
                  {en ? 'Transport Allowance (0.000 KWD)' : 'بدل المواصلات (0.000 د.ك)'}
                  <input
                    dir="ltr"
                    value={transportAllowance}
                    onChange={(e) => setTransportAllowance(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm font-mono text-white"
                  />
                </label>

                <label className="block text-xs font-semibold text-mist-300">
                  {en ? 'Meal / Duty Allowance (0.000 KWD)' : 'بدل الوجبات وطبيعة العمل (0.000 د.ك)'}
                  <input
                    dir="ltr"
                    value={foodAllowance}
                    onChange={(e) => setFoodAllowance(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm font-mono text-white"
                  />
                </label>

                <label className="block text-xs font-semibold text-mist-300">
                  {en ? 'Fixed Monthly Deduction (0.000 KWD)' : 'الاستقطاعات الشهرية الثابتة (0.000 د.ك)'}
                  <input
                    dir="ltr"
                    value={fixedDeductions}
                    onChange={(e) => setFixedDeductions(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm font-mono text-white"
                  />
                </label>

                <div className="rounded-xl border border-gold-400/30 bg-gold-500/10 p-3">
                  <p className="text-[11px] font-semibold text-gold-200">
                    {en ? 'Total Net Contract Package' : 'صافي الراتب التعاقدي الشهري'}
                  </p>
                  <p className="mt-1 text-xl font-black text-gold-300" dir="ltr">
                    {netMonthly.toFixed(3)} KWD
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-mist-300">
                  {en ? 'Kuwait Bank Name (WPS)' : 'اسم البنك المعتمد (حماية الأجور WPS)'}
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm text-white"
                  >
                    <option value="National Bank of Kuwait (NBK)">National Bank of Kuwait (NBK) — البنك الوطني</option>
                    <option value="Boubyan Bank">Boubyan Bank — بنك بوبيان</option>
                    <option value="Kuwait Finance House (KFH)">Kuwait Finance House (KFH) — بيت التمويل</option>
                    <option value="Gulf Bank (GBK)">Gulf Bank (GBK) — بنك الخليج</option>
                    <option value="Burgan Bank">Burgan Bank — بنك برقان</option>
                  </select>
                </label>

                <label className="block text-xs font-semibold text-mist-300">
                  {en ? 'Kuwait IBAN (30 Alphanumeric Chars)' : 'رقم الآيبان البنكي الكويتي (IBAN)'}
                  <input
                    dir="ltr"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm font-mono text-emerald-200"
                  />
                </label>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-mist-300">
                  {en ? 'Kuwait Municipality Health Card Expiry' : 'تاريخ انتهاء شهادة صحة بلدية الكويت'}
                  <input
                    type="date"
                    dir="ltr"
                    value={healthCardExpiry}
                    onChange={(e) => setHealthCardExpiry(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm text-white"
                  />
                </label>

                <label className="block text-xs font-semibold text-mist-300">
                  {en ? 'PAM Work Permit (Asahal) Expiry' : 'تاريخ انتهاء إذن العمل (القوى العاملة / أسهل)'}
                  <input
                    type="date"
                    dir="ltr"
                    value={workPermitExpiry}
                    onChange={(e) => setWorkPermitExpiry(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/15 bg-[#11161f] px-3 py-2.5 text-sm text-white"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#11161f] p-4">
                <p className="text-xs font-bold text-white">
                  {en
                    ? 'Company Custody & Assets Handover Checklist'
                    : 'قائمة تسليم العهدة الرسمية للموظف عند المباشرة'}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs text-mist-200">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={custodyUniform}
                      onChange={(e) => setCustodyUniform(e.target.checked)}
                    />
                    <span>
                      {en
                        ? '3x Official Brand Uniforms + Safety Shoes & Hygiene Hat'
                        : '3 أطقم زي رسمي للبراند + حذاء سلامة وغطاء رأس صحي'}
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={custodyKnifeSet}
                      onChange={(e) => setCustodyKnifeSet(e.target.checked)}
                    />
                    <span>
                      {en
                        ? 'Kitchen Tools / POS Magnetic Card & Biometric Enrollment'
                        : 'بطاقة الكاشير الممغنطة وتسجيل بصمة الوجه والأصابع'}
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={custodyPhone}
                      onChange={(e) => setCustodyPhone(e.target.checked)}
                    />
                    <span>
                      {en
                        ? 'Company Device / Corporate SIM Line (Supervisors & Drivers)'
                        : 'جهاز هاتف العمل / شريحة اتصال корпораت (للمشرفين والسائقين)'}
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={custodyLockerKey}
                      onChange={(e) => setCustodyLockerKey(e.target.checked)}
                    />
                    <span>
                      {en
                        ? 'Staff Locker Key & Accommodation Bed Allocation'
                        : 'مفتاح خزانة الموظف وتسكين شقة الشركة'}
                    </span>
                  </label>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between border-t border-white/10 bg-[#111722] px-6 py-4">
          <button
            type="button"
            disabled={step === 1 || busy}
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
            className="rounded-xl border border-white/15 px-4 py-2 text-xs font-bold text-mist-200 disabled:opacity-40"
          >
            {en ? '← Previous Step' : '→ الخطوة السابقة'}
          </button>

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s))}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-500"
              >
                {en ? 'Next Step →' : 'الخطوة التالية ←'}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleFinish()}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-2.5 text-xs font-black text-ink-950 shadow-lg hover:brightness-110 disabled:opacity-50"
              >
                {busy
                  ? en
                    ? 'Saving Employee…'
                    : 'جارٍ الحفظ والاعتماد…'
                  : en
                    ? '✅ Complete Onboarding & Save Employee'
                    : '✅ اعتماد التعيين وحفظ ملف الموظف'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
