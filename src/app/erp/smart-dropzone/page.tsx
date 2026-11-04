import SmartDropzonePortal from '@/modules/smart-dropzone/ui/SmartDropzonePortal'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'بوابة الفرز والأرشفة الذكية الشاملة | شركة فنتشر فودز ذ.م.م.',
  description: 'فرز ومطابقة وإدخال الفواتير والعقود وملفات الموظفين آلياً لشركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
}

export default function SmartDropzonePage() {
  return (
    <main className="w-full max-w-none px-4 py-8 sm:px-6" style={{ background: '#0a0d12' }} suppressHydrationWarning>
      <SmartDropzonePortal />
    </main>
  )
}
