// Circular identity avatar: the user's baked photo+flag composite when set,
// otherwise their flag shown inside a circle, otherwise their initials.
// Match *team* flags keep the rectangular <Flag>; this is for people only.
const DIM: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-[28px] h-[28px]',
  md: 'w-[36px] h-[36px]',
  lg: 'w-[56px] h-[56px]',
}

export function Avatar({ url, code, label, size = 'md', px }: {
  url?: string | null
  code?: string | null
  label?: string | null
  size?: 'sm' | 'md' | 'lg'
  px?: number // exact pixel size; overrides `size` when set
}) {
  const dim = px ? '' : DIM[size]
  const style = px ? { width: px, height: px } : undefined
  const ring = 'border-[3px] border-ink rounded-full overflow-hidden inline-block flex-none'

  if (url) {
    return (
      <span style={style} className={`${dim} ${ring} relative bg-paper`}>
        <img src={url} alt={label ?? 'avatar'} className="absolute inset-0 w-full h-full object-cover" />
      </span>
    )
  }
  if (code) {
    return (
      <span style={style} className={`${dim} ${ring} relative`}>
        <span className={`fi fi-${code} absolute inset-0 !w-full !h-full bg-cover`} />
      </span>
    )
  }
  return (
    <span style={style} className={`${dim} ${ring} bg-paper grid place-items-center text-[9px] text-ink/60 font-sans font-800 uppercase`}>
      {label?.slice(0, 2) ?? '?'}
    </span>
  )
}
