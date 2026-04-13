-- ============================================================
-- Rolle "Admin" zum employees_role_check Constraint hinzufügen
-- ============================================================

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;

ALTER TABLE employees ADD CONSTRAINT employees_role_check
  CHECK (role IN ('Admin', 'Beobachter', 'Wareneingang', 'Warenprüfung'));
