// Circular identity avatar: the user's baked photo+flag composite when set,
// otherwise their flag shown inside a circle, otherwise their initials.
// Match *team* flags keep the rectangular <Flag>; this is for people only.
const DIM: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-[28px] h-[28px]',
  md: 'w-[36px] h-[36px]',
  lg: 'w-[56px] h-[56px]',
}

export function Avatar({ url, code, label, size = 'md' }: {
  url?: string | null
  code?: string | null
  label?: string | null
  size?: 'sm' | 'md' | 'lg'
}) {
  const dim = DIM[size]
  const ring = 'border-2 border-ink rounded-full overflow-hidden inline-block flex-none'

  if (url) {
    return (
      <span className={`${dim} ${ring} relative bg-paper`}>
        <img src={url} alt={label ?? 'avatar'} className="absolute inset-0 w-full h-full object-cover" />
      </span>
    )
  }
  if (code) {
    return (
      <span className={`${dim} ${ring} relative`}>
        <span className={`fi fi-${code} absolute inset-0 !w-full !h-full bg-cover`} />
      </span>
    )
  }
  return (
    <span className={`${dim} ${ring} bg-paper grid place-items-center text-[9px] text-ink/60 font-sans font-800 uppercase`}>
      {label?.slice(0, 2) ?? '?'}
    </span>
  )
}
