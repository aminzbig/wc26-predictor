import { createContext, useContext, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Player } from '../lib/types'

interface AuthState { session: Session | null; player: Player | null; loading: boolean; refreshPlayer: () => Promise<void> }
const Ctx = createContext<AuthState>({ session: null, player: null, loading: true, refreshPlayer: async () => {} })
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  async function refreshPlayer() {
    if (!session) return
    const { data } = await supabase.from('players').select('*').eq('id', session.user.id).single()
    setPlayer(data as Player | null)
  }

  useEffect(() => {
    if (!session) { setPlayer(null); setLoading(false); return }
    supabase.from('players').select('*').eq('id', session.user.id).single()
      .then(({ data }) => { setPlayer(data as Player | null); setLoading(false) })
  }, [session])

  return <Ctx.Provider value={{ session, player, loading, refreshPlayer }}>{children}</Ctx.Provider>
}
