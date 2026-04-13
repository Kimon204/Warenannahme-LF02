import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Deliveries from './pages/Deliveries';
import DeliveryDetail from './pages/DeliveryDetail';
import NewDelivery from './pages/NewDelivery';
import InspectionWizard from './pages/InspectionWizard';
import Discrepancies from './pages/Discrepancies';
import Settings from './pages/Settings';

// Schützt alle Routen – leitet zur Login-Seite weiter wenn nicht eingeloggt
function RequireAuth() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Nur für Admins zugängliche Routen
function RequireAdmin() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/deliveries" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Alle App-Routen sind geschützt */}
          <Route element={<RequireAuth />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard"                  element={<Dashboard />} />
              <Route path="deliveries"                 element={<Deliveries />} />
              <Route element={<RequireAdmin />}>
                <Route path="deliveries/new"           element={<NewDelivery />} />
              </Route>
              <Route path="deliveries/:id"             element={<DeliveryDetail />} />
              <Route path="deliveries/:id/inspect"     element={<InspectionWizard />} />
              <Route path="discrepancies"              element={<Discrepancies />} />
              <Route path="settings"                   element={<Settings />} />
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
