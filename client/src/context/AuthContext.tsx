import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Employee } from '../types';
import { getAppSettings } from '../api/client';

export type UserRole = 'Admin' | 'Beobachter' | 'Wareneingang' | 'Warenprüfung';

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  login:   (employee: Employee) => void;
  logout:  () => void;
  /** Darf der aktuelle User Schreibaktionen ausführen? */
  canWrite:    boolean;
  /** Hat der User die Rolle Warenprüfung? */
  isInspector: boolean;
  /** Hat der User die Rolle Wareneingang? */
  isReceiver:  boolean;
  /** Hat der User die Rolle Admin? */
  isAdmin:     boolean;
  /** Firmenname aus den App-Einstellungen */
  companyName: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = 'warenannahme_user';

function loadSession(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadSession);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    getAppSettings()
      .then(s => setCompanyName(s.company_name ?? ''))
      .catch(() => {});
  }, []);

  const login = useCallback((employee: Employee) => {
    const authUser: AuthUser = {
      id:    employee.id,
      name:  employee.name,
      email: employee.email,
      role:  (employee.role as UserRole) ?? 'Beobachter',
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(authUser));
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const isAdmin     = user?.role === 'Admin';
  const canWrite    = isAdmin || user?.role === 'Wareneingang' || user?.role === 'Warenprüfung';
  const isInspector = user?.role === 'Warenprüfung';
  const isReceiver  = user?.role === 'Wareneingang';

  return (
    <AuthContext.Provider value={{ user, login, logout, canWrite, isInspector, isReceiver, isAdmin, companyName }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden');
  return ctx;
}
