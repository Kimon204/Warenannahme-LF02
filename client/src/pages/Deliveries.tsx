import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  format, parseISO, isToday, isBefore, startOfDay, formatDistanceToNow,
} from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Plus, Search, RefreshCw, ChevronRight, ChevronUp, ChevronDown,
  ChevronsUpDown, Truck, AlertTriangle, X, Calendar, Play,
  ClipboardList, RotateCcw,
} from 'lucide-react';
import { getDeliveries, getSuppliers } from '../api/client';
import type { Delivery, DeliveryStatus, Supplier } from '../types';
import { DELIVERY_STATUS_LABELS } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────────
type SortField = 'supplier_name' | 'status' | 'date' | 'number_of_packages' | 'assigned_to';
type SortDir = 'asc' | 'desc';
type DateRange = '' | 'today' | 'week' | 'month';

// ── Constants ──────────────────────────────────────────────────────────────────
const ALL_STATUS_TABS: { value: DeliveryStatus | ''; label: string }[] = [
  { value: '', label: 'Alle' },
  { value: 'expected', label: DELIVERY_STATUS_LABELS.expected },
  { value: 'arrived', label: DELIVERY_STATUS_LABELS.arrived },
  { value: 'in_inspection', label: DELIVERY_STATUS_LABELS.in_inspection },
  { value: 'flagged', label: DELIVERY_STATUS_LABELS.flagged },
  { value: 'completed', label: DELIVERY_STATUS_LABELS.completed },
  { value: 'returned', label: DELIVERY_STATUS_LABELS.returned },
];

// Welche Status-Tabs je Rolle sichtbar sind
const ROLE_TABS: Record<string, (DeliveryStatus | '')[]> = {
  Wareneingang: ['expected'],
  Warenprüfung: ['arrived', 'in_inspection'],
};

// Welche Status-Werte je Rolle geladen werden (leeres Array = alle)
const ROLE_STATUS_FILTER: Record<string, DeliveryStatus[]> = {
  Wareneingang: ['expected'],
  Warenprüfung: ['arrived', 'in_inspection'],
};

// Active tab pill colors per status
const TAB_ACTIVE: Record<string, string> = {
  '':            'bg-gray-900 text-white border-gray-900',
  expected:      'bg-blue-100 text-blue-800 border-blue-300',
  arrived:       'bg-indigo-100 text-indigo-800 border-indigo-300',
  in_inspection: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  flagged:       'bg-red-100 text-red-800 border-red-300',
  completed:     'bg-green-100 text-green-800 border-green-300',
  returned:      'bg-gray-100 text-gray-700 border-gray-300',
};

// Subtle row tinting by status (draws attention to items needing action)
const ROW_TINT: Record<string, string> = {
  flagged:       'bg-red-50/40',
  arrived:       'bg-indigo-50/30',
  in_inspection: 'bg-yellow-50/20',
  expected:      '',
  completed:     '',
  returned:      'bg-gray-50/40',
};

// Priority order for status sort (most urgent first)
const STATUS_PRIORITY: DeliveryStatus[] = [
  'flagged', 'arrived', 'in_inspection', 'expected', 'returned', 'completed',
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function getDeliveryDate(d: Delivery): Date | null {
  const s = d.actual_arrival_date || d.expected_date;
  return s ? parseISO(s) : null;
}

interface DateDisplay {
  primary: string;
  secondary?: string;
  secondaryClass?: string;
}

function formatDeliveryDate(d: Delivery): DateDisplay {
  if (d.actual_arrival_date) {
    const dt = parseISO(d.actual_arrival_date);
    return {
      primary: format(dt, 'dd.MM.yyyy, HH:mm'),
      secondary: isToday(dt)
        ? formatDistanceToNow(dt, { addSuffix: true, locale: de })
        : undefined,
      secondaryClass: 'text-blue-500 font-medium',
    };
  }
  if (d.expected_date) {
    const dt = parseISO(d.expected_date);
    const overdue = d.status === 'expected' && isBefore(dt, startOfDay(new Date()));
    if (overdue) {
      return {
        primary: `Erwartet: ${format(dt, 'dd.MM.yyyy')}`,
        secondary: 'Überfällig',
        secondaryClass: 'text-red-500 font-semibold',
      };
    }
    if (isToday(dt)) {
      return {
        primary: `Erwartet: ${format(dt, 'dd.MM.yyyy')}`,
        secondary: 'Heute',
        secondaryClass: 'text-emerald-600 font-semibold',
      };
    }
    return { primary: `Erwartet: ${format(dt, 'dd.MM.yyyy')}` };
  }
  return { primary: format(parseISO(d.created_at), 'dd.MM.yyyy') };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PackageProgress({ delivery }: { delivery: Delivery }) {
  if (delivery.status === 'in_inspection') {
    const done = delivery.packages_inspected ?? 0;
    const total = delivery.number_of_packages;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-700 tabular-nums">{done}/{total}</span>
        <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-500 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }
  return <span className="text-gray-600">{delivery.number_of_packages}</span>;
}

interface SortIconProps {
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
}
function SortIcon({ field, sortField, sortDir }: SortIconProps) {
  if (sortField !== field) return <ChevronsUpDown size={13} className="text-gray-400 ml-1 flex-shrink-0" />;
  return sortDir === 'asc'
    ? <ChevronUp size={13} className="text-blue-600 ml-1 flex-shrink-0" />
    : <ChevronDown size={13} className="text-blue-600 ml-1 flex-shrink-0" />;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Deliveries() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isReceiver, isInspector, isAdmin } = useAuth();
  const role = user?.role ?? 'Beobachter';

  // Für Wareneingang/Warenprüfung ist der Tab fest vorgegeben
  const lockedStatuses = ROLE_STATUS_FILTER[role] ?? [];
  const isRoleLocked   = lockedStatuses.length > 0;

  // Sichtbare Tabs je Rolle
  const visibleTabs = isRoleLocked
    ? ALL_STATUS_TABS.filter(t => lockedStatuses.includes(t.value as DeliveryStatus))
    : ALL_STATUS_TABS;

  const [allDeliveries, setAllDeliveries] = useState<Delivery[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters — bei gesperrten Rollen wird kein freier Status-Tab-Wechsel erlaubt
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    if (isRoleLocked) return ''; // alle rollenrelevanten Status laden, Tabs zeigen es
    return searchParams.get('status') || '';
  });
  const [supplierFilter, setSupplierFilter] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('');

  // Sorting – default: neueste zuerst
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── Data loading ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Bei gesperrten Rollen mehrere Status-Queries parallel laden und zusammenführen
      const fetchDeliveries = isRoleLocked
        ? Promise.all(lockedStatuses.map(s => getDeliveries({ status: s }))).then(results =>
            results.flat().sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
          )
        : getDeliveries();

      const [delivs, supps] = await Promise.all([fetchDeliveries, getSuppliers()]);
      setAllDeliveries(delivs);
      setSuppliers(supps);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [isRoleLocked, lockedStatuses]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (statusFilter) setSearchParams({ status: statusFilter });
    else setSearchParams({});
  }, [statusFilter, setSearchParams]);

  // ── Counts for status tabs ────────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allDeliveries.forEach(d => {
      counts[d.status] = (counts[d.status] || 0) + 1;
    });
    return counts;
  }, [allDeliveries]);

  // ── Urgent items for the action summary (shown when no status filter active) ──
  const urgentGroups = useMemo(() => {
    const todayExpected = allDeliveries.filter(
      d => d.status === 'expected' && d.expected_date && isToday(parseISO(d.expected_date))
    );
    const awaitingInspection = allDeliveries.filter(d => d.status === 'arrived');
    const flagged = allDeliveries.filter(d => d.status === 'flagged');
    return { todayExpected, awaitingInspection, flagged };
  }, [allDeliveries]);

  // ── Filtering + Sorting ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = [...allDeliveries];

    // Status filter — bei gesperrten Rollen über Tab, sonst über lockedStatuses
    if (isRoleLocked && statusFilter) {
      result = result.filter(d => d.status === statusFilter);
    } else if (!isRoleLocked && statusFilter) {
      result = result.filter(d => d.status === statusFilter);
    }

    // Text search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        d.supplier_name.toLowerCase().includes(q) ||
        d.delivery_note_number?.toLowerCase().includes(q) ||
        d.purchase_order_number?.toLowerCase().includes(q) ||
        d.carrier?.toLowerCase().includes(q) ||
        d.assigned_to?.toLowerCase().includes(q)
      );
    }

    // Supplier filter
    if (supplierFilter) {
      result = result.filter(d => d.supplier_id === supplierFilter);
    }

    // Date range filter
    if (dateRange) {
      result = result.filter(d => {
        const dt = getDeliveryDate(d);
        if (!dt) return false;
        if (dateRange === 'today') return isToday(dt);
        if (dateRange === 'week') {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 7);
          return dt >= cutoff;
        }
        if (dateRange === 'month') {
          const cutoff = new Date();
          cutoff.setMonth(cutoff.getMonth() - 1);
          return dt >= cutoff;
        }
        return true;
      });
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'supplier_name':
          cmp = a.supplier_name.localeCompare(b.supplier_name, 'de');
          break;
        case 'status':
          cmp = STATUS_PRIORITY.indexOf(a.status) - STATUS_PRIORITY.indexOf(b.status);
          break;
        case 'date': {
          const da = getDeliveryDate(a)?.getTime() ?? 0;
          const db = getDeliveryDate(b)?.getTime() ?? 0;
          cmp = da - db;
          break;
        }
        case 'number_of_packages':
          cmp = a.number_of_packages - b.number_of_packages;
          break;
        case 'assigned_to':
          cmp = (a.assigned_to || '').localeCompare(b.assigned_to || '', 'de');
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return result;
  }, [allDeliveries, statusFilter, search, supplierFilter, dateRange, sortField, sortDir]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function clearFilters() {
    setSearch('');
    setSupplierFilter('');
    setDateRange('');
    setStatusFilter('');
  }

  const activeFilterCount = [search, supplierFilter, dateRange, statusFilter].filter(Boolean).length;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lieferungen</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Wird geladen…' : `${filtered.length} von ${allDeliveries.length} Einträgen`}
            {isRoleLocked && (
              <span className="ml-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                {role === 'Wareneingang' ? 'Ansicht: Erwartet' : 'Ansicht: Zu prüfen'}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            title="Aktualisieren"
            disabled={loading}
            className="p-2 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {isAdmin && (
            <button
              onClick={() => navigate('/deliveries/new')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={15} /> Lieferung hinzufügen
            </button>
          )}
        </div>
      </div>

      {/* ── Status-Tabs ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-5">
        {visibleTabs.map(tab => {
          const count = tab.value === '' ? allDeliveries.length : (statusCounts[tab.value] ?? 0);
          const isActive = isRoleLocked
            ? statusFilter === tab.value || (statusFilter === '' && visibleTabs.length === 1)
            : statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                isActive
                  ? TAB_ACTIVE[tab.value]
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full leading-none ${
                isActive
                  ? 'bg-black/10'
                  : count === 0 ? 'text-gray-400' : 'bg-gray-100 text-gray-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Aktuelle Handlungspunkte (nur wenn kein Statusfilter aktiv) ──────── */}
      {!statusFilter && !loading && (
        urgentGroups.todayExpected.length > 0 ||
        urgentGroups.awaitingInspection.length > 0 ||
        urgentGroups.flagged.length > 0
      ) && (
        <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {urgentGroups.todayExpected.length > 0 && (
            <button
              onClick={() => setStatusFilter('expected')}
              className="flex items-center gap-3 p-3.5 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100/70 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Calendar size={18} className="text-blue-600" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-blue-900">
                  {urgentGroups.todayExpected.length} heute erwartet
                </div>
                <div className="text-xs text-blue-600 truncate">
                  {urgentGroups.todayExpected.map(d => d.supplier_name.split(' ')[0]).join(', ')}
                </div>
              </div>
            </button>
          )}

          {urgentGroups.awaitingInspection.length > 0 && (
            <button
              onClick={() => setStatusFilter('arrived')}
              className="flex items-center gap-3 p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100/70 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Truck size={18} className="text-indigo-600" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-indigo-900">
                  {urgentGroups.awaitingInspection.length} warten auf Prüfung
                </div>
                <div className="text-xs text-indigo-600 truncate">
                  {urgentGroups.awaitingInspection.map(d => d.supplier_name.split(' ')[0]).join(', ')}
                </div>
              </div>
            </button>
          )}

          {urgentGroups.flagged.length > 0 && (
            <button
              onClick={() => setStatusFilter('flagged')}
              className="flex items-center gap-3 p-3.5 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100/70 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-red-900">
                  {urgentGroups.flagged.length} eskaliert – Handlungsbedarf
                </div>
                <div className="text-xs text-red-600 truncate">
                  {urgentGroups.flagged.map(d => d.supplier_name.split(' ')[0]).join(', ')}
                </div>
              </div>
            </button>
          )}
        </div>
      )}

      {/* ── Filter-Zeile ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Volltext-Suche */}
        <div className="relative flex-1 min-w-56">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Suche: Lieferant, Lieferschein, Bestellnr., Frachtführer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Lieferant */}
        <select
          value={supplierFilter}
          onChange={e => setSupplierFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Alle Lieferanten</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        {/* Zeitraum */}
        <select
          value={dateRange}
          onChange={e => setDateRange(e.target.value as DateRange)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Alle Zeiträume</option>
          <option value="today">Heute</option>
          <option value="week">Letzte 7 Tage</option>
          <option value="month">Letzter Monat</option>
        </select>

        {/* Filter zurücksetzen */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X size={13} />
            Filter zurücksetzen
          </button>
        )}
      </div>

      {/* ── Tabelle ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <Truck size={32} className="opacity-25" />
            <p className="text-sm">Keine Lieferungen gefunden</p>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-blue-500 hover:underline"
              >
                Alle Filter zurücksetzen
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {/* Lieferant */}
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  <button
                    onClick={() => handleSort('supplier_name')}
                    className="flex items-center hover:text-gray-900 transition-colors"
                  >
                    Lieferant
                    <SortIcon field="supplier_name" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                {/* Dokumente */}
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  Lieferschein / Bestellnr.
                </th>
                {/* Pakete */}
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  <button
                    onClick={() => handleSort('number_of_packages')}
                    className="flex items-center hover:text-gray-900 transition-colors"
                  >
                    Pakete
                    <SortIcon field="number_of_packages" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                {/* Status */}
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center hover:text-gray-900 transition-colors"
                  >
                    Status
                    <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                {/* Datum */}
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  <button
                    onClick={() => handleSort('date')}
                    className="flex items-center hover:text-gray-900 transition-colors"
                  >
                    Datum
                    <SortIcon field="date" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                {/* Zuständig */}
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  <button
                    onClick={() => handleSort('assigned_to')}
                    className="flex items-center hover:text-gray-900 transition-colors"
                  >
                    Zuständig
                    <SortIcon field="assigned_to" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                {/* Aktionen */}
                <th className="px-4 py-3 w-36" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(d => {
                const dateInfo = formatDeliveryDate(d);
                return (
                  <tr
                    key={d.id}
                    onClick={() => navigate(`/deliveries/${d.id}`)}
                    className={`hover:bg-gray-50/80 cursor-pointer transition-colors ${ROW_TINT[d.status] ?? ''}`}
                  >
                    {/* Lieferant + Frachtführer */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{d.supplier_name}</div>
                      {d.carrier
                        ? <div className="text-xs text-gray-400 mt-0.5">{d.carrier}</div>
                        : null}
                    </td>

                    {/* Lieferschein + Bestellnr. */}
                    <td className="px-4 py-3">
                      <div className="text-gray-700">
                        {d.delivery_note_number || <span className="text-gray-400">—</span>}
                      </div>
                      {d.purchase_order_number && (
                        <div className="text-xs text-gray-400 mt-0.5">{d.purchase_order_number}</div>
                      )}
                    </td>

                    {/* Pakete (mit Fortschrittsbalken bei in_inspection) */}
                    <td className="px-4 py-3">
                      <PackageProgress delivery={d} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge type="delivery" status={d.status} />
                    </td>

                    {/* Datum */}
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{dateInfo.primary}</div>
                      {dateInfo.secondary && (
                        <div className={`text-xs mt-0.5 ${dateInfo.secondaryClass ?? 'text-gray-400'}`}>
                          {dateInfo.secondary}
                        </div>
                      )}
                    </td>

                    {/* Zuständig */}
                    <td className="px-4 py-3 text-gray-600">
                      {d.assigned_to || <span className="text-gray-400">—</span>}
                    </td>

                    {/* Schnellaktion + Chevron */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* Wareneingang: Eingang bestätigen */}
                        {d.status === 'expected' && isReceiver && (
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/deliveries/${d.id}`); }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                          >
                            <Truck size={11} />
                            Eingang buchen
                          </button>
                        )}
                        {/* Warenprüfung: Prüfung starten */}
                        {d.status === 'arrived' && isInspector && (
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/deliveries/${d.id}/inspect`); }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                          >
                            <Play size={11} />
                            Prüfung starten
                          </button>
                        )}
                        {/* Warenprüfung: Prüfung fortsetzen */}
                        {d.status === 'in_inspection' && isInspector && (
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/deliveries/${d.id}/inspect`); }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 transition-colors"
                          >
                            <ClipboardList size={11} />
                            Weiter prüfen
                          </button>
                        )}
                        {/* Beide Rollen: Abweichung sichtbar */}
                        {d.status === 'flagged' && !role.startsWith('Beobachter') && (
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/deliveries/${d.id}`); }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                          >
                            <AlertTriangle size={11} />
                            Abweichung
                          </button>
                        )}
                        {d.status === 'returned' && (
                          <button
                            onClick={e => { e.stopPropagation(); navigate(`/deliveries/${d.id}`); }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-colors"
                          >
                            <RotateCcw size={11} />
                            Retoure
                          </button>
                        )}
                        <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Fußzeile ────────────────────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && activeFilterCount > 0 && (
        <p className="text-xs text-gray-400 mt-3 text-right">
          {filtered.length} von {allDeliveries.length} Lieferungen · Filter aktiv
        </p>
      )}
    </div>
  );
}
