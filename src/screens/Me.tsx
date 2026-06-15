import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { logout } from '../lib/auth'
import { useAuth } from '../context/AuthContext'
import { useLeaderboard } from '../hooks/useLeaderboard'

export function Me() {
  const { player } = useAuth()
  const { rows } = useLeaderboard()
  const me = rows.find(r => r.id === player?.id)
  const [pin, setPin] = useState(''); const [msg, setMsg] = useState('')

  async function changePin() {
    if (pin.length < 6) { setMsg('PIN must be 6+ characters'); return }
    const { error } = await supabase.auth.updateUser({ password: pin })
    setMsg(error ? error.message : 'PIN updated'); setPin('')
  }

  return (
    <>
      <div className="bg-ink text-paper px-3 py-2 mb-4">
        <h1 className="font-display text-[20px] uppercase tracking-wide">Me</h1>
      </div>

      {/* Stats panel */}
      <div className="border-[3px] border-ink bg-paper p-4 mb-4">
        <div className="font-display text-[24px] uppercase mb-3">{player?.name}</div>
        <div className="grid grid-cols-3 gap-0 border-[3px] border-ink">
          {[['Total', me?.total ?? 0], ['Exact', me?.exact_hits ?? 0], ['Diff', me?.diff_hits ?? 0]].map(([k, v], i) =>
            <div key={k} className={`py-3 text-center ${i < 2 ? 'border-r-[3px] border-ink' : ''}`}>
              <div className="font-display text-[28px] text-ink">{v}</div>
              <div className="font-sans font-900 text-[9px] uppercase tracking-widest text-ink/60">{k}</div>
            </div>)}
        </div>
      </div>

      {/* Change PIN panel */}
      <div className="border-[3px] border-ink bg-paper p-4 mb-4">
        <div className="font-display text-[14px] uppercase tracking-wide mb-2">Change PIN</div>
        <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="NEW PIN"
          className="w-full border-[3px] border-ink px-3 py-2.5 font-display text-[14px] uppercase bg-paper text-ink outline-none placeholder:text-ink/40 mb-2" />
        <button onClick={changePin}
          className="font-display text-[13px] uppercase tracking-wide bg-ink text-paper px-4 py-2">
          Update PIN
        </button>
        {msg && <p className="font-sans font-700 text-[11px] uppercase tracking-wide text-ink/60 mt-2">{msg}</p>}
      </div>

      <button onClick={() => logout().then(() => location.reload())}
        className="w-full py-3 border-[3px] border-ink bg-paper text-ink font-display text-[14px] uppercase tracking-wide">
        Log out
      </button>
    </>
  )
}
