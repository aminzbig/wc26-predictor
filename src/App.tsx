import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useRef } from 'react'
import { ScrollProvider } from './context/ScrollContext'
import { Protected } from './components/Protected'
import { BottomNav } from './components/BottomNav'
import { Login } from './screens/Login'
import { Matches } from './screens/Matches'
import { Standings } from './screens/Standings'
import { Social } from './screens/Social'
import { Ranking } from './screens/Ranking'
import { Me } from './screens/Me'
import { AdminResults } from './screens/admin/AdminResults'
import { AdminFixtures } from './screens/admin/AdminFixtures'
import { AdminPlayers } from './screens/admin/AdminPlayers'
import { AdminPoints } from './screens/admin/AdminPoints'
import { AdminSettings } from './screens/admin/AdminSettings'

// Fixed-height column that is also the positioning anchor for the floating
// glass dock. The content area scrolls internally behind the dock (giving the
// glass blur something to blur). The dock is `absolute` within this container
// rather than `position: fixed`, which sidesteps iOS Safari's quirk where a
// viewport-fixed bar floats mid-screen as the page scrolls. Extra bottom
// padding keeps the last content clear of the overlaid dock.
const Shell = ({ children }: { children: React.ReactNode }) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  return (
    <div className="relative max-w-md mx-auto bg-paper h-[100dvh] flex flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+104px)]">
        <ScrollProvider value={scrollRef}>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
            {children}
          </motion.div>
        </ScrollProvider>
      </div>
      <BottomNav />
    </div>
  )
}

export default function App() {
  const base = import.meta.env.BASE_URL
  return (
    <BrowserRouter basename={base}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/matches" element={<Protected><Shell><Matches /></Shell></Protected>} />
        <Route path="/standings" element={<Protected><Shell><Standings /></Shell></Protected>} />
        <Route path="/social" element={<Protected><Shell><Social /></Shell></Protected>} />
        <Route path="/ranking" element={<Protected><Shell><Ranking /></Shell></Protected>} />
        <Route path="/me" element={<Protected><Shell><Me /></Shell></Protected>} />
        <Route path="/admin" element={<Protected admin><Shell><AdminResults /></Shell></Protected>} />
        <Route path="/admin/fixtures" element={<Protected admin><Shell><AdminFixtures /></Shell></Protected>} />
        <Route path="/admin/players" element={<Protected admin><Shell><AdminPlayers /></Shell></Protected>} />
        <Route path="/admin/points" element={<Protected admin><Shell><AdminPoints /></Shell></Protected>} />
        <Route path="/admin/settings" element={<Protected admin><Shell><AdminSettings /></Shell></Protected>} />
        <Route path="*" element={<Navigate to="/matches" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
