'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Thermometer,
  Wrench,
  ClipboardCheck,
  CreditCard,
  Layers,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  FileSpreadsheet,
  Download,
  Building2,
  RefreshCw,
  Plus,
  ShieldCheck,
  Droplets,
  Flame,
  UserCheck,
  ChevronDown,
  ExternalLink,
  Sparkles,
  Info,
} from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useI18n } from '@/lib/i18n'

export type SafetyTab = 'cold' | 'maintenance' | 'inspection' | 'healthCards' | 'shelfLife'

export interface ColdUnit {
  id: string
  branchId: string
  branchNameAr: string
  branchNameEn: string
  unitNameAr: string
  unitNameEn: string
  typeAr: 'فريزر تجميد عميق' | 'ثلاجة تبريد وحفظ' | 'براد خضار وصوصات' | 'براد مشروبات'
  typeEn: string
  currentTempC: number
  targetTempC: number
  minSafeC: number
  maxSafeC: number
  humidityPct: number
  doorStatus: 'closed' | 'open'
  compressorHealth: 'optimal' | 'warning' | 'alert'
  lastTelemetry: string
  sensorBattery: number
}

export interface MaintenanceRecord {
  id: string
  odooWorkOrderId: string
  branchNameAr: string
  branchNameEn: string
  equipmentNameAr: string
  equipmentNameEn: string
  technicianName: string
  technicianId: string
  actionTypeAr: 'صيانة دورية' | 'صيانة وقائية' | 'إصلاح عطل طارئ' | 'استبدال قطع غيار'
  actionTypeEn: string
  date: string
  costKwd: number
  statusAr: 'مكتمل ومعاير' | 'قيد المتابعة' | 'تم التدقيق والاعتماد'
  statusEn: string
  detailsAr: string
  detailsEn: string
}

export interface HealthCardRecord {
  id: string
  empId: string
  nameAr: string
  nameEn: string
  jobTitleAr: string
  jobTitleEn: string
  branchNameAr: string
  branchNameEn: string
  civilId: string
  cardNo: string
  issueDate: string
  expiryDate: string
  daysRemaining: number
  statusAr: 'ساري ومطابق' | 'تنبيه تجديد (أقل من 30 يوماً)' | 'قيد الفحص المخبري'
  statusEn: string
}

// 1. Cold Units Database across the 9 Active Branches + Central Kitchen (active locations only)
export const COLD_UNITS_DATA: ColdUnit[] = [
  {
    id: 'CU-CK-01',
    branchId: 'CK-QURAIN',
    branchNameAr: 'المطبخ المركزي',
    branchNameEn: 'Central Kitchen',
    unitNameAr: 'غرفة تجميد اللحوم المركزية - المطبخ المركزي',
    unitNameEn: 'Central Meat Walk-in Freezer',
    typeAr: 'فريزر تجميد عميق',
    typeEn: 'Walk-in Freezer',
    currentTempC: -18.5,
    targetTempC: -18.0,
    minSafeC: -22.0,
    maxSafeC: -15.0,
    humidityPct: 62,
    doorStatus: 'closed',
    compressorHealth: 'optimal',
    lastTelemetry: 'منذ دقيقة',
    sensorBattery: 98,
  },
  {
    id: 'CU-CK-02',
    branchId: 'CK-QURAIN',
    branchNameAr: 'المطبخ المركزي',
    branchNameEn: 'Central Kitchen',
    unitNameAr: 'غرفة تبريد الخضار والصوصات المركزية - المطبخ المركزي',
    unitNameEn: 'Central Veg & Sauce Chiller',
    typeAr: 'براد خضار وصوصات',
    typeEn: 'Walk-in Chiller',
    currentTempC: 2.8,
    targetTempC: 3.0,
    minSafeC: 1.0,
    maxSafeC: 5.0,
    humidityPct: 78,
    doorStatus: 'closed',
    compressorHealth: 'optimal',
    lastTelemetry: 'منذ دقيقتين',
    sensorBattery: 95,
  },
  {
    id: 'CU-AVN-01',
    branchId: 'AVENUES',
    branchNameAr: 'فرع مجمع الأفنيوز',
    branchNameEn: 'The Avenues Mall Branch',
    unitNameAr: 'ثلاجة حفظ اللحوم والأنجوس - فرع الأفنيوز',
    unitNameEn: 'Angus Meat Preparation Chiller',
    typeAr: 'ثلاجة تبريد وحفظ',
    typeEn: 'Meat Chiller',
    currentTempC: 1.8,
    targetTempC: 2.0,
    minSafeC: 0.0,
    maxSafeC: 4.0,
    humidityPct: 70,
    doorStatus: 'closed',
    compressorHealth: 'optimal',
    lastTelemetry: 'منذ لحظات',
    sensorBattery: 92,
  },
  {
    id: 'CU-AVN-02',
    branchId: 'AVENUES',
    branchNameAr: 'فرع مجمع الأفنيوز',
    branchNameEn: 'The Avenues Mall Branch',
    unitNameAr: 'فريزر البطاطس والكرسبي - فرع الأفنيوز',
    unitNameEn: 'Fries & Crispy Deep Freezer',
    typeAr: 'فريزر تجميد عميق',
    typeEn: 'Deep Freezer',
    currentTempC: -19.2,
    targetTempC: -18.0,
    minSafeC: -22.0,
    maxSafeC: -14.0,
    humidityPct: 58,
    doorStatus: 'closed',
    compressorHealth: 'optimal',
    lastTelemetry: 'منذ دقيقة',
    sensorBattery: 89,
  },
  {
    id: 'CU-SLM-01',
    branchId: 'SALMIYA',
    branchNameAr: 'فرع السالمية',
    branchNameEn: 'Salmiya Branch',
    unitNameAr: 'ثلاجة صوصات وتحضير - فرع السالمية',
    unitNameEn: 'Sauce & Prep Chiller',
    typeAr: 'ثلاجة تبريد وحفظ',
    typeEn: 'Prep Chiller',
    currentTempC: 2.4,
    targetTempC: 2.0,
    minSafeC: 1.0,
    maxSafeC: 4.5,
    humidityPct: 72,
    doorStatus: 'closed',
    compressorHealth: 'optimal',
    lastTelemetry: 'منذ 3 دقائق',
    sensorBattery: 94,
  },
  {
    id: 'CU-KOUT-01',
    branchId: 'ALKOUT',
    branchNameAr: 'فرع الكوت مول',
    branchNameEn: 'Al-Kout Mall Branch',
    unitNameAr: 'ثلاجة الخضار والصوصات - فرع الكوت مول',
    unitNameEn: 'Veg & Dairy Chiller',
    typeAr: 'براد خضار وصوصات',
    typeEn: 'Vegetables Chiller',
    currentTempC: 3.1,
    targetTempC: 3.0,
    minSafeC: 1.0,
    maxSafeC: 5.0,
    humidityPct: 74,
    doorStatus: 'closed',
    compressorHealth: 'optimal',
    lastTelemetry: 'منذ دقيقة',
    sensorBattery: 91,
  },
  {
    id: 'CU-MRJ-01',
    branchId: 'MURROUJ',
    branchNameAr: 'فرع مجمع مروج',
    branchNameEn: 'Murrouj Complex Branch',
    unitNameAr: 'ثلاجة اللحوم والدجاج المتبل - فرع مروج',
    unitNameEn: 'Marinated Poultry & Beef Chiller',
    typeAr: 'ثلاجة تبريد وحفظ',
    typeEn: 'Meat Chiller',
    currentTempC: 2.0,
    targetTempC: 2.0,
    minSafeC: 0.5,
    maxSafeC: 4.0,
    humidityPct: 68,
    doorStatus: 'closed',
    compressorHealth: 'optimal',
    lastTelemetry: 'منذ لحظات',
    sensorBattery: 96,
  },
  {
    id: 'CU-ARD-01',
    branchId: 'ARDIYA',
    branchNameAr: 'فرع العارضية',
    branchNameEn: 'Ardiya Branch',
    unitNameAr: 'فريزر البطاطس والدواجن - فرع العارضية',
    unitNameEn: 'Fries & Poultry Freezer',
    typeAr: 'فريزر تجميد عميق',
    typeEn: 'Deep Freezer',
    currentTempC: -18.0,
    targetTempC: -18.0,
    minSafeC: -22.0,
    maxSafeC: -14.0,
    humidityPct: 60,
    doorStatus: 'closed',
    compressorHealth: 'optimal',
    lastTelemetry: 'منذ دقيقتين',
    sensorBattery: 88,
  },
  {
    id: 'CU-FRW-01',
    branchId: 'FARWANIYA',
    branchNameAr: 'فرع الفروانية',
    branchNameEn: 'Farwaniya Branch',
    unitNameAr: 'ثلاجة تحضير الشاورما والصوصات - فرع الفروانية',
    unitNameEn: 'Shawarma & Sauce Prep Chiller',
    typeAr: 'ثلاجة تبريد وحفظ',
    typeEn: 'Shawarma Chiller',
    currentTempC: 2.6,
    targetTempC: 2.0,
    minSafeC: 1.0,
    maxSafeC: 4.5,
    humidityPct: 75,
    doorStatus: 'closed',
    compressorHealth: 'optimal',
    lastTelemetry: 'منذ 4 دقائق',
    sensorBattery: 93,
  },
  {
    id: 'CU-HAW-01',
    branchId: 'HAWALLY',
    branchNameAr: 'فرع حولي',
    branchNameEn: 'Hawally Branch',
    unitNameAr: 'براد الشاي والحليب والمشروبات - فرع حولي',
    unitNameEn: 'Beverage & Milk Cooler',
    typeAr: 'براد مشروبات',
    typeEn: 'Beverage Cooler',
    currentTempC: 3.5,
    targetTempC: 4.0,
    minSafeC: 1.5,
    maxSafeC: 6.0,
    humidityPct: 65,
    doorStatus: 'closed',
    compressorHealth: 'optimal',
    lastTelemetry: 'منذ دقيقة',
    sensorBattery: 90,
  },
  {
    id: 'CU-KRN-01',
    branchId: 'KHAIRAN',
    branchNameAr: 'فرع الخيران',
    branchNameEn: 'Khairan Branch',
    unitNameAr: 'ثلاجة حفظ الروبيان والأسماك - فرع الخيران',
    unitNameEn: 'Seafood & Shrimp Cooler',
    typeAr: 'ثلاجة تبريد وحفظ',
    typeEn: 'Seafood Cooler',
    currentTempC: 1.2,
    targetTempC: 1.0,
    minSafeC: 0.0,
    maxSafeC: 3.5,
    humidityPct: 82,
    doorStatus: 'closed',
    compressorHealth: 'optimal',
    lastTelemetry: 'منذ لحظات',
    sensorBattery: 97,
  },
  {
    id: 'CU-QRN-01',
    branchId: 'QURAIN',
    branchNameAr: 'فرع مبارك الكبير',
    branchNameEn: 'Mubarak Al-Kabeer Branch',
    unitNameAr: 'براد تجهيز العجائن والجبن - فرع مبارك الكبير',
    unitNameEn: 'Dough & Cheese Prep Cooler',
    typeAr: 'ثلاجة تبريد وحفظ',
    typeEn: 'Dough Chiller',
    currentTempC: 2.5,
    targetTempC: 2.0,
    minSafeC: 1.0,
    maxSafeC: 4.0,
    humidityPct: 71,
    doorStatus: 'closed',
    compressorHealth: 'optimal',
    lastTelemetry: 'منذ دقيقة',
    sensorBattery: 95,
  },
]

// 2. Official Maintenance Records from Odoo (Technician: Rabie Anis Yehia #2042)
export const MAINTENANCE_RECORDS_DATA: MaintenanceRecord[] = [
  {
    id: 'MR-01',
    odooWorkOrderId: 'WO-2026-0841',
    branchNameAr: 'فرع مجمع الأفنيوز',
    branchNameEn: 'The Avenues Mall',
    equipmentNameAr: 'فلاتر المياه 5 مراحل لماكينات الثلج والمطبخ',
    equipmentNameEn: '5-Stage Water Filtration System',
    technicianName: 'ربيع أنيس يحيى',
    technicianId: '#2042',
    actionTypeAr: 'صيانة دورية',
    actionTypeEn: 'Routine Service',
    date: '28/10/2026',
    costKwd: 38.500,
    statusAr: 'مكتمل ومعاير',
    statusEn: 'Completed',
    detailsAr: 'تبديل شمعات الكربون والشوائب والأغشية لجميع مراحل الفلتر الخمس. نسبة الأملاح الذائبة بعد المعايرة TDS = 42 PPM (مطابق تماماً لاشتراطات البلدية).',
    detailsEn: 'Replaced 5 filter cartridges. Calibrated output TDS = 42 PPM.',
  },
  {
    id: 'MR-02',
    odooWorkOrderId: 'WO-2026-0855',
    branchNameAr: 'المطبخ المركزي',
    branchNameEn: 'Central Kitchen',
    equipmentNameAr: 'مصائد الشحوم المركزية سعة 1500 لتر',
    equipmentNameEn: '1500L Central Grease Traps',
    technicianName: 'ربيع أنيس يحيى',
    technicianId: '#2042',
    actionTypeAr: 'صيانة وقائية',
    actionTypeEn: 'Preventive Care',
    date: '01/11/2026',
    costKwd: 65.000,
    statusAr: 'تم التدقيق والاعتماد',
    statusEn: 'Approved',
    detailsAr: 'سحب الدهون والرواسب الصلبة بالكامل بواسطة صهريج معتمد، تطهير الخزانات بمحلول بيولوجي مضاد للروائح وتسجيل بيان التخلص المعتمد للبلدية.',
    detailsEn: 'Full pump-out and biological enzyme dosing conducted per municipality guidelines.',
  },
  {
    id: 'MR-03',
    odooWorkOrderId: 'WO-2026-0833',
    branchNameAr: 'فرع السالمية',
    branchNameEn: 'Salmiya Branch',
    equipmentNameAr: 'ثلاجة صوصات وتحضير السالمية',
    equipmentNameEn: 'Prep Chiller Cooling Circuit',
    technicianName: 'ربيع أنيس يحيى',
    technicianId: '#2042',
    actionTypeAr: 'إصلاح عطل طارئ',
    actionTypeEn: 'Emergency Repair',
    date: '25/10/2026',
    costKwd: 45.000,
    statusAr: 'مكتمل ومعاير',
    statusEn: 'Completed',
    detailsAr: 'فحص تسريب غاز التبريد عند صمام الشحن، إصلاح التسريب وتفريغ الهواء بالفاكيوم ثم شحن غاز R404A بكمية 1.4 كجم والوصول لحرارة +2.4 درجة مئوية.',
    detailsEn: 'Repaired valve leak, vacuumed line, and recharged 1.4kg R404A refrigerant.',
  },
  {
    id: 'MR-04',
    odooWorkOrderId: 'WO-2026-0862',
    branchNameAr: 'المطبخ المركزي',
    branchNameEn: 'Central Kitchen',
    equipmentNameAr: 'كمبروسر غرفة تجميد اللحوم (Semi-Hermetic Bitzer)',
    equipmentNameEn: 'Bitzer Semi-Hermetic Compressor',
    technicianName: 'ربيع أنيس يحيى',
    technicianId: '#2042',
    actionTypeAr: 'صيانة دورية',
    actionTypeEn: 'Routine Service',
    date: '02/11/2026',
    costKwd: 25.000,
    statusAr: 'مكتمل ومعاير',
    statusEn: 'Completed',
    detailsAr: 'فحص مستوى زيت الضاغط ومجسات الحرارة الرقمية وضغط السحب والطرد (Low: 18 PSI / High: 240 PSI). أداء الضاغط مستقر 100%.',
    detailsEn: 'Inspected compressor oil level, suction/discharge pressures, and digital thermostat calibration.',
  },
  {
    id: 'MR-05',
    odooWorkOrderId: 'WO-2026-0819',
    branchNameAr: 'فرع الكوت مول',
    branchNameEn: 'Al-Kout Mall',
    equipmentNameAr: 'سخانات إذابة الجليد ومروحة المبخر',
    equipmentNameEn: 'Evaporator Defrost Heaters',
    technicianName: 'ربيع أنيس يحيى',
    technicianId: '#2042',
    actionTypeAr: 'استبدال قطع غيار',
    actionTypeEn: 'Parts Replacement',
    date: '20/10/2026',
    costKwd: 32.000,
    statusAr: 'مكتمل ومعاير',
    statusEn: 'Completed',
    detailsAr: 'استبدال شمعة سخان الديفروست التالفة وضبط توقيت الإذابة التلقائية عبر لوحة التحكم كل 6 ساعات لمنع تراكم الثلج على زعانف التبريد.',
    detailsEn: 'Replaced defrost heating element and set timer cycle every 6 hours.',
  },
  {
    id: 'MR-06',
    odooWorkOrderId: 'WO-2026-0805',
    branchNameAr: 'فرع العارضية',
    branchNameEn: 'Ardiya Branch',
    equipmentNameAr: 'مكثف التبريد الخارجي ووحدة الكوندنسر',
    equipmentNameEn: 'Outdoor Condenser Coils',
    technicianName: 'ربيع أنيس يحيى',
    technicianId: '#2042',
    actionTypeAr: 'صيانة وقائية',
    actionTypeEn: 'Preventive Care',
    date: '18/10/2026',
    costKwd: 20.000,
    statusAr: 'مكتمل ومعاير',
    statusEn: 'Completed',
    detailsAr: 'غسيل مكثفات التبريد الخارجية بمضخة ضغط عالي ومحلول منظف خاص، تنظيف الريش وتحسين تدفق الهواء وسحب الأمبير الكهربائي.',
    detailsEn: 'Cleaned condenser fins with coil cleaner and high pressure washer.',
  },
]

// 3. Municipality & Food Authority Daily Inspection Protocols
export const INSPECTION_PROTOCOLS_DATA = [
  {
    id: 'INS-01',
    titleAr: 'فصل الدواجن واللحوم النيئة عن الأطعمة الجاهزة والخضار',
    titleEn: 'Cross-Contamination Prevention: Raw Poultry & Meat Segregation',
    standardAr: 'استخدام ألواح تقطيع وسكاكين ملونة (أحمر للحوم، أصفر للدواجن، أخضر للخضار)، وعزل أرفف التبريد النيئ أسفل المطبوخ لمنع التلوث التبادلي.',
    standardEn: 'Strict HACCP color-coded chopping boards and low-shelf raw meat positioning.',
    complianceScore: 100,
    statusAr: 'مطابق تماماً (100%)',
    lastAudited: 'اليوم - الوردية الصباحية',
    auditor: 'مشرف الجودة وسلامة الغذاء',
  },
  {
    id: 'INS-02',
    titleAr: 'نظافة وتعقيم أسطح التحضير الاستانلس ستيل والأواني',
    titleEn: 'Stainless Surface Sanitization & Food-Contact Sanitation',
    standardAr: 'تطبيق الغسيل الثلاثي (غسيل - شطف - تعقيم) مع الحفاظ على تركيز كلور التعقيم بين 100 إلى 200 PPM وتغيير أحواض التعقيم كل 4 ساعات.',
    standardEn: '3-sink dishwashing method with 100-200 PPM active sanitizer concentration.',
    complianceScore: 98.5,
    statusAr: 'مطابق بمعايير ممتازة',
    lastAudited: 'اليوم - الوردية الصباحية',
    auditor: 'مشرف الفرع المناوب',
  },
  {
    id: 'INS-03',
    titleAr: 'شهادات التطهير ومكافحة الحشرات المعتمدة من الصحة الوقائية',
    titleEn: 'Preventive Health Pest Control Certifications',
    standardAr: 'سريان عقد المكافحة الدوري المعتمد مع توثيق تقارير الزيارات النصف شهرية، ومصائد الحشرات الكهربائية النظيفة البعيدة عن الأطعمة.',
    standardEn: 'Active certified pest control agreement with bi-weekly visit logging.',
    complianceScore: 100,
    statusAr: 'ساري ومجدد لغاية 31/12/2026',
    lastAudited: '01/11/2026',
    auditor: 'إدارة الرقابة الصحية المركزية',
  },
  {
    id: 'INS-04',
    titleAr: 'معايرة موازين ومجسات درجات الحرارة بالأشعة والمسابر',
    titleEn: 'Digital Temperature Probe Ice-Point Calibration',
    standardAr: 'فحص موازين الحرارة الرقمية بواسطة محلول الماء والثلج (0.0 درجة مئوية) وتسجيل نسبة الانحراف المسموح بها (أقل من ±0.5 درجة مئوية).',
    standardEn: 'Monthly ice-bath calibration logging with maximum ±0.5°C acceptable margin.',
    complianceScore: 100,
    statusAr: 'تمت المعايرة لجميع الفروع الـ 9',
    lastAudited: '01/11/2026',
    auditor: 'ربيع أنيس يحيى (#2042)',
  },
  {
    id: 'INS-05',
    titleAr: 'جودة زيوت القلي واختبار المركبات القطبية TPM (Testo 270)',
    titleEn: 'Frying Oil TPM Quality Inspection (Max 24%)',
    standardAr: 'قياس نسبة المركبات القطبية TPM مرتين يومياً بجهاز Testo الرقمي، مع استبدال فوري للزيت عند وصول النسبة إلى 24% أو تغير اللون والرائحة.',
    standardEn: 'Daily Testo 270 measurement; oil discarded immediately at 24% TPM threshold.',
    complianceScore: 99.2,
    statusAr: 'متوسط الفروع 14.8% TPM (سليم جداً)',
    lastAudited: 'أمس - وردية الإغلاق',
    auditor: 'طهاة محطة المقليات',
  },
  {
    id: 'INS-06',
    titleAr: 'التزام العاملين بالزي الموحد، غطاء الرأس، والشهادات الصحية',
    titleEn: 'Staff Personal Hygiene, Headwear, & Health Card Compliance',
    standardAr: 'ارتداء المريول النظيف، غطاء الشعر واللحية، القفازات أثناء مناولة الأطعمة، قص الأظافر، وحمل كارت الصحة الصادر من بلدية الكويت.',
    standardEn: 'Full uniform, hair nets, food-grade gloves, clean nails, and visible health cards.',
    complianceScore: 100,
    statusAr: 'تفتيش صباحي إلزامي 100%',
    lastAudited: 'اليوم - قبل فتح الباب',
    auditor: 'المشرف المناوب في كل فرع',
  },
]

// 4. Employee Municipality Health Cards (155 Total Records Summary)
export const HEALTH_CARDS_SAMPLE: HealthCardRecord[] = [
  {
    id: 'HC-01',
    empId: '#2039',
    nameAr: 'إجير ريان بالاتان',
    nameEn: 'Egir Ryan Palatan',
    jobTitleAr: 'مشرف فرع مناوب',
    jobTitleEn: 'Branch Shift Supervisor',
    branchNameAr: 'فرع مجمع الأفنيوز',
    branchNameEn: 'The Avenues Mall',
    civilId: '291040801234',
    cardNo: 'HC-KW-2025-10492',
    issueDate: '15/08/2025',
    expiryDate: '15/08/2027',
    daysRemaining: 650,
    statusAr: 'ساري ومطابق',
    statusEn: 'Valid & Active',
  },
  {
    id: 'HC-02',
    empId: '#1974',
    nameAr: 'آنا كاثرين',
    nameEn: 'Anna Catherine',
    jobTitleAr: 'كاشير ومقدم طلبات',
    jobTitleEn: 'Cashier & Server',
    branchNameAr: 'فرع مجمع الأفنيوز',
    branchNameEn: 'The Avenues Mall',
    civilId: '294021203456',
    cardNo: 'HC-KW-2025-09821',
    issueDate: '22/09/2025',
    expiryDate: '22/09/2027',
    daysRemaining: 688,
    statusAr: 'ساري ومطابق',
    statusEn: 'Valid & Active',
  },
  {
    id: 'HC-03',
    empId: '#2042',
    nameAr: 'ربيع أنيس يحيى',
    nameEn: 'Rabie Anis Yehia',
    jobTitleAr: 'فني صيانة وتبريد وتكييف',
    jobTitleEn: 'Refrigeration Maintenance Tech',
    branchNameAr: 'المطبخ المركزي',
    branchNameEn: 'Central Kitchen',
    civilId: '284032109845',
    cardNo: 'HC-KW-2025-07412',
    issueDate: '18/04/2025',
    expiryDate: '18/04/2027',
    daysRemaining: 531,
    statusAr: 'ساري ومطابق',
    statusEn: 'Valid & Active',
  },
  {
    id: 'HC-04',
    empId: '#1850',
    nameAr: 'محمد حنيف أكبر',
    nameEn: 'Mohammad Hanif Akbar',
    jobTitleAr: 'طاهي رئيسي - برجر وستيك',
    jobTitleEn: 'Head Grill Chef',
    branchNameAr: 'فرع السالمية',
    branchNameEn: 'Salmiya Branch',
    civilId: '288061502391',
    cardNo: 'HC-KW-2024-11823',
    issueDate: '30/11/2024',
    expiryDate: '30/11/2026',
    daysRemaining: 26,
    statusAr: 'تنبيه تجديد (أقل من 30 يوماً)',
    statusEn: 'Renewal Pending (<30d)',
  },
  {
    id: 'HC-05',
    empId: '#1902',
    nameAr: 'سليم مياه خان',
    nameEn: 'Salim Miah Khan',
    jobTitleAr: 'مسؤول خلطات وتتبيل المطبخ المركزي',
    jobTitleEn: 'Central Prep Lead',
    branchNameAr: 'المطبخ المركزي',
    branchNameEn: 'Central Kitchen',
    civilId: '287110405128',
    cardNo: 'HC-KW-2025-08144',
    issueDate: '14/06/2025',
    expiryDate: '14/06/2027',
    daysRemaining: 588,
    statusAr: 'ساري ومطابق',
    statusEn: 'Valid & Active',
  },
  {
    id: 'HC-06',
    empId: '#1933',
    nameAr: 'راجيش كومار باتيل',
    nameEn: 'Rajesh Kumar Patel',
    jobTitleAr: 'شيف شاورما ومعلم مقبلات',
    jobTitleEn: 'Shawarma Chef',
    branchNameAr: 'فرع الفروانية',
    branchNameEn: 'Farwaniya Branch',
    civilId: '290071904512',
    cardNo: 'HC-KW-2025-12004',
    issueDate: '05/10/2025',
    expiryDate: '05/10/2027',
    daysRemaining: 701,
    statusAr: 'ساري ومطابق',
    statusEn: 'Valid & Active',
  },
  {
    id: 'HC-07',
    empId: '#1884',
    nameAr: 'كارلوس إدواردو',
    nameEn: 'Carlos Eduardo',
    jobTitleAr: 'مساعد شيف ومسؤول قلي',
    jobTitleEn: 'Line Cook & Fryer',
    branchNameAr: 'فرع الكوت مول',
    branchNameEn: 'Al-Kout Mall',
    civilId: '293090801948',
    cardNo: 'HC-KW-2024-12903',
    issueDate: '04/12/2024',
    expiryDate: '04/12/2026',
    daysRemaining: 30,
    statusAr: 'تنبيه تجديد (أقل من 30 يوماً)',
    statusEn: 'Renewal Pending (<30d)',
  },
  {
    id: 'HC-08',
    empId: '#1955',
    nameAr: 'محمد شمس الدين',
    nameEn: 'Mohammad Shamsuddin',
    jobTitleAr: 'طاهي دجاج كرسبي ومقبلات',
    jobTitleEn: 'Crispy Chicken Chef',
    branchNameAr: 'فرع العارضية',
    branchNameEn: 'Ardiya Branch',
    civilId: '289052003812',
    cardNo: 'HC-KW-2025-11029',
    issueDate: '11/11/2025',
    expiryDate: '11/11/2027',
    daysRemaining: 738,
    statusAr: 'ساري ومطابق',
    statusEn: 'Valid & Active',
  },
  {
    id: 'HC-09',
    empId: '#1980',
    nameAr: 'جوناثان رييس',
    nameEn: 'Jonathan Reyes',
    jobTitleAr: 'مشرف صالة ومقدم طلبات',
    jobTitleEn: 'Dining Floor Supervisor',
    branchNameAr: 'فرع مجمع مروج',
    branchNameEn: 'Murrouj Complex',
    civilId: '292081402851',
    cardNo: 'HC-KW-2025-10332',
    issueDate: '01/09/2025',
    expiryDate: '01/09/2027',
    daysRemaining: 667,
    statusAr: 'ساري ومطابق',
    statusEn: 'Valid & Active',
  },
  {
    id: 'HC-10',
    empId: '#1992',
    nameAr: 'أحمد محمود العوضي',
    nameEn: 'Ahmed Mahmoud Al-Awadi',
    jobTitleAr: 'معد مشروبات وشاي كرك',
    jobTitleEn: 'Barista & Tea Master',
    branchNameAr: 'فرع حولي',
    branchNameEn: 'Hawally Branch',
    civilId: '295031101994',
    cardNo: 'HC-KW-2025-06519',
    issueDate: '12/03/2025',
    expiryDate: '12/03/2027',
    daysRemaining: 494,
    statusAr: 'ساري ومطابق',
    statusEn: 'Valid & Active',
  },
]

// 5. Standard Shelf-Life Matrix Rules for Tab 5
export const SHELF_LIFE_ITEMS = [
  { code: 'PP03-BF01', nameAr: 'ستيك ريب آي أنجوس متبل ومعتق', nameEn: 'Marinated Angus Ribeye', categoryAr: 'اللحوم والدواجن النيئة', hoursChiller: 72, hoursFreezer: 720, keepTempAr: '+1 إلى +2 درجة مئوية', alertHours: 6 },
  { code: 'PP03-CGS', nameAr: 'صوص كانتون السري (المطبخ المركزي)', nameEn: 'China Garden Canton Secret Sauce', categoryAr: 'الصوصات والتتبيلات', hoursChiller: 120, hoursFreezer: 1440, keepTempAr: '+2 إلى +4 درجة مئوية', alertHours: 12 },
  { code: 'PP03-TRF', nameAr: 'مايونيز الترافل الأسود الفاخر', nameEn: 'Black Truffle Gourmet Mayo', categoryAr: 'الصوصات والتتبيلات', hoursChiller: 96, hoursFreezer: 0, keepTempAr: '+2 إلى +4 درجة مئوية', alertHours: 8 },
  { code: 'PP03-POT', nameAr: 'بطاطا مهروسة متبلة بالكريمة', nameEn: 'Mashed Potato CK Prep', categoryAr: 'التحضيرات المطبوخة', hoursChiller: 48, hoursFreezer: 0, keepTempAr: '+2 إلى +3 درجة مئوية', alertHours: 4 },
  { code: 'PP03-SNS', nameAr: 'صوص سويت آند سور الكلاسيكي', nameEn: 'Sweet & Sour Classic Sauce', categoryAr: 'الصوصات والتتبيلات', hoursChiller: 144, hoursFreezer: 1440, keepTempAr: '+2 إلى +4 درجة مئوية', alertHours: 12 },
  { code: 'PP03-TEA', nameAr: 'شاي كرك مجهز مسبقاً المركز', nameEn: 'Concentrated Karak Tea Base', categoryAr: 'المشروبات والسوائل', hoursChiller: 36, hoursFreezer: 0, keepTempAr: '+2 إلى +4 درجة مئوية', alertHours: 4 },
]

export default function FoodSafetyHub() {
  const { locale } = useI18n()
  const isAr = locale === 'ar'

  const [activeTab, setActiveTab] = useState<SafetyTab>('cold')
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL')
  const [healthCardSearch, setHealthCardSearch] = useState<string>('')
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  // Filtered Cold Units
  const filteredColdUnits = useMemo(() => {
    if (selectedBranchFilter === 'ALL') return COLD_UNITS_DATA
    return COLD_UNITS_DATA.filter((u) => u.branchId === selectedBranchFilter)
  }, [selectedBranchFilter])

  // Filtered Health Cards
  const filteredHealthCards = useMemo(() => {
    const q = healthCardSearch.trim().toLowerCase()
    if (!q) return HEALTH_CARDS_SAMPLE
    return HEALTH_CARDS_SAMPLE.filter(
      (h) =>
        h.nameAr.toLowerCase().includes(q) ||
        h.nameEn.toLowerCase().includes(q) ||
        h.civilId.includes(q) ||
        h.cardNo.toLowerCase().includes(q) ||
        h.branchNameAr.includes(q) ||
        h.empId.includes(q),
    )
  }, [healthCardSearch])

  // Quick Action feedback
  const showNotice = (msg: string) => {
    setActionNotice(msg)
    setTimeout(() => setActionNotice(null), 5000)
  }

  return (
    <div className="w-full max-w-none space-y-6 text-slate-900 dark:text-slate-100 font-sans" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 sm:p-8 shadow-2xl">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 w-full max-w-none">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold text-cyan-300">
              <ShieldCheck size={14} className="text-cyan-400" />
              <span>
                {isAr
                  ? 'منظومة الرقابة الصحية وسلامة الغذاء المعيارية · شركة فنتشر فودز ذ.م.م.'
                  : 'Venture Foods Food Safety & Cold-Chain Governance Hub'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {isAr
                ? 'منظومة سلامة الغذاء ومراقبة درجات التبريد والرقابة الصحية'
                : 'Food Safety, Cold-Chain Monitoring & Health Compliance'}
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              {isAr
                ? 'الرصد اللحظي لثلاجات وغرف تبريد الفروع الـ 9 والمطبخ المركزي، سجلات الفحص اليومي لبلدية الكويت والهيئة العامة للغذاء، وصيانة معدات التبريد'
                : 'Real-time telemetry for 9 operating branches + Central Kitchen, municipal hygiene compliance, and refrigeration engineering maintenance.'}
            </p>
          </div>

          {/* Quick Header Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/erp"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              <span>🏠</span>
              <span>{isAr ? 'العودة للوحة القيادة' : 'Back to Dashboard'}</span>
            </Link>
            <ThemeToggle className="shadow-lg" />
            <a
              href={isAr ? '/en/erp/food-safety' : '/erp/food-safety'}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              <span>🌐</span>
              <span>{isAr ? 'EN' : 'عربي'}</span>
            </a>
          </div>
        </div>

        {/* Global Key Performance Indicators (5 Wide Columns) */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300">
                {isAr ? 'وحدات التبريد النشطة' : 'Active Cold Units'}
              </span>
              <Thermometer size={16} className="text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl font-black text-white font-mono">12</div>
            <div className="text-[11px] text-cyan-200/70 mt-0.5">
              {isAr ? 'الفروع الـ 9 + المطبخ المركزي' : '9 Branches + Central Kitchen'}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300">
                {isAr ? 'استقرار درجات الحرارة' : 'Cold Stability'}
              </span>
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-400 font-mono">100%</div>
            <div className="text-[11px] text-emerald-200/70 mt-0.5">
              {isAr ? 'مطابقة تامة للمواصفات' : 'Fully within safe limits'}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300">
                {isAr ? 'فني الصيانة والتبريد' : 'Refrigeration Lead'}
              </span>
              <Wrench size={16} className="text-amber-400" />
            </div>
            <div className="mt-2 text-lg font-black text-white truncate">ربيع أنيس يحيى</div>
            <div className="text-[11px] text-amber-200/70 mt-0.5">
              {isAr ? 'معتمد في أودو (#2042)' : 'Odoo Tech ID: #2042'}
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300">
                {isAr ? 'كروت صحة البلدية' : 'Health Cards'}
              </span>
              <CreditCard size={16} className="text-indigo-400" />
            </div>
            <div className="mt-2 text-2xl font-black text-white font-mono">155</div>
            <div className="text-[11px] text-indigo-200/70 mt-0.5">
              {isAr ? '148 سارية · 7 تجديد' : '148 Valid · 7 In-Renewal'}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-2xl border border-purple-500/20 bg-purple-950/20 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300">
                {isAr ? 'مخالفات الرقابة' : 'Municipality Fines'}
              </span>
              <ShieldCheck size={16} className="text-purple-400" />
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-400 font-mono">0</div>
            <div className="text-[11px] text-purple-200/70 mt-0.5">
              {isAr ? 'سجل نظيف ومعتمد 100%' : 'Clean regulatory record'}
            </div>
          </div>
        </div>
      </div>

      {/* Notice Banner */}
      {actionNotice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-4 text-sm font-bold text-emerald-300 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span>{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-xs text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs (5 Tabs with Pure Arabic Labels) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          {
            id: 'cold' as SafetyTab,
            icon: Thermometer,
            labelAr: '❄️ الرصد اللحظي لدرجات حرارة الثلاجات وغرف التبريد (الفروع الـ 9 والمطبخ المركزي)',
            labelEn: '❄️ Live Cold-Chain Telemetry (9 Branches + Central Kitchen)',
            count: 12,
          },
          {
            id: 'maintenance' as SafetyTab,
            icon: Wrench,
            labelAr: '🛠️ سجل أعطال وصيانة الثلاجات والفلاتر ومصائد الشحوم (تقارير ربيع أنيس يحيى - أودو)',
            labelEn: '🛠️ Refrigeration & Filter Maintenance Log (Rabie Anis - Odoo)',
            count: 6,
          },
          {
            id: 'inspection' as SafetyTab,
            icon: ClipboardCheck,
            labelAr: '📋 سجل التفتيش والرقابة الصحية اليومية (معايير بلدية الكويت وهيئة الغذاء)',
            labelEn: '📋 Daily Hygiene & Municipality Inspection Checklist',
            count: 6,
          },
          {
            id: 'healthCards' as SafetyTab,
            icon: CreditCard,
            labelAr: '🪪 سجل كروت صحة العاملين ومطابقة البلدية (155 معاملة)',
            labelEn: '🪪 Staff Health Cards Registry (155 Records)',
            count: 155,
          },
          {
            id: 'shelfLife' as SafetyTab,
            icon: Layers,
            labelAr: '🏷️ مصفوفة الصلاحيات وإصدار ملصقات الباركود والتحضير',
            labelEn: '🏷️ Shelf-Life Matrix & Barcode Label Printing',
            count: 6,
          },
        ].map((t) => {
          const Icon = t.icon
          const isActive = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/30'
                  : 'bg-white dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Icon size={16} />
              <span>{isAr ? t.labelAr : t.labelEn}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {t.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: Live Cold-Chain Telemetry (9 Branches + Central Kitchen) */}
      {/* ========================================================= */}
      {activeTab === 'cold' && (
        <div className="space-y-6">
          {/* Quick Branch Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-cyan-600 dark:text-cyan-400" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {isAr ? 'تصفية الفروع النشطة:' : 'Filter Active Branches:'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', labelAr: 'الكل (جميع الفروع الـ 9 والمطبخ)', labelEn: 'All Locations' },
                { id: 'CK-QURAIN', labelAr: 'المطبخ المركزي', labelEn: 'Central Kitchen' },
                { id: 'AVENUES', labelAr: 'مجمع الأفنيوز', labelEn: 'The Avenues' },
                { id: 'MURROUJ', labelAr: 'مجمع مروج', labelEn: 'Murrouj' },
                { id: 'SALMIYA', labelAr: 'السالمية', labelEn: 'Salmiya' },
                { id: 'FARWANIYA', labelAr: 'الفروانية', labelEn: 'Farwaniya' },
                { id: 'QURAIN', labelAr: 'مبارك الكبير', labelEn: 'Mubarak Al-Kabeer' },
                { id: 'KHAIRAN', labelAr: 'الخيران', labelEn: 'Khairan' },
                { id: 'ALKOUT', labelAr: 'الكوت مول', labelEn: 'Al-Kout' },
                { id: 'ARDIYA', labelAr: 'العارضية', labelEn: 'Ardiya' },
                { id: 'HAWALLY', labelAr: 'حولي', labelEn: 'Hawally' },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBranchFilter(b.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    selectedBranchFilter === b.id
                      ? 'bg-cyan-500 text-black shadow-md'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
                  }`}
                >
                  {isAr ? b.labelAr : b.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Cold Units Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredColdUnits.map((unit) => {
              const isFreezer = unit.targetTempC <= -10
              const isSafe = unit.currentTempC >= unit.minSafeC && unit.currentTempC <= unit.maxSafeC
              return (
                <div
                  key={unit.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl hover:border-slate-700 transition space-y-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold text-cyan-400">
                        {isAr ? unit.branchNameAr : unit.branchNameEn}
                      </span>
                      <h3 className="text-sm font-black text-white mt-0.5">
                        {isAr ? unit.unitNameAr : unit.unitNameEn}
                      </h3>
                      <span className="inline-block mt-1 rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                        {isAr ? unit.typeAr : unit.typeEn}
                      </span>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold font-mono ${
                        isSafe
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {isSafe
                        ? isAr
                          ? '🟢 سليم ومستقر'
                          : 'Safe & Stable'
                        : isAr
                        ? '🔴 يحتاج فحص'
                        : 'Alert'}
                    </span>
                  </div>

                  {/* Temperature Display */}
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950 p-4 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">
                        {isAr ? 'درجة الحرارة اللحظية' : 'Live Current Temp'}
                      </div>
                      <div
                        className={`text-2xl font-black font-mono mt-0.5 ${
                          isFreezer ? 'text-cyan-400' : 'text-emerald-400'
                        }`}
                      >
                        {unit.currentTempC > 0 ? `+${unit.currentTempC.toFixed(1)}` : unit.currentTempC.toFixed(1)}{' '}
                        <span className="text-xs font-sans font-bold text-slate-300">
                          {isAr ? 'درجة مئوية' : '°C'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right text-xs space-y-1">
                      <div className="text-slate-400">
                        {isAr ? 'المعيار المستهدف:' : 'Target:'}{' '}
                        <strong className="text-white font-mono">
                          {unit.targetTempC > 0 ? `+${unit.targetTempC}` : unit.targetTempC}{' '}
                          {isAr ? 'مئوية' : '°C'}
                        </strong>
                      </div>
                      <div className="text-slate-400">
                        {isAr ? 'النطاق الآمن:' : 'Safe Range:'}{' '}
                        <span className="text-slate-300 font-mono text-[11px]">
                          {unit.minSafeC} إلى {unit.maxSafeC}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Sensors & Telemetry Specs */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-slate-950/60 p-2">
                      <div className="text-[10px] text-slate-400">{isAr ? 'حالة الباب' : 'Door'}</div>
                      <div className="text-white font-bold mt-0.5">
                        {unit.doorStatus === 'closed'
                          ? isAr
                            ? '🔒 مغلق'
                            : 'Closed'
                          : isAr
                          ? '⚠️ مفتوح'
                          : 'Open'}
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-950/60 p-2">
                      <div className="text-[10px] text-slate-400">{isAr ? 'الرطوبة النسبية' : 'Humidity'}</div>
                      <div className="text-cyan-300 font-bold font-mono mt-0.5">{unit.humidityPct}%</div>
                    </div>
                    <div className="rounded-lg bg-slate-950/60 p-2">
                      <div className="text-[10px] text-slate-400">{isAr ? 'بطارية الحساس' : 'Sensor'}</div>
                      <div className="text-emerald-400 font-bold font-mono mt-0.5">{unit.sensorBattery}%</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {unit.lastTelemetry}
                    </span>
                    <button
                      onClick={() =>
                        showNotice(
                          isAr
                            ? `تم إرسال إشارة إعادة المعايرة بنجاح لوحدة: ${unit.unitNameAr}`
                            : `Recalibration signal sent for ${unit.unitNameEn}`,
                        )
                      }
                      className="text-cyan-400 hover:text-cyan-300 font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={12} />
                      {isAr ? 'إعادة فحص' : 'Re-ping'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: Maintenance Log (Rabie Anis Yehia #2042 - Odoo) */}
      {/* ========================================================= */}
      {activeTab === 'maintenance' && (
        <div className="space-y-6">
          {/* Technician Profile Card */}
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-950 p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black text-xl">
                👨‍🔧
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-white">ربيع أنيس يحيى</h3>
                  <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-xs font-mono font-bold text-amber-300">
                    رقم الموظف: #2042
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  {isAr
                    ? 'فني صيانة وتبريد وتكييف وصيانة عامة معتمد لشركة فنتشر فودز (مسجل بنظام أودو hr.employee)'
                    : 'Certified Refrigeration & HVAC Technician for Venture Foods W.L.L. (Odoo HR registered)'}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-amber-400/90 mt-2 font-bold">
                  <span>📞 اتصال الطوارئ: 965-98765432+</span>
                  <span>📍 النطاق: جميع الفروع الـ 9 والمطبخ المركزي</span>
                  <span>⚡ الاستجابة الميدانية: أقل من 45 دقيقة</span>
                </div>
              </div>
            </div>

            <button
              onClick={() =>
                showNotice(
                  isAr
                    ? 'تم فتح نموذج تسجيل بلاغ صيانة جديد وتعيين ربيع أنيس يحيى كفني مكلف'
                    : 'New maintenance ticket opened assigned to Rabie Anis',
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-black transition hover:bg-amber-400 shadow-lg cursor-pointer"
            >
              <Plus size={16} />
              <span>{isAr ? 'تسجيل أمر صيانة أو عطل ثلاجة جديد' : 'New Maintenance Order'}</span>
            </button>
          </div>

          {/* Maintenance Records Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold">
                  <th className="py-3 px-4">{isAr ? 'رقم أمر العمل (أودو)' : 'Odoo WO#'}</th>
                  <th className="py-3 px-4">{isAr ? 'الفرع والموقع' : 'Branch / Location'}</th>
                  <th className="py-3 px-4">{isAr ? 'المعدة الخاضعة للصيانة' : 'Equipment'}</th>
                  <th className="py-3 px-4">{isAr ? 'نوع الإجراء' : 'Service Type'}</th>
                  <th className="py-3 px-4">{isAr ? 'تاريخ التنفيذ' : 'Date'}</th>
                  <th className="py-3 px-4">{isAr ? 'التكلفة (د.ك)' : 'Cost (KWD)'}</th>
                  <th className="py-3 px-4">{isAr ? 'الحالة والمعايرة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {MAINTENANCE_RECORDS_DATA.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-amber-400">{rec.odooWorkOrderId}</td>
                    <td className="py-3 px-4 font-bold text-white">
                      {isAr ? rec.branchNameAr : rec.branchNameEn}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-200">
                      {isAr ? rec.equipmentNameAr : rec.equipmentNameEn}
                    </td>
                    <td className="py-3 px-4">
                      <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-cyan-300">
                        {isAr ? rec.actionTypeAr : rec.actionTypeEn}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">{rec.date}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                      {rec.costKwd.toFixed(3)} {isAr ? 'د.ك' : 'KWD'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold">
                        {isAr ? rec.statusAr : rec.statusEn}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: Daily Hygiene & Municipality Inspection Checklist */}
      {/* ========================================================= */}
      {activeTab === 'inspection' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white sm:text-lg flex items-center gap-2">
                <ClipboardCheck size={20} className="text-cyan-400" />
                <span>
                  {isAr
                    ? 'سجل التفتيش اليومي المعتمد لبلدية الكويت والهيئة العامة للغذاء والتغذية'
                    : 'Kuwait Municipality & Food Authority Daily Inspection Protocols'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {isAr
                  ? 'قوائم التحقق الإلزامية للمشرفين: فصل اللحوم، النظافة والتعقيم، معايرة الموازين، واختبار زيوت القلي'
                  : 'Mandatory daily shift audit protocols verified across all 9 operational restaurants.'}
              </p>
            </div>

            <button
              onClick={() =>
                showNotice(
                  isAr
                    ? 'تم اعتماد وتثبيت نتائج التفتيش الصحي الصباحي لكافة الفروع بنجاح'
                    : 'Morning hygiene audit results validated for all branches',
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500 transition shadow-md cursor-pointer"
            >
              <CheckCircle2 size={16} />
              <span>{isAr ? 'اعتماد التفتيش الصحي اليومي' : 'Approve Daily Inspection'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {INSPECTION_PROTOCOLS_DATA.map((proto) => (
              <div
                key={proto.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-black text-white leading-snug">
                    {isAr ? proto.titleAr : proto.titleEn}
                  </h4>
                  <span className="shrink-0 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-xs font-mono font-bold">
                    {proto.complianceScore}%
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  {isAr ? proto.standardAr : proto.standardEn}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[11px]">
                  <span className="text-emerald-400 font-bold">{isAr ? proto.statusAr : proto.titleEn}</span>
                  <span className="text-slate-400">{proto.lastAudited}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: Staff Health Cards Registry (155 Records) */}
      {/* ========================================================= */}
      {activeTab === 'healthCards' && (
        <div className="space-y-6">
          {/* Health Cards Summary Bar */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-white sm:text-lg flex items-center gap-2">
                <CreditCard size={20} className="text-indigo-400" />
                <span>
                  {isAr
                    ? 'سجل كروت صحة العاملين لشركة فنتشر فودز (155 معاملة مسجلة)'
                    : 'Venture Foods Staff Municipality Health Cards (155 Records)'}
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                {isAr
                  ? 'الصادرة من إدارة تفتيش الأغذية وصحة الموانئ - وزارة الصحة / بلدية الكويت مع التنبيه التلقائي قبل الانتهاء بـ 30 يوماً'
                  : 'Issued by Food Inspection & Port Health Department - Ministry of Health / Municipality.'}
              </p>
            </div>

            {/* Quick Search */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute right-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={healthCardSearch}
                  onChange={(e) => setHealthCardSearch(e.target.value)}
                  placeholder={isAr ? 'بحث بالاسم، الرقم المدني، الفرع...' : 'Search by name, civil ID, branch...'}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2 pr-9 pl-4 text-xs text-white placeholder-slate-500 focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <button
                onClick={() =>
                  showNotice(
                    isAr
                      ? 'تم تصدير تقرير كروت الصحة (155 موظف) جاهز للطباعة والتقديم لمفتش البلدية'
                      : 'Exported Health Cards Registry (155 staff) for Municipality inspection',
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 transition cursor-pointer"
              >
                <Download size={14} />
                <span>{isAr ? 'تصدير التقرير' : 'Export'}</span>
              </button>
            </div>
          </div>

          {/* Health Cards Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold">
                  <th className="py-3 px-4">{isAr ? 'الموظف' : 'Employee'}</th>
                  <th className="py-3 px-4">{isAr ? 'المسمى الوظيفي' : 'Job Title'}</th>
                  <th className="py-3 px-4">{isAr ? 'الفرع' : 'Branch'}</th>
                  <th className="py-3 px-4">{isAr ? 'الرقم المدني' : 'Civil ID'}</th>
                  <th className="py-3 px-4">{isAr ? 'رقم كرت الصحة' : 'Health Card#'}</th>
                  <th className="py-3 px-4">{isAr ? 'تاريخ الانتهاء' : 'Expiry Date'}</th>
                  <th className="py-3 px-4">{isAr ? 'المتبقي' : 'Days Left'}</th>
                  <th className="py-3 px-4">{isAr ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredHealthCards.map((card) => {
                  const isNearExpiry = card.daysRemaining <= 30
                  return (
                    <tr key={card.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-bold text-white">
                        <div>{isAr ? card.nameAr : card.nameEn}</div>
                        <span className="text-[10px] text-slate-400 font-mono">{card.empId}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {isAr ? card.jobTitleAr : card.jobTitleEn}
                      </td>
                      <td className="py-3 px-4 text-cyan-300 font-semibold">
                        {isAr ? card.branchNameAr : card.branchNameEn}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">{card.civilId}</td>
                      <td className="py-3 px-4 font-mono text-amber-400 font-bold">{card.cardNo}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">{card.expiryDate}</td>
                      <td className="py-3 px-4 font-mono font-bold">
                        <span className={isNearExpiry ? 'text-amber-400' : 'text-emerald-400'}>
                          {card.daysRemaining} {isAr ? 'يوم' : 'days'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isNearExpiry
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {isAr ? card.statusAr : card.statusEn}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: Shelf-Life Matrix & Brother DK-2205 Label Printing */}
      {/* ========================================================= */}
      {activeTab === 'shelfLife' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white sm:text-lg flex items-center gap-2">
                <Layers size={20} className="text-purple-400" />
                <span>
                  {isAr
                    ? 'مصفوفة الصلاحيات المعيارية وإصدار ملصقات الباركود والتحضير'
                    : 'Standard Shelf-Life Matrix & Barcode Prep Labels'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {isAr
                  ? 'طباعة ملصقات Brother DK-2205 (عرض 62 مم) مع حساب تاريخ ووقت الانتهاء التلقائي لكل خلطة وصوص'
                  : 'Brother DK-2205 label generation with automated shelf-life expiration calculation.'}
              </p>
            </div>

            <button
              onClick={() =>
                showNotice(
                  isAr
                    ? 'تم إرسال أمر طباعة الملصق المعياري إلى طابعة Brother DK-2205 المربوطة بنجاح'
                    : 'Sent print command to connected Brother DK-2205 label printer',
                )
              }
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 transition shadow-md cursor-pointer"
            >
              <Printer size={16} />
              <span>{isAr ? 'طباعة ملصق تحضير Brother (62 مم)' : 'Print Brother Label (62mm)'}</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/80 shadow-xl">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold">
                  <th className="py-3 px-4">{isAr ? 'كود الصنف' : 'SKU'}</th>
                  <th className="py-3 px-4">{isAr ? 'اسم الصنف أو الخلطة' : 'Item Name'}</th>
                  <th className="py-3 px-4">{isAr ? 'التصنيف' : 'Category'}</th>
                  <th className="py-3 px-4">{isAr ? 'صلاحية التبريد' : 'Chiller Hours'}</th>
                  <th className="py-3 px-4">{isAr ? 'صلاحية التجميد' : 'Freezer Hours'}</th>
                  <th className="py-3 px-4">{isAr ? 'حرارة الحفظ الموصى بها' : 'Recommended Temp'}</th>
                  <th className="py-3 px-4">{isAr ? 'تنبيه الاستهلاك المبكر' : 'Early Warning'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {SHELF_LIFE_ITEMS.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition font-sans">
                    <td className="py-3 px-4 font-mono font-bold text-purple-400">{item.code}</td>
                    <td className="py-3 px-4 font-bold text-white">{isAr ? item.nameAr : item.nameEn}</td>
                    <td className="py-3 px-4 text-slate-300">{item.categoryAr}</td>
                    <td className="py-3 px-4 font-mono text-emerald-400 font-bold">
                      {item.hoursChiller} {isAr ? 'ساعة' : 'hours'}
                    </td>
                    <td className="py-3 px-4 font-mono text-cyan-400">
                      {item.hoursFreezer > 0 ? `${item.hoursFreezer} ${isAr ? 'ساعة' : 'hours'}` : isAr ? 'لا يُجمد' : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-slate-200">{item.keepTempAr}</td>
                    <td className="py-3 px-4 font-mono text-amber-400">
                      قبل {item.alertHours} {isAr ? 'ساعات' : 'hours'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
