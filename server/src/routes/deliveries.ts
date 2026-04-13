import { Router, Request, Response } from 'express';
import { db, uuidv4, logActivity } from '../db/database';

const router = Router();

// List deliveries with optional filters
router.get('/', (req: Request, res: Response) => {
  try {
    const { status, supplier, from, to, assigned_to } = req.query;
    let query = `SELECT * FROM deliveries WHERE 1=1`;
    const params: unknown[] = [];

    if (status) { query += ` AND status = ?`; params.push(status); }
    if (supplier) { query += ` AND (supplier_name LIKE ? OR supplier_id = ?)`; params.push(`%${supplier}%`, supplier); }
    if (from) { query += ` AND date(created_at) >= ?`; params.push(from); }
    if (to) { query += ` AND date(created_at) <= ?`; params.push(to); }
    if (assigned_to) { query += ` AND assigned_to = ?`; params.push(assigned_to); }

    query += ` ORDER BY created_at DESC`;
    const deliveries = db.prepare(query).all(...params);
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Get single delivery with packages, inventory, discrepancies
router.get('/:id', (req: Request, res: Response) => {
  try {
    const delivery = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Lieferung nicht gefunden' });

    const packages = db.prepare('SELECT * FROM packages WHERE delivery_id = ? ORDER BY package_number').all(req.params.id);
    const parsedPackages = (packages as Record<string, unknown>[]).map(p => ({
      ...p,
      checklist_json: JSON.parse((p.checklist_json as string) || '{}'),
      serial_numbers: JSON.parse((p.serial_numbers as string) || '[]'),
      photos: JSON.parse((p.photos as string) || '[]'),
    }));

    const inventory = db.prepare('SELECT * FROM inventory_items WHERE delivery_id = ? ORDER BY created_at').all(req.params.id);
    const discrepancies = db.prepare('SELECT * FROM discrepancies WHERE delivery_id = ? ORDER BY created_at DESC').all(req.params.id);

    res.json({ ...delivery as object, packages: parsedPackages, inventory, discrepancies });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Create new delivery (Lieferankündigung)
router.post('/', (req: Request, res: Response) => {
  try {
    const {
      supplier_id, supplier_name, purchase_order_number, delivery_note_number,
      carrier, number_of_packages, expected_date, assigned_to, notes, created_by, status
    } = req.body;

    if (!supplier_name) return res.status(400).json({ error: 'Lieferantenname ist erforderlich' });

    const id = uuidv4();
    const now = new Date().toISOString();
    const deliveryStatus = status || 'expected';

    db.prepare(`
      INSERT INTO deliveries (id, status, supplier_id, supplier_name, purchase_order_number,
        delivery_note_number, carrier, number_of_packages, expected_date, assigned_to, notes, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, deliveryStatus, supplier_id || null, supplier_name, purchase_order_number || null,
      delivery_note_number || null, carrier || null, number_of_packages || 0,
      expected_date || null, assigned_to || null, notes || null, created_by || null, now, now);

    // Auto-create packages if count is given
    if (number_of_packages && number_of_packages > 0) {
      const insPackage = db.prepare(`
        INSERT INTO packages (id, delivery_id, package_number, status, created_at)
        VALUES (?, ?, ?, 'pending', ?)
      `);
      for (let i = 1; i <= number_of_packages; i++) {
        insPackage.run(uuidv4(), id, i, now);
      }
    }

    logActivity('delivery', id, 'created', `Lieferung von ${supplier_name} angelegt`, created_by);

    const delivery = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(id);
    res.status(201).json(delivery);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Update delivery
router.put('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ error: 'Lieferung nicht gefunden' });
    if (existing.status === 'completed') return res.status(403).json({ error: 'Abgeschlossene Lieferungen sind schreibgeschützt' });

    const {
      supplier_id, supplier_name, purchase_order_number, delivery_note_number,
      carrier, number_of_packages, expected_date, actual_arrival_date,
      assigned_to, notes, created_by
    } = req.body;

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE deliveries SET
        supplier_id = ?, supplier_name = ?, purchase_order_number = ?, delivery_note_number = ?,
        carrier = ?, number_of_packages = ?, expected_date = ?, actual_arrival_date = ?,
        assigned_to = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).run(
      supplier_id ?? existing.supplier_id, supplier_name ?? existing.supplier_name,
      purchase_order_number ?? existing.purchase_order_number, delivery_note_number ?? existing.delivery_note_number,
      carrier ?? existing.carrier, number_of_packages ?? existing.number_of_packages,
      expected_date ?? existing.expected_date, actual_arrival_date ?? existing.actual_arrival_date,
      assigned_to ?? existing.assigned_to, notes ?? existing.notes,
      now, req.params.id
    );

    logActivity('delivery', req.params.id, 'updated', 'Lieferungsdaten aktualisiert', created_by);
    res.json(db.prepare('SELECT * FROM deliveries WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Update delivery status
router.put('/:id/status', (req: Request, res: Response) => {
  try {
    const { status, performed_by, actual_arrival_date, delivery_note_number, carrier, number_of_packages } = req.body;
    const validStatuses = ['expected', 'arrived', 'in_inspection', 'completed', 'flagged', 'returned'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Ungültiger Status' });

    const existing = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ error: 'Lieferung nicht gefunden' });

    const now = new Date().toISOString();
    let updateQuery = `UPDATE deliveries SET status = ?, updated_at = ?`;
    const params: unknown[] = [status, now];

    if (status === 'arrived') {
      updateQuery += `, actual_arrival_date = ?`;
      params.push(actual_arrival_date || now);
      if (delivery_note_number) { updateQuery += `, delivery_note_number = ?`; params.push(delivery_note_number); }
      if (carrier) { updateQuery += `, carrier = ?`; params.push(carrier); }
      if (number_of_packages) { updateQuery += `, number_of_packages = ?`; params.push(number_of_packages); }
    }

    updateQuery += ` WHERE id = ?`;
    params.push(req.params.id);
    db.prepare(updateQuery).run(...params);

    // When arriving, adjust packages count if changed
    if (status === 'arrived' && number_of_packages) {
      const existingPackageCount = (db.prepare('SELECT COUNT(*) as c FROM packages WHERE delivery_id = ?').get(req.params.id) as { c: number }).c;
      if (existingPackageCount < number_of_packages) {
        const insPackage = db.prepare(`INSERT INTO packages (id, delivery_id, package_number, status, created_at) VALUES (?, ?, ?, 'pending', ?)`);
        for (let i = existingPackageCount + 1; i <= number_of_packages; i++) {
          insPackage.run(uuidv4(), req.params.id, i, now);
        }
      }
    }

    const statusLabels: Record<string, string> = {
      arrived: 'Wareneingang erfasst',
      in_inspection: 'Prüfung gestartet',
      completed: 'Abgeschlossen',
      flagged: 'Eskaliert (Reklamation)',
      returned: 'Retoure eingeleitet',
    };

    logActivity('delivery', req.params.id, `status_${status}`,
      statusLabels[status] || `Status geändert zu ${status}`, performed_by);

    res.json(db.prepare('SELECT * FROM deliveries WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Delete delivery
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ error: 'Lieferung nicht gefunden' });
    if (existing.status === 'completed') return res.status(403).json({ error: 'Abgeschlossene Lieferungen können nicht gelöscht werden' });

    db.prepare('DELETE FROM deliveries WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
