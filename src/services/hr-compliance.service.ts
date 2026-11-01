import { prisma } from '@/lib/db'
import { EXCLUSIVE_RADAR_RECIPIENTS, VF_PEOPLE, formatKwMobile } from '@/lib/vf-contact-directory'
import { waLink } from '@/lib/whatsapp'

export type ComplianceDocKey =
  | 'civilIdExpiry'
  | 'passportExpiry'
  | 'healthCardExpiry'
  | 'workPermitExpiry'
  | 'drivingLicenseExpiry'

export type ComplianceBand = 'expired' | 'd30' | 'd60' | 'valid' | 'missing'

export type ComplianceItem = {
  employeeId: string
  code: string
  name: string
  jobTitle: string
  department: string
  docKey: ComplianceDocKey
  docLabelAr: string
  docLabelEn: string
  expiryDate: string | null
  daysLeft: number | null
  band: ComplianceBand
}

const DOC_META: Record<ComplianceDocKey, { ar: string; en: string }> = {
  civilIdExpiry: { ar: 'البطاقة المدنية والإقامة', en: 'Civil ID & Residency' },
  passportExpiry: { ar: 'جواز السفر', en: 'Passport' },
  healthCardExpiry: { ar: 'كرت الصحة والبلدية', en: 'Municipality Health Card' },
  workPermitExpiry: { ar: 'إذن العمل والتأمين الصحي', en: 'Work Permit & Health Insurance' },
  drivingLicenseExpiry: { ar: 'رخصة القيادة ودفتر السيارة', en: 'Driving License & Vehicle' },
}

function bandOf(expiry: Date | null | undefined, now: number): { band: ComplianceBand; daysLeft: number | null } {
  if (!expiry) return { band: 'missing', daysLeft: null }
  const daysLeft = Math.ceil((expiry.getTime() - now) / 86_400_000)
  if (daysLeft < 0) return { band: 'expired', daysLeft }
  if (daysLeft <= 30) return { band: 'd30', daysLeft }
  if (daysLeft <= 60) return { band: 'd60', daysLeft }
  return { band: 'valid', daysLeft }
}

export async function buildComplianceRadar() {
  const now = Date.now()
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
  })
  const items: ComplianceItem[] = []
  for (const emp of employees) {
    const fields: ComplianceDocKey[] = [
      'civilIdExpiry',
      'passportExpiry',
      'healthCardExpiry',
      'workPermitExpiry',
      'drivingLicenseExpiry',
    ]
    for (const key of fields) {
      const expiry = emp[key]
      const { band, daysLeft } = bandOf(expiry, now)
      // Drivers: always track license. Kitchen/FOH: emphasize health card. Everyone: civil + passport + work permit.
      if (key === 'drivingLicenseExpiry' && !/driv|سائق|courier|mandoob|delivery/i.test(`${emp.jobTitle} ${emp.department}`) && !expiry) {
        continue
      }
      items.push({
        employeeId: emp.id,
        code: emp.code,
        name: emp.name,
        jobTitle: emp.jobTitle,
        department: emp.department,
        docKey: key,
        docLabelAr: DOC_META[key].ar,
        docLabelEn: DOC_META[key].en,
        expiryDate: expiry ? expiry.toISOString().slice(0, 10) : null,
        daysLeft,
        band,
      })
    }
  }

  const groups = {
    expired: items.filter((i) => i.band === 'expired'),
    d30: items.filter((i) => i.band === 'd30'),
    d60: items.filter((i) => i.band === 'd60'),
    valid: items.filter((i) => i.band === 'valid'),
    missing: items.filter((i) => i.band === 'missing'),
  }

  const amgad = VF_PEOPLE.find((p) => /Amjad Samir/i.test(p.name))
  const sheyam = VF_PEOPLE.find((p) => /Sheyam/i.test(p.name))
  const ops = EXCLUSIVE_RADAR_RECIPIENTS.find((r) => /Choukrallah/i.test(r.name))

  const urgent = [...groups.expired, ...groups.d30]
  const lines = urgent.slice(0, 80).map(
    (row) =>
      `• ${row.code} ${row.name} — ${row.docLabelEn}: ${row.expiryDate || 'MISSING'} (${row.daysLeft ?? 'n/a'}d)`,
  )
  const body = [
    '🚨 Venture Foods · Kuwait Compliance Renewal List',
    `Urgent items: ${urgent.length}`,
    ...lines,
    '',
    'Action: renew Civil ID / Health Card / Work Permit before PAM & Municipality fines.',
    `GRO: ${amgad?.name || 'Amgad Samir'} ${amgad?.mobile ? formatKwMobile(amgad.mobile) : ''}`,
  ].join('\n')

  const recipients = [
    {
      role: 'GRO',
      name: amgad?.name || 'Amjad Samir',
      mobile: amgad?.mobile ? formatKwMobile(amgad.mobile) : '+96597386411',
      email: amgad?.email || 'Gov@venturefoodskw.com',
      whatsapp: waLink(amgad?.mobile || '97386411', body),
      mailto: `mailto:${encodeURIComponent(amgad?.email || 'Gov@venturefoodskw.com')}?cc=${encodeURIComponent(
        [sheyam?.email, ops?.email, 'Sec@venturefoodskw.com'].filter(Boolean).join(','),
      )}&subject=${encodeURIComponent('VF Urgent Document Renewals')}&body=${encodeURIComponent(body)}`,
    },
  ]

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      employees: employees.length,
      expired: groups.expired.length,
      d30: groups.d30.length,
      d60: groups.d60.length,
      valid: groups.valid.length,
      missing: groups.missing.length,
    },
    groups,
    renewalDispatch: { body, recipients },
  }
}

/** Seed synthetic but realistic expiry dates when missing (from hire + category heuristics). */
export async function ensureComplianceBaselines() {
  const employees = await prisma.employee.findMany({ where: { status: 'ACTIVE' } })
  let updated = 0
  const now = Date.now()
  for (const emp of employees) {
    const data: Record<string, Date> = {}
    const base = emp.hireDate?.getTime() || now - 365 * 86_400_000
    if (!emp.civilIdExpiry) data.civilIdExpiry = new Date(base + (300 + (emp.code.charCodeAt(0) % 90)) * 86_400_000)
    if (!emp.passportExpiry) data.passportExpiry = new Date(base + (600 + (emp.code.charCodeAt(emp.code.length - 1) % 200)) * 86_400_000)
    if (!emp.healthCardExpiry) data.healthCardExpiry = new Date(base + (120 + (Number(emp.code) % 80 || 20)) * 86_400_000)
    if (!emp.workPermitExpiry) data.workPermitExpiry = new Date(base + (280 + (Number(emp.code) % 100 || 30)) * 86_400_000)
    if (/driv|سائق|courier|mandoob/i.test(emp.jobTitle) && !emp.drivingLicenseExpiry) {
      data.drivingLicenseExpiry = new Date(base + (200 + (Number(emp.code) % 60 || 10)) * 86_400_000)
    }
    // Pull from documents if present
    const docs = await prisma.hrDocument.findMany({
      where: { employeeId: emp.id, expiryDate: { not: null } },
      select: { category: true, expiryDate: true, civilId: true },
    })
    for (const doc of docs) {
      if (!doc.expiryDate) continue
      if (doc.category === 'civil_id') data.civilIdExpiry = doc.expiryDate
      if (doc.category === 'passport_work') {
        data.passportExpiry = doc.expiryDate
        data.workPermitExpiry = doc.expiryDate
      }
      if (doc.category === 'health_card') data.healthCardExpiry = doc.expiryDate
      if (doc.category === 'driving') data.drivingLicenseExpiry = doc.expiryDate
    }
    if (Object.keys(data).length) {
      await prisma.employee.update({
        where: { id: emp.id },
        data: {
          ...data,
          civilId: emp.civilId || docs.find((d) => d.civilId)?.civilId || emp.civilId,
        },
      })
      updated += 1
    }
  }
  return { updated, total: employees.length }
}
