import SmartDropzonePortal from '@/components/SmartDropzonePortal'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'بوابة الفرز والأرشفة الذكية الشاملة | شركة فنتشر فودز ذ.م.م.',
  description: 'فرز ومطابقة وإدخال الفواتير والعقود وملفات الموظفين آلياً لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export default function SmartDropzonePage() {
  return (
    <div className="mx-auto w-full max-w-[1920px] min-w-0 overflow-visible px-4 py-5 sm:px-6 text-slate-900 dark:text-slate-100">
      <SmartDropzonePortal />
    </div>
  )
}
