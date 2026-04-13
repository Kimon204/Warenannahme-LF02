-- ============================================================
-- Warenannahme – 5 Test-Lieferungen (alle Status-Stufen)
-- ============================================================

-- Supplier-IDs aus der bestehenden Tabelle holen
-- (werden als Subqueries referenziert, damit keine festen IDs nötig sind)

DO $$
DECLARE
  v_dell      TEXT := (SELECT id FROM suppliers WHERE name ILIKE '%Dell%'        LIMIT 1);
  v_hp        TEXT := (SELECT id FROM suppliers WHERE name ILIKE '%HP%'           LIMIT 1);
  v_lenovo    TEXT := (SELECT id FROM suppliers WHERE name ILIKE '%Lenovo%'       LIMIT 1);
  v_cisco     TEXT := (SELECT id FROM suppliers WHERE name ILIKE '%Cisco%'        LIMIT 1);
  v_microsoft TEXT := (SELECT id FROM suppliers WHERE name ILIKE '%Microsoft%'    LIMIT 1);

  -- Lieferungs-IDs
  d1 TEXT := gen_random_uuid()::text;
  d2 TEXT := gen_random_uuid()::text;
  d3 TEXT := gen_random_uuid()::text;
  d4 TEXT := gen_random_uuid()::text;
  d5 TEXT := gen_random_uuid()::text;

  -- Paket-IDs
  p1a TEXT := gen_random_uuid()::text;
  p1b TEXT := gen_random_uuid()::text;
  p1c TEXT := gen_random_uuid()::text;
  p2a TEXT := gen_random_uuid()::text;
  p2b TEXT := gen_random_uuid()::text;
  p2c TEXT := gen_random_uuid()::text;
  p3a TEXT := gen_random_uuid()::text;
  p3b TEXT := gen_random_uuid()::text;
  p4a TEXT := gen_random_uuid()::text;
  p4b TEXT := gen_random_uuid()::text;
  p5a TEXT := gen_random_uuid()::text;
  p5b TEXT := gen_random_uuid()::text;
  p5c TEXT := gen_random_uuid()::text;
  p5d TEXT := gen_random_uuid()::text;

BEGIN

  -- ── Lieferung 1: ERWARTET ─────────────────────────────────────────────────
  -- Microsoft Surface Pro 11 – kommt morgen
  INSERT INTO deliveries (id, status, supplier_id, supplier_name, purchase_order_number,
    delivery_note_number, carrier, number_of_packages, expected_date,
    assigned_to, created_by, notes, created_at, updated_at)
  VALUES (d1, 'expected', v_microsoft, 'Microsoft Deutschland GmbH',
    'PO-2026-0051', NULL, 'DHL Express', 4,
    (CURRENT_DATE + INTERVAL '1 day')::date,
    'Max Mustermann', 'Sandra Weber',
    'Surface Pro 11 (4×) + Signature Keyboard + Slim Pen für Management-Team',
    NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days');

  INSERT INTO packages (id, delivery_id, package_number, status, checklist_json, serial_numbers, photos, created_at)
  VALUES
    (p1a, d1, 1, 'pending', '{}', '[]', '[]', NOW() - INTERVAL '2 days'),
    (p1b, d1, 2, 'pending', '{}', '[]', '[]', NOW() - INTERVAL '2 days'),
    (p1c, d1, 3, 'pending', '{}', '[]', '[]', NOW() - INTERVAL '2 days');


  -- ── Lieferung 2: EINGETROFFEN ─────────────────────────────────────────────
  -- HP ProLiant Server – heute angekommen, wartet auf Prüfung
  INSERT INTO deliveries (id, status, supplier_id, supplier_name, purchase_order_number,
    delivery_note_number, carrier, number_of_packages, expected_date, actual_arrival_date,
    assigned_to, created_by, notes, created_at, updated_at)
  VALUES (d2, 'arrived', v_hp, 'HP Deutschland GmbH',
    'PO-2026-0049', 'LS-HP-20260413', 'Spedition Dachser', 3,
    CURRENT_DATE::date, NOW() - INTERVAL '2 hours',
    'Anna Schmidt', 'Max Mustermann',
    'HP ProLiant DL380 Gen11 (2×) + Rails-Kit für Rechenzentrum Raum 201',
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '2 hours');

  INSERT INTO packages (id, delivery_id, package_number, status, checklist_json, serial_numbers, photos, created_at)
  VALUES
    (p2a, d2, 1, 'pending', '{}', '[]', '[]', NOW() - INTERVAL '2 hours'),
    (p2b, d2, 2, 'pending', '{}', '[]', '[]', NOW() - INTERVAL '2 hours'),
    (p2c, d2, 3, 'pending', '{}', '[]', '[]', NOW() - INTERVAL '2 hours');


  -- ── Lieferung 3: IN PRÜFUNG ───────────────────────────────────────────────
  -- Lenovo ThinkPad – 2 von 4 Paketen bereits geprüft
  INSERT INTO deliveries (id, status, supplier_id, supplier_name, purchase_order_number,
    delivery_note_number, carrier, number_of_packages, actual_arrival_date,
    assigned_to, created_by, notes, created_at, updated_at)
  VALUES (d3, 'in_inspection', v_lenovo, 'Lenovo GmbH',
    'PO-2026-0047', 'LS-LEN-20260411', 'UPS', 4,
    NOW() - INTERVAL '1 day',
    'Thomas Müller', 'Sandra Weber',
    'ThinkPad X1 Carbon Gen 12 (8×) für Vertriebsteam – KST-2026-Sales',
    NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 hours');

  INSERT INTO packages (id, delivery_id, package_number, status, checklist_json, serial_numbers, photos, notes, inspected_by, inspected_at, created_at)
  VALUES
    (p3a, d3, 1, 'ok',
      '{"packaging_intact":true,"contents_match":true,"serial_numbers_captured":true,"quantity_correct":true,"hardware_undamaged":true,"accessories_complete":true,"seals_intact":true}',
      '["SN-LEN-2026-001","SN-LEN-2026-002"]', '[]',
      'Einwandfreier Zustand', 'Thomas Müller', NOW() - INTERVAL '4 hours',
      NOW() - INTERVAL '1 day'),
    (p3b, d3, 2, 'ok',
      '{"packaging_intact":true,"contents_match":true,"serial_numbers_captured":true,"quantity_correct":true,"hardware_undamaged":true,"accessories_complete":true,"seals_intact":true}',
      '["SN-LEN-2026-003","SN-LEN-2026-004"]', '[]',
      NULL, 'Thomas Müller', NOW() - INTERVAL '3 hours',
      NOW() - INTERVAL '1 day'),
    (p3b || 'x', d3, 3, 'pending', '{}', '[]', '[]', NULL, NULL, NULL, NOW() - INTERVAL '1 day'),
    (p3b || 'y', d3, 4, 'pending', '{}', '[]', '[]', NULL, NULL, NULL, NOW() - INTERVAL '1 day');


  -- ── Lieferung 4: ESKALIERT ────────────────────────────────────────────────
  -- Cisco Switches – Mengendifferenz + 1 beschädigtes Paket
  INSERT INTO deliveries (id, status, supplier_id, supplier_name, purchase_order_number,
    delivery_note_number, carrier, number_of_packages, actual_arrival_date,
    assigned_to, created_by, notes, created_at, updated_at)
  VALUES (d4, 'flagged', v_cisco, 'Cisco Systems GmbH',
    'PO-2026-0044', 'LS-CISCO-20260410', 'FedEx', 2,
    NOW() - INTERVAL '3 days',
    'Sandra Weber', 'Max Mustermann',
    'Cisco Catalyst 9300L Switch (10×) – Netzwerk Neubau Standort Hamburg',
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days');

  INSERT INTO packages (id, delivery_id, package_number, status, checklist_json, serial_numbers, photos, notes, inspected_by, inspected_at, created_at)
  VALUES
    (p4a, d4, 1, 'ok',
      '{"packaging_intact":true,"contents_match":true,"serial_numbers_captured":true,"quantity_correct":true,"hardware_undamaged":true,"accessories_complete":true,"seals_intact":true}',
      '["SN-CSC-2026-001","SN-CSC-2026-002","SN-CSC-2026-003","SN-CSC-2026-004","SN-CSC-2026-005"]',
      '[]', NULL, 'Anna Schmidt', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
    (p4b, d4, 2, 'damaged',
      '{"packaging_intact":false,"contents_match":true,"serial_numbers_captured":false,"quantity_correct":false,"hardware_undamaged":false,"accessories_complete":false,"seals_intact":false}',
      '[]', '[]',
      'Karton stark eingedrückt, 2 Switches fehlen laut Lieferschein. Sichtbare Kratzer an Gehäuse.',
      'Anna Schmidt', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days');

  INSERT INTO discrepancies (id, delivery_id, package_id, type, description, status, assigned_to, created_at, supplier_communication_log)
  VALUES
    (gen_random_uuid()::text, d4, p4b, 'damage',
      'Paket 2: Außenkarton stark beschädigt. 2 Cisco Catalyst 9300L Switches nicht auffindbar. Gehäuse der vorhandenen Geräte weisen Kratzer auf.',
      'in_progress', 'Sandra Weber', NOW() - INTERVAL '3 days',
      '[' || to_char(NOW() - INTERVAL '3 days', 'DD.MM.YYYY HH24:MI') || '] Sandra Weber:' || chr(10) ||
      'Schaden bei Lieferannahme festgestellt. Fotos gemacht, Cisco Vertrieb kontaktiert. Ref: DIFF-2026-07.' || chr(10) || chr(10) ||
      '[' || to_char(NOW() - INTERVAL '1 day', 'DD.MM.YYYY HH24:MI') || '] Sandra Weber:' || chr(10) ||
      'Rückmeldung Cisco: Nachlieferung der 2 fehlenden Geräte in KW16 zugesagt. RMA für beschädigte Einheit wird geprüft.'
    ),
    (gen_random_uuid()::text, d4, NULL, 'quantity',
      'Laut Bestellung 10 Stück bestellt, nur 8 Stück angeliefert. Lieferschein weist ebenfalls nur 8 aus.',
      'in_progress', 'Sandra Weber', NOW() - INTERVAL '3 days',
      '[' || to_char(NOW() - INTERVAL '3 days', 'DD.MM.YYYY HH24:MI') || '] Sandra Weber:' || chr(10) ||
      'Mengendifferenz dokumentiert. Cisco Innendienst informiert.'
    );


  -- ── Lieferung 5: ABGESCHLOSSEN ────────────────────────────────────────────
  -- Dell Workstations – vollständig geprüft und eingebucht
  INSERT INTO deliveries (id, status, supplier_id, supplier_name, purchase_order_number,
    delivery_note_number, carrier, number_of_packages, actual_arrival_date,
    assigned_to, created_by, notes, created_at, updated_at)
  VALUES (d5, 'completed', v_dell, 'Dell Technologies GmbH',
    'PO-2026-0041', 'LS-DELL-20260407', 'DHL', 4,
    NOW() - INTERVAL '6 days',
    'Thomas Müller', 'Sandra Weber',
    'Dell Precision 3680 Workstation (4×) für CAD-Abteilung – Projekt REN-2026',
    NOW() - INTERVAL '8 days', NOW() - INTERVAL '5 days');

  INSERT INTO packages (id, delivery_id, package_number, status, checklist_json, serial_numbers, photos, notes, inspected_by, inspected_at, created_at)
  VALUES
    (p5a, d5, 1, 'ok',
      '{"packaging_intact":true,"contents_match":true,"serial_numbers_captured":true,"quantity_correct":true,"hardware_undamaged":true,"accessories_complete":true,"seals_intact":true}',
      '["SN-DELL-2026-WS-001"]', '[]', NULL, 'Thomas Müller', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),
    (p5b, d5, 2, 'ok',
      '{"packaging_intact":true,"contents_match":true,"serial_numbers_captured":true,"quantity_correct":true,"hardware_undamaged":true,"accessories_complete":true,"seals_intact":true}',
      '["SN-DELL-2026-WS-002"]', '[]', NULL, 'Thomas Müller', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),
    (p5c, d5, 3, 'ok',
      '{"packaging_intact":true,"contents_match":true,"serial_numbers_captured":true,"quantity_correct":true,"hardware_undamaged":true,"accessories_complete":true,"seals_intact":true}',
      '["SN-DELL-2026-WS-003"]', '[]', NULL, 'Thomas Müller', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days'),
    (p5d, d5, 4, 'ok',
      '{"packaging_intact":true,"contents_match":true,"serial_numbers_captured":true,"quantity_correct":true,"hardware_undamaged":true,"accessories_complete":true,"seals_intact":true}',
      '["SN-DELL-2026-WS-004"]', '[]', NULL, 'Thomas Müller', NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days');

  INSERT INTO inventory_items (id, package_id, delivery_id, article_number, description, quantity, serial_number, location, project, cost_center, booked_at, booked_by, created_at)
  VALUES
    (gen_random_uuid()::text, p5a, d5, 'DELL-PRE-3680', 'Dell Precision 3680 Workstation', 1, 'SN-DELL-2026-WS-001', 'Lager A-01', 'REN-2026', 'KST-CAD', NOW() - INTERVAL '5 days', 'Thomas Müller', NOW() - INTERVAL '5 days'),
    (gen_random_uuid()::text, p5b, d5, 'DELL-PRE-3680', 'Dell Precision 3680 Workstation', 1, 'SN-DELL-2026-WS-002', 'Lager A-01', 'REN-2026', 'KST-CAD', NOW() - INTERVAL '5 days', 'Thomas Müller', NOW() - INTERVAL '5 days'),
    (gen_random_uuid()::text, p5c, d5, 'DELL-PRE-3680', 'Dell Precision 3680 Workstation', 1, 'SN-DELL-2026-WS-003', 'Lager A-01', 'REN-2026', 'KST-CAD', NOW() - INTERVAL '5 days', 'Thomas Müller', NOW() - INTERVAL '5 days'),
    (gen_random_uuid()::text, p5d, d5, 'DELL-PRE-3680', 'Dell Precision 3680 Workstation', 1, 'SN-DELL-2026-WS-004', 'IT-Raum 101', 'REN-2026', 'KST-CAD', NOW() - INTERVAL '5 days', 'Thomas Müller', NOW() - INTERVAL '5 days');

  -- Activity-Log
  INSERT INTO activity_log (entity_type, entity_id, action, description, performed_by, created_at) VALUES
    ('delivery', d1, 'created',       'Lieferung von Microsoft Deutschland GmbH angelegt',          'Sandra Weber',  NOW() - INTERVAL '2 days'),
    ('delivery', d2, 'created',       'Lieferung von HP Deutschland GmbH angelegt',                 'Max Mustermann',NOW() - INTERVAL '5 days'),
    ('delivery', d2, 'status_arrived','Wareneingang erfasst — HP Deutschland GmbH',                 'Max Mustermann',NOW() - INTERVAL '2 hours'),
    ('delivery', d3, 'created',       'Lieferung von Lenovo GmbH angelegt',                         'Sandra Weber',  NOW() - INTERVAL '3 days'),
    ('delivery', d3, 'status_arrived','Wareneingang erfasst — Lenovo GmbH',                         'Sandra Weber',  NOW() - INTERVAL '1 day'),
    ('delivery', d3, 'status_in_inspection','Prüfung gestartet',                                    'Thomas Müller', NOW() - INTERVAL '4 hours'),
    ('package',  p3a,'inspection_complete','Inspektion Paket 1 abgeschlossen (ok)',                 'Thomas Müller', NOW() - INTERVAL '4 hours'),
    ('package',  p3b,'inspection_complete','Inspektion Paket 2 abgeschlossen (ok)',                 'Thomas Müller', NOW() - INTERVAL '3 hours'),
    ('delivery', d4, 'created',       'Lieferung von Cisco Systems GmbH angelegt',                  'Max Mustermann',NOW() - INTERVAL '5 days'),
    ('delivery', d4, 'status_arrived','Wareneingang erfasst — Cisco Systems GmbH',                  'Anna Schmidt',  NOW() - INTERVAL '3 days'),
    ('delivery', d4, 'flagged',       'Lieferung wegen Abweichung eskaliert',                       'Anna Schmidt',  NOW() - INTERVAL '3 days'),
    ('delivery', d5, 'created',       'Lieferung von Dell Technologies GmbH angelegt',              'Sandra Weber',  NOW() - INTERVAL '8 days'),
    ('delivery', d5, 'status_arrived','Wareneingang erfasst — Dell Technologies GmbH',              'Thomas Müller', NOW() - INTERVAL '6 days'),
    ('delivery', d5, 'status_in_inspection','Prüfung gestartet',                                    'Thomas Müller', NOW() - INTERVAL '6 days'),
    ('delivery', d5, 'completed',     'Lieferung erfolgreich eingebucht — Dell Technologies GmbH',  'Thomas Müller', NOW() - INTERVAL '5 days');

END $$;
