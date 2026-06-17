import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logout } from '../lib/auth'
import { useAuth } from '../context/AuthContext'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { Flag } from '../components/Flag'
import { Avatar } from '../components/Avatar'
import { AvatarStudio } from '../components/AvatarStudio'
import type { Team } from '../lib/types'

export function Me() {
  const { player } = useAuth()
  const { rows } = useLeaderboard()
  const me = rows.find(r => r.id === player?.id)
  const [pin, setPin] = useState(''); const [msg, setMsg] = useState('')

  const [teams, setTeams] = useState<Team[]>([])
  const [flag, setFlag] = useState<string | null>(player?.flag_code ?? null)
  const [flagMsg, setFlagMsg] = useState('')
  const [tab, setTab] = useState<'flag' | 'photo'>('flag')

  useEffect(() => {
    supabase.from('teams').select('code,name').order('name').then(({ data }) => setTeams((data ?? []) as Team[]))
  }, [])

  async function changePin() {
    if (pin.length < 6) { setMsg('PIN must be 6+ characters'); return }
    const { error } = await supabase.auth.updateUser({ password: pin })
    setMsg(error ? error.message : 'PIN updated'); setPin('')
  }

  async function pickFlag(code: string) {
    if (!player) return
    const next = flag === code ? null : code // tap again to clear
    setFlag(next)
    const { error } = await supabase.from('players').update({ flag_code: next }).eq('id', player.id)
    setFlagMsg(error ? error.message : 'Flag saved')
  }

  return (
    <>
      <div className="bg-ink text-paper px-3 py-2 mb-4">
        <h1 className="font-display text-[20px] uppercase tracking-wide">Me</h1>
      </div>

      {/* Stats panel */}
      <div className="border-[3px] border-ink bg-paper p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar url={player?.avatar_url} code={flag} label={player?.name} size="md" />
          <div className="font-display text-[24px] uppercase">{player?.name}</div>
        </div>
        <div className="grid grid-cols-3 gap-0 border-[3px] border-ink">
          {[['Total', me?.total ?? 0], ['Exact', me?.exact_hits ?? 0], ['Diff', me?.diff_hits ?? 0]].map(([k, v], i) =>
            <div key={k} className={`py-3 text-center ${i < 2 ? 'border-r-[3px] border-ink' : ''}`}>
              <div className="font-display text-[28px] text-ink">{v}</div>
              <div className="font-sans font-900 text-[9px] uppercase tracking-widest text-ink/60">{k}</div>
            </div>)}
        </div>
      </div>

      {/* Flag / Photo panel */}
      <div className="border-[3px] border-ink bg-paper p-4 mb-4">
        <div className="font-display text-[14px] uppercase tracking-wide mb-3">Your flag</div>
        <div className="flex border-[3px] border-ink mb-3">
          {(['flag', 'photo'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`flex-1 py-1.5 font-display text-[13px] uppercase tracking-wide ${tab === t ? 'bg-ink text-paper' : 'text-ink'}`}>
              {t === 'flag' ? 'Flag' : 'Photo'}
            </button>
          ))}
        </div>

        {tab === 'flag' ? (
          <>
            <div className="font-sans font-700 text-[10px] uppercase tracking-wide text-ink/60 mb-3">Tap to pick · tap again to clear</div>
            <div className="grid grid-cols-5 gap-2 max-h-[230px] overflow-y-auto pr-1">
              {teams.map(t => (
                <button key={t.code} type="button" onClick={() => pickFlag(t.code)}
                  title={t.name}
                  className={`flex items-center justify-center p-1 border-[3px] ${flag === t.code ? 'border-ink bg-ink/10' : 'border-transparent'}`}>
                  <Flag code={t.code} label={t.name} size="sm" />
                </button>
              ))}
            </div>
            {flagMsg && <p className="font-sans font-700 text-[11px] uppercase tracking-wide text-ink/60 mt-2">{flagMsg}</p>}
          </>
        ) : (
          <AvatarStudio flagCode={flag} initialBlend={player?.avatar_blend ?? null} initialMode={player?.avatar_mode ?? null} />
        )}
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
