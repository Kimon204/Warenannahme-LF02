-- ============================================================
-- Alle 5 Test-Lieferungen auf Status "expected" zurücksetzen
-- ============================================================

UPDATE deliveries
SET
  status              = 'expected',
  actual_arrival_date = NULL,
  updated_at          = NOW()
WHERE purchase_order_number IN (
  'PO-2026-0051',
  'PO-2026-0049',
  'PO-2026-0047',
  'PO-2026-0044',
  'PO-2026-0041'
);

-- Pakete zurücksetzen
UPDATE packages
SET
  status       = 'pending',
  checklist_json = '{}',
  serial_numbers = '[]',
  notes        = NULL,
  inspected_by = NULL,
  inspected_at = NULL
WHERE delivery_id IN (
  SELECT id FROM deliveries
  WHERE purchase_order_number IN (
    'PO-2026-0051',
    'PO-2026-0049',
    'PO-2026-0047',
    'PO-2026-0044',
    'PO-2026-0041'
  )
);

-- Abweichungen löschen
DELETE FROM discrepancies
WHERE delivery_id IN (
  SELECT id FROM deliveries
  WHERE purchase_order_number IN (
    'PO-2026-0051',
    'PO-2026-0049',
    'PO-2026-0047',
    'PO-2026-0044',
    'PO-2026-0041'
  )
);

-- Eingebuchte Artikel löschen
DELETE FROM inventory_items
WHERE delivery_id IN (
  SELECT id FROM deliveries
  WHERE purchase_order_number IN (
    'PO-2026-0051',
    'PO-2026-0049',
    'PO-2026-0047',
    'PO-2026-0044',
    'PO-2026-0041'
  )
);
