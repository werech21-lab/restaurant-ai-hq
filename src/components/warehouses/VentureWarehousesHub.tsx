"use client";

import React, { useMemo, useState } from "react";
import {
  Building2,
  Truck,
  ThermometerSnowflake,
  ClipboardCheck,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Download,
  Warehouse,
  ArrowRightLeft,
  Clock,
  ShieldCheck,
  ChevronRight,
  Scale,
  FileSpreadsheet,
} from "lucide-react";

export interface BranchWarehouseCard {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  areaAr: string;
  areaEn: string;
  brandRolesAr: string;
  brandRolesEn: string;
  isCommissary?: boolean;
  stockValueKwd: number;
  skuCount: { raw: number; prep: number; pack: number };
  chillerTemp: string;
  freezerTemp: string;
  managerAr: string;
  managerEn: string;
  readinessScore: number;
}

// 10 Official Locations: 1 Central Kitchen Qurain + 9 Active Branches (No Jahra)
export const OFFICIAL_10_LOCATIONS: BranchWarehouseCard[] = [
  {
    id: "wh-commissary",
    code: "CK-QURAIN",
    nameAr: "المطبخ المركزي والمستودع الرئيسي — أسواق القرين",
    nameEn: "Al-Qurain Central Kitchen & Master Commissary",
    areaAr: "أسواق القرين · محافظة مبارك الكبير",
    areaEn: "Aswaq Al-Qurain · Mubarak Al-Kabeer",
    brandRolesAr: "المركز اللوجستي والإنتاجي الرئيسي لجميع العلامات التجارية الـ 6",
    brandRolesEn: "Central Production & Logistics Hub for all 6 Brands",
    isCommissary: true,
    stockValueKwd: 24150.0,
    skuCount: { raw: 142, prep: 68, pack: 85 },
    chillerTemp: "+2.4°C",
    freezerTemp: "-19.6°C",
    managerAr: "بابو تشاند رانا (#1279) · تارون كومار (#1994)",
    managerEn: "Babu Chand Rana (#1279) · Tarun Kumar (#1994)",
    readinessScore: 99,
  },
  {
    id: "wh-salmiya",
    code: "WH-SALMIYA",
    nameAr: "مخزن ومطبخ فرع السالمية المركزي",
    nameEn: "Salmiya Central Branch Kitchen & Store",
    areaAr: "السالمية · شارع سالم المبارك",
    areaEn: "Salmiya · Salem Al-Mubarak St.",
    brandRolesAr: "متعدد العلامات (فرانكس، شاورما طحينة، تشاينا جاردن، فارم براون)",
    brandRolesEn: "Multi-Brand (Frank's, Tahina, China Garden, Farm Brown)",
    stockValueKwd: 4850.5,
    skuCount: { raw: 24, prep: 18, pack: 22 },
    chillerTemp: "+2.8°C",
    freezerTemp: "-18.5°C",
    managerAr: "أسماء أحمد عبد الرزاق (#1508)",
    managerEn: "Asmaa Ahmed Abdul-Razzaq (#1508)",
    readinessScore: 98,
  },
  {
    id: "wh-ardiya",
    code: "WH-ARDIYA",
    nameAr: "مخزن ومطبخ فرع العارضية اللوجستي",
    nameEn: "Ardiya Logistics Branch & Cloud Kitchen",
    areaAr: "العارضية الحرفية · محافظة الفروانية",
    areaEn: "Ardiya Craft Hub · Farwaniya",
    brandRolesAr: "متعدد العلامات ومطبخ سحابي محوري لخدمة التوصيل",
    brandRolesEn: "Multi-Brand & Central Delivery Cloud Kitchen",
    stockValueKwd: 4320.0,
    skuCount: { raw: 22, prep: 16, pack: 20 },
    chillerTemp: "+3.0°C",
    freezerTemp: "-18.8°C",
    managerAr: "ديليرام أدهيكاري (#1954)",
    managerEn: "Diliram Adhikari (#1954)",
    readinessScore: 97,
  },
  {
    id: "wh-qurain-br",
    code: "WH-QURAIN-BR",
    nameAr: "مخزن فرع أسواق القرين",
    nameEn: "Aswaq Al-Qurain Branch Store",
    areaAr: "أسواق القرين · شارع المطاعم",
    areaEn: "Aswaq Al-Qurain · Restaurant Strip",
    brandRolesAr: "تشاينا جاردن وفارم براون",
    brandRolesEn: "China Garden & Farm Brown",
    stockValueKwd: 3450.25,
    skuCount: { raw: 18, prep: 14, pack: 18 },
    chillerTemp: "+3.1°C",
    freezerTemp: "-18.2°C",
    managerAr: "شيترا بهادر (#1968)",
    managerEn: "Chitra Bahadur (#1968)",
    readinessScore: 96,
  },
  {
    id: "wh-hawalli",
    code: "WH-HAWALLI",
    nameAr: "مخزن فرع بروميناد حولي",
    nameEn: "Hawalli Promenade Mall Branch Store",
    areaAr: "مجمع البروميناد · حولي · شارع تونس",
    areaEn: "The Promenade Mall · Hawalli · Tunis St.",
    brandRolesAr: "تشاينا جاردن وذا نودل بار",
    brandRolesEn: "China Garden & The Noodle Bar",
    stockValueKwd: 3180.0,
    skuCount: { raw: 16, prep: 12, pack: 16 },
    chillerTemp: "+3.2°C",
    freezerTemp: "-18.4°C",
    managerAr: "دونا ماري لونا أفيلا (#2028)",
    managerEn: "Donna Marie Luna Avila (#2028)",
    readinessScore: 96,
  },
  {
    id: "wh-avenues",
    code: "WH-AVENUES",
    nameAr: "مخزن فرع مجمع الأفنيوز — الري",
    nameEn: "The Avenues Mall Branch Store — Al-Rai",
    areaAr: "مجمع الأفنيوز · الري · الدائري الخامس",
    areaEn: "The Avenues Mall · Al-Rai · 5th Ring Road",
    brandRolesAr: "فرانكس وتشاينا جاردن وفارم براون",
    brandRolesEn: "Frank's, China Garden & Farm Brown",
    stockValueKwd: 5920.75,
    skuCount: { raw: 28, prep: 20, pack: 26 },
    chillerTemp: "+2.7°C",
    freezerTemp: "-19.0°C",
    managerAr: "إجير ريان بالاتان (#2039)",
    managerEn: "Eger Ryan Balatan (#2039)",
    readinessScore: 99,
  },
  {
    id: "wh-360mall",
    code: "WH-360MALL",
    nameAr: "مخزن فرع 360 مول — الزهراء",
    nameEn: "360 Mall Branch Store — Al-Zahra",
    areaAr: "مول 360 · جنوب السرة · الزهراء",
    areaEn: "360 Mall · South Surra · Al-Zahra",
    brandRolesAr: "ذا نودل بار وتشاينا جاردن",
    brandRolesEn: "The Noodle Bar & China Garden",
    stockValueKwd: 3840.0,
    skuCount: { raw: 19, prep: 15, pack: 19 },
    chillerTemp: "+3.0°C",
    freezerTemp: "-18.5°C",
    managerAr: "جيري جيركادو تيلاديرو (#1300)",
    managerEn: "Jerry Gercado Teladero (#1300)",
    readinessScore: 97,
  },
  {
    id: "wh-asima",
    code: "WH-ASIMA",
    nameAr: "مخزن فرع العاصمة مول — شرق",
    nameEn: "Al-Assima Mall Branch Store — Sharq",
    areaAr: "العاصمة مول · مدينة الكويت · شرق",
    areaEn: "Al-Assima Mall · Kuwait City · Sharq",
    brandRolesAr: "فرانكس وكرك كافتيريا",
    brandRolesEn: "Frank's & Karak Cafeteria",
    stockValueKwd: 3260.0,
    skuCount: { raw: 17, prep: 13, pack: 17 },
    chillerTemp: "+2.9°C",
    freezerTemp: "-18.7°C",
    managerAr: "بايجو كونومال (#1973)",
    managerEn: "Baiju Kunnammal (#1973)",
    readinessScore: 98,
  },
  {
    id: "wh-kout",
    code: "WH-KOUT",
    nameAr: "مخزن فرع الكوت مول — الفحيحيل",
    nameEn: "Al-Kout Mall Branch Store — Fahaheel",
    areaAr: "الكوت مول · الفحيحيل · الواجهة البحرية",
    areaEn: "Al-Kout Mall · Fahaheel Waterfront",
    brandRolesAr: "فرانكس وشاورما طحينة",
    brandRolesEn: "Frank's & Tahina Shawarma",
    stockValueKwd: 3580.0,
    skuCount: { raw: 18, prep: 14, pack: 18 },
    chillerTemp: "+3.1°C",
    freezerTemp: "-18.6°C",
    managerAr: "كريستينا هيرنانديز (#2088)",
    managerEn: "Cristina Hernandez (#2088)",
    readinessScore: 96,
  },
  {
    id: "wh-farwaniya",
    code: "WH-FARWANIYA",
    nameAr: "مخزن فرع الفروانية",
    nameEn: "Farwaniya Branch Store",
    areaAr: "الفروانية · شارع حبيب مناور",
    areaEn: "Farwaniya · Habib Munawir St.",
    brandRolesAr: "شاورما طحينة وتشاينا جاردن",
    brandRolesEn: "Tahina Shawarma & China Garden",
    stockValueKwd: 2860.0,
    skuCount: { raw: 15, prep: 11, pack: 16 },
    chillerTemp: "+3.3°C",
    freezerTemp: "-18.3°C",
    managerAr: "دان بهادر (#1967)",
    managerEn: "Dan Bahadur (#1967)",
    readinessScore: 95,
  },
];

// Transfers with Goods In-Transit (1139) & Weight Verification
export interface TransferRecord {
  id: string;
  fromNameAr: string;
  fromNameEn: string;
  toNameAr: string;
  toNameEn: string;
  itemsAr: string;
  itemsEn: string;
  dispatchedWeight: string;
  receivedWeight: string;
  varianceNote: string;
  valueKwd: string;
  driverAndTruckAr: string;
  driverAndTruckEn: string;
  glStatusAr: string;
  glStatusEn: string;
  statusCode: "IN_TRANSIT" | "RECEIVED" | "AWAITING_VERIFICATION";
  timestamp: string;
}

export const TRANSFERS_1139_DATA: TransferRecord[] = [
  {
    id: "TR-202611-091",
    fromNameAr: "المطبخ المركزي بالقرين (حساب 1132)",
    fromNameEn: "Central Kitchen Qurain (GL 1132)",
    toNameAr: "فرع مجمع الأفنيوز — الري",
    toNameEn: "The Avenues Mall Branch",
    itemsAr: "150 كجم أنجوس مفروم + 40 لتر ترافل صوص + 800 خبز بريوش",
    itemsEn: "150 KG Angus Minced + 40L Truffle Sauce + 800 Brioche Buns",
    dispatchedWeight: "198.50 كجم",
    receivedWeight: "قيد النقل والتوصيل",
    varianceNote: "بانتظار الوزن على ميزان الفرع الإلكتروني",
    valueKwd: "845.500 د.ك",
    driverAndTruckAr: "سليم مياه خان · شاحنة تبريد رقم #04 (+2.2°C)",
    driverAndTruckEn: "Salim Miah Khan · Chilled Truck #04 (+2.2°C)",
    glStatusAr: "في الطريق (حساب وسيط 1139)",
    glStatusEn: "In-Transit (Interim GL 1139)",
    statusCode: "IN_TRANSIT",
    timestamp: "اليوم 11:30 ص",
  },
  {
    id: "TR-202611-090",
    fromNameAr: "المطبخ المركزي بالقرين (حساب 1132)",
    fromNameEn: "Central Kitchen Qurain (GL 1132)",
    toNameAr: "فرع السالمية المركزي",
    toNameEn: "Salmiya Central Branch",
    itemsAr: "120 كجم صدور دجاج متبلة + 25 سطل ثومية القرين",
    itemsEn: "120 KG Marinated Chicken + 25 Tubs Garlic Sauce",
    dispatchedWeight: "145.00 كجم",
    receivedWeight: "144.80 كجم",
    varianceNote: "فرق تبخر طبيعي 0.20 كجم (ضمن النسبة المسموحة < 0.2%)",
    valueKwd: "412.250 د.ك",
    driverAndTruckAr: "طارق عبد الحليم · شاحنة تبريد رقم #02 (+2.6°C)",
    driverAndTruckEn: "Tariq Abdul-Haleem · Chilled Truck #02 (+2.6°C)",
    glStatusAr: "تم الاستلام والترحيل لمخزون الفرع (حساب 1132)",
    glStatusEn: "Received & Posted to Branch Stock (GL 1132)",
    statusCode: "RECEIVED",
    timestamp: "اليوم 09:45 ص",
  },
  {
    id: "TR-202611-089",
    fromNameAr: "المطبخ المركزي بالقرين (حساب 1132)",
    fromNameEn: "Central Kitchen Qurain (GL 1132)",
    toNameAr: "فرع 360 مول — الزهراء",
    toNameEn: "360 Mall Branch",
    itemsAr: "90 كجم نودلز قمح طازجة + 30 جالون صوص كانتون",
    itemsEn: "90 KG Fresh Wheat Noodles + 30 Gal Canton Sauce",
    dispatchedWeight: "126.00 كجم",
    receivedWeight: "وصلت الشاحنة للفرع",
    varianceNote: "بانتظار تأكيد الوزن وتوقيع المشرف جيري تيلاديرو",
    valueKwd: "310.000 د.ك",
    driverAndTruckAr: "محمد سليم · شاحنة تبريد رقم #08 (+2.8°C)",
    driverAndTruckEn: "Mohamed Salim · Chilled Truck #08 (+2.8°C)",
    glStatusAr: "بانتظار مطابقة الوزن وتأكيد استلام مدير الفرع",
    glStatusEn: "Awaiting Branch Manager Weight Verification",
    statusCode: "AWAITING_VERIFICATION",
    timestamp: "اليوم 10:15 ص",
  },
  {
    id: "TR-202611-088",
    fromNameAr: "المطبخ المركزي بالقرين (حساب 1132)",
    fromNameEn: "Central Kitchen Qurain (GL 1132)",
    toNameAr: "فرع العارضية اللوجستي",
    toNameEn: "Ardiya Logistics Branch",
    itemsAr: "80 كجم ستريبلوين أنجوس مبرد + 50 كرتون علب فرانكس",
    itemsEn: "80 KG Angus Striploin + 50 Cartons Frank's Boxes",
    dispatchedWeight: "115.00 كجم",
    receivedWeight: "115.00 كجم",
    varianceNote: "وزن مطابق تماماً بنسبة 100% بدون أي انحراف",
    valueKwd: "596.000 د.ك",
    driverAndTruckAr: "سليم مياه خان · شاحنة تبريد رقم #04 (+2.1°C)",
    driverAndTruckEn: "Salim Miah Khan · Chilled Truck #04 (+2.1°C)",
    glStatusAr: "تم الاستلام والترحيل لمخزون الفرع (حساب 1132)",
    glStatusEn: "Received & Posted to Branch Stock (GL 1132)",
    statusCode: "RECEIVED",
    timestamp: "أمس 18:30 م",
  },
  {
    id: "TR-202611-087",
    fromNameAr: "المطبخ المركزي بالقرين (حساب 1132)",
    fromNameEn: "Central Kitchen Qurain (GL 1132)",
    toNameAr: "فرع الكوت مول — الفحيحيل",
    toNameEn: "Al-Kout Mall Branch",
    itemsAr: "70 كجم سيخ شاورما دجاج متبل + 18 سطل طحينة صافية",
    itemsEn: "70 KG Marinated Shawarma Skewers + 18 Tubs Tahina",
    dispatchedWeight: "102.50 كجم",
    receivedWeight: "102.40 كجم",
    varianceNote: "فرق طفيف 0.10 كجم معتمد ومطابق للمعايير",
    valueKwd: "378.000 د.ك",
    driverAndTruckAr: "طارق عبد الحليم · شاحنة تبريد رقم #02 (+2.4°C)",
    driverAndTruckEn: "Tariq Abdul-Haleem · Chilled Truck #02 (+2.4°C)",
    glStatusAr: "تم الاستلام والترحيل لمخزون الفرع (حساب 1132)",
    glStatusEn: "Received & Posted to Branch Stock (GL 1132)",
    statusCode: "RECEIVED",
    timestamp: "أمس 16:10 م",
  },
  {
    id: "TR-202611-086",
    fromNameAr: "المطبخ المركزي بالقرين (حساب 1132)",
    fromNameEn: "Central Kitchen Qurain (GL 1132)",
    toNameAr: "فرع العاصمة مول — شرق",
    toNameEn: "Al-Assima Mall Branch",
    itemsAr: "60 كجم لحم مفروم + 400 عجينة شباتي كرك + 10 كجم شاي سيلاني",
    itemsEn: "60 KG Minced Meat + 400 Chapati Dough + 10 KG Ceylon Tea",
    dispatchedWeight: "88.00 كجم",
    receivedWeight: "88.00 كجم",
    varianceNote: "وزن مطابق تماماً بنسبة 100% بدون أي انحراف",
    valueKwd: "298.500 د.ك",
    driverAndTruckAr: "محمد سليم · شاحنة تبريد رقم #08 (+2.7°C)",
    driverAndTruckEn: "Mohamed Salim · Chilled Truck #08 (+2.7°C)",
    glStatusAr: "تم الاستلام والترحيل لمخزون الفرع (حساب 1132)",
    glStatusEn: "Received & Posted to Branch Stock (GL 1132)",
    statusCode: "RECEIVED",
    timestamp: "أمس 14:00 م",
  },
];

// Cold Chain & Telemetry Units across the 10 Locations
export const COLD_CHAIN_UNITS = [
  {
    id: "cc-01",
    locationAr: "المطبخ المركزي — أسواق القرين",
    locationEn: "Central Kitchen — Qurain",
    unitAr: "غرفة التبريد الرئيسية للحوم المبردة #01",
    unitEn: "Main Meat Chiller Room #01",
    typeAr: "غرفة تبريد مركزية",
    currentTemp: "+2.4°C",
    safeRange: "+1.0°C إلى +3.5°C",
    doorStatusAr: "محكم الإغلاق",
    doorStatusEn: "Hermetically Sealed",
    lastReading: "منذ دقيقة واحدة",
    status: "OPTIMAL",
    technician: "سراج الحق (#1844)",
  },
  {
    id: "cc-02",
    locationAr: "المطبخ المركزي — أسواق القرين",
    locationEn: "Central Kitchen — Qurain",
    unitAr: "غرفة التجميد العميق للأغذية #02",
    unitEn: "Deep Freezer Room #02",
    typeAr: "غرفة تجميد عميق",
    currentTemp: "-19.6°C",
    safeRange: "-18.0°C إلى -22.0°C",
    doorStatusAr: "محكم الإغلاق",
    doorStatusEn: "Hermetically Sealed",
    lastReading: "منذ دقيقتين",
    status: "OPTIMAL",
    technician: "سراج الحق (#1844)",
  },
  {
    id: "cc-03",
    locationAr: "مخزن فرع مجمع الأفنيوز — الري",
    locationEn: "The Avenues Mall Branch",
    unitAr: "ثلاجة حفظ اللحوم والتحضيرات اليومية",
    unitEn: "Daily Meat & Prep Chiller",
    typeAr: "براد حفظ مطعم",
    currentTemp: "+2.7°C",
    safeRange: "+1.5°C إلى +4.0°C",
    doorStatusAr: "محكم الإغلاق",
    doorStatusEn: "Sealed",
    lastReading: "منذ 3 دقائق",
    status: "OPTIMAL",
    technician: "إجير ريان بالاتان (#2039)",
  },
  {
    id: "cc-04",
    locationAr: "مخزن ومطبخ فرع السالمية المركزي",
    locationEn: "Salmiya Central Branch",
    unitAr: "براد الصوصات والتتبيلات المجهزة",
    unitEn: "Sauce & Dressing Chiller",
    typeAr: "براد صوصات ومقبلات",
    currentTemp: "+2.8°C",
    safeRange: "+2.0°C إلى +4.5°C",
    doorStatusAr: "محكم الإغلاق",
    doorStatusEn: "Sealed",
    lastReading: "منذ 4 دقائق",
    status: "OPTIMAL",
    technician: "أسماء عبد الرزاق (#1508)",
  },
  {
    id: "cc-05",
    locationAr: "مخزن فرع 360 مول — الزهراء",
    locationEn: "360 Mall Branch",
    unitAr: "ثلاجة النودلز والخضار الطازجة",
    unitEn: "Fresh Noodles & Veg Chiller",
    typeAr: "براد حفظ خضار ونودلز",
    currentTemp: "+3.0°C",
    safeRange: "+2.0°C إلى +4.5°C",
    doorStatusAr: "محكم الإغلاق",
    doorStatusEn: "Sealed",
    lastReading: "منذ 5 دقائق",
    status: "OPTIMAL",
    technician: "جيري تيلاديرو (#1300)",
  },
  {
    id: "cc-06",
    locationAr: "مخزن فرع العاصمة مول — شرق",
    locationEn: "Al-Assima Mall Branch",
    unitAr: "فريزر البرجر والبطاطا المجمدة",
    unitEn: "Burgers & Fries Freezer",
    typeAr: "فريزر تجميد رأسي",
    currentTemp: "-18.7°C",
    safeRange: "-18.0°C إلى -21.0°C",
    doorStatusAr: "محكم الإغلاق",
    doorStatusEn: "Sealed",
    lastReading: "منذ 3 دقائق",
    status: "OPTIMAL",
    technician: "بايجو كونومال (#1973)",
  },
];

// Physical Stock Count & Variance Analysis Data
export const PHYSICAL_COUNT_VARIANCE_DATA = [
  {
    id: "cnt-01",
    code: "RW01-BF03",
    nameAr: "لحم أنجوس مفروم 80/20 للبرجر",
    nameEn: "Angus Minced Beef 80/20",
    locationAr: "المطبخ المركزي — أسواق القرين",
    locationEn: "Central Kitchen — Qurain",
    bookQty: "2,150.00 كجم",
    physicalQty: "2,148.50 كجم",
    varianceQty: "-1.50 كجم",
    varianceValKwd: "-5.700 د.ك",
    variancePct: "-0.07%",
    causeAr: "تبخر طبيعي ورطوبة تبريد معتمدة (تحت حد 0.2%)",
    causeEn: "Normal chill shrinkage",
    auditStatusAr: "معتمد ومسوى مالياً",
    auditStatusEn: "Approved & Reconciled",
    auditorAr: "ربيع أنيس يحيى (فني الجودة)",
  },
  {
    id: "cnt-02",
    code: "RW01-CK01",
    nameAr: "صدور دجاج طازجة مبردة",
    nameEn: "Fresh Chilled Chicken Breast",
    locationAr: "مخزن ومطبخ فرع السالمية",
    locationEn: "Salmiya Branch Store",
    bookQty: "320.00 كجم",
    physicalQty: "320.00 كجم",
    varianceQty: "0.00 كجم",
    varianceValKwd: "0.000 د.ك",
    variancePct: "0.00%",
    causeAr: "مطابق تماماً للميزان الإلكتروني",
    causeEn: "100% Exact Match",
    auditStatusAr: "مطابق ومغلق",
    auditStatusEn: "Verified Exact",
    auditorAr: "أسماء عبد الرزاق (#1508)",
  },
  {
    id: "cnt-03",
    code: "PP03-CGS",
    nameAr: "صوص كانتون الصيني السري (جالون 5 لتر)",
    nameEn: "Canton Secret Sauce (5L Gallon)",
    locationAr: "مخزن فرع بروميناد حولي",
    locationEn: "Hawalli Promenade Store",
    bookQty: "14 جالون",
    physicalQty: "14 جالون",
    varianceQty: "0 جالون",
    varianceValKwd: "0.000 د.ك",
    variancePct: "0.00%",
    causeAr: "مطابق للرصيد الدفتري",
    causeEn: "100% Exact Match",
    auditStatusAr: "مطابق ومغلق",
    auditStatusEn: "Verified Exact",
    auditorAr: "دونا ماري أفيلا (#2028)",
  },
  {
    id: "cnt-04",
    code: "PK02-STK",
    nameAr: "علب ستيك حرارية فاخرة فرانكس (كرتون 250)",
    nameEn: "Frank's Steak Thermal Boxes (Box 250)",
    locationAr: "مخزن فرع مجمع الأفنيوز",
    locationEn: "The Avenues Mall Store",
    bookQty: "45 كرتون",
    physicalQty: "44 كرتون",
    varianceQty: "-1 كرتون",
    varianceValKwd: "-55.000 د.ك",
    variancePct: "-2.2%",
    causeAr: "صرف لطلبات المعارض والفعاليات بانتظار قيد الخصم",
    causeEn: "Event consumption pending entry",
    auditStatusAr: "قيد التسوية بالقيد المحاسبي",
    auditStatusEn: "Adjustment Pending",
    auditorAr: "إجير ريان بالاتان (#2039)",
  },
  {
    id: "cnt-05",
    code: "RW01-OIL",
    nameAr: "زيت نباتي نقي للقلي (مطاحن الدقيق)",
    nameEn: "Pure Cooking Oil (KFMB)",
    locationAr: "مخزن فرع العارضية اللوجستي",
    locationEn: "Ardiya Logistics Store",
    bookQty: "280 لتر",
    physicalQty: "280 لتر",
    varianceQty: "0 لتر",
    varianceValKwd: "0.000 د.ك",
    variancePct: "0.00%",
    causeAr: "مطابق للرصيد الفعلي",
    causeEn: "100% Exact Match",
    auditStatusAr: "مطابق ومغلق",
    auditStatusEn: "Verified Exact",
    auditorAr: "ديليرام أدهيكاري (#1954)",
  },
];

export function VentureWarehousesHub({
  locale = "ar",
  liveChildren,
}: {
  locale?: "ar" | "en";
  liveChildren?: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<"locations" | "transfers" | "cold_chain" | "variance" | "legacy">(
    "locations"
  );
  const [currentLocale, setCurrentLocale] = useState<"ar" | "en">(locale);
  const [searchQ, setSearchQ] = useState("");
  const [filterRegion, setFilterRegion] = useState<string>("ALL");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const isAr = currentLocale === "ar";

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 5000);
  };

  // Filtered warehouses across the 10 official locations
  const filteredWarehouses = useMemo(() => {
    return OFFICIAL_10_LOCATIONS.filter((w) => {
      // Region filter
      if (filterRegion === "COMMISSARY" && !w.isCommissary) return false;
      if (
        filterRegion === "CAPITAL_HAWALLY" &&
        !w.areaAr.includes("العاصمة") &&
        !w.areaAr.includes("حولي") &&
        !w.areaAr.includes("السالمية") &&
        !w.areaAr.includes("الري")
      ) {
        return false;
      }
      if (
        filterRegion === "FARWANIYA_MUBARAK" &&
        !w.areaAr.includes("الفروانية") &&
        !w.areaAr.includes("العارضية") &&
        !w.areaAr.includes("مبارك الكبير") &&
        !w.areaAr.includes("الزهراء")
      ) {
        return false;
      }
      if (filterRegion === "AHMADI" && !w.areaAr.includes("الأحمدي") && !w.areaAr.includes("الفحيحيل")) {
        return false;
      }

      if (!searchQ.trim()) return true;
      const q = searchQ.toLowerCase();
      return (
        w.nameAr.toLowerCase().includes(q) ||
        w.nameEn.toLowerCase().includes(q) ||
        w.code.toLowerCase().includes(q) ||
        w.areaAr.toLowerCase().includes(q) ||
        w.managerAr.toLowerCase().includes(q)
      );
    });
  }, [searchQ, filterRegion]);

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="w-full max-w-none text-slate-100 space-y-6 font-sans">
      {/* Top Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
              <Warehouse size={14} />
              {isAr ? "إدارة المستودعات وشبكة الإمداد الداخلي" : "Internal Warehouses & Supply Network"}
            </span>
            <span className="rounded-full bg-slate-800/90 border border-slate-700/80 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
              {isAr ? "المطبخ المركزي بالقرين + 9 فروع نشطة" : "Central Kitchen Qurain + 9 Active Branches"}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl tracking-tight">
            {isAr
              ? "شبكة المستودعات ومخازن الفروع والتحويلات اللوجستية"
              : "Warehouse Network, Branch Stores & Logistics Hub"}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {isAr
              ? "المستودع الرئيسي والمطبخ المركزي بأسواق القرين ومخازن الفروع الـ 9 الرسمية لشركة فنتشر فودز لإدارة المطاعم ذ.م.م. (ترخيص 2021/22838) مع تتبع كامل لحساب البضاعة بالطريق (حساب وسيط 1139)."
              : "Venture Foods Restaurants Management Co. W.L.L. (Lic. 2021/22838) Central Kitchen Qurain and 9 Active Branch Stores with In-Transit GL 1139 Reconciliation."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setCurrentLocale(isAr ? "en" : "ar")}
            className="rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 transition cursor-pointer shadow-sm"
          >
            {isAr ? "English (LTR)" : "عربي (RTL)"}
          </button>
          <button
            onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-black hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Plus size={16} />
            <span>{isAr ? "➕ إنشاء إذن تحويل مخزني داخلي" : "➕ New Internal Transfer"}</span>
          </button>
        </div>
      </div>

      {/* Notice Toast */}
      {notice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/70 p-4 text-xs font-bold text-emerald-300 shadow-xl flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400" />
            {notice}
          </span>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Top 4 Real-Time Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-5 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300">
              {isAr ? "إجمالي تقييم المخزون المتاح" : "Total Available Stock Valuation"}
            </span>
            <Warehouse size={18} className="text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">59,411.500 {isAr ? "د.ك" : "KWD"}</div>
          <p className="text-[11px] text-amber-200/70 mt-1">
            {isAr ? "عبر 10 مواقع رسمية نشطة لشركة فنتشر فودز" : "Across 10 official active Venture Foods locations"}
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-5 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-300">
              {isAr ? "المطبخ المركزي والمستودع الرئيسي (القرين)" : "Central Kitchen & Commissary (Qurain)"}
            </span>
            <Building2 size={18} className="text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-cyan-400 font-mono">24,150.000 {isAr ? "د.ك" : "KWD"}</div>
          <p className="text-[11px] text-cyan-200/70 mt-1">
            {isAr ? "يمثل 40.6% من إجمالي المخزون التشغيلي" : "Represents 40.6% of company operational stock"}
          </p>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-5 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-300">
              {isAr ? "بضاعة بالطريق بين القرين والفروع (1139)" : "Goods In-Transit to Branches (GL 1139)"}
            </span>
            <Truck size={18} className="text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">1,845.250 {isAr ? "د.ك" : "KWD"}</div>
          <p className="text-[11px] text-blue-200/70 mt-1">
            {isAr ? "6 شحنات مبردة جارية بانتظار مطابقة الوزن" : "6 active refrigerated dispatches awaiting scale sign-off"}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300">
              {isAr ? "جاهزية غرف التبريد وسلسلة الإمداد" : "Cold Chain & Chiller Readiness"}
            </span>
            <ShieldCheck size={18} className="text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-400 font-mono">100% {isAr ? "مطابقة" : "Compliant"}</div>
          <p className="text-[11px] text-emerald-200/70 mt-1">
            {isAr ? "رصد آلي مستمر لدرجات الحرارة والحساسات" : "24/7 continuous IoT sensors & telemetry"}
          </p>
        </div>
      </div>

      {/* 4 Specialized Tabs Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {[
          {
            key: "locations",
            labelAr: "🏢 شبكة المستودعات ومخازن الفروع النشطة (10 مواقع)",
            labelEn: "Active Warehouse & Store Network (10 Locations)",
            icon: Building2,
          },
          {
            key: "transfers",
            labelAr: "🚚 التحويلات المخزنية وحساب البضاعة بالطريق (حساب وسيط 1139)",
            labelEn: "Inter-Branch Transfers & In-Transit (GL 1139)",
            icon: Truck,
          },
          {
            key: "cold_chain",
            labelAr: "❄️ رقابة غرف التبريد والتجميد وسلسلة الإمداد المبردة",
            labelEn: "Cold Chain Telemetry & Freezer Rooms",
            icon: ThermometerSnowflake,
          },
          {
            key: "variance",
            labelAr: "📊 الجرد الدوري ومطابقة الانحراف الفعلي مقابل النظري",
            labelEn: "Periodic Stock Count & Variance Analysis",
            icon: ClipboardCheck,
          },
          ...(liveChildren
            ? [
                {
                  key: "legacy",
                  labelAr: "⚙️ مستودعات قاعدة البيانات الحية (Prisma DB)",
                  labelEn: "Live Database Warehouses (Prisma DB)",
                  icon: Warehouse,
                },
              ]
            : []),
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                active
                  ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                  : "bg-slate-900/90 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800"
              }`}
            >
              <Icon size={16} />
              <span>{isAr ? tab.labelAr : tab.labelEn}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: 10 ACTIVE LOCATIONS (COMMISSARY + 9 ACTIVE BRANCHES)                */}
      {/* ========================================================================= */}
      {activeTab === "locations" && (
        <div className="space-y-5 w-full">
          {/* Filters & Search Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-800">
            {/* Search Box */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute top-2.5 start-3 text-slate-500" size={16} />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder={
                  isAr ? "ابحث باسم المستودع، الكود، أو المنطقة..." : "Search warehouse name, code, or area..."
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 ps-9 pe-4 text-xs text-slate-100 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {/* Region Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: "ALL", labelAr: "الكل (10 مواقع)", labelEn: "All (10)" },
                { key: "COMMISSARY", labelAr: "المطبخ المركزي بالقرين (1)", labelEn: "Central Kitchen (1)" },
                { key: "CAPITAL_HAWALLY", labelAr: "العاصمة وحولي (4)", labelEn: "Capital & Hawally (4)" },
                { key: "FARWANIYA_MUBARAK", labelAr: "الفروانية ومبارك الكبير (3)", labelEn: "Farwaniya & Mubarak (3)" },
                { key: "AHMADI", labelAr: "محافظة الأحمدي (2)", labelEn: "Ahmadi (2)" },
              ].map((pill) => (
                <button
                  key={pill.key}
                  onClick={() => setFilterRegion(pill.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    filterRegion === pill.key
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                  }`}
                >
                  {isAr ? pill.labelAr : pill.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Grid: Full Width across Screen (grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full">
            {filteredWarehouses.map((wh) => (
              <div
                key={wh.id}
                className={`flex flex-col justify-between rounded-2xl border p-5 transition-all shadow-md ${
                  wh.isCommissary
                    ? "border-amber-500/50 bg-gradient-to-b from-[#1c1917]/90 to-[#0d131f] ring-1 ring-amber-500/30"
                    : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                }`}
              >
                <div>
                  {/* Top Bar of Card */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <span className="rounded bg-slate-800 px-2.5 py-1 font-mono text-[11px] font-bold text-amber-400" dir="ltr">
                      {wh.code}
                    </span>
                    {wh.isCommissary ? (
                      <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                        {isAr ? "المطبخ المركزي الرئيسي" : "Master Central Kitchen"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                        {isAr ? "مخزن فرع نشط" : "Active Branch Store"}
                      </span>
                    )}
                  </div>

                  {/* Title & Location */}
                  <h3 className="mt-3 text-base font-black text-white leading-snug">
                    {isAr ? wh.nameAr : wh.nameEn}
                  </h3>
                  <p className="text-xs text-amber-300/80 mt-1 font-medium">
                    {isAr ? wh.brandRolesAr : wh.brandRolesEn}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    📍 {isAr ? wh.areaAr : wh.areaEn}
                  </p>

                  {/* Stock Value & Readiness */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-slate-950/70 p-2.5 border border-slate-800/60">
                      <span className="text-[10px] text-slate-400 block">{isAr ? "قيمة المخزون الفعلي" : "Stock Valuation"}</span>
                      <strong className="text-sm font-black text-amber-400 font-mono">
                        {wh.stockValueKwd.toFixed(3)} {isAr ? "د.ك" : "KWD"}
                      </strong>
                    </div>
                    <div className="rounded-xl bg-slate-950/70 p-2.5 border border-slate-800/60">
                      <span className="text-[10px] text-slate-400 block">{isAr ? "الجاهزية التشغيلية" : "Readiness Score"}</span>
                      <strong className="text-sm font-black text-emerald-400 font-mono">
                        {wh.readinessScore}%
                      </strong>
                    </div>
                  </div>

                  {/* Items Breakdown */}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/60 pt-2.5">
                    <span>
                      {isAr ? "مواد خام:" : "Raw:"} <strong className="text-white">{wh.skuCount.raw}</strong>
                    </span>
                    <span>
                      {isAr ? "تحضيرات:" : "Prep:"} <strong className="text-blue-400">{wh.skuCount.prep}</strong>
                    </span>
                    <span>
                      {isAr ? "تغليف:" : "Pack:"} <strong className="text-purple-400">{wh.skuCount.pack}</strong>
                    </span>
                  </div>

                  {/* Chiller & Freezer Telemetry */}
                  <div className="mt-2.5 flex items-center justify-between text-[11px] rounded-xl bg-slate-950/70 p-2.5 border border-slate-800/50">
                    <span className="flex items-center gap-1 text-cyan-400 font-medium">
                      <ThermometerSnowflake size={13} />
                      {isAr ? "المبرد:" : "Chiller:"} <strong className="font-mono">{wh.chillerTemp}</strong>
                    </span>
                    <span className="text-blue-400 font-medium">
                      {isAr ? "المجمد:" : "Freezer:"} <strong className="font-mono">{wh.freezerTemp}</strong>
                    </span>
                  </div>

                  {/* Responsible Manager (Real Odoo Staff) */}
                  <div className="mt-2.5 text-[11px] text-slate-300 bg-slate-800/50 rounded-lg px-2.5 py-1.5 border border-slate-700/40">
                    <span className="text-slate-500 font-semibold">{isAr ? "المسؤول: " : "Supervisor: "}</span>
                    <span className="font-bold text-white">{isAr ? wh.managerAr : wh.managerEn}</span>
                  </div>
                </div>

                {/* Bottom Action */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setShowTransferModal(true);
                    }}
                    className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isAr ? "طلب تزويد لهذا الفرع ←" : "Dispatch Requisition ←"}</span>
                  </button>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {isAr ? "متصل ونشط" : "Online"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GOODS IN-TRANSIT & INTER-BRANCH TRANSFERS (GL 1139)                 */}
      {/* ========================================================================= */}
      {activeTab === "transfers" && (
        <div className="space-y-4 w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white">
                {isAr
                  ? "جدول التحويلات المخزنية ومتابعة حساب البضاعة بالطريق (حساب وسيط 1139)"
                  : "Goods In-Transit & Internal Transfer Reconciliation (Interim GL 1139)"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? "حصر الشحنات الخارجة من المطبخ المركزي بالقرين إلى الفروع الـ 9 مع مطابقة الوزن المحول والمستلم وقيد الترحيل المحاسبي."
                  : "Tracking dispatches from Central Kitchen Qurain to all 9 branches with weight verification and GL posting."}
              </p>
            </div>
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
              {isAr ? "إجمالي الشحنات بالطريق: 1,845.250 د.ك" : "Total In-Transit: 1,845.250 KWD"}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-bold uppercase">
                    <th className="px-4 py-3 text-right">{isAr ? "رقم إذن التحويل" : "Transfer No"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "من مستودع المصدر" : "From Warehouse"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "إلى الفرع المستلم" : "To Branch"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "الأصناف والمواد المحولة" : "Items & Materials"}</th>
                    <th className="px-4 py-3 text-center">{isAr ? "الوزن المرسل" : "Dispatched Wt"}</th>
                    <th className="px-4 py-3 text-center">{isAr ? "الوزن المستلم بالفرع" : "Received Wt"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "القيمة (د.ك)" : "Value (KWD)"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "السائق والشاحنة المبردة" : "Driver / Truck"}</th>
                    <th className="px-4 py-3 text-center">{isAr ? "حالة القيد المحاسبي" : "GL Status"}</th>
                    <th className="px-4 py-3 text-center">{isAr ? "الإجراء" : "Action"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {TRANSFERS_1139_DATA.map((tr) => (
                    <tr key={tr.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-mono font-bold text-amber-400" dir="ltr">
                        {tr.id}
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-medium">
                        {isAr ? tr.fromNameAr : tr.fromNameEn}
                      </td>
                      <td className="px-4 py-3 font-bold text-white">
                        {isAr ? tr.toNameAr : tr.toNameEn}
                      </td>
                      <td className="px-4 py-3 text-slate-300 max-w-xs truncate" title={isAr ? tr.itemsAr : tr.itemsEn}>
                        {isAr ? tr.itemsAr : tr.itemsEn}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-white">
                        {tr.dispatchedWeight}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-emerald-400">
                        {tr.receivedWeight}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-amber-300 text-right">
                        {tr.valueKwd}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-right">
                        {isAr ? tr.driverAndTruckAr : tr.driverAndTruckEn}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                            tr.statusCode === "RECEIVED"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : tr.statusCode === "IN_TRANSIT"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}
                        >
                          {isAr ? tr.glStatusAr : tr.glStatusEn}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {tr.statusCode === "IN_TRANSIT" || tr.statusCode === "AWAITING_VERIFICATION" ? (
                          <button
                            onClick={() =>
                              showToast(
                                isAr
                                  ? `✅ تم تسجيل وزن الشحنة ${tr.id} وتأكيد استلام الفرع وترحيل القيد لحساب 1132 بنجاح`
                                  : `✅ Transfer ${tr.id} weight confirmed and posted to GL 1132`
                              )
                            }
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-black text-white hover:bg-emerald-500 transition cursor-pointer whitespace-nowrap shadow-sm"
                          >
                            {isAr ? "⚖️ تأكيد وزن الفرع" : "Confirm Weight"}
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-semibold">{isAr ? "مرحل ومقفل" : "Posted"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: COLD CHAIN & FREEZER ROOMS TELEMETRY                                */}
      {/* ========================================================================= */}
      {activeTab === "cold_chain" && (
        <div className="space-y-4 w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white">
                {isAr
                  ? "رقابة غرف التبريد والتجميد وسلسلة الإمداد المبردة اللحظية"
                  : "Refrigeration Rooms, Freezers & Cold Chain Telemetry"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? "مراقبة درجات الحرارة اللحظية على مدار الساعة لغرف تبريد المطبخ المركزي بالقرين ومخازن الفروع الـ 9 وشاحنات التوزيع."
                  : "24/7 Real-time IoT temperature monitoring for central kitchen rooms, branch storerooms, and delivery fleet."}
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
              {isAr ? "معتمد 100% وفق اشتراطات بلدية الكويت وهيئة الغذاء" : "100% Municipality & Food Authority Compliant"}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-bold uppercase">
                    <th className="px-4 py-3 text-right">{isAr ? "الموقع / الفرع" : "Location / Branch"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "وحدة التبريد" : "Cooling Unit"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "نوع الوحدة" : "Unit Type"}</th>
                    <th className="px-4 py-3 text-center">{isAr ? "درجة الحرارة الحالية" : "Current Temp"}</th>
                    <th className="px-4 py-3 text-center">{isAr ? "المدى الآمن المعتمد" : "Safe Range"}</th>
                    <th className="px-4 py-3 text-center">{isAr ? "حالة الباب والعزل" : "Door & Seal"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "آخر فحص تيليماتري" : "Last Telemetry"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "فني الصيانة المسؤول" : "Responsible Tech"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {COLD_CHAIN_UNITS.map((unit) => (
                    <tr key={unit.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-bold text-white">
                        {isAr ? unit.locationAr : unit.locationEn}
                      </td>
                      <td className="px-4 py-3 text-amber-300 font-medium">
                        {isAr ? unit.unitAr : unit.unitEn}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {unit.typeAr}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono text-sm font-black text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-800/50">
                          {unit.currentTemp}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-300">
                        {unit.safeRange}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
                          {isAr ? unit.doorStatusAr : unit.doorStatusEn}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-right">
                        {unit.lastReading}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-300 text-right">
                        {unit.technician}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PHYSICAL STOCK COUNT & VARIANCE ANALYSIS                           */}
      {/* ========================================================================= */}
      {activeTab === "variance" && (
        <div className="space-y-4 w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white">
                {isAr
                  ? "محضر الجرد الدوري ومطابقة الانحراف الفعلي مقابل النظري"
                  : "Periodic Stock Count & Variance Analysis"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? "تسوية الفروقات بين الأرصدة الدفترية في أودو والوزن الفعلي بالمستودعات مع توثيق أسباب الانحراف والاعتماد المالي."
                  : "Reconciling Odoo book stock with physical scale counts, documenting variance root causes and GL approvals."}
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
              {isAr ? "نسبة المطابقة العامة: 99.2% (ضمن حدود السماح)" : "Overall Variance Reconciliation Rate: 99.2%"}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-bold uppercase">
                    <th className="px-4 py-3 text-right">{isAr ? "كود الصنف" : "Item Code"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "اسم المادة المخزنية" : "Material Description"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "الموقع / المستودع" : "Warehouse Location"}</th>
                    <th className="px-4 py-3 text-center">{isAr ? "الرصيد الدفتري (أودو)" : "Book Stock"}</th>
                    <th className="px-4 py-3 text-center">{isAr ? "الجرد الفعلي على الميزان" : "Physical Count"}</th>
                    <th className="px-4 py-3 text-center">{isAr ? "فارق الكمية" : "Qty Variance"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "قيمة الفارق (د.ك)" : "Variance Val (KWD)"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "سبب الانحراف المحاسبي" : "Root Cause"}</th>
                    <th className="px-4 py-3 text-center">{isAr ? "حالة الاعتماد المالي" : "Audit Status"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {PHYSICAL_COUNT_VARIANCE_DATA.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-mono font-bold text-amber-400" dir="ltr">
                        {item.code}
                      </td>
                      <td className="px-4 py-3 font-bold text-white">
                        {isAr ? item.nameAr : item.nameEn}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {isAr ? item.locationAr : item.locationEn}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-300">
                        {item.bookQty}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-white">
                        {item.physicalQty}
                      </td>
                      <td
                        className={`px-4 py-3 text-center font-mono font-bold ${
                          item.varianceQty.startsWith("-")
                            ? "text-rose-400"
                            : item.varianceQty === "0.00 كجم" || item.varianceQty === "0 جالون" || item.varianceQty === "0 لتر"
                            ? "text-emerald-400"
                            : "text-blue-400"
                        }`}
                      >
                        {item.varianceQty}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-right text-amber-300">
                        {item.varianceValKwd}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-right">
                        {isAr ? item.causeAr : item.causeEn}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
                          {isAr ? item.auditStatusAr : item.auditStatusEn}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: PRISMA DATABASE WAREHOUSES & TABLES (LIVE CHILDREN)                 */}
      {/* ========================================================================= */}
      {activeTab === "legacy" && liveChildren && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl w-full">
          {liveChildren}
        </div>
      )}

      {/* Internal Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                {isAr
                  ? "إنشاء أمر تحويل مخزني داخلي (المطبخ المركزي بالقرين ← الفروع)"
                  : "Create Internal Transfer Requisition"}
              </h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowTransferModal(false);
                showToast(
                  isAr
                    ? "✅ تم إنشاء أمر التحويل وإدراجه ضمن حساب البضاعة بالطريق (1139) وإخطار سائق الشاحنة المبردة"
                    : "✅ Transfer order created, added to In-Transit (GL 1139) and truck driver notified"
                );
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? "من المستودع المصدر:" : "Source Warehouse:"}
                </label>
                <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-white focus:outline-none">
                  <option value="CK-QURAIN">
                    {isAr
                      ? "المطبخ المركزي والمستودع الرئيسي — أسواق القرين (حساب 1132)"
                      : "Al-Qurain Central Kitchen & Master Commissary"}
                  </option>
                  <option value="WH-SALMIYA">
                    {isAr ? "مخزن ومطبخ فرع السالمية المركزي" : "Salmiya Central Branch Store"}
                  </option>
                  <option value="WH-ARDIYA">
                    {isAr ? "مخزن ومطبخ فرع العارضية اللوجستي" : "Ardiya Logistics Branch Store"}
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? "إلى الفرع المستلم (الفروع الـ 9 النشطة):" : "Destination Branch (9 Active Branches):"}
                </label>
                <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-white focus:outline-none">
                  <option value="WH-AVENUES">{isAr ? "فرع مجمع الأفنيوز — الري" : "The Avenues Mall Branch"}</option>
                  <option value="WH-SALMIYA">{isAr ? "فرع السالمية المركزي" : "Salmiya Central Branch"}</option>
                  <option value="WH-HAWALLI">{isAr ? "فرع بروميناد حولي" : "Hawalli Promenade Branch"}</option>
                  <option value="WH-360MALL">{isAr ? "فرع 360 مول — الزهراء" : "360 Mall Branch"}</option>
                  <option value="WH-ASIMA">{isAr ? "فرع العاصمة مول — شرق" : "Al-Assima Mall Branch"}</option>
                  <option value="WH-KOUT">{isAr ? "فرع الكوت مول — الفحيحيل" : "Al-Kout Mall Branch"}</option>
                  <option value="WH-FARWANIYA">{isAr ? "فرع الفروانية" : "Farwaniya Branch"}</option>
                  <option value="WH-ARDIYA">{isAr ? "فرع العارضية اللوجستي" : "Ardiya Logistics Branch"}</option>
                  <option value="WH-QURAIN-BR">{isAr ? "فرع أسواق القرين" : "Aswaq Al-Qurain Branch"}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? "المواد والكميات المطلوبة:" : "Requested Items & Quantities:"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    isAr
                      ? "مثال: 100 كجم أنجوس مفروم + 20 جالون صوص كانتون"
                      : "e.g. 100 KG Minced Angus + 20 Gal Canton Sauce"
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? "الشاحنة المبردة والسائق:" : "Truck & Driver:"}
                  </label>
                  <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none">
                    <option value="T-04">شاحنة تبريد #04 (سليم مياه خان)</option>
                    <option value="T-02">شاحنة تبريد #02 (طارق عبد الحليم)</option>
                    <option value="T-08">شاحنة تبريد #08 (محمد سليم)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? "درجة التبريد المستهدفة:" : "Target Temperature:"}
                  </label>
                  <input
                    type="text"
                    defaultValue="+2.2°C"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-bold text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-500 px-5 py-2 font-black text-black hover:bg-amber-400 transition cursor-pointer shadow-md"
                >
                  {isAr ? "تأكيد وإصدار إذن التحويل (1139)" : "Confirm & Post (GL 1139)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
