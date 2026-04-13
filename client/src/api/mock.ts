/**
 * Mock data layer for the frontend prototype.
 * Replaces real API calls with in-memory static data.
 */
import {
  Delivery, Package, InventoryItem, Discrepancy, Supplier, Employee,
  StockLocation, DashboardStats, ChecklistData,
} from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────
const uid = (prefix = '') => `${prefix}${Math.random().toString(36).slice(2, 10)}`;
const delay = (ms = 200) => new Promise(r => setTimeout(r, ms));

function iso(daysAgo = 0, hoursAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hoursAgo);
  return d.toISOString();
}
function isoDate(daysFromNow = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

// ── Seed Data ────────────────────────────────────────────────────────────────
export const SUPPLIERS: Supplier[] = [
  { id: 's1', name: 'Dell Technologies GmbH', contact_email: 'orders@dell.de', contact_phone: '+49 69 9792-0', address: 'Main Airport Center, 60549 Frankfurt', created_at: iso(30) },
  { id: 's2', name: 'Lenovo GmbH', contact_email: 'b2b@lenovo.de', contact_phone: '+49 800 1000-702', address: 'Landshuter Allee 8-10, 80637 München', created_at: iso(30) },
  { id: 's3', name: 'HP Deutschland GmbH', contact_email: 'hpde.supplies@hp.com', contact_phone: '+49 800 000-0757', address: 'Schickardstraße 32, 71034 Böblingen', created_at: iso(30) },
  { id: 's4', name: 'Cisco Systems GmbH', contact_email: 'cisco-de@cisco.com', contact_phone: '+49 800 1873-255', address: 'Am Söldnermoos 17, 85399 Hallbergmoos', created_at: iso(30) },
  { id: 's5', name: 'Microsoft Deutschland GmbH', contact_email: 'orders@microsoft.de', contact_phone: '+49 89 3176-0', address: 'Walter-Gropius-Straße 5, 80807 München', created_at: iso(30) },
];

export const EMPLOYEES: Employee[] = [
  { id: 'e1', name: 'Max Mustermann', email: 'max.mustermann@it-service.de', role: 'Wareneingang', created_at: iso(60) },
  { id: 'e2', name: 'Anna Schmidt',   email: 'anna.schmidt@it-service.de',   role: 'Warenprüfung', created_at: iso(60) },
  { id: 'e3', name: 'Thomas Müller',  email: 'thomas.mueller@it-service.de', role: 'Warenprüfung', created_at: iso(60) },
  { id: 'e4', name: 'Sandra Weber',   email: 'sandra.weber@it-service.de',   role: 'Wareneingang', created_at: iso(60) },
  { id: 'e5', name: 'Klaus Berger',   email: 'klaus.berger@it-service.de',   role: 'Beobachter',   created_at: iso(60) },
];

export const LOCATIONS: StockLocation[] = [
  { id: 'l1', name: 'Lager A-01', description: 'Hauptlager – Regal A, Fach 1', created_at: iso(60) },
  { id: 'l2', name: 'Lager A-02', description: 'Hauptlager – Regal A, Fach 2', created_at: iso(60) },
  { id: 'l3', name: 'Lager B-01', description: 'Nebenlager – Regal B, Fach 1', created_at: iso(60) },
  { id: 'l4', name: 'IT-Raum 101', description: 'Direkter Einsatz im IT-Raum', created_at: iso(60) },
  { id: 'l5', name: 'Quarantäne', description: 'Beschädigte / zu prüfende Ware', created_at: iso(60) },
];

const okChecklist: ChecklistData = {
  packaging_intact: true, contents_match: true, serial_numbers_captured: true,
  quantity_correct: true, hardware_undamaged: true, accessories_complete: true, seals_intact: true,
};

const PACKAGES_D1: Package[] = [
  { id: 'p1a', delivery_id: 'd1', package_number: 1, status: 'ok', checklist_json: okChecklist, serial_numbers: ['SN-DELL-001', 'SN-DELL-002'], photos: [], notes: 'Einwandfreier Zustand', inspected_by: 'Anna Schmidt', inspected_at: iso(0, 3), created_at: iso(0, 5) },
  { id: 'p1b', delivery_id: 'd1', package_number: 2, status: 'ok', checklist_json: okChecklist, serial_numbers: ['SN-DELL-003'], photos: [], inspected_by: 'Anna Schmidt', inspected_at: iso(0, 3), created_at: iso(0, 5) },
  { id: 'p1c', delivery_id: 'd1', package_number: 3, status: 'damaged', checklist_json: { ...okChecklist, packaging_intact: false, hardware_undamaged: false }, serial_numbers: ['SN-DELL-004'], photos: [], notes: 'Außenkarton stark eingedrückt, Display-Ecke gebrochen', inspected_by: 'Anna Schmidt', inspected_at: iso(0, 3), created_at: iso(0, 5) },
];

const PACKAGES_D2: Package[] = [
  { id: 'p2a', delivery_id: 'd2', package_number: 1, status: 'pending', checklist_json: {}, serial_numbers: [], photos: [], created_at: iso(0, 1) },
  { id: 'p2b', delivery_id: 'd2', package_number: 2, status: 'pending', checklist_json: {}, serial_numbers: [], photos: [], created_at: iso(0, 1) },
];

const PACKAGES_D3: Package[] = [
  { id: 'p3a', delivery_id: 'd3', package_number: 1, status: 'ok', checklist_json: okChecklist, serial_numbers: ['SN-LEN-101', 'SN-LEN-102', 'SN-LEN-103', 'SN-LEN-104', 'SN-LEN-105'], photos: [], inspected_by: 'Thomas Müller', inspected_at: iso(1, 2), created_at: iso(1, 5) },
  { id: 'p3b', delivery_id: 'd3', package_number: 2, status: 'ok', checklist_json: okChecklist, serial_numbers: ['SN-LEN-106', 'SN-LEN-107', 'SN-LEN-108', 'SN-LEN-109', 'SN-LEN-110'], photos: [], inspected_by: 'Thomas Müller', inspected_at: iso(1, 2), created_at: iso(1, 5) },
];

const INVENTORY_D3: InventoryItem[] = [
  { id: 'i3a', package_id: 'p3a', delivery_id: 'd3', article_number: 'LEN-TP-X1C', description: 'Lenovo ThinkPad X1 Carbon Gen 11', quantity: 5, serial_number: 'SN-LEN-101', location: 'Lager A-01', project: 'Projekt-Alpha', cost_center: 'KST-2024', booked_at: iso(1, 1), booked_by: 'Max Mustermann', created_at: iso(1, 1) },
  { id: 'i3b', package_id: 'p3b', delivery_id: 'd3', article_number: 'LEN-TP-X1C', description: 'Lenovo ThinkPad X1 Carbon Gen 11', quantity: 5, serial_number: 'SN-LEN-106', location: 'Lager A-01', project: 'Projekt-Alpha', cost_center: 'KST-2024', booked_at: iso(1, 1), booked_by: 'Max Mustermann', created_at: iso(1, 1) },
];

const DISCREPANCY_D1: Discrepancy = {
  id: 'disc1', delivery_id: 'd1', package_id: 'p1c', type: 'damage',
  description: 'Laptop Dell XPS 15 (Paket 3) mit gebrochenem Display-Rahmen angeliefert. Außenkarton stark beschädigt. Rücksendung an Lieferant erforderlich.',
  status: 'open', assigned_to: 'Max Mustermann', created_at: iso(0, 2),
  supplier_name: 'Dell Technologies GmbH', delivery_note_number: 'LS-DELL-20240410',
  supplier_communication_log: `[${new Date(Date.now() - 7200000).toLocaleString('de-DE')}] Anna Schmidt:\nBeschädigung bei Paket 3 festgestellt. Fotos gemacht und dokumentiert. Lieferant muss kontaktiert werden.`,
};

const DISCREPANCY_D4: Discrepancy = {
  id: 'disc2', delivery_id: 'd4', package_id: undefined, type: 'quantity',
  description: 'Laut Lieferschein 10 Stück bestellt, nur 8 Stück geliefert. Differenz: 2 Stück Cisco Catalyst 9200L Switch.',
  status: 'in_progress', assigned_to: 'Sandra Weber', created_at: iso(3),
  supplier_name: 'Cisco Systems GmbH', delivery_note_number: 'LS-CISCO-20240407',
  supplier_communication_log: `[${new Date(Date.now() - 172800000).toLocaleString('de-DE')}] Sandra Weber:\nE-Mail an Cisco Vertrieb geschickt. Referenz: DIFF-2024-03.\n\n[${new Date(Date.now() - 86400000).toLocaleString('de-DE')}] Sandra Weber:\nRückmeldung von Cisco: Nachlieferung der 2 fehlenden Geräte in KW16 zugesagt.`,
};

export const DELIVERIES: Delivery[] = [
  {
    id: 'd7', status: 'expected', supplier_id: 's3', supplier_name: 'HP Deutschland GmbH',
    purchase_order_number: 'PO-2024-0046', delivery_note_number: '',
    carrier: 'DHL Express', number_of_packages: 6,
    expected_date: isoDate(0), created_at: iso(1), updated_at: iso(1),
    assigned_to: 'Thomas Müller', created_by: 'Sandra Weber',
    notes: 'ProLiant DL380 Gen10 Server (3×) + Rails + redundante Netzteile für Rechenzentrum',
    packages: [], inventory: [], discrepancies: [],
  },
  {
    id: 'd8', status: 'returned', supplier_id: 's1', supplier_name: 'Dell Technologies GmbH',
    purchase_order_number: 'PO-2024-0042', delivery_note_number: 'RET-DELL-20240410',
    carrier: 'DHL Express', number_of_packages: 1,
    actual_arrival_date: iso(0, 4), created_at: iso(0, 4), updated_at: iso(0, 4),
    assigned_to: 'Max Mustermann', created_by: 'Anna Schmidt',
    notes: 'Retoure: Dell XPS 15 (Paket 3) — Displayrahmen gebrochen. RMA-Nr. DELL-RMA-2024-1847.',
    packages: [], inventory: [], discrepancies: [],
  },
  {
    id: 'd1', status: 'flagged', supplier_id: 's1', supplier_name: 'Dell Technologies GmbH',
    purchase_order_number: 'PO-2024-0042', delivery_note_number: 'LS-DELL-20240410',
    carrier: 'DHL Express', number_of_packages: 3,
    actual_arrival_date: iso(0, 5), created_at: iso(1), updated_at: iso(0, 2),
    assigned_to: 'Anna Schmidt', created_by: 'Sandra Weber',
    notes: 'Dringende Lieferung für Onboarding-Projekt',
    packages: PACKAGES_D1, inventory: [], discrepancies: [DISCREPANCY_D1],
  },
  {
    id: 'd2', status: 'arrived', supplier_id: 's3', supplier_name: 'HP Deutschland GmbH',
    purchase_order_number: 'PO-2024-0041', delivery_note_number: 'LS-HP-20240410',
    carrier: 'UPS', number_of_packages: 2,
    actual_arrival_date: iso(0, 1), created_at: iso(0), updated_at: iso(0, 1),
    assigned_to: 'Thomas Müller', created_by: 'Max Mustermann',
    packages: PACKAGES_D2, inventory: [], discrepancies: [],
  },
  {
    id: 'd3', status: 'completed', supplier_id: 's2', supplier_name: 'Lenovo GmbH',
    purchase_order_number: 'PO-2024-0039', delivery_note_number: 'LS-LEN-20240409',
    carrier: 'DPD', number_of_packages: 2,
    expected_date: isoDate(-2), actual_arrival_date: iso(1, 5), created_at: iso(2), updated_at: iso(1),
    assigned_to: 'Thomas Müller', created_by: 'Sandra Weber',
    packages: PACKAGES_D3, inventory: INVENTORY_D3, discrepancies: [],
  },
  {
    id: 'd4', status: 'flagged', supplier_id: 's4', supplier_name: 'Cisco Systems GmbH',
    purchase_order_number: 'PO-2024-0037', delivery_note_number: 'LS-CISCO-20240407',
    carrier: 'FedEx', number_of_packages: 1,
    actual_arrival_date: iso(3), created_at: iso(4), updated_at: iso(3),
    assigned_to: 'Sandra Weber', created_by: 'Max Mustermann',
    notes: 'Netzwerk-Infrastruktur Neubau Standort Hamburg',
    packages: [], inventory: [], discrepancies: [DISCREPANCY_D4],
  },
  {
    id: 'd5', status: 'expected', supplier_id: 's5', supplier_name: 'Microsoft Deutschland GmbH',
    purchase_order_number: 'PO-2024-0044', delivery_note_number: '',
    carrier: '', number_of_packages: 5,
    expected_date: isoDate(2), created_at: iso(0), updated_at: iso(0),
    assigned_to: 'Max Mustermann', created_by: 'Sandra Weber',
    notes: 'Surface Pro 10 + Docks für Management-Team',
    packages: [], inventory: [], discrepancies: [],
  },
  {
    id: 'd6', status: 'in_inspection', supplier_id: 's1', supplier_name: 'Dell Technologies GmbH',
    purchase_order_number: 'PO-2024-0043', delivery_note_number: 'LS-DELL-20240409',
    carrier: 'DHL', number_of_packages: 4,
    actual_arrival_date: iso(0, 8), created_at: iso(1), updated_at: iso(0, 6),
    assigned_to: 'Anna Schmidt', created_by: 'Anna Schmidt',
    packages: [
      { id: 'p6a', delivery_id: 'd6', package_number: 1, status: 'ok', checklist_json: okChecklist, serial_numbers: ['SN-D6-001'], photos: [], inspected_by: 'Anna Schmidt', inspected_at: iso(0, 7), created_at: iso(0, 8) },
      { id: 'p6b', delivery_id: 'd6', package_number: 2, status: 'ok', checklist_json: okChecklist, serial_numbers: ['SN-D6-002'], photos: [], inspected_by: 'Anna Schmidt', inspected_at: iso(0, 6), created_at: iso(0, 8) },
      { id: 'p6c', delivery_id: 'd6', package_number: 3, status: 'pending', checklist_json: {}, serial_numbers: [], photos: [], created_at: iso(0, 8) },
      { id: 'p6d', delivery_id: 'd6', package_number: 4, status: 'pending', checklist_json: {}, serial_numbers: [], photos: [], created_at: iso(0, 8) },
    ],
    inventory: [], discrepancies: [],
  },
];

export const ALL_DISCREPANCIES: Discrepancy[] = [DISCREPANCY_D1, DISCREPANCY_D4];

export const DASHBOARD_STATS: DashboardStats = {
  deliveries_today: 2,
  open_inspections: 2,
  flagged_items: 2,
  pending_returns: 0,
  open_discrepancies: 2,
  pipeline: { expected: 1, arrived: 1, in_inspection: 1, completed: 1, flagged: 2, returned: 0 },
  recent_activity: [
    { id: 'a1', entity_type: 'delivery', entity_id: 'd1', action: 'flagged', description: 'Lieferung wegen Abweichung eskaliert (Paket 3 beschädigt)', performed_by: 'Anna Schmidt', created_at: iso(0, 2) },
    { id: 'a2', entity_type: 'package', entity_id: 'p1c', action: 'inspection_complete', description: 'Inspektion Paket 3 abgeschlossen (damaged)', performed_by: 'Anna Schmidt', created_at: iso(0, 3) },
    { id: 'a3', entity_type: 'package', entity_id: 'p1b', action: 'inspection_complete', description: 'Inspektion Paket 2 abgeschlossen (ok)', performed_by: 'Anna Schmidt', created_at: iso(0, 3) },
    { id: 'a4', entity_type: 'delivery', entity_id: 'd2', action: 'status_arrived', description: 'Wareneingang erfasst — HP Deutschland GmbH', performed_by: 'Thomas Müller', created_at: iso(0, 1) },
    { id: 'a5', entity_type: 'inventory', entity_id: 'd3', action: 'booked', description: '10 Artikel eingebucht — Lenovo ThinkPad X1 Carbon', performed_by: 'Max Mustermann', created_at: iso(1, 1) },
    { id: 'a6', entity_type: 'delivery', entity_id: 'd3', action: 'completed', description: 'Lieferung erfolgreich eingebucht — Lenovo GmbH', performed_by: 'Max Mustermann', created_at: iso(1, 1) },
    { id: 'a7', entity_type: 'discrepancy', entity_id: 'disc2', action: 'updated', description: 'Abweichung aktualisiert — Cisco Mengendifferenz', performed_by: 'Sandra Weber', created_at: iso(2) },
    { id: 'a8', entity_type: 'delivery', entity_id: 'd5', action: 'created', description: 'Lieferung von Microsoft Deutschland GmbH angelegt', performed_by: 'Sandra Weber', created_at: iso(0) },
  ],
};

export const APP_SETTINGS: Record<string, string> = {
  company_name: 'IT Service GmbH',
  company_address: 'Musterstraße 1\n12345 Berlin',
};

// ── In-Memory Store (supports mutations) ─────────────────────────────────────
let deliveries = [...DELIVERIES];
let suppliers = [...SUPPLIERS];
let employees = [...EMPLOYEES];
let locations = [...LOCATIONS];
let discrepancies = [...ALL_DISCREPANCIES];

// ── Mock API Functions ────────────────────────────────────────────────────────
export const mockApi = {
  getDashboard: async () => { await delay(); return { ...DASHBOARD_STATS }; },

  getDeliveries: async (params?: Record<string, string>) => {
    await delay();
    let result = [...deliveries];
    if (params?.status) result = result.filter(d => d.status === params.status);
    if (params?.supplier) result = result.filter(d => d.supplier_name.toLowerCase().includes(params.supplier!.toLowerCase()));
    return result.map(d => ({
      ...d,
      packages_inspected: d.packages?.filter(p => p.status !== 'pending').length ?? 0,
      packages: undefined,
      inventory: undefined,
      discrepancies: undefined,
    }));
  },

  getDelivery: async (id: string) => {
    await delay();
    const d = deliveries.find(d => d.id === id);
    if (!d) throw new Error('Lieferung nicht gefunden');
    return { ...d };
  },

  createDelivery: async (data: Partial<Delivery>) => {
    await delay(400);
    const newDelivery: Delivery = {
      id: uid('d'),
      status: data.status || 'expected',
      supplier_name: data.supplier_name || '',
      supplier_id: data.supplier_id,
      purchase_order_number: data.purchase_order_number,
      delivery_note_number: data.delivery_note_number,
      carrier: data.carrier,
      number_of_packages: data.number_of_packages || 0,
      expected_date: data.expected_date,
      assigned_to: data.assigned_to,
      notes: data.notes,
      created_by: data.created_by,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      packages: [],
      inventory: [],
      discrepancies: [],
    };
    deliveries = [newDelivery, ...deliveries];
    return newDelivery;
  },

  updateDelivery: async (id: string, data: Partial<Delivery>) => {
    await delay(300);
    deliveries = deliveries.map(d => d.id === id ? { ...d, ...data, updated_at: new Date().toISOString() } : d);
    return deliveries.find(d => d.id === id)!;
  },

  updateDeliveryStatus: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    deliveries = deliveries.map(d => d.id === id ? { ...d, status: data.status as Delivery['status'], updated_at: new Date().toISOString(), ...(data.actual_arrival_date ? { actual_arrival_date: data.actual_arrival_date as string } : {}) } : d);
    return deliveries.find(d => d.id === id)!;
  },

  deleteDelivery: async (id: string) => {
    await delay(200);
    deliveries = deliveries.filter(d => d.id !== id);
    return { success: true };
  },

  getPackagesByDelivery: async (deliveryId: string) => {
    await delay();
    const d = deliveries.find(d => d.id === deliveryId);
    return d?.packages || [];
  },

  getPackage: async (id: string) => {
    await delay();
    for (const d of deliveries) {
      const p = d.packages?.find(p => p.id === id);
      if (p) return p;
    }
    throw new Error('Paket nicht gefunden');
  },

  updatePackage: async (id: string, data: Partial<Package & Record<string, unknown>>) => {
    await delay(200);
    deliveries = deliveries.map(d => ({
      ...d, packages: d.packages?.map(p => p.id === id ? { ...p, ...data } : p),
    }));
    for (const d of deliveries) { const p = d.packages?.find(p => p.id === id); if (p) return p; }
    throw new Error('Paket nicht gefunden');
  },

  completePackage: async (id: string, data: Record<string, unknown>) => {
    await delay(300);
    deliveries = deliveries.map(d => ({
      ...d, packages: d.packages?.map(p => p.id === id ? { ...p, status: data.status as Package['status'], inspected_by: data.inspected_by as string, inspected_at: new Date().toISOString() } : p),
    }));
    for (const d of deliveries) { const p = d.packages?.find(p => p.id === id); if (p) return p; }
    throw new Error('Paket nicht gefunden');
  },

  uploadPackagePhotos: async (_packageId: string, _files: File[]) => {
    await delay(500);
    return { photos: ['/uploads/demo-photo.jpg'] };
  },

  getInventory: async (params?: Record<string, string>) => {
    await delay();
    const items: InventoryItem[] = [];
    deliveries.forEach(d => (d.inventory || []).forEach(i => items.push(i)));
    if (params?.delivery_id) return items.filter(i => i.delivery_id === params.delivery_id);
    return items;
  },

  bookInventory: async (data: { items: Partial<InventoryItem>[]; delivery_id: string; booked_by?: string }) => {
    await delay(500);
    const now = new Date().toISOString();
    const booked = data.items.map(item => ({ ...item, id: uid('i'), delivery_id: data.delivery_id, booked_at: now, booked_by: data.booked_by } as InventoryItem));
    deliveries = deliveries.map(d => d.id === data.delivery_id ? { ...d, status: 'completed', inventory: [...(d.inventory || []), ...booked] } : d);
    return { booked: booked.length, items: booked };
  },

  getDiscrepancies: async (params?: Record<string, string>) => {
    await delay();
    let result = [...discrepancies];
    if (params?.status) result = result.filter(d => d.status === params.status);
    if (params?.delivery_id) result = result.filter(d => d.delivery_id === params.delivery_id);
    return result;
  },

  getDiscrepancy: async (id: string) => {
    await delay();
    const d = discrepancies.find(d => d.id === id);
    if (!d) throw new Error('Abweichung nicht gefunden');
    return d;
  },

  createDiscrepancy: async (data: Partial<Discrepancy>) => {
    await delay(300);
    const newDisc: Discrepancy = { id: uid('disc'), status: 'open', created_at: new Date().toISOString(), ...data } as Discrepancy;
    discrepancies = [newDisc, ...discrepancies];
    deliveries = deliveries.map(d => d.id === data.delivery_id ? { ...d, status: 'flagged', discrepancies: [...(d.discrepancies || []), newDisc] } : d);
    return newDisc;
  },

  updateDiscrepancy: async (id: string, data: Partial<Discrepancy & Record<string, unknown>>) => {
    await delay(200);
    discrepancies = discrepancies.map(d => d.id === id ? { ...d, ...data } : d);
    return discrepancies.find(d => d.id === id)!;
  },

  appendDiscrepancyLog: async (id: string, entry: string, performedBy?: string) => {
    await delay(200);
    const timestamp = new Date().toLocaleString('de-DE');
    discrepancies = discrepancies.map(d => {
      if (d.id !== id) return d;
      const existing = d.supplier_communication_log || '';
      const newLog = existing ? `${existing}\n\n[${timestamp}] ${performedBy || 'System'}:\n${entry}` : `[${timestamp}] ${performedBy || 'System'}:\n${entry}`;
      return { ...d, supplier_communication_log: newLog };
    });
    return { supplier_communication_log: discrepancies.find(d => d.id === id)!.supplier_communication_log || '' };
  },

  getSuppliers:    async () => { await delay(); return [...suppliers]; },
  createSupplier:  async (data: Partial<Supplier>) => { await delay(300); const n = { ...data, id: uid('s'), created_at: new Date().toISOString() } as Supplier; suppliers = [...suppliers, n]; return n; },
  updateSupplier:  async (id: string, data: Partial<Supplier>) => { await delay(200); suppliers = suppliers.map(s => s.id === id ? { ...s, ...data } : s); return suppliers.find(s => s.id === id)!; },
  deleteSupplier:  async (id: string) => { await delay(200); suppliers = suppliers.filter(s => s.id !== id); return { success: true }; },

  loginByName: async (firstName: string, lastName: string) => {
    await delay(300);
    const fullName = `${firstName} ${lastName}`.toLowerCase();
    return employees.find(e => e.name.toLowerCase() === fullName) ?? null;
  },

  getEmployees:    async () => { await delay(); return [...employees]; },
  createEmployee:  async (data: Partial<Employee>) => { await delay(300); const n = { ...data, id: uid('e'), created_at: new Date().toISOString() } as Employee; employees = [...employees, n]; return n; },
  updateEmployee:  async (id: string, data: Partial<Employee>) => { await delay(200); employees = employees.map(e => e.id === id ? { ...e, ...data } : e); return employees.find(e => e.id === id)!; },
  deleteEmployee:  async (id: string) => { await delay(200); employees = employees.filter(e => e.id !== id); return { success: true }; },

  getLocations:    async () => { await delay(); return [...locations]; },
  createLocation:  async (data: Partial<StockLocation>) => { await delay(300); const n = { ...data, id: uid('l'), created_at: new Date().toISOString() } as StockLocation; locations = [...locations, n]; return n; },
  updateLocation:  async (id: string, data: Partial<StockLocation>) => { await delay(200); locations = locations.map(l => l.id === id ? { ...l, ...data } : l); return locations.find(l => l.id === id)!; },
  deleteLocation:  async (id: string) => { await delay(200); locations = locations.filter(l => l.id !== id); return { success: true }; },

  getAppSettings:    async () => { await delay(100); return { ...APP_SETTINGS }; },
  updateAppSettings: async (data: Record<string, string>) => { await delay(200); Object.assign(APP_SETTINGS, data); return { success: true }; },
};
