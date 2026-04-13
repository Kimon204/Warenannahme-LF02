/**
 * API client
 *  - VITE_USE_MOCK=true  → In-Memory Mock (Entwicklung ohne Backend)
 *  - VITE_USE_MOCK=false → Supabase direkt (Production / Staging)
 */
import { mockApi } from './mock';
import { supabase } from '../lib/supabase';
import type {
  Delivery, Package, InventoryItem, Discrepancy,
  Supplier, Employee, StockLocation, DashboardStats,
} from '../types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

// ── Helpers ───────────────────────────────────────────────────────────────────

function check<T>(result: { data: T | null; error: unknown }): T {
  if (result.error) throw result.error;
  return result.data!;
}

async function logActivity(
  entityType: string,
  entityId: string,
  action: string,
  description: string,
  performedBy?: string,
) {
  await supabase.from('activity_log').insert({
    entity_type: entityType,
    entity_id: entityId,
    action,
    description,
    performed_by: performedBy ?? null,
  });
}

// ── Supabase API ──────────────────────────────────────────────────────────────

const sbApi = {

  // ── Dashboard ──────────────────────────────────────────────────────────────
  getDashboard: async (): Promise<DashboardStats> => {
    const today = new Date().toISOString().slice(0, 10);

    const [delivToday, pipelineRes, openDiscRes, activityRes] = await Promise.all([
      supabase.from('deliveries')
        .select('id', { count: 'exact', head: true })
        .gte('actual_arrival_date', today),
      supabase.from('deliveries').select('status'),
      supabase.from('discrepancies')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open'),
      supabase.from('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const pipeline: Record<string, number> = {};
    (pipelineRes.data ?? []).forEach((d: { status: string }) => {
      pipeline[d.status] = (pipeline[d.status] ?? 0) + 1;
    });

    return {
      deliveries_today:    delivToday.count ?? 0,
      open_inspections:    pipeline['in_inspection'] ?? 0,
      flagged_items:       pipeline['flagged'] ?? 0,
      pending_returns:     pipeline['returned'] ?? 0,
      open_discrepancies:  openDiscRes.count ?? 0,
      pipeline,
      recent_activity: (activityRes.data ?? []).map((a: Record<string, unknown>) => ({
        id:           a.id as string,
        entity_type:  a.entity_type as string,
        entity_id:    a.entity_id as string,
        action:       a.action as string,
        description:  (a.description as string) ?? '',
        performed_by: a.performed_by as string | undefined,
        created_at:   a.created_at as string,
      })),
    };
  },

  // ── Deliveries ─────────────────────────────────────────────────────────────
  getDeliveries: async (params?: Record<string, string>): Promise<Delivery[]> => {
    let q = supabase.from('deliveries').select('*').order('created_at', { ascending: false });
    if (params?.status)   q = q.eq('status', params.status);
    if (params?.supplier) q = q.ilike('supplier_name', `%${params.supplier}%`);
    return check(await q) as Delivery[];
  },

  getDelivery: async (id: string): Promise<Delivery> => {
    const { data, error } = await supabase
      .from('deliveries')
      .select('*, packages(*), inventory_items(*), discrepancies(*)')
      .eq('id', id)
      .single();
    if (error) throw new Error('Lieferung nicht gefunden');
    // Rename inventory_items → inventory (matches TypeScript type)
    const { inventory_items, ...rest } = data as Record<string, unknown>;
    return { ...rest, inventory: inventory_items } as unknown as Delivery;
  },

  createDelivery: async (data: Partial<Delivery>): Promise<Delivery> => {
    const id  = crypto.randomUUID();
    const now = new Date().toISOString();

    const row = {
      id,
      status:                data.status ?? 'expected',
      supplier_id:           data.supplier_id ?? null,
      supplier_name:         data.supplier_name ?? '',
      purchase_order_number: data.purchase_order_number ?? null,
      delivery_note_number:  data.delivery_note_number  ?? null,
      carrier:               data.carrier               ?? null,
      number_of_packages:    data.number_of_packages    ?? 0,
      expected_date:         data.expected_date         ?? null,
      assigned_to:           data.assigned_to           ?? null,
      notes:                 data.notes                 ?? null,
      created_by:            data.created_by            ?? null,
      created_at:            now,
      updated_at:            now,
    };

    const delivery = check(await supabase.from('deliveries').insert(row).select().single());

    // Auto-Pakete anlegen
    if ((data.number_of_packages ?? 0) > 0) {
      const pkgs = Array.from({ length: data.number_of_packages! }, (_, i) => ({
        id:             crypto.randomUUID(),
        delivery_id:    id,
        package_number: i + 1,
        status:         'pending',
        checklist_json: {},
        serial_numbers: [],
        photos:         [],
        created_at:     now,
      }));
      await supabase.from('packages').insert(pkgs);
    }

    await logActivity('delivery', id, 'created',
      `Lieferung von ${data.supplier_name} angelegt`, data.created_by);

    return delivery as unknown as Delivery;
  },

  updateDelivery: async (id: string, data: Partial<Delivery>): Promise<Delivery> => {
    const row = { ...data, updated_at: new Date().toISOString() };
    return check(await supabase.from('deliveries').update(row).eq('id', id).select().single()) as Delivery;
  },

  updateDeliveryStatus: async (id: string, data: Record<string, unknown>): Promise<Delivery> => {
    const updates: Record<string, unknown> = {
      status:     data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.status === 'arrived') {
      updates.actual_arrival_date = data.actual_arrival_date ?? new Date().toISOString();
      if (data.delivery_note_number) updates.delivery_note_number = data.delivery_note_number;
      if (data.carrier)              updates.carrier               = data.carrier;
      if (data.number_of_packages)   updates.number_of_packages    = data.number_of_packages;
    }

    const delivery = check(
      await supabase.from('deliveries').update(updates).eq('id', id).select().single()
    ) as Delivery;

    // Fehlende Pakete nacherstellen wenn Anzahl erhöht wurde
    if (data.status === 'arrived' && data.number_of_packages) {
      const { count } = await supabase
        .from('packages')
        .select('id', { count: 'exact', head: true })
        .eq('delivery_id', id);
      const existing = count ?? 0;
      const target   = data.number_of_packages as number;
      if (existing < target) {
        const now  = new Date().toISOString();
        const pkgs = Array.from({ length: target - existing }, (_, i) => ({
          id:             crypto.randomUUID(),
          delivery_id:    id,
          package_number: existing + i + 1,
          status:         'pending',
          checklist_json: {},
          serial_numbers: [],
          photos:         [],
          created_at:     now,
        }));
        await supabase.from('packages').insert(pkgs);
      }
    }

    const statusLabels: Record<string, string> = {
      arrived:      'Wareneingang erfasst',
      in_inspection:'Prüfung gestartet',
      completed:    'Abgeschlossen',
      flagged:      'Eskaliert (Reklamation)',
      returned:     'Retoure eingeleitet',
    };
    await logActivity('delivery', id, `status_${data.status}`,
      statusLabels[data.status as string] ?? `Status → ${data.status}`,
      data.performed_by as string | undefined);

    return delivery;
  },

  deleteDelivery: async (id: string): Promise<{ success: boolean }> => {
    check(await supabase.from('deliveries').delete().eq('id', id));
    return { success: true };
  },

  // ── Packages ───────────────────────────────────────────────────────────────
  getPackagesByDelivery: async (deliveryId: string): Promise<Package[]> => {
    return check(
      await supabase.from('packages')
        .select('*')
        .eq('delivery_id', deliveryId)
        .order('package_number')
    ) as Package[];
  },

  getPackage: async (id: string): Promise<Package> => {
    const pkg = check(await supabase.from('packages').select('*').eq('id', id).single());
    if (!pkg) throw new Error('Paket nicht gefunden');
    return pkg as Package;
  },

  updatePackage: async (id: string, data: Partial<Package & Record<string, unknown>>): Promise<Package> => {
    // Checklist mergen (nicht ersetzen)
    let updateData: Record<string, unknown> = { ...data };
    if (data.checklist_json) {
      const existing = check(await supabase.from('packages').select('checklist_json').eq('id', id).single()) as unknown as Record<string, unknown>;
      updateData.checklist_json = { ...(existing.checklist_json as object ?? {}), ...data.checklist_json };
    }

    const pkg = check(
      await supabase.from('packages').update(updateData).eq('id', id).select('*, delivery_id').single()
    ) as Package & { delivery_id: string };

    // Lieferung → in_inspection wenn erste Aktualisierung
    if (data.status && data.status !== 'pending') {
      const { data: delivery } = await supabase
        .from('deliveries').select('status').eq('id', pkg.delivery_id).single();
      if (delivery?.status === 'arrived') {
        await supabase.from('deliveries')
          .update({ status: 'in_inspection', updated_at: new Date().toISOString() })
          .eq('id', pkg.delivery_id);
      }
      // Paket beschädigt → Lieferung eskalieren
      if (data.status === 'damaged') {
        await supabase.from('deliveries')
          .update({ status: 'flagged', updated_at: new Date().toISOString() })
          .eq('id', pkg.delivery_id);
        await logActivity('delivery', pkg.delivery_id, 'flagged',
          `Paket ${pkg.package_number} als beschädigt markiert`,
          data.inspected_by as string | undefined);
      }
    }

    await logActivity('package', id, 'updated',
      `Paket ${pkg.package_number} aktualisiert`,
      data.inspected_by as string | undefined);

    return pkg;
  },

  completePackage: async (id: string, data: Record<string, unknown>): Promise<Package> => {
    const now = new Date().toISOString();
    const pkg = check(
      await supabase.from('packages')
        .update({ status: data.status, inspected_by: data.inspected_by, inspected_at: now })
        .eq('id', id)
        .select('*, delivery_id, package_number')
        .single()
    ) as Package & { delivery_id: string };

    // Prüfen ob alle Pakete fertig sind
    const { data: allPkgs } = await supabase
      .from('packages').select('status').eq('delivery_id', pkg.delivery_id);
    const done       = (allPkgs ?? []).every((p: { status: string }) =>
      ['ok','damaged','discrepancy'].includes(p.status));
    const anyDamaged = (allPkgs ?? []).some((p: { status: string }) => p.status === 'damaged');

    if (done) {
      const newStatus = anyDamaged ? 'flagged' : 'in_inspection';
      await supabase.from('deliveries')
        .update({ status: newStatus, updated_at: now })
        .eq('id', pkg.delivery_id);
    }

    await logActivity('package', id, 'inspection_complete',
      `Inspektion Paket ${pkg.package_number} abgeschlossen (${data.status})`,
      data.inspected_by as string | undefined);

    return pkg;
  },

  uploadPackagePhotos: async (packageId: string, files: File[]): Promise<{ photos: string[] }> => {
    const uploaded: string[] = [];

    for (const file of files) {
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const path = `${packageId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from('package-photos')
        .upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('package-photos').getPublicUrl(path);
      uploaded.push(data.publicUrl);
    }

    // Bestehende Fotos mergen
    const existing = check(
      await supabase.from('packages').select('photos').eq('id', packageId).single()
    ) as { photos: string[] };
    const allPhotos = [...(existing.photos ?? []), ...uploaded];
    await supabase.from('packages').update({ photos: allPhotos }).eq('id', packageId);

    return { photos: allPhotos };
  },

  // ── Inventory ──────────────────────────────────────────────────────────────
  getInventory: async (params?: Record<string, string>): Promise<InventoryItem[]> => {
    let q = supabase.from('inventory_items').select('*').order('created_at');
    if (params?.delivery_id) q = q.eq('delivery_id', params.delivery_id);
    return check(await q) as InventoryItem[];
  },

  bookInventory: async (data: {
    items: Partial<InventoryItem>[];
    delivery_id: string;
    booked_by?: string;
  }): Promise<{ booked: number; items: InventoryItem[] }> => {
    const now = new Date().toISOString();
    const rows = data.items.map(item => ({
      id:             crypto.randomUUID(),
      delivery_id:    data.delivery_id,
      package_id:     item.package_id     ?? null,
      article_number: item.article_number ?? null,
      description:    item.description    ?? '',
      quantity:       item.quantity       ?? 1,
      serial_number:  item.serial_number  ?? null,
      location:       item.location       ?? null,
      project:        item.project        ?? null,
      cost_center:    item.cost_center    ?? null,
      booked_at:      now,
      booked_by:      data.booked_by      ?? null,
      created_at:     now,
    }));

    const booked = check(
      await supabase.from('inventory_items').insert(rows).select()
    ) as InventoryItem[];

    await supabase.from('deliveries')
      .update({ status: 'completed', updated_at: now })
      .eq('id', data.delivery_id);

    await logActivity('inventory', data.delivery_id, 'booked',
      `${booked.length} Artikel eingebucht`, data.booked_by);

    return { booked: booked.length, items: booked };
  },

  // ── Discrepancies ──────────────────────────────────────────────────────────
  getDiscrepancies: async (params?: Record<string, string>): Promise<Discrepancy[]> => {
    // Join deliveries für supplier_name / delivery_note_number
    let q = supabase
      .from('discrepancies')
      .select('*, deliveries(supplier_name, delivery_note_number, purchase_order_number)')
      .order('created_at', { ascending: false });
    if (params?.status)      q = q.eq('status', params.status);
    if (params?.delivery_id) q = q.eq('delivery_id', params.delivery_id);
    const raw = check(await q) as Array<Record<string, unknown>>;
    return raw.map(flattenDiscrepancy);
  },

  getDiscrepancy: async (id: string): Promise<Discrepancy> => {
    const raw = check(
      await supabase
        .from('discrepancies')
        .select('*, deliveries(supplier_name, delivery_note_number, purchase_order_number)')
        .eq('id', id)
        .single()
    ) as Record<string, unknown>;
    if (!raw) throw new Error('Abweichung nicht gefunden');
    return flattenDiscrepancy(raw);
  },

  createDiscrepancy: async (data: Partial<Discrepancy>): Promise<Discrepancy> => {
    const id  = crypto.randomUUID();
    const now = new Date().toISOString();

    const row = {
      id,
      delivery_id: data.delivery_id,
      package_id:  data.package_id  ?? null,
      type:        data.type,
      description: data.description,
      status:      'open',
      assigned_to: data.assigned_to ?? null,
      created_at:  now,
    };

    const disc = check(await supabase.from('discrepancies').insert(row).select().single()) as Discrepancy;

    // Lieferung eskalieren
    await supabase.from('deliveries')
      .update({ status: 'flagged', updated_at: now })
      .eq('id', data.delivery_id);

    // Paket markieren
    if (data.package_id) {
      await supabase.from('packages')
        .update({ status: 'discrepancy' })
        .eq('id', data.package_id);
    }

    await logActivity('discrepancy', id, 'created',
      `Abweichung gemeldet: ${data.type} — ${(data.description ?? '').slice(0, 60)}`);
    await logActivity('delivery', data.delivery_id!, 'flagged',
      'Lieferung wegen Abweichung eskaliert');

    return disc;
  },

  updateDiscrepancy: async (id: string, data: Partial<Discrepancy & Record<string, unknown>>): Promise<Discrepancy> => {
    const updates: Record<string, unknown> = { ...data };
    if (data.status === 'resolved') updates.resolved_at = new Date().toISOString();
    return check(
      await supabase.from('discrepancies').update(updates).eq('id', id).select().single()
    ) as Discrepancy;
  },

  appendDiscrepancyLog: async (
    id: string,
    entry: string,
    performedBy?: string,
  ): Promise<{ supplier_communication_log: string }> => {
    const existing = check(
      await supabase.from('discrepancies').select('supplier_communication_log').eq('id', id).single()
    ) as { supplier_communication_log: string };

    const timestamp = new Date().toLocaleString('de-DE');
    const who       = performedBy ?? 'System';
    const oldLog    = existing.supplier_communication_log ?? '';
    const newLog    = oldLog
      ? `${oldLog}\n\n[${timestamp}] ${who}:\n${entry}`
      : `[${timestamp}] ${who}:\n${entry}`;

    check(
      await supabase.from('discrepancies')
        .update({ supplier_communication_log: newLog })
        .eq('id', id)
    );
    await logActivity('discrepancy', id, 'log_entry', 'Kommunikationseintrag hinzugefügt', performedBy);

    return { supplier_communication_log: newLog };
  },

  // ── Auth ───────────────────────────────────────────────────────────────────
  loginByName: async (firstName: string, lastName: string): Promise<Employee | null> => {
    const fullName = `${firstName} ${lastName}`;
    const { data } = await supabase
      .from('employees')
      .select('*')
      .ilike('name', fullName)
      .limit(1)
      .single();
    return (data as Employee) ?? null;
  },

  // ── Suppliers ──────────────────────────────────────────────────────────────
  getSuppliers: async (): Promise<Supplier[]> =>
    check(await supabase.from('suppliers').select('*').order('name')) as Supplier[],

  createSupplier: async (data: Partial<Supplier>): Promise<Supplier> =>
    check(await supabase.from('suppliers')
      .insert({ ...data, id: crypto.randomUUID() }).select().single()) as Supplier,

  updateSupplier: async (id: string, data: Partial<Supplier>): Promise<Supplier> =>
    check(await supabase.from('suppliers').update(data).eq('id', id).select().single()) as Supplier,

  deleteSupplier: async (id: string): Promise<{ success: boolean }> => {
    check(await supabase.from('suppliers').delete().eq('id', id));
    return { success: true };
  },

  // ── Employees ──────────────────────────────────────────────────────────────
  getEmployees: async (): Promise<Employee[]> =>
    check(await supabase.from('employees').select('*').order('name')) as Employee[],

  createEmployee: async (data: Partial<Employee>): Promise<Employee> =>
    check(await supabase.from('employees')
      .insert({ ...data, id: crypto.randomUUID() }).select().single()) as Employee,

  updateEmployee: async (id: string, data: Partial<Employee>): Promise<Employee> =>
    check(await supabase.from('employees').update(data).eq('id', id).select().single()) as Employee,

  deleteEmployee: async (id: string): Promise<{ success: boolean }> => {
    check(await supabase.from('employees').delete().eq('id', id));
    return { success: true };
  },

  // ── Stock Locations ────────────────────────────────────────────────────────
  getLocations: async (): Promise<StockLocation[]> =>
    check(await supabase.from('stock_locations').select('*').order('name')) as StockLocation[],

  createLocation: async (data: Partial<StockLocation>): Promise<StockLocation> =>
    check(await supabase.from('stock_locations')
      .insert({ ...data, id: crypto.randomUUID() }).select().single()) as StockLocation,

  updateLocation: async (id: string, data: Partial<StockLocation>): Promise<StockLocation> =>
    check(await supabase.from('stock_locations').update(data).eq('id', id).select().single()) as StockLocation,

  deleteLocation: async (id: string): Promise<{ success: boolean }> => {
    check(await supabase.from('stock_locations').delete().eq('id', id));
    return { success: true };
  },

  // ── App Settings ───────────────────────────────────────────────────────────
  getAppSettings: async (): Promise<Record<string, string>> => {
    const rows = check(await supabase.from('settings').select('key, value')) as { key: string; value: string }[];
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  },

  updateAppSettings: async (data: Record<string, string>): Promise<{ success: boolean }> => {
    const rows = Object.entries(data).map(([key, value]) => ({ key, value }));
    check(await supabase.from('settings').upsert(rows, { onConflict: 'key' }));
    return { success: true };
  },
};

// ── Hilfsfunktion: discrepancy-Join flach machen ─────────────────────────────
function flattenDiscrepancy(raw: Record<string, unknown>): Discrepancy {
  const delivery = raw.deliveries as Record<string, unknown> | null;
  const { deliveries: _, ...rest } = raw;
  return {
    ...rest,
    supplier_name:         delivery?.supplier_name         ?? undefined,
    delivery_note_number:  delivery?.delivery_note_number  ?? undefined,
    purchase_order_number: delivery?.purchase_order_number ?? undefined,
  } as unknown as Discrepancy;
}

// ── Öffentliche Exports (gleiche Signatur wie bisher) ─────────────────────────

const api = USE_MOCK ? mockApi : sbApi;

// Auth
export const loginByName = (firstName: string, lastName: string): Promise<Employee | null> =>
  api.loginByName(firstName, lastName);

// Dashboard
export const getDashboard = (): Promise<DashboardStats> => api.getDashboard();

// Deliveries
export const getDeliveries   = (p?: Record<string, string>) => api.getDeliveries(p);
export const getDelivery     = (id: string)                  => api.getDelivery(id);
export const createDelivery  = (d: Partial<Delivery>)        => api.createDelivery(d);
export const updateDelivery  = (id: string, d: Partial<Delivery>) => api.updateDelivery(id, d);
export const updateDeliveryStatus = (id: string, d: Record<string, unknown>) => api.updateDeliveryStatus(id, d);
export const deleteDelivery  = (id: string)                  => api.deleteDelivery(id);

// Packages
export const getPackagesByDelivery = (did: string)  => api.getPackagesByDelivery(did);
export const getPackage            = (id: string)   => api.getPackage(id);
export const updatePackage         = (id: string, d: Partial<Package & Record<string, unknown>>) => api.updatePackage(id, d);
export const completePackage       = (id: string, d: Record<string, unknown>) => api.completePackage(id, d);
export const uploadPackagePhotos   = (pid: string, files: File[], _uploadedBy?: string) =>
  api.uploadPackagePhotos(pid, files);

// Inventory
export const getInventory   = (p?: Record<string, string>) => api.getInventory(p);
export const bookInventory  = (d: { items: Partial<InventoryItem>[]; delivery_id: string; booked_by?: string }) =>
  api.bookInventory(d);
export const updateInventoryItem = (_id: string, _d: Partial<InventoryItem>) =>
  Promise.reject(new Error('updateInventoryItem nicht implementiert'));

// Discrepancies
export const getDiscrepancies  = (p?: Record<string, string>) => api.getDiscrepancies(p);
export const getDiscrepancy    = (id: string)                  => api.getDiscrepancy(id);
export const createDiscrepancy = (d: Partial<Discrepancy>)     => api.createDiscrepancy(d);
export const updateDiscrepancy = (id: string, d: Partial<Discrepancy & Record<string, unknown>>) =>
  api.updateDiscrepancy(id, d);
export const appendDiscrepancyLog = (id: string, entry: string, by?: string) =>
  api.appendDiscrepancyLog(id, entry, by);

// Settings — Suppliers
export const getSuppliers    = ()                          => api.getSuppliers();
export const createSupplier  = (d: Partial<Supplier>)     => api.createSupplier(d);
export const updateSupplier  = (id: string, d: Partial<Supplier>) => api.updateSupplier(id, d);
export const deleteSupplier  = (id: string)               => api.deleteSupplier(id);

// Settings — Employees
export const getEmployees    = ()                          => api.getEmployees();
export const createEmployee  = (d: Partial<Employee>)     => api.createEmployee(d);
export const updateEmployee  = (id: string, d: Partial<Employee>) => api.updateEmployee(id, d);
export const deleteEmployee  = (id: string)               => api.deleteEmployee(id);

// Settings — Locations
export const getLocations    = ()                              => api.getLocations();
export const createLocation  = (d: Partial<StockLocation>)    => api.createLocation(d);
export const updateLocation  = (id: string, d: Partial<StockLocation>) => api.updateLocation(id, d);
export const deleteLocation  = (id: string)                   => api.deleteLocation(id);

// Settings — App
export const getAppSettings    = ()                        => api.getAppSettings();
export const updateAppSettings = (d: Record<string, string>) => api.updateAppSettings(d);
