import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Trophy, User, Circle, Shield, MessageCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export function BottomNav() {
  const { player } = useAuth()
  const itemClass = (extra: string) => ({ isActive }: { isActive: boolean }) =>
    `relative flex-1 flex flex-col items-center gap-0.5 py-3 font-display text-[13px] uppercase tracking-wide ${extra} ${isActive ? 'bg-ink text-paper' : 'text-ink'}`
  const Active = () => (
    <motion.span layoutId="navbar-indicator"
      className="absolute top-0 inset-x-0 h-[4px] bg-yellow"
      transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
  )

  return (
    <nav className="shrink-0 flex border-t-[4px] border-ink bg-paper z-50">
      <NavLink to="/matches" className={itemClass('border-r-[3px] border-ink')}>
        {({ isActive }) => <>
          {isActive && <Active />}
          <motion.span animate={{ scale: isActive ? 1.15 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
            <Circle size={18} className={isActive ? 'text-paper' : 'text-ink'} />
          </motion.span>
          Matches
        </>}
      </NavLink>
      <NavLink to="/ranking" className={itemClass('border-r-[3px] border-ink')}>
        {({ isActive }) => <>
          {isActive && <Active />}
          <motion.span animate={{ scale: isActive ? 1.15 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
            <Trophy size={18} className={isActive ? 'text-paper' : 'text-ink'} />
          </motion.span>
          Ranking
        </>}
      </NavLink>
      <NavLink to="/social" className={itemClass('border-r-[3px] border-ink')}>
        {({ isActive }) => <>
          {isActive && <Active />}
          <motion.span animate={{ scale: isActive ? 1.15 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
            <MessageCircle size={18} className={isActive ? 'text-paper' : 'text-ink'} />
          </motion.span>
          Social
        </>}
      </NavLink>
      <NavLink to="/me" className={itemClass(player?.is_admin ? 'border-r-[3px] border-ink' : '')}>
        {({ isActive }) => <>
          {isActive && <Active />}
          <motion.span animate={{ scale: isActive ? 1.15 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
            <User size={18} className={isActive ? 'text-paper' : 'text-ink'} />
          </motion.span>
          Me
        </>}
      </NavLink>
      {player?.is_admin && (
        <NavLink to="/admin" className={itemClass('')}>
          {({ isActive }) => <>
            {isActive && <Active />}
            <motion.span animate={{ scale: isActive ? 1.15 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
              <Shield size={18} className={isActive ? 'text-paper' : 'text-ink'} />
            </motion.span>
            Admin
          </>}
        </NavLink>
      )}
    </nav>
  )
}
