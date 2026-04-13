import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  ArrowLeft, ClipboardCheck, AlertTriangle,
  Download, Package, CheckCircle, XCircle, Clock, Edit3, Truck, Bell
} from 'lucide-react';
import { getDelivery, updateDeliveryStatus, updatePackage, createDiscrepancy, getEmployees } from '../api/client';
import { Delivery, Employee, DELIVERY_STATUS_LABELS, PACKAGE_STATUS_LABELS, DISCREPANCY_TYPE_LABELS, DISCREPANCY_STATUS_LABELS } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import { generatePDF } from '../utils/pdf';
import { useAuth } from '../context/AuthContext';

export default function DeliveryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isReceiver, isInspector, canWrite } = useAuth();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [inspectionDone, setInspectionDone] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [arrivalModal, setArrivalModal] = useState(false);
  const [arrivalStep, setArrivalStep] = useState<1 | 2>(1);
  const [arrivalSaving, setArrivalSaving] = useState(false);
  const [arrivalForm, setArrivalForm] = useState({
    delivery_note_number: '',
    carrier: '',
    number_of_packages: '',
    performed_by: '',
  });
  // Sichtprüfung je Paket: beschädigt? + Notiz
  const [pkgChecks, setPkgChecks] = useState<{ damaged: boolean; notes: string }[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    const [d, e] = await Promise.all([getDelivery(id), getEmployees()]);
    setDelivery(d);
    setEmployees(e);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function openArrivalModal() {
    setArrivalStep(1);
    setArrivalForm({
      delivery_note_number: delivery?.delivery_note_number || '',
      carrier: delivery?.carrier || '',
      number_of_packages: String(delivery?.number_of_packages || ''),
      performed_by: user?.name || '',
    });
    setPkgChecks([]);
    setArrivalModal(true);
  }

  function goToPackageCheck() {
    const count = parseInt(arrivalForm.number_of_packages) || delivery?.number_of_packages || 1;
    setPkgChecks(Array.from({ length: count }, () => ({ damaged: false, notes: '' })));
    setArrivalStep(2);
  }

  function toggleDamaged(i: number) {
    setPkgChecks(prev => prev.map((c, idx) => idx === i ? { ...c, damaged: !c.damaged, notes: c.damaged ? '' : c.notes } : c));
  }

  function setNotes(i: number, notes: string) {
    setPkgChecks(prev => prev.map((c, idx) => idx === i ? { ...c, notes } : c));
  }

  const handleMarkArrived = async () => {
    if (!id) return;
    setArrivalSaving(true);
    try {
      await updateDeliveryStatus(id, {
        status: 'arrived',
        ...arrivalForm,
        number_of_packages: arrivalForm.number_of_packages ? parseInt(arrivalForm.number_of_packages) : undefined,
        actual_arrival_date: new Date().toISOString(),
      });

      // Beschädigte Pakete direkt markieren
      const damagedChecks = pkgChecks.map((c, i) => ({ ...c, nr: i + 1 })).filter(c => c.damaged);
      if (damagedChecks.length > 0) {
        const updated = await getDelivery(id);
        for (const check of damagedChecks) {
          const pkg = updated.packages?.find(p => p.package_number === check.nr);
          if (pkg) {
            const noteTxt = check.notes
              ? `Außenverpackung beschädigt (Sichtprüfung Wareneingang): ${check.notes}`
              : 'Außenverpackung beschädigt (Sichtprüfung Wareneingang)';
            await updatePackage(pkg.id, {
              status: 'damaged',
              notes: noteTxt,
              inspected_by: arrivalForm.performed_by || undefined,
            });
            await createDiscrepancy({
              delivery_id: id,
              package_id: pkg.id,
              type: 'damage',
              description: `Paket ${check.nr}: ${noteTxt}`,
              assigned_to: arrivalForm.performed_by || undefined,
            });
          }
        }
      }

      setArrivalModal(false);
      load();
    } finally {
      setArrivalSaving(false);
    }
  };

  const handleCompleteInspection = async () => {
    if (!id) return;
    setCompleting(true);
    try {
      await updateDeliveryStatus(id, { status: 'completed', performed_by: '' });
      setInspectionDone(true);
      setTimeout(() => navigate('/deliveries'), 3000);
    } finally {
      setCompleting(false);
    }
  };

  const handleReturn = async () => {
    if (!id || !window.confirm('Retoure einleiten?')) return;
    await updateDeliveryStatus(id, { status: 'returned', performed_by: '' });
    load();
  };

  const handleDownloadPDF = () => {
    if (delivery) generatePDF(delivery);
  };

  if (inspectionDone) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle size={36} className="text-green-600" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Prüfung abgeschlossen</h2>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5 justify-center">
            <Bell size={14} className="text-blue-500" /> Logistik über Prüfung informiert
          </p>
        </div>
        <p className="text-xs text-gray-400">Weiterleitung…</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  }
  if (!delivery) return <div className="p-6 text-red-600">Lieferung nicht gefunden</div>;

  const isReadOnly = delivery.status === 'completed';
  const allPackagesDone = (delivery.packages || []).every(p => p.status === 'ok' || p.status === 'damaged' || p.status === 'discrepancy');
  const pendingPackages = (delivery.packages || []).filter(p => p.status === 'pending' || p.status === 'inspecting').length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/deliveries')} className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{delivery.supplier_name}</h1>
              <StatusBadge type="delivery" status={delivery.status} />
              {isReadOnly && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">Schreibgeschützt</span>}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              {delivery.delivery_note_number && <span>LS: {delivery.delivery_note_number}</span>}
              {delivery.purchase_order_number && <span>PO: {delivery.purchase_order_number}</span>}
              <span>Erfasst: {format(parseISO(delivery.created_at), 'dd.MM.yyyy HH:mm')}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 no-print">
          <button onClick={handleDownloadPDF} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
            <Download size={15} /> PDF
          </button>
          {/* Wareneingang: Ankunft bestätigen */}
          {canWrite && !isReadOnly && delivery.status === 'expected' && isReceiver && (
            <button onClick={openArrivalModal} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
              <Truck size={15} /> Neuer Wareneingang
            </button>
          )}
          {/* Warenprüfung: Prüfung starten / fortsetzen */}
          {canWrite && !isReadOnly && (delivery.status === 'arrived' || delivery.status === 'in_inspection') && isInspector && (
            <button onClick={() => navigate(`/deliveries/${id}/inspect`)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700">
              <ClipboardCheck size={15} /> Wareneingang prüfen
            </button>
          )}
          {/* Warenprüfung: Prüfung abschließen */}
          {canWrite && !isReadOnly && allPackagesDone && delivery.status === 'in_inspection' && isInspector && (
            <button onClick={handleCompleteInspection} disabled={completing} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
              <CheckCircle size={15} /> {completing ? 'Wird abgeschlossen…' : 'Prüfung abschließen'}
            </button>
          )}
          {/* Retoure: nur Warenprüfung (stellt Fehler bei Prüfung fest) */}
          {canWrite && !isReadOnly && isInspector && (
            <button onClick={handleReturn} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              Retoure
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Delivery Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Lieferungsdetails</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['Lieferant', delivery.supplier_name],
                ['Carrier / Spediteur', delivery.carrier || '—'],
                ['Lieferscheinnummer', delivery.delivery_note_number || '—'],
                ['Bestellnummer', delivery.purchase_order_number || '—'],
                ['Anzahl Pakete', String(delivery.number_of_packages)],
                ['Zuständig', delivery.assigned_to || '—'],
                ['Erw. Lieferdatum', delivery.expected_date ? format(parseISO(delivery.expected_date), 'dd.MM.yyyy') : '—'],
                ['Tatsächlicher Eingang', delivery.actual_arrival_date ? format(parseISO(delivery.actual_arrival_date), 'dd.MM.yyyy HH:mm') : '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-gray-500 text-xs">{label}</p>
                  <p className="font-medium text-gray-900 mt-0.5">{value}</p>
                </div>
              ))}
              {delivery.notes && (
                <div className="col-span-2">
                  <p className="text-gray-500 text-xs">Notizen</p>
                  <p className="font-medium text-gray-900 mt-0.5">{delivery.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Packages */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Package size={16} /> Pakete ({delivery.packages?.length ?? 0})
              </h2>
              {pendingPackages > 0 && (
                <span className="text-xs text-yellow-700 bg-yellow-100 px-2.5 py-1 rounded-full">
                  {pendingPackages} noch nicht geprüft
                </span>
              )}
            </div>
            {!delivery.packages?.length ? (
              <p className="text-sm text-gray-400">Keine Pakete erfasst</p>
            ) : (
              <div className="space-y-2">
                {delivery.packages.map(pkg => {
                  const checkedCount = Object.values(pkg.checklist_json || {}).filter(Boolean).length;
                  return (
                    <div key={pkg.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          pkg.status === 'ok' ? 'bg-green-100 text-green-700' :
                          pkg.status === 'damaged' ? 'bg-red-100 text-red-700' :
                          pkg.status === 'discrepancy' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-200 text-gray-600'
                        }`}>
                          {pkg.package_number}
                        </div>
                        <div>
                          <p className="text-sm font-medium">Paket {pkg.package_number}</p>
                          <p className="text-xs text-gray-500">
                            Checkliste: {checkedCount}/7 &bull; Seriennummern: {pkg.serial_numbers.length}
                            {pkg.inspected_by && ` &bull; Geprüft von: ${pkg.inspected_by}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge type="package" status={pkg.status} />
                        {canWrite && !isReadOnly && isInspector && (
                          <button
                            onClick={() => navigate(`/deliveries/${id}/inspect?pkg=${pkg.id}`)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit3 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Inventory */}
          {delivery.inventory && delivery.inventory.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle size={16} className="text-green-600" /> Eingebuchte Artikel ({delivery.inventory.length})
              </h2>
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500">
                  <tr>
                    <th className="text-left pb-2">Beschreibung</th>
                    <th className="text-left pb-2">Art.-Nr.</th>
                    <th className="text-left pb-2">Seriennummer</th>
                    <th className="text-left pb-2">Menge</th>
                    <th className="text-left pb-2">Lagerort</th>
                    <th className="text-left pb-2">Projekt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {delivery.inventory.map(item => (
                    <tr key={item.id}>
                      <td className="py-2 font-medium">{item.description}</td>
                      <td className="py-2 text-gray-600">{item.article_number || '—'}</td>
                      <td className="py-2 text-gray-600 font-mono text-xs">{item.serial_number || '—'}</td>
                      <td className="py-2 text-gray-600">{item.quantity}</td>
                      <td className="py-2 text-gray-600">{item.location || '—'}</td>
                      <td className="py-2 text-gray-600">{item.project || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Status Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Prozessstatus</h2>
            <div className="space-y-3">
              {(['expected', 'arrived', 'in_inspection', 'completed'] as const).map((s, i) => {
                const statusOrder = ['expected', 'arrived', 'in_inspection', 'completed', 'flagged', 'returned'];
                const currentIdx = statusOrder.indexOf(delivery.status);
                const stepIdx = statusOrder.indexOf(s);
                const isDone = currentIdx > stepIdx;
                const isCurrent = delivery.status === s;
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      isDone ? 'bg-green-500 text-white' :
                      isCurrent ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {isDone ? <CheckCircle size={14} /> : <span className="text-xs">{i + 1}</span>}
                    </div>
                    <span className={`text-sm ${isCurrent ? 'font-semibold text-gray-900' : isDone ? 'text-gray-500' : 'text-gray-400'}`}>
                      {DELIVERY_STATUS_LABELS[s]}
                    </span>
                  </div>
                );
              })}
              {delivery.status === 'flagged' && (
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center">
                    <XCircle size={14} />
                  </div>
                  <span className="text-sm font-semibold text-red-700">Eskaliert</span>
                </div>
              )}
              {delivery.status === 'returned' && (
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-gray-500 text-white flex items-center justify-center">
                    <Clock size={14} />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">Retoure</span>
                </div>
              )}
            </div>
          </div>

          {/* Discrepancies */}
          {delivery.discrepancies && delivery.discrepancies.length > 0 && (
            <div className="bg-white rounded-xl border border-red-200 p-5">
              <h2 className="font-semibold text-red-700 mb-4 flex items-center gap-2">
                <AlertTriangle size={16} /> Abweichungen ({delivery.discrepancies.length})
              </h2>
              <div className="space-y-2">
                {delivery.discrepancies.map(d => (
                  <div key={d.id} className="p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-red-800">{DISCREPANCY_TYPE_LABELS[d.type]}</span>
                      <StatusBadge type="discrepancy" status={d.status} />
                    </div>
                    <p className="text-xs text-gray-700">{d.description}</p>
                  </div>
                ))}
                <button
                  onClick={() => navigate(`/discrepancies?delivery_id=${id}`)}
                  className="w-full mt-2 text-xs text-red-600 hover:text-red-800"
                >
                  Alle Abweichungen verwalten →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Arrival Modal – 2 Schritte */}
      <Modal
        isOpen={arrivalModal}
        onClose={() => setArrivalModal(false)}
        title={arrivalStep === 1 ? 'Wareneingang buchen – Schritt 1 / 2' : 'Wareneingang buchen – Schritt 2 / 2'}
      >
        {arrivalStep === 1 ? (
          /* ── Schritt 1: Lieferscheindaten ─────────────────────────────── */
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Lieferscheindaten beim Eintreffen der Ware erfassen.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lieferscheinnummer</label>
                <input
                  type="text"
                  value={arrivalForm.delivery_note_number}
                  onChange={e => setArrivalForm(p => ({ ...p, delivery_note_number: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Spediteur</label>
                <input
                  type="text"
                  value={arrivalForm.carrier}
                  onChange={e => setArrivalForm(p => ({ ...p, carrier: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Anzahl Pakete</label>
              <input
                type="number"
                min="1"
                value={arrivalForm.number_of_packages}
                onChange={e => setArrivalForm(p => ({ ...p, number_of_packages: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Erfasst von</label>
              <select
                value={arrivalForm.performed_by}
                onChange={e => setArrivalForm(p => ({ ...p, performed_by: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— Mitarbeiter wählen —</option>
                {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setArrivalModal(false)} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                Abbrechen
              </button>
              <button
                onClick={goToPackageCheck}
                disabled={!arrivalForm.number_of_packages || parseInt(arrivalForm.number_of_packages) < 1}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                Weiter → Sichtprüfung
              </button>
            </div>
          </div>
        ) : (
          /* ── Schritt 2: Sichtprüfung Außenverpackung je Paket ──────────── */
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Bitte jedes Paket auf <strong>äußerliche Beschädigungen</strong> prüfen (Karton eingedrückt, Nässe, Risse etc.) und beschädigte Pakete markieren.
              </p>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {pkgChecks.map((check, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 transition-colors ${
                    check.damaged ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        check.damaged ? 'bg-red-100 text-red-700' : 'bg-white text-gray-600 border border-gray-300'
                      }`}>
                        {i + 1}
                      </div>
                      <span className="text-sm font-medium text-gray-800">Paket {i + 1}</span>
                    </div>
                    <button
                      onClick={() => toggleDamaged(i)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        check.damaged
                          ? 'bg-red-100 text-red-700 border-red-300 hover:bg-red-200'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {check.damaged ? (
                        <><XCircle size={13} /> Beschädigt</>
                      ) : (
                        <><CheckCircle size={13} /> In Ordnung</>
                      )}
                    </button>
                  </div>
                  {check.damaged && (
                    <input
                      type="text"
                      placeholder="Kurze Beschreibung der Beschädigung…"
                      value={check.notes}
                      onChange={e => setNotes(i, e.target.value)}
                      className="mt-2 w-full px-3 py-1.5 text-sm border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                      autoFocus
                    />
                  )}
                </div>
              ))}
            </div>

            {pkgChecks.some(c => c.damaged) && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <AlertTriangle size={14} />
                {pkgChecks.filter(c => c.damaged).length} Paket(e) als beschädigt markiert – Abweichung wird automatisch angelegt.
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setArrivalStep(1)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
                ← Zurück
              </button>
              <button
                onClick={handleMarkArrived}
                disabled={arrivalSaving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
              >
                {arrivalSaving
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Wird gespeichert…</>
                  : <><Truck size={15} /> Wareneingang bestätigen</>
                }
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
