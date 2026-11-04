/**
 * Venture Foods Restaurant Management W.L.L. — Comprehensive Bilingual Employee Directory
 * Synchronized with Walnut SS / Odoo HRMS.
 * Total Active Employees: 166 (Excluding phantom driver/admin accounts and closed Jahra branch)
 */

export type VentureEmployee = {
  id: string
  code: string
  nameAr: string
  nameEn: string
  jobTitleAr: string
  jobTitleEn: string
  department: string
  departmentAr: string
  workLocation: string
  workLocationAr: string
  phone: string
  mobile: string
  email: string
  civilId: string
  civilIdExpiry: string
  workPermitExpiry: string
  residencyExpiry: string
  healthCardExpiry: string
  passportNo: string
  passportExpiry: string
  nationalityAr: string
  nationalityEn: string
  flag: string
  basicSalary: number
  allowances: number
  deductions: number
  netSalary: number
  pamSalary: number
  pamFileNumber: string
  pamSponsor: string
  pamDesignationAr: string
  pamId: string
  bankName: string
  bankNameAr: string
  bankAccount: string
  iban: string
  status: 'ACTIVE' | 'ON_VACATION'
  hireDate: string
  contractType: string
  managerNameAr: string
  managerNameEn: string
  workingHours: string
  leaves: { balance: number; taken: number; total: number }
  loans: number
  custodyCount: number
  custodyItems: Array<{
    nameAr: string
    nameEn: string
    tag: string
    date: string
  }>
  documents: Array<{
    id: string
    nameAr: string
    nameEn: string
    type: string
    fileName: string
    uploadDate: string
    statusAr: string
    statusEn: string
    size: string
  }>
  auditLog: Array<{
    date: string
    actionAr: string
    actionEn: string
    user: string
  }>
}

export type VentureDepartmentMeta = {
  key: string
  en: string
  ar: string
  count: number
}

export type VentureLocationMeta = {
  key: string
  en: string
  ar: string
  count: number
}

export const VENTURE_DEPARTMENTS: VentureDepartmentMeta[] = [
  { key: 'ALL', en: 'All Departments', ar: 'جميع الأقسام', count: 166 },
  { key: 'Rest. Operations Department', en: 'Rest. Operations Department', ar: 'إدارة عمليات المطاعم والفروع', count: 121 },
  { key: 'Culinary Department', en: 'Culinary Department', ar: 'إدارة الطهي والإنتاج المركزي', count: 19 },
  { key: 'Supply Chain Department', en: 'Supply Chain Department', ar: 'إدارة سلاسل الإمداد والمستودعات', count: 12 },
  { key: 'Finance Department', en: 'Finance Department', ar: 'الإدارة المالية والمحاسبة', count: 5 },
  { key: 'HR & Admin Department', en: 'HR & Admin Department', ar: 'الموارد البشرية والشؤون الإدارية', count: 4 },
  { key: 'Outside Partners / Executive', en: 'Outside Partners / Executive', ar: 'الإدارة التنفيذية والشركاء', count: 2 },
  { key: 'Marketing Department', en: 'Marketing Department', ar: 'إدارة التسويق والعلاقات العامة', count: 2 },
  { key: 'Complimentary Department', en: 'Complimentary Department', ar: 'إدارة الضيافة والاستقبال', count: 1 },
]

export const VENTURE_WORK_LOCATIONS: VentureLocationMeta[] = [
  { key: 'ALL', en: 'All Work Locations', ar: 'جميع مواقع العمل', count: 166 },
  { key: 'Sharq - Head Office', en: 'Sharq - Head Office', ar: 'الشرق - المقر الرئيسي', count: 15 },
  { key: 'Aswaq Al Qurain - Central Kitchen', en: 'Aswaq Al Qurain - Central Kitchen', ar: 'أسواق القرين - المطبخ المركزي', count: 31 },
  { key: 'Salmiya', en: 'Salmiya Branch', ar: 'فرع السالمية', count: 20 },
  { key: '360 Mall', en: '360 Mall Branch', ar: 'فرع 360 مول', count: 15 },
  { key: 'Avenues Mall', en: 'Avenues Mall Branch', ar: 'فرع مجمع الأفنيوز', count: 16 },
  { key: 'Assima Mall', en: 'Assima Mall Branch', ar: 'فرع العاصمة مول', count: 20 },
  { key: 'Al Kout Mall', en: 'Al Kout Mall Branch', ar: 'فرع الكوت مول', count: 16 },
  { key: 'Promenade Mall', en: 'Promenade Mall Branch', ar: 'فرع البروميناد مول', count: 14 },
  { key: 'Ardiya', en: 'Ardiya Branch', ar: 'فرع العارضية الحرفية', count: 19 },
]

export const VENTURE_EMPLOYEES: VentureEmployee[] = [
  {
    "id": "emp-01",
    "code": "01",
    "nameAr": "أحمد عصام محمد الإبراهيم",
    "nameEn": "Ahmed Essam Al-Ebrahim",
    "jobTitleAr": "الرئيس التنفيذي والشريك المؤسس",
    "jobTitleEn": "Chief Executive Officer & Co-Founder",
    "department": "Outside Partners / Executive",
    "departmentAr": "الإدارة التنفيذية والشركاء",
    "workLocation": "Sharq - Head Office",
    "workLocationAr": "الشرق - المقر الرئيسي",
    "phone": "99881100",
    "mobile": "99881100",
    "email": "ahmed@venturefoodskw.com",
    "civilId": "288091500331",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10000000",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الكويت",
    "nationalityEn": "Kuwait",
    "flag": "🇰🇼",
    "basicSalary": 3500,
    "allowances": 500,
    "deductions": 0,
    "netSalary": 4000,
    "pamSalary": 3500,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11101 - مدير عام وشريك",
    "pamId": "288091500331",
    "bankName": "National Bank of Kuwait (NBK)",
    "bankNameAr": "بنك الكويت الوطني",
    "bankAccount": "060700200000001",
    "iban": "KW81NBOK000000000010998822001",
    "status": "ON_VACATION",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "مجلس الإدارة والشركاء",
    "managerNameEn": "Board of Directors & Partners",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-01-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-01-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_01.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-01-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_01.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-01-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_01.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-01-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_01.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-01-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_01.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-01-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_01.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-02",
    "code": "02",
    "nameAr": "أحمد عبد العزيز العبد المحسن",
    "nameEn": "Ahmed Al-Abdulmohsen",
    "jobTitleAr": "المدير التنفيذي للتسويق والشريك المؤسس",
    "jobTitleEn": "Chief Marketing Officer & Partner",
    "department": "Outside Partners / Executive",
    "departmentAr": "الإدارة التنفيذية والشركاء",
    "workLocation": "Sharq - Head Office",
    "workLocationAr": "الشرق - المقر الرئيسي",
    "phone": "99772211",
    "mobile": "99772211",
    "email": "cmo@venturefoodskw.com",
    "civilId": "289112000552",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10000123",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الكويت",
    "nationalityEn": "Kuwait",
    "flag": "🇰🇼",
    "basicSalary": 3000,
    "allowances": 500,
    "deductions": 0,
    "netSalary": 3500,
    "pamSalary": 3000,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11102 - مدير تسويق وشريك",
    "pamId": "289112000552",
    "bankName": "Gulf Bank",
    "bankNameAr": "بنك الخليج",
    "bankAccount": "060700200001001",
    "iban": "KW55GULF000000000020119933001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-02-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-02-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_02.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-02-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_02.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-02-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_02.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-02-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_02.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-02-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_02.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-02-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_02.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1002",
    "code": "1002",
    "nameAr": "عز العرب محمد أحمد السيد",
    "nameEn": "Ezzelarab Mohamed Ahmed",
    "jobTitleAr": "مشرف ضيافة واستقبال كبار الضيوف",
    "jobTitleEn": "Complimentary & Guest Experience Supervisor",
    "department": "Complimentary Department",
    "departmentAr": "إدارة الضيافة والاستقبال",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "98877112",
    "mobile": "98877112",
    "email": "vip@venturefoodskw.com",
    "civilId": "282051000443",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10000246",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "مصر",
    "nationalityEn": "Egypt",
    "flag": "🇪🇬",
    "basicSalary": 450,
    "allowances": 50,
    "deductions": 0,
    "netSalary": 500,
    "pamSalary": 450,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11501 - مشرف ضيافة",
    "pamId": "282051000443",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200002001",
    "iban": "KW60ABKK000000000005001122001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "زكريا إسكندر (مدير العمليات)",
    "managerNameEn": "Zakaria Iskandar (OPS Director)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1002-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1002-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1002.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1002-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1002.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1002-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1002.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1002-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1002.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1002-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1002.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1002-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1002.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1069",
    "code": "1069",
    "nameAr": "قربان علي",
    "nameEn": "Korban Ali",
    "jobTitleAr": "سائق مركبة خفيفة وتوصيل",
    "jobTitleEn": "Light Vehicle Driver",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "9214556",
    "mobile": "9214556",
    "email": "1069@venturefoodskw.com",
    "civilId": "2961017900103",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10000369",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 160,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 190,
    "pamSalary": 160,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - سائق مركبة خفيفة وتوصيل",
    "pamId": "2961017900103",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200003001",
    "iban": "KW27ABKK0000000000060700200003001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1069-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1069-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1069.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1069-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1069.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1069-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1069.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1069-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1069.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1069-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1069.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1069-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1069.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1091",
    "code": "1091",
    "nameAr": "شرف الدين كوتايل",
    "nameEn": "Sharafudheen Kottayil",
    "jobTitleAr": "خدمات إدارية وضيافة مكتبية",
    "jobTitleEn": "Office Services Assistant",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Al Kout Mall",
    "workLocationAr": "فرع الكوت مول",
    "phone": "9223368",
    "mobile": "9223368",
    "email": "1091@venturefoodskw.com",
    "civilId": "2978011200104",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10000492",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 140,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 170,
    "pamSalary": 140,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - خدمات إدارية وضيافة مكتبية",
    "pamId": "2978011200104",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200004001",
    "iban": "KW27ABKK0000000000060700200004001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1091-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1091-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1091.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1091-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1091.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1091-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1091.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1091-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1091.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1091-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1091.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1091-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1091.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1254",
    "code": "1254",
    "nameAr": "أنوما موناويرا كانكاناملاجي",
    "nameEn": "Anoma Munaweera Kankanamlage",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9232180",
    "mobile": "9232180",
    "email": "1254@venturefoodskw.com",
    "civilId": "2995013500105",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10000615",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 110,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 140,
    "pamSalary": 110,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2995013500105",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200005001",
    "iban": "KW27ABKK0000000000060700200005001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1254-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1254-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1254.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1254-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1254.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1254-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1254.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1254-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1254.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1254-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1254.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1254-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1254.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1266",
    "code": "1266",
    "nameAr": "أناند راو جوجي راو",
    "nameEn": "Anand Rao Jogi Rao",
    "jobTitleAr": "شيف دي بارتي مساعد (DCDP Chef)",
    "jobTitleEn": "Demi Chef de Partie",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "+965 97386402 · Anandr@venturefoodskw.com",
    "mobile": "+965 97386402 · Anandr@venturefoodskw.com",
    "email": "1266@venturefoodskw.com",
    "civilId": "2922015800106",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10000738",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 235,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 265,
    "pamSalary": 235,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - شيف دي بارتي مساعد (DCDP Chef)",
    "pamId": "2922015800106",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200006001",
    "iban": "KW27ABKK0000000000060700200006001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1266-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1266-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1266.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1266-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1266.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1266-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1266.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1266-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1266.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1266-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1266.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1266-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1266.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1274",
    "code": "1274",
    "nameAr": "لوليتا باتوبو",
    "nameEn": "Luletta Patubo",
    "jobTitleAr": "مشرف مطعم",
    "jobTitleEn": "Restaurant Supervisor",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "698ade90095bbb093654318e@enable.tech",
    "mobile": "698ade90095bbb093654318e@enable.tech",
    "email": "1274@venturefoodskw.com",
    "civilId": "2939018100107",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10000861",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 235,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 265,
    "pamSalary": 235,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مشرف مطعم",
    "pamId": "2939018100107",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200007001",
    "iban": "KW27ABKK0000000000060700200007001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1274-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1274-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1274.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1274-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1274.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1274-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1274.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1274-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1274.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1274-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1274.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1274-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1274.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1276",
    "code": "1276",
    "nameAr": "بابو تشاند رانا لاخي موني رانا",
    "nameEn": "Babu Chand Rana Lakhi Muni Rana",
    "jobTitleAr": "طاهي مسؤول وردية",
    "jobTitleEn": "Cook In-Charge",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "360 Mall",
    "workLocationAr": "فرع 360 مول",
    "phone": "9258616",
    "mobile": "9258616",
    "email": "1276@venturefoodskw.com",
    "civilId": "2956011400108",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10000984",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "نيبال",
    "nationalityEn": "Nepal",
    "flag": "🇳🇵",
    "basicSalary": 220,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 250,
    "pamSalary": 220,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي مسؤول وردية",
    "pamId": "2956011400108",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200008001",
    "iban": "KW27ABKK0000000000060700200008001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1276-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1276-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1276.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1276-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1276.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1276-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1276.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1276-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1276.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1276-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1276.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1276-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1276.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1279",
    "code": "1279",
    "nameAr": "بريم سينغ دامي",
    "nameEn": "Prem Singh Dhami",
    "jobTitleAr": "طاهي - درجة أولى (Commi I)",
    "jobTitleEn": "Cook - Commi I",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Avenues Mall",
    "workLocationAr": "فرع مجمع الأفنيوز",
    "phone": "9267428",
    "mobile": "9267428",
    "email": "1279@venturefoodskw.com",
    "civilId": "2973013700109",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10001107",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "نيبال",
    "nationalityEn": "Nepal",
    "flag": "🇳🇵",
    "basicSalary": 145,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 175,
    "pamSalary": 145,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة أولى (Commi I)",
    "pamId": "2973013700109",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200009001",
    "iban": "KW27ABKK0000000000060700200009001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1279-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1279-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1279.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1279-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1279.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1279-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1279.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1279-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1279.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1279-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1279.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1279-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1279.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1306",
    "code": "1306",
    "nameAr": "سونفي ساهاني",
    "nameEn": "Sonfi Sahani",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9276240",
    "mobile": "9276240",
    "email": "1306@venturefoodskw.com",
    "civilId": "2990016000110",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10001230",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 130,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 160,
    "pamSalary": 130,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2990016000110",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200010001",
    "iban": "KW27ABKK0000000000060700200010001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1306-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1306-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1306.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1306-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1306.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1306-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1306.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1306-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1306.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1306-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1306.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1306-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1306.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1307",
    "code": "1307",
    "nameAr": "دورغا بهادور ثامي",
    "nameEn": "Durga Bahadur Thami",
    "jobTitleAr": "أمين مستودع مركزي",
    "jobTitleEn": "Central Warehouse Keeper",
    "department": "Supply Chain Department",
    "departmentAr": "إدارة سلاسل الإمداد والمستودعات",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9285052",
    "mobile": "9285052",
    "email": "1307@venturefoodskw.com",
    "civilId": "2917018300111",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10001353",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 130,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 160,
    "pamSalary": 130,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - أمين مستودع مركزي",
    "pamId": "2917018300111",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200011001",
    "iban": "KW27ABKK0000000000060700200011001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1307-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1307-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1307.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1307-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1307.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1307-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1307.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1307-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1307.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1307-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1307.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1307-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1307.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1311",
    "code": "1311",
    "nameAr": "رام سوجيت ساهاني",
    "nameEn": "Ram Sujit Sahani",
    "jobTitleAr": "طاهي - درجة أولى (Commi I)",
    "jobTitleEn": "Cook - Commi I",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9293864",
    "mobile": "9293864",
    "email": "1311@venturefoodskw.com",
    "civilId": "2934011600112",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10001476",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 135,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 165,
    "pamSalary": 135,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة أولى (Commi I)",
    "pamId": "2934011600112",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200012001",
    "iban": "KW27ABKK0000000000060700200012001",
    "status": "ON_VACATION",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1311-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1311-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1311.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1311-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1311.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1311-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1311.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1311-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1311.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1311-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1311.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1311-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1311.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1442",
    "code": "1442",
    "nameAr": "شالجيث كاليري دامودهَران",
    "nameEn": "Shaljith Kalleeri Damodharan",
    "jobTitleAr": "مسؤول تقنية المعلومات والأنظمة",
    "jobTitleEn": "IT Administrator",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "+965 97386429 · it@venturefoodskw.com · EXT 202",
    "mobile": "+965 97386429 · it@venturefoodskw.com · EXT 202",
    "email": "1442@venturefoodskw.com",
    "civilId": "2951013900113",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10001599",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 410,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 440,
    "pamSalary": 410,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مسؤول تقنية المعلومات والأنظمة",
    "pamId": "2951013900113",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200013001",
    "iban": "KW27ABKK0000000000060700200013001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1442-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1442-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1442.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1442-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1442.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1442-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1442.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1442-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1442.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1442-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1442.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1442-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1442.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1464",
    "code": "1464",
    "nameAr": "عصمت أحمد عبد الرازق موسى",
    "nameEn": "Essmat Ahmed Abdelrazek Mousa",
    "jobTitleAr": "مشرف مطعم",
    "jobTitleEn": "Restaurant Supervisor",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "alqurain@venturefoodskw.com",
    "mobile": "alqurain@venturefoodskw.com",
    "email": "1464@venturefoodskw.com",
    "civilId": "2968016200114",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10001722",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "مصر",
    "nationalityEn": "Egypt",
    "flag": "🇪🇬",
    "basicSalary": 270,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 300,
    "pamSalary": 270,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مشرف مطعم",
    "pamId": "2968016200114",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200014001",
    "iban": "KW27ABKK0000000000060700200014001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1464-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1464-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1464.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1464-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1464.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1464-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1464.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1464-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1464.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1464-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1464.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1464-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1464.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1491",
    "code": "1491",
    "nameAr": "Mohammad فيروز عالم",
    "nameEn": "Mohammad Firoz Alam",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9320300",
    "mobile": "9320300",
    "email": "1491@venturefoodskw.com",
    "civilId": "2985018500115",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10001845",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 125,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 155,
    "pamSalary": 125,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2985018500115",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200015001",
    "iban": "KW27ABKK0000000000060700200015001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1491-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1491-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1491.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1491-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1491.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1491-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1491.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1491-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1491.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1491-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1491.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1491-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1491.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1528",
    "code": "1528",
    "nameAr": "راجيش إنجيتي",
    "nameEn": "Rajesh Injeti",
    "jobTitleAr": "طاهي مسؤول وردية",
    "jobTitleEn": "Cook In-Charge",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Avenues Mall",
    "workLocationAr": "فرع مجمع الأفنيوز",
    "phone": "9329112",
    "mobile": "9329112",
    "email": "1528@venturefoodskw.com",
    "civilId": "2912011800116",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10001968",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 145,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 175,
    "pamSalary": 145,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي مسؤول وردية",
    "pamId": "2912011800116",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200016001",
    "iban": "KW27ABKK0000000000060700200016001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1528-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1528-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1528.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1528-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1528.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1528-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1528.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1528-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1528.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1528-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1528.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1528-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1528.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1557",
    "code": "1557",
    "nameAr": "سعيدول شيخ",
    "nameEn": "Saidul Shaikh",
    "jobTitleAr": "طاهي - درجة أولى (Commi I)",
    "jobTitleEn": "Cook - Commi I",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "9337924",
    "mobile": "9337924",
    "email": "1557@venturefoodskw.com",
    "civilId": "2929014100117",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10002091",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 195,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 225,
    "pamSalary": 195,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة أولى (Commi I)",
    "pamId": "2929014100117",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200017001",
    "iban": "KW27ABKK0000000000060700200017001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1557-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1557-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1557.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1557-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1557.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1557-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1557.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1557-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1557.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1557-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1557.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1557-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1557.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1559",
    "code": "1559",
    "nameAr": "ماريا ماريا جينيفير كيلافيلا تراكينا",
    "nameEn": "Girl Maria Jenepher Kilapkilap Traquena",
    "jobTitleAr": "وكيل أول مركز اتصال وتوصيل",
    "jobTitleEn": "Senior Call Center Agent",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Al Kout Mall",
    "workLocationAr": "فرع الكوت مول",
    "phone": "callcenter1@venturefoodskw.com",
    "mobile": "callcenter1@venturefoodskw.com",
    "email": "1559@venturefoodskw.com",
    "civilId": "2946016400118",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10002214",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الفلبين",
    "nationalityEn": "Philippines",
    "flag": "🇵🇭",
    "basicSalary": 155,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 185,
    "pamSalary": 155,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - وكيل أول مركز اتصال وتوصيل",
    "pamId": "2946016400118",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200018001",
    "iban": "KW27ABKK0000000000060700200018001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1559-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1559-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1559.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1559-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1559.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1559-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1559.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1559-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1559.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1559-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1559.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1559-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1559.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1563",
    "code": "1563",
    "nameAr": "فيجاي كومار سيمروديا",
    "nameEn": "Vijay Kumar Simrodhia",
    "jobTitleAr": "طاهي مسؤول وردية",
    "jobTitleEn": "Cook In-Charge",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Promenade Mall",
    "workLocationAr": "فرع البروميناد مول",
    "phone": "9355548",
    "mobile": "9355548",
    "email": "1563@venturefoodskw.com",
    "civilId": "2963018700119",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10002337",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 160,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 190,
    "pamSalary": 160,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي مسؤول وردية",
    "pamId": "2963018700119",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200019001",
    "iban": "KW27ABKK0000000000060700200019001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1563-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1563-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1563.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1563-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1563.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1563-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1563.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1563-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1563.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1563-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1563.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1563-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1563.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1619",
    "code": "1619",
    "nameAr": "سونيتا موكتان موهان",
    "nameEn": "Sunita Moktan Mohan",
    "jobTitleAr": "قائد طاقم خدمة (Crew Chief)",
    "jobTitleEn": "Crew Chief",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "9364360",
    "mobile": "9364360",
    "email": "1619@venturefoodskw.com",
    "civilId": "2980012000120",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10002460",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - قائد طاقم خدمة (Crew Chief)",
    "pamId": "2980012000120",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200020001",
    "iban": "KW27ABKK0000000000060700200020001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1619-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1619-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1619.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1619-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1619.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1619-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1619.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1619-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1619.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1619-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1619.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1619-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1619.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1647",
    "code": "1647",
    "nameAr": "سوميترا تامانغ راجو",
    "nameEn": "Sumitra Tamang Raju",
    "jobTitleAr": "قائد طاقم خدمة (Crew Chief)",
    "jobTitleEn": "Crew Chief",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "9373172",
    "mobile": "9373172",
    "email": "1647@venturefoodskw.com",
    "civilId": "2997014300121",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10002583",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "نيبال",
    "nationalityEn": "Nepal",
    "flag": "🇳🇵",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - قائد طاقم خدمة (Crew Chief)",
    "pamId": "2997014300121",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200021001",
    "iban": "KW27ABKK0000000000060700200021001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1647-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1647-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1647.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1647-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1647.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1647-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1647.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1647-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1647.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1647-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1647.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1647-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1647.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1715",
    "code": "1715",
    "nameAr": "أمجد سمير جرجس ميخائيل",
    "nameEn": "Amgad Samir Girgis Mikhaeel",
    "jobTitleAr": "مسؤول العلاقات الحكومية (مندوب الشؤون والجوازات)",
    "jobTitleEn": "Government Relations Officer / GRO",
    "department": "HR & Admin Department",
    "departmentAr": "الموارد البشرية والشؤون الإدارية",
    "workLocation": "Sharq - Head Office",
    "workLocationAr": "الشرق - المقر الرئيسي",
    "phone": "65768824",
    "mobile": "65768824",
    "email": "gov@venturefoodskw.com",
    "civilId": "286121900332",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10002706",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "مصر",
    "nationalityEn": "Egypt",
    "flag": "🇪🇬",
    "basicSalary": 450,
    "allowances": 100,
    "deductions": 0,
    "netSalary": 550,
    "pamSalary": 450,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11602 - مندوب علاقات عامة",
    "pamId": "286121900332",
    "bankName": "Gulf Bank",
    "bankNameAr": "بنك الخليج",
    "bankAccount": "060700200022001",
    "iban": "KW11GULF000000000030224411001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "شيام (إدارة الموارد البشرية والشؤون الإدارية)",
    "managerNameEn": "Shyam (HR & Admin)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1715-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1715-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1715.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1715-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1715.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1715-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1715.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1715-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1715.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1715-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1715.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1715-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1715.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1718",
    "code": "1718",
    "nameAr": "كاليجيثي فيجياناندا راجو",
    "nameEn": "Kaligithi Vijyananda Raju",
    "jobTitleAr": "طاهي مسؤول وردية",
    "jobTitleEn": "Cook In-Charge",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9390796",
    "mobile": "9390796",
    "email": "1718@venturefoodskw.com",
    "civilId": "2941018900123",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10002829",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 265,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 295,
    "pamSalary": 265,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي مسؤول وردية",
    "pamId": "2941018900123",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200023001",
    "iban": "KW27ABKK0000000000060700200023001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1718-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1718-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1718.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1718-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1718.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1718-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1718.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1718-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1718.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1718-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1718.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1718-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1718.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1780",
    "code": "1780",
    "nameAr": "سورفير سينغ بريم سينغ",
    "nameEn": "Surveer Singh Prem Singh",
    "jobTitleAr": "مشرف مطعم",
    "jobTitleEn": "Restaurant Supervisor",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "salmiyacg@venturefoodskw.com",
    "mobile": "salmiyacg@venturefoodskw.com",
    "email": "1780@venturefoodskw.com",
    "civilId": "2958012200124",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10002952",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 260,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 290,
    "pamSalary": 260,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مشرف مطعم",
    "pamId": "2958012200124",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200024001",
    "iban": "KW27ABKK0000000000060700200024001",
    "status": "ON_VACATION",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1780-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1780-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1780.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1780-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1780.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1780-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1780.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1780-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1780.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1780-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1780.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1780-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1780.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1806",
    "code": "1806",
    "nameAr": "سامي صبري عجايبي شنودة",
    "nameEn": "Samy Sabry Agaiby Shenouda",
    "jobTitleAr": "محاسب عام أول",
    "jobTitleEn": "Senior General Accountant",
    "department": "Finance Department",
    "departmentAr": "الإدارة المالية والمحاسبة",
    "workLocation": "Sharq - Head Office",
    "workLocationAr": "الشرق - المقر الرئيسي",
    "phone": "97766554",
    "mobile": "97766554",
    "email": "samy@venturefoodskw.com",
    "civilId": "284071800551",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10003075",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "مصر",
    "nationalityEn": "Egypt",
    "flag": "🇪🇬",
    "basicSalary": 650,
    "allowances": 100,
    "deductions": 0,
    "netSalary": 750,
    "pamSalary": 650,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11205 - محاسب عام",
    "pamId": "284071800551",
    "bankName": "National Bank of Kuwait (NBK)",
    "bankNameAr": "بنك الكويت الوطني",
    "bankAccount": "060700200025001",
    "iban": "KW77NBOK000000000010991188001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "هاني فيليب (CFO)",
    "managerNameEn": "Hani Philip (CFO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1806-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1806-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1806.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1806-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1806.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1806-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1806.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1806-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1806.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1806-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1806.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1806-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1806.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1813",
    "code": "1813",
    "nameAr": "نافين باسكوتا",
    "nameEn": "Nabin Baskota",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Promenade Mall",
    "workLocationAr": "فرع البروميناد مول",
    "phone": "9417232",
    "mobile": "9417232",
    "email": "1813@venturefoodskw.com",
    "civilId": "2992016800126",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10003198",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 125,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 155,
    "pamSalary": 125,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2992016800126",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200026001",
    "iban": "KW27ABKK0000000000060700200026001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1813-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1813-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1813.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1813-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1813.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1813-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1813.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1813-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1813.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1813-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1813.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1813-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1813.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1814",
    "code": "1814",
    "nameAr": "سالان ماجار",
    "nameEn": "Salan Magar",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "9426044",
    "mobile": "9426044",
    "email": "1814@venturefoodskw.com",
    "civilId": "2919019100127",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10003321",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "نيبال",
    "nationalityEn": "Nepal",
    "flag": "🇳🇵",
    "basicSalary": 135,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 165,
    "pamSalary": 135,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2919019100127",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200027001",
    "iban": "KW27ABKK0000000000060700200027001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1814-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1814-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1814.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1814-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1814.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1814-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1814.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1814-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1814.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1814-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1814.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1814-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1814.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1816",
    "code": "1816",
    "nameAr": "راكش كومار ياداف",
    "nameEn": "Rakesh Kumar Yadav",
    "jobTitleAr": "طاهي - درجة أولى (Commi I)",
    "jobTitleEn": "Cook - Commi I",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "9434856",
    "mobile": "9434856",
    "email": "1816@venturefoodskw.com",
    "civilId": "2936012400128",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10003444",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 135,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 165,
    "pamSalary": 135,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة أولى (Commi I)",
    "pamId": "2936012400128",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200028001",
    "iban": "KW27ABKK0000000000060700200028001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1816-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1816-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1816.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1816-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1816.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1816-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1816.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1816-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1816.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1816-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1816.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1816-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1816.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1821",
    "code": "1821",
    "nameAr": "لوكيش داكال",
    "nameEn": "Lokesh Dhakal",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "360 Mall",
    "workLocationAr": "فرع 360 مول",
    "phone": "9443668",
    "mobile": "9443668",
    "email": "1821@venturefoodskw.com",
    "civilId": "2953014700129",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10003567",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 130,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 160,
    "pamSalary": 130,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2953014700129",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200029001",
    "iban": "KW27ABKK0000000000060700200029001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1821-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1821-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1821.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1821-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1821.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1821-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1821.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1821-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1821.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1821-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1821.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1821-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1821.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1827",
    "code": "1827",
    "nameAr": "ديشن ديشن",
    "nameEn": "Dechen Dechen",
    "jobTitleAr": "قائد طاقم خدمة (Crew Chief)",
    "jobTitleEn": "Crew Chief",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Avenues Mall",
    "workLocationAr": "فرع مجمع الأفنيوز",
    "phone": "9452480",
    "mobile": "9452480",
    "email": "1827@venturefoodskw.com",
    "civilId": "2970017000130",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10003690",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 162,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 192,
    "pamSalary": 162,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - قائد طاقم خدمة (Crew Chief)",
    "pamId": "2970017000130",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200030001",
    "iban": "KW27ABKK0000000000060700200030001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1827-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1827-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1827.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1827-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1827.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1827-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1827.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1827-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1827.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1827-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1827.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1827-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1827.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1828",
    "code": "1828",
    "nameAr": "سوارنوجيت باين سوابان باين",
    "nameEn": "Swarnojit Pyne Swapan Pyne",
    "jobTitleAr": "مشرف مطعم",
    "jobTitleEn": "Restaurant Supervisor",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "swarnojit25@gmail.com",
    "mobile": "swarnojit25@gmail.com",
    "email": "1828@venturefoodskw.com",
    "civilId": "2987019300131",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10003813",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 155,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 185,
    "pamSalary": 155,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مشرف مطعم",
    "pamId": "2987019300131",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200031001",
    "iban": "KW27ABKK0000000000060700200031001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1828-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1828-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1828.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1828-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1828.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1828-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1828.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1828-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1828.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1828-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1828.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1828-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1828.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1829",
    "code": "1829",
    "nameAr": "عرفان موندال إيناس موندال",
    "nameEn": "Irfan Mondal Innas Mondal",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9470104",
    "mobile": "9470104",
    "email": "1829@venturefoodskw.com",
    "civilId": "2914012600132",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10003936",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 125,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 155,
    "pamSalary": 125,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2914012600132",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200032001",
    "iban": "KW27ABKK0000000000060700200032001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1829-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1829-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1829.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1829-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1829.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1829-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1829.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1829-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1829.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1829-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1829.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1829-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1829.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1831",
    "code": "1831",
    "nameAr": "SK نياز علي رحمن علي",
    "nameEn": "SK Niaz Ali Rahman Ali",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Promenade Mall",
    "workLocationAr": "فرع البروميناد مول",
    "phone": "9478916",
    "mobile": "9478916",
    "email": "1831@venturefoodskw.com",
    "civilId": "2931014900133",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10004059",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 130,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 160,
    "pamSalary": 130,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2931014900133",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200033001",
    "iban": "KW27ABKK0000000000060700200033001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1831-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1831-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1831.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1831-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1831.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1831-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1831.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1831-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1831.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1831-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1831.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1831-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1831.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1832",
    "code": "1832",
    "nameAr": "نادر نزهي مرقص غالي",
    "nameEn": "Nader Nozhy Morkos",
    "jobTitleAr": "مشرف المشتريات والتوريد المركزي",
    "jobTitleEn": "Central Purchasing Supervisor",
    "department": "Supply Chain Department",
    "departmentAr": "إدارة سلاسل الإمداد والمستودعات",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "96655443",
    "mobile": "96655443",
    "email": "purchasing@venturefoodskw.com",
    "civilId": "287041200331",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10004182",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "مصر",
    "nationalityEn": "Egypt",
    "flag": "🇪🇬",
    "basicSalary": 750,
    "allowances": 150,
    "deductions": 0,
    "netSalary": 900,
    "pamSalary": 750,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11401 - مشرف مشتريات",
    "pamId": "287041200331",
    "bankName": "Commercial Bank of Kuwait (CBK)",
    "bankNameAr": "البنك التجاري الكويتي",
    "bankAccount": "060700200034001",
    "iban": "KW19CBKK000000000008112233001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "هاني فيليب (CFO)",
    "managerNameEn": "Hani Philip (CFO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1832-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1832-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1832.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1832-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1832.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1832-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1832.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1832-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1832.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1832-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1832.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1832-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1832.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1839",
    "code": "1839",
    "nameAr": "تيك بهادور",
    "nameEn": "Tek Bahadur",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "9496540",
    "mobile": "9496540",
    "email": "1839@venturefoodskw.com",
    "civilId": "2965019500135",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10004305",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 125,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 155,
    "pamSalary": 125,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2965019500135",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200035001",
    "iban": "KW27ABKK0000000000060700200035001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1839-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1839-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1839.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1839-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1839.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1839-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1839.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1839-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1839.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1839-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1839.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1839-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1839.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1848",
    "code": "1848",
    "nameAr": "ماهندرا راجابانشي",
    "nameEn": "Mahendra Rajabanshi",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "360 Mall",
    "workLocationAr": "فرع 360 مول",
    "phone": "9505352",
    "mobile": "9505352",
    "email": "1848@venturefoodskw.com",
    "civilId": "2982012800136",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10004428",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 130,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 160,
    "pamSalary": 130,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2982012800136",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200036001",
    "iban": "KW27ABKK0000000000060700200036001",
    "status": "ON_VACATION",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1848-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1848-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1848.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1848-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1848.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1848-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1848.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1848-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1848.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1848-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1848.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1848-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1848.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1851",
    "code": "1851",
    "nameAr": "سوفيت كومار ياداف",
    "nameEn": "Sovit Kumar Yadav",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Avenues Mall",
    "workLocationAr": "فرع مجمع الأفنيوز",
    "phone": "9514164",
    "mobile": "9514164",
    "email": "1851@venturefoodskw.com",
    "civilId": "2999015100137",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10004551",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2999015100137",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200037001",
    "iban": "KW27ABKK0000000000060700200037001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1851-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1851-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1851.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1851-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1851.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1851-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1851.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1851-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1851.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1851-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1851.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1851-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1851.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1877",
    "code": "1877",
    "nameAr": "بايجو Kunnummal Veedu",
    "nameEn": "Baiju Kunnummal Veedu",
    "jobTitleAr": "مشرف مطعم",
    "jobTitleEn": "Restaurant Supervisor",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "jahra@venturefoodskw.com",
    "mobile": "jahra@venturefoodskw.com",
    "email": "1877@venturefoodskw.com",
    "civilId": "2926017400138",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10004674",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 240,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 270,
    "pamSalary": 240,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مشرف مطعم",
    "pamId": "2926017400138",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200038001",
    "iban": "KW27ABKK0000000000060700200038001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1877-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1877-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1877.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1877-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1877.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1877-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1877.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1877-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1877.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1877-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1877.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1877-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1877.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1880",
    "code": "1880",
    "nameAr": "Sheila Ambos Bulibuli",
    "nameEn": "Sheila Ambos Bulibuli",
    "jobTitleAr": "عضو فريق تشغيل مطاعم",
    "jobTitleEn": "Restaurant Operations Team Member",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Al Kout Mall",
    "workLocationAr": "فرع الكوت مول",
    "phone": "+965 94079377 · shielab@venturefoodskw.com",
    "mobile": "+965 94079377 · shielab@venturefoodskw.com",
    "email": "1880@venturefoodskw.com",
    "civilId": "2943019700139",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10004797",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 525,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 555,
    "pamSalary": 525,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل مطاعم",
    "pamId": "2943019700139",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200039001",
    "iban": "KW27ABKK0000000000060700200039001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1880-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1880-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1880.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1880-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1880.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1880-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1880.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1880-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1880.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1880-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1880.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1880-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1880.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1881",
    "code": "1881",
    "nameAr": "Yeshi Chezom",
    "nameEn": "Yeshi Chezom",
    "jobTitleAr": "قائد طاقم خدمة (Crew Chief)",
    "jobTitleEn": "Crew Chief",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Promenade Mall",
    "workLocationAr": "فرع البروميناد مول",
    "phone": "tsjahra@venturefoodskw.com",
    "mobile": "tsjahra@venturefoodskw.com",
    "email": "1881@venturefoodskw.com",
    "civilId": "2960013000140",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10004920",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 135,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 165,
    "pamSalary": 135,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - قائد طاقم خدمة (Crew Chief)",
    "pamId": "2960013000140",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200040001",
    "iban": "KW27ABKK0000000000060700200040001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1881-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1881-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1881.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1881-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1881.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1881-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1881.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1881-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1881.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1881-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1881.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1881-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1881.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1882",
    "code": "1882",
    "nameAr": "Hema Devi Chuwan",
    "nameEn": "Hema Devi Chuwan",
    "jobTitleAr": "قائد طاقم خدمة (Crew Chief)",
    "jobTitleEn": "Crew Chief",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "9549412",
    "mobile": "9549412",
    "email": "1882@venturefoodskw.com",
    "civilId": "2977015300141",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10005043",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 135,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 165,
    "pamSalary": 135,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - قائد طاقم خدمة (Crew Chief)",
    "pamId": "2977015300141",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200041001",
    "iban": "KW27ABKK0000000000060700200041001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1882-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1882-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1882.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1882-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1882.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1882-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1882.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1882-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1882.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1882-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1882.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1882-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1882.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1883",
    "code": "1883",
    "nameAr": "Chungku Chungku",
    "nameEn": "Chungku Chungku",
    "jobTitleAr": "قائد طاقم خدمة (Crew Chief)",
    "jobTitleEn": "Crew Chief",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "9558224",
    "mobile": "9558224",
    "email": "1883@venturefoodskw.com",
    "civilId": "2994017600142",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10005166",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 135,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 165,
    "pamSalary": 135,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - قائد طاقم خدمة (Crew Chief)",
    "pamId": "2994017600142",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200042001",
    "iban": "KW27ABKK0000000000060700200042001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1883-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1883-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1883.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1883-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1883.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1883-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1883.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1883-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1883.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1883-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1883.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1883-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1883.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1900",
    "code": "1900",
    "nameAr": "Inn Raj Rai",
    "nameEn": "Inn Raj Rai",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "360 Mall",
    "workLocationAr": "فرع 360 مول",
    "phone": "9567036",
    "mobile": "9567036",
    "email": "1900@venturefoodskw.com",
    "civilId": "2921019900143",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10005289",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 135,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 165,
    "pamSalary": 135,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2921019900143",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200043001",
    "iban": "KW27ABKK0000000000060700200043001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1900-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1900-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1900.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1900-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1900.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1900-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1900.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1900-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1900.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1900-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1900.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1900-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1900.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1901",
    "code": "1901",
    "nameAr": "Lhamo Lhamo",
    "nameEn": "Lhamo Lhamo",
    "jobTitleAr": "قائد طاقم خدمة (Crew Chief)",
    "jobTitleEn": "Crew Chief",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Avenues Mall",
    "workLocationAr": "فرع مجمع الأفنيوز",
    "phone": "9575848",
    "mobile": "9575848",
    "email": "1901@venturefoodskw.com",
    "civilId": "2938013200144",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10005412",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 135,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 165,
    "pamSalary": 135,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - قائد طاقم خدمة (Crew Chief)",
    "pamId": "2938013200144",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200044001",
    "iban": "KW27ABKK0000000000060700200044001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1901-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1901-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1901.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1901-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1901.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1901-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1901.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1901-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1901.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1901-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1901.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1901-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1901.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1903",
    "code": "1903",
    "nameAr": "Sagar Monger",
    "nameEn": "Sagar Monger",
    "jobTitleAr": "قائد طاقم خدمة (Crew Chief)",
    "jobTitleEn": "Crew Chief",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "9584660",
    "mobile": "9584660",
    "email": "1903@venturefoodskw.com",
    "civilId": "2955015500145",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10005535",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 135,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 165,
    "pamSalary": 135,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - قائد طاقم خدمة (Crew Chief)",
    "pamId": "2955015500145",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200045001",
    "iban": "KW27ABKK0000000000060700200045001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1903-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1903-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1903.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1903-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1903.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1903-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1903.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1903-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1903.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1903-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1903.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1903-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1903.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1909",
    "code": "1909",
    "nameAr": "Ramil Gorospe Lambino",
    "nameEn": "Ramil Gorospe Lambino",
    "jobTitleAr": "مشرف مطعم",
    "jobTitleEn": "Restaurant Supervisor",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Al Kout Mall",
    "workLocationAr": "فرع الكوت مول",
    "phone": "assimamallcg@venturefoodskw.com",
    "mobile": "assimamallcg@venturefoodskw.com",
    "email": "1909@venturefoodskw.com",
    "civilId": "2972017800146",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10005658",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 420,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 450,
    "pamSalary": 420,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مشرف مطعم",
    "pamId": "2972017800146",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200046001",
    "iban": "KW27ABKK0000000000060700200046001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1909-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1909-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1909.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1909-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1909.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1909-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1909.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1909-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1909.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1909-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1909.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1909-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1909.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1912",
    "code": "1912",
    "nameAr": "Mina Roumany Habib Lawndy",
    "nameEn": "Mina Roumany Habib Lawndy",
    "jobTitleAr": "طاهي مسؤول وردية",
    "jobTitleEn": "Cook In-Charge",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Promenade Mall",
    "workLocationAr": "فرع البروميناد مول",
    "phone": "9602284",
    "mobile": "9602284",
    "email": "1912@venturefoodskw.com",
    "civilId": "2989011100147",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10005781",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 300,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 330,
    "pamSalary": 300,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي مسؤول وردية",
    "pamId": "2989011100147",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200047001",
    "iban": "KW27ABKK0000000000060700200047001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1912-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1912-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1912.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1912-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1912.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1912-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1912.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1912-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1912.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1912-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1912.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1912-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1912.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1923",
    "code": "1923",
    "nameAr": "Tanka بهادور Bhusal",
    "nameEn": "Tanka Bahadur Bhusal",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "shielab@venturefoodskw.com",
    "mobile": "shielab@venturefoodskw.com",
    "email": "1923@venturefoodskw.com",
    "civilId": "2916013400148",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10005904",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 115,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 145,
    "pamSalary": 115,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2916013400148",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200048001",
    "iban": "KW27ABKK0000000000060700200048001",
    "status": "ON_VACATION",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1923-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1923-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1923.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1923-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1923.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1923-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1923.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1923-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1923.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1923-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1923.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1923-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1923.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1924",
    "code": "1924",
    "nameAr": "Indra كومار ماجار",
    "nameEn": "Indra kumar Magar",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "9619908",
    "mobile": "9619908",
    "email": "1924@venturefoodskw.com",
    "civilId": "2933015700149",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10006027",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "نيبال",
    "nationalityEn": "Nepal",
    "flag": "🇳🇵",
    "basicSalary": 115,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 145,
    "pamSalary": 115,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2933015700149",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200049001",
    "iban": "KW27ABKK0000000000060700200049001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1924-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1924-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1924.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1924-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1924.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1924-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1924.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1924-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1924.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1924-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1924.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1924-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1924.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1925",
    "code": "1925",
    "nameAr": "Hemraj Bishwakarma",
    "nameEn": "Hemraj Bishwakarma",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "360 Mall",
    "workLocationAr": "فرع 360 مول",
    "phone": "9628720",
    "mobile": "9628720",
    "email": "1925@venturefoodskw.com",
    "civilId": "2950018000150",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10006150",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 115,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 145,
    "pamSalary": 115,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2950018000150",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200050001",
    "iban": "KW27ABKK0000000000060700200050001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1925-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1925-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1925.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1925-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1925.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1925-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1925.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1925-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1925.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1925-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1925.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1925-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1925.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1926",
    "code": "1926",
    "nameAr": "Man كومار تامانغ",
    "nameEn": "Man Kumar Tamang",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Avenues Mall",
    "workLocationAr": "فرع مجمع الأفنيوز",
    "phone": "9637532",
    "mobile": "9637532",
    "email": "1926@venturefoodskw.com",
    "civilId": "2967011300151",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10006273",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "نيبال",
    "nationalityEn": "Nepal",
    "flag": "🇳🇵",
    "basicSalary": 115,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 145,
    "pamSalary": 115,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2967011300151",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200051001",
    "iban": "KW27ABKK0000000000060700200051001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1926-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1926-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1926.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1926-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1926.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1926-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1926.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1926-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1926.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1926-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1926.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1926-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1926.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1929",
    "code": "1929",
    "nameAr": "Sujan تامانغ",
    "nameEn": "Sujan Tamang",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "9646344",
    "mobile": "9646344",
    "email": "1929@venturefoodskw.com",
    "civilId": "2984013600152",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10006396",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "نيبال",
    "nationalityEn": "Nepal",
    "flag": "🇳🇵",
    "basicSalary": 115,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 145,
    "pamSalary": 115,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2984013600152",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200052001",
    "iban": "KW27ABKK0000000000060700200052001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1929-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1929-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1929.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1929-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1929.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1929-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1929.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1929-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1929.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1929-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1929.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1929-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1929.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1932",
    "code": "1932",
    "nameAr": "Choukrallah Nassif",
    "nameEn": "Choukrallah Nassif",
    "jobTitleAr": "عضو فريق تشغيل مطاعم",
    "jobTitleEn": "Restaurant Operations Team Member",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Al Kout Mall",
    "workLocationAr": "فرع الكوت مول",
    "phone": "+965 90061400 · operations@venturefoodskw.com · EXT 120",
    "mobile": "+965 90061400 · operations@venturefoodskw.com · EXT 120",
    "email": "1932@venturefoodskw.com",
    "civilId": "2911015900153",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10006519",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 1600,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 1630,
    "pamSalary": 1600,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل مطاعم",
    "pamId": "2911015900153",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200053001",
    "iban": "KW27ABKK0000000000060700200053001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1932-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1932-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1932.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1932-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1932.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1932-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1932.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1932-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1932.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1932-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1932.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1932-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1932.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1934",
    "code": "1934",
    "nameAr": "Nima Sherpa",
    "nameEn": "Nima Sherpa",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Promenade Mall",
    "workLocationAr": "فرع البروميناد مول",
    "phone": "9663968",
    "mobile": "9663968",
    "email": "1934@venturefoodskw.com",
    "civilId": "2928018200154",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10006642",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 115,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 145,
    "pamSalary": 115,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2928018200154",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200054001",
    "iban": "KW27ABKK0000000000060700200054001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1934-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1934-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1934.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1934-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1934.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1934-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1934.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1934-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1934.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1934-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1934.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1934-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1934.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1936",
    "code": "1936",
    "nameAr": "Donner Naingue Morado",
    "nameEn": "Donner Naingue Morado",
    "jobTitleAr": "عضو فريق تشغيل مطاعم",
    "jobTitleEn": "Restaurant Operations Team Member",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "9672780",
    "mobile": "9672780",
    "email": "1936@venturefoodskw.com",
    "civilId": "2945011500155",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10006765",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 260,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 290,
    "pamSalary": 260,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل مطاعم",
    "pamId": "2945011500155",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200055001",
    "iban": "KW27ABKK0000000000060700200055001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1936-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1936-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1936.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1936-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1936.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1936-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1936.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1936-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1936.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1936-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1936.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1936-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1936.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1938",
    "code": "1938",
    "nameAr": "Ryann Ross Buelva Barrameda",
    "nameEn": "Ryann Ross Buelva Barrameda",
    "jobTitleAr": "مشرف مطعم",
    "jobTitleEn": "Restaurant Supervisor",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "alkoutmallcg@venturefoodskw.com",
    "mobile": "alkoutmallcg@venturefoodskw.com",
    "email": "1938@venturefoodskw.com",
    "civilId": "2962013800156",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10006888",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 315,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 345,
    "pamSalary": 315,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مشرف مطعم",
    "pamId": "2962013800156",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200056001",
    "iban": "KW27ABKK0000000000060700200056001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1938-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1938-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1938.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1938-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1938.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1938-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1938.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1938-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1938.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1938-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1938.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1938-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1938.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1944",
    "code": "1944",
    "nameAr": "سونيل كومار Ponukumatla",
    "nameEn": "Sunil Kumar Ponukumatla",
    "jobTitleAr": "عضو فريق تشغيل مطاعم",
    "jobTitleEn": "Restaurant Operations Team Member",
    "department": "Supply Chain Department",
    "departmentAr": "إدارة سلاسل الإمداد والمستودعات",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "sunilk@venturefoodskw.com · EXT 151",
    "mobile": "sunilk@venturefoodskw.com · EXT 151",
    "email": "1944@venturefoodskw.com",
    "civilId": "2979016100157",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10007011",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 200,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 230,
    "pamSalary": 200,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل مطاعم",
    "pamId": "2979016100157",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200057001",
    "iban": "KW27ABKK0000000000060700200057001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1944-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1944-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1944.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1944-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1944.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1944-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1944.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1944-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1944.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1944-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1944.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1944-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1944.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1946",
    "code": "1946",
    "nameAr": "مانيش Dhungel",
    "nameEn": "Manish Dhungel",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Avenues Mall",
    "workLocationAr": "فرع مجمع الأفنيوز",
    "phone": "9699216",
    "mobile": "9699216",
    "email": "1946@venturefoodskw.com",
    "civilId": "2996018400158",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10007134",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 115,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 145,
    "pamSalary": 115,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2996018400158",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200058001",
    "iban": "KW27ABKK0000000000060700200058001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1946-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1946-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1946.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1946-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1946.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1946-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1946.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1946-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1946.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1946-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1946.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1946-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1946.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1948",
    "code": "1948",
    "nameAr": "Juven Ray Redondo Cuizon",
    "nameEn": "Juven Ray Redondo Cuizon",
    "jobTitleAr": "وكيل أول مركز اتصال وتوصيل",
    "jobTitleEn": "Senior Call Center Agent",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "+965 94079383 · callcenter@venturefoodskw.com · EXT 200 · DIR 22243833",
    "mobile": "+965 94079383 · callcenter@venturefoodskw.com · EXT 200 · DIR 22243833",
    "email": "1948@venturefoodskw.com",
    "civilId": "2923011700159",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10007257",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 320,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 350,
    "pamSalary": 320,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - وكيل أول مركز اتصال وتوصيل",
    "pamId": "2923011700159",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200059001",
    "iban": "KW27ABKK0000000000060700200059001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1948-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1948-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1948.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1948-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1948.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1948-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1948.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1948-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1948.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1948-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1948.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1948-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1948.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1950",
    "code": "1950",
    "nameAr": "نافين Khadka",
    "nameEn": "Nabin Khadka",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Al Kout Mall",
    "workLocationAr": "فرع الكوت مول",
    "phone": "9716840",
    "mobile": "9716840",
    "email": "1950@venturefoodskw.com",
    "civilId": "2940014000160",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10007380",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 140,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 170,
    "pamSalary": 140,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2940014000160",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200060001",
    "iban": "KW27ABKK0000000000060700200060001",
    "status": "ON_VACATION",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1950-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1950-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1950.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1950-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1950.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1950-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1950.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1950-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1950.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1950-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1950.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1950-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1950.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1951",
    "code": "1951",
    "nameAr": "Pijerson دي Guzman",
    "nameEn": "Pijerson De Guzman",
    "jobTitleAr": "طاهي مسؤول وردية",
    "jobTitleEn": "Cook In-Charge",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Promenade Mall",
    "workLocationAr": "فرع البروميناد مول",
    "phone": "9725652",
    "mobile": "9725652",
    "email": "1951@venturefoodskw.com",
    "civilId": "2957016300161",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10007503",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 310,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 340,
    "pamSalary": 310,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي مسؤول وردية",
    "pamId": "2957016300161",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200061001",
    "iban": "KW27ABKK0000000000060700200061001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1951-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1951-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1951.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1951-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1951.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1951-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1951.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1951-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1951.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1951-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1951.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1951-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1951.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1956",
    "code": "1956",
    "nameAr": "Dil كومار Shrestha",
    "nameEn": "Dil Kumar Shrestha",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "9734464",
    "mobile": "9734464",
    "email": "1956@venturefoodskw.com",
    "civilId": "2974018600162",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10007626",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 130,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 160,
    "pamSalary": 130,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2974018600162",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200062001",
    "iban": "KW27ABKK0000000000060700200062001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1956-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1956-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1956.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1956-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1956.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1956-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1956.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1956-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1956.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1956-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1956.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1956-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1956.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1957",
    "code": "1957",
    "nameAr": "Dhan بهادور Karki",
    "nameEn": "Dhan Bahadur Karki",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "9743276",
    "mobile": "9743276",
    "email": "1957@venturefoodskw.com",
    "civilId": "2991011900163",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10007749",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 115,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 145,
    "pamSalary": 115,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2991011900163",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200063001",
    "iban": "KW27ABKK0000000000060700200063001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1957-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1957-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1957.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1957-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1957.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1957-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1957.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1957-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1957.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1957-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1957.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1957-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1957.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1958",
    "code": "1958",
    "nameAr": "براكاش Shah",
    "nameEn": "Prakash Shah",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "360 Mall",
    "workLocationAr": "فرع 360 مول",
    "phone": "9752088",
    "mobile": "9752088",
    "email": "1958@venturefoodskw.com",
    "civilId": "2918014200164",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10007872",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 115,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 145,
    "pamSalary": 115,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2918014200164",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200064001",
    "iban": "KW27ABKK0000000000060700200064001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1958-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1958-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1958.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1958-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1958.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1958-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1958.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1958-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1958.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1958-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1958.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1958-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1958.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1959",
    "code": "1959",
    "nameAr": "بيشال Putwar",
    "nameEn": "Bishal Putwar",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Avenues Mall",
    "workLocationAr": "فرع مجمع الأفنيوز",
    "phone": "9760900",
    "mobile": "9760900",
    "email": "1959@venturefoodskw.com",
    "civilId": "2935016500165",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10007995",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 115,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 145,
    "pamSalary": 115,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2935016500165",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200065001",
    "iban": "KW27ABKK0000000000060700200065001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1959-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1959-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1959.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1959-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1959.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1959-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1959.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1959-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1959.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1959-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1959.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1959-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1959.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1964",
    "code": "1964",
    "nameAr": "Dilliram Adhikari",
    "nameEn": "Dilliram Adhikari",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "ardiyacg@venturefoodskw.com",
    "mobile": "ardiyacg@venturefoodskw.com",
    "email": "1964@venturefoodskw.com",
    "civilId": "2952018800166",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10008118",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 115,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 145,
    "pamSalary": 115,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2952018800166",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200066001",
    "iban": "KW27ABKK0000000000060700200066001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1964-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1964-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1964.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1964-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1964.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1964-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1964.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1964-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1964.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1964-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1964.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1964-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1964.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1965",
    "code": "1965",
    "nameAr": "Dipika Lama",
    "nameEn": "Dipika Lama",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Al Kout Mall",
    "workLocationAr": "فرع الكوت مول",
    "phone": "9778524",
    "mobile": "9778524",
    "email": "1965@venturefoodskw.com",
    "civilId": "2969012100167",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10008241",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 130,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 160,
    "pamSalary": 130,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2969012100167",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200067001",
    "iban": "KW27ABKK0000000000060700200067001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1965-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1965-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1965.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1965-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1965.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1965-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1965.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1965-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1965.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1965-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1965.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1965-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1965.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1968",
    "code": "1968",
    "nameAr": "Swastika Katwal",
    "nameEn": "Swastika Katwal",
    "jobTitleAr": "وكيل أول مركز اتصال وتوصيل",
    "jobTitleEn": "Senior Call Center Agent",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Promenade Mall",
    "workLocationAr": "فرع البروميناد مول",
    "phone": "callcenter3@venturefoodskw.com",
    "mobile": "callcenter3@venturefoodskw.com",
    "email": "1968@venturefoodskw.com",
    "civilId": "2986014400168",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10008364",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 130,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 160,
    "pamSalary": 130,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - وكيل أول مركز اتصال وتوصيل",
    "pamId": "2986014400168",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200068001",
    "iban": "KW27ABKK0000000000060700200068001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1968-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1968-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1968.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1968-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1968.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1968-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1968.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1968-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1968.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1968-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1968.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1968-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1968.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1969",
    "code": "1969",
    "nameAr": "Jamuna Rai",
    "nameEn": "Jamuna Rai",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "9796148",
    "mobile": "9796148",
    "email": "1969@venturefoodskw.com",
    "civilId": "2913016700169",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10008487",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 130,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 160,
    "pamSalary": 130,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2913016700169",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200069001",
    "iban": "KW27ABKK0000000000060700200069001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1969-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1969-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1969.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1969-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1969.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1969-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1969.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1969-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1969.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1969-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1969.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1969-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1969.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1970",
    "code": "1970",
    "nameAr": "Asmat علي",
    "nameEn": "Asmat Ali",
    "jobTitleAr": "سائق مركبة خفيفة وتوصيل",
    "jobTitleEn": "Light Vehicle Driver",
    "department": "Supply Chain Department",
    "departmentAr": "إدارة سلاسل الإمداد والمستودعات",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9804960",
    "mobile": "9804960",
    "email": "1970@venturefoodskw.com",
    "civilId": "2930019000170",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10008610",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 180,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 210,
    "pamSalary": 180,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - سائق مركبة خفيفة وتوصيل",
    "pamId": "2930019000170",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200070001",
    "iban": "KW27ABKK0000000000060700200070001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1970-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1970-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1970.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1970-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1970.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1970-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1970.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1970-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1970.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1970-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1970.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1970-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1970.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1972",
    "code": "1972",
    "nameAr": "أندرو نجيب بطرس",
    "nameEn": "Andrew Nageh Boutros",
    "jobTitleAr": "محاسب فروع ومخازن",
    "jobTitleEn": "Branch & Inventory Accountant",
    "department": "Finance Department",
    "departmentAr": "الإدارة المالية والمحاسبة",
    "workLocation": "Sharq - Head Office",
    "workLocationAr": "الشرق - المقر الرئيسي",
    "phone": "98855441",
    "mobile": "98855441",
    "email": "andrew@venturefoodskw.com",
    "civilId": "289101200442",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10008733",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "مصر",
    "nationalityEn": "Egypt",
    "flag": "🇪🇬",
    "basicSalary": 550,
    "allowances": 80,
    "deductions": 0,
    "netSalary": 630,
    "pamSalary": 550,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11208 - محاسب تدقيق",
    "pamId": "289101200442",
    "bankName": "Gulf Bank",
    "bankNameAr": "بنك الخليج",
    "bankAccount": "060700200071001",
    "iban": "KW22GULF000000000030997755001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "هاني فيليب (CFO)",
    "managerNameEn": "Hani Philip (CFO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1972-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1972-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1972.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1972-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1972.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1972-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1972.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1972-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1972.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1972-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1972.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1972-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1972.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1982",
    "code": "1982",
    "nameAr": "Gerry Bercasio Toladro",
    "nameEn": "Gerry Bercasio Toladro",
    "jobTitleAr": "عضو فريق تشغيل مطاعم",
    "jobTitleEn": "Restaurant Operations Team Member",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Avenues Mall",
    "workLocationAr": "فرع مجمع الأفنيوز",
    "phone": "360mallcg@venturefoodskw.com",
    "mobile": "360mallcg@venturefoodskw.com",
    "email": "1982@venturefoodskw.com",
    "civilId": "2964014600172",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10008856",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 410,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 440,
    "pamSalary": 410,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل مطاعم",
    "pamId": "2964014600172",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200072001",
    "iban": "KW27ABKK0000000000060700200072001",
    "status": "ON_VACATION",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1982-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1982-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1982.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1982-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1982.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1982-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1982.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1982-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1982.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1982-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1982.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1982-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1982.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1983",
    "code": "1983",
    "nameAr": "باريشا باشا سيد",
    "nameEn": "Barisha Baasha Syed",
    "jobTitleAr": "سائق مركبة خفيفة وتوصيل",
    "jobTitleEn": "Light Vehicle Driver",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "9831396",
    "mobile": "9831396",
    "email": "1983@venturefoodskw.com",
    "civilId": "2981016900173",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10008979",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 200,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 230,
    "pamSalary": 200,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - سائق مركبة خفيفة وتوصيل",
    "pamId": "2981016900173",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200073001",
    "iban": "KW27ABKK0000000000060700200073001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1983-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1983-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1983.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1983-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1983.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1983-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1983.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1983-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1983.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1983-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1983.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1983-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1983.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1986",
    "code": "1986",
    "nameAr": "Anish Niroula",
    "nameEn": "Anish Niroula",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Al Kout Mall",
    "workLocationAr": "فرع الكوت مول",
    "phone": "9840208",
    "mobile": "9840208",
    "email": "1986@venturefoodskw.com",
    "civilId": "2998019200174",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10009102",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2998019200174",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200074001",
    "iban": "KW27ABKK0000000000060700200074001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1986-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1986-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1986.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1986-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1986.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1986-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1986.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1986-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1986.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1986-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1986.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1986-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1986.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1987",
    "code": "1987",
    "nameAr": "Basanta Syangtan",
    "nameEn": "Basanta Syangtan",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Promenade Mall",
    "workLocationAr": "فرع البروميناد مول",
    "phone": "9849020",
    "mobile": "9849020",
    "email": "1987@venturefoodskw.com",
    "civilId": "2925012500175",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10009225",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2925012500175",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200075001",
    "iban": "KW27ABKK0000000000060700200075001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1987-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1987-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1987.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1987-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1987.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1987-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1987.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1987-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1987.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1987-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1987.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1987-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1987.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1988",
    "code": "1988",
    "nameAr": "Bibek Basnet",
    "nameEn": "Bibek Basnet",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "9857832",
    "mobile": "9857832",
    "email": "1988@venturefoodskw.com",
    "civilId": "2942014800176",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10009348",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2942014800176",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200076001",
    "iban": "KW27ABKK0000000000060700200076001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1988-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1988-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1988.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1988-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1988.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1988-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1988.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1988-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1988.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1988-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1988.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1988-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1988.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1989",
    "code": "1989",
    "nameAr": "بيكرام باريار",
    "nameEn": "Bikram Pariyar",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9866644",
    "mobile": "9866644",
    "email": "1989@venturefoodskw.com",
    "civilId": "2959017100177",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10009471",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2959017100177",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200077001",
    "iban": "KW27ABKK0000000000060700200077001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1989-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1989-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1989.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1989-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1989.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1989-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1989.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1989-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1989.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1989-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1989.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1989-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1989.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1991",
    "code": "1991",
    "nameAr": "مانيش ماجار",
    "nameEn": "Manish Magar",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9875456",
    "mobile": "9875456",
    "email": "1991@venturefoodskw.com",
    "civilId": "2976019400178",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10009594",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "نيبال",
    "nationalityEn": "Nepal",
    "flag": "🇳🇵",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2976019400178",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200078001",
    "iban": "KW27ABKK0000000000060700200078001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1991-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1991-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1991.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1991-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1991.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1991-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1991.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1991-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1991.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1991-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1991.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1991-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1991.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1992",
    "code": "1992",
    "nameAr": "Nirmal Karki",
    "nameEn": "Nirmal Karki",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Avenues Mall",
    "workLocationAr": "فرع مجمع الأفنيوز",
    "phone": "9884268",
    "mobile": "9884268",
    "email": "1992@venturefoodskw.com",
    "civilId": "2993012700179",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10009717",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2993012700179",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200079001",
    "iban": "KW27ABKK0000000000060700200079001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1992-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1992-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1992.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1992-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1992.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1992-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1992.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1992-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1992.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1992-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1992.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1992-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1992.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1993",
    "code": "1993",
    "nameAr": "Paras Rasaili",
    "nameEn": "Paras Rasaili",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "paras@gmail.com",
    "mobile": "paras@gmail.com",
    "email": "1993@venturefoodskw.com",
    "civilId": "2920015000180",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10009840",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2920015000180",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200080001",
    "iban": "KW27ABKK0000000000060700200080001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1993-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1993-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1993.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1993-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1993.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1993-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1993.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1993-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1993.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1993-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1993.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1993-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1993.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1995",
    "code": "1995",
    "nameAr": "سومان تامانغ",
    "nameEn": "Suman Tamang",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Supply Chain Department",
    "departmentAr": "إدارة سلاسل الإمداد والمستودعات",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9901892",
    "mobile": "9901892",
    "email": "1995@venturefoodskw.com",
    "civilId": "2937017300181",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10009963",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "نيبال",
    "nationalityEn": "Nepal",
    "flag": "🇳🇵",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2937017300181",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200081001",
    "iban": "KW27ABKK0000000000060700200081001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1995-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1995-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1995.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1995-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1995.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1995-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1995.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1995-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1995.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1995-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1995.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1995-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1995.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1996",
    "code": "1996",
    "nameAr": "أوجوال داهال",
    "nameEn": "Ujwal Dahal",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9910704",
    "mobile": "9910704",
    "email": "1996@venturefoodskw.com",
    "civilId": "2954019600182",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10010086",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2954019600182",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200082001",
    "iban": "KW27ABKK0000000000060700200082001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1996-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1996-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1996.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1996-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1996.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1996-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1996.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1996-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1996.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1996-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1996.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1996-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1996.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-1997",
    "code": "1997",
    "nameAr": "Rocky Limbu Khudang",
    "nameEn": "Rocky Limbu Khudang",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "9919516",
    "mobile": "9919516",
    "email": "1997@venturefoodskw.com",
    "civilId": "2971012900183",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10010209",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2971012900183",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200083001",
    "iban": "KW27ABKK0000000000060700200083001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-1997-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-1997-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_1997.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-1997-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_1997.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-1997-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_1997.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-1997-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_1997.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-1997-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_1997.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-1997-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_1997.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2000",
    "code": "2000",
    "nameAr": "Cristina Hernandez",
    "nameEn": "Cristina Hernandez",
    "jobTitleAr": "مشرف مطعم",
    "jobTitleEn": "Restaurant Supervisor",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "ardiyacg@venturefoodskw.com",
    "mobile": "ardiyacg@venturefoodskw.com",
    "email": "2000@venturefoodskw.com",
    "civilId": "2988015200184",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10010332",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 250,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 280,
    "pamSalary": 250,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مشرف مطعم",
    "pamId": "2988015200184",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200084001",
    "iban": "KW27ABKK0000000000060700200084001",
    "status": "ON_VACATION",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2000-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2000-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2000.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2000-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2000.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2000-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2000.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2000-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2000.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2000-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2000.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2000-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2000.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2001",
    "code": "2001",
    "nameAr": "Akriti Raut",
    "nameEn": "Akriti Raut",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "360 Mall",
    "workLocationAr": "فرع 360 مول",
    "phone": "9937140",
    "mobile": "9937140",
    "email": "2001@venturefoodskw.com",
    "civilId": "2915017500185",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10010455",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2915017500185",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200085001",
    "iban": "KW27ABKK0000000000060700200085001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2001-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2001-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2001.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2001-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2001.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2001-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2001.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2001-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2001.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2001-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2001.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2001-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2001.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2006",
    "code": "2006",
    "nameAr": "نيلسون كورتيز بالوسو",
    "nameEn": "Nelson Cortez Baluso",
    "jobTitleAr": "عضو فريق تشغيل مطاعم",
    "jobTitleEn": "Restaurant Operations Team Member",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "CK@venturefoodskw.com · EXT 501 · DIR 302",
    "mobile": "CK@venturefoodskw.com · EXT 501 · DIR 302",
    "email": "2006@venturefoodskw.com",
    "civilId": "2932019800186",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10010578",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الفلبين",
    "nationalityEn": "Philippines",
    "flag": "🇵🇭",
    "basicSalary": 300,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 330,
    "pamSalary": 300,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل مطاعم",
    "pamId": "2932019800186",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200086001",
    "iban": "KW27ABKK0000000000060700200086001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2006-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2006-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2006.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2006-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2006.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2006-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2006.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2006-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2006.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2006-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2006.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2006-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2006.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2010",
    "code": "2010",
    "nameAr": "Donna ماريا Cana Aviles",
    "nameEn": "Donna Maria Cana Aviles",
    "jobTitleAr": "مشرف مطعم",
    "jobTitleEn": "Restaurant Supervisor",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "promenademall@venturefoodskw.com",
    "mobile": "promenademall@venturefoodskw.com",
    "email": "2010@venturefoodskw.com",
    "civilId": "2949013100187",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10010701",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 350,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 380,
    "pamSalary": 350,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مشرف مطعم",
    "pamId": "2949013100187",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200087001",
    "iban": "KW27ABKK0000000000060700200087001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2010-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2010-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2010.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2010-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2010.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2010-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2010.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2010-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2010.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2010-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2010.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2010-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2010.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2015",
    "code": "2015",
    "nameAr": "Indra Kumari رانا",
    "nameEn": "Indra Kumari Rana",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Al Kout Mall",
    "workLocationAr": "فرع الكوت مول",
    "phone": "9963576",
    "mobile": "9963576",
    "email": "2015@venturefoodskw.com",
    "civilId": "2966015400188",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10010824",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "نيبال",
    "nationalityEn": "Nepal",
    "flag": "🇳🇵",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2966015400188",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200088001",
    "iban": "KW27ABKK0000000000060700200088001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2015-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2015-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2015.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2015-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2015.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2015-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2015.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2015-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2015.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2015-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2015.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2015-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2015.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2019",
    "code": "2019",
    "nameAr": "Lok بهادور Bholan",
    "nameEn": "Lok Bahadur Bholan",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Supply Chain Department",
    "departmentAr": "إدارة سلاسل الإمداد والمستودعات",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9972388",
    "mobile": "9972388",
    "email": "2019@venturefoodskw.com",
    "civilId": "2983017700189",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10010947",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2983017700189",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200089001",
    "iban": "KW27ABKK0000000000060700200089001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2019-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2019-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2019.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2019-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2019.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2019-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2019.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2019-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2019.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2019-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2019.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2019-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2019.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2022",
    "code": "2022",
    "nameAr": "Sushma Gautam",
    "nameEn": "Sushma Gautam",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "shielab@venturefoodskw.com",
    "mobile": "shielab@venturefoodskw.com",
    "email": "2022@venturefoodskw.com",
    "civilId": "2910011000190",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10011070",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2910011000190",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200090001",
    "iban": "KW27ABKK0000000000060700200090001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2022-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2022-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2022.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2022-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2022.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2022-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2022.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2022-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2022.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2022-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2022.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2022-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2022.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2023",
    "code": "2023",
    "nameAr": "Sunny Kumarpurbe",
    "nameEn": "Sunny Kumarpurbe",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "9990012",
    "mobile": "9990012",
    "email": "2023@venturefoodskw.com",
    "civilId": "2927013300191",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10011193",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2927013300191",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200091001",
    "iban": "KW27ABKK0000000000060700200091001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2023-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2023-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2023.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2023-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2023.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2023-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2023.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2023-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2023.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2023-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2023.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2023-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2023.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2025",
    "code": "2025",
    "nameAr": "Rishav Bhujel",
    "nameEn": "Rishav Bhujel",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "360 Mall",
    "workLocationAr": "فرع 360 مول",
    "phone": "9998824",
    "mobile": "9998824",
    "email": "2025@venturefoodskw.com",
    "civilId": "2944015600192",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10011316",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2944015600192",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200092001",
    "iban": "KW27ABKK0000000000060700200092001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2025-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2025-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2025.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2025-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2025.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2025-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2025.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2025-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2025.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2025-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2025.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2025-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2025.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2026",
    "code": "2026",
    "nameAr": "Indra بهادور Pulami ماجار",
    "nameEn": "Indra Bahadur Pulami Magar",
    "jobTitleAr": "سائق مركبة خفيفة وتوصيل",
    "jobTitleEn": "Light Vehicle Driver",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Avenues Mall",
    "workLocationAr": "فرع مجمع الأفنيوز",
    "phone": "9107637",
    "mobile": "9107637",
    "email": "2026@venturefoodskw.com",
    "civilId": "2961017900193",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10011439",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "نيبال",
    "nationalityEn": "Nepal",
    "flag": "🇳🇵",
    "basicSalary": 150,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 180,
    "pamSalary": 150,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - سائق مركبة خفيفة وتوصيل",
    "pamId": "2961017900193",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200093001",
    "iban": "KW27ABKK0000000000060700200093001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2026-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2026-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2026.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2026-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2026.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2026-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2026.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2026-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2026.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2026-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2026.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2026-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2026.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2027",
    "code": "2027",
    "nameAr": "Bifal Sekh Ismail Sekh",
    "nameEn": "Bifal Sekh Ismail Sekh",
    "jobTitleAr": "سائق مركبة خفيفة وتوصيل",
    "jobTitleEn": "Light Vehicle Driver",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "9116449",
    "mobile": "9116449",
    "email": "2027@venturefoodskw.com",
    "civilId": "2978011200194",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10011562",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 150,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 180,
    "pamSalary": 150,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - سائق مركبة خفيفة وتوصيل",
    "pamId": "2978011200194",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200094001",
    "iban": "KW27ABKK0000000000060700200094001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2027-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2027-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2027.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2027-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2027.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2027-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2027.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2027-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2027.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2027-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2027.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2027-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2027.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2028",
    "code": "2028",
    "nameAr": "Wilma Consorte Dcampo",
    "nameEn": "Wilma Consorte Dcampo",
    "jobTitleAr": "مشرف مطعم",
    "jobTitleEn": "Restaurant Supervisor",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Al Kout Mall",
    "workLocationAr": "فرع الكوت مول",
    "phone": "shielab@venturefoodskw.com",
    "mobile": "shielab@venturefoodskw.com",
    "email": "2028@venturefoodskw.com",
    "civilId": "2995013500195",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10011685",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 250,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 280,
    "pamSalary": 250,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مشرف مطعم",
    "pamId": "2995013500195",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200095001",
    "iban": "KW27ABKK0000000000060700200095001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2028-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2028-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2028.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2028-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2028.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2028-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2028.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2028-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2028.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2028-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2028.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2028-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2028.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2030",
    "code": "2030",
    "nameAr": "Lok بهادور تامانغ",
    "nameEn": "Lok Bahadur Tamang",
    "jobTitleAr": "سائق مركبة خفيفة وتوصيل",
    "jobTitleEn": "Light Vehicle Driver",
    "department": "Supply Chain Department",
    "departmentAr": "إدارة سلاسل الإمداد والمستودعات",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9134073",
    "mobile": "9134073",
    "email": "2030@venturefoodskw.com",
    "civilId": "2922015800196",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10011808",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "نيبال",
    "nationalityEn": "Nepal",
    "flag": "🇳🇵",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - سائق مركبة خفيفة وتوصيل",
    "pamId": "2922015800196",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200096001",
    "iban": "KW27ABKK0000000000060700200096001",
    "status": "ON_VACATION",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2030-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2030-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2030.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2030-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2030.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2030-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2030.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2030-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2030.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2030-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2030.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2030-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2030.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2031",
    "code": "2031",
    "nameAr": "Dipeshraj Gautam",
    "nameEn": "Dipeshraj Gautam",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "9142885",
    "mobile": "9142885",
    "email": "2031@venturefoodskw.com",
    "civilId": "2939018100197",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10011931",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2939018100197",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200097001",
    "iban": "KW27ABKK0000000000060700200097001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2031-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2031-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2031.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2031-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2031.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2031-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2031.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2031-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2031.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2031-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2031.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2031-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2031.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2033",
    "code": "2033",
    "nameAr": "راجيش Shah",
    "nameEn": "Rajesh Shah",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "9151697",
    "mobile": "9151697",
    "email": "2033@venturefoodskw.com",
    "civilId": "2956011400198",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10012054",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2956011400198",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200098001",
    "iban": "KW27ABKK0000000000060700200098001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2033-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2033-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2033.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2033-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2033.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2033-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2033.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2033-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2033.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2033-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2033.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2033-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2033.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2034",
    "code": "2034",
    "nameAr": "Raj Charmakar",
    "nameEn": "Raj Charmakar",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "360 Mall",
    "workLocationAr": "فرع 360 مول",
    "phone": "9160509",
    "mobile": "9160509",
    "email": "2034@venturefoodskw.com",
    "civilId": "2973013700199",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10012177",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2973013700199",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200099001",
    "iban": "KW27ABKK0000000000060700200099001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2034-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2034-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2034.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2034-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2034.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2034-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2034.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2034-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2034.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2034-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2034.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2034-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2034.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2035",
    "code": "2035",
    "nameAr": "ساربان داس تاتما",
    "nameEn": "Sarban Das Tatma",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9169321",
    "mobile": "9169321",
    "email": "2035@venturefoodskw.com",
    "civilId": "2990016000200",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10012300",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2990016000200",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200100001",
    "iban": "KW27ABKK0000000000060700200100001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2035-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2035-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2035.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2035-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2035.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2035-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2035.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2035-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2035.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2035-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2035.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2035-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2035.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2036",
    "code": "2036",
    "nameAr": "Shikhar ثابا ماجار",
    "nameEn": "Shikhar Thapa Magar",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "9178133",
    "mobile": "9178133",
    "email": "2036@venturefoodskw.com",
    "civilId": "2917018300201",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10012423",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "نيبال",
    "nationalityEn": "Nepal",
    "flag": "🇳🇵",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2917018300201",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200101001",
    "iban": "KW27ABKK0000000000060700200101001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2036-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2036-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2036.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2036-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2036.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2036-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2036.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2036-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2036.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2036-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2036.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2036-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2036.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2037",
    "code": "2037",
    "nameAr": "Surya Kafle",
    "nameEn": "Surya Kafle",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Al Kout Mall",
    "workLocationAr": "فرع الكوت مول",
    "phone": "shielab@venturefoodskw.com",
    "mobile": "shielab@venturefoodskw.com",
    "email": "2037@venturefoodskw.com",
    "civilId": "2934011600202",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10012546",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2934011600202",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200102001",
    "iban": "KW27ABKK0000000000060700200102001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2037-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2037-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2037.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2037-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2037.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2037-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2037.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2037-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2037.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2037-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2037.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2037-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2037.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2041",
    "code": "2041",
    "nameAr": "محمد السيد أحمد عبد ربه",
    "nameEn": "Mohamed Al Saeed",
    "jobTitleAr": "رئيس الحسابات (Chief Accountant)",
    "jobTitleEn": "Chief Accountant",
    "department": "Finance Department",
    "departmentAr": "الإدارة المالية والمحاسبة",
    "workLocation": "Sharq - Head Office",
    "workLocationAr": "الشرق - المقر الرئيسي",
    "phone": "98811223",
    "mobile": "98811223",
    "email": "chief.accountant@venturefoodskw.com",
    "civilId": "281041500332",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10012669",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "مصر",
    "nationalityEn": "Egypt",
    "flag": "🇪🇬",
    "basicSalary": 1100,
    "allowances": 200,
    "deductions": 0,
    "netSalary": 1300,
    "pamSalary": 1100,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11202 - رئيس حسابات",
    "pamId": "281041500332",
    "bankName": "National Bank of Kuwait (NBK)",
    "bankNameAr": "بنك الكويت الوطني",
    "bankAccount": "060700200103001",
    "iban": "KW33NBOK000000000010554422001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "هاني فيليب (CFO)",
    "managerNameEn": "Hani Philip (CFO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2041-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2041-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2041.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2041-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2041.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2041-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2041.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2041-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2041.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2041-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2041.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2041-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2041.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2049",
    "code": "2049",
    "nameAr": "عبد الله عبد الغفار جمعة عويره",
    "nameEn": "Abdullah Abdulghafar Awirah",
    "jobTitleAr": "سكرتير تنفيذي",
    "jobTitleEn": "Executive Secretary",
    "department": "HR & Admin Department",
    "departmentAr": "الموارد البشرية والشؤون الإدارية",
    "workLocation": "Sharq - Head Office",
    "workLocationAr": "الشرق - المقر الرئيسي",
    "phone": "97288418",
    "mobile": "99147158",
    "email": "a.awirah@venturefoodskw.com",
    "civilId": "283081800546",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10012792",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "مصر",
    "nationalityEn": "Egypt",
    "flag": "🇪🇬",
    "basicSalary": 350,
    "allowances": 50,
    "deductions": 0,
    "netSalary": 400,
    "pamSalary": 350,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11655 - سكرتير تنفيذي",
    "pamId": "283081800546",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "0607002067001",
    "iban": "KW27ABKK00000000000607002067001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2049-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2049-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2049.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2049-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2049.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2049-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2049.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2049-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2049.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2049-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2049.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2049-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2049.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2050",
    "code": "2050",
    "nameAr": "Yuhanidhi Karunanidi",
    "nameEn": "Yuhanidhi Karunanidi",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "9213381",
    "mobile": "9213381",
    "email": "2050@venturefoodskw.com",
    "civilId": "2985018500205",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10012915",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2985018500205",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200105001",
    "iban": "KW27ABKK0000000000060700200105001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2050-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2050-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2050.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2050-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2050.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2050-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2050.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2050-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2050.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2050-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2050.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2050-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2050.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2052",
    "code": "2052",
    "nameAr": "منير أحمد Zaheer أحمد Minhas",
    "nameEn": "Munir Ahmed Zaheer Ahmed Minhas",
    "jobTitleAr": "أمين مستودع مركزي",
    "jobTitleEn": "Central Warehouse Keeper",
    "department": "Supply Chain Department",
    "departmentAr": "إدارة سلاسل الإمداد والمستودعات",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "warehouse@venturefoodskw.com",
    "mobile": "warehouse@venturefoodskw.com",
    "email": "2052@venturefoodskw.com",
    "civilId": "2912011800206",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10013038",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "مصر",
    "nationalityEn": "Egypt",
    "flag": "🇪🇬",
    "basicSalary": 600,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 630,
    "pamSalary": 600,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - أمين مستودع مركزي",
    "pamId": "2912011800206",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200106001",
    "iban": "KW27ABKK0000000000060700200106001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2052-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2052-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2052.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2052-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2052.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2052-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2052.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2052-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2052.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2052-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2052.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2052-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2052.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2053",
    "code": "2053",
    "nameAr": "Sonu Khan",
    "nameEn": "Sonu Khan",
    "jobTitleAr": "أمين مستودع مركزي",
    "jobTitleEn": "Central Warehouse Keeper",
    "department": "Supply Chain Department",
    "departmentAr": "إدارة سلاسل الإمداد والمستودعات",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "waelhabib@gmail.com",
    "mobile": "waelhabib@gmail.com",
    "email": "2053@venturefoodskw.com",
    "civilId": "2929014100207",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10013161",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 100,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 130,
    "pamSalary": 100,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - أمين مستودع مركزي",
    "pamId": "2929014100207",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200107001",
    "iban": "KW27ABKK0000000000060700200107001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2053-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2053-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2053.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2053-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2053.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2053-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2053.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2053-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2053.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2053-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2053.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2053-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2053.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2055",
    "code": "2055",
    "nameAr": "دينيش Perera",
    "nameEn": "Dinesh Perera",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "9239817",
    "mobile": "9239817",
    "email": "2055@venturefoodskw.com",
    "civilId": "2946016400208",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10013284",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2946016400208",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200108001",
    "iban": "KW27ABKK0000000000060700200108001",
    "status": "ON_VACATION",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2055-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2055-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2055.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2055-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2055.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2055-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2055.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2055-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2055.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2055-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2055.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2055-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2055.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2056",
    "code": "2056",
    "nameAr": "محمد AZAAN ZAKEER حسين",
    "nameEn": "MOHAMMED AZAAN ZAKEER HUSSAIN",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Al Kout Mall",
    "workLocationAr": "فرع الكوت مول",
    "phone": "9248629",
    "mobile": "9248629",
    "email": "2056@venturefoodskw.com",
    "civilId": "2963018700209",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10013407",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 100,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 130,
    "pamSalary": 100,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2963018700209",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200109001",
    "iban": "KW27ABKK0000000000060700200109001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2056-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2056-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2056.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2056-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2056.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2056-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2056.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2056-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2056.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2056-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2056.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2056-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2056.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2058",
    "code": "2058",
    "nameAr": "Mohammad Rehman Muhammad Inayat",
    "nameEn": "Mohammad Rehman Muhammad Inayat",
    "jobTitleAr": "عضو فريق تشغيل مطاعم",
    "jobTitleEn": "Restaurant Operations Team Member",
    "department": "Supply Chain Department",
    "departmentAr": "إدارة سلاسل الإمداد والمستودعات",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9257441",
    "mobile": "9257441",
    "email": "2058@venturefoodskw.com",
    "civilId": "2980012000210",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10013530",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 180,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 210,
    "pamSalary": 180,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل مطاعم",
    "pamId": "2980012000210",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200110001",
    "iban": "KW27ABKK0000000000060700200110001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2058-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2058-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2058.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2058-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2058.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2058-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2058.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2058-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2058.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2058-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2058.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2058-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2058.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2059",
    "code": "2059",
    "nameAr": "Boyer Ryan Ballatan Cuaresma",
    "nameEn": "Boyer Ryan Ballatan Cuaresma",
    "jobTitleAr": "مشرف مطعم",
    "jobTitleEn": "Restaurant Supervisor",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "avenuesmallcg@venturefoodskw.com",
    "mobile": "avenuesmallcg@venturefoodskw.com",
    "email": "2059@venturefoodskw.com",
    "civilId": "2997014300211",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10013653",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 250,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 280,
    "pamSalary": 250,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مشرف مطعم",
    "pamId": "2997014300211",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200111001",
    "iban": "KW27ABKK0000000000060700200111001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2059-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2059-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2059.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2059-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2059.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2059-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2059.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2059-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2059.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2059-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2059.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2059-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2059.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2060",
    "code": "2060",
    "nameAr": "Samitha Udara Lakmal",
    "nameEn": "Samitha Udara Lakmal",
    "jobTitleAr": "طاهي - درجة ثانية (Commi II)",
    "jobTitleEn": "Cook - Commi II",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "9275065",
    "mobile": "9275065",
    "email": "2060@venturefoodskw.com",
    "civilId": "2924016600212",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10013776",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - طاهي - درجة ثانية (Commi II)",
    "pamId": "2924016600212",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200112001",
    "iban": "KW27ABKK0000000000060700200112001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2060-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2060-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2060.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2060-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2060.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2060-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2060.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2060-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2060.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2060-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2060.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2060-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2060.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2061",
    "code": "2061",
    "nameAr": "Dilshan Madhushanka Senevirathna",
    "nameEn": "Dilshan Madhushanka Senevirathna",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "360 Mall",
    "workLocationAr": "فرع 360 مول",
    "phone": "9283877",
    "mobile": "9283877",
    "email": "2061@venturefoodskw.com",
    "civilId": "2941018900213",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10013899",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2941018900213",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200113001",
    "iban": "KW27ABKK0000000000060700200113001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2061-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2061-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2061.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2061-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2061.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2061-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2061.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2061-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2061.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2061-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2061.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2061-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2061.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2062",
    "code": "2062",
    "nameAr": "برلين بيريرا Ernest",
    "nameEn": "Berlin Periera Ernest",
    "jobTitleAr": "عضو فريق تشغيل مطاعم",
    "jobTitleEn": "Restaurant Operations Team Member",
    "department": "Supply Chain Department",
    "departmentAr": "إدارة سلاسل الإمداد والمستودعات",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9292689",
    "mobile": "9292689",
    "email": "2062@venturefoodskw.com",
    "civilId": "2958012200214",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10014022",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 300,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 330,
    "pamSalary": 300,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل مطاعم",
    "pamId": "2958012200214",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200114001",
    "iban": "KW27ABKK0000000000060700200114001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2062-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2062-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2062.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2062-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2062.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2062-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2062.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2062-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2062.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2062-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2062.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2062-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2062.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2063",
    "code": "2063",
    "nameAr": "Chitra بهادور Aale",
    "nameEn": "Chitra Bahadur Aale",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "9301501",
    "mobile": "9301501",
    "email": "2063@venturefoodskw.com",
    "civilId": "2975014500215",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10014145",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2975014500215",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200115001",
    "iban": "KW27ABKK0000000000060700200115001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2063-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2063-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2063.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2063-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2063.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2063-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2063.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2063-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2063.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2063-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2063.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2063-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2063.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2064",
    "code": "2064",
    "nameAr": "Nabraj شودري",
    "nameEn": "Nabraj Chaudhary",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Supply Chain Department",
    "departmentAr": "إدارة سلاسل الإمداد والمستودعات",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9310313",
    "mobile": "9310313",
    "email": "2064@venturefoodskw.com",
    "civilId": "2992016800216",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10014268",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2992016800216",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200116001",
    "iban": "KW27ABKK0000000000060700200116001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2064-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2064-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2064.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2064-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2064.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2064-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2064.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2064-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2064.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2064-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2064.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2064-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2064.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2065",
    "code": "2065",
    "nameAr": "براكاش Giri",
    "nameEn": "Prakash Giri",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Promenade Mall",
    "workLocationAr": "فرع البروميناد مول",
    "phone": "9319125",
    "mobile": "9319125",
    "email": "2065@venturefoodskw.com",
    "civilId": "2919019100217",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10014391",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2919019100217",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200117001",
    "iban": "KW27ABKK0000000000060700200117001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2065-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2065-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2065.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2065-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2065.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2065-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2065.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2065-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2065.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2065-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2065.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2065-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2065.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2066",
    "code": "2066",
    "nameAr": "Amin SK",
    "nameEn": "Amin SK",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "9327937",
    "mobile": "9327937",
    "email": "2066@venturefoodskw.com",
    "civilId": "2936012400218",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10014514",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 100,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 130,
    "pamSalary": 100,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2936012400218",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200118001",
    "iban": "KW27ABKK0000000000060700200118001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2066-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2066-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2066.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2066-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2066.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2066-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2066.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2066-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2066.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2066-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2066.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2066-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2066.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2067",
    "code": "2067",
    "nameAr": "ميناج موندال",
    "nameEn": "Minaj Mondal",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "9336749",
    "mobile": "9336749",
    "email": "2067@venturefoodskw.com",
    "civilId": "2953014700219",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10014637",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 100,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 130,
    "pamSalary": 100,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2953014700219",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200119001",
    "iban": "KW27ABKK0000000000060700200119001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2067-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2067-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2067.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2067-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2067.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2067-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2067.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2067-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2067.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2067-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2067.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2067-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2067.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2068",
    "code": "2068",
    "nameAr": "Rupesh تامانغ",
    "nameEn": "Rupesh Tamang",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "360 Mall",
    "workLocationAr": "فرع 360 مول",
    "phone": "9345561",
    "mobile": "9345561",
    "email": "2068@venturefoodskw.com",
    "civilId": "2970017000220",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10014760",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "نيبال",
    "nationalityEn": "Nepal",
    "flag": "🇳🇵",
    "basicSalary": 100,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 130,
    "pamSalary": 100,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2970017000220",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200120001",
    "iban": "KW27ABKK0000000000060700200120001",
    "status": "ON_VACATION",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2068-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2068-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2068.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2068-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2068.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2068-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2068.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2068-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2068.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2068-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2068.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2068-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2068.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2072",
    "code": "2072",
    "nameAr": "Sujeewa Prathiyathi Gagabadalage",
    "nameEn": "Sujeewa Prathiyathi Gagabadalage",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Avenues Mall",
    "workLocationAr": "فرع مجمع الأفنيوز",
    "phone": "9354373",
    "mobile": "9354373",
    "email": "2072@venturefoodskw.com",
    "civilId": "2987019300221",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10014883",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2987019300221",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200121001",
    "iban": "KW27ABKK0000000000060700200121001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2072-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2072-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2072.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2072-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2072.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2072-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2072.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2072-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2072.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2072-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2072.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2072-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2072.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2074",
    "code": "2074",
    "nameAr": "Arra Catherine Lim Yurong",
    "nameEn": "Arra Catherine Lim Yurong",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "9363185",
    "mobile": "9363185",
    "email": "2074@venturefoodskw.com",
    "civilId": "2914012600222",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10015006",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 150,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 180,
    "pamSalary": 150,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2914012600222",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200122001",
    "iban": "KW27ABKK0000000000060700200122001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2074-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2074-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2074.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2074-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2074.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2074-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2074.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2074-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2074.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2074-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2074.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2074-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2074.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2075",
    "code": "2075",
    "nameAr": "Eldrikc Francisco Ricohermoso",
    "nameEn": "Eldrikc Francisco Ricohermoso",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Al Kout Mall",
    "workLocationAr": "فرع الكوت مول",
    "phone": "9371997",
    "mobile": "9371997",
    "email": "2075@venturefoodskw.com",
    "civilId": "2931014900223",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10015129",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 150,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 180,
    "pamSalary": 150,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2931014900223",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200123001",
    "iban": "KW27ABKK0000000000060700200123001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2075-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2075-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2075.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2075-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2075.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2075-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2075.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2075-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2075.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2075-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2075.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2075-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2075.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2076",
    "code": "2076",
    "nameAr": "مارياني رومبلون دورومال",
    "nameEn": "Mariany Romblon Doromal",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Promenade Mall",
    "workLocationAr": "فرع البروميناد مول",
    "phone": "9380809",
    "mobile": "9380809",
    "email": "2076@venturefoodskw.com",
    "civilId": "2948017200224",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10015252",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الفلبين",
    "nationalityEn": "Philippines",
    "flag": "🇵🇭",
    "basicSalary": 150,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 180,
    "pamSalary": 150,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2948017200224",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200124001",
    "iban": "KW27ABKK0000000000060700200124001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2076-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2076-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2076.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2076-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2076.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2076-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2076.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2076-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2076.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2076-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2076.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2076-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2076.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2077",
    "code": "2077",
    "nameAr": "فينسينت جونيور مانالو إيفا",
    "nameEn": "Vincente Jr. Manalo Eva",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "9389621",
    "mobile": "9389621",
    "email": "2077@venturefoodskw.com",
    "civilId": "2965019500225",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10015375",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 150,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 180,
    "pamSalary": 150,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2965019500225",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200125001",
    "iban": "KW27ABKK0000000000060700200125001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2077-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2077-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2077.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2077-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2077.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2077-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2077.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2077-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2077.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2077-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2077.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2077-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2077.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2078",
    "code": "2078",
    "nameAr": "رشاد حسين Abdul حسن",
    "nameEn": "Rishad Hussain Abdul Hassan",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "9398433",
    "mobile": "9398433",
    "email": "2078@venturefoodskw.com",
    "civilId": "2982012800226",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10015498",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 100,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 130,
    "pamSalary": 100,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2982012800226",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200126001",
    "iban": "KW27ABKK0000000000060700200126001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2078-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2078-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2078.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2078-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2078.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2078-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2078.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2078-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2078.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2078-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2078.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2078-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2078.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2079",
    "code": "2079",
    "nameAr": "شانيل إشرام عابدين",
    "nameEn": "Shanel Ishram Abdeen",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "360 Mall",
    "workLocationAr": "فرع 360 مول",
    "phone": "9407245",
    "mobile": "9407245",
    "email": "2079@venturefoodskw.com",
    "civilId": "2999015100227",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10015621",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 120,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 150,
    "pamSalary": 120,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2999015100227",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200127001",
    "iban": "KW27ABKK0000000000060700200127001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2079-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2079-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2079.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2079-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2079.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2079-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2079.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2079-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2079.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2079-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2079.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2079-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2079.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2084",
    "code": "2084",
    "nameAr": "إلمر بالودو أوندوت",
    "nameEn": "Elmer Baludo Ondot",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Avenues Mall",
    "workLocationAr": "فرع مجمع الأفنيوز",
    "phone": "9416057",
    "mobile": "9416057",
    "email": "2084@venturefoodskw.com",
    "civilId": "2926017400228",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10015744",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 150,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 180,
    "pamSalary": 150,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2926017400228",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200128001",
    "iban": "KW27ABKK0000000000060700200128001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2084-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2084-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2084.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2084-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2084.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2084-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2084.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2084-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2084.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2084-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2084.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2084-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2084.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2085",
    "code": "2085",
    "nameAr": "أرجان ماري جوميرا كانونيجو",
    "nameEn": "Arjane Mary Gomera Canonigo",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "9424869",
    "mobile": "9424869",
    "email": "2085@venturefoodskw.com",
    "civilId": "2943019700229",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10015867",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 150,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 180,
    "pamSalary": 150,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2943019700229",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200129001",
    "iban": "KW27ABKK0000000000060700200129001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2085-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2085-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2085.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2085-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2085.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2085-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2085.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2085-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2085.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2085-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2085.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2085-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2085.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2086",
    "code": "2086",
    "nameAr": "جلين ريفيرا أيوبان",
    "nameEn": "Glenn Rivera Ayuban",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Al Kout Mall",
    "workLocationAr": "فرع الكوت مول",
    "phone": "9433681",
    "mobile": "9433681",
    "email": "2086@venturefoodskw.com",
    "civilId": "2960013000230",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10015990",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الفلبين",
    "nationalityEn": "Philippines",
    "flag": "🇵🇭",
    "basicSalary": 150,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 180,
    "pamSalary": 150,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2960013000230",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200130001",
    "iban": "KW27ABKK0000000000060700200130001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2086-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2086-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2086.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2086-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2086.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2086-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2086.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2086-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2086.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2086-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2086.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2086-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2086.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2087",
    "code": "2087",
    "nameAr": "هاني جريس جونزاليس دي ليون",
    "nameEn": "Honey Grace Gonzales De Leon",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Promenade Mall",
    "workLocationAr": "فرع البروميناد مول",
    "phone": "9442493",
    "mobile": "9442493",
    "email": "2087@venturefoodskw.com",
    "civilId": "2977015300231",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10016113",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 150,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 180,
    "pamSalary": 150,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2977015300231",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200131001",
    "iban": "KW27ABKK0000000000060700200131001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2087-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2087-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2087.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2087-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2087.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2087-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2087.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2087-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2087.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2087-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2087.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2087-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2087.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2088",
    "code": "2088",
    "nameAr": "جيناروز جالفز",
    "nameEn": "Jeanarose Galvez",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "9451305",
    "mobile": "9451305",
    "email": "2088@venturefoodskw.com",
    "civilId": "2994017600232",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10016236",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 150,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 180,
    "pamSalary": 150,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2994017600232",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200132001",
    "iban": "KW27ABKK0000000000060700200132001",
    "status": "ON_VACATION",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2088-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2088-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2088.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2088-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2088.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2088-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2088.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2088-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2088.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2088-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2088.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2088-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2088.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2089",
    "code": "2089",
    "nameAr": "كيم لوي ريفاتو",
    "nameEn": "Kim Louie Rivato",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "9460117",
    "mobile": "9460117",
    "email": "2089@venturefoodskw.com",
    "civilId": "2921019900233",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10016359",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 150,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 180,
    "pamSalary": 150,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2921019900233",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200133001",
    "iban": "KW27ABKK0000000000060700200133001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2089-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2089-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2089.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2089-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2089.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2089-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2089.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2089-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2089.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2089-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2089.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2089-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2089.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2090",
    "code": "2090",
    "nameAr": "عبد الرحمن محمد جمال الدين أحمد عبد الله",
    "nameEn": "Abdelrahman Mohamed Gamaledin Ahmed Abdalla",
    "jobTitleAr": "منسق تسويق وعلاقات عامة",
    "jobTitleEn": "Marketing Coordinator",
    "department": "Marketing Department",
    "departmentAr": "إدارة التسويق والعلاقات العامة",
    "workLocation": "Sharq - Head Office",
    "workLocationAr": "الشرق - المقر الرئيسي",
    "phone": "60481009",
    "mobile": "60481009",
    "email": "marketing@venturefoodskw.com",
    "civilId": "295061400871",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10016482",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "مصر",
    "nationalityEn": "Egypt",
    "flag": "🇪🇬",
    "basicSalary": 450,
    "allowances": 50,
    "deductions": 0,
    "netSalary": 500,
    "pamSalary": 450,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11405 - منسق تسويق",
    "pamId": "295061400871",
    "bankName": "National Bank of Kuwait (NBK)",
    "bankNameAr": "بنك الكويت الوطني",
    "bankAccount": "060700200134001",
    "iban": "KW90NBOK000000000010776655001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد العبد المحسن (CMO)",
    "managerNameEn": "Ahmed Al-Abdulmohsen (CMO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2090-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2090-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2090.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2090-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2090.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2090-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2090.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2090-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2090.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2090-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2090.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2090-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2090.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2091",
    "code": "2091",
    "nameAr": "ربيع أنيس يحيى",
    "nameEn": "Rabih Anis Yehia",
    "jobTitleAr": "مساعد مدير العمليات وتشغيل الفروع",
    "jobTitleEn": "Assistant Operations Manager",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Sharq - Head Office",
    "workLocationAr": "الشرق - المقر الرئيسي",
    "phone": "95544332",
    "mobile": "95544332",
    "email": "r.yehia@venturefoodskw.com",
    "civilId": "285112000882",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10016605",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "لبنان",
    "nationalityEn": "Lebanon",
    "flag": "🇱🇧",
    "basicSalary": 1200,
    "allowances": 200,
    "deductions": 0,
    "netSalary": 1400,
    "pamSalary": 1200,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11108 - مساعد مدير مطاعم",
    "pamId": "285112000882",
    "bankName": "National Bank of Kuwait (NBK)",
    "bankNameAr": "بنك الكويت الوطني",
    "bankAccount": "060700200135001",
    "iban": "KW41NBOK000000000010221199001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "زكريا إسكندر (OPS Director)",
    "managerNameEn": "Zakaria Iskandar (OPS Director)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2091-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2091-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2091.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2091-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2091.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2091-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2091.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2091-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2091.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2091-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2091.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2091-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2091.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2093",
    "code": "2093",
    "nameAr": "أليكس محرم كبول",
    "nameEn": "Alex Mohram Kaboul",
    "jobTitleAr": "الشيف التنفيذي العام للمجموعة",
    "jobTitleEn": "Group Executive Chef",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "65969800",
    "mobile": "65969800",
    "email": "chef.alex@venturefoodskw.com",
    "civilId": "284091500774",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10016728",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "لبنان",
    "nationalityEn": "Lebanon",
    "flag": "🇱🇧",
    "basicSalary": 1600,
    "allowances": 250,
    "deductions": 0,
    "netSalary": 1850,
    "pamSalary": 1600,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "12101 - شيف تنفيذي",
    "pamId": "284091500774",
    "bankName": "National Bank of Kuwait (NBK)",
    "bankNameAr": "بنك الكويت الوطني",
    "bankAccount": "060700200136001",
    "iban": "KW72NBOK000000000010443322001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2093-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2093-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2093.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2093-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2093.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2093-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2093.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2093-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2093.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2093-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2093.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2093-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2093.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2094",
    "code": "2094",
    "nameAr": "كابيل داليب تشاند ديف",
    "nameEn": "Kapil Dalip Chand Dev",
    "jobTitleAr": "محاسب تكاليف وأجور (Accountant 4)",
    "jobTitleEn": "Cost & Payroll Accountant",
    "department": "Finance Department",
    "departmentAr": "الإدارة المالية والمحاسبة",
    "workLocation": "Sharq - Head Office",
    "workLocationAr": "الشرق - المقر الرئيسي",
    "phone": "94488332",
    "mobile": "94488332",
    "email": "payroll@venturefoodskw.com",
    "civilId": "291081500661",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10016851",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 500,
    "allowances": 70,
    "deductions": 0,
    "netSalary": 570,
    "pamSalary": 500,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11210 - محاسب تكاليف",
    "pamId": "291081500661",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200137001",
    "iban": "KW88ABKK000000000004112233001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "هاني فيليب (CFO)",
    "managerNameEn": "Hani Philip (CFO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2094-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2094-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2094.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2094-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2094.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2094-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2094.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2094-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2094.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2094-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2094.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2094-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2094.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2096",
    "code": "2096",
    "nameAr": "نيرانجان جوبالي",
    "nameEn": "Niranjan Gopali",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Promenade Mall",
    "workLocationAr": "فرع البروميناد مول",
    "phone": "9504177",
    "mobile": "9504177",
    "email": "2096@venturefoodskw.com",
    "civilId": "2916013400238",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10016974",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2916013400238",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200138001",
    "iban": "KW27ABKK0000000000060700200138001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2096-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2096-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2096.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2096-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2096.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2096-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2096.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2096-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2096.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2096-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2096.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2096-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2096.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2097",
    "code": "2097",
    "nameAr": "سمير خاتري تشيتري",
    "nameEn": "Samir Khatri Chhertri",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "shielab@venturefoodskw.com",
    "mobile": "shielab@venturefoodskw.com",
    "email": "2097@venturefoodskw.com",
    "civilId": "2933015700239",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10017097",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2933015700239",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200139001",
    "iban": "KW27ABKK0000000000060700200139001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2097-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2097-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2097.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2097-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2097.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2097-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2097.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2097-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2097.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2097-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2097.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2097-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2097.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2098",
    "code": "2098",
    "nameAr": "Mahamad رشيد",
    "nameEn": "Mahamad Rasid",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "9521801",
    "mobile": "9521801",
    "email": "2098@venturefoodskw.com",
    "civilId": "2950018000240",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10017220",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2950018000240",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200140001",
    "iban": "KW27ABKK0000000000060700200140001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2098-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2098-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2098.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2098-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2098.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2098-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2098.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2098-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2098.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2098-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2098.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2098-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2098.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2099",
    "code": "2099",
    "nameAr": "صدم ميا",
    "nameEn": "Sadam Miya",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "360 Mall",
    "workLocationAr": "فرع 360 مول",
    "phone": "9530613",
    "mobile": "9530613",
    "email": "2099@venturefoodskw.com",
    "civilId": "2967011300241",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10017343",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2967011300241",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200141001",
    "iban": "KW27ABKK0000000000060700200141001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2099-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2099-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2099.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2099-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2099.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2099-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2099.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2099-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2099.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2099-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2099.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2099-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2099.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2100",
    "code": "2100",
    "nameAr": "أربين ثابا",
    "nameEn": "Arbin Thapa",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Avenues Mall",
    "workLocationAr": "فرع مجمع الأفنيوز",
    "phone": "9539425",
    "mobile": "9539425",
    "email": "2100@venturefoodskw.com",
    "civilId": "2984013600242",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10017466",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "نيبال",
    "nationalityEn": "Nepal",
    "flag": "🇳🇵",
    "basicSalary": 100,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 130,
    "pamSalary": 100,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2984013600242",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200142001",
    "iban": "KW27ABKK0000000000060700200142001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2100-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2100-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2100.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2100-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2100.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2100-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2100.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2100-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2100.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2100-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2100.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2100-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2100.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2101",
    "code": "2101",
    "nameAr": "بينود غيري",
    "nameEn": "Binod Gaire",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "9548237",
    "mobile": "9548237",
    "email": "2101@venturefoodskw.com",
    "civilId": "2911015900243",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10017589",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2911015900243",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200143001",
    "iban": "KW27ABKK0000000000060700200143001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2101-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2101-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2101.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2101-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2101.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2101-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2101.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2101-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2101.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2101-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2101.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2101-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2101.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2102",
    "code": "2102",
    "nameAr": "ديباك شودري",
    "nameEn": "Dipak Chaudhary",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Al Kout Mall",
    "workLocationAr": "فرع الكوت مول",
    "phone": "9557049",
    "mobile": "9557049",
    "email": "2102@venturefoodskw.com",
    "civilId": "2928018200244",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10017712",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2928018200244",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200144001",
    "iban": "KW27ABKK0000000000060700200144001",
    "status": "ON_VACATION",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2102-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2102-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2102.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2102-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2102.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2102-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2102.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2102-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2102.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2102-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2102.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2102-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2102.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2103",
    "code": "2103",
    "nameAr": "كريشنا تامانغ",
    "nameEn": "Krishna Tamang",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Promenade Mall",
    "workLocationAr": "فرع البروميناد مول",
    "phone": "9565861",
    "mobile": "9565861",
    "email": "2103@venturefoodskw.com",
    "civilId": "2945011500245",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10017835",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "نيبال",
    "nationalityEn": "Nepal",
    "flag": "🇳🇵",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2945011500245",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200145001",
    "iban": "KW27ABKK0000000000060700200145001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2103-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2103-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2103.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2103-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2103.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2103-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2103.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2103-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2103.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2103-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2103.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2103-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2103.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2104",
    "code": "2104",
    "nameAr": "أنكيت شودري",
    "nameEn": "Ankit Chaudhary",
    "jobTitleAr": "مساعد مطبخ وتجهيز",
    "jobTitleEn": "Kitchen Helper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Ardiya",
    "workLocationAr": "فرع العارضية الحرفية",
    "phone": "9574673",
    "mobile": "9574673",
    "email": "2104@venturefoodskw.com",
    "civilId": "2962013800246",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10017958",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 90,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 120,
    "pamSalary": 90,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مساعد مطبخ وتجهيز",
    "pamId": "2962013800246",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200146001",
    "iban": "KW27ABKK0000000000060700200146001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2104-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2104-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2104.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2104-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2104.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2104-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2104.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2104-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2104.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2104-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2104.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2104-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2104.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2105",
    "code": "2105",
    "nameAr": "زيني ناتيفيداد",
    "nameEn": "zenny Natividad",
    "jobTitleAr": "عضو طاقم خدمة واستقبال (Crew)",
    "jobTitleEn": "Restaurant Crew",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "9583485",
    "mobile": "9583485",
    "email": "2105@venturefoodskw.com",
    "civilId": "2979016100247",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10018081",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 150,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 180,
    "pamSalary": 150,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو طاقم خدمة واستقبال (Crew)",
    "pamId": "2979016100247",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200147001",
    "iban": "KW27ABKK0000000000060700200147001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2105-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2105-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2105.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2105-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2105.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2105-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2105.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2105-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2105.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2105-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2105.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2105-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2105.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2106",
    "code": "2106",
    "nameAr": "قيصر جان",
    "nameEn": "Kaisar Jan",
    "jobTitleAr": "مشرف مطعم",
    "jobTitleEn": "Restaurant Supervisor",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "360 Mall",
    "workLocationAr": "فرع 360 مول",
    "phone": "9592297",
    "mobile": "9592297",
    "email": "2106@venturefoodskw.com",
    "civilId": "2996018400248",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10018204",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 225,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 255,
    "pamSalary": 225,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - مشرف مطعم",
    "pamId": "2996018400248",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200148001",
    "iban": "KW27ABKK0000000000060700200148001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2106-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2106-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2106.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2106-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2106.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2106-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2106.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2106-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2106.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2106-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2106.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2106-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2106.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2110",
    "code": "2110",
    "nameAr": "إبراهيم حمادة إبراهيم صادق",
    "nameEn": "Ibrahim Hamada Ibrahim Sadek",
    "jobTitleAr": "سائق مركبة خفيفة وتوصيل",
    "jobTitleEn": "Light Vehicle Driver",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Avenues Mall",
    "workLocationAr": "فرع مجمع الأفنيوز",
    "phone": "9601109",
    "mobile": "9601109",
    "email": "2110@venturefoodskw.com",
    "civilId": "2923011700249",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10018327",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "مصر",
    "nationalityEn": "Egypt",
    "flag": "🇪🇬",
    "basicSalary": 100,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 130,
    "pamSalary": 100,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - سائق مركبة خفيفة وتوصيل",
    "pamId": "2923011700249",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200149001",
    "iban": "KW27ABKK0000000000060700200149001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2110-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2110-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2110.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2110-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2110.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2110-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2110.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2110-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2110.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2110-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2110.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2110-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2110.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2111",
    "code": "2111",
    "nameAr": "زكريا إسكندر يوسف",
    "nameEn": "Zakaria Iskandar",
    "jobTitleAr": "مدير العمليات الإقليمي (OPS Director)",
    "jobTitleEn": "Director of Restaurant Operations",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Sharq - Head Office",
    "workLocationAr": "الشرق - المقر الرئيسي",
    "phone": "90001400",
    "mobile": "90001400",
    "email": "operations@venturefoodskw.com",
    "civilId": "281081500223",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10018450",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "لبنان",
    "nationalityEn": "Lebanon",
    "flag": "🇱🇧",
    "basicSalary": 2000,
    "allowances": 350,
    "deductions": 0,
    "netSalary": 2350,
    "pamSalary": 2000,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11105 - مدير عمليات مطاعم",
    "pamId": "281081500223",
    "bankName": "National Bank of Kuwait (NBK)",
    "bankNameAr": "بنك الكويت الوطني",
    "bankAccount": "060700200150001",
    "iban": "KW50NBOK000000000010332211001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2111-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2111-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2111.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2111-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2111.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2111-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2111.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2111-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2111.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2111-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2111.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2111-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2111.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2112",
    "code": "2112",
    "nameAr": "شيام",
    "nameEn": "Shyam",
    "jobTitleAr": "مسؤول الموارد البشرية والشؤون الإدارية",
    "jobTitleEn": "HR & Admin Officer",
    "department": "HR & Admin Department",
    "departmentAr": "إدارة الموارد البشرية والشؤون الإدارية",
    "workLocation": "Sharq - Head Office",
    "workLocationAr": "الشرق - المقر الرئيسي",
    "phone": "99882211",
    "mobile": "99882211",
    "email": "hr@venturefoodskw.com",
    "civilId": "290031500441",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10018573",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الكويت",
    "nationalityEn": "Kuwait",
    "flag": "🇰🇼",
    "basicSalary": 1400,
    "allowances": 200,
    "deductions": 0,
    "netSalary": 1600,
    "pamSalary": 1400,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11301 - مدير شؤون موظفين",
    "pamId": "290031500441",
    "bankName": "National Bank of Kuwait (NBK)",
    "bankNameAr": "بنك الكويت الوطني",
    "bankAccount": "060700200151001",
    "iban": "KW45NBOK000000000010665544001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2112-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2112-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2112.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2112-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2112.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2112-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2112.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2112-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2112.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2112-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2112.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2112-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2112.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2113",
    "code": "2113",
    "nameAr": "زهراء علي حسن المؤمن",
    "nameEn": "Zahraa Ali",
    "jobTitleAr": "مساعدة شؤون الموظفين والتوظيف",
    "jobTitleEn": "HR Assistant",
    "department": "HR & Admin Department",
    "departmentAr": "الموارد البشرية والشؤون الإدارية",
    "workLocation": "Sharq - Head Office",
    "workLocationAr": "الشرق - المقر الرئيسي",
    "phone": "94433221",
    "mobile": "94433221",
    "email": "z.ali@venturefoodskw.com",
    "civilId": "298072000991",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10018696",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الكويت",
    "nationalityEn": "Kuwait",
    "flag": "🇰🇼",
    "basicSalary": 600,
    "allowances": 100,
    "deductions": 0,
    "netSalary": 700,
    "pamSalary": 600,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11305 - باحث شؤون إدارية",
    "pamId": "298072000991",
    "bankName": "Burgan Bank",
    "bankNameAr": "بنك برقان",
    "bankAccount": "060700200152001",
    "iban": "KW33BURG000000000040118822001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "شيام (إدارة الموارد البشرية والشؤون الإدارية)",
    "managerNameEn": "Shyam (HR & Admin)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2113-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2113-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2113.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2113-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2113.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2113-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2113.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2113-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2113.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2113-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2113.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2113-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2113.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-VF106",
    "code": "VF106",
    "nameAr": "هاني فيليب خليل إبراهيم",
    "nameEn": "Hani Philip Khalil Ibrahim",
    "jobTitleAr": "المدير المالي التنفيذي (CFO)",
    "jobTitleEn": "Chief Financial Officer",
    "department": "Finance Department",
    "departmentAr": "الإدارة المالية والمحاسبة",
    "workLocation": "Sharq - Head Office",
    "workLocationAr": "الشرق - المقر الرئيسي",
    "phone": "97883344",
    "mobile": "97883344",
    "email": "cfo@venturefoodskw.com",
    "civilId": "279041200663",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10018819",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "مصر",
    "nationalityEn": "Egypt",
    "flag": "🇪🇬",
    "basicSalary": 1800,
    "allowances": 350,
    "deductions": 0,
    "netSalary": 2150,
    "pamSalary": 1800,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11201 - مدير مالي",
    "pamId": "279041200663",
    "bankName": "National Bank of Kuwait (NBK)",
    "bankNameAr": "بنك الكويت الوطني",
    "bankAccount": "060700200153001",
    "iban": "KW12NBOK000000000010887755001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-VF106-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-VF106-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_VF106.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-VF106-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_VF106.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-VF106-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_VF106.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-VF106-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_VF106.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-VF106-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_VF106.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-VF106-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_VF106.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-VF301",
    "code": "VF301",
    "nameAr": "منير أحمد  برلين بيريرا",
    "nameEn": "Munir Ahmed / Berlin Periera",
    "jobTitleAr": "أمين مستودع مركزي",
    "jobTitleEn": "Central Warehouse Keeper",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Salmiya",
    "workLocationAr": "فرع السالمية",
    "phone": "warehouse@venturefoodskw.com · EXT 301",
    "mobile": "warehouse@venturefoodskw.com · EXT 301",
    "email": "VF301@venturefoodskw.com",
    "civilId": "2918014200254",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10018942",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "مصر",
    "nationalityEn": "Egypt",
    "flag": "🇪🇬",
    "basicSalary": 200,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 230,
    "pamSalary": 200,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - أمين مستودع مركزي",
    "pamId": "2918014200254",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200154001",
    "iban": "KW27ABKK0000000000060700200154001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-VF301-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-VF301-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_VF301.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-VF301-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_VF301.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-VF301-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_VF301.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-VF301-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_VF301.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-VF301-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_VF301.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-VF301-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_VF301.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2092",
    "code": "2092",
    "nameAr": "Staff ",
    "nameEn": "Staff 2092",
    "jobTitleAr": "عضو فريق تشغيل المطاعم",
    "jobTitleEn": "Restaurant Operations Staff",
    "department": "Marketing Department",
    "departmentAr": "إدارة التسويق والعلاقات العامة",
    "workLocation": "Sharq - Head Office",
    "workLocationAr": "الشرق - المقر الرئيسي",
    "phone": "67788990",
    "mobile": "67788990",
    "email": "2092@venturefoodskw.com",
    "civilId": "297092100812",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10019065",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 400,
    "allowances": 50,
    "deductions": 0,
    "netSalary": 450,
    "pamSalary": 400,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل المطاعم",
    "pamId": "297092100812",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200155001",
    "iban": "KW27ABKK0000000000060700200155001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2092-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2092-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2092.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2092-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2092.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2092-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2092.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2092-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2092.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2092-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2092.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2092-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2092.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2024",
    "code": "2024",
    "nameAr": "Staff ",
    "nameEn": "Staff 2024",
    "jobTitleAr": "عضو فريق تشغيل المطاعم",
    "jobTitleEn": "Restaurant Operations Staff",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "69911223",
    "mobile": "69911223",
    "email": "2024@venturefoodskw.com",
    "civilId": "291051500714",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10019188",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 280,
    "allowances": 40,
    "deductions": 0,
    "netSalary": 320,
    "pamSalary": 280,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل المطاعم",
    "pamId": "291051500714",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200156001",
    "iban": "KW27ABKK0000000000060700200156001",
    "status": "ON_VACATION",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2024-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2024-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2024.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2024-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2024.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2024-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2024.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2024-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2024.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2024-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2024.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2024-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2024.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2025",
    "code": "2025",
    "nameAr": "Staff ",
    "nameEn": "Staff 2025",
    "jobTitleAr": "عضو فريق تشغيل المطاعم",
    "jobTitleEn": "Restaurant Operations Staff",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "69911224",
    "mobile": "69911224",
    "email": "2025@venturefoodskw.com",
    "civilId": "292081900621",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10019311",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 260,
    "allowances": 40,
    "deductions": 0,
    "netSalary": 300,
    "pamSalary": 260,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل المطاعم",
    "pamId": "292081900621",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200157001",
    "iban": "KW27ABKK0000000000060700200157001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2025-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2025-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2025.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2025-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2025.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2025-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2025.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2025-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2025.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2025-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2025.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2025-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2025.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2026",
    "code": "2026",
    "nameAr": "Staff ",
    "nameEn": "Staff 2026",
    "jobTitleAr": "عضو فريق تشغيل المطاعم",
    "jobTitleEn": "Restaurant Operations Staff",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "69911225",
    "mobile": "69911225",
    "email": "2026@venturefoodskw.com",
    "civilId": "293021400512",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10019434",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 240,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 270,
    "pamSalary": 240,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل المطاعم",
    "pamId": "293021400512",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200158001",
    "iban": "KW27ABKK0000000000060700200158001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2026-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2026-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2026.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2026-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2026.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2026-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2026.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2026-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2026.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2026-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2026.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2026-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2026.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2027",
    "code": "2027",
    "nameAr": "Staff ",
    "nameEn": "Staff 2027",
    "jobTitleAr": "عضو فريق تشغيل المطاعم",
    "jobTitleEn": "Restaurant Operations Staff",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "69911226",
    "mobile": "69911226",
    "email": "2027@venturefoodskw.com",
    "civilId": "294071800413",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10019557",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 220,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 250,
    "pamSalary": 220,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل المطاعم",
    "pamId": "294071800413",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200159001",
    "iban": "KW27ABKK0000000000060700200159001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2027-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2027-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2027.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2027-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2027.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2027-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2027.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2027-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2027.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2027-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2027.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2027-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2027.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2028",
    "code": "2028",
    "nameAr": "Staff ",
    "nameEn": "Staff 2028",
    "jobTitleAr": "عضو فريق تشغيل المطاعم",
    "jobTitleEn": "Restaurant Operations Staff",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "69911227",
    "mobile": "69911227",
    "email": "2028@venturefoodskw.com",
    "civilId": "290112300321",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10019680",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 220,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 250,
    "pamSalary": 220,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل المطاعم",
    "pamId": "290112300321",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200160001",
    "iban": "KW27ABKK0000000000060700200160001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2028-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2028-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2028.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2028-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2028.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2028-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2028.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2028-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2028.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2028-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2028.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2028-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2028.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2029",
    "code": "2029",
    "nameAr": "Staff ",
    "nameEn": "Staff 2029",
    "jobTitleAr": "عضو فريق تشغيل المطاعم",
    "jobTitleEn": "Restaurant Operations Staff",
    "department": "Culinary Department",
    "departmentAr": "إدارة الطهي والإنتاج المركزي",
    "workLocation": "Aswaq Al Qurain - Central Kitchen",
    "workLocationAr": "أسواق القرين - المطبخ المركزي",
    "phone": "69911228",
    "mobile": "69911228",
    "email": "2029@venturefoodskw.com",
    "civilId": "295031200214",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10019803",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 190,
    "allowances": 25,
    "deductions": 0,
    "netSalary": 215,
    "pamSalary": 190,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل المطاعم",
    "pamId": "295031200214",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200161001",
    "iban": "KW27ABKK0000000000060700200161001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2029-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2029-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2029.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2029-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2029.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2029-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2029.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2029-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2029.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2029-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2029.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2029-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2029.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2080",
    "code": "2080",
    "nameAr": "Staff ",
    "nameEn": "Staff 2080",
    "jobTitleAr": "عضو فريق تشغيل المطاعم",
    "jobTitleEn": "Restaurant Operations Staff",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "360 Mall",
    "workLocationAr": "فرع 360 مول",
    "phone": "69911229",
    "mobile": "69911229",
    "email": "2080@venturefoodskw.com",
    "civilId": "296061900115",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10019926",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 180,
    "allowances": 20,
    "deductions": 0,
    "netSalary": 200,
    "pamSalary": 180,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل المطاعم",
    "pamId": "296061900115",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200162001",
    "iban": "KW27ABKK0000000000060700200162001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2080-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2080-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2080.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2080-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2080.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2080-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2080.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2080-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2080.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2080-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2080.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2080-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2080.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2081",
    "code": "2081",
    "nameAr": "Staff ",
    "nameEn": "Staff 2081",
    "jobTitleAr": "عضو فريق تشغيل المطاعم",
    "jobTitleEn": "Restaurant Operations Staff",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Avenues Mall",
    "workLocationAr": "فرع مجمع الأفنيوز",
    "phone": "69911230",
    "mobile": "69911230",
    "email": "2081@venturefoodskw.com",
    "civilId": "295081100318",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10020049",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 170,
    "allowances": 20,
    "deductions": 0,
    "netSalary": 190,
    "pamSalary": 170,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل المطاعم",
    "pamId": "295081100318",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200163001",
    "iban": "KW27ABKK0000000000060700200163001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2081-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2081-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2081.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2081-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2081.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2081-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2081.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2081-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2081.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2081-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2081.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2081-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2081.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2082",
    "code": "2082",
    "nameAr": "Staff ",
    "nameEn": "Staff 2082",
    "jobTitleAr": "عضو فريق تشغيل المطاعم",
    "jobTitleEn": "Restaurant Operations Staff",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Assima Mall",
    "workLocationAr": "فرع العاصمة مول",
    "phone": "69911231",
    "mobile": "69911231",
    "email": "2082@venturefoodskw.com",
    "civilId": "296121400219",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10020172",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 180,
    "allowances": 20,
    "deductions": 0,
    "netSalary": 200,
    "pamSalary": 180,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل المطاعم",
    "pamId": "296121400219",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200164001",
    "iban": "KW27ABKK0000000000060700200164001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2082-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2082-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2082.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2082-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2082.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2082-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2082.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2082-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2082.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2082-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2082.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2082-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2082.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  },
  {
    "id": "emp-2083",
    "code": "2083",
    "nameAr": "Staff ",
    "nameEn": "Staff 2083",
    "jobTitleAr": "عضو فريق تشغيل المطاعم",
    "jobTitleEn": "Restaurant Operations Staff",
    "department": "Rest. Operations Department",
    "departmentAr": "إدارة عمليات المطاعم والفروع",
    "workLocation": "Al Kout Mall",
    "workLocationAr": "فرع الكوت مول",
    "phone": "69911232",
    "mobile": "69911232",
    "email": "2083@venturefoodskw.com",
    "civilId": "294091500412",
    "civilIdExpiry": "2026-05-10",
    "workPermitExpiry": "2026-05-10",
    "residencyExpiry": "2026-05-10",
    "healthCardExpiry": "2026-05-10",
    "passportNo": "P10020295",
    "passportExpiry": "2028-11-15",
    "nationalityAr": "الهند",
    "nationalityEn": "India",
    "flag": "🇮🇳",
    "basicSalary": 210,
    "allowances": 30,
    "deductions": 0,
    "netSalary": 240,
    "pamSalary": 210,
    "pamFileNumber": "5564561",
    "pamSponsor": "شركة فنتشر فودز لإدارة المطاعم ذ.م.م. - ملف رقم 5564561",
    "pamDesignationAr": "11600 - عضو فريق تشغيل المطاعم",
    "pamId": "294091500412",
    "bankName": "Al Ahli Bank of Kuwait (ABK)",
    "bankNameAr": "البنك الأهلي الكويتي",
    "bankAccount": "060700200165001",
    "iban": "KW27ABKK0000000000060700200165001",
    "status": "ACTIVE",
    "hireDate": "2025-04-20",
    "contractType": "عقد محدد المدة (3 سنوات)",
    "managerNameAr": "أحمد عصام الإبراهيم (CEO)",
    "managerNameEn": "Ahmed Al-Ebrahim (CEO)",
    "workingHours": "48 ساعة أسبوعياً (قانون العمل الكويتي 6/2010)",
    "leaves": {
      "balance": 2.71,
      "taken": 24.71,
      "total": 30
    },
    "loans": 0,
    "custodyCount": 1,
    "custodyItems": [
      {
        "nameAr": "حاسب آلي محمول أو هاتف عمل + زي الشركة الرسمي",
        "nameEn": "Company Mobile/Laptop & Uniform Kit",
        "tag": "CUST-2083-01",
        "date": "2025-04-20"
      }
    ],
    "documents": [
      {
        "id": "doc-2083-1",
        "nameAr": "البطاقة المدنية الكويتية (الوجهين)",
        "nameEn": "Kuwait Civil ID Card (Front & Back)",
        "type": "CIVIL_ID",
        "fileName": "civil_id_2083.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "1.4 MB"
      },
      {
        "id": "doc-2083-2",
        "nameAr": "جواز السفر وتصريح الدخول/الإقامة",
        "nameEn": "Passport & Residency Stamp",
        "type": "PASSPORT",
        "fileName": "passport_2083.pdf",
        "uploadDate": "2025-04-20",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "2.1 MB"
      },
      {
        "id": "doc-2083-3",
        "nameAr": "إذن العمل الصادر من الهيئة العامة للقوى العاملة (PAM)",
        "nameEn": "PAM Work Permit (Asahal System)",
        "type": "PAM_PERMIT",
        "fileName": "pam_permit_2083.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "980 KB"
      },
      {
        "id": "doc-2083-4",
        "nameAr": "عقد العمل الموثق وفق قانون العمل رقم 6/2010",
        "nameEn": "Notarized Labor Contract (Law 6/2010)",
        "type": "LABOR_CONTRACT",
        "fileName": "labor_contract_2083.pdf",
        "uploadDate": "2025-04-22",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "3.2 MB"
      },
      {
        "id": "doc-2083-5",
        "nameAr": "كرت البلدية الصحي لتداول الأغذية",
        "nameEn": "Municipality Food Handling Health Card",
        "type": "HEALTH_CARD",
        "fileName": "health_card_2083.pdf",
        "uploadDate": "2025-05-02",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "850 KB"
      },
      {
        "id": "doc-2083-6",
        "nameAr": "شهادة تحويل الراتب المصرفي وحساب الآيبان (WPS)",
        "nameEn": "Bank Salary Transfer & IBAN Certificate",
        "type": "BANK_IBAN",
        "fileName": "bank_iban_2083.pdf",
        "uploadDate": "2025-05-05",
        "statusAr": "ساري ومعتمد",
        "statusEn": "Valid & Verified",
        "size": "620 KB"
      }
    ],
    "auditLog": [
      {
        "date": "2025-04-20",
        "actionAr": "مباشرة العمل واعتماد عقد العمل المسجل لدى شركة فنتشر فودز",
        "actionEn": "Onboarding & Employment Contract Verified in Venture Foods System",
        "user": "Sheyam Hekmat (HR Manager)"
      },
      {
        "date": "2025-04-25",
        "actionAr": "تحديث بيانات الآيبان البنكي واعتماد مسير رواتب البنك الأهلي WPS",
        "actionEn": "Bank IBAN details updated & verified for ABK WPS Payroll",
        "user": "Hani Philip (CFO)"
      },
      {
        "date": "2025-05-10",
        "actionAr": "تجديد الإقامة وإذن العمل رقم الشؤون 5564561 والبطاقة المدنية بنجاح",
        "actionEn": "Residency, PAM Work Permit #5564561 & Civil ID renewed successfully",
        "user": "Amgad Samir (GRO / Mandoob)"
      }
    ]
  }
]
