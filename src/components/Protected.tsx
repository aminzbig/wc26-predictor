import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Protected({ children, admin }: { children: React.ReactNode; admin?: boolean }) {
  const { session, player, loading } = useAuth()
  if (loading) return <div className="p-6 text-ink/60 font-sans font-700 uppercase text-sm tracking-wide">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  if (admin && !player?.is_admin) return <Navigate to="/matches" replace />
  return <>{children}</>
}
