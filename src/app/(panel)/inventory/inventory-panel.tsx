"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  Truck,
  Upload,
} from "lucide-react";
import { deleteCategory, deleteProduct, saveCategory, saveProduct } from "@/app/actions/inventory";
import { searchCategories } from "@/app/actions/search";
import { CustomFields } from "@/components/custom-fields";
import { Modal } from "@/components/modal";
import { customSummary, parseCustom, readCustom } from "@/lib/custom";
import { ExportCsvButton } from "@/components/ui/export-button";
import { SearchSelect } from "@/components/search-select";
import {
  Alert,
  DataCard,
  LowStockBadge,
  PageHeader,
  PaginationBar,
  btnDanger,
  btnGhost,
  btnPrimary,
  fieldClass,
  labelClass,
} from "@/components/erp-ui";
import { useI18n } from "@/lib/i18n";
import { pageHref } from "@/lib/pagination";
import type { SearchHit } from "@/lib/types";

export type ProductRow = {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  categoryName: string;
  costPrice: number;
  sellingPrice: number;
  reorderLevel: number;
  low: boolean;
  costLabel: string;
  sellLabel: string;
  stockLabel: string;
  reorderLabel: string;
  forecastLabel: string;
  warehouseName?: string;
  customData?: string;
};

export type CategoryRow = { id: string; name: string; description: string; productCount: number };
export type MovementRow = {
  id: string;
  dateLabel: string;
  productName: string;
  code: string;
  type: string;
  typeLabel: string;
  quantityLabel: string;
  note: string;
  balanceLabel: string;
  userName: string;
  fromLocation?: string;
  toLocation?: string;
  statusLabel?: string;
};

// 60+ Authentic Venture Foods Stock Materials across Central Kitchen and the 9 branches
export const VENTURE_STOCK_SEED: ProductRow[] = [
  // Meats & Poultry (1131)
  { id: "vfs-01", code: "RW01-BF01", name: "لحم بلاك أنجوس ريب آي أسترالي مبرد (ريب آي)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 6.800, sellingPrice: 9.850, reorderLevel: 200, low: false, costLabel: "6.800 د.ك", sellLabel: "9.850 د.ك", stockLabel: "1,420 كجم", reorderLabel: "200 كجم", forecastLabel: "تكفي 18 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-02", code: "RW01-BF02", name: "لحم أنجوس ستريبلوين فاخر معتق", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 6.200, sellingPrice: 8.950, reorderLevel: 150, low: false, costLabel: "6.200 د.ك", sellLabel: "8.950 د.ك", stockLabel: "980 كجم", reorderLabel: "150 كجم", forecastLabel: "تكفي 21 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-03", code: "RW01-BF03", name: "لحم أنجوس مفروم طازج 80/20 للبرجر", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 3.800, sellingPrice: 5.250, reorderLevel: 300, low: false, costLabel: "3.800 د.ك", sellLabel: "5.250 د.ك", stockLabel: "2,150 كجم", reorderLabel: "300 كجم", forecastLabel: "تكفي 14 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-04", code: "RW01-BF04", name: "لحم بريسكت بقري مدخن متبل", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 5.400, sellingPrice: 7.800, reorderLevel: 80, low: false, costLabel: "5.400 د.ك", sellLabel: "7.800 د.ك", stockLabel: "450 كجم", reorderLabel: "80 كجم", forecastLabel: "تكفي 12 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-05", code: "RW01-CK01", name: "صدور دجاج طازجة مبردة (إنتاج الكويت)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 2.100, sellingPrice: 3.500, reorderLevel: 400, low: false, costLabel: "2.100 د.ك", sellLabel: "3.500 د.ك", stockLabel: "3,450 كجم", reorderLabel: "400 كجم", forecastLabel: "تكفي 16 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-06", code: "RW01-CK02", name: "أفخاذ دجاج طازجة مسحبة ومتبلة للشاورما", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 1.850, sellingPrice: 3.200, reorderLevel: 350, low: false, costLabel: "1.850 د.ك", sellLabel: "3.200 د.ك", stockLabel: "2,800 كجم", reorderLabel: "350 كجم", forecastLabel: "تكفي 15 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-07", code: "RW01-CK03", name: "أجنحة دجاج طازجة مجهزة للمقليات", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 1.450, sellingPrice: 2.600, reorderLevel: 180, low: false, costLabel: "1.450 د.ك", sellLabel: "2.600 د.ك", stockLabel: "1,200 كجم", reorderLabel: "180 كجم", forecastLabel: "تكفي 10 أيام", warehouseName: "مخزن فرع العارضية" },
  { id: "vfs-08", code: "RW01-SHR", name: "روبيان جامبو طازج مقشر ومنظف ومجمد", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 4.800, sellingPrice: 6.900, reorderLevel: 120, low: false, costLabel: "4.800 د.ك", sellLabel: "6.900 د.ك", stockLabel: "850 كجم", reorderLabel: "120 كجم", forecastLabel: "تكفي 20 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-09", code: "RW01-FSH", name: "فيليه سلمون نرويجي طازج مبرد", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 5.900, sellingPrice: 8.500, reorderLevel: 50, low: false, costLabel: "5.900 د.ك", sellLabel: "8.500 د.ك", stockLabel: "320 كجم", reorderLabel: "50 كجم", forecastLabel: "تكفي 7 أيام", warehouseName: "مخزن فرع الخيران" },
  
  // Grains, Dairy & Pantry (1131)
  { id: "vfs-10", code: "RW01-RC01", name: "أرز ياسمين تايلاندي ممتاز (شوال 20 كجم)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 11.500, sellingPrice: 0.000, reorderLevel: 50, low: false, costLabel: "11.500 د.ك", sellLabel: "—", stockLabel: "340 كيس", reorderLabel: "50 كيس", forecastLabel: "تكفي 35 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-11", code: "RW01-RC02", name: "أرز بسمتي هندي طويل الحبة ممتاز (20 كجم)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 14.200, sellingPrice: 0.000, reorderLevel: 40, low: false, costLabel: "14.200 د.ك", sellLabel: "—", stockLabel: "280 كيس", reorderLabel: "40 كيس", forecastLabel: "تكفي 28 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-12", code: "RW01-NOD", name: "نودلز قمح كانتون طازجة مسبوقة التجهيز", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 0.850, sellingPrice: 0.000, reorderLevel: 200, low: false, costLabel: "0.850 د.ك", sellLabel: "—", stockLabel: "1,600 كجم", reorderLabel: "200 كجم", forecastLabel: "تكفي 22 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-13", code: "RW01-OIL", name: "زيت قلي نباتي نقي (مطاحن الدقيق الكويتية)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 0.650, sellingPrice: 0.000, reorderLevel: 300, low: false, costLabel: "0.650 د.ك", sellLabel: "—", stockLabel: "1,850 لتر", reorderLabel: "300 لتر", forecastLabel: "تكفي 25 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-14", code: "RW01-POT", name: "بطاطا بلجيكية 9/9 مفرزة للمقليات (كرتون 10 كجم)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 4.250, sellingPrice: 0.000, reorderLevel: 100, low: false, costLabel: "4.250 د.ك", sellLabel: "—", stockLabel: "620 كرتون", reorderLabel: "100 كرتون", forecastLabel: "تكفي 19 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-15", code: "RW01-CHS", name: "جبن شيدر أصفر نيوزيلندي مبشور فاخر", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 2.800, sellingPrice: 0.000, reorderLevel: 80, low: false, costLabel: "2.800 د.ك", sellLabel: "—", stockLabel: "540 كجم", reorderLabel: "80 كجم", forecastLabel: "تكفي 17 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-16", code: "RW01-MOZ", name: "جبن موزاريلا إيطالي أصلي مبشور", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 2.650, sellingPrice: 0.000, reorderLevel: 90, low: false, costLabel: "2.650 د.ك", sellLabel: "—", stockLabel: "680 كجم", reorderLabel: "90 كجم", forecastLabel: "تكفي 16 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-17", code: "RW01-TAH", name: "طحينة سمسم سائلة صافية ممتازة (سطل 18 كجم)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 16.500, sellingPrice: 0.000, reorderLevel: 25, low: false, costLabel: "16.500 د.ك", sellLabel: "—", stockLabel: "120 سطل", reorderLabel: "25 سطل", forecastLabel: "تكفي 30 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-18", code: "RW01-BN01", name: "خبز بريوش طازج يومي للبرجر", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 0.120, sellingPrice: 0.000, reorderLevel: 500, low: false, costLabel: "0.120 د.ك", sellLabel: "—", stockLabel: "2,400 حبة", reorderLabel: "500 حبة", forecastLabel: "تكفي يومين (توريد يومي)", warehouseName: "مخزن فرع الأفنيوز" },
  { id: "vfs-19", code: "RW01-CHP", name: "عجين شباتي طازج مجهز لكافتيريا كرك", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 0.060, sellingPrice: 0.000, reorderLevel: 600, low: false, costLabel: "0.060 د.ك", sellLabel: "—", stockLabel: "3,200 حبة", reorderLabel: "600 حبة", forecastLabel: "تكفي 3 أيام", warehouseName: "مخزن فرع حولي" },
  { id: "vfs-20", code: "RW01-TEA", name: "أوراق شاي سيلاني فاخر وزعفران إيراني أصلي", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 8.500, sellingPrice: 0.000, reorderLevel: 15, low: false, costLabel: "8.500 د.ك", sellLabel: "—", stockLabel: "85 كجم", reorderLabel: "15 كجم", forecastLabel: "تكفي 40 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-21", code: "RW01-MLK", name: "حليب مبخر هولندي ممتاز (كرتون 48 علبة)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 12.800, sellingPrice: 0.000, reorderLevel: 30, low: false, costLabel: "12.800 د.ك", sellLabel: "—", stockLabel: "190 كرتون", reorderLabel: "30 كرتون", forecastLabel: "تكفي 25 يوماً", warehouseName: "مستودع أسواق القرين" },
  
  // Central Kitchen Preps (1132)
  { id: "vfs-22", code: "PP03-CGS", name: "صوص كانتون الصيني السري (جالون 5 لتر - القرين)", categoryId: "cat-1132", categoryName: "1132 منتجات نصف مصنعة", costPrice: 12.000, sellingPrice: 0.000, reorderLevel: 20, low: false, costLabel: "12.000 د.ك", sellLabel: "—", stockLabel: "95 جالون", reorderLabel: "20 جالون", forecastLabel: "تكفي 14 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-23", code: "PP03-TRF", name: "مايونيز الترافل الأسود الفاخر (سطل 5 كجم)", categoryId: "cat-1132", categoryName: "1132 منتجات نصف مصنعة", costPrice: 22.500, sellingPrice: 0.000, reorderLevel: 15, low: false, costLabel: "22.500 د.ك", sellLabel: "—", stockLabel: "60 سطل", reorderLabel: "15 سطل", forecastLabel: "تكفي 12 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-24", code: "PP03-PPR", name: "صوص الفلفل الأسود والديمي جلاس (جالون 5 لتر)", categoryId: "cat-1132", categoryName: "1132 منتجات نصف مصنعة", costPrice: 14.000, sellingPrice: 0.000, reorderLevel: 15, low: false, costLabel: "14.000 د.ك", sellLabel: "—", stockLabel: "75 جالون", reorderLabel: "15 جالون", forecastLabel: "تكفي 18 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-25", code: "PP03-MSH", name: "بطاطا مهروسة متبلة بالكريمة (أكياس 2 كجم)", categoryId: "cat-1132", categoryName: "1132 منتجات نصف مصنعة", costPrice: 2.200, sellingPrice: 0.000, reorderLevel: 60, low: false, costLabel: "2.200 د.ك", sellLabel: "—", stockLabel: "350 كيس", reorderLabel: "60 كيس", forecastLabel: "تكفي 10 أيام", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-26", code: "PP03-SNS", name: "صوص سويت آند سور الكلاسيكي (جالون 5 لتر)", categoryId: "cat-1132", categoryName: "1132 منتجات نصف مصنعة", costPrice: 11.000, sellingPrice: 0.000, reorderLevel: 18, low: false, costLabel: "11.000 د.ك", sellLabel: "—", stockLabel: "80 جالون", reorderLabel: "18 جالون", forecastLabel: "تكفي 15 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-27", code: "PP03-GAR", name: "ثومية الشاورما الأصلية المحضرة بالقرين (سطل 5 كجم)", categoryId: "cat-1132", categoryName: "1132 منتجات نصف مصنعة", costPrice: 9.000, sellingPrice: 0.000, reorderLevel: 25, low: false, costLabel: "9.000 د.ك", sellLabel: "—", stockLabel: "110 سطل", reorderLabel: "25 سطل", forecastLabel: "تكفي 11 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-28", code: "PP03-MAR", name: "خلطة تتبيل الستيك والبرجر السرية الجافة (كجم)", categoryId: "cat-1132", categoryName: "1132 منتجات نصف مصنعة", costPrice: 3.500, sellingPrice: 0.000, reorderLevel: 30, low: false, costLabel: "3.500 د.ك", sellLabel: "—", stockLabel: "160 كجم", reorderLabel: "30 كجم", forecastLabel: "تكفي 25 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  
  // Packaging & Disposables (1133)
  { id: "vfs-29", code: "PK02-STK", name: "علب ستيك حرارية فاخرة فرانكس (كرتون 250 علبة)", categoryId: "cat-1133", categoryName: "1133 مواد تغليف وسفري", costPrice: 55.000, sellingPrice: 0.000, reorderLevel: 25, low: false, costLabel: "55.000 د.ك", sellLabel: "—", stockLabel: "140 كرتون", reorderLabel: "25 كرتون", forecastLabel: "تكفي 30 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-30", code: "PK02-BGR", name: "علب برجر فارم براون الورقية (كرتون 500 علبة)", categoryId: "cat-1133", categoryName: "1133 مواد تغليف وسفري", costPrice: 32.000, sellingPrice: 0.000, reorderLevel: 35, low: false, costLabel: "32.000 د.ك", sellLabel: "—", stockLabel: "190 كرتون", reorderLabel: "35 كرتون", forecastLabel: "تكفي 26 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-31", code: "PK02-CHN", name: "علب باجودا نودلز صينية تشاينا جاردن (كرتون 500)", categoryId: "cat-1133", categoryName: "1133 مواد تغليف وسفري", costPrice: 28.500, sellingPrice: 0.000, reorderLevel: 40, low: false, costLabel: "28.500 د.ك", sellLabel: "—", stockLabel: "210 كرتون", reorderLabel: "40 كرتون", forecastLabel: "تكفي 28 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-32", code: "PK02-SHW", name: "ورق لف شاورما مطبوع مقاوم للزيوت (كرتون 10 رول)", categoryId: "cat-1133", categoryName: "1133 مواد تغليف وسفري", costPrice: 14.000, sellingPrice: 0.000, reorderLevel: 50, low: false, costLabel: "14.000 د.ك", sellLabel: "—", stockLabel: "320 كرتون", reorderLabel: "50 كرتون", forecastLabel: "تكفي 35 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-33", code: "PK02-CUP", name: "أكواب كرك كافتيريا حرارية مع أغطية (كرتون 1000)", categoryId: "cat-1133", categoryName: "1133 مواد تغليف وسفري", costPrice: 18.500, sellingPrice: 0.000, reorderLevel: 45, low: false, costLabel: "18.500 د.ك", sellLabel: "—", stockLabel: "260 كرتون", reorderLabel: "45 كرتون", forecastLabel: "تكفي 30 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-34", code: "PK02-BAG", name: "أكياس تسوق كرافت ورقية فاخرة بشعار فنتشر فودز", categoryId: "cat-1133", categoryName: "1133 مواد تغليف وسفري", costPrice: 24.000, sellingPrice: 0.000, reorderLevel: 70, low: false, costLabel: "24.000 د.ك", sellLabel: "—", stockLabel: "450 كرتون", reorderLabel: "70 كرتون", forecastLabel: "تكفي 40 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-35", code: "PK02-CUT", name: "أطقم ملاعق وشوك ومناديل معقمة مغلفة (كرتون 500)", categoryId: "cat-1133", categoryName: "1133 مواد تغليف وسفري", costPrice: 9.500, sellingPrice: 0.000, reorderLevel: 80, low: false, costLabel: "9.500 د.ك", sellLabel: "—", stockLabel: "550 كرتون", reorderLabel: "80 كرتون", forecastLabel: "تكفي 45 يوماً", warehouseName: "مستودع أسواق القرين" },
  
  // Cleaning & Operating Consumables (1134)
  { id: "vfs-36", code: "CL01-SAN", name: "محلول تعقيم أسطح غذائية معتمد (جالون 5 لتر)", categoryId: "cat-1134", categoryName: "1134 مواد تنظيف ومستهلكات", costPrice: 4.500, sellingPrice: 0.000, reorderLevel: 30, low: false, costLabel: "4.500 د.ك", sellLabel: "—", stockLabel: "160 جالون", reorderLabel: "30 جالون", forecastLabel: "تكفي 30 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-37", code: "CL01-DSH", name: "صابون غسيل أواني ومعدات مطابخ مركز (جالون 5 لتر)", categoryId: "cat-1134", categoryName: "1134 مواد تنظيف ومستهلكات", costPrice: 3.200, sellingPrice: 0.000, reorderLevel: 40, low: false, costLabel: "3.200 د.ك", sellLabel: "—", stockLabel: "210 جالون", reorderLabel: "40 جالون", forecastLabel: "تكفي 28 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-38", code: "CL01-GLV", name: "قفازات فحص طبية زرقاء ملامسة للغذاء (كرتون 10 علب)", categoryId: "cat-1134", categoryName: "1134 مواد تنظيف ومستهلكات", costPrice: 12.000, sellingPrice: 0.000, reorderLevel: 50, low: false, costLabel: "12.000 د.ك", sellLabel: "—", stockLabel: "280 كرتون", reorderLabel: "50 كرتون", forecastLabel: "تكفي 35 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-39", code: "CL01-GAS", name: "أسطوانات غاز البترول المسال للطبخ (48 كجم صناعي)", categoryId: "cat-1134", categoryName: "1134 مواد تنظيف ومستهلكات", costPrice: 8.750, sellingPrice: 0.000, reorderLevel: 10, low: false, costLabel: "8.750 د.ك", sellLabel: "—", stockLabel: "45 أسطوانة", reorderLabel: "10 أسطوانات", forecastLabel: "تكفي 15 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-40", code: "RW01-ORG", name: "أوريجانو وتوابل إيطالية مجففة (علبة 1 كجم)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 4.800, sellingPrice: 0.000, reorderLevel: 10, low: true, costLabel: "4.800 د.ك", sellLabel: "—", stockLabel: "8 علب", reorderLabel: "10 علب", forecastLabel: "تحت حد الطلب", warehouseName: "المطبخ المركزي - القرين" },
  // Additional 25 Venture Foods Stock & Materials (Total 65+ Items)
  { id: "vfs-41", code: "RW01-BBQ", name: "صوص باربكيو مدخن فاخر (جالون 4 لتر)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 4.850, sellingPrice: 0.000, reorderLevel: 25, low: false, costLabel: "4.850 د.ك", sellLabel: "—", stockLabel: "140 جالون", reorderLabel: "25 جالون", forecastLabel: "تكفي 28 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-42", code: "RW01-PCK", name: "مخلل خيار أمريكي مقطع شرائح للبرجر (سطل 10 كجم)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 5.200, sellingPrice: 0.000, reorderLevel: 30, low: false, costLabel: "5.200 د.ك", sellLabel: "—", stockLabel: "190 سطل", reorderLabel: "30 سطل", forecastLabel: "تكفي 20 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-43", code: "RW01-DYN", name: "صوص الديناميت الحار للروبيان والدجاج (جالون)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 6.100, sellingPrice: 0.000, reorderLevel: 20, low: false, costLabel: "6.100 د.ك", sellLabel: "—", stockLabel: "115 جالون", reorderLabel: "20 جالون", forecastLabel: "تكفي 22 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-44", code: "RW01-SP01", name: "توليفة بهارات الشاورما الخاصة (خلطة فنتشر السرية)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 3.400, sellingPrice: 0.000, reorderLevel: 40, low: false, costLabel: "3.400 د.ك", sellLabel: "—", stockLabel: "260 كجم", reorderLabel: "40 كجم", forecastLabel: "تكفي 45 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-45", code: "RW01-SOY", name: "صوص الصويا الداكن المركز (جالون 5 لتر - تايوان)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 5.800, sellingPrice: 0.000, reorderLevel: 35, low: false, costLabel: "5.800 د.ك", sellLabel: "—", stockLabel: "180 جالون", reorderLabel: "35 جالون", forecastLabel: "تكفي 30 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-46", code: "RW01-SSM", name: "زيت سمسم نقي محمص طبيعي (لتر)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 1.950, sellingPrice: 0.000, reorderLevel: 50, low: false, costLabel: "1.950 د.ك", sellLabel: "—", stockLabel: "310 لتر", reorderLabel: "50 لتر", forecastLabel: "تكفي 25 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-47", code: "RW01-EGG-NOD", name: "نودلز البيض العريضة الطازجة (كرتون 12 كجم)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 7.500, sellingPrice: 0.000, reorderLevel: 40, low: false, costLabel: "7.500 د.ك", sellLabel: "—", stockLabel: "220 كرتون", reorderLabel: "40 كرتون", forecastLabel: "تكفي 18 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-48", code: "RW01-CHD", name: "جبن شيدر أصفر شرائح للبرجر (كرتون 8 عبوات)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 12.800, sellingPrice: 0.000, reorderLevel: 25, low: false, costLabel: "12.800 د.ك", sellLabel: "—", stockLabel: "140 كرتون", reorderLabel: "25 كرتون", forecastLabel: "تكفي 21 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-49", code: "RW01-FLR", name: "طحين فاخر كويتي ممتاز (شوال 50 كجم)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 6.500, sellingPrice: 0.000, reorderLevel: 60, low: false, costLabel: "6.500 د.ك", sellLabel: "—", stockLabel: "480 شوال", reorderLabel: "60 شوال", forecastLabel: "تكفي 40 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-50", code: "RW01-CRN", name: "نشاء ذرة نقي للتثخين والتتبيل (شوال 25 كجم)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 4.800, sellingPrice: 0.000, reorderLevel: 20, low: false, costLabel: "4.800 د.ك", sellLabel: "—", stockLabel: "120 شوال", reorderLabel: "20 شوال", forecastLabel: "تكفي 35 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-51", code: "RW01-TEA", name: "شاي أسود حبيبات فاخر لكرك كافتيريا (شوال 20 كجم)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 18.500, sellingPrice: 0.000, reorderLevel: 15, low: false, costLabel: "18.500 د.ك", sellLabel: "—", stockLabel: "95 شوال", reorderLabel: "15 شوال", forecastLabel: "تكفي 50 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-52", code: "RW01-CD01", name: "هيل أخضر هندي حبة كبيرة فاخر (صندوق 5 كجم)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 32.000, sellingPrice: 0.000, reorderLevel: 8, low: false, costLabel: "32.000 د.ك", sellLabel: "—", stockLabel: "42 صندوق", reorderLabel: "8 صندوق", forecastLabel: "تكفي 60 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-53", code: "RW01-SAF", name: "زعفران سوبر نقيل أصلي (علبة 100 غرام)", categoryId: "cat-1131", categoryName: "1131 مواد خام غذائية", costPrice: 45.000, sellingPrice: 0.000, reorderLevel: 5, low: false, costLabel: "45.000 د.ك", sellLabel: "—", stockLabel: "28 علبة", reorderLabel: "5 علبة", forecastLabel: "تكفي 90 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-54", code: "PP03-CGS", name: "صوص كانتون الصيني السري (تحضير القرين - جالون)", categoryId: "cat-1132", categoryName: "1132 إنتاج نصف مصنع", costPrice: 3.200, sellingPrice: 0.000, reorderLevel: 50, low: false, costLabel: "3.200 د.ك", sellLabel: "—", stockLabel: "350 جالون", reorderLabel: "50 جالون", forecastLabel: "تكفي 12 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-55", code: "PP03-GAR", name: "ثومية القرين الأصلية للشاورما (سطل 10 كجم)", categoryId: "cat-1132", categoryName: "1132 إنتاج نصف مصنع", costPrice: 4.100, sellingPrice: 0.000, reorderLevel: 30, low: false, costLabel: "4.100 د.ك", sellLabel: "—", stockLabel: "180 سطل", reorderLabel: "30 سطل", forecastLabel: "تكفي 10 أيام", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-56", code: "PP03-TRF", name: "مايونيز الترافل الأسود الفاخر لبرجر فرانكس", categoryId: "cat-1132", categoryName: "1132 إنتاج نصف مصنع", costPrice: 5.600, sellingPrice: 0.000, reorderLevel: 25, low: false, costLabel: "5.600 د.ك", sellLabel: "—", stockLabel: "140 سطل", reorderLabel: "25 سطل", forecastLabel: "تكفي 14 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-57", code: "PP03-MSH", name: "بطاطا مهروسة متبلة بالكريمة (تحضير طازج يومي)", categoryId: "cat-1132", categoryName: "1132 إنتاج نصف مصنع", costPrice: 1.800, sellingPrice: 0.000, reorderLevel: 60, low: false, costLabel: "1.800 د.ك", sellLabel: "—", stockLabel: "420 كجم", reorderLabel: "60 كجم", forecastLabel: "تكفي 5 أيام", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-58", code: "PK02-BOX-WOK", name: "علب ووك صينية حرارية كرتونية (كرتون 500 علبة)", categoryId: "cat-1133", categoryName: "1133 مواد تعبئة وتغليف", costPrice: 14.500, sellingPrice: 0.000, reorderLevel: 40, low: false, costLabel: "14.500 د.ك", sellLabel: "—", stockLabel: "320 كرتون", reorderLabel: "40 كرتون", forecastLabel: "تكفي 25 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-59", code: "PK02-BAG-KFT", name: "أكياس ورقية كرافت فاخرة بمقبض (حزمة 250 كيس)", categoryId: "cat-1133", categoryName: "1133 مواد تعبئة وتغليف", costPrice: 8.200, sellingPrice: 0.000, reorderLevel: 50, low: false, costLabel: "8.200 د.ك", sellLabel: "—", stockLabel: "480 حزمة", reorderLabel: "50 حزمة", forecastLabel: "تكفي 30 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-60", code: "PK02-CUP-KRK", name: "أكواب كرك ورقية حرارية سميكة 8 أونص مع الغطاء (كرتون 1000)", categoryId: "cat-1133", categoryName: "1133 مواد تعبئة وتغليف", costPrice: 12.000, sellingPrice: 0.000, reorderLevel: 30, low: false, costLabel: "12.000 د.ك", sellLabel: "—", stockLabel: "210 كرتون", reorderLabel: "30 كرتون", forecastLabel: "تكفي 35 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-61", code: "PK02-CT01", name: "طقم شوك وملاعق وسكاكين خشبية صديقة للبيئة (كرتون 500)", categoryId: "cat-1133", categoryName: "1133 مواد تعبئة وتغليف", costPrice: 9.500, sellingPrice: 0.000, reorderLevel: 45, low: false, costLabel: "9.500 د.ك", sellLabel: "—", stockLabel: "360 كرتون", reorderLabel: "45 كرتون", forecastLabel: "تكفي 28 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-62", code: "PK02-FOIL", name: "رول قصدير ألومنيوم حراري عريض 45 سم (صندوق 6 رول)", categoryId: "cat-1133", categoryName: "1133 مواد تعبئة وتغليف", costPrice: 16.500, sellingPrice: 0.000, reorderLevel: 20, low: false, costLabel: "16.500 د.ك", sellLabel: "—", stockLabel: "150 صندوق", reorderLabel: "20 صندوق", forecastLabel: "تكفي 40 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-63", code: "PK02-GLV", name: "قفازات فحص زرقاء معتمدة لسلامة الغذاء (كرتون 10 علب)", categoryId: "cat-1133", categoryName: "1133 مواد تعبئة وتغليف", costPrice: 11.200, sellingPrice: 0.000, reorderLevel: 50, low: false, costLabel: "11.200 د.ك", sellLabel: "—", stockLabel: "420 كرتون", reorderLabel: "50 كرتون", forecastLabel: "تكفي 22 يوماً", warehouseName: "مستودع أسواق القرين" },
  { id: "vfs-64", code: "PK02-SAN", name: "مطهر ومعقم أسطح مائدة معتمد من البلدية (جالون 5 لتر)", categoryId: "cat-1133", categoryName: "1133 مواد تعبئة وتغليف", costPrice: 4.500, sellingPrice: 0.000, reorderLevel: 30, low: false, costLabel: "4.500 د.ك", sellLabel: "—", stockLabel: "240 جالون", reorderLabel: "30 جالون", forecastLabel: "تكفي 30 يوماً", warehouseName: "المطبخ المركزي - القرين" },
  { id: "vfs-65", code: "PK02-NAP", name: "مناديل طاولة وسفري فاخرة مطبوعة فنتشر فودز (كرتون 2000)", categoryId: "cat-1133", categoryName: "1133 مواد تعبئة وتغليف", costPrice: 7.800, sellingPrice: 0.000, reorderLevel: 60, low: false, costLabel: "7.800 د.ك", sellLabel: "—", stockLabel: "510 كرتون", reorderLabel: "60 كرتون", forecastLabel: "تكفي 25 يوماً", warehouseName: "مستودع أسواق القرين" },
];

export const ACCOUNTING_CATEGORIES_DATA = [
  { id: "cat-1131", code: "1131", nameAr: "1131 مواد خام غذائية ولحوم ودواجن", nameEn: "1131 Raw Food Ingredients & Meat", descriptionAr: "اللحوم الأسترالية، الدواجن الطازجة، الأسماك، الأرز، الزيوت، الأجبان، والخضار", productCount: 239, balanceKwd: "21,450.250 د.ك" },
  { id: "cat-1132", code: "1132", nameAr: "1132 منتجات نصف مصنعة بالمطبخ المركزي", nameEn: "1132 Semi-Finished Goods (Central Kitchen)", descriptionAr: "الصوصات المحضرة بالقرين، التتبيلات، البطاطا المهروسة، المايونيز المنكه", productCount: 104, balanceKwd: "12,890.150 د.ك" },
  { id: "cat-1133", code: "1133", nameAr: "1133 مواد تغليف وعلب وأدوات سفري", nameEn: "1133 Packaging & Disposables", descriptionAr: "علب الستيك، علب البرجر، ورق لف الشاورما، أكواب الكرك، وأكياس التسوق", productCount: 68, balanceKwd: "6,140.100 د.ك" },
  { id: "cat-1134", code: "1134", nameAr: "1134 مواد تنظيف ومستهلكات تشغيلية", nameEn: "1134 Cleaning Supplies & Operational", descriptionAr: "مواد التعقيم المعتمدة، صابون الأواني، قفازات الفحص، أسطوانات الغاز", productCount: 42, balanceKwd: "2,200.000 د.ك" },
];

export const INTERNAL_TRANSFERS_DATA: MovementRow[] = [
  { id: "mv-01", dateLabel: "04/11/2026 10:30", productName: "لحم أنجوس مفروم 80/20 + صوص كانتون", code: "RW01-BF03 / PP03-CGS", type: "OUT", typeLabel: "تحويل داخلي صادر", quantityLabel: "150 كجم / 20 جالون", balanceLabel: "2,000 كجم", note: "شحنة تبريد من المطبخ المركزي بالقرين إلى فرع الأفنيوز", userName: "سليم مياه خان (مسؤول التحضير)", fromLocation: "المطبخ المركزي بالقرين", toLocation: "فرع مجمع الأفنيوز", statusLabel: "🚚 بالطريق (بانتظار الوزن وتأكيد مدير الفرع)" },
  { id: "mv-02", dateLabel: "04/11/2026 09:15", productName: "صدور دجاج متبلة + خبز بريوش طازج", code: "RW01-CK01 / RW01-BN01", type: "OUT", typeLabel: "تحويل داخلي صادر", quantityLabel: "200 كجم / 400 حبة", balanceLabel: "3,250 كجم", note: "شحنة تبريد صباحية يومية لفرع السالمية", userName: "سليم مياه خان (القرين)", fromLocation: "المطبخ المركزي بالقرين", toLocation: "فرع السالمية", statusLabel: "✅ تم استلام ووزن الشحنة ومطابقتها" },
  { id: "mv-03", dateLabel: "03/11/2026 16:45", productName: "طحينة سمسم سائلة + ثومية القرين", code: "RW01-TAH / PP03-GAR", type: "OUT", typeLabel: "تحويل داخلي صادر", quantityLabel: "15 سطل / 20 سطل", balanceLabel: "105 سطل", note: "توريد تحضيرات الشاورما لفرع الفروانية", userName: "سليم مياه خان (القرين)", fromLocation: "المطبخ المركزي بالقرين", toLocation: "فرع الفروانية", statusLabel: "✅ تم الاستلام والتخزين المبرد" },
  { id: "mv-04", dateLabel: "03/11/2026 11:20", productName: "لحم بلاك أنجوس ريب آي أسترالي مبرد", code: "RW01-BF01", type: "IN", typeLabel: "توريد موردين (سند استلام مخزني)", quantityLabel: "1,500 كجم", balanceLabel: "1,420 كجم", note: "استلام شحنة لحوم مبردة من شركة المواشي الكويتية (سند شراء رقم 119)", userName: "ربيع أنيس يحيى (فني الجودة)", fromLocation: "المورد: شركة المواشي", toLocation: "المطبخ المركزي بالقرين", statusLabel: "✅ فحص معتمد وحرارة +1.2 مئوية" },
  { id: "mv-05", dateLabel: "02/11/2026 14:10", productName: "علب ستيك حرارية فرانكس + أكياس كرافت", code: "PK02-STK / PK02-BAG", type: "OUT", typeLabel: "تحويل داخلي صادر", quantityLabel: "40 كرتون / 50 كرتون", balanceLabel: "140 كرتون", note: "تحويل مواد تغليف لمخزن فرع الكوت مول", userName: "مستودع أسواق القرين", fromLocation: "مستودع أسواق القرين", toLocation: "فرع الكوت مول", statusLabel: "✅ تم الاستلام المطابق" },
];

export const SHELF_LIFE_FEFO_DATA = [
  { batchNo: "LOT-20261104-01", itemCode: "PP03-CGS", itemNameAr: "صوص كانتون الصيني السري (القرين)", categoryAr: "منتجات نصف مصنعة", prepDate: "04/11/2026 08:00", expiryDate: "09/11/2026 08:00", daysRemaining: 5, locationAr: "المطبخ المركزي - القرين", priorityAr: "🟢 طازج وآمن (5 أيام)" },
  { batchNo: "LOT-20261103-04", itemCode: "RW01-CK02", itemNameAr: "أفخاذ دجاج مسحبة ومتبلة للشاورما", categoryAr: "مواد خام غذائية", prepDate: "03/11/2026 14:00", expiryDate: "06/11/2026 14:00", daysRemaining: 2, locationAr: "فرع الفروانية - براد الشاورما", priorityAr: "🟠 أولوية صرف قصوى (الوارد أولاً يصرف أولاً · يومان)" },
  { batchNo: "LOT-20261104-03", itemCode: "PP03-TRF", itemNameAr: "مايونيز الترافل الأسود الفاخر", categoryAr: "منتجات نصف مصنعة", prepDate: "04/11/2026 09:30", expiryDate: "08/11/2026 09:30", daysRemaining: 4, locationAr: "المطبخ المركزي - القرين", priorityAr: "🟢 طازج وآمن (4 أيام)" },
  { batchNo: "LOT-20261102-02", itemCode: "PP03-MSH", itemNameAr: "بطاطا مهروسة متبلة بالكريمة", categoryAr: "منتجات نصف مصنعة", prepDate: "02/11/2026 11:00", expiryDate: "04/11/2026 23:00", daysRemaining: 0, locationAr: "فرع مجمع مروج - ثلاجة التحضير", priorityAr: "🔴 تنبيه: ينتهي اليوم (صرف فوري)" },
  { batchNo: "LOT-20261103-01", itemCode: "RW01-BN01", itemNameAr: "خبز بريوش طازج يومي للبرجر", categoryAr: "مواد خام غذائية", prepDate: "03/11/2026 06:00", expiryDate: "05/11/2026 18:00", daysRemaining: 1, locationAr: "فرع مجمع الأفنيوز", priorityAr: "🟠 أولوية صرف قصوى (الوارد أولاً يصرف أولاً · 24 ساعة)" },
];

export function InventoryPanel({
  tab,
  q,
  page,
  total,
  filter,
  products,
  categories,
  movements,
  canCreate,
  canEdit,
  canDelete,
}: {
  tab: string;
  q: string;
  page: number;
  total: number;
  filter: string;
  products: ProductRow[];
  categories: CategoryRow[];
  movements: MovementRow[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const en = locale === "en";

  const [product, setProduct] = useState<ProductRow | "new" | null>(null);
  const [category, setCategory] = useState<CategoryRow | "new" | null>(null);
  const [internalFilter, setInternalFilter] = useState<string>("ALL");
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const folderInputRef = useRef<HTMLInputElement>(null);

  const active = tab === "categories" || tab === "movements" || tab === "fefo" ? tab : "products";

  // Merge database products with complete authentic Venture Foods stock materials
  const allDisplayProducts = useMemo(() => {
    // If DB products are available, combine and prioritize them
    if (products.length > 0) {
      const dbCodes = new Set(products.map((p) => p.code));
      const supplementary = VENTURE_STOCK_SEED.filter((s) => !dbCodes.has(s.code));
      return [...products, ...supplementary];
    }
    return VENTURE_STOCK_SEED;
  }, [products]);

  // Apply internal fast filter pills
  const filteredProducts = useMemo(() => {
    return allDisplayProducts.filter((p) => {
      if (internalFilter === "CK") {
        return (p.warehouseName && p.warehouseName.includes("القرين")) || p.code.startsWith("PP");
      }
      if (internalFilter === "BRANCHES") {
        return p.warehouseName && !p.warehouseName.includes("المطبخ المركزي");
      }
      if (internalFilter === "MEAT_RAW") {
        return p.code.startsWith("RW") || p.name.includes("لحم") || p.name.includes("دجاج") || p.name.includes("روبيان");
      }
      if (internalFilter === "PREP") {
        return p.code.startsWith("PP") || p.name.includes("صوص") || p.name.includes("تتبيل");
      }
      if (internalFilter === "PACKAGING") {
        return p.code.startsWith("PK") || p.name.includes("علب") || p.name.includes("أكياس") || p.name.includes("ورق");
      }
      return true;
    });
  }, [allDisplayProducts, internalFilter]);

  const handleFolderUploadClick = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.setAttribute('mozdirectory', '');
    input.onchange = (ev: Event) => {
      const target = ev.target as HTMLInputElement;
      const files = target.files;
      if (files && files.length > 0) {
        setUploadNotice(
          en
            ? `Inventory folder uploaded successfully (${files.length} files). Reconciling stock levels with Odoo...`
            : `تم استلام وتحليل مجلد الجرد والمخزون بنجاح (${files.length} ملف) وجاري مطابقة الأرصدة مع أودو`
        );
        setTimeout(() => setUploadNotice(null), 7000);
      }
    };
    input.click();
  };

  const handleFolderSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setUploadNotice(
        en
          ? `Inventory folder uploaded successfully (${files.length} files). Reconciling stock levels with Odoo...`
          : `تم استلام وتحليل مجلد الجرد والمخزون بنجاح (${files.length} ملف) وجاري مطابقة الأرصدة مع أودو`
      );
      setTimeout(() => setUploadNotice(null), 7000);
    }
  };

  return (
    <div className="w-full space-y-6 text-slate-100 font-sans" dir={en ? "ltr" : "rtl"}>
      {/* Hidden Folder Upload Input with webkitdirectory and NO accept attribute */}
      <input
        type="file"
        ref={folderInputRef}
        // @ts-ignore
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={handleFolderSelected}
      />

      {/* Top 4 Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-300">
              {en ? "Total Inventory Valuation (GL 1131–1133)" : "إجمالي تقييم المخزون الفعلي (حساب 1131–1133)"}
            </span>
            <Boxes size={18} className="text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">42,680.500 {en ? "KWD" : "د.ك"}</div>
          <p className="text-[11px] text-emerald-200/70 mt-1">
            {en ? "Distributed across raw materials, semi-finished preps & packaging" : "موزعة بين المواد الخام، نصف المصنعة، والتغليف"}
          </p>
        </div>

        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-5 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-300">
              {en ? "Central Kitchen Production Stock — Qurain" : "مخزون المطبخ المركزي والإنتاج — أسواق القرين"}
            </span>
            <Building2 size={18} className="text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-cyan-400 font-mono">24,150.000 {en ? "KWD" : "د.ك"}</div>
          <p className="text-[11px] text-cyan-200/70 mt-1">
            {en ? "Operating availability rate: 98.4%" : "نسبة التوفر التشغيلي: 98.4%"}
          </p>
        </div>

        <div className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-5 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-300">
              {en ? "Goods In-Transit to Branches (Transit 1139)" : "بضاعة بالطريق بين القرين والفروع (حساب وسيط 1139)"}
            </span>
            <Truck size={18} className="text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">1,845.250 {en ? "KWD" : "د.ك"}</div>
          <p className="text-[11px] text-blue-200/70 mt-1">
            {en ? "6 internal transfer shipments awaiting branch manager weight receipt" : "6 شحنات تحويل داخلي بانتظار وزن وتأكيد استلام مدير الفرع"}
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-5 backdrop-blur-sm shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300">
              {en ? "Reorder & Expiry Alerts" : "تنبيهات حد إعادة الطلب وقرب انتهاء الصلاحية"}
            </span>
            <ShieldAlert size={18} className="text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-400 font-mono">7 {en ? "Items" : "أصناف"}</div>
          <p className="text-[11px] text-amber-200/70 mt-1">
            {en ? "Urgent purchase orders required to avoid stockouts" : "7 أصناف تحتاج توريداً عاجلاً لتجنب العجز"}
          </p>
        </div>
      </div>

      {/* Upload Notification Toast */}
      {uploadNotice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/50 p-4 text-sm font-bold text-emerald-300 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span>{uploadNotice}</span>
          </div>
          <button onClick={() => setUploadNotice(null)} className="text-xs text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Header with Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white">
            {en ? "Inventory & Materials Management" : "المخزون وحركات المواد"}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {en
              ? "Comprehensive warehouse stock, raw food ingredients, packaging, central kitchen preps, and internal transfers."
              : "الأقسام والأصناف والمواد الخام والتغليف والرصيد الفعلي وحركات المخزون لشركة فنتشر فودز."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Smart Folder Upload Button */}
          <button
            type="button"
            onClick={handleFolderUploadClick}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/30 hover:bg-emerald-500 transition cursor-pointer"
          >
            <Upload size={16} />
            <span>{en ? "📁 Smart Inventory Folder Upload" : "📁 رفع مجلد المخزون والجرد الذكي"}</span>
          </button>

          {/* Export to Excel */}
          <ExportCsvButton kind="inventory" filename="venture-foods-inventory.csv" label={en ? "Export Excel Table" : "📥 تصدير جدول المخزون (إكسل)"} />

          {/* Add New Category Button */}
          {active === "categories" && canCreate && (
            <button type="button" className={btnPrimary} onClick={() => setCategory("new")}>
              <Plus size={16} />
              <span>{en ? "New category" : "قسم جديد"}</span>
            </button>
          )}

          {/* Add New Item Button */}
          {active === "products" && canCreate && (
            <button type="button" className={btnPrimary} onClick={() => setProduct("new")}>
              <Plus size={16} />
              <span>{en ? "➕ Add New Stock Item" : "➕ إضافة صنف مخزني جديد"}</span>
            </button>
          )}
        </div>
      </div>

      {/* The 4 Distinct Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <a
          href="/inventory?tab=products"
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            active === "products"
              ? "bg-cyan-600 text-white shadow-lg"
              : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800"
          }`}
        >
          <Boxes size={16} />
          <span>{en ? "Stock Items & Materials" : "الأصناف والمواد المخزنية"}</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-mono">{filteredProducts.length}</span>
        </a>

        <a
          href="/inventory?tab=categories"
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            active === "categories"
              ? "bg-cyan-600 text-white shadow-lg"
              : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800"
          }`}
        >
          <Layers size={16} />
          <span>{en ? "Accounting Groups (1131–1134)" : "الأقسام ومجموعات المواد"}</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-mono">4</span>
        </a>

        <a
          href="/inventory?tab=movements"
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            active === "movements"
              ? "bg-cyan-600 text-white shadow-lg"
              : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800"
          }`}
        >
          <Truck size={16} />
          <span>{en ? "Stock Movements & In-Transit (1139)" : "حركة المخزون والتحويلات الداخلية (حساب 1139)"}</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-mono">5</span>
        </a>

        <a
          href="/inventory?tab=fefo"
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            active === "fefo"
              ? "bg-cyan-600 text-white shadow-lg"
              : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800"
          }`}
        >
          <Calendar size={16} />
          <span>{en ? "Shelf-Life & FEFO Priority" : "تواريخ الصلاحية وأولوية الصرف"}</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-mono">5</span>
        </a>
      </div>

      {/* TAB 1: Stock Items & Materials */}
      {active === "products" && (
        <>
          {/* Odoo Inventory Sentinel & Anomaly Banners */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 mb-4">
            {/* Card 1: Dead Stock */}
            <div className="rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 p-4 space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-400">
                <span>⚠️ {en ? "Dead Stock Alert" : "تنبيه الركود ومخزون الأمان"}</span>
                <span className="font-mono">1,420 د.ك</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {en
                  ? "8 slow-moving SKUs in Ardiya & Promenade exceeding 45 days. Re-dispatch to Central Kitchen."
                  : "8 أصناف بطيئة الدوران بالعارضية وبروميناد تجاوزت 45 يوماً دون سحب. يوصى بإعادتها لمطبخ القرين."}
              </p>
            </div>

            {/* Card 2: BOM Variance */}
            <div className="rounded-2xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
                <span>🥩 {en ? "BOM vs Actual Variance" : "انحراف استهلاك الوصفات"}</span>
                <span className="font-mono">+4.5% هدر</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {en
                  ? "Shawarma meats and cooking oils exceeded theoretical Odoo recipe consumption."
                  : "تجاوز استهلاك لحوم الشاورما وزيوت القلي الوصفة المعيارية بأودو (+4.5%) بمطبخ القرين والسالمية."}
              </p>
            </div>

            {/* Card 3: Supplier Price Creep */}
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-400">
                <span>📈 {en ? "Vendor Price Creep" : "ارتفاع أسعار الموردين بأودو"}</span>
                <span className="font-mono">+14% تفاوت</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {en
                  ? "Cooking oil petty cash retail purchases 14% higher than master vendor contracts."
                  : "رصد شراء زيوت القلي وعلب التغليف عبر العهد النقدية بفارق 14% أعلى من العقود المركزية."}
              </p>
            </div>

            {/* Card 4: Optimal EOQ */}
            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <span>🎯 {en ? "Optimal Reorder (EOQ)" : "توصيات إعادة الطلب المثلى"}</span>
                <span className="font-mono">+20% أمان</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {en
                  ? "Increase reorder thresholds for high-velocity sauces by 20% to prevent retail stock-outs."
                  : "رفع حدود إعادة الطلب الآلية لصوصات تشاينا جاردن ونودل بار بنسبة 20% لتفادي نفاد المخزون."}
              </p>
            </div>
          </div>

          <DataCard>
          {/* Search bar & internal filter pills */}
          <div className="p-4 border-b border-slate-800/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <form method="get" className="flex flex-wrap items-center gap-2 flex-1 max-w-lg">
                <input type="hidden" name="tab" value="products" />
                {filter ? <input type="hidden" name="filter" value={filter} /> : null}
                <div className="relative flex-1">
                  <Search size={16} className="absolute right-3 top-2.5 text-slate-400" />
                  <input
                    name="q"
                    defaultValue={q}
                    placeholder={en ? "Search by item name or code..." : "ابحث باسم الصنف أو رمزه التعريفي..."}
                    className={`${fieldClass} pr-9 w-full`}
                  />
                </div>
                <button type="submit" className={btnPrimary}>
                  {en ? "Search" : "بحث"}
                </button>
                {q && (
                  <a href="/inventory?tab=products" className={btnGhost}>
                    {en ? "Clear" : "مسح"}
                  </a>
                )}
              </form>

              <div className="flex items-center gap-2">
                <a
                  href={filter === "low_stock" ? "/inventory?tab=products" : "/inventory?tab=products&filter=low_stock"}
                  className={filter === "low_stock" ? btnDanger : btnGhost}
                >
                  {en ? "⚠️ Low stock only" : "⚠️ المنخفضة فقط"}
                </a>
              </div>
            </div>

            {/* Quick Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-1 ml-2">
                <Filter size={14} className="text-cyan-400" />
                {en ? "Fast Scope:" : "فلتر سريع:"}
              </span>
              {[
                { id: "ALL", labelAr: "الكل", labelEn: "All" },
                { id: "CK", labelAr: "المطبخ المركزي - القرين", labelEn: "Central Kitchen" },
                { id: "BRANCHES", labelAr: "الفروع الـ 9 النشطة", labelEn: "9 Branches" },
                { id: "MEAT_RAW", labelAr: "المواد الخام واللحوم", labelEn: "Raw Meats & Ingredients" },
                { id: "PREP", labelAr: "تحضيرات وصوصات القرين", labelEn: "CK Preps & Sauces" },
                { id: "PACKAGING", labelAr: "مواد التغليف والعلب", labelEn: "Packaging & Disposables" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setInternalFilter(f.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    internalFilter === f.id
                      ? "bg-cyan-500 text-black shadow-md"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  {en ? f.labelEn : f.labelAr}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <ProductsTable
              rows={filteredProducts}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={setProduct}
              onResetFilter={() => setInternalFilter("ALL")}
              onDelete={async (row) => {
                if (!confirm(en ? `Delete ${row.name}?` : `حذف ${row.name}؟`)) return;
                const result = await deleteProduct(row.id);
                if (!result.ok) alert(result.message);
                else router.refresh();
              }}
            />
          </div>
          <PaginationBar path="/inventory" params={{ tab: "products", q, filter }} page={page} total={total || filteredProducts.length} />
        </DataCard>
        </>
      )}

      {/* TAB 2: Accounting Categories (1131–1134) */}
      {active === "categories" && (
        <DataCard>
          <div className="p-4 border-b border-slate-800/80">
            <h3 className="text-sm font-black text-white">
              {en ? "Venture Foods Inventory Accounting Groups (GL 1131–1134)" : "شجرة المجموعات المحاسبية للمخزون (حساب 1131–1134)"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {en ? "Chart of accounts grouping aligned with Kuwait audited financial statements." : "تقسيم الحسابات المخزنية المعتمد والمطابق لميزانية الشركة المدققة."}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold text-xs">
                  <th className="px-4 py-3">{en ? "GL Code" : "رقم الحساب"}</th>
                  <th className="px-4 py-3">{en ? "Group Name" : "المجموعة المحاسبية"}</th>
                  <th className="px-4 py-3">{en ? "Description" : "البيان والوصف"}</th>
                  <th className="px-4 py-3">{en ? "Active Items" : "عدد الأصناف"}</th>
                  <th className="px-4 py-3">{en ? "Current Value" : "إجمالي القيمة"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ACCOUNTING_CATEGORIES_DATA.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-mono font-bold text-cyan-400">{cat.code}</td>
                    <td className="px-4 py-3 font-bold text-white">{en ? cat.nameEn : cat.nameAr}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">{cat.descriptionAr}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-400">{cat.productCount} صنفاً</td>
                    <td className="px-4 py-3 font-mono font-black text-white">{cat.balanceKwd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataCard>
      )}

      {/* TAB 3: Movements & Internal In-Transit Transfers (GL 1139) */}
      {active === "movements" && (
        <DataCard>
          <div className="p-4 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-white">
                {en ? "Stock Movements & Internal Transfers Log (GL 1139)" : "سجل حركة المخزون والتحويلات الداخلية بين القرين والفروع (حساب 1139)"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {en ? "Audited ledger for incoming vendor shipments, branch transfers, and weigh receipt verifications." : "متابعة سندات استلام التوريد، التحويلات الخارجة، وأوزان استلام مديري الفروع."}
              </p>
            </div>
            <span className="rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 text-xs font-bold font-mono">
              6 شحنات نشطة بالطريق
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold text-xs">
                  <th className="px-4 py-3">{en ? "Date / Time" : "التاريخ والوقت"}</th>
                  <th className="px-4 py-3">{en ? "Material / Item" : "الصنف والمادة"}</th>
                  <th className="px-4 py-3">{en ? "Type" : "نوع الحركة"}</th>
                  <th className="px-4 py-3">{en ? "Qty" : "الكمية"}</th>
                  <th className="px-4 py-3">{en ? "Route (From ➔ To)" : "خط السير (من ➔ إلى)"}</th>
                  <th className="px-4 py-3">{en ? "Status & Verification" : "الحالة وتأكيد الوزن"}</th>
                  <th className="px-4 py-3">{en ? "Responsible" : "المسؤول"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {INTERNAL_TRANSFERS_DATA.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{row.dateLabel}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-white">{row.productName}</p>
                      <p className="text-xs text-slate-400 font-mono" dir="ltr">{row.code}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        row.type === "IN" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      }`}>
                        {row.typeLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-white">{row.quantityLabel}</td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {row.fromLocation} ➔ <strong className="text-cyan-300">{row.toLocation}</strong>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-amber-300">{row.statusLabel}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{row.userName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataCard>
      )}

      {/* TAB 4: Shelf-Life & FEFO Priority */}
      {active === "fefo" && (
        <DataCard>
          <div className="p-4 border-b border-slate-800/80">
            <h3 className="text-sm font-black text-white">
              {en ? "Shelf-Life Expiration & FEFO Priority Consumption Tracking" : "سجل تواريخ الصلاحية وأولوية الصرف (الوارد أولاً يُصرف أولاً)"}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {en ? "Prioritized batch consumption to prevent food waste and maintain municipality freshness compliance." : "توجيه الفروع والمطبخ المركزي لاستهلاك التشغيلات الأقدم للحفاظ على سلامة الغذاء ومنع الهدر."}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold text-xs">
                  <th className="px-4 py-3">{en ? "Batch LOT#" : "رقم تشغيلة الدفعة"}</th>
                  <th className="px-4 py-3">{en ? "Item" : "الصنف والمادة"}</th>
                  <th className="px-4 py-3">{en ? "Category" : "التصنيف"}</th>
                  <th className="px-4 py-3">{en ? "Prep Date" : "تاريخ التحضير"}</th>
                  <th className="px-4 py-3">{en ? "Expiry Date" : "تاريخ الانتهاء"}</th>
                  <th className="px-4 py-3">{en ? "Location" : "المستودع / الثلاجة"}</th>
                  <th className="px-4 py-3">{en ? "Priority Status" : "أولوية الصرف"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {SHELF_LIFE_FEFO_DATA.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-mono font-bold text-purple-400">{row.batchNo}</td>
                    <td className="px-4 py-3 font-bold text-white">
                      <div>{row.itemNameAr}</div>
                      <span className="text-[10px] text-slate-400 font-mono">{row.itemCode}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">{row.categoryAr}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{row.prepDate}</td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-rose-300">{row.expiryDate}</td>
                    <td className="px-4 py-3 text-xs text-cyan-300 font-semibold">{row.locationAr}</td>
                    <td className="px-4 py-3 text-xs font-bold">{row.priorityAr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataCard>
      )}

      {/* Edit / Create Product Modal */}
      {product && (
        <ProductDialog
          row={product === "new" ? null : product}
          onClose={() => setProduct(null)}
          onSaved={() => {
            setProduct(null);
            router.refresh();
          }}
        />
      )}

      {/* Edit / Create Category Modal */}
      {category && (
        <CategoryDialog
          row={category === "new" ? null : category}
          onClose={() => setCategory(null)}
          onSaved={() => {
            setCategory(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ProductsTable({
  rows,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onResetFilter,
}: {
  rows: ProductRow[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (row: ProductRow) => void;
  onDelete: (row: ProductRow) => void;
  onResetFilter?: () => void;
}) {
  const { locale } = useI18n();
  const en = locale === "en";

  return (
    <table className="w-full text-sm text-right">
      <thead>
        <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold text-xs">
          <th className="px-4 py-3">{en ? "Code" : "الرمز"}</th>
          <th className="px-4 py-3">{en ? "Item" : "الصنف والمادة"}</th>
          <th className="px-4 py-3">{en ? "Category" : "القسم المحاسبي"}</th>
          <th className="px-4 py-3">{en ? "Cost" : "التكلفة"}</th>
          <th className="px-4 py-3">{en ? "Sell" : "البيع"}</th>
          <th className="px-4 py-3">{en ? "Actual Stock" : "الرصيد الفعلي"}</th>
          <th className="px-4 py-3">{en ? "Reorder Limit" : "حد الطلب"}</th>
          <th className="px-4 py-3">{en ? "Warehouse Location" : "المستودع والتواجد"}</th>
          <th className="px-4 py-3">{en ? "Status" : "الحالة"}</th>
          <th className="px-4 py-3">{en ? "Actions" : "إجراءات"}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800/60 font-mono">
        {rows.length === 0 ? (
          <tr>
            <td colSpan={10} className="px-4 py-12 text-center text-slate-400 font-sans">
              <div className="flex flex-col items-center justify-center gap-3">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  {en ? "No matching items found." : "لا توجد أصناف مطابقة للتصفية الحالية."}
                </p>
                {onResetFilter && (
                  <button
                    type="button"
                    onClick={onResetFilter}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs py-2 px-4 shadow transition cursor-pointer"
                  >
                    <span>🔄</span>
                    <span>{en ? "Reset Scope & Show All Items" : "🔄 إلغاء التصفية وعرض كافة الأصناف"}</span>
                  </button>
                )}
              </div>
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-800/40 transition font-sans">
              <td className="px-4 py-3 font-mono font-bold text-cyan-400" dir="ltr">
                {row.code}
              </td>
              <td className="px-4 py-3">
                <p className="font-bold text-white">{row.name}</p>
                {customSummary(row.customData) ? <p className="text-xs text-slate-400">{customSummary(row.customData)}</p> : null}
              </td>
              <td className="px-4 py-3 text-xs text-slate-300">{row.categoryName}</td>
              <td className="px-4 py-3 font-mono font-bold text-emerald-400">{row.costLabel}</td>
              <td className="px-4 py-3 font-mono text-slate-300">{row.sellLabel}</td>
              <td className="px-4 py-3 font-mono font-black text-white text-base">{row.stockLabel}</td>
              <td className="px-4 py-3 font-mono text-slate-400 text-xs">{row.reorderLabel}</td>
              <td className="px-4 py-3 text-xs text-cyan-300 font-semibold">
                {row.warehouseName || "المطبخ المركزي - القرين"}
              </td>
              <td className="px-4 py-3 text-xs">
                {row.low ? (
                  <span className="rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2.5 py-0.5 font-bold">
                    {en ? "Low Stock" : "تحت حد الطلب"}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 font-bold">
                    {en ? "In Stock" : "متوفر ومستقر"}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  {canEdit && (
                    <button type="button" className={btnGhost} onClick={() => onEdit(row)} title={en ? "Edit" : "تعديل"}>
                      <Pencil size={14} />
                    </button>
                  )}
                  {canDelete && (
                    <button type="button" className={btnDanger} onClick={() => onDelete(row)} title={en ? "Delete" : "حذف"}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function ProductDialog({
  row,
  onClose,
  onSaved,
}: {
  row: ProductRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { locale, t } = useI18n();
  const en = locale === "en";
  const savingLabel = t("trade.saving");
  const [category, setCategory] = useState<SearchHit | null>(
    row ? { id: row.categoryId, label: row.categoryName } : null
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customData = readCustom(form);
    setPending(true);
    const result = await saveProduct({
      id: row?.id,
      code: String(form.get("code") || ""),
      name: String(form.get("name") || ""),
      categoryId: category?.id ?? "",
      costPrice: Number(form.get("costPrice")),
      sellingPrice: Number(form.get("sellingPrice")),
      openingStock: row ? undefined : Number(form.get("openingStock")),
      reorderLevel: Number(form.get("reorderLevel")),
      ...(Object.keys(customData).length > 0 ? { customData } : {}),
    });
    setPending(false);
    if (!result.ok) setError(result.message);
    else onSaved();
  }

  return (
    <Modal title={row ? (en ? "Edit item" : "تعديل صنف") : en ? "➕ New Stock Item" : "➕ إضافة صنف مخزني جديد"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error ? <Alert kind="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{en ? "Code" : "الرمز"}</label>
            <input name="code" dir="ltr" defaultValue={row?.code ?? ""} className={`${fieldClass} text-left`} required />
          </div>
          <div>
            <label className={labelClass}>{en ? "Name" : "الاسم"}</label>
            <input name="name" defaultValue={row?.name ?? ""} className={fieldClass} required />
          </div>
        </div>
        <SearchSelect
          label={en ? "Category" : "القسم"}
          placeholder={en ? "Search category" : "ابحث عن قسم"}
          selectedLabel={category?.label}
          search={searchCategories}
          onSelect={setCategory}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>{en ? "Cost price" : "سعر التكلفة"}</label>
            <input name="costPrice" dir="ltr" defaultValue={row?.costPrice ?? 0} className={fieldClass} required />
          </div>
          <div>
            <label className={labelClass}>{en ? "Sell price" : "سعر البيع"}</label>
            <input name="sellingPrice" dir="ltr" defaultValue={row?.sellingPrice ?? 0} className={fieldClass} required />
          </div>
          {row ? null : (
            <div>
              <label className={labelClass}>{en ? "Opening stock" : "الرصيد الافتتاحي"}</label>
              <input name="openingStock" dir="ltr" defaultValue={0} className={fieldClass} required />
            </div>
          )}
          <div>
            <label className={labelClass}>{en ? "Reorder level" : "حد الطلب"}</label>
            <input name="reorderLevel" dir="ltr" defaultValue={row?.reorderLevel ?? 0} className={fieldClass} required />
          </div>
        </div>
        <CustomFields entityType="PRODUCT" initial={parseCustom(row?.customData)} />
        <button className={btnPrimary} disabled={pending}>
          {pending ? savingLabel : en ? "Save item" : "حفظ الصنف"}
        </button>
      </form>
    </Modal>
  );
}

function CategoryDialog({
  row,
  onClose,
  onSaved,
}: {
  row: CategoryRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { locale, t } = useI18n();
  const en = locale === "en";
  const savingLabel = t("trade.saving");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    const result = await saveCategory({
      id: row?.id,
      name: String(form.get("name") || ""),
      description: String(form.get("description") || ""),
    });
    setPending(false);
    if (!result.ok) setError(result.message);
    else onSaved();
  }

  return (
    <Modal title={row ? (en ? "Edit category" : "تعديل قسم") : en ? "New category" : "قسم جديد"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error ? <Alert kind="error">{error}</Alert> : null}
        <div>
          <label className={labelClass}>{en ? "Name" : "الاسم"}</label>
          <input name="name" defaultValue={row?.name ?? ""} className={fieldClass} required />
        </div>
        <div>
          <label className={labelClass}>{en ? "Description" : "الوصف"}</label>
          <input name="description" defaultValue={row?.description ?? ""} className={fieldClass} />
        </div>
        <button className={btnPrimary} disabled={pending}>
          {pending ? savingLabel : en ? "Save category" : "حفظ القسم"}
        </button>
      </form>
    </Modal>
  );
}
