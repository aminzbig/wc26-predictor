import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Protected } from './components/Protected'
import { BottomNav } from './components/BottomNav'
import { Login } from './screens/Login'
import { Matches } from './screens/Matches'
import { Social } from './screens/Social'
import { Ranking } from './screens/Ranking'
import { Me } from './screens/Me'
import { AdminResults } from './screens/admin/AdminResults'
import { AdminFixtures } from './screens/admin/AdminFixtures'
import { AdminPlayers } from './screens/admin/AdminPlayers'
import { AdminSettings } from './screens/admin/AdminSettings'

const Shell = ({ children }: { children: React.ReactNode }) =>
  <div className="max-w-md mx-auto bg-paper px-4 pt-4 pb-24 min-h-full">
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
      {children}
    </motion.div>
    <BottomNav />
  </div>

export default function App() {
  const base = import.meta.env.BASE_URL
  return (
    <BrowserRouter basename={base}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/matches" element={<Protected><Shell><Matches /></Shell></Protected>} />
        <Route path="/social" element={<Protected><Shell><Social /></Shell></Protected>} />
        <Route path="/ranking" element={<Protected><Shell><Ranking /></Shell></Protected>} />
        <Route path="/me" element={<Protected><Shell><Me /></Shell></Protected>} />
        <Route path="/admin" element={<Protected admin><Shell><AdminResults /></Shell></Protected>} />
        <Route path="/admin/fixtures" element={<Protected admin><Shell><AdminFixtures /></Shell></Protected>} />
        <Route path="/admin/players" element={<Protected admin><Shell><AdminPlayers /></Shell></Protected>} />
        <Route path="/admin/settings" element={<Protected admin><Shell><AdminSettings /></Shell></Protected>} />
        <Route path="*" element={<Navigate to="/matches" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
