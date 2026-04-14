import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Truck, ClipboardCheck, AlertTriangle,
  Plus, RefreshCw, Package, CheckCircle, Clock, XCircle, Settings,
} from 'lucide-react';
import { getDashboard } from '../api/client';
import { DashboardStats, DELIVERY_STATUS_LABELS, DeliveryStatus } from '../types';
import { useAuth } from '../context/AuthContext';

const PIPELINE_ORDER: DeliveryStatus[] = ['expected', 'arrived', 'in_inspection', 'completed', 'flagged', 'returned'];

const pipelineColors: Record<string, string> = {
  expected:      'border-blue-400 bg-blue-50',
  arrived:       'border-indigo-400 bg-indigo-50',
  in_inspection: 'border-yellow-400 bg-yellow-50',
  completed:     'border-green-400 bg-green-50',
  flagged:       'border-red-400 bg-red-50',
  returned:      'border-gray-400 bg-gray-50',
};

const activityIcons: Record<string, React.ReactNode> = {
  created:    <Plus size={14} />,
  completed:  <CheckCircle size={14} />,
  flagged:    <AlertTriangle size={14} />,
  updated:    <RefreshCw size={14} />,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAdmin, isReceiver, isInspector } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(async () => {
    try {
      const data = await getDashboard();
      setStats(data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  const kpis = [
    {
      label: 'Lieferungen heute',
      value: stats?.deliveries_today ?? 0,
      icon: Truck,
      color: 'text-blue-600 bg-blue-100',
      onClick: () => navigate('/deliveries'),
    },
    {
      label: 'Offene Prüfungen',
      value: stats?.open_inspections ?? 0,
      icon: ClipboardCheck,
      color: 'text-yellow-600 bg-yellow-100',
      onClick: () => navigate('/deliveries?status=in_inspection'),
    },
    {
      label: 'Eskalierte Lieferungen',
      value: stats?.flagged_items ?? 0,
      icon: AlertTriangle,
      color: 'text-red-600 bg-red-100',
      onClick: () => navigate('/deliveries?status=flagged'),
    },
    {
      label: 'Offene Abweichungen',
      value: stats?.open_discrepancies ?? 0,
      icon: XCircle,
      color: 'text-orange-600 bg-orange-100',
      onClick: () => navigate('/discrepancies'),
    },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(new Date(), "EEEE, d. MMMM yyyy", { locale: de })}
            <span className="hidden sm:inline"> &bull; Aktualisiert: {format(lastRefresh, 'HH:mm:ss')}</span>
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw size={15} />
            <span className="hidden sm:inline">Aktualisieren</span>
          </button>
          {/* Primäre Aktion je Rolle – nur auf Desktop (auf Mobile im Nav-Bereich) */}
          {isAdmin && (
            <button
              onClick={() => navigate('/deliveries/new')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus size={15} /> Neue Lieferung
            </button>
          )}
          {isReceiver && (
            <button
              onClick={() => navigate('/deliveries')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              <Truck size={15} /> Neuer Wareneingang
            </button>
          )}
          {isInspector && (
            <button
              onClick={() => navigate('/deliveries?status=arrived')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700"
            >
              <ClipboardCheck size={15} /> Wareneingang prüfen
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map(kpi => (
          <button
            key={kpi.label}
            onClick={kpi.onClick}
            className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:shadow-md transition-shadow"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${kpi.color}`}>
              <kpi.icon size={20} />
            </div>
            <p className="text-3xl font-bold text-gray-900">{kpi.value}</p>
            <p className="text-sm text-gray-500 mt-1">{kpi.label}</p>
          </button>
        ))}
      </div>

      {/* ── Mobile Navigation ────────────────────────────────────────────────── */}
      <div className="lg:hidden mb-6">
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => navigate('/deliveries')}
            className="flex flex-col items-center gap-2 py-4 px-2 bg-white rounded-xl border border-gray-200 hover:shadow-md active:bg-gray-50 transition-shadow"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Truck size={20} className="text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">Lieferungen</span>
          </button>
          <button
            onClick={() => navigate('/discrepancies')}
            className="flex flex-col items-center gap-2 py-4 px-2 bg-white rounded-xl border border-gray-200 hover:shadow-md active:bg-gray-50 transition-shadow"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <AlertTriangle size={20} className="text-orange-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">Abweichungen</span>
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="flex flex-col items-center gap-2 py-4 px-2 bg-white rounded-xl border border-gray-200 hover:shadow-md active:bg-gray-50 transition-shadow"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <Settings size={20} className="text-gray-600" />
            </div>
            <span className="text-xs font-medium text-gray-700">Einstellungen</span>
          </button>
        </div>
        {/* Rollenspezifische Primäraktion */}
        {isAdmin && (
          <button
            onClick={() => navigate('/deliveries/new')}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 active:bg-blue-800"
          >
            <Plus size={16} /> Neue Lieferung erfassen
          </button>
        )}
        {isReceiver && (
          <button
            onClick={() => navigate('/deliveries')}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 active:bg-indigo-800"
          >
            <Truck size={16} /> Neuer Wareneingang
          </button>
        )}
        {isInspector && (
          <button
            onClick={() => navigate('/deliveries?status=arrived')}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-yellow-600 rounded-xl hover:bg-yellow-700 active:bg-yellow-800"
          >
            <ClipboardCheck size={16} /> Wareneingang prüfen
          </button>
        )}
      </div>

      {/* Pipeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Package size={18} className="text-blue-600" />
          Lieferungs-Pipeline
        </h2>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {PIPELINE_ORDER.map(status => (
            <button
              key={status}
              onClick={() => navigate(`/deliveries?status=${status}`)}
              className={`border-l-4 rounded-lg p-3 text-left hover:opacity-80 transition-opacity ${pipelineColors[status]}`}
            >
              <p className="text-2xl font-bold text-gray-900">{stats?.pipeline[status] ?? 0}</p>
              <p className="text-xs text-gray-600 mt-0.5">{DELIVERY_STATUS_LABELS[status]}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Schnellzugriff</h2>
          <div className="space-y-2">
            {/* Admin */}
            {isAdmin && (
              <button
                onClick={() => navigate('/deliveries/new')}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                <Plus size={16} /> Neue Lieferung erfassen
              </button>
            )}
            {/* Wareneingang */}
            {isReceiver && (
              <button
                onClick={() => navigate('/deliveries')}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                <Truck size={16} /> Neuer Wareneingang
              </button>
            )}
            {/* Warenprüfung */}
            {isInspector && (
              <button
                onClick={() => navigate('/deliveries?status=arrived')}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700"
              >
                <ClipboardCheck size={16} /> Wareneingang prüfen
              </button>
            )}
            {/* Gemeinsame Aktionen */}
            <button
              onClick={() => navigate('/discrepancies')}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100"
            >
              <AlertTriangle size={16} /> Abweichungen verwalten
            </button>
            <button
              onClick={() => navigate('/deliveries?status=in_inspection')}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100"
            >
              <ClipboardCheck size={16} /> Laufende Prüfungen
            </button>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock size={18} className="text-blue-600" />
            Letzte Aktivitäten
          </h2>
          {!stats?.recent_activity?.length ? (
            <p className="text-sm text-gray-400 text-center py-8">Keine Aktivitäten vorhanden</p>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin">
              {stats.recent_activity.map(item => (
                <div key={item.id} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                    {activityIcons[item.action] ?? <Clock size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{item.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.performed_by && (
                        <span className="text-xs text-gray-400">{item.performed_by}</span>
                      )}
                      <span className="text-xs text-gray-400">
                        {format(parseISO(item.created_at), 'dd.MM.yyyy HH:mm')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
