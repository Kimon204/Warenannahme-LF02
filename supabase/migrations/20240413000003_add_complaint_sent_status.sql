-- ============================================================
-- Neuen Status "complaint_sent" für Abweichungen hinzufügen
-- ============================================================

ALTER TABLE discrepancies DROP CONSTRAINT IF EXISTS discrepancies_status_check;

ALTER TABLE discrepancies ADD CONSTRAINT discrepancies_status_check
  CHECK (status IN ('open', 'in_progress', 'resolved', 'complaint_sent'));
