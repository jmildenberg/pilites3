import { NavLink } from 'react-router-dom';
import { usePlays } from '../../context/PlaysContext';

const NAV_ITEMS = [
  { to: '/', label: 'Show', icon: '▶' },
  { to: '/editor', label: 'Editor', icon: '✏' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export function Sidebar() {
  const { loading, error } = usePlays();
  const dot = loading ? 'bg-yellow-500' : error ? 'bg-red-500' : 'bg-green-500';

  return (
    <aside className="flex flex-col w-16 bg-[#1a1a1a] border-r border-[#2e2e2e] shrink-0">
      <div className="flex items-center justify-center h-14 border-b border-[#2e2e2e]">
        <span className="text-[#646cff] font-bold text-sm">PL</span>
      </div>

      <nav className="flex flex-col gap-1 p-2 flex-1">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center h-12 rounded text-xs gap-0.5 transition-colors ` +
              (isActive
                ? 'bg-[#646cff]/20 text-[#646cff]'
                : 'text-neutral-400 hover:text-neutral-100 hover:bg-[#2e2e2e]')
            }
          >
            <span className="text-base leading-none">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Backend connection indicator */}
      <div className="flex justify-center pb-3" title={error ?? 'Connected'}>
        <div className={`w-2 h-2 rounded-full ${dot}`} />
      </div>
    </aside>
  );
}
