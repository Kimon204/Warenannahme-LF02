import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Users, MapPin, Truck, Building2, Plus, Edit2, Trash2, Save, X, Check } from 'lucide-react';
import { Supplier, Employee, StockLocation } from '../types';
import {
  getSuppliers, createSupplier, updateSupplier, deleteSupplier,
  getEmployees, createEmployee, updateEmployee, deleteEmployee,
  getLocations, createLocation, updateLocation, deleteLocation,
  getAppSettings, updateAppSettings,
} from '../api/client';
import Modal from '../components/ui/Modal';

type Tab = 'company' | 'suppliers' | 'employees' | 'locations';

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'company',   label: 'Firma',        icon: <Building2 size={16} /> },
  { key: 'suppliers', label: 'Lieferanten',  icon: <Truck size={16} /> },
  { key: 'employees', label: 'Mitarbeiter',  icon: <Users size={16} /> },
  { key: 'locations', label: 'Lagerorte',    icon: <MapPin size={16} /> },
];

function useEntityCrud<T extends { id: string }>(
  fetchFn: () => Promise<T[]>,
  createFn: (d: Partial<T>) => Promise<T>,
  updateFn: (id: string, d: Partial<T>) => Promise<T>,
  deleteFn: (id: string) => Promise<unknown>
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; item?: T } | null>(null);
  const [form, setForm] = useState<Partial<T>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setItems(await fetchFn()); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm({}); setModal({ mode: 'create' }); };
  const openEdit = (item: T) => { setForm(item); setModal({ mode: 'edit', item }); };
  const closeModal = () => setModal(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (modal?.mode === 'create') await createFn(form);
      else if (modal?.item) await updateFn(modal.item.id, form);
      await load();
      closeModal();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Eintrag wirklich löschen?')) return;
    await deleteFn(id);
    await load();
  };

  return { items, loading, modal, form, setForm, saving, openCreate, openEdit, closeModal, handleSave, handleDelete };
}

// ── Suppliers Tab ────────────────────────────────────────────────────────────
function SuppliersTab() {
  const { items, loading, modal, form, setForm, saving, openCreate, openEdit, closeModal, handleSave, handleDelete } =
    useEntityCrud<Supplier>(getSuppliers, createSupplier, updateSupplier, deleteSupplier);

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  const lbl = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <>
      <div className="flex justify-between mb-4">
        <p className="text-sm text-gray-500">{items.length} Lieferanten</p>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus size={14} /> Hinzufügen
        </button>
      </div>
      {loading ? <div className="text-sm text-gray-400">Lade...</div> : (
        <div className="space-y-2">
          {items.map(s => (
            <div key={s.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">{s.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{[s.contact_email, s.contact_phone].filter(Boolean).join(' · ')}</p>
                {s.address && <p className="text-xs text-gray-400">{s.address}</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Keine Lieferanten vorhanden</p>}
        </div>
      )}
      <Modal isOpen={!!modal} onClose={closeModal} title={modal?.mode === 'create' ? 'Lieferant hinzufügen' : 'Lieferant bearbeiten'}>
        <div className="space-y-3">
          <div><label className={lbl}>Name *</label><input className={inp} value={(form as Supplier).name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div><label className={lbl}>E-Mail</label><input className={inp} value={(form as Supplier).contact_email || ''} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))} /></div>
          <div><label className={lbl}>Telefon</label><input className={inp} value={(form as Supplier).contact_phone || ''} onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))} /></div>
          <div><label className={lbl}>Adresse</label><textarea className={inp} rows={2} value={(form as Supplier).address || ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
          <div className="flex gap-3 pt-2">
            <button onClick={closeModal} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Abbrechen</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ── Employees Tab ────────────────────────────────────────────────────────────
function EmployeesTab() {
  const { items, loading, modal, form, setForm, saving, openCreate, openEdit, closeModal, handleSave, handleDelete } =
    useEntityCrud<Employee>(getEmployees, createEmployee, updateEmployee, deleteEmployee);

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  const lbl = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <>
      <div className="flex justify-between mb-4">
        <p className="text-sm text-gray-500">{items.length} Mitarbeiter</p>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus size={14} /> Hinzufügen
        </button>
      </div>
      {loading ? <div className="text-sm text-gray-400">Lade...</div> : (
        <div className="space-y-2">
          {items.map(e => (
            <div key={e.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                  {e.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{e.name}</p>
                  <p className="text-xs text-gray-500">{e.role} {e.email ? `· ${e.email}` : ''}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(e)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(e.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Keine Mitarbeiter vorhanden</p>}
        </div>
      )}
      <Modal isOpen={!!modal} onClose={closeModal} title={modal?.mode === 'create' ? 'Mitarbeiter hinzufügen' : 'Mitarbeiter bearbeiten'}>
        <div className="space-y-3">
          <div><label className={lbl}>Name *</label><input className={inp} value={(form as Employee).name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div><label className={lbl}>Rolle</label>
            <select className={inp} value={(form as Employee).role || ''} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
              <option value="">— wählen —</option>
              {['Admin', 'Beobachter', 'Wareneingang', 'Warenprüfung'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div><label className={lbl}>E-Mail</label><input className={inp} type="email" value={(form as Employee).email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
          <div className="flex gap-3 pt-2">
            <button onClick={closeModal} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Abbrechen</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ── Locations Tab ────────────────────────────────────────────────────────────
function LocationsTab() {
  const { items, loading, modal, form, setForm, saving, openCreate, openEdit, closeModal, handleSave, handleDelete } =
    useEntityCrud<StockLocation>(getLocations, createLocation, updateLocation, deleteLocation);

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  const lbl = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <>
      <div className="flex justify-between mb-4">
        <p className="text-sm text-gray-500">{items.length} Lagerorte</p>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus size={14} /> Hinzufügen
        </button>
      </div>
      {loading ? <div className="text-sm text-gray-400">Lade...</div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map(l => (
            <div key={l.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                  <MapPin size={14} className="text-gray-500" />
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">{l.name}</p>
                  {l.description && <p className="text-xs text-gray-500">{l.description}</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(l)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>
                <button onClick={() => handleDelete(l.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-gray-400 text-center py-6 col-span-2">Keine Lagerorte vorhanden</p>}
        </div>
      )}
      <Modal isOpen={!!modal} onClose={closeModal} title={modal?.mode === 'create' ? 'Lagerort hinzufügen' : 'Lagerort bearbeiten'}>
        <div className="space-y-3">
          <div><label className={lbl}>Name *</label><input className={inp} value={(form as StockLocation).name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="z.B. Lager A-01" /></div>
          <div><label className={lbl}>Beschreibung</label><input className={inp} value={(form as StockLocation).description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="z.B. Hauptlager, Regal A, Fach 1" /></div>
          <div className="flex gap-3 pt-2">
            <button onClick={closeModal} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Abbrechen</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ── Company Tab ──────────────────────────────────────────────────────────────
function CompanyTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getAppSettings().then(setSettings).catch(() => {});
  }, []);

  const handleSave = async () => {
    await updateAppSettings(settings).catch(() => {});
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  const lbl = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <div className="space-y-4 max-w-lg">
      <div><label className={lbl}>Firmenname</label><input className={inp} value={settings.company_name || ''} onChange={e => setSettings(p => ({ ...p, company_name: e.target.value }))} /></div>
      <div><label className={lbl}>Anschrift</label><textarea className={inp} rows={3} value={settings.company_address || ''} onChange={e => setSettings(p => ({ ...p, company_address: e.target.value }))} /></div>
      <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
        {saved ? <><Check size={15} /> Gespeichert</> : <><Save size={15} /> Einstellungen speichern</>}
      </button>
    </div>
  );
}

// ── Main Settings Page ───────────────────────────────────────────────────────
export default function Settings() {
  const [tab, setTab] = useState<Tab>('company');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
          <SettingsIcon size={18} className="text-gray-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Einstellungen</h1>
          <p className="text-sm text-gray-500">Stammdaten und Systemkonfiguration</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <nav className="w-48 shrink-0">
          <ul className="space-y-1">
            {TABS.map(t => (
              <li key={t.key}>
                <button
                  onClick={() => setTab(t.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                    tab === t.key ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Content */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-5 pb-4 border-b border-gray-100">
            {TABS.find(t => t.key === tab)?.label}
          </h2>
          {tab === 'company'   && <CompanyTab />}
          {tab === 'suppliers' && <SuppliersTab />}
          {tab === 'employees' && <EmployeesTab />}
          {tab === 'locations' && <LocationsTab />}
        </div>
      </div>
    </div>
  );
}
