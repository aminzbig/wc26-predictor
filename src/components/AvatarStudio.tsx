import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const SIZE = 512 // baked square; cropped to a circle by CSS everywhere it renders.

// Resolve a flag's bundled SVG URL by reading what flag-icons CSS already paints.
// Same-origin asset → drawing it to canvas does not taint it, so toBlob works.
function flagUrl(code: string): string | null {
  const el = document.createElement('span')
  el.className = `fi fi-${code}`
  el.style.cssText = 'position:absolute;visibility:hidden;width:1px;height:1px'
  document.body.appendChild(el)
  const bg = getComputedStyle(el).backgroundImage
  document.body.removeChild(el)
  const m = bg.match(/url\(["']?(.*?)["']?\)/)
  return m && m[1] !== 'none' ? m[1] : null
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Draw `img` cover-fit (centered, no distortion) into a SIZE×SIZE context.
function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, iw: number, ih: number) {
  const scale = Math.max(SIZE / iw, SIZE / ih)
  const w = iw * scale, h = ih * scale
  ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h)
}

type Status = 'idle' | 'live' | 'review' | 'saving'

export function AvatarStudio({ flagCode, initialBlend }: {
  flagCode: string | null
  initialBlend: number | null
}) {
  const { player, refreshPlayer } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const photoRef = useRef<HTMLCanvasElement | null>(null) // captured frame, for re-compositing
  const flagImgRef = useRef<HTMLImageElement | null>(null)

  const [status, setStatus] = useState<Status>('idle')
  const [blend, setBlend] = useState<number>(initialBlend ?? 35)
  const [msg, setMsg] = useState('')

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera]) // stop on unmount

  // Auto-start the camera the moment the Photo tab opens (mount), so the user
  // doesn't have to tap "Open camera". Skipped if no flag is picked yet.
  useEffect(() => {
    if (flagCode && !streamRef.current && status === 'idle') openCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load the flag SVG whenever the selected flag changes.
  useEffect(() => {
    let active = true
    if (!flagCode) { flagImgRef.current = null; return }
    const url = flagUrl(flagCode)
    if (!url) return
    loadImage(url).then(img => { if (active) { flagImgRef.current = img; compose() } }).catch(() => {})
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagCode])

  async function openCamera() {
    setMsg('')
    if (!flagCode) { setMsg('Pick a flag first (Flag tab)'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      streamRef.current = stream
      setStatus('live')
      // video element mounts with this status; attach on next tick.
      requestAnimationFrame(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) }
      })
    } catch {
      setMsg('No camera available on this device')
    }
  }

  function capture() {
    const video = videoRef.current
    if (!video) return
    const photo = document.createElement('canvas')
    photo.width = SIZE; photo.height = SIZE
    const pctx = photo.getContext('2d')!
    drawCover(pctx, video, video.videoWidth, video.videoHeight)
    photoRef.current = photo
    stopCamera()
    setStatus('review')
    requestAnimationFrame(compose)
  }

  // Composite captured photo + flag (at `blend` opacity) onto the visible canvas.
  function compose() {
    const canvas = canvasRef.current
    const photo = photoRef.current
    if (!canvas || !photo) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, SIZE, SIZE)
    ctx.globalAlpha = 1
    ctx.drawImage(photo, 0, 0)
    const flag = flagImgRef.current
    if (flag) {
      ctx.globalAlpha = blend / 100
      drawCover(ctx, flag, flag.naturalWidth || 4, flag.naturalHeight || 3)
      ctx.globalAlpha = 1
    }
  }

  useEffect(() => { if (status === 'review') compose() // re-blend on slider move
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blend, status])

  function retake() {
    photoRef.current = null
    setStatus('idle')
  }

  async function save() {
    const canvas = canvasRef.current
    const photo = photoRef.current
    if (!canvas || !photo || !player) return
    setStatus('saving'); setMsg('')

    const baked: Blob | null = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85))
    const source: Blob | null = await new Promise(r => photo.toBlob(r, 'image/jpeg', 0.85))
    if (!baked) { setMsg('Could not render image'); setStatus('review'); return }

    const dir = `${player.id}`
    const up1 = await supabase.storage.from('avatars').upload(`${dir}/avatar.jpg`, baked, { upsert: true, contentType: 'image/jpeg' })
    if (source) await supabase.storage.from('avatars').upload(`${dir}/source.jpg`, source, { upsert: true, contentType: 'image/jpeg' })
    if (up1.error) { setMsg(up1.error.message); setStatus('review'); return }

    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(`${dir}/avatar.jpg`)
    const url = `${pub.publicUrl}?v=${Date.now()}` // bust the CDN/browser cache on re-save
    const { error } = await supabase.from('players').update({ avatar_url: url, avatar_blend: blend }).eq('id', player.id)
    if (error) { setMsg(error.message); setStatus('review'); return }

    await refreshPlayer()
    setMsg('Avatar saved')
    setStatus('review')
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-[180px] h-[180px] rounded-full overflow-hidden border-[3px] border-ink bg-ink/5">
        {status === 'live' ? (
          <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <canvas ref={canvasRef} width={SIZE} height={SIZE} className="absolute inset-0 w-full h-full object-cover" />
        )}
        {(status === 'idle' || status === 'saving') && !photoRef.current && (
          <div className="absolute inset-0 grid place-items-center text-center px-4">
            <span className="font-sans font-800 text-[11px] uppercase tracking-wide text-ink/50">
              {status === 'saving' ? 'Saving…' : 'Take a photo to blend with your flag'}
            </span>
          </div>
        )}
      </div>

      {status === 'review' && (
        <label className="w-full max-w-[220px]">
          <div className="flex justify-between font-sans font-900 text-[9px] uppercase tracking-widest text-ink/60 mb-1">
            <span>Photo</span><span>Flag {blend}%</span>
          </div>
          <input type="range" min={0} max={100} value={blend}
            onChange={e => setBlend(Number(e.target.value))}
            className="w-full accent-ink" />
        </label>
      )}

      <div className="flex gap-2">
        {status === 'idle' && (
          <button type="button" onClick={openCamera}
            className="font-display text-[13px] uppercase tracking-wide bg-ink text-paper px-4 py-2">
            Open camera
          </button>
        )}
        {status === 'live' && (
          <>
            <button type="button" onClick={capture}
              className="font-display text-[13px] uppercase tracking-wide bg-ink text-paper px-4 py-2">Capture</button>
            <button type="button" onClick={() => { stopCamera(); setStatus('idle') }}
              className="font-display text-[13px] uppercase tracking-wide border-[3px] border-ink px-4 py-2">Cancel</button>
          </>
        )}
        {(status === 'review' || status === 'saving') && (
          <>
            <button type="button" disabled={status === 'saving'} onClick={save}
              className="font-display text-[13px] uppercase tracking-wide bg-ink text-paper px-4 py-2 disabled:opacity-50">Save</button>
            <button type="button" disabled={status === 'saving'} onClick={retake}
              className="font-display text-[13px] uppercase tracking-wide border-[3px] border-ink px-4 py-2 disabled:opacity-50">Retake</button>
          </>
        )}
      </div>

      {msg && <p className="font-sans font-700 text-[11px] uppercase tracking-wide text-ink/60">{msg}</p>}
    </div>
  )
}
