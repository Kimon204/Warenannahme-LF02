import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const DB_PATH = path.join(__dirname, '../../../db/warenannahme.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT DEFAULT 'inspector',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS stock_locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS deliveries (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'expected',
    supplier_id TEXT,
    supplier_name TEXT NOT NULL,
    purchase_order_number TEXT,
    delivery_note_number TEXT,
    carrier TEXT,
    number_of_packages INTEGER DEFAULT 0,
    expected_date TEXT,
    actual_arrival_date TEXT,
    created_by TEXT,
    assigned_to TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY,
    delivery_id TEXT NOT NULL,
    package_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    checklist_json TEXT DEFAULT '{}',
    serial_numbers TEXT DEFAULT '[]',
    photos TEXT DEFAULT '[]',
    notes TEXT,
    inspected_by TEXT,
    inspected_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    package_id TEXT,
    delivery_id TEXT NOT NULL,
    article_number TEXT,
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    serial_number TEXT,
    location TEXT,
    project TEXT,
    cost_center TEXT,
    booked_at TEXT,
    booked_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (package_id) REFERENCES packages(id),
    FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
  );

  CREATE TABLE IF NOT EXISTS discrepancies (
    id TEXT PRIMARY KEY,
    delivery_id TEXT NOT NULL,
    package_id TEXT,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    assigned_to TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT,
    supplier_communication_log TEXT DEFAULT '',
    FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
    FOREIGN KEY (package_id) REFERENCES packages(id)
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    performed_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Seed settings
const companySetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('company_name');
if (!companySetting) {
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('company_name', 'IT Service GmbH');
  insertSetting.run('company_address', 'Musterstraße 1, 12345 Berlin');
  insertSetting.run('company_logo', '');
}

// Seed suppliers
const supplierCount = (db.prepare('SELECT COUNT(*) as c FROM suppliers').get() as { c: number }).c;
if (supplierCount === 0) {
  const ins = db.prepare('INSERT INTO suppliers (id, name, contact_email, contact_phone, address) VALUES (?, ?, ?, ?, ?)');
  ins.run(uuidv4(), 'Dell Technologies GmbH', 'orders@dell.de', '+49 69 9792-0', 'Main Airport Center, 60549 Frankfurt');
  ins.run(uuidv4(), 'Lenovo GmbH', 'b2b@lenovo.de', '+49 800 1000-702', 'Landshuter Allee 8-10, 80637 München');
  ins.run(uuidv4(), 'HP Deutschland GmbH', 'hpde.supplies@hp.com', '+49 800 000-0757', 'Schickardstraße 32, 71034 Böblingen');
  ins.run(uuidv4(), 'Microsoft Deutschland GmbH', 'orders@microsoft.de', '+49 89 3176-0', 'Walter-Gropius-Straße 5, 80807 München');
  ins.run(uuidv4(), 'Cisco Systems GmbH', 'cisco-de@cisco.com', '+49 800 1873-255', 'Am Söldnermoos 17, 85399 Hallbergmoos');
}

// Seed employees
const employeeCount = (db.prepare('SELECT COUNT(*) as c FROM employees').get() as { c: number }).c;
if (employeeCount === 0) {
  const ins = db.prepare('INSERT INTO employees (id, name, email, role) VALUES (?, ?, ?, ?)');
  ins.run(uuidv4(), 'Max Mustermann', 'max.mustermann@it-service.de', 'Lagerleiter');
  ins.run(uuidv4(), 'Anna Schmidt', 'anna.schmidt@it-service.de', 'Prüfer');
  ins.run(uuidv4(), 'Thomas Müller', 'thomas.mueller@it-service.de', 'Prüfer');
  ins.run(uuidv4(), 'Sandra Weber', 'sandra.weber@it-service.de', 'Einkauf');
}

// Seed locations
const locationCount = (db.prepare('SELECT COUNT(*) as c FROM stock_locations').get() as { c: number }).c;
if (locationCount === 0) {
  const ins = db.prepare('INSERT INTO stock_locations (id, name, description) VALUES (?, ?, ?)');
  ins.run(uuidv4(), 'Lager A-01', 'Hauptlager - Regal A, Fach 1');
  ins.run(uuidv4(), 'Lager A-02', 'Hauptlager - Regal A, Fach 2');
  ins.run(uuidv4(), 'Lager B-01', 'Nebenlager - Regal B, Fach 1');
  ins.run(uuidv4(), 'Lager B-02', 'Nebenlager - Regal B, Fach 2');
  ins.run(uuidv4(), 'IT-Raum 101', 'IT-Raum - Soforteinsatz');
  ins.run(uuidv4(), 'Quarantäne', 'Quarantäne-Bereich für beschädigte Waren');
}

export function logActivity(
  entityType: string,
  entityId: string,
  action: string,
  description: string,
  performedBy?: string
) {
  db.prepare(
    'INSERT INTO activity_log (id, entity_type, entity_id, action, description, performed_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(uuidv4(), entityType, entityId, action, description, performedBy ?? null);
}

export { db, uuidv4 };
