import { Outlet, useNavigate } from 'react-router-dom';
import { Package, LogOut } from 'lucide-react';
import Sidebar from './Sidebar';
import { useAuth } from '../../context/AuthContext';

function MobileHeader() {
  const { user, logout, companyName } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-gray-900 text-white shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
          <Package size={17} />
        </div>
        <div>
          <p className="font-bold text-sm leading-tight">Warenannahme</p>
          {companyName && <p className="text-xs text-gray-400 leading-tight">{companyName}</p>}
        </div>
      </div>
      <div className="flex items-center gap-3 min-w-0">
        {user && (
          <div className="min-w-0 text-right">
            <p className="text-xs font-medium text-white truncate max-w-[140px]">{user.name}</p>
            <p className="text-xs text-gray-400">{user.role}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors shrink-0"
          title="Abmelden"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
