import { NavLink } from 'react-router-dom'
const tabs = [['/admin', 'Results'], ['/admin/fixtures', 'Fixtures'], ['/admin/players', 'Players'], ['/admin/settings', 'Settings']]
export const AdminTabs = () =>
  <div className="flex gap-2 mb-4 overflow-x-auto">
    {tabs.map(([to, label]) =>
      <NavLink key={to} to={to} end className={({ isActive }) =>
        `text-xs font-semibold px-3 py-2 rounded-xl bg-surface whitespace-nowrap ${isActive ? 'shadow-neu-inset text-accent' : 'shadow-neu-sm text-muted'}`}>
        {label}</NavLink>)}
  </div>
