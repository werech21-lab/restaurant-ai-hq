/**
 * Official Venture Foods phone / PBX directory (VF Contact List 21-10-2026).
 * Source Excel: database/seeds/VF_Contact_List_21-10-2026.xlsx
 */

export type VfContactPerson = {
  name: string
  title: string
  ext?: string
  direct?: string
  mobile?: string
  email?: string
  group: 'executive' | 'ops' | 'finance' | 'hr' | 'it' | 'marketing' | 'procurement' | 'culinary' | 'callcenter' | 'warehouse' | 'kitchen'
}

export type VfBrandHotline = {
  brand: string
  phones: string[]
  email?: string
}

export type VfBranchContact = {
  code: string
  nameAr: string
  nameEn: string
  ext: string
  direct: string
  email?: string
  warehouseMatch: string[]
}

/** Exclusive Instant Offline / TGO alert recipients — Peak Hours only. Hard lock. */
export const EXCLUSIVE_RADAR_RECIPIENTS = [
  {
    id: 'abdullah-abdulghafar',
    name: 'Abdullah Abdulghafar',
    title: 'Executive Secretary',
    email: 'Sec@venturefoodskw.com',
    mobile: '97386418',
    mobileE164: '+96597386418',
    mobileDisplay: '+965 97386418',
    ext: '102',
    direct: '22469500',
  },
  {
    id: 'choukrallah-nassif',
    name: 'Choukrallah Nassif',
    title: 'Operations Manager',
    email: 'operations@venturefoodskw.com',
    mobile: '90061400',
    mobileE164: '+96590061400',
    mobileDisplay: '+965 90061400',
    ext: '120',
    direct: undefined as string | undefined,
  },
  {
    id: 'abdulrahman-mohamed',
    name: 'Abdulrahman Mohamed Gamaledin',
    title: 'Marketing Coordinator',
    email: 'abdelrahmanm@venturefoodskw.com',
    mobile: '90998227',
    mobileE164: '+96590998227',
    mobileDisplay: '+965 90998227',
    ext: '130',
    direct: undefined as string | undefined,
  },
] as const

export type ExclusiveRadarRecipient = (typeof EXCLUSIVE_RADAR_RECIPIENTS)[number]

export const EXCLUSIVE_RADAR_EMAILS = new Set(
  EXCLUSIVE_RADAR_RECIPIENTS.map((r) => r.email.toLowerCase()),
)

export const EXCLUSIVE_RADAR_MOBILES = new Set(
  EXCLUSIVE_RADAR_RECIPIENTS.map((r) => r.mobile.replace(/\D/g, '')),
)

export const VF_PEOPLE: VfContactPerson[] = [
  { name: 'Ahmad Al-Ebrahim', title: 'CEO', ext: '103', mobile: '99419415', email: 'ahmed@venturefoodskw.com', group: 'executive' },
  { name: 'Ahmad Al-Abdulmohsen', title: 'CMO', ext: '104', mobile: '90000541', email: 'ahmad@venturefoodskw.com', group: 'executive' },
  { name: 'Hani Philip', title: 'CFO', ext: '106', mobile: '99545292', email: 'hani@venturefoodskw.com', group: 'finance' },
  { name: 'Abdullah Abdulghafar', title: 'Executive Secretary', ext: '102', direct: '22469500', mobile: '97386418', email: 'Sec@venturefoodskw.com', group: 'executive' },
  { name: 'Mohammed Alsaed', title: 'Chief Accountant', ext: '110', mobile: '97386436', email: 'mohameda@venturefoodskw.com', group: 'finance' },
  { name: 'Samy Sabry', title: 'Accountant 1', ext: '111', email: 'samys@venturefoodskw.com', group: 'finance' },
  { name: 'Andrew Nageh', title: 'Accountant 3', ext: '114', email: 'accounts@venturefoodskw.com', group: 'finance' },
  { name: 'Kapil Dev', title: 'Accountant 4', ext: '115', email: 'kapild@venturefoodskw.com', group: 'finance' },
  { name: 'Sunil Ponukumatla', title: 'Inventory Supervisor', ext: '151', email: 'sunilk@venturefoodskw.com', group: 'procurement' },
  { name: 'Zakaria Iskandar', title: 'OPS Director', mobile: '97386406', email: 'zakariai@venturefoodskw.com', group: 'ops' },
  { name: 'Choukrallah Nassif', title: 'Ops Manager', ext: '120', mobile: '90061400', email: 'operations@venturefoodskw.com', group: 'ops' },
  { name: 'Rabih Yehia', title: 'Asst. Ops Manager', mobile: '97386439', email: 'rabihy@venturefoodskw.com', group: 'ops' },
  { name: 'Sheila Bulibuli', title: 'Area Manager', mobile: '94079377', email: 'shielab@venturefoodskw.com', group: 'ops' },
  { name: 'Sheyam Hekmat', title: 'HR & Admin Manager', ext: '140', mobile: '97386426', email: 'sheyamh@venturefoodskw.com', group: 'hr' },
  { name: 'Zahraa Ali', title: 'HR Assistant', ext: '141', mobile: '94079375', email: 'zahraa@venturefoodskw.com', group: 'hr' },
  { name: 'Amjad Samir', title: 'GRO / Mandoob', ext: '143', mobile: '97386411', email: 'Gov@venturefoodskw.com', group: 'hr' },
  { name: 'Abdulrahman Mohamed Gamaledin', title: 'Marketing Coordinator', ext: '130', mobile: '90998227', email: 'abdelrahmanm@venturefoodskw.com', group: 'marketing' },
  { name: 'Nader Nozhy', title: 'Purchasing Supervisor', ext: '150', mobile: '97386414', email: 'nadern@venturefoodskw.com', group: 'procurement' },
  { name: 'Shaljith Kalleeri', title: 'IT Admin', ext: '202', mobile: '97386429', email: 'it@venturefoodskw.com', group: 'it' },
  { name: 'Anand Rao', title: 'DCDP Chef', mobile: '97386402', email: 'Anandr@venturefoodskw.com', group: 'culinary' },
  { name: 'Juven Ray Cuizon', title: 'Call Center Supervisor', ext: '200', direct: '22243833', mobile: '94079383', email: 'callcenter@venturefoodskw.com', group: 'callcenter' },
  { name: 'Munir Ahmed / Berlin Periera', title: 'Warehouse Aswaq Al-Qurain', ext: '301', direct: '22243834', email: 'warehouse@venturefoodskw.com', group: 'warehouse' },
  { name: 'Nelson Baluso', title: 'Central Kitchen Aswaq Al-Qurain', ext: '501', direct: '302', email: 'CK@venturefoodskw.com', group: 'kitchen' },
]

export const VF_BRAND_HOTLINES: VfBrandHotline[] = [
  { brand: 'China Garden', phones: ['1805080', '25720010', '25720070'], email: 'chinagarden@venturefoodskw.com' },
  { brand: 'The Noodle Bar', phones: ['22216700'] },
  { brand: 'Karak Cafeteria', phones: ['22299077', '22243446'] },
  { brand: 'Farm Brown', phones: ['22323353'] },
  { brand: "Frank's Steak Sandwiches", phones: ['22299055', '22323110'] },
  { brand: 'Tahina', phones: ['22299066'] },
  { brand: 'Catering Hotline', phones: ['91104411'] },
]

export const VF_BRANCHES: VfBranchContact[] = [
  { code: 'SAL', nameAr: 'فرع السالمية', nameEn: 'Salmiya Branch', ext: '401', direct: '25713993', email: 'salmiyacg@venturefoodskw.com', warehouseMatch: ['Salmiya', 'السالمية'] },
  { code: 'AVE', nameAr: 'فرع الأفنيوز', nameEn: 'Avenues Branch', ext: '402', direct: '22212231', email: 'avenuesmallcg@venturefoodskw.com', warehouseMatch: ['Avenues', 'الأفنيوز'] },
  { code: 'ARD', nameAr: 'فرع العارضية', nameEn: 'Ardiya Branch', ext: '403', direct: '22243835', email: 'ardiyacg@venturefoodskw.com', warehouseMatch: ['Ardiya', 'العارضية', 'KWC'] },
  { code: '360', nameAr: 'فرع 360 مول', nameEn: '360 Mall Branch', ext: '404', direct: '22240102', email: '360mallcg@venturefoodskw.com', warehouseMatch: ['360'] },
  { code: 'KOUT', nameAr: 'فرع الكوت مول', nameEn: 'Al-Kout Mall Branch', ext: '405', direct: '25309520', email: 'alkoutmallcg@venturefoodskw.com', warehouseMatch: ['Kout', 'الكوت'] },
  { code: 'QRN', nameAr: 'فرع أسواق القرين', nameEn: 'Aswaq Al Qurain Branch', ext: '406', direct: '22213211', email: 'alqurain@venturefoodskw.com', warehouseMatch: ['Qurain', 'القرين'] },
  { code: 'ASM', nameAr: 'فرع العاصمة مول', nameEn: 'Assima Mall Branch', ext: '407', direct: '22243446', email: 'assimamallcg@venturefoodskw.com', warehouseMatch: ['Assima', 'العاصمة', 'ASM'] },
  { code: 'PRM', nameAr: 'فرع البروميناد مول', nameEn: 'Promenade Mall Branch', ext: '408', direct: '22212230', email: 'promenademall@venturefoodskw.com', warehouseMatch: ['Promenade', 'البروميناد', 'PRM'] },
  { code: 'FRW', nameAr: 'فرع الفروانية', nameEn: 'Farwaniya Branch', ext: '410', direct: '22212232', email: 'farwaniya@venturefoodskw.com', warehouseMatch: ['Farwaniya', 'الفروانية'] },
  { code: 'SHW', nameAr: 'فرع الشويخ', nameEn: 'Shuwaikh Branch', ext: '402', direct: '22243836', warehouseMatch: ['Shuwaikh', 'الشويخ'] },
  { code: 'CK', nameAr: 'المطبخ المركزي', nameEn: 'Central Kitchen', ext: '501', direct: '302', email: 'CK@venturefoodskw.com', warehouseMatch: ['Central Kitchen', 'CK', 'المطبخ'] },
]

export function formatKwMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '')
  const local = digits.startsWith('965') ? digits.slice(3) : digits
  return `+965 ${local}`
}

export function employeeNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z\u0600-\u06ff\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)
}

/** Fuzzy match directory person → HR employee name. */
export function matchDirectoryPerson(employeeName: string): VfContactPerson | null {
  const emp = employeeName.toLowerCase()
  for (const person of VF_PEOPLE) {
    if (emp.includes(person.name.toLowerCase().split(' ')[0]) && emp.includes(person.name.toLowerCase().split(' ').slice(-1)[0]!)) {
      return person
    }
  }
  // Known aliases from Odoo dump
  const aliases: Array<[RegExp, string]> = [
    [/choukrallah|choukralla/i, 'Choukrallah Nassif'],
    [/zakaria\s+iskandar/i, 'Zakaria Iskandar'],
    [/rabih.*yehia|rabih anis/i, 'Rabih Yehia'],
    [/sheila.*bulibuli|sheila ambos/i, 'Sheila Bulibuli'],
    [/mohamed al saeed|mohammed alsaed|mohameda/i, 'Mohammed Alsaed'],
    [/abdelrahman|abdulrahman mohamed gamaledin/i, 'Abdulrahman Mohamed Gamaledin'],
    [/amgad samir|amjad samir/i, 'Amjad Samir'],
    [/hani philip/i, 'Hani Philip'],
  ]
  for (const [re, target] of aliases) {
    if (re.test(employeeName)) {
      return VF_PEOPLE.find((p) => p.name === target) ?? null
    }
  }
  return null
}
