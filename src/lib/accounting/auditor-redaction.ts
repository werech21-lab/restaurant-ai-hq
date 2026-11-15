/**
 * Server & Client-safe custodian / personal-name redaction for the Read-Only Auditor (`auditor`) role.
 * Replaces personal names of petty cash custodians, PRO brokers, technicians, and staff with
 * functional operational cost-center labels while preserving 100% of KWD totals, GL codes, and transaction counts.
 */

const ARABIC_NAME_REPLACEMENTS: ReadonlyArray< readonly [RegExp, string] > = [
  [/مكتب سند للتخليص والخدمات الحكومية/g, 'عهدة التعقيب والخدمات الحكومية #1'],
  [/سند للتعقيب والخدمات الحكومية/g, 'عهدة التعقيب والخدمات الحكومية #1'],
  [/مكتب سند للتعقيب/g, 'عهدة التعقيب الحكومي #1'],
  [/مكتب التعقيب الحكومي \(سند\)/g, 'مركز التعقيب الحكومي المعتمد (#1)'],
  [/كشوفات \(سند\)/g, 'كشوفات التعقيب الحكومي (#1)'],
  [/كشف \(سند\)/g, 'كشف عهدة التعقيب الحكومي (#1)'],
  [/عبر \(سند\)/g, 'عبر عهدة التعقيب (#1)'],
  [/مصروفات \(سند\)/g, 'مصروفات عهدة التعقيب (#1)'],
  [/مشتريات سند/g, 'مشتريات العهدة التشغيلية #1'],
  [/عهدة مكتب سند/g, 'عهدة التعقيب الحكومي #1'],
  [/\(سند\)/g, '(عهدة #1)'],
  [/ربيع أنيس يحيى/g, 'عهدة صيانة التبريد والمطابخ #2'],
  [/ربيع عطا طه/g, 'عهدة صيانة التبريد والمطابخ #2'],
  [/ربيع طه/g, 'عهدة الصيانة #2'],
  [/شيلا أمبوس بولبولي/g, 'عهدة إسناد وتشغيل الفروع #3'],
  [/أمجد سمير حسين/g, 'عهدة الحركة والأسطول #4'],
  [/أمجد سمير/g, 'عهدة الحركة والأسطول #4'],
  [/\(أمجد\)/g, '(عهدة #4)'],
  [/شيام حكمت كومار/g, 'عهدة تشغيل المطبخ المركزي #5'],
  [/\(شيام\)/g, '(عهدة #5)'],
  [/شيام \(/g, 'عهدة #5 ('],
  [/نادر نزهي البستاني/g, 'عهدة الشؤون الإدارية #6'],
  [/نادر نزهي/g, 'عهدة الشؤون الإدارية #6'],
  [/شكر الله ناصيف الهاشم/g, 'عهدة الجودة والفعاليات #7'],
  [/شكر الله ناصيف/g, 'عهدة الجودة والفعاليات #7'],
  [/نوشا أسانار شريف/g, 'عهدة طوارئ الفروع #8'],
  [/نوشا شريف/g, 'عهدة طوارئ الفروع #8'],
  [/أحمد العوضي/g, 'محاسب أول معتمد'],
  [/طارق عبد المنعم/g, 'مشرف تشغيل معتمد'],
  [/محمد عمران/g, 'سائق تشغيلي'],
  [/جاسم الدين/g, 'سائق تشغيلي'],
  [/سونيل كومار/g, 'سائق تشغيلي'],
  [/كبير حسين/g, 'سائق تشغيلي'],
  [/بلال حسين/g, 'سائق تشغيلي'],
]

const ENGLISH_NAME_REPLACEMENTS: ReadonlyArray< readonly [RegExp, string] > = [
  [/Sanad PRO & Government Clearances/gi, 'Gov Clearance Custody #1'],
  [/Sanad PRO & Govt Services/gi, 'Gov Clearance Custody #1'],
  [/Sanad Broker/gi, 'Custody Center #1'],
  [/Sanad Statement/gi, 'Custody #1 Statement'],
  [/Sanad PRO/gi, 'Gov Clearance Custody #1'],
  [/Top Sanad/gi, 'Top Custody #1'],
  [/Sanad Hub/gi, 'Clearance Hub #1'],
  [/\(Sanad\)/gi, '(Custody #1)'],
  [/\bSanad\b/gi, 'Custody #1'],
  [/Rabih Anis Yahia/gi, 'Cold-Chain Maintenance Custody #2'],
  [/Rabih Anis Yahya/gi, 'Cold-Chain Maintenance Custody #2'],
  [/Rabih Atta Taha/gi, 'Cold-Chain Maintenance Custody #2'],
  [/Rabih Yahia/gi, 'Maintenance Custody #2'],
  [/\(Rabih\)/gi, '(Custody #2)'],
  [/\bRabih\b/gi, 'Custody #2'],
  [/Sheila Ambos Bulbuli/gi, 'Branch Ops Custody #3'],
  [/Sheila Ambos Bulboli/gi, 'Branch Ops Custody #3'],
  [/\bSheila\b/gi, 'Custody #3'],
  [/Amjad Samir Hussein/gi, 'Fleet & Movement Custody #4'],
  [/Amjad Samir/gi, 'Fleet & Movement Custody #4'],
  [/\(Amjad\)/gi, '(Custody #4)'],
  [/\bAmjad\b/gi, 'Custody #4'],
  [/Shyam Hikmat Kumar/gi, 'Central Kitchen Custody #5'],
  [/\(Shyam\)/gi, '(Custody #5)'],
  [/\bShyam\b/gi, 'Custody #5'],
  [/Nader Nezha Bustani/gi, 'Admin Services Custody #6'],
  [/Nader Nezhy/gi, 'Admin Services Custody #6'],
  [/\bNader\b/gi, 'Custody #6'],
  [/Choukrallah Nassif/gi, 'Quality & Events Custody #7'],
  [/Shokrallah Nassif/gi, 'Quality & Events Custody #7'],
  [/Nusha Asanar Sharif/gi, 'Branch Contingency Custody #8'],
  [/Nousha Sharif/gi, 'Branch Contingency Custody #8'],
]

export function redactAuditorPersonalNames(text: string | undefined | null, isAuditor?: boolean): string {
  const raw = String(text ?? '')
  if (!isAuditor || !raw) return raw
  let out = raw
  for (const [pattern, replacement] of ARABIC_NAME_REPLACEMENTS) {
    out = out.replace(pattern, replacement)
  }
  for (const [pattern, replacement] of ENGLISH_NAME_REPLACEMENTS) {
    out = out.replace(pattern, replacement)
  }
  return out
}

export function mapAuditorCustodianDisplay(
  indexOneBased: number,
  nameAr: string,
  nameEn: string,
  isAuditor?: boolean,
): { idCode: string; nameAr: string; nameEn: string; shortPillAr: string; shortPillEn: string } {
  if (!isAuditor) {
    return {
      idCode: `CUST-0${indexOneBased}`,
      nameAr,
      nameEn,
      shortPillAr: nameAr.split(' ')[0] || nameAr,
      shortPillEn: nameEn.split(' ')[0] || nameEn,
    }
  }
  const labelsAr: Record<number, string> = {
    1: 'عهدة التعقيب الحكومي #1',
    2: 'عهدة صيانة التبريد والمطابخ #2',
    3: 'عهدة إسناد وتشغيل الفروع #3',
    4: 'عهدة الحركة والأسطول #4',
    5: 'عهدة تشغيل المطبخ المركزي #5',
    6: 'عهدة الشؤون الإدارية #6',
    7: 'عهدة الجودة والفعاليات #7',
    8: 'عهدة طوارئ الفروع #8',
  }
  const labelsEn: Record<number, string> = {
    1: 'Operational Custody #1 (Gov)',
    2: 'Operational Custody #2 (Maint)',
    3: 'Operational Custody #3 (Branch)',
    4: 'Operational Custody #4 (Fleet)',
    5: 'Operational Custody #5 (Kitchen)',
    6: 'Operational Custody #6 (Admin)',
    7: 'Operational Custody #7 (Quality)',
    8: 'Operational Custody #8 (Contingency)',
  }
  return {
    idCode: `CUST-0${indexOneBased}`,
    nameAr: labelsAr[indexOneBased] ?? `عهدة تشغيلية #${indexOneBased}`,
    nameEn: labelsEn[indexOneBased] ?? `Operational Custody #${indexOneBased}`,
    shortPillAr: `عهدة #${indexOneBased}`,
    shortPillEn: `Custody #${indexOneBased}`,
  }
}
