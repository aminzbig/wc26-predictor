export function Flag({ code, label, size = 'md' }:
  { code: string | null; label?: string | null; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-[38px] h-[28px]' : 'w-[50px] h-[36px]'
  if (!code) {
    return <span className={`${dim} rounded-lg shadow-neu-sm bg-surface grid place-items-center text-[9px] text-muted px-1 text-center`}>
      {label?.slice(0, 8) ?? '?'}
    </span>
  }
  return (
    <span className={`${dim} rounded-lg overflow-hidden shadow-neu-sm relative inline-block`}>
      <span className={`fi fi-${code} absolute inset-0 !w-full !h-full bg-cover`} />
    </span>
  )
}
