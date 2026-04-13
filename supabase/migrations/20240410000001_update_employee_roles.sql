-- ============================================================
-- Warenannahme – Employee Roles Update
-- ============================================================

-- 1. Erst bestehende Werte auf neue Rollen mappen
UPDATE employees SET role = 'Wareneingang' WHERE role IN ('Lagerleiter', 'Einkauf');
UPDATE employees SET role = 'Warenprüfung' WHERE role IN ('Prüfer', 'inspector');
-- Alles andere (unbekannte Rollen) auf Beobachter setzen
UPDATE employees SET role = 'Beobachter'   WHERE role NOT IN ('Wareneingang', 'Warenprüfung', 'Beobachter');

-- 2. Jetzt erst Constraint setzen (alle Zeilen erfüllen ihn bereits)
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees ADD CONSTRAINT employees_role_check
  CHECK (role IN ('Beobachter', 'Wareneingang', 'Warenprüfung'));

-- 3. Seed-Einträge (nur neue hinzufügen)
INSERT INTO employees (id, name, email, role) VALUES
  (gen_random_uuid()::text, 'Max Mustermann', 'max.mustermann@it-service.de', 'Wareneingang'),
  (gen_random_uuid()::text, 'Anna Schmidt',   'anna.schmidt@it-service.de',   'Warenprüfung'),
  (gen_random_uuid()::text, 'Thomas Müller',  'thomas.mueller@it-service.de', 'Warenprüfung'),
  (gen_random_uuid()::text, 'Sandra Weber',   'sandra.weber@it-service.de',   'Wareneingang'),
  (gen_random_uuid()::text, 'Klaus Berger',   'klaus.berger@it-service.de',   'Beobachter')
ON CONFLICT DO NOTHING;
