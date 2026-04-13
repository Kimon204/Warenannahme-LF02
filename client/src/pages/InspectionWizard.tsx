import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, AlertTriangle, Camera,
  Plus, X, Package as PackageIcon, ClipboardCheck, CheckCircle2
} from 'lucide-react';
import { getDelivery, updatePackage, completePackage, uploadPackagePhotos, createDiscrepancy, getEmployees } from '../api/client';
import { Delivery, Package, ChecklistData, CHECKLIST_ITEMS, Employee } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';

type Step = 'select' | 'checklist' | 'serials' | 'photos' | 'review';

const STEPS: { key: Step; label: string; icon: React.ReactNode }[] = [
  { key: 'select', label: 'Paket wählen', icon: <PackageIcon size={16} /> },
  { key: 'checklist', label: 'Checkliste', icon: <ClipboardCheck size={16} /> },
  { key: 'serials', label: 'Seriennummern', icon: <Plus size={16} /> },
  { key: 'photos', label: 'Fotos', icon: <Camera size={16} /> },
  { key: 'review', label: 'Abschluss', icon: <CheckCircle2 size={16} /> },
];

export default function InspectionWizard() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [step, setStep] = useState<Step>('select');
  const [checklist, setChecklist] = useState<ChecklistData>({});
  const [serials, setSerials] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');
  const [inspector, setInspector] = useState(user?.name || '');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [discrepancyModal, setDiscrepancyModal] = useState(false);
  const [discrepancyForm, setDiscrepancyForm] = useState({ type: 'damage', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    const [d, emps] = await Promise.all([getDelivery(id), getEmployees()]);
    setDelivery(d);
    setEmployees(emps);

    const pkgId = searchParams.get('pkg');
    if (pkgId && d.packages) {
      const pkg = d.packages.find(p => p.id === pkgId);
      if (pkg) {
        setSelectedPkg(pkg);
        setChecklist(pkg.checklist_json || {});
        setSerials(pkg.serial_numbers.length ? pkg.serial_numbers : ['']);
        setNotes(pkg.notes || '');
        setPhotoUrls(pkg.photos || []);
        setStep('checklist');
      }
    }
  }, [id, searchParams]);

  useEffect(() => { load(); }, [load]);

  const handleSelectPackage = (pkg: Package) => {
    setSelectedPkg(pkg);
    setChecklist(pkg.checklist_json || {});
    setSerials(pkg.serial_numbers.length ? pkg.serial_numbers : ['']);
    setNotes(pkg.notes || '');
    setPhotoUrls(pkg.photos || []);
    setStep('checklist');
  };

  const saveProgress = async () => {
    if (!selectedPkg) return;
    await updatePackage(selectedPkg.id, {
      checklist_json: checklist,
      serial_numbers: serials.filter(s => s.trim()),
      notes,
      inspected_by: inspector || undefined,
    });
  };

  const handleNext = async () => {
    await saveProgress();
    const idx = STEPS.findIndex(s => s.key === step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].key);
  };

  const handleBack = () => {
    const idx = STEPS.findIndex(s => s.key === step);
    if (idx > 0) setStep(STEPS[idx - 1].key);
  };

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || !selectedPkg) return;
    const newFiles = Array.from(files);
    setPhotos(prev => [...prev, ...newFiles]);
    try {
      const result = await uploadPackagePhotos(selectedPkg.id, newFiles, inspector);
      setPhotoUrls(result.photos);
    } catch (e) {
      setError('Fehler beim Hochladen der Fotos');
    }
  };

  const handleComplete = async (asDamaged = false) => {
    if (!selectedPkg || !inspector) {
      setError('Bitte Prüfer auswählen');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveProgress();
      await completePackage(selectedPkg.id, {
        inspected_by: inspector,
        status: asDamaged ? 'damaged' : 'ok',
      });
      await load();
      setStep('select');
      setSelectedPkg(null);
      setChecklist({});
      setSerials(['']);
      setNotes('');
      setPhotos([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Abschließen');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDiscrepancy = async () => {
    if (!id || !selectedPkg) return;
    try {
      await createDiscrepancy({
        delivery_id: id,
        package_id: selectedPkg.id,
        type: discrepancyForm.type as never,
        description: discrepancyForm.description,
        assigned_to: inspector,
      });
      await handleComplete(true);
      setDiscrepancyModal(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    }
  };

  const allChecked = CHECKLIST_ITEMS.every(item => checklist[item.key]);
  const completedPackages = (delivery?.packages || []).filter(p => p.status === 'ok' || p.status === 'damaged' || p.status === 'discrepancy').length;
  const totalPackages = delivery?.packages?.length ?? 0;

  const stepIdx = STEPS.findIndex(s => s.key === step);

  if (!delivery) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(`/deliveries/${id}`)} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">Paketprüfung — {delivery.supplier_name}</h1>
          <p className="text-sm text-gray-500">
            {completedPackages}/{totalPackages} Pakete geprüft
            {delivery.delivery_note_number && ` · LS: ${delivery.delivery_note_number}`}
          </p>
        </div>
        {totalPackages > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(completedPackages / totalPackages) * 100}%` }} />
            </div>
            <span>{Math.round((completedPackages / totalPackages) * 100)}%</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle size={15} /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Step indicator */}
      {step !== 'select' && (
        <div className="flex items-center gap-1 mb-6">
          {STEPS.filter(s => s.key !== 'select').map((s, i) => {
            const sIdx = STEPS.findIndex(st => st.key === s.key);
            const isPast = stepIdx > sIdx;
            const isCurrent = step === s.key;
            return (
              <div key={s.key} className="flex items-center gap-1 flex-1">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium flex-1 ${
                  isCurrent ? 'bg-blue-600 text-white' : isPast ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  {isPast ? <Check size={12} /> : s.icon}
                  <span className="hidden sm:block">{s.label}</span>
                </div>
                {i < 3 && <div className={`w-4 h-px ${isPast ? 'bg-green-300' : 'bg-gray-200'}`} />}
              </div>
            );
          })}
        </div>
      )}

      {/* STEP: Select Package */}
      {step === 'select' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Paket zur Prüfung auswählen</h2>
          {!delivery.packages?.length ? (
            <p className="text-sm text-gray-400">Keine Pakete für diese Lieferung erfasst</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {delivery.packages.map(pkg => {
                const isDone = pkg.status === 'ok' || pkg.status === 'damaged' || pkg.status === 'discrepancy';
                return (
                  <button
                    key={pkg.id}
                    onClick={() => !isDone && handleSelectPackage(pkg)}
                    disabled={isDone && pkg.status === 'ok'}
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 text-left transition-all ${
                      isDone && pkg.status === 'ok'
                        ? 'border-green-200 bg-green-50 opacity-60 cursor-not-allowed'
                        : isDone
                        ? 'border-red-200 bg-red-50 hover:border-red-400 cursor-pointer'
                        : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                      pkg.status === 'ok' ? 'bg-green-100 text-green-700' :
                      pkg.status === 'damaged' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {pkg.status === 'ok' ? <Check size={18} /> : pkg.package_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">Paket {pkg.package_number}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StatusBadge type="package" status={pkg.status} />
                        {pkg.inspected_by && <span className="text-xs text-gray-400">{pkg.inspected_by}</span>}
                      </div>
                    </div>
                    {!isDone && <ArrowRight size={16} className="text-gray-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
          {completedPackages === totalPackages && totalPackages > 0 && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-800 flex items-center gap-2">
                <CheckCircle2 size={16} /> Alle Pakete geprüft!
              </p>
              <button
                onClick={() => navigate(`/deliveries/${id}`)}
                className="mt-2 flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                Zurück zur Lieferung →
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP: Checklist */}
      {step === 'checklist' && selectedPkg && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Checkliste — Paket {selectedPkg.package_number}</h2>
            <span className="text-sm text-gray-500">{Object.values(checklist).filter(Boolean).length}/7 erledigt</span>
          </div>
          <div className="space-y-3">
            {CHECKLIST_ITEMS.map(item => (
              <label key={item.key} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                <div
                  className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition-colors ${
                    checklist[item.key] ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  }`}
                  onClick={() => setChecklist(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                >
                  {checklist[item.key] && <Check size={12} className="text-white" />}
                </div>
                <span className={`text-sm ${checklist[item.key] ? 'text-gray-700' : 'text-gray-600'}`}>{item.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notizen zum Paket</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optionale Bemerkungen..."
            />
          </div>
        </div>
      )}

      {/* STEP: Serial Numbers */}
      {step === 'serials' && selectedPkg && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Seriennummern — Paket {selectedPkg.package_number}</h2>
          <div className="space-y-2">
            {serials.map((sn, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={sn}
                  onChange={e => {
                    const next = [...serials];
                    next[i] = e.target.value;
                    setSerials(next);
                  }}
                  placeholder={`Seriennummer ${i + 1}`}
                  className="flex-1 px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {serials.length > 1 && (
                  <button
                    onClick={() => setSerials(serials.filter((_, j) => j !== i))}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setSerials([...serials, ''])}
            className="mt-3 flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            <Plus size={15} /> Seriennummer hinzufügen
          </button>
          <p className="mt-3 text-xs text-gray-400">Seriennummern werden auf Duplikate im Inventar geprüft beim Einbuchen.</p>
        </div>
      )}

      {/* STEP: Photos */}
      {step === 'photos' && selectedPkg && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Fotos — Paket {selectedPkg.package_number}</h2>
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
            <Camera size={24} className="text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">Fotos hochladen (max. 10 MB je Datei)</p>
            <p className="text-xs text-gray-400">JPG, PNG, WebP</p>
            <input type="file" multiple accept="image/*" className="sr-only" onChange={e => handlePhotoUpload(e.target.files)} />
          </label>
          {photoUrls.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {photoUrls.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP: Review */}
      {step === 'review' && selectedPkg && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Prüfung abschließen — Paket {selectedPkg.package_number}</h2>

            <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-900">{Object.values(checklist).filter(Boolean).length}/7</p>
                <p className="text-xs text-gray-500 mt-1">Punkte erfüllt</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-900">{serials.filter(s => s.trim()).length}</p>
                <p className="text-xs text-gray-500 mt-1">Seriennummern</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-900">{photoUrls.length}</p>
                <p className="text-xs text-gray-500 mt-1">Fotos</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Prüfer (Pflichtfeld) *</label>
              <select
                value={inspector}
                onChange={e => setInspector(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Prüfer auswählen —</option>
                {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
              </select>
            </div>

            {!allChecked && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 flex items-center gap-2 mb-4">
                <AlertTriangle size={15} /> Nicht alle Checklisten-Punkte wurden erfüllt
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setDiscrepancyModal(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
            >
              <AlertTriangle size={16} /> Als beschädigt melden
            </button>
            <button
              onClick={() => handleComplete(false)}
              disabled={!inspector || saving}
              className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              <Check size={16} /> {saving ? 'Wird gespeichert...' : 'Prüfung abschließen (OK)'}
            </button>
          </div>
        </div>
      )}

      {/* Navigation */}
      {step !== 'select' && step !== 'review' && (
        <div className="flex justify-between mt-6">
          <button onClick={handleBack} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            <ArrowLeft size={15} /> Zurück
          </button>
          <button onClick={handleNext} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            Weiter <ArrowRight size={15} />
          </button>
        </div>
      )}
      {step === 'review' && (
        <button onClick={handleBack} className="flex items-center gap-2 px-4 py-2 mt-4 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
          <ArrowLeft size={15} /> Zurück
        </button>
      )}

      {/* Discrepancy Modal */}
      <Modal isOpen={discrepancyModal} onClose={() => setDiscrepancyModal(false)} title="Abweichung melden">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Art der Abweichung</label>
            <select
              value={discrepancyForm.type}
              onChange={e => setDiscrepancyForm(p => ({ ...p, type: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="damage">Beschädigung</option>
              <option value="quantity">Mengendifferenz</option>
              <option value="wrong_item">Falscher Artikel</option>
              <option value="missing_accessory">Zubehör fehlt</option>
              <option value="other">Sonstiges</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung der Abweichung *</label>
            <textarea
              rows={3}
              value={discrepancyForm.description}
              onChange={e => setDiscrepancyForm(p => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Bitte Abweichung genau beschreiben..."
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setDiscrepancyModal(false)} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">
              Abbrechen
            </button>
            <button
              onClick={handleCreateDiscrepancy}
              disabled={!discrepancyForm.description || !inspector}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Abweichung eskalieren
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
