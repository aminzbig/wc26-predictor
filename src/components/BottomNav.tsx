import { NavLink } from 'react-router-dom'
import { Trophy, User, Circle, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const item = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center gap-1 text-[10px] font-semibold ${isActive ? 'text-accent' : 'text-muted'}`

export function BottomNav() {
  const { player } = useAuth()
  const Icon = ({ children, active }: { children: React.ReactNode; active?: boolean }) =>
    <span className={`w-11 h-11 rounded-xl grid place-items-center bg-surface ${active ? 'shadow-neu-inset' : 'shadow-neu-sm'}`}>{children}</span>
  return (
    <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto flex justify-around p-3 bg-bg">
      <NavLink to="/matches" className={item}>{({ isActive }) => <><Icon active={isActive}><Circle size={20} /></Icon>Matches</>}</NavLink>
      <NavLink to="/ranking" className={item}>{({ isActive }) => <><Icon active={isActive}><Trophy size={20} /></Icon>Ranking</>}</NavLink>
      <NavLink to="/me" className={item}>{({ isActive }) => <><Icon active={isActive}><User size={20} /></Icon>Me</>}</NavLink>
      {player?.is_admin &&
        <NavLink to="/admin" className={item}>{({ isActive }) => <><Icon active={isActive}><Shield size={20} /></Icon>Admin</>}</NavLink>}
    </nav>
  )
}
