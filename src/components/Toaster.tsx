import { useToastStore } from '../stores/toastStore'

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg cursor-pointer ${
            t.kind === 'success' ? 'bg-success' : 'bg-danger'
          }`}
        >
          <span aria-hidden>{t.kind === 'success' ? '✓' : '!'}</span>
          <span className="text-left">{t.message}</span>
        </button>
      ))}
    </div>
  )
}
