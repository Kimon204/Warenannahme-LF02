export type DeliveryStatus = 'expected' | 'arrived' | 'in_inspection' | 'completed' | 'flagged' | 'returned';
export type PackageStatus = 'pending' | 'inspecting' | 'ok' | 'damaged' | 'discrepancy';
export type DiscrepancyStatus = 'open' | 'in_progress' | 'resolved' | 'complaint_sent';
export type DiscrepancyType = 'quantity' | 'damage' | 'wrong_item' | 'missing_accessory' | 'other';

export interface Supplier {
  id: string;
  name: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  created_at: string;
}

export interface Employee {
  id: string;
  name: string;
  email?: string;
  role?: string;
  created_at: string;
}

export interface StockLocation {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface ChecklistData {
  packaging_intact?: boolean;
  contents_match?: boolean;
  serial_numbers_captured?: boolean;
  quantity_correct?: boolean;
  hardware_undamaged?: boolean;
  accessories_complete?: boolean;
  seals_intact?: boolean;
}

export interface Package {
  id: string;
  delivery_id: string;
  package_number: number;
  status: PackageStatus;
  checklist_json: ChecklistData;
  serial_numbers: string[];
  photos: string[];
  notes?: string;
  inspected_by?: string;
  inspected_at?: string;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  package_id?: string;
  delivery_id: string;
  article_number?: string;
  description: string;
  quantity: number;
  serial_number?: string;
  location?: string;
  project?: string;
  cost_center?: string;
  booked_at?: string;
  booked_by?: string;
  created_at: string;
}

export interface Discrepancy {
  id: string;
  delivery_id: string;
  package_id?: string;
  type: DiscrepancyType;
  description: string;
  status: DiscrepancyStatus;
  assigned_to?: string;
  created_at: string;
  resolved_at?: string;
  supplier_communication_log?: string;
  supplier_name?: string;
  delivery_note_number?: string;
  purchase_order_number?: string;
}

export interface Delivery {
  id: string;
  status: DeliveryStatus;
  supplier_id?: string;
  supplier_name: string;
  purchase_order_number?: string;
  delivery_note_number?: string;
  carrier?: string;
  number_of_packages: number;
  packages_inspected?: number;
  expected_date?: string;
  actual_arrival_date?: string;
  created_by?: string;
  assigned_to?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  packages?: Package[];
  inventory?: InventoryItem[];
  discrepancies?: Discrepancy[];
}

export interface ActivityItem {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  description: string;
  performed_by?: string;
  created_at: string;
}

export interface DashboardStats {
  deliveries_today: number;
  open_inspections: number;
  flagged_items: number;
  pending_returns: number;
  open_discrepancies: number;
  pipeline: Record<string, number>;
  recent_activity: ActivityItem[];
}

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  expected: 'Erwartet',
  arrived: 'Eingetroffen',
  in_inspection: 'In Prüfung',
  completed: 'Abgeschlossen',
  flagged: 'Eskaliert',
  returned: 'Retoure',
};

export const PACKAGE_STATUS_LABELS: Record<PackageStatus, string> = {
  pending: 'Ausstehend',
  inspecting: 'In Prüfung',
  ok: 'In Ordnung',
  damaged: 'Beschädigt',
  discrepancy: 'Abweichung',
};

export const DISCREPANCY_STATUS_LABELS: Record<DiscrepancyStatus, string> = {
  open: 'Offen',
  in_progress: 'In Bearbeitung',
  resolved: 'Gelöst',
  complaint_sent: 'Mängelrüge verschickt',
};

export const DISCREPANCY_TYPE_LABELS: Record<DiscrepancyType, string> = {
  quantity: 'Mengendifferenz',
  damage: 'Beschädigung',
  wrong_item: 'Falscher Artikel',
  missing_accessory: 'Zubehör fehlt',
  other: 'Sonstiges',
};

export const CHECKLIST_ITEMS: { key: keyof ChecklistData; label: string }[] = [
  { key: 'packaging_intact', label: 'Außenverpackung unbeschädigt (kein Druck, Feuchtigkeit, Kollaps)' },
  { key: 'contents_match', label: 'Inhalt stimmt mit Lieferschein überein' },
  { key: 'serial_numbers_captured', label: 'Seriennummern erfasst' },
  { key: 'quantity_correct', label: 'Menge korrekt' },
  { key: 'hardware_undamaged', label: 'Hardware optisch einwandfrei (keine Risse, verbogene Stecker, fehlende Teile)' },
  { key: 'accessories_complete', label: 'Zubehör vollständig (Kabel, Handbücher, Lizenzen)' },
  { key: 'seals_intact', label: 'Siegel / Originalverpackung unversehrt (falls vorhanden)' },
];
