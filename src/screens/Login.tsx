import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, ArrowRight } from 'lucide-react'
import { login, signUp } from '../lib/auth'
import { useAuth } from '../context/AuthContext'

// Module-level so the input keeps focus across re-renders (a component defined
// inside Login would remount on every keystroke and drop focus after 1 char).
function Field({ icon, ...p }: any) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3.5 rounded-2xl bg-surface shadow-neu-inset text-txt">
      {icon}<input {...p} className="bg-transparent outline-none flex-1 text-sm placeholder:text-muted" />
    </div>
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
    <div className="max-w-md mx-auto min-h-screen flex flex-col justify-center gap-4 px-6">
      <div className="w-20 h-20 rounded-3xl mx-auto grid place-items-center bg-surface shadow-neu text-accent text-3xl">🏆</div>
      <h1 className="text-center font-extrabold text-2xl tracking-tight">WC26 Predictor</h1>
      <p className="text-center text-muted text-sm mb-2">Predict every match. Beat your friends.</p>
      <Field icon={<User size={17} className="text-muted" />} placeholder="Your name" value={name} onChange={(e: any) => setName(e.target.value)} />
      <Field icon={<Lock size={17} className="text-muted" />} type="password" placeholder="PIN (6+ chars)" value={pin} onChange={(e: any) => setPin(e.target.value)} />
      {err && <p className="text-red-400 text-xs text-center">{err}</p>}
      <button onClick={submit} disabled={busy}
        className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-b from-accent2 to-accent text-[#06101f] font-bold disabled:opacity-50">
        {mode === 'login' ? 'Log in' : 'Create account'} <ArrowRight size={18} />
      </button>
      <p className="text-center text-muted text-xs">
        {mode === 'login' ? 'New here? ' : 'Have an account? '}
        <b className="text-accent2 cursor-pointer" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Create account' : 'Log in'}</b>
      </p>
    </div>
  )
}
