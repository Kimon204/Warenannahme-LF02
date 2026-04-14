import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, AlertTriangle,
  Settings, Truck, ChevronRight, LogOut,
} from 'lucide-react';
import { useAuth, type UserRole } from '../../context/AuthContext';

const nav = [
  { to: '/dashboard',      icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/deliveries',     icon: Truck,           label: 'Lieferungen' },
  { to: '/discrepancies',  icon: AlertTriangle,   label: 'Abweichungen' },
  { to: '/settings',       icon: Settings,        label: 'Einstellungen' },
];

const ROLE_BADGE: Record<UserRole, string> = {
  Admin:        'bg-purple-600 text-purple-100',
  Beobachter:   'bg-gray-600 text-gray-200',
  Wareneingang: 'bg-blue-600 text-blue-100',
  Warenprüfung: 'bg-yellow-600 text-yellow-100',
};

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="hidden lg:flex w-64 bg-gray-900 text-white flex-col min-h-screen shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center">
            <Package size={20} />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">Warenannahme</p>
            <p className="text-xs text-gray-400">IT Service GmbH</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={18} />
            <span className="flex-1">{label}</span>
            <ChevronRight size={14} className="opacity-40" />
          </NavLink>
        ))}
      </nav>

      {/* User-Info + Logout */}
      <div className="px-3 pb-4 border-t border-gray-700 pt-4 space-y-2">
        {user && (
          <div className="px-3 py-3 rounded-lg bg-gray-800">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                {initials(user.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                {user.email && (
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                )}
              </div>
            </div>
            <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[user.role]}`}>
              {user.role}
            </span>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          <span>Abmelden</span>
        </button>
      </div>
    </aside>
  );
}
