"use client";

import React, { useMemo, useState } from "react";
import {
  ShoppingCart,
  Scale,
  TrendingUp,
  Building2,
  PackageCheck,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Download,
  Filter,
  ArrowRight,
  Clock,
  ThermometerSnowflake,
  ShieldCheck,
  FileSpreadsheet,
  Check,
  Flame,
  Wrench,
  DollarSign,
  ClipboardList,
} from "lucide-react";

export interface PurchaseOrderRecord {
  id: string;
  orderNumberAr: string;
  orderNumberEn: string;
  supplierNameAr: string;
  supplierNameEn: string;
  itemsSummaryAr: string;
  itemsSummaryEn: string;
  totalKwd: string;
  deliveryHubAr: string;
  deliveryHubEn: string;
  receiverAr: string;
  receiverEn: string;
  statusAr: string;
  statusEn: string;
  statusCode: "BILLED" | "IN_TRANSIT" | "PROCESSING";
  createdAt: string;
}

export const PURCHASE_ORDERS_DATA: PurchaseOrderRecord[] = [
  {
    id: "po-01",
    orderNumberAr: "أمر-202611-041",
    orderNumberEn: "PO-202611-041",
    supplierNameAr: "شركة نقل وتجارة المواشي الكويتية",
    supplierNameEn: "Kuwait Livestock Transport & Trading Co.",
    itemsSummaryAr: "لحم أنجوس مفروم 80/20 وشيت ستيك فاخر (850 كجم)",
    itemsSummaryEn: "Angus Minced Beef 80/20 & Striploin (850 KG)",
    totalKwd: "4,850.000 د.ك",
    deliveryHubAr: "المطبخ المركزي والمستودع الرئيسي",
    deliveryHubEn: "Central Kitchen & Master Commissary",
    receiverAr: "بابو تشاند رانا (#1279) · تارون كومار (#1994)",
    receiverEn: "Babu Chand Rana (#1279) · Tarun Kumar (#1994)",
    statusAr: "تم الاستلام ومطابقة الوزن والفوترة",
    statusEn: "Received, Weighed & Billed",
    statusCode: "BILLED",
    createdAt: "04/11/2026",
  },
  {
    id: "po-02",
    orderNumberAr: "أمر-202611-042",
    orderNumberEn: "PO-202611-042",
    supplierNameAr: "شركة نايف للدواجن الوطنية",
    supplierNameEn: "Naif Poultry National Company",
    itemsSummaryAr: "صدور وفيليه دجاج كويتي طازج 100% (600 كجم)",
    itemsSummaryEn: "Fresh Kuwaiti Chicken Breasts & Fillets (600 KG)",
    totalKwd: "3,240.000 د.ك",
    deliveryHubAr: "المطبخ المركزي والمستودع الرئيسي",
    deliveryHubEn: "Central Kitchen & Master Commissary",
    receiverAr: "بابو تشاند رانا (#1279) · فحص حرارة +2.4°م",
    receiverEn: "Babu Chand Rana (#1279) · Temp Checked +2.4°C",
    statusAr: "خرجت الشاحنة للتوصيل المبرد",
    statusEn: "Refrigerated Delivery in Route",
    statusCode: "IN_TRANSIT",
    createdAt: "04/11/2026",
  },
  {
    id: "po-03",
    orderNumberAr: "أمر-202611-043",
    orderNumberEn: "PO-202611-043",
    supplierNameAr: "شركة الخليج للتغليف والكرتون",
    supplierNameEn: "Gulf Packaging & Carton Company",
    itemsSummaryAr: "علب ستيك فرانكس وعلب برجر وأكياس كرافت (25,000 علبة)",
    itemsSummaryEn: "Frank's Steak Boxes, Burger Boxes & Bags (25,000 Units)",
    totalKwd: "2,900.000 د.ك",
    deliveryHubAr: "مخزن ومطبخ فرع العارضية اللوجستي",
    deliveryHubEn: "Ardiya Logistics Branch Store",
    receiverAr: "ديليرام أدهيكاري (#1954)",
    receiverEn: "Diliram Adhikari (#1954)",
    statusAr: "معتمد وتجهيز بالمصنع للتسليم",
    statusEn: "Approved & In Factory Prep",
    statusCode: "PROCESSING",
    createdAt: "03/11/2026",
  },
  {
    id: "po-04",
    orderNumberAr: "أمر-202611-044",
    orderNumberEn: "PO-202611-044",
    supplierNameAr: "شركة مطاحن الدقيق والمخابز الكويتية",
    supplierNameEn: "Kuwait Flour Mills & Bakeries Co.",
    itemsSummaryAr: "طحين فاخر، خبز بريوش، وزيوت نباتية نقية (120 كرتون)",
    itemsSummaryEn: "Premium Flour, Brioche Buns & Pure Oil (120 Boxes)",
    totalKwd: "2,450.000 د.ك",
    deliveryHubAr: "المطبخ المركزي والمستودع الرئيسي",
    deliveryHubEn: "Central Kitchen & Master Commissary",
    receiverAr: "تارون كومار (#1994)",
    receiverEn: "Tarun Kumar (#1994)",
    statusAr: "تم الاستلام ومطابقة الوزن والفوترة",
    statusEn: "Received, Weighed & Billed",
    statusCode: "BILLED",
    createdAt: "03/11/2026",
  },
  {
    id: "po-05",
    orderNumberAr: "أمر-202611-045",
    orderNumberEn: "PO-202611-045",
    supplierNameAr: "شركة ألبان الكي دي دي (KDD)",
    supplierNameEn: "Kuwait Dairy Company (KDD)",
    itemsSummaryAr: "جبن شيدر طبيعي مبشور وزبدة وحليب مبخر (350 كجم)",
    itemsSummaryEn: "Natural Cheddar Cheese, Butter & Milk (350 KG)",
    totalKwd: "1,850.000 د.ك",
    deliveryHubAr: "مخزن ومطبخ فرع السالمية المركزي",
    deliveryHubEn: "Salmiya Central Branch Store",
    receiverAr: "أسماء أحمد عبد الرزاق (#1508)",
    receiverEn: "Asmaa Ahmed Abdul-Razzaq (#1508)",
    statusAr: "خرجت الشاحنة للتوصيل المبرد",
    statusEn: "Refrigerated Delivery in Route",
    statusCode: "IN_TRANSIT",
    createdAt: "02/11/2026",
  },
  {
    id: "po-06",
    orderNumberAr: "أمر-202611-046",
    orderNumberEn: "PO-202611-046",
    supplierNameAr: "شركة توريد أسطوانات الغاز للمطابخ [GAS]",
    supplierNameEn: "Commercial Kitchen LPG Gas Supply Co.",
    itemsSummaryAr: "أسطوانات غاز البترول المسال 48 كجم صناعي (20 أسطوانة)",
    itemsSummaryEn: "48 KG Industrial LPG Cooking Gas Cylinders (20 Cylinders)",
    totalKwd: "175.000 د.ك",
    deliveryHubAr: "المطبخ المركزي والفروع الـ 9 النشطة",
    deliveryHubEn: "Central Kitchen & 9 Active Branches",
    receiverAr: "فريق السلامة المهنية ومسؤولو الفروع",
    receiverEn: "Safety Team & Branch Supervisors",
    statusAr: "تم الاستلام والتركيب والفحص المعتمد",
    statusEn: "Installed, Tested & Billed",
    statusCode: "BILLED",
    createdAt: "01/11/2026",
  },
  {
    id: "po-07",
    orderNumberAr: "أمر-202611-047",
    orderNumberEn: "PO-202611-047",
    supplierNameAr: "شركة مقاولو صيانة التبريد والمداخن ومكافحة الحشرات",
    supplierNameEn: "HVAC, Chiller & Pest Control Contractors",
    itemsSummaryAr: "صيانة وقائية لغرف التبريد والشفاطات وشهادة مكافحة دورية",
    itemsSummaryEn: "Preventive Chiller Maintenance & Pest Control Certificate",
    totalKwd: "650.000 د.ك",
    deliveryHubAr: "المطبخ المركزي ومطابخ الفروع النشطة",
    deliveryHubEn: "Central Kitchen Commissary & Branch Kitchens",
    receiverAr: "سراج الحق (#1844) · مشرف الصيانة العامة",
    receiverEn: "Siraj Ul-Haq (#1844) · Maintenance Supervisor",
    statusAr: "تم الإنجاز واعتماد تقرير الفحص الفني",
    statusEn: "Maintenance Completed & Approved",
    statusCode: "BILLED",
    createdAt: "01/11/2026",
  },
];

// 3-Way Match Data (PO <-> GRN <-> Vendor Invoice)
export const THREE_WAY_MATCH_DATA = [
  {
    po: "أمر-202611-041",
    grn: "سند-9021",
    bill: "فاتورة-المواشي-891",
    supplier: "شركة نقل وتجارة المواشي الكويتية",
    receiver: "بابو تشاند رانا (#1279) — المطبخ المركزي",
    poQty: "850 كجم",
    grnQty: "850 كجم (مطابق بالميزان)",
    poAmt: "4,850.000 د.ك",
    billAmt: "4,850.000 د.ك",
    resultAr: "مطابق 100% بنجاح",
    resultEn: "100% Exact Match",
    ok: true,
  },
  {
    po: "أمر-202611-042",
    grn: "سند-9022",
    bill: "فاتورة-نايف-412",
    supplier: "شركة نايف للدواجن الوطنية",
    receiver: "تارون كومار (#1994) — المطبخ المركزي",
    poQty: "600 كجم",
    grnQty: "590 كجم (نقص وزن 10 كجم)",
    poAmt: "3,240.000 د.ك",
    billAmt: "3,186.000 د.ك",
    resultAr: "تم تعديل الفاتورة للنقص الفعلي (-54 د.ك)",
    resultEn: "Invoice Adjusted for Shortage (-54 KWD)",
    ok: true,
  },
  {
    po: "أمر-202611-045",
    grn: "سند-9025",
    bill: "فاتورة-ألبان-KDD",
    supplier: "شركة ألبان الكي دي دي (KDD)",
    receiver: "أسماء أحمد عبد الرزاق (#1508) — فرع السالمية",
    poQty: "350 كجم",
    grnQty: "350 كجم (مطابق)",
    poAmt: "1,850.000 د.ك",
    billAmt: "1,850.000 د.ك",
    resultAr: "مطابق 100% بنجاح",
    resultEn: "100% Exact Match",
    ok: true,
  },
  {
    po: "أمر-202611-043",
    grn: "سند-9018",
    bill: "فاتورة-الخليج-119",
    supplier: "شركة الخليج للتغليف والكرتون",
    receiver: "ديليرام أدهيكاري (#1954) — فرع العارضية",
    poQty: "25,000 علبة",
    grnQty: "25,000 علبة",
    poAmt: "2,900.000 د.ك",
    billAmt: "2,990.000 د.ك",
    resultAr: "فارق سعر غير معتمد (+90 د.ك) قيد الحظر",
    resultEn: "Unauthorized Price Variance (+90 KWD) On Hold",
    ok: false,
  },
];

// Price Radar Data
export const PRICE_RADAR_DATA = [
  {
    code: "RW01-BF01",
    name: "لحم أنجوس ريب آي أسترالي مبرد (كجم)",
    supplier: "شركة نقل وتجارة المواشي الكويتية",
    lastPrice: "6.800 د.ك",
    currentPrice: "6.800 د.ك",
    change: "0.0% (ثابت)",
    altSupplier: "السعر الأفضل وفق الاتفاقية السنوية",
    safe: true,
  },
  {
    code: "RW01-CK01",
    name: "صدور دجاج طازجة مبردة (كجم)",
    supplier: "شركة نايف للدواجن الوطنية",
    lastPrice: "2.100 د.ك",
    currentPrice: "2.100 د.ك",
    change: "0.0% (ثابت)",
    altSupplier: "شركة التنمية للدواجن (2.080 د.ك)",
    safe: true,
  },
  {
    code: "RW01-OIL",
    name: "زيت نباتي نقي للقلي صفيحة 18 لتر",
    supplier: "شركة مطاحن الدقيق والمخابز الكويتية",
    lastPrice: "11.700 د.ك",
    currentPrice: "11.700 د.ك",
    change: "0.0% (سعر حكومي مدعوم)",
    altSupplier: "شركة الكوت للزيوت النباتية (12.200 د.ك)",
    safe: true,
  },
  {
    code: "RW01-CHS",
    name: "جبن شيدر طبيعي مبشور فاخر (كجم)",
    supplier: "شركة ألبان الكي دي دي (KDD)",
    lastPrice: "2.800 د.ك",
    currentPrice: "2.800 د.ك",
    change: "0.0% (ثابت)",
    altSupplier: "شركة المراعي الكويت (2.850 د.ك)",
    safe: true,
  },
  {
    code: "PK02-BOX",
    name: "علب برجر كرتون وورق لف شاورما",
    supplier: "شركة الخليج للتغليف والكرتون",
    lastPrice: "0.024 د.ك",
    currentPrice: "0.025 د.ك",
    change: "+4.1% (ارتفاع طفيف)",
    altSupplier: "مصنع الأهرام للتغليف (0.023 د.ك)",
    safe: false,
  },
];

// Comprehensive Vendor Directory & Accounts Payable (AP Aging)
export const VENDORS_AP_DIRECTORY = [
  {
    id: "ven-01",
    nameAr: "شركة نقل وتجارة المواشي الكويتية",
    nameEn: "Kuwait Livestock Transport & Trading Co.",
    categoryAr: "لحوم أنجوس أسترالية مبردة وبقري طازج ومفروم",
    categoryEn: "Chilled Australian Angus Beef & Minced",
    totalDue: "18,450.000 د.ك",
    current30: "14,200.000 د.ك",
    days60: "4,250.000 د.ك",
    days90Plus: "0.000 د.ك",
    iban: "NBK - KW12 NBOK 0000 0012 3456",
    statusAr: "حساب سارٍ ومعتمد ائتمانياً",
  },
  {
    id: "ven-02",
    nameAr: "شركة نايف للدواجن الوطنية",
    nameEn: "Naif Poultry National Company",
    categoryAr: "صدور وفيليه دجاج كويتي طازج يومي",
    categoryEn: "Fresh Daily Kuwaiti Chicken Breasts",
    totalDue: "10,650.000 د.ك",
    current30: "8,200.000 د.ك",
    days60: "2,450.000 د.ك",
    days90Plus: "0.000 د.ك",
    iban: "GBK - KW65 GULB 0000 0045 6123",
    statusAr: "حساب سارٍ ومعتمد ائتمانياً",
  },
  {
    id: "ven-03",
    nameAr: "شركة مطاحن الدقيق والمخابز الكويتية",
    nameEn: "Kuwait Flour Mills & Bakeries Co.",
    categoryAr: "طحين فاخر، خبز بريوش، وزيوت نباتية نقية",
    categoryEn: "Flour, Brioche Buns & Pure Vegetable Oil",
    totalDue: "12,800.000 د.ك",
    current30: "12,800.000 د.ك",
    days60: "0.000 د.ك",
    days90Plus: "0.000 د.ك",
    iban: "CBK - KW44 CBKU 0000 0098 7654",
    statusAr: "حساب سارٍ ومورد حكومي رئيسي",
  },
  {
    id: "ven-04",
    nameAr: "شركة ألبان الكي دي دي (KDD)",
    nameEn: "Kuwait Dairy Company (KDD)",
    categoryAr: "أجبان شيدر وموزاريلا، زبدة، وحليب مبخر",
    categoryEn: "Cheddar Cheese, Butter & Evaporated Milk",
    totalDue: "7,320.000 د.ك",
    current30: "7,320.000 د.ك",
    days60: "0.000 د.ك",
    days90Plus: "0.000 د.ك",
    iban: "NBK - KW90 NBOK 0000 0011 2233",
    statusAr: "حساب سارٍ ومعتمد ائتمانياً",
  },
  {
    id: "ven-05",
    nameAr: "شركة الخليج للتغليف والكرتون",
    nameEn: "Gulf Packaging & Carton Company",
    categoryAr: "علب ستيك فرانكس، علب برجر، وأكياس كرافت",
    categoryEn: "Frank's Boxes, Burger Packaging & Bags",
    totalDue: "8,200.000 د.ك",
    current30: "5,100.000 د.ك",
    days60: "3,100.000 د.ك",
    days90Plus: "0.000 د.ك",
    iban: "KFH - KW88 KFHU 0000 0033 4455",
    statusAr: "حساب سارٍ ومعتمد ائتمانياً",
  },
  {
    id: "ven-06",
    nameAr: "شركة الكوت للزيوت النباتية",
    nameEn: "Al-Kout Vegetable Oils Co.",
    categoryAr: "زيوت قلي نباتية نقية معتمدة للمطابخ",
    categoryEn: "Commercial Pure Frying Oils",
    totalDue: "3,400.000 د.ك",
    current30: "3,400.000 د.ك",
    days60: "0.000 د.ك",
    days90Plus: "0.000 د.ك",
    iban: "ABK - KW33 ABKK 0000 0022 1199",
    statusAr: "حساب سارٍ ومعتمد ائتمانياً",
  },
  {
    id: "ven-07",
    nameAr: "شركة توريد أسطوانات الغاز للمطابخ [GAS]",
    nameEn: "Commercial LPG Gas Supply Co.",
    categoryAr: "أسطوانات غاز البترول المسال 48 كجم صناعي",
    categoryEn: "48 KG Industrial Cooking LPG Cylinders",
    totalDue: "525.000 د.ك",
    current30: "525.000 د.ك",
    days60: "0.000 د.ك",
    days90Plus: "0.000 د.ك",
    iban: "WARBA - KW77 WRBA 0000 0088 9911",
    statusAr: "توريد دوري وتفتيش سلامة",
  },
  {
    id: "ven-08",
    nameAr: "شركة مقاولو صيانة التبريد والمداخن ومكافحة الحشرات",
    nameEn: "HVAC, Chiller & Pest Control Contractors",
    categoryAr: "صيانة غرف التبريد والشفاطات والشهادات الصحية الدورية",
    categoryEn: "Chiller Maintenance, Duct Cleaning & Pest Control",
    totalDue: "1,950.000 د.ك",
    current30: "1,300.000 د.ك",
    days60: "650.000 د.ك",
    days90Plus: "0.000 د.ك",
    iban: "BOUBYAN - KW19 BOUB 0000 0055 4422",
    statusAr: "عقود صيانة دورية معتمدة",
  },
];

// Internal Purchase Requisitions from Branches & Central Kitchen
export const INTERNAL_PR_DATA = [
  {
    id: "pr-01",
    reqNumber: "طلب-202611-101",
    branchNameAr: "مخزن ومطبخ فرع السالمية المركزي",
    managerAr: "أسماء أحمد عبد الرزاق (#1508)",
    itemsAr: "100 كجم لحم مفروم + 50 كيس خبز بريوش + 10 جالون صوص شاورما",
    estCost: "580.000 د.ك",
    urgencyAr: "عاجل للتشغيل اليومي",
    statusAr: "تم الاعتماد وتوجيه أمر توريد للمطبخ المركزي",
  },
  {
    id: "pr-02",
    reqNumber: "طلب-202611-102",
    branchNameAr: "مخزن فرع مجمع الأفنيوز — الري",
    managerAr: "إجير ريان بالاتان (#2039)",
    itemsAr: "80 كجم ستريبلوين فاخر + 40 كرتون علب ستيك حرارية فرانكس",
    estCost: "720.000 د.ك",
    urgencyAr: "تجهيز عطلة نهاية الأسبوع",
    statusAr: "تم الاعتماد والتحويل للمورد المعتمد",
  },
  {
    id: "pr-03",
    reqNumber: "طلب-202611-103",
    branchNameAr: "مخزن ومطبخ فرع العارضية اللوجستي",
    managerAr: "ديليرام أدهيكاري (#1954)",
    itemsAr: "15 أسطوانة غاز صناعي 48 كجم + 30 جالون سائل تنظيف معتمد",
    estCost: "210.000 د.ك",
    urgencyAr: "دوري شهري",
    statusAr: "قيد فحص وموافقة مدير العمليات",
  },
];

export function VenturePurchasesHub({
  locale = "ar",
  liveChildren,
}: {
  locale?: "ar" | "en";
  liveChildren?: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<
    "orders" | "matching" | "priceRadar" | "suppliers" | "glInvoices" | "internalPR" | "legacy"
  >("orders");
  const [currentLocale, setCurrentLocale] = useState<"ar" | "en">(locale);
  const [searchQ, setSearchQ] = useState("");
  const [showNewPoModal, setShowNewPoModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const isAr = currentLocale === "ar";

  const showToast = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 5000);
  };

  const handleExportCsv = () => {
    const headers = isAr
      ? "رقم أمر الشراء,المورد المعتمد,الأصناف,القيمة الإجمالية,موقع التسليم,المستلم الفعلي,الحالة\n"
      : "PO Number,Supplier,Items,Total Value,Delivery Hub,Receiver,Status\n";
    const rows = PURCHASE_ORDERS_DATA.map(
      (p) =>
        `"${isAr ? p.orderNumberAr : p.orderNumberEn}","${isAr ? p.supplierNameAr : p.supplierNameEn}","${
          isAr ? p.itemsSummaryAr : p.itemsSummaryEn
        }","${p.totalKwd}","${isAr ? p.deliveryHubAr : p.deliveryHubEn}","${isAr ? p.receiverAr : p.receiverEn}","${
          isAr ? p.statusAr : p.statusEn
        }"`
    ).join("\n");

    const blob = new Blob(["\uFEFF" + headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `venture-foods-purchases-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(isAr ? "📥 تم تصدير سجل المشتريات بصيغة إكسل بنجاح" : "📥 Purchase orders exported successfully");
  };

  const filteredOrders = useMemo(() => {
    if (!searchQ.trim()) return PURCHASE_ORDERS_DATA;
    const q = searchQ.toLowerCase();
    return PURCHASE_ORDERS_DATA.filter((o) => {
      return (
        o.orderNumberAr.toLowerCase().includes(q) ||
        o.orderNumberEn.toLowerCase().includes(q) ||
        o.supplierNameAr.toLowerCase().includes(q) ||
        o.supplierNameEn.toLowerCase().includes(q) ||
        o.itemsSummaryAr.toLowerCase().includes(q) ||
        o.deliveryHubAr.toLowerCase().includes(q) ||
        o.receiverAr.toLowerCase().includes(q)
      );
    });
  }, [searchQ]);

  return (
    <div dir={isAr ? "rtl" : "ltr"} className="w-full max-w-none text-slate-100 space-y-6 font-sans">
      {/* Top Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-400">
              <ShoppingCart size={14} />
              {isAr ? "إدارة المشتريات وسلاسل التوريد والرقابة المالية" : "Procurement & Vendor Intelligence"}
            </span>
            <span className="rounded-full bg-slate-800/90 border border-slate-700/80 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
              {isAr ? "فنتشر فودز لإدارة المطاعم ذ.م.م." : "Venture Foods W.L.L."}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl tracking-tight">
            {isAr ? "مركز قيادة المشتريات والمطابقة الثلاثية والموردين" : "Enterprise Procurement & 3-Way Matching Engine"}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            {isAr
              ? "إدارة أوامر الشراء المعتمدة، المطابقة الرقابية الثلاثية (أمر الشراء ↔ سند الاستلام والوزن ↔ فاتورة المورد)، تتبع أسعار المواد، ومتابعة أعمار ديون الموردين بنظام أودو المالي."
              : "Comprehensive management of Purchase Orders, 3-Way Match Verification, Vendor AP Aging, and Inflation Radar for Venture Foods W.L.L."}
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
            onClick={handleExportCsv}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-700 transition cursor-pointer shadow-sm"
          >
            <Download size={15} />
            <span>{isAr ? "📥 تصدير سجل المشتريات (إكسل)" : "📥 Export Purchases (CSV)"}</span>
          </button>
          <button
            onClick={() => setShowNewPoModal(true)}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
          >
            <Plus size={16} />
            <span>{isAr ? "+ إصدار أمر شراء جديد" : "+ Issue Purchase Order"}</span>
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

      {/* Top 4 Operational & Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-5 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-300">
              {isAr ? "إجمالي المشتريات الشهرية المعتمدة" : "Total Monthly Spend"}
            </span>
            <ShoppingCart size={18} className="text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">52,634.000 {isAr ? "د.ك" : "KWD"}</div>
          <p className="text-[11px] text-blue-200/70 mt-1">
            {isAr ? "148 أمر شراء وتوريد معتمد خلال الدورة" : "148 approved purchase orders this cycle"}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-5 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300">
              {isAr ? "أوامر شراء قيد التوصيل للمستودعات" : "In-Transit Replenishment"}
            </span>
            <Clock size={18} className="text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-400 font-mono">12 {isAr ? "طلبية نشطة" : "Active Orders"}</div>
          <p className="text-[11px] text-amber-200/70 mt-1">
            {isAr ? "تصل اليوم لرمبة الاستلام بالمطبخ المركزي" : "Arriving at commissary receiving dock today"}
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300">
              {isAr ? "وفورات الشراء والخصومات التعاقدية" : "Contract Volume Rebates"}
            </span>
            <TrendingUp size={18} className="text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-400 font-mono">3,840.000 {isAr ? "د.ك" : "KWD"}</div>
          <p className="text-[11px] text-emerald-200/70 mt-1">
            {isAr ? "خصم كميات وعقود مباشرة مع كبار الموردين" : "Volume rebates and direct vendor agreements"}
          </p>
        </div>

        <div className="rounded-2xl border border-purple-500/20 bg-purple-950/20 p-5 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-300">
              {isAr ? "معدل التوريد في الموعد والالتزام التعاقدي" : "On-Time Fulfillment Rate"}
            </span>
            <ShieldCheck size={18} className="text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">98.4%</div>
          <p className="text-[11px] text-purple-200/70 mt-1">
            {isAr ? "التزام دقيق بشروط التوريد وسلامة الأغذية" : "Strict adherence to quality & SLA specs"}
          </p>
        </div>
      </div>

      {/* The 6 Specialized Tabs Requested by User */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {[
          {
            key: "orders",
            labelAr: "أوامر الشراء وطلبات التوريد",
            labelEn: "Purchase Orders & Replenishment",
            icon: ShoppingCart,
          },
          {
            key: "matching",
            labelAr: "المطابقة الثلاثية للفواتير والاستلام",
            labelEn: "3-Way Invoice & Goods Matching",
            icon: Scale,
          },
          {
            key: "priceRadar",
            labelAr: "رادار تغير ومقارنة أسعار الموردين",
            labelEn: "Price Variance & Inflation Radar",
            icon: TrendingUp,
          },
          {
            key: "suppliers",
            labelAr: "سجل الموردين المعتمدين وأعمار الديون",
            labelEn: "Approved Vendors Directory & AP Aging",
            icon: Building2,
          },
          {
            key: "glInvoices",
            labelAr: "فواتير التوريد والقيود المحاسبية الرباعية",
            labelEn: "Supply Invoices & 4D GL Journal",
            icon: FileText,
          },
          {
            key: "internalPR",
            labelAr: "طلبات الشراء الداخلي للفروع والمطبخ المركزي",
            labelEn: "Internal Purchase Requisitions (PR)",
            icon: ClipboardList,
          },
          ...(liveChildren
            ? [
                {
                  key: "legacy",
                  labelAr: "فواتير الشراء الحية بقاعدة البيانات (Prisma DB)",
                  labelEn: "Database Purchase Records",
                  icon: FileSpreadsheet,
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
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
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
      {/* TAB 1: PURCHASE ORDERS & REPLENISHMENT                                    */}
      {/* ========================================================================= */}
      {activeTab === "orders" && (
        <div className="space-y-4 w-full">
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute top-2.5 start-3 text-slate-500" size={16} />
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder={isAr ? "ابحث برقم الأمر، المورد، أو الصنف..." : "Search PO number, supplier, or items..."}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 ps-9 pe-4 text-xs text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl w-full">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-bold uppercase">
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "رقم أمر الشراء" : "PO Number"}</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "المورد المعتمد" : "Approved Supplier"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "الأصناف والمواصفات" : "Items & Specifications"}</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "القيمة الإجمالية" : "Total Amount"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "موقع التسليم" : "Delivery Hub"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "مسؤول الاستلام والوزن الفعلي" : "Receiving Supervisor"}</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">{isAr ? "حالة الأمر" : "Status"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filteredOrders.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-mono font-bold text-blue-400 whitespace-nowrap" dir="ltr">
                        {isAr ? row.orderNumberAr : row.orderNumberEn}
                      </td>
                      <td className="px-4 py-3 font-bold text-white whitespace-nowrap">
                        {isAr ? row.supplierNameAr : row.supplierNameEn}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {isAr ? row.itemsSummaryAr : row.itemsSummaryEn}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-amber-300 text-right whitespace-nowrap">
                        {row.totalKwd}
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-medium">
                        {isAr ? row.deliveryHubAr : row.deliveryHubEn}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-200 font-semibold inline-block">
                          {isAr ? row.receiverAr : row.receiverEn}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                            row.statusCode === "BILLED"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : row.statusCode === "IN_TRANSIT"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}
                        >
                          {isAr ? row.statusAr : row.statusEn}
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
      {/* TAB 2: 3-WAY MATCHING (PO <-> GRN <-> VENDOR INVOICE)                     */}
      {/* ========================================================================= */}
      {activeTab === "matching" && (
        <div className="space-y-4 w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white">
                {isAr
                  ? "شاشة الرقابة المالية والمطابقة الثلاثية التلقائية للفواتير والاستلام"
                  : "Automated 3-Way Invoice & Delivery Reconciliation"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? "مطابقة كميات وأسعار أمر الشراء الصادر مع الوزن الفعلي بسند الاستلام (GRN) وفاتورة المورد قبل تحويلها للصرف البنكي."
                  : "Reconciling PO lines against physical scale receipts and vendor invoices before payment release."}
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
              {isAr ? "حماية بنسبة 100% من فروقات الأسعار وأخطاء الفواتير" : "100% Overcharge Protection"}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl w-full">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-bold uppercase">
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "رقم أمر الشراء" : "PO Number"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "المورد ومستنداته" : "Supplier & Documents"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "مسؤول الاستلام والوزن الفعلي" : "Receiver"}</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">{isAr ? "الكمية المطلوبة" : "PO Qty"}</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">{isAr ? "المستلم بالميزان" : "Received Qty"}</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "قيمة الأمر" : "PO Value"}</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "فاتورة المورد" : "Invoice Value"}</th>
                    <th className="px-4 py-3 text-center">{isAr ? "نتيجة المطابقة" : "Match Result"}</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">{isAr ? "الإجراء" : "Action"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {THREE_WAY_MATCH_DATA.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-mono font-bold text-blue-400 whitespace-nowrap" dir="ltr">
                        {m.po}
                      </td>
                      <td className="px-4 py-3 font-bold text-white">
                        {m.supplier}
                        <span className="block text-[11px] font-mono text-slate-400 mt-0.5">
                          {m.bill} · {m.grn}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-medium">
                        {m.receiver}
                      </td>
                      <td className="px-4 py-3 text-center font-mono whitespace-nowrap">{m.poQty}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-white whitespace-nowrap">
                        {m.grnQty}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-300 whitespace-nowrap">
                        {m.poAmt}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-300 whitespace-nowrap">
                        {m.billAmt}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                            m.ok
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}
                        >
                          {isAr ? m.resultAr : m.resultEn}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          onClick={() =>
                            showToast(
                              m.ok
                                ? `✅ تم اعتماد الفاتورة ${m.bill} مالياً وترحيلها للصرف البنكي`
                                : `⚠️ تم حظر صرف الفاتورة ${m.bill} وإخطار المورد بتصحيح الفارق المالي`
                            )
                          }
                          className={`rounded-xl px-3 py-1.5 text-xs font-black transition cursor-pointer shadow-sm ${
                            m.ok
                              ? "bg-emerald-600 text-white hover:bg-emerald-500"
                              : "bg-rose-600 text-white hover:bg-rose-500"
                          }`}
                        >
                          {m.ok ? (isAr ? "اعتماد للصرف" : "Approve") : (isAr ? "حظر الفاتورة" : "Hold Bill")}
                        </button>
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
      {/* TAB 3: PRICE RADAR & INFLATION TRACKING                                    */}
      {/* ========================================================================= */}
      {activeTab === "priceRadar" && (
        <div className="space-y-4 w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white">
                {isAr
                  ? "رادار تغير ومقارنة أسعار الموردين والمواد الخام والتغليف"
                  : "Supplier Price Creep & Material Cost Variance Radar"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? "رصد ومقارنة أسعار التوريد الحالية بالأسعار التعاقدية المعتمدة واقتراح الموردين البدائل الأوفر."
                  : "Tracking material price creep vs contractual baselines and recommending qualified alternate suppliers."}
              </p>
            </div>
            <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30">
              {isAr ? "مقارنة لحظية بأسعار السوق الكويتي" : "Live Kuwait Market Benchmark"}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl w-full">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-bold uppercase">
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "كود الصنف" : "Item Code"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "اسم المادة الغذائية / التغليف" : "Item Description"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "المورد الحالي المعتمد" : "Current Vendor"}</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "السعر السابق (د.ك)" : "Last Price"}</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "السعر الحالي (د.ك)" : "Current Price"}</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">{isAr ? "نسبة التغير" : "Variance %"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "أفضل مورد بديل معتمد" : "Best Alternative"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {PRICE_RADAR_DATA.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-mono font-bold text-amber-400 whitespace-nowrap" dir="ltr">
                        {row.code}
                      </td>
                      <td className="px-4 py-3 font-bold text-white">{row.name}</td>
                      <td className="px-4 py-3 text-slate-300 font-medium">{row.supplier}</td>
                      <td className="px-4 py-3 font-mono text-slate-400 text-right whitespace-nowrap">{row.lastPrice}</td>
                      <td className="px-4 py-3 font-mono font-bold text-white text-right whitespace-nowrap">{row.currentPrice}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            row.safe ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"
                          }`}
                        >
                          {row.change}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-blue-300 font-medium text-right">{row.altSupplier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: APPROVED VENDORS DIRECTORY & AP AGING                               */}
      {/* ========================================================================= */}
      {activeTab === "suppliers" && (
        <div className="space-y-4 w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white">
                {isAr
                  ? "سجل الموردين المعتمدين وأعمار الديون وجدول السداد (نظام أودو المالي)"
                  : "Approved Vendors Directory & Accounts Payable Aging"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? "قائمة موردي المواد الغذائية، التغليف، أسطوانات الغاز، ومقاولي الصيانة والشهادات الصحية مع تفاصيل الآيبان المصرفي وأعمار الديون."
                  : "Directory of Food, Packaging, LPG Gas & Maintenance contractors with bank IBAN and AP aging breakdown."}
              </p>
            </div>
            <span className="text-xs font-bold text-slate-300 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
              {isAr ? "إجمالي مستحقات الموردين: 63,295.000 د.ك" : "Total AP Due: 63,295.000 KWD"}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl w-full">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-bold uppercase">
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "اسم المورد المعتمد" : "Supplier Name"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "فئة التوريد ونطاق التعاقد" : "Category & Scope"}</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "الرصيد الإجمالي" : "Total Due"}</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "0-30 يوماً" : "0-30 Days"}</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "31-60 يوماً" : "31-60 Days"}</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "أكثر من 60 يوماً" : "> 60 Days"}</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">{isAr ? "الحساب البنكي (IBAN)" : "Bank IBAN"}</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">{isAr ? "حالة الائتمان" : "Credit Status"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {VENDORS_AP_DIRECTORY.map((sup) => (
                    <tr key={sup.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-bold text-white whitespace-nowrap">
                        {isAr ? sup.nameAr : sup.nameEn}
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-medium">
                        {isAr ? sup.categoryAr : sup.categoryEn}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-amber-300 text-right whitespace-nowrap">
                        {sup.totalDue}
                      </td>
                      <td className="px-4 py-3 font-mono text-emerald-400 text-right whitespace-nowrap">{sup.current30}</td>
                      <td className="px-4 py-3 font-mono text-amber-400 text-right whitespace-nowrap">{sup.days60}</td>
                      <td className="px-4 py-3 font-mono text-rose-400 text-right whitespace-nowrap">{sup.days90Plus}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-400 text-center whitespace-nowrap" dir="ltr">
                        {sup.iban}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
                          {sup.statusAr}
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
      {/* TAB 5: 4D GL INVOICES & AUTOMATED JOURNAL ENTRIES                         */}
      {/* ========================================================================= */}
      {activeTab === "glInvoices" && (
        <div className="space-y-4 w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white">
                {isAr
                  ? "فواتير التوريد والقيود المحاسبية الرباعية (دليل الحسابات 1131 / 2111)"
                  : "Supply Invoices & Automated 4D GL Posting"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? "الترحيل التلقائي لفواتير الموردين المعتمدة مع تحميل حسابات المخزون (1131/1133) وحساب الذمم الدائنة (2111)."
                  : "Real-time double-entry journal creation debiting inventory GL and crediting vendor payables."}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl w-full">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-bold uppercase">
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "رقم الفاتورة" : "Invoice No"}</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "أمر الشراء المرتبط" : "Linked PO"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "المورد" : "Vendor"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "حساب المدين (المخزون)" : "Debit GL"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "حساب الدائن (المورد)" : "Credit GL"}</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "المبلغ المقيد" : "Amount"}</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">{isAr ? "حالة الترحيل المالي" : "Status"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { inv: "INV-202611-041", po: "أمر-202611-041", sup: "شركة المواشي الكويتية", debit: "1131 مخزون مواد خام لحوم", credit: "2111 ذمم الموردين الدائنة", amt: "4,850.000 د.ك", status: "مرحل ومقفل بأودو" },
                    { inv: "INV-202611-044", po: "أمر-202611-044", sup: "مطاحن الدقيق الكويتية", debit: "1131 مخزون طحين وزيوت", credit: "2111 ذمم الموردين الدائنة", amt: "2,450.000 د.ك", status: "مرحل ومقفل بأودو" },
                    { inv: "INV-202611-046", po: "أمر-202611-046", sup: "شركة توريد أسطوانات الغاز", debit: "1134 مستهلكات تشغيل وغاز", credit: "2111 ذمم الموردين الدائنة", amt: "175.000 د.ك", status: "مرحل ومقفل بأودو" },
                  ].map((gl, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-mono font-bold text-blue-400 whitespace-nowrap" dir="ltr">{gl.inv}</td>
                      <td className="px-4 py-3 font-mono font-bold text-amber-400 whitespace-nowrap" dir="ltr">{gl.po}</td>
                      <td className="px-4 py-3 font-bold text-white whitespace-nowrap">{gl.sup}</td>
                      <td className="px-4 py-3 text-emerald-400 font-medium">{gl.debit}</td>
                      <td className="px-4 py-3 text-amber-400 font-medium">{gl.credit}</td>
                      <td className="px-4 py-3 font-mono font-bold text-white text-right whitespace-nowrap">{gl.amt}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
                          {gl.status}
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
      {/* TAB 6: INTERNAL PURCHASE REQUISITIONS (PR)                                */}
      {/* ========================================================================= */}
      {activeTab === "internalPR" && (
        <div className="space-y-4 w-full">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white">
                {isAr
                  ? "طلبات الشراء الداخلي والتزويد الصادرة من الفروع والمطبخ المركزي"
                  : "Internal Purchase Requisitions (Branch Store Managers)"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isAr
                  ? "طلبات التوريد المرفوعة من مديري الفروع المعتمدين في أودو للمشتريات والمطبخ المركزي."
                  : "Requisitions submitted by authorized Odoo branch managers to central procurement and Central Kitchen commissary."}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl w-full">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-bold uppercase">
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "رقم الطلب الداخلي" : "PR Number"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "الفرع الطالب" : "Requesting Branch"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "مدير الفرع صاحب الطلب" : "Branch Supervisor"}</th>
                    <th className="px-4 py-3 text-right">{isAr ? "المواد والكميات المطلوبة" : "Requested Items"}</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">{isAr ? "التكلفة التقديرية" : "Est. Cost"}</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">{isAr ? "درجة الأهمية" : "Urgency"}</th>
                    <th className="px-4 py-3 text-center">{isAr ? "حالة الاعتماد" : "Approval Status"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {INTERNAL_PR_DATA.map((pr) => (
                    <tr key={pr.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 font-mono font-bold text-amber-400 whitespace-nowrap" dir="ltr">{pr.reqNumber}</td>
                      <td className="px-4 py-3 font-bold text-white whitespace-nowrap">{pr.branchNameAr}</td>
                      <td className="px-4 py-3 text-slate-300 font-medium whitespace-nowrap">{pr.managerAr}</td>
                      <td className="px-4 py-3 text-slate-300">{pr.itemsAr}</td>
                      <td className="px-4 py-3 font-mono font-bold text-amber-300 text-right whitespace-nowrap">{pr.estCost}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300 font-semibold">{pr.urgencyAr}</span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">
                          {pr.statusAr}
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
      {/* TAB 7: PRISMA DATABASE PURCHASES (LIVE CHILDREN)                          */}
      {/* ========================================================================= */}
      {activeTab === "legacy" && liveChildren && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl w-full">
          {liveChildren}
        </div>
      )}

      {/* Issue Purchase Order Modal */}
      {showNewPoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">
                {isAr ? "إصدار أمر شراء وتوريد جديد لموردي فنتشر فودز" : "Issue New Purchase Order"}
              </h3>
              <button onClick={() => setShowNewPoModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setShowNewPoModal(false);
                showToast(
                  isAr
                    ? "✅ تم إصدار أمر الشراء بنجاح وإرساله للمورد وتوثيقه في نظام المطابقة الثلاثية"
                    : "✅ Purchase order issued and routed to 3-Way Match"
                );
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? "المورد المعتمد:" : "Approved Supplier:"}
                </label>
                <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-white focus:outline-none">
                  <option value="ALM">شركة نقل وتجارة المواشي الكويتية</option>
                  <option value="NAY">شركة نايف للدواجن الوطنية</option>
                  <option value="KFM">شركة مطاحن الدقيق والمخابز الكويتية</option>
                  <option value="KDD">شركة ألبان الكي دي دي (KDD)</option>
                  <option value="GLF">شركة الخليج للتغليف والكرتون</option>
                  <option value="KOT">شركة الكوت للزيوت النباتية</option>
                  <option value="GAS">شركة توريد أسطوانات الغاز للمطابخ [GAS]</option>
                  <option value="MNT">شركة مقاولو صيانة التبريد والمداخن ومكافحة الحشرات</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? "موقع ومستودع الاستلام والوزن:" : "Receiving Hub & Warehouse:"}
                </label>
                <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-white focus:outline-none">
                  <option value="CK-QURAIN">
                    المطبخ المركزي والمستودع الرئيسي (المسؤول: بابو تشاند رانا #1279 / تارون كومار #1994)
                  </option>
                  <option value="WH-SALMIYA">
                    مخزن فرع السالمية المركزي (المسؤولة: أسماء أحمد #1508)
                  </option>
                  <option value="WH-ARDIYA">
                    مخزن فرع العارضية اللوجستي (المسؤول: ديليرام أدهيكاري #1954)
                  </option>
                  <option value="WH-AVENUES">
                    مخزن فرع مجمع الأفنيوز — الري (المسؤول: إجير ريان بالاتان #2039)
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  {isAr ? "الأصناف والمواصفات والكميات المطلوبة:" : "Items, Specs & Quantities:"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    isAr
                      ? "مثال: 500 كجم لحم أنجوس مفروم بسعر 5.400 د.ك/كجم"
                      : "e.g. 500 KG Angus Beef at 5.400 KWD/KG"
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? "تاريخ التسليم المطلوب:" : "Expected Delivery Date:"}
                  </label>
                  <input
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    {isAr ? "شروط التبريد والنقل:" : "Cooling Requirements:"}
                  </label>
                  <select className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none">
                    <option value="CHILL">تبريد طازج (+1.0°م إلى +3.5°م)</option>
                    <option value="FREEZE">تجميد عميق (-18°م فأقل)</option>
                    <option value="DRY">جاف / حرارة الغرفة المعتدلة</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewPoModal(false)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 font-bold text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                >
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 font-black text-white hover:bg-blue-500 transition cursor-pointer shadow-md"
                >
                  {isAr ? "اعتماد وإصدار أمر الشراء" : "Confirm & Issue PO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
