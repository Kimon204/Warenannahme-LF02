import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle, Filter, RefreshCw, MessageSquare, ChevronDown, ChevronUp, Check,
  Send, CheckCircle, Bell
} from 'lucide-react';
import {
  getDiscrepancies, updateDiscrepancy, appendDiscrepancyLog, getEmployees
} from '../api/client';
import {
  Discrepancy, Employee, DISCREPANCY_STATUS_LABELS, DISCREPANCY_TYPE_LABELS, DiscrepancyStatus
} from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';

const STATUS_OPTIONS = [
  { value: '', label: 'Alle Status' },
  { value: 'open', label: 'Offen' },
  { value: 'in_progress', label: 'In Bearbeitung' },
  { value: 'resolved', label: 'Gelöst' },
  { value: 'complaint_sent', label: 'Mängelrüge verschickt' },
];

const DEMAND_OPTIONS = [
  { value: 'Ersatzlieferung', label: 'Ersatzlieferung' },
  { value: 'Gutschrift', label: 'Gutschrift / Preisminderung' },
  { value: 'Reparatur', label: 'Reparatur' },
  { value: 'Rücksendung', label: 'Rücksendung auf Lieferantenkosten' },
  { value: 'Sonstiges', label: 'Sonstiges' },
];

interface ComplaintForm {
  beschreibung: string;
  forderung: string;
  bearbeiter: string;
}

export default function Discrepancies() {
  const [searchParams] = useSearchParams();
  const { user, isInspector } = useAuth();
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('open');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logModal, setLogModal] = useState<{ id: string; log: string } | null>(null);
  const [logEntry, setLogEntry] = useState('');
  const [logUser, setLogUser] = useState(user?.name || '');

  // Mängelrüge
  const [complaintModal, setComplaintModal] = useState<Discrepancy | null>(null);
  const [complaintForm, setComplaintForm] = useState<ComplaintForm>({ beschreibung: '', forderung: 'Ersatzlieferung', bearbeiter: '' });
  const [complaintSending, setComplaintSending] = useState(false);
  const [complaintSuccess, setComplaintSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const deliveryId = searchParams.get('delivery_id');
      if (deliveryId) params.delivery_id = deliveryId;
      const [data, emps] = await Promise.all([getDiscrepancies(params), getEmployees()]);
      setDiscrepancies(data);
      setEmployees(emps);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchParams]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (disc: Discrepancy, newStatus: DiscrepancyStatus) => {
    await updateDiscrepancy(disc.id, { status: newStatus });
    load();
  };

  const handleAssign = async (disc: Discrepancy, assigned: string) => {
    await updateDiscrepancy(disc.id, { assigned_to: assigned });
    load();
  };

  const handleAddLog = async () => {
    if (!logModal || !logEntry.trim()) return;
    await appendDiscrepancyLog(logModal.id, logEntry, logUser);
    setLogEntry('');
    setLogModal(null);
    load();
  };

  function openComplaintModal(disc: Discrepancy) {
    setComplaintForm({
      beschreibung: disc.description,
      forderung: 'Ersatzlieferung',
      bearbeiter: user?.name || '',
    });
    setComplaintSuccess(false);
    setComplaintModal(disc);
  }

  const handleSendComplaint = async () => {
    if (!complaintModal || !complaintForm.bearbeiter) return;
    setComplaintSending(true);
    try {
      const logText = [
        `[Mängelrüge verschickt]`,
        `Lieferant: ${complaintModal.supplier_name || '—'}`,
        `Lieferschein: ${complaintModal.delivery_note_number || '—'}`,
        `Art: ${DISCREPANCY_TYPE_LABELS[complaintModal.type]}`,
        `Mangel: ${complaintForm.beschreibung}`,
        `Forderung: ${complaintForm.forderung}`,
        `Bearbeiter: ${complaintForm.bearbeiter}`,
        `Datum: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`,
      ].join('\n');

      await updateDiscrepancy(complaintModal.id, { status: 'complaint_sent' });
      await appendDiscrepancyLog(complaintModal.id, logText, complaintForm.bearbeiter);
      setComplaintSuccess(true);
      load();
    } finally {
      setComplaintSending(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Abweichungen & Reklamationen</h1>
          <p className="text-sm text-gray-500 mt-0.5">{discrepancies.length} Einträge</p>
        </div>
        <button onClick={load} className="p-2 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : discrepancies.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Check size={40} className="mx-auto mb-3 text-green-400" />
          <p className="text-gray-500">Keine Abweichungen gefunden</p>
        </div>
      ) : (
        <div className="space-y-3">
          {discrepancies.map(disc => {
            const isExpanded = expandedId === disc.id;
            const isComplaintSent = disc.status === 'complaint_sent';
            return (
              <div key={disc.id} className={`bg-white rounded-xl border ${
                isComplaintSent ? 'border-purple-200' :
                disc.status === 'resolved' ? 'border-gray-200' :
                disc.status === 'open' ? 'border-red-200' : 'border-yellow-200'
              } overflow-hidden`}>
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : disc.id)}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isComplaintSent ? 'bg-purple-100 text-purple-600' :
                    disc.status === 'resolved' ? 'bg-green-100 text-green-600' :
                    disc.status === 'open' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                  }`}>
                    <AlertTriangle size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-900">
                        {DISCREPANCY_TYPE_LABELS[disc.type]}
                      </span>
                      <StatusBadge type="discrepancy" status={disc.status} />
                    </div>
                    <p className="text-sm text-gray-600 truncate">{disc.description}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {disc.supplier_name && <span>Lieferant: {disc.supplier_name}</span>}
                      {disc.delivery_note_number && <span>LS: {disc.delivery_note_number}</span>}
                      <span>{format(parseISO(disc.created_at), 'dd.MM.yyyy HH:mm')}</span>
                      {disc.assigned_to && <span>Zuständig: {disc.assigned_to}</span>}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
                </div>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-gray-100">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 mb-4">
                      {/* Status – gesperrt wenn complaint_sent */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Status ändern</label>
                        {isComplaintSent ? (
                          <div className="px-3 py-2 text-sm bg-purple-50 border border-purple-200 rounded-lg text-purple-800 flex items-center gap-2">
                            <Send size={13} /> Mängelrüge verschickt
                          </div>
                        ) : (
                          <select
                            value={disc.status}
                            onChange={e => handleStatusChange(disc, e.target.value as DiscrepancyStatus)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {(['open', 'in_progress', 'resolved'] as DiscrepancyStatus[]).map(v => (
                              <option key={v} value={v}>{DISCREPANCY_STATUS_LABELS[v]}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      {/* Assign */}
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Zuständig</label>
                        <select
                          value={disc.assigned_to || ''}
                          onChange={e => handleAssign(disc, e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">— zuweisen —</option>
                          {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                        </select>
                      </div>
                      {/* Resolved At */}
                      {disc.resolved_at && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Gelöst am</label>
                          <p className="text-sm text-gray-900">{format(parseISO(disc.resolved_at), 'dd.MM.yyyy HH:mm')}</p>
                        </div>
                      )}
                    </div>

                    {/* Mängelrüge Button */}
                    {isInspector && !isComplaintSent && (
                      <div className="mb-4">
                        <button
                          onClick={() => openComplaintModal(disc)}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
                        >
                          <Send size={14} /> Mängelrüge verschicken
                        </button>
                      </div>
                    )}

                    {/* Communication Log */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-500">Kommunikationsprotokoll</label>
                        <button
                          onClick={() => setLogModal({ id: disc.id, log: disc.supplier_communication_log || '' })}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                        >
                          <MessageSquare size={12} /> Eintrag hinzufügen
                        </button>
                      </div>
                      {disc.supplier_communication_log ? (
                        <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">
                          {disc.supplier_communication_log}
                        </pre>
                      ) : (
                        <p className="text-xs text-gray-400 italic">Noch keine Kommunikation protokolliert</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Log Modal */}
      <Modal isOpen={!!logModal} onClose={() => setLogModal(null)} title="Kommunikationseintrag hinzufügen">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Eingetragen von</label>
            <select
              value={logUser}
              onChange={e => setLogUser(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Name wählen —</option>
              {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nachricht / Protokolleintrag</label>
            <textarea
              rows={4}
              value={logEntry}
              onChange={e => setLogEntry(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="z.B. E-Mail an Lieferanten verschickt bezüglich Rücksendung..."
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setLogModal(null)} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
              Abbrechen
            </button>
            <button
              onClick={handleAddLog}
              disabled={!logEntry.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Eintrag speichern
            </button>
          </div>
        </div>
      </Modal>

      {/* Mängelrüge Modal */}
      <Modal
        isOpen={!!complaintModal}
        onClose={() => { if (!complaintSending) setComplaintModal(null); }}
        title="Mängelrüge verschicken"
      >
        {complaintSuccess ? (
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-900">Mängelrüge wurde verschickt</p>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5 justify-center">
                <Bell size={13} className="text-blue-500" /> Lieferant wurde informiert
              </p>
            </div>
            <button
              onClick={() => setComplaintModal(null)}
              className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
              Schließen
            </button>
          </div>
        ) : complaintModal && (
          <div className="space-y-4">
            {/* Vorausgefüllte Infos */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg text-sm">
              <div>
                <p className="text-xs text-gray-500">Lieferant</p>
                <p className="font-medium text-gray-900">{complaintModal.supplier_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Lieferschein</p>
                <p className="font-medium text-gray-900">{complaintModal.delivery_note_number || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Art der Abweichung</p>
                <p className="font-medium text-gray-900">{DISCREPANCY_TYPE_LABELS[complaintModal.type]}</p>
              </div>
              {complaintModal.purchase_order_number && (
                <div>
                  <p className="text-xs text-gray-500">Bestellnummer</p>
                  <p className="font-medium text-gray-900">{complaintModal.purchase_order_number}</p>
                </div>
              )}
            </div>

            {/* Mangelbeschreibung */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mangelbeschreibung</label>
              <textarea
                rows={3}
                value={complaintForm.beschreibung}
                onChange={e => setComplaintForm(p => ({ ...p, beschreibung: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Forderung */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Forderung</label>
              <select
                value={complaintForm.forderung}
                onChange={e => setComplaintForm(p => ({ ...p, forderung: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {DEMAND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Bearbeiter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Verschickt von *</label>
              <select
                value={complaintForm.bearbeiter}
                onChange={e => setComplaintForm(p => ({ ...p, bearbeiter: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">— Mitarbeiter wählen —</option>
                {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
              </select>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setComplaintModal(null)}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSendComplaint}
                disabled={complaintSending || !complaintForm.bearbeiter || !complaintForm.beschreibung.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {complaintSending
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Wird verschickt…</>
                  : <><Send size={14} /> Mängelrüge verschicken</>
                }
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
