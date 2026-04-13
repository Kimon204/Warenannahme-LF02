import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { createDelivery, getSuppliers, getEmployees } from '../api/client';
import type { Supplier, Employee } from '../types';

export default function NewDelivery() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    supplier_id: '',
    purchase_order_number: '',
    delivery_note_number: '',
    carrier: '',
    number_of_packages: '',
    expected_date: '',
    assigned_to: '',
    notes: '',
  });

  useEffect(() => {
    Promise.all([getSuppliers(), getEmployees()]).then(([s, e]) => {
      setSuppliers(s);
      setEmployees(e);
    });
  }, []);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.supplier_id) { setError('Bitte einen Lieferanten auswählen.'); return; }
    if (!form.number_of_packages || Number(form.number_of_packages) < 1) {
      setError('Bitte eine gültige Paketanzahl eingeben.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const supplier = suppliers.find(s => s.id === form.supplier_id);
      const delivery = await createDelivery({
        supplier_id: form.supplier_id,
        supplier_name: supplier?.name ?? '',
        purchase_order_number: form.purchase_order_number || undefined,
        delivery_note_number: form.delivery_note_number || undefined,
        carrier: form.carrier || undefined,
        number_of_packages: Number(form.number_of_packages),
        expected_date: form.expected_date || undefined,
        assigned_to: form.assigned_to || undefined,
        notes: form.notes || undefined,
        status: 'expected',
      });
      navigate(`/deliveries/${delivery.id}`);
    } catch {
      setError('Fehler beim Speichern. Bitte erneut versuchen.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/deliveries')}
          className="p-2 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lieferung erfassen</h1>
          <p className="text-sm text-gray-500 mt-0.5">Neue Lieferung manuell anlegen</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

          {/* Lieferant */}
          <div className="px-5 py-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Lieferant <span className="text-red-500">*</span>
            </label>
            <select
              value={form.supplier_id}
              onChange={e => set('supplier_id', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              required
            >
              <option value="">— Lieferant auswählen —</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Bestellnr. + Lieferschein */}
          <div className="px-5 py-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bestellnummer</label>
              <input
                type="text"
                placeholder="PO-2024-0050"
                value={form.purchase_order_number}
                onChange={e => set('purchase_order_number', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Lieferscheinnummer</label>
              <input
                type="text"
                placeholder="LS-…"
                value={form.delivery_note_number}
                onChange={e => set('delivery_note_number', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Frachtführer + Pakete */}
          <div className="px-5 py-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Frachtführer</label>
              <input
                type="text"
                placeholder="DHL, UPS, FedEx…"
                value={form.carrier}
                onChange={e => set('carrier', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Anzahl Pakete <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                placeholder="1"
                value={form.number_of_packages}
                onChange={e => set('number_of_packages', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Erwartetes Datum + Zuständig */}
          <div className="px-5 py-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Erwartetes Datum</label>
              <input
                type="date"
                value={form.expected_date}
                onChange={e => set('expected_date', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Zuständig</label>
              <select
                value={form.assigned_to}
                onChange={e => set('assigned_to', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">— Mitarbeiter wählen —</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.name}>{emp.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notizen */}
          <div className="px-5 py-4">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notizen</label>
            <textarea
              rows={3}
              placeholder="Hinweise zur Lieferung…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/deliveries')}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            <Save size={15} />
            {saving ? 'Wird gespeichert…' : 'Lieferung anlegen'}
          </button>
        </div>
      </form>
    </div>
  );
}
