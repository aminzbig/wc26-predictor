import { NavLink } from 'react-router-dom'
import { Trophy, User, Circle, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export function BottomNav() {
  const { player } = useAuth()
  return (
    <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto flex border-t-[4px] border-ink bg-paper">
      <NavLink to="/matches" className={({ isActive }) =>
        `flex-1 flex flex-col items-center gap-0.5 py-3 font-display text-[13px] uppercase tracking-wide border-r-[3px] border-ink ${isActive ? 'bg-ink text-paper' : 'text-ink'}`}>
        {({ isActive }) => <><Circle size={18} className={isActive ? 'text-paper' : 'text-ink'} />Matches</>}
      </NavLink>
      <NavLink to="/ranking" className={({ isActive }) =>
        `flex-1 flex flex-col items-center gap-0.5 py-3 font-display text-[13px] uppercase tracking-wide border-r-[3px] border-ink ${isActive ? 'bg-ink text-paper' : 'text-ink'}`}>
        {({ isActive }) => <><Trophy size={18} className={isActive ? 'text-paper' : 'text-ink'} />Ranking</>}
      </NavLink>
      <NavLink to="/me" className={({ isActive }) =>
        `flex-1 flex flex-col items-center gap-0.5 py-3 font-display text-[13px] uppercase tracking-wide ${player?.is_admin ? 'border-r-[3px] border-ink' : ''} ${isActive ? 'bg-ink text-paper' : 'text-ink'}`}>
        {({ isActive }) => <><User size={18} className={isActive ? 'text-paper' : 'text-ink'} />Me</>}
      </NavLink>
      {player?.is_admin && (
        <NavLink to="/admin" className={({ isActive }) =>
          `flex-1 flex flex-col items-center gap-0.5 py-3 font-display text-[13px] uppercase tracking-wide ${isActive ? 'bg-ink text-paper' : 'text-ink'}`}>
          {({ isActive }) => <><Shield size={18} className={isActive ? 'text-paper' : 'text-ink'} />Admin</>}
        </NavLink>
      )}
    </nav>
  )
}
