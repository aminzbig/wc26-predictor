import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Protected } from './components/Protected'
import { BottomNav } from './components/BottomNav'
import { Login } from './screens/Login'
import { Matches } from './screens/Matches'
import { Ranking } from './screens/Ranking'
import { Me } from './screens/Me'
import { AdminResults } from './screens/admin/AdminResults'
import { AdminFixtures } from './screens/admin/AdminFixtures'
import { AdminPlayers } from './screens/admin/AdminPlayers'
import { AdminSettings } from './screens/admin/AdminSettings'

const Shell = ({ children }: { children: React.ReactNode }) =>
  <div className="max-w-md mx-auto px-4 pt-6 pb-24 min-h-full">{children}<BottomNav /></div>

export default function App() {
  const base = import.meta.env.BASE_URL
  return (
    <BrowserRouter basename={base}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/matches" element={<Protected><Shell><Matches /></Shell></Protected>} />
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
