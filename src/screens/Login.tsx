import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, signUp } from '../lib/auth'
import { useAuth } from '../context/AuthContext'

// Module-level so the input keeps focus across re-renders (a component defined
// inside Login would remount on every keystroke and drop focus after 1 char).
function Field({ ...p }: any) {
  return (
    <input
      {...p}
      className="w-full border-[3px] border-ink px-4 py-3.5 font-display text-[16px] uppercase bg-paper text-ink/70 outline-none placeholder:text-ink/40 tracking-wide"
    />
  )
}

export function Login() {
  const { session } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState(''); const [pin, setPin] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  if (session) { nav('/matches', { replace: true }) }

  async function submit() {
    setErr(''); setBusy(true)
    try {
      mode === 'login' ? await login(name, pin) : await signUp(name, pin)
      nav('/matches', { replace: true })
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col justify-center gap-4 px-6 bg-paper">
      {/* Ball logo */}
      <div className="w-[84px] h-[84px] rounded-full border-[4px] border-ink bg-orange mx-auto flex items-center justify-center text-[42px]">
        ⚽
      </div>

      {/* Title */}
      <h1 className="font-display text-[34px] uppercase text-center leading-none text-ink">
        WC26<br />Predictor
      </h1>

      {/* Slogan */}
      <div className="bg-blue text-paper font-display text-[17px] uppercase text-center py-2 tracking-widest">
        Kick it with us
      </div>

      <Field placeholder="Your name" value={name} onChange={(e: any) => setName(e.target.value)} />
      <Field type="password" placeholder="PIN ••••••" value={pin} onChange={(e: any) => setPin(e.target.value)} />

      {err && <p className="text-red text-xs text-center font-sans font-700 uppercase tracking-wide">{err}</p>}

      <button onClick={submit} disabled={busy}
        className="w-full bg-ink text-paper font-display text-[20px] uppercase tracking-widest py-3.5 border-[3px] border-ink disabled:opacity-50">
        {mode === 'login' ? 'Log in →' : 'Create account →'}
      </button>

      <p className="text-center font-sans font-800 text-[12px] uppercase tracking-widest text-ink/60">
        {mode === 'login' ? 'New here? ' : 'Have an account? '}
        <span className="text-ink cursor-pointer underline"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Create account' : 'Log in'}
        </span>
      </p>
    </div>
  )
}
