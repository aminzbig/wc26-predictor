export function Flag({ code, label, size = 'md' }:
  { code: string | null; label?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'w-[32px] h-[22px]' : size === 'lg' ? 'w-[64px] h-[44px]' : 'w-[40px] h-[28px]'
  if (!code) {
    return (
      <span className={`${dim} border-2 border-ink bg-paper grid place-items-center text-[8px] text-ink/60 px-0.5 text-center font-sans font-800`}>
        {label?.slice(0, 8) ?? '?'}
      </span>
    )
  }
  return (
    <span className={`${dim} border-2 border-ink overflow-hidden relative inline-block flex-none`}>
      <span className={`fi fi-${code} absolute inset-0 !w-full !h-full bg-cover`} />
    </span>
  )
}
