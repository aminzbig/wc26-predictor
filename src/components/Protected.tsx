import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Protected({ children, admin }: { children: React.ReactNode; admin?: boolean }) {
  const { session, player, loading } = useAuth()
  if (loading) return <div className="p-6 text-muted">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  if (admin && !player?.is_admin) return <Navigate to="/matches" replace />
  return <>{children}</>
}
