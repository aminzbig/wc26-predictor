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
      <h1 className="text-xl font-bold tracking-tight mb-4">Me</h1>
      <div className="bg-surface rounded-neu shadow-neu p-5 mb-4">
        <div className="text-lg font-bold">{player?.name}</div>
        <div className="grid grid-cols-3 gap-3 mt-4 text-center">
          {[['Total', me?.total ?? 0], ['Exact', me?.exact_hits ?? 0], ['Diff', me?.diff_hits ?? 0]].map(([k, v]) =>
            <div key={k} className="rounded-xl bg-surface shadow-neu-inset py-3">
              <div className="text-accent font-bold text-lg">{v}</div>
              <div className="text-[10px] text-muted uppercase">{k}</div></div>)}
        </div>
      </div>
      <div className="bg-surface rounded-neu shadow-neu p-5 mb-4">
        <div className="text-sm font-semibold mb-2">Change PIN</div>
        <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="New PIN"
          className="w-full px-4 py-3 rounded-xl bg-surface shadow-neu-inset outline-none text-sm mb-2" />
        <button onClick={changePin} className="text-xs font-bold text-accent2">Update PIN</button>
        {msg && <p className="text-xs text-muted mt-2">{msg}</p>}
      </div>
      <button onClick={() => logout().then(() => location.reload())}
        className="w-full py-3 rounded-2xl bg-surface shadow-neu-sm text-muted font-semibold text-sm">Log out</button>
    </>
  )
}
