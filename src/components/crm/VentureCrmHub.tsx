'use client'

import React, { useState } from 'react'
import {
  UtensilsCrossed,
  Crown,
  MessageSquare,
  Gift,
  Plus,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Users,
  Search,
  Star,
  Send,
  Sparkles,
  PhoneCall,
  Clock,
  TrendingUp,
} from 'lucide-react'

export function VentureCrmHub({
  locale = 'ar',
  liveChildren,
}: {
  locale?: 'ar' | 'en'
  liveChildren?: React.ReactNode
}) {
  const [activeTab, setActiveTab] = useState<'catering' | 'vip' | 'feedback' | 'campaigns' | 'legacy'>('catering')
  const [currentLocale, setCurrentLocale] = useState<'ar' | 'en'>(locale)
  const [showNewContractModal, setShowNewContractModal] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const isAr = currentLocale === 'ar'
  const isRtl = isAr

  const showToast = (msg: string) => {
    setNotice(msg)
    setTimeout(() => setNotice(null), 4000)
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="w-full max-w-none min-h-screen bg-[#0a0d12] text-slate-100 p-3 sm:p-6 space-y-6"
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-400">
              <Crown size={14} />
              {isAr ? 'علاقات العملاء والكاترينج المؤسسي' : 'B2B Corporate Catering & VIP CRM'}
            </span>
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
              {isAr ? 'فنتشر فودز ذ.م.م.' : 'Venture Foods W.L.L.'}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
            {isAr ? 'مركز إدارة عقود الشركات والكاترينج وكبار العملاء' : 'Enterprise Catering Contracts & VIP Loyalty Engine'}
          </h1>
          <p className="text-xs text-slate-400">
            {isAr
              ? 'إدارة عقود توريد الوجبات للشركات، مقاصف الجامعات، فعاليات المعارض، وتتبع ولاء كبار العملاء'
              : 'Managing B2B Catering Pipelines, VIP Customer LTV, Service Feedback, and Seasonal Campaigns'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentLocale(isAr ? 'en' : 'ar')}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            {isAr ? 'English (LTR)' : 'عربي (RTL)'}
          </button>
          <button
            onClick={() => setShowNewContractModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-purple-500 px-4 py-2 text-xs font-bold text-white hover:bg-purple-400 transition-all shadow-lg shadow-purple-500/10"
          >
            <Plus size={15} />
            {isAr ? 'عقد كاترينج جديد' : 'New Catering Deal'}
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-3 text-xs font-semibold text-emerald-300 shadow-xl flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            {notice}
          </span>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* 4 Specialized Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800 pb-3">
        {[
          { key: 'catering', labelAr: '🍱 عقود الكاترينج، الشركات، والمقاصف', labelEn: 'B2B Catering & Corporate Contracts', icon: UtensilsCrossed },
          { key: 'vip', labelAr: '👑 كبار العملاء ومؤشرات الولاء الدائم', labelEn: 'VIP Customers & Repeat Analytics', icon: Crown },
          { key: 'feedback', labelAr: '💬 مركز جودة الخدمة ومعالجة الملاحظات', labelEn: 'Service Reviews & Incident Resolution', icon: MessageSquare },
          { key: 'campaigns', labelAr: '🎁 الحملات الترويجية وعروض الواتساب', labelEn: 'Seasonal Campaigns & WhatsApp Offers', icon: Gift },
          ...(liveChildren ? [{ key: 'legacy', labelAr: '⚙️ لوحة الفرص وعروض الأسعار المعتمدة', labelEn: 'Database Leads & Quotes', icon: Building2 }] : []),
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                active
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/10'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
              }`}
            >
              <Icon size={15} />
              <span>{isAr ? tab.labelAr : tab.labelEn}</span>
            </button>
          )
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: B2B CORPORATE CATERING PIPELINE                                    */}
      {/* ========================================================================= */}
      {activeTab === 'catering' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'قيمة عقود الكاترينج النشطة' : 'Active Catering Value'}</span>
              <p className="mt-1 text-2xl font-black text-amber-400">38,900.000 {isAr ? 'د.ك' : 'KWD'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? 'عقود تموين وبوفيهات شركات' : '14 active enterprise contracts'}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'الوجبات الموردة شهرياً' : 'Monthly Meals Supplied'}</span>
              <p className="mt-1 text-2xl font-black text-emerald-400">12,400 {isAr ? 'وجبة' : 'Meals'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? 'من المطبخ المركزي' : 'Prepared at Central Kitchen'}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'متوسط قيمة العقد' : 'Avg Deal Size'}</span>
              <p className="mt-1 text-2xl font-black text-purple-400">2,780.000 {isAr ? 'د.ك' : 'KWD'}</p>
              <span className="text-[11px] text-slate-500">{isAr ? 'عقود ربع سنوية وسنوية' : 'Quarterly & annual basis'}</span>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0f172a]/60 p-4">
              <span className="text-xs text-slate-400">{isAr ? 'نسبة التحصيل والالتزام' : 'Collection Rate'}</span>
              <p className="mt-1 text-2xl font-black text-blue-400">96.8%</p>
              <span className="text-[11px] text-slate-500">{isAr ? 'تحصيل بموجب فواتير رسمية' : 'Official tax invoices'}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-right">{isAr ? 'الشركة / الجهة المتعاقدة' : 'Corporate Account'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'طبيعة العقد' : 'Contract Scope'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'عدد الأفراد والوجبات' : 'Daily PAX'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'قيمة العقد (د.ك)' : 'Contract Value'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'المسدد (د.ك)' : 'Collected'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'البراند المورد' : 'Assigned Brand'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'المرحلة' : 'Pipeline Stage'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { client: 'شركة مشاريع الكويت القابضة (كيبكو)', scope: 'بوفيه غداء تنفيذي وضيافة مؤتمرات', pax: '120 فرد', val: '6,450.000', paid: '5,200.000', brand: isAr ? 'فرانكس ستيك' : "Frank's Steak", stage: 'ساري ومنفذ' },
                    { client: 'مجموعة التمدين العقارية (360 مول)', scope: 'إعاشة فعاليات مهرجان التسوق', pax: '350 فرد', val: '4,800.000', paid: '4,800.000', brand: isAr ? 'تشاينا جاردن' : 'China Garden', stage: 'مكتمل ومسدد' },
                    { client: 'جامعة الخليج للعلوم والتكنولوجيا (GUST)', scope: 'تشغيل ركن كافتيريا الطلاب', pax: '450 وجبة/يوم', val: '9,200.000', paid: '6,400.000', brand: isAr ? 'شاورما طحينة' : 'Tahina', stage: 'ساري ومنفذ' },
                    { client: 'بنك بوبيان - الإدارة العامة', scope: 'ضيافة اجتماعات مجالس الإدارة', pax: '80 فرد', val: '3,900.000', paid: '3,900.000', brand: isAr ? 'فرانكس ستيك' : "Frank's Steak", stage: 'مكتمل ومسدد' },
                    { client: 'أرض المعارض الدولية (مشرف - صالة 4)', scope: 'كشك طعام سريع بمعرض العطور والسيارات', pax: '600 وجبة/يوم', val: '8,400.000', paid: '4,200.000', brand: isAr ? 'فرانكس' : "Frank's", stage: 'تجهيز وتوريد' },
                    { client: 'نادي القادسية الرياضي', scope: 'وجبات رياضية غنية بالبروتين للفرق الأولى', pax: '60 لاعب', val: '3,600.000', paid: '2,600.000', brand: isAr ? 'فارم براون' : 'Farm Brown', stage: 'ساري ومنفذ' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{row.client}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">{row.scope}</td>
                      <td className="px-4 py-3 text-center font-mono font-semibold text-amber-400">{row.pax}</td>
                      <td className="px-4 py-3 font-mono font-bold text-white text-right">{row.val} د.ك</td>
                      <td className="px-4 py-3 font-mono text-emerald-400 text-right">{row.paid} د.ك</td>
                      <td className="px-4 py-3 text-center text-xs text-purple-300 font-semibold">{row.brand}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                          row.stage.includes('مسدد') || row.stage.includes('منفذ')
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        }`}>
                          {row.stage}
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
      {/* TAB 2: VIP CUSTOMERS & REPEAT ORDER ANALYTICS                             */}
      {/* ========================================================================= */}
      {activeTab === 'vip' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'سجل كبار العملاء المميزين ومؤشرات الولاء' : 'VIP Customer Profiles & Lifetime Value'}
            </h3>
            <span className="text-xs text-amber-400 font-semibold">
              {isAr ? 'قنوات الطلب المباشر: الصالة، الواتساب، والموقع الإلكتروني' : 'Direct Channels: Shop, WhatsApp & Web'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-right">{isAr ? 'العميل' : 'Customer Name'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'رقم الهاتف' : 'Phone'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'فئة الولاء' : 'Tier'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'عدد الطلبات' : 'Total Orders'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'إجمالي الإنفاق (د.ك)' : 'Total Spend (KWD)'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'متوسط الفاتورة' : 'AOV'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'البراند المفضل' : 'Favorite Brand'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'آخر طلب' : 'Last Order'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { name: 'الشيخ فهد الأحمد الصباح', phone: '+965 9988 1234', tier: isAr ? '💎 بلاتينيوم كبار العملاء' : '💎 Platinum VIP', orders: 48, spend: '642.500', aov: '13.385', fav: isAr ? 'فرانكس ستيك' : "Frank's Steak", last: 'أمس 09:30 م' },
                    { name: 'د. يوسف العبدالله الرومي', phone: '+965 9772 4411', tier: isAr ? '🥇 ذهبي كبار العملاء' : '🥇 Gold VIP', orders: 34, spend: '412.000', aov: '12.117', fav: isAr ? 'فرانكس ستيك' : "Frank's Steak", last: 'منذ يومين' },
                    { name: 'م. نورة فيصل الخالد', phone: '+965 9441 8822', tier: isAr ? '🥇 ذهبي كبار العملاء' : '🥇 Gold VIP', orders: 29, spend: '298.500', aov: '10.293', fav: isAr ? 'تشاينا جاردن' : 'China Garden', last: 'منذ 3 أيام' },
                    { name: 'أحمد مشعل الغانم', phone: '+965 9660 3399', tier: isAr ? '🥈 فضي كبار العملاء' : '🥈 Silver VIP', orders: 22, spend: '245.000', aov: '11.136', fav: isAr ? 'فرانكس' : "Frank's", last: 'منذ أسبوع' },
                    { name: 'سارة جاسم المرزوق', phone: '+965 9005 7711', tier: isAr ? '🥈 فضي كبار العملاء' : '🥈 Silver VIP', orders: 19, spend: '185.000', aov: '9.736', fav: isAr ? 'شاورما طحينة' : 'Tahina', last: 'منذ 5 أيام' },
                  ].map((vip, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{vip.name}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-slate-400" dir="ltr">{vip.phone}</td>
                      <td className="px-4 py-3 text-center font-bold text-xs text-amber-300">{vip.tier}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-white">{vip.orders}</td>
                      <td className="px-4 py-3 font-mono font-bold text-emerald-400 text-right">{vip.spend} د.ك</td>
                      <td className="px-4 py-3 font-mono text-slate-300 text-right">{vip.aov} د.ك</td>
                      <td className="px-4 py-3 text-center text-xs text-purple-300 font-semibold">{vip.fav}</td>
                      <td className="px-4 py-3 text-center text-xs text-slate-400">{vip.last}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CUSTOMER FEEDBACK & INCIDENT RESOLUTION                            */}
      {/* ========================================================================= */}
      {activeTab === 'feedback' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'مركز جودة الخدمة ومتابعة التقييمات وشكاوى العملاء' : 'Service Quality, Customer Reviews & Incident Tickets'}
            </h3>
            <span className="text-xs text-emerald-400 font-semibold">
              {isAr ? 'متوسط تقييم الفروع: 4.72 / 5 (معدل استجابة 12 دقيقة)' : 'Avg Customer Rating: 4.72 / 5'}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0d131f] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold uppercase text-slate-400">
                    <th className="px-4 py-3 text-right">{isAr ? 'العميل والقناة' : 'Customer & Channel'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الفرع والبراند' : 'Branch & Brand'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'التقييم' : 'Rating'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الملاحظة أو الشكوى' : 'Review / Feedback'}</th>
                    <th className="px-4 py-3 text-right">{isAr ? 'الإجراء المتخذ' : 'Resolution'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {[
                    { cust: 'بدر ناصر (طلبات)', branch: isAr ? 'فرع السالمية (فرانكس)' : "فرع السالمية (Frank's)", rating: '⭐⭐⭐⭐⭐', text: 'ستيك ترفل ممتاز ووصل حاراً ومقرمشاً خلال 22 دقيقة', action: 'شكر العميل ومنحه كود خصم 10%', status: 'مغلق بنجاح' },
                    { cust: 'فاطمة العوضي (صالة الفرع)', branch: isAr ? 'فرع حولي (تشاينا جاردن)' : 'فرع حولي (China Garden)', rating: '⭐⭐⭐⭐', text: 'طعم البرجر رائع ولكن التكييف كان بارداً جداً بالصالة', action: 'تعديل منظم الحرارة بالفرع فورياً', status: 'مغلق بنجاح' },
                    { cust: 'محمد السبيعي (دليفرو)', branch: isAr ? 'فرع العارضية (فرانكس)' : "فرع العارضية (Frank's)", rating: '⭐⭐⭐', text: 'تم نسيان علبة صوص إضافية بالطلب المسلم', action: 'تعويض بقسيمة مجانية 3 د.ك للطلب القادم', status: 'تم الصلح والتعويض' },
                    { cust: 'خلود الهاجري (واتساب مباشر)', branch: isAr ? 'فرع المهبولة (شاورما طحينة)' : 'فرع المهبولة (Shawarma)', rating: '⭐⭐⭐⭐⭐', text: 'شاورما ممتازة والخبز اللبناني طازج وخفيف', action: 'ترقية الحساب لفئة الفضة', status: 'مغلق بنجاح' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">{row.cust}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">{row.branch}</td>
                      <td className="px-4 py-3 text-center text-xs font-mono">{row.rating}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">{row.text}</td>
                      <td className="px-4 py-3 text-xs text-emerald-300">{row.action}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                          {row.status}
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
      {/* TAB 4: SEASONAL CAMPAIGNS & WHATSAPP VIP OFFERS                           */}
      {/* ========================================================================= */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white">
              {isAr ? 'إدارة الحملات الترويجية المباشرة ورسائل الواتساب' : 'Promotional Campaigns & Direct WhatsApp Broadcasts'}
            </h3>
            <span className="text-xs text-purple-400 font-semibold">
              {isAr ? 'عائد الإنفاق الإعلاني المباشر: 8.4x' : 'Direct WhatsApp ROAS: 8.4x'}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { title: isAr ? 'بوكس الجمعات العائلي' : 'Weekend Gathering Box', brand: isAr ? 'فرانكس ستيك' : "Frank's Steak", target: 'عملاء الويكند والصالة', reach: '4,850 مستلم', conv: '18.4% تحويل', rev: '3,840 د.ك مبيعات', active: true },
              { title: isAr ? 'عرض غداء الدوامات والمكاتب' : 'Office Lunch Combo', brand: isAr ? 'تشاينا جاردن' : 'China Garden', target: 'موظفي شرق والشويخ', reach: '3,200 مستلم', conv: '22.1% تحويل', rev: '2,950 د.ك مبيعات', active: true },
              { title: isAr ? 'مهرجان الشاورما الوطني' : 'Shawarma Feast', brand: isAr ? 'شاورما طحينة' : 'Tahina', target: 'قاعدة عملاء التوصيل', reach: '6,100 مستلم', conv: '15.8% تحويل', rev: '4,120 د.ك مبيعات', active: true },
            ].map((c, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-semibold text-purple-300">{c.brand}</span>
                  <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400 border border-emerald-500/20">نشطة</span>
                </div>
                <h4 className="text-base font-bold text-white">{c.title}</h4>
                <div className="text-xs space-y-1 text-slate-400">
                  <p>الجمهور المستهدف: <strong className="text-slate-200">{c.target}</strong></p>
                  <p>الوصول المسجل: <strong className="text-white font-mono">{c.reach}</strong></p>
                  <p>معدل التحويل: <strong className="text-emerald-400 font-mono">{c.conv}</strong></p>
                </div>
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-sm font-black text-amber-400 font-mono">{c.rev}</span>
                  <button onClick={() => showToast('✅ تم إعادة إرسال الحملة لـ 250 عميلاً إضافياً')} className="text-xs font-semibold text-purple-400 hover:text-purple-300">
                    إعادة البث ←
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: LEGACY DATABASE CRM                                                */}
      {/* ========================================================================= */}
      {activeTab === 'legacy' && liveChildren && (
        <div className="rounded-2xl border border-slate-800 bg-[#0d131f] p-5 shadow-xl">
          {liveChildren}
        </div>
      )}

      {/* New Deal Modal */}
      {showNewContractModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {isAr ? 'إضافة عقد كاترينج أو تموين مؤسسي جديد' : 'New B2B Corporate Catering Deal'}
              </h3>
              <button onClick={() => setShowNewContractModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                setShowNewContractModal(false)
                showToast(isAr ? '✅ تم تسجيل عقد الكاترينج وتوليد عرض السعر المالي' : '✅ Deal logged & quotation generated')
              }}
              className="mt-4 space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-300 mb-1">{isAr ? 'اسم الشركة أو العميل:' : 'Company / Client Name:'}</label>
                <input
                  type="text"
                  required
                  placeholder={isAr ? 'مثال: شركة نفط الكويت (KOC) - ديوانية الإدارة' : 'e.g. Kuwait Oil Company'}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">{isAr ? 'قيمة العقد المتوقعة (د.ك):' : 'Estimated Value (KWD):'}</label>
                <input
                  type="number"
                  step="0.001"
                  required
                  placeholder="5000.000"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">{isAr ? 'البراند المفضل للتوريد:' : 'Assigned Brand:'}</label>
                <select className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:outline-none">
                  <option value="CHINA">{isAr ? 'تشاينا جاردن - المطبخ الصيني والآسيوي' : 'China Garden - Asian & Chinese'}</option>
                  <option value="FRANK">{isAr ? 'فرانكس - ستيك وبرجر فاخر' : "Frank's - Premium Steak & Burger"}</option>
                  <option value="TAHINA">{isAr ? 'شاورما طحينة - شاورما ومقبلات' : 'Tahina - Shawarma & Appetizers'}</option>
                  <option value="FARMBROWN">{isAr ? 'فارم براون - وجبات صحية وعضوية' : 'Farm Brown - Healthy & Organic'}</option>
                  <option value="NOODLE">{isAr ? 'ذا نودل بار - نودلز وأطباق آسيوية' : 'The Noodle Bar - Asian Noodles'}</option>
                  <option value="KARAK">{isAr ? 'كرك كافتيريا - شاي كرك وفطائر خفيفة' : 'Karak Cafeteria - Karak Tea & Snacks'}</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewContractModal(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 font-semibold text-slate-300"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-purple-500 px-4 py-2 font-bold text-white hover:bg-purple-400"
                >
                  {isAr ? 'حفظ العقد وإدراجه بالمسار' : 'Save & Log Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
