import { StateBlock } from '@/components/ui/state-block'

export function HomeFallback() {
  return (
    <main
      className="flex min-h-screen w-full items-center justify-center p-6"
      style={{
        backgroundColor: 'var(--ds-bg-canvas)',
        color: 'var(--ds-text-primary)',
      }}
    >
      <div className="w-full max-w-md">
        <StateBlock
          state="loading"
          locale="ar"
          title="جارٍ التوجيه إلى مساحة العمل…"
          skeletonRows={3}
        />
      </div>
    </main>
  )
}
