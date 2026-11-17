'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveEmployeeAction } from '@/app/actions/hr'
import { formatKwd } from '@/lib/format'

type Props = {
  open: boolean
  onClose: () => void
  en: boolean
  initialStep?: 1 | 2 | 3 | 4
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
] as const

const BRANCHES = [
  'Salmiya Branch',
  'Avenues Branch',
  '360 Mall Branch',
  'Assima Mall Branch',
  'Al-Kout Mall Branch',
  'Ardiya Branch',
  'Promenade Mall Branch',
  'School Canteens (NPIS / FAIPS)',
  'Central Kitchen',
  'HQ Administration & Finance',
] as const

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
] as const

export function NewEmployeeWizardModal({ open, onClose, en, initialStep = 1 }: Props) {
  const router = useRouter()
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const locale = en ? 'en' : 'ar'

  const [step, setStep] = useState<1 | 2 | 3 | 4>(initialStep)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  busyRef.current = busy
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Step 1: Personal, Passport & Kuwait Civil ID (never pre-populated with fake personal data)
  const [fullName, setFullName] = useState('')
  const [nationality, setNationality] = useState('India')
  const [civilId, setCivilId] = useState('')
  const [passportNo, setPassportNo] = useState('')
  const [phone, setPhone] = useState('')
  const [civilIdExpiry, setCivilIdExpiry] = useState('')
  const [passportExpiry, setPassportExpiry] = useState('')

  // Step 2: Job, Brand, Branch & Biometric Barcode
  const [barcode, setBarcode] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [brand, setBrand] = useState<string>(BRANDS[0])
  const [branch, setBranch] = useState<string>(BRANCHES[0])
  const [hireDate, setHireDate] = useState('')
  const [workStatus, setWorkStatus] = useState<'ACTIVE' | 'ON_VACATION' | 'OVERSEAS_PIPELINE'>('ACTIVE')

  // Step 3: Salary Structure (0.000 KWD), IBAN & Bank
  const [basicSalary, setBasicSalary] = useState('')
  const [housingAllowance, setHousingAllowance] = useState('')
  const [transportAllowance, setTransportAllowance] = useState('')
  const [foodAllowance, setFoodAllowance] = useState('')
  const [fixedDeductions, setFixedDeductions] = useState('')
  const [bankName, setBankName] = useState('National Bank of Kuwait (NBK)')
  const [iban, setIban] = useState('')

  // Step 4: Documents & Custody Handover
  const [healthCardExpiry, setHealthCardExpiry] = useState('')
  const [workPermitExpiry, setWorkPermitExpiry] = useState('')
  const [custodyUniform, setCustodyUniform] = useState(true)
  const [custodyPhone, setCustodyPhone] = useState(false)
  const [custodyKnifeSet, setCustodyKnifeSet] = useState(true)
  const [custodyLockerKey, setCustodyLockerKey] = useState(true)

  useEffect(() => {
    if (!open) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const raf = window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus()
    })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  const basicNum = Number(basicSalary)
  const housingNum = Number(housingAllowance)
  const transportNum = Number(transportAllowance)
  const foodNum = Number(foodAllowance)
  const deductionNum = Number(fixedDeductions)

  const safeBasic = Number.isFinite(basicNum) ? basicNum : 0
  const totalAllowances =
    (Number.isFinite(housingNum) ? housingNum : 0) +
    (Number.isFinite(transportNum) ? transportNum : 0) +
    (Number.isFinite(foodNum) ? foodNum : 0)
  const safeDeductions = Number.isFinite(deductionNum) ? deductionNum : 0
  const netMonthly = safeBasic + totalAllowances - safeDeductions

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
        basicSalary: safeBasic,
        allowances: totalAllowances,
        deductions: safeDeductions,
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
            ? `Employee ${fullName.trim()} (${barcode.trim()}) onboarded successfully with WPS & Kuwait compliance profile.`
            : `تم إنشاء وتعيين الموظف ${fullName.trim()} (${barcode.trim()}) بنجاح مع ربط حماية الأجور وملف الإقامة والبلدية.`,
        )
        router.refresh()
        setTimeout(() => {
          setSuccessMsg(null)
          onClose()
        }, 1200)
      }
    } catch {
      setError(en ? 'Unable to save employee right now. Please try again.' : 'تعذر حفظ ملف الموظف حالياً. يرجى المحاولة مجدداً.')
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'ds-focus-ring mt-1 w-full rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-subtle)] px-3 py-2.5 text-sm text-[var(--ds-text-primary)] placeholder:text-[var(--ds-text-muted)]'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      dir={en ? 'ltr' : 'rtl'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-employee-wizard-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className="ds-surface-elevated w-full max-w-3xl overflow-hidden rounded-3xl border border-[var(--ds-border-accent)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ds-accent)' }}>
              {en
                ? 'Venture Foods W.L.L. · 4-Step Enterprise Onboarding Wizard'
                : 'شركة فنتشر فودز ذ.م.م. · معالج تعيين موظف جديد (4 خطوات)'}
            </p>
            <h3 id="new-employee-wizard-title" className="mt-0.5 text-lg font-extrabold text-[var(--ds-text-primary)]">
              {en ? 'New Employee & Contract Onboarding' : 'إنشاء موظف جديد وعقد عمل كويتي'}
            </h3>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={en ? 'Close modal' : 'إغلاق النافذة'}
            className="ds-focus-ring shrink-0 cursor-pointer rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-3 py-1.5 text-xs font-bold text-[var(--ds-text-primary)] hover:bg-[var(--ds-bg-hover)]"
          >
            {en ? 'Close ✕' : 'إغلاق ✕'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-[var(--ds-border-hairline)] bg-[var(--ds-bg-canvas)] px-5 py-3 text-xs font-bold sm:grid-cols-4 sm:px-6">
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
              en: '3. Salary (KWD) & IBAN',
            },
            {
              s: 4 as const,
              ar: '4. الوثائق وتسليم العهد',
              en: '4. Documents & Custody',
            },
          ].map((item) => {
            const isCurrent = step === item.s
            const isCompleted = step > item.s
            return (
              <button
                key={item.s}
                type="button"
                onClick={() => setStep(item.s)}
                aria-current={isCurrent ? 'step' : undefined}
                className="ds-focus-ring cursor-pointer rounded-xl border px-3 py-2 text-start transition"
                style={{
                  borderColor: isCurrent
                    ? 'var(--ds-accent)'
                    : isCompleted
                      ? 'var(--ds-positive-border)'
                      : 'var(--ds-border-hairline)',
                  backgroundColor: isCurrent
                    ? 'var(--ds-accent-soft)'
                    : isCompleted
                      ? 'var(--ds-positive-bg)'
                      : 'var(--ds-bg-surface)',
                  color: isCurrent || isCompleted ? 'var(--ds-text-primary)' : 'var(--ds-text-muted)',
                }}
              >
                {en ? item.en : item.ar}
              </button>
            )
          })}
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5 sm:p-6">
          {error ? (
            <p
              role="alert"
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
              style={{
                backgroundColor: 'var(--ds-negative-bg)',
                borderColor: 'var(--ds-negative-border)',
                color: 'var(--ds-negative)',
              }}
            >
              {error}
            </p>
          ) : null}
          {successMsg ? (
            <p
              role="status"
              className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
              style={{
                backgroundColor: 'var(--ds-positive-bg)',
                borderColor: 'var(--ds-positive-border)',
                color: 'var(--ds-positive)',
              }}
            >
              {successMsg}
            </p>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-[var(--ds-text-secondary)] sm:col-span-2">
                {en ? 'Full Legal Name (as in Passport & Civil ID)' : 'الاسم الكامل للموظف (مطابق للجواز والبطاقة المدنية)'}
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={en ? 'Enter full legal name' : 'أدخل الاسم القانوني الكامل'}
                  className={inputClass}
                />
              </label>

              <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                {en ? 'Nationality' : 'الجنسية'}
                <select
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  className={inputClass}
                >
                  {NATIONALITIES.map((n) => (
                    <option key={n.en} value={n.en}>
                      {en ? n.en : `${n.ar} (${n.en})`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                {en ? 'Kuwait Civil ID Number (12 Digits)' : 'الرقم المدني الكويتي (12 رقماً)'}
                <input
                  dir="ltr"
                  value={civilId}
                  onChange={(e) => setCivilId(e.target.value)}
                  placeholder="12-digit Civil ID"
                  className={`${inputClass} font-mono tabular-nums`}
                />
              </label>

              <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                {en ? 'Passport Number' : 'رقم جواز السفر'}
                <input
                  dir="ltr"
                  value={passportNo}
                  onChange={(e) => setPassportNo(e.target.value)}
                  placeholder={en ? 'Passport number' : 'رقم الجواز'}
                  className={`${inputClass} font-mono`}
                />
              </label>

              <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                {en ? 'Kuwait Mobile Number' : 'رقم الهاتف النقال (الكويت)'}
                <input
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+965 ________"
                  className={`${inputClass} font-mono tabular-nums`}
                />
              </label>

              <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                {en ? 'Civil ID / Article 18 Residency Expiry' : 'تاريخ انتهاء البطاقة المدنية والإقامة (مادة 18)'}
                <input
                  type="date"
                  dir="ltr"
                  value={civilIdExpiry}
                  onChange={(e) => setCivilIdExpiry(e.target.value)}
                  className={inputClass}
                />
              </label>

              <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                {en ? 'Passport Expiry Date' : 'تاريخ انتهاء جواز السفر'}
                <input
                  type="date"
                  dir="ltr"
                  value={passportExpiry}
                  onChange={(e) => setPassportExpiry(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                {en ? 'Biometric Attendance Badge / Barcode' : 'رقم البصمة / الباركود الوظيفي (Barcode)'}
                <input
                  dir="ltr"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder={en ? 'e.g. 2095' : 'مثال: 2095'}
                  className={`${inputClass} font-mono tabular-nums`}
                />
              </label>

              <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                {en ? 'Job Title / Designation' : 'المسمى الوظيفي'}
                <input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder={en ? 'e.g. Chef de Partie' : 'مثال: شيف مطبخ'}
                  className={inputClass}
                />
              </label>

              <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                {en ? 'Assigned Brand (6 Brands / CK)' : 'البراند التابع له'}
                <select
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className={inputClass}
                >
                  {BRANDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                {en ? 'Assigned Branch / Location' : 'الفرع / موقع العمل'}
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className={inputClass}
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                {en ? 'Joining / Hire Date' : 'تاريخ المباشرة والتعيين'}
                <input
                  type="date"
                  dir="ltr"
                  value={hireDate}
                  onChange={(e) => setHireDate(e.target.value)}
                  className={inputClass}
                />
              </label>

              <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                {en ? 'Current Employment Status' : 'حالة العمل الحالية'}
                <select
                  value={workStatus}
                  onChange={(e) => setWorkStatus(e.target.value as 'ACTIVE' | 'ON_VACATION' | 'OVERSEAS_PIPELINE')}
                  className={inputClass}
                >
                  <option value="ACTIVE">{en ? 'Active on Duty' : 'على رأس العمل (Active)'}</option>
                  <option value="ON_VACATION">{en ? 'On Annual Vacation' : 'في إجازة سفر (On Vacation)'}</option>
                  <option value="OVERSEAS_PIPELINE">
                    {en ? 'Overseas Visa 18 Pipeline' : 'قيد الاستقدام من الخارج (Visa 18)'}
                  </option>
                </select>
              </label>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                  {en ? 'Basic Salary (KWD)' : 'الراتب الأساسي (د.ك)'}
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    dir="ltr"
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(e.target.value)}
                    placeholder="0.000"
                    className={`${inputClass} font-mono tabular-nums`}
                  />
                </label>

                <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                  {en ? 'Housing Allowance (KWD)' : 'بدل السكن (د.ك)'}
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    dir="ltr"
                    value={housingAllowance}
                    onChange={(e) => setHousingAllowance(e.target.value)}
                    placeholder="0.000"
                    className={`${inputClass} font-mono tabular-nums`}
                  />
                </label>

                <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                  {en ? 'Transport Allowance (KWD)' : 'بدل المواصلات (د.ك)'}
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    dir="ltr"
                    value={transportAllowance}
                    onChange={(e) => setTransportAllowance(e.target.value)}
                    placeholder="0.000"
                    className={`${inputClass} font-mono tabular-nums`}
                  />
                </label>

                <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                  {en ? 'Meal / Duty Allowance (KWD)' : 'بدل الوجبات وطبيعة العمل (د.ك)'}
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    dir="ltr"
                    value={foodAllowance}
                    onChange={(e) => setFoodAllowance(e.target.value)}
                    placeholder="0.000"
                    className={`${inputClass} font-mono tabular-nums`}
                  />
                </label>

                <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                  {en ? 'Fixed Monthly Deduction (KWD)' : 'الاستقطاعات الشهرية الثابتة (د.ك)'}
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    dir="ltr"
                    value={fixedDeductions}
                    onChange={(e) => setFixedDeductions(e.target.value)}
                    placeholder="0.000"
                    className={`${inputClass} font-mono tabular-nums`}
                  />
                </label>

                <div
                  className="rounded-xl border p-3"
                  style={{
                    backgroundColor: 'var(--ds-accent-soft)',
                    borderColor: 'var(--ds-border-accent)',
                  }}
                >
                  <p className="text-xs font-semibold text-[var(--ds-text-secondary)]">
                    {en ? 'Total Net Contract Package' : 'صافي الراتب التعاقدي الشهري'}
                  </p>
                  <p className="ds-num mt-1 text-xl font-black tabular-nums text-[var(--ds-text-primary)]" dir="ltr">
                    {formatKwd(netMonthly, locale)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                  {en ? 'Kuwait Bank Name (WPS)' : 'اسم البنك المعتمد (حماية الأجور WPS)'}
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className={inputClass}
                  >
                    <option value="National Bank of Kuwait (NBK)">National Bank of Kuwait (NBK) — البنك الوطني</option>
                    <option value="Boubyan Bank">Boubyan Bank — بنك بوبيان</option>
                    <option value="Kuwait Finance House (KFH)">Kuwait Finance House (KFH) — بيت التمويل</option>
                    <option value="Gulf Bank (GBK)">Gulf Bank (GBK) — بنك الخليج</option>
                    <option value="Burgan Bank">Burgan Bank — بنك برقان</option>
                  </select>
                </label>

                <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                  {en ? 'Kuwait IBAN (30 Alphanumeric Chars)' : 'رقم الآيبان البنكي الكويتي (IBAN)'}
                  <input
                    dir="ltr"
                    value={iban}
                    onChange={(e) => setIban(e.target.value)}
                    placeholder="KW__"
                    className={`${inputClass} font-mono`}
                  />
                </label>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                  {en ? 'Kuwait Municipality Health Card Expiry' : 'تاريخ انتهاء شهادة صحة بلدية الكويت'}
                  <input
                    type="date"
                    dir="ltr"
                    value={healthCardExpiry}
                    onChange={(e) => setHealthCardExpiry(e.target.value)}
                    className={inputClass}
                  />
                </label>

                <label className="block text-xs font-semibold text-[var(--ds-text-secondary)]">
                  {en ? 'PAM Work Permit (Asahal) Expiry' : 'تاريخ انتهاء إذن العمل (القوى العاملة / أسهل)'}
                  <input
                    type="date"
                    dir="ltr"
                    value={workPermitExpiry}
                    onChange={(e) => setWorkPermitExpiry(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] p-4">
                <p className="text-xs font-bold text-[var(--ds-text-primary)]">
                  {en
                    ? 'Company Custody & Assets Handover Checklist'
                    : 'قائمة تسليم العهدة الرسمية للموظف عند المباشرة'}
                </p>
                <div className="mt-3 grid gap-2 text-xs text-[var(--ds-text-secondary)] sm:grid-cols-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={custodyUniform}
                      onChange={(e) => setCustodyUniform(e.target.checked)}
                      className="ds-focus-ring"
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
                      className="ds-focus-ring"
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
                      className="ds-focus-ring"
                    />
                    <span>
                      {en
                        ? 'Company Device / Corporate SIM Line (Supervisors & Drivers)'
                        : 'جهاز هاتف العمل / شريحة اتصال للشركة (للمشرفين والسائقين)'}
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={custodyLockerKey}
                      onChange={(e) => setCustodyLockerKey(e.target.checked)}
                      className="ds-focus-ring"
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

        <div className="flex items-center justify-between border-t border-[var(--ds-border-hairline)] bg-[var(--ds-bg-subtle)] px-5 py-4 sm:px-6">
          <button
            type="button"
            disabled={step === 1 || busy}
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
            className="ds-focus-ring cursor-pointer rounded-xl border border-[var(--ds-border-strong)] bg-[var(--ds-bg-surface)] px-4 py-2 text-xs font-bold text-[var(--ds-text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {en ? '← Previous Step' : '→ الخطوة السابقة'}
          </button>

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s))}
                className="ds-focus-ring btn-colored cursor-pointer rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white hover:bg-emerald-700"
              >
                {en ? 'Next Step →' : 'الخطوة التالية ←'}
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleFinish()}
                className="ds-focus-ring btn-colored cursor-pointer rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-black text-white shadow-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy
                  ? en
                    ? 'Saving Employee…'
                    : 'جارٍ الحفظ والاعتماد…'
                  : en
                    ? 'Complete Onboarding & Save'
                    : 'اعتماد التعيين وحفظ ملف الموظف'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
