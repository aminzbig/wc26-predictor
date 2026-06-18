import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Trophy, User, Circle, Shield, MessageCircle, ListOrdered } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

// Floating glass dock: detached from the bottom edge and overlaid on the
// scrolling content, so whatever sits behind it shows through blurred (glass).
// Icons only — the active tab gets a sliding filled pill (framer layoutId).
export function BottomNav() {
  const { player } = useAuth()

  const items: { to: string; label: string; Icon: LucideIcon }[] = [
    { to: '/matches', label: 'Matches', Icon: Circle },
    { to: '/standings', label: 'Standings', Icon: ListOrdered },
    { to: '/ranking', label: 'Ranking', Icon: Trophy },
    { to: '/social', label: 'Social', Icon: MessageCircle },
    { to: '/me', label: 'Me', Icon: User },
    ...(player?.is_admin ? [{ to: '/admin', label: 'Admin', Icon: Shield }] : []),
  ]

  return (
    <nav className="absolute inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+24px)] z-50
                    flex items-center justify-around gap-1
                    border-[3px] border-ink
                    bg-paper/65 backdrop-blur-xl supports-[backdrop-filter]:bg-paper/55
                    px-2 py-2
                    shadow-[0_12px_30px_-8px_rgba(20,18,16,0.5)]">
      {items.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} aria-label={label}
          className="relative flex h-12 w-12 items-center justify-center">
          {({ isActive }) => <>
            {isActive && (
              <motion.span layoutId="navbar-pill"
                className="absolute inset-0 bg-ink"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
            )}
            <motion.span className="relative z-10"
              animate={{ scale: isActive ? 1.12 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
              <Icon size={26} strokeWidth={2.75} className={isActive ? 'text-paper' : 'text-ink'} />
            </motion.span>
          </>}
        </NavLink>
      ))}
    </nav>
  )
}
