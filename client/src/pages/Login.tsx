import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, LogIn, User } from 'lucide-react';
import { loginByName } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../context/AuthContext';

const ROLE_INFO: Record<UserRole, { label: string; description: string; color: string }> = {
  Admin:         { label: 'Admin',         description: 'Lieferungen anlegen + voller Zugriff',    color: 'text-purple-700 bg-purple-50 border-purple-200' },
  Beobachter:    { label: 'Beobachter',    description: 'Lesezugriff auf alle Bereiche',           color: 'text-gray-600 bg-gray-50 border-gray-200' },
  Wareneingang:  { label: 'Wareneingang',  description: 'Lieferungen entgegennehmen',              color: 'text-blue-700 bg-blue-50 border-blue-200' },
  Warenprüfung:  { label: 'Warenprüfung',  description: 'Pakete prüfen und Waren einbuchen',       color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
};

export default function Login() {
  const navigate = useNavigate();
  const { login, companyName } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const first = firstName.trim();
    const last  = lastName.trim();
    if (!first || !last) {
      setError('Bitte Vor- und Nachnamen eingeben.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const employee = await loginByName(first, last);
      if (!employee) {
        setError('Kein Benutzer mit diesem Namen gefunden. Bitte den Administrator kontaktieren.');
        return;
      }
      login(employee);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Anmeldung fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
            <Package size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Warenannahme</h1>
          {companyName && <p className="text-gray-400 text-sm mt-1">{companyName}</p>}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">Anmelden</h2>
            <p className="text-sm text-gray-500 mt-1">Gib deinen Namen ein, um fortzufahren.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Vorname */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Vorname
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Max"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    autoFocus
                    autoComplete="given-name"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Nachname */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Nachname
                </label>
                <input
                  type="text"
                  placeholder="Mustermann"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  autoComplete="family-name"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Fehler */}
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn size={16} />
              )}
              {loading ? 'Wird geprüft…' : 'Anmelden'}
            </button>
          </form>

          {/* Rollen-Legende */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Rollen</p>
            <div className="space-y-2">
              {(Object.entries(ROLE_INFO) as [UserRole, typeof ROLE_INFO[UserRole]][]).map(([role, info]) => (
                <div key={role} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs ${info.color}`}>
                  <span className="font-semibold w-28 flex-shrink-0">{info.label}</span>
                  <span className="text-current opacity-70">{info.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Kein Konto? Wende dich an den Systemadministrator.
        </p>
      </div>
    </div>
  );
}
