-- ============================================================
-- Warenannahme – Initial Schema für Supabase (PostgreSQL)
-- Ausführen in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Erweiterungen ────────────────────────────────────────────
-- (in Supabase standardmäßig bereits aktiviert)
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tabellen ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS suppliers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT,
  role        TEXT DEFAULT 'Prüfer',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_locations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deliveries (
  id                    TEXT PRIMARY KEY,
  status                TEXT NOT NULL DEFAULT 'expected'
                          CHECK (status IN ('expected','arrived','in_inspection','completed','flagged','returned')),
  supplier_id           TEXT REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name         TEXT NOT NULL,
  purchase_order_number TEXT,
  delivery_note_number  TEXT,
  carrier               TEXT,
  number_of_packages    INTEGER NOT NULL DEFAULT 0,
  packages_inspected    INTEGER NOT NULL DEFAULT 0,
  expected_date         DATE,
  actual_arrival_date   TIMESTAMPTZ,
  created_by            TEXT,
  assigned_to           TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS packages (
  id              TEXT PRIMARY KEY,
  delivery_id     TEXT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  package_number  INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','inspecting','ok','damaged','discrepancy')),
  checklist_json  JSONB NOT NULL DEFAULT '{}',
  serial_numbers  JSONB NOT NULL DEFAULT '[]',
  photos          JSONB NOT NULL DEFAULT '[]',
  notes           TEXT,
  inspected_by    TEXT,
  inspected_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id             TEXT PRIMARY KEY,
  package_id     TEXT REFERENCES packages(id) ON DELETE SET NULL,
  delivery_id    TEXT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  article_number TEXT,
  description    TEXT NOT NULL,
  quantity       INTEGER NOT NULL DEFAULT 1,
  serial_number  TEXT,
  location       TEXT,
  project        TEXT,
  cost_center    TEXT,
  booked_at      TIMESTAMPTZ,
  booked_by      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discrepancies (
  id                       TEXT PRIMARY KEY,
  delivery_id              TEXT NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  package_id               TEXT REFERENCES packages(id) ON DELETE SET NULL,
  type                     TEXT NOT NULL
                             CHECK (type IN ('quantity','damage','wrong_item','missing_accessory','other')),
  description              TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'open'
                             CHECK (status IN ('open','in_progress','resolved')),
  assigned_to              TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at              TIMESTAMPTZ,
  supplier_communication_log TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS activity_log (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  action       TEXT NOT NULL,
  description  TEXT,
  performed_by TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ── Indizes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_deliveries_status      ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_supplier_id ON deliveries(supplier_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at  ON deliveries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_packages_delivery_id   ON packages(delivery_id);
CREATE INDEX IF NOT EXISTS idx_inventory_delivery_id  ON inventory_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_discrepancies_delivery ON discrepancies(delivery_id);
CREATE INDEX IF NOT EXISTS idx_discrepancies_status   ON discrepancies(status);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity    ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created   ON activity_log(created_at DESC);

-- ── Trigger: packages_inspected automatisch pflegen ──────────

CREATE OR REPLACE FUNCTION update_packages_inspected()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_delivery_id TEXT;
BEGIN
  v_delivery_id := COALESCE(NEW.delivery_id, OLD.delivery_id);
  UPDATE deliveries
  SET packages_inspected = (
    SELECT COUNT(*) FROM packages
    WHERE delivery_id = v_delivery_id
      AND status != 'pending'
  ),
  updated_at = NOW()
  WHERE id = v_delivery_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_packages_inspected ON packages;
CREATE TRIGGER trg_packages_inspected
AFTER INSERT OR UPDATE OF status OR DELETE ON packages
FOR EACH ROW EXECUTE FUNCTION update_packages_inspected();

-- ── Trigger: updated_at automatisch setzen ───────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deliveries_updated_at ON deliveries;
CREATE TRIGGER trg_deliveries_updated_at
BEFORE UPDATE ON deliveries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row Level Security (Prototype: offen für alle) ───────────
-- HINWEIS: Für Produktion Auth + restriktive Policies einrichten!

ALTER TABLE suppliers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees        ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_locations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE discrepancies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings         ENABLE ROW LEVEL SECURITY;

-- Permissive Policies (Anon Key darf alles lesen + schreiben)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['suppliers','employees','stock_locations','deliveries',
                            'packages','inventory_items','discrepancies','activity_log','settings']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS allow_all ON %I', t);
    EXECUTE format(
      'CREATE POLICY allow_all ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t
    );
  END LOOP;
END;
$$;

-- ── Seed-Daten ────────────────────────────────────────────────

INSERT INTO settings (key, value) VALUES
  ('company_name',    'IT Service GmbH'),
  ('company_address', 'Musterstraße 1, 12345 Berlin'),
  ('company_logo',    '')
ON CONFLICT (key) DO NOTHING;

INSERT INTO suppliers (id, name, contact_email, contact_phone, address) VALUES
  (gen_random_uuid()::text, 'Dell Technologies GmbH',   'orders@dell.de',          '+49 69 9792-0',       'Main Airport Center, 60549 Frankfurt'),
  (gen_random_uuid()::text, 'Lenovo GmbH',              'b2b@lenovo.de',            '+49 800 1000-702',    'Landshuter Allee 8-10, 80637 München'),
  (gen_random_uuid()::text, 'HP Deutschland GmbH',      'hpde.supplies@hp.com',     '+49 800 000-0757',    'Schickardstraße 32, 71034 Böblingen'),
  (gen_random_uuid()::text, 'Cisco Systems GmbH',       'cisco-de@cisco.com',       '+49 800 1873-255',    'Am Söldnermoos 17, 85399 Hallbergmoos'),
  (gen_random_uuid()::text, 'Microsoft Deutschland GmbH','orders@microsoft.de',     '+49 89 3176-0',       'Walter-Gropius-Straße 5, 80807 München')
ON CONFLICT (id) DO NOTHING;

INSERT INTO employees (id, name, email, role) VALUES
  (gen_random_uuid()::text, 'Max Mustermann', 'max.mustermann@it-service.de', 'Lagerleiter'),
  (gen_random_uuid()::text, 'Anna Schmidt',   'anna.schmidt@it-service.de',   'Prüfer'),
  (gen_random_uuid()::text, 'Thomas Müller',  'thomas.mueller@it-service.de', 'Prüfer'),
  (gen_random_uuid()::text, 'Sandra Weber',   'sandra.weber@it-service.de',   'Einkauf')
ON CONFLICT (id) DO NOTHING;

INSERT INTO stock_locations (id, name, description) VALUES
  (gen_random_uuid()::text, 'Lager A-01',  'Hauptlager – Regal A, Fach 1'),
  (gen_random_uuid()::text, 'Lager A-02',  'Hauptlager – Regal A, Fach 2'),
  (gen_random_uuid()::text, 'Lager B-01',  'Nebenlager – Regal B, Fach 1'),
  (gen_random_uuid()::text, 'Lager B-02',  'Nebenlager – Regal B, Fach 2'),
  (gen_random_uuid()::text, 'IT-Raum 101', 'IT-Raum – Soforteinsatz'),
  (gen_random_uuid()::text, 'Quarantäne',  'Quarantäne-Bereich für beschädigte Waren')
ON CONFLICT (id) DO NOTHING;

-- ── Storage Bucket (manuell im Dashboard anlegen) ────────────
-- Name: "package-photos"
-- Public: true (oder signierte URLs verwenden)
-- Allowed MIME types: image/jpeg, image/png, image/webp
