import { NavLink } from 'react-router-dom'
const tabs = [['/admin', 'Results'], ['/admin/fixtures', 'Fixtures'], ['/admin/players', 'Players'], ['/admin/points', 'Points'], ['/admin/settings', 'Settings']]
export const AdminTabs = () =>
  <div className="flex gap-0 mb-4 overflow-x-auto border-[3px] border-ink">
    {tabs.map(([to, label]) =>
      <NavLink key={to} to={to} end className={({ isActive }) =>
        `font-display text-[13px] uppercase tracking-wide px-4 py-2 whitespace-nowrap border-r-[3px] border-ink last:border-r-0 ${isActive ? 'bg-ink text-paper' : 'bg-paper text-ink'}`}>
        {label}
      </NavLink>)}
  </div>
