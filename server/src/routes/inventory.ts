import { Router, Request, Response } from 'express';
import { db, uuidv4, logActivity } from '../db/database';

const router = Router();

// List inventory items
router.get('/', (req: Request, res: Response) => {
  try {
    const { delivery_id, project, location } = req.query;
    let query = `SELECT i.*, d.supplier_name, d.delivery_note_number FROM inventory_items i
                 LEFT JOIN deliveries d ON d.id = i.delivery_id WHERE 1=1`;
    const params: unknown[] = [];

    if (delivery_id) { query += ` AND i.delivery_id = ?`; params.push(delivery_id); }
    if (project) { query += ` AND i.project LIKE ?`; params.push(`%${project}%`); }
    if (location) { query += ` AND i.location = ?`; params.push(location); }

    query += ` ORDER BY i.created_at DESC`;
    res.json(db.prepare(query).all(...params));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Book items into inventory (single or batch)
router.post('/', (req: Request, res: Response) => {
  try {
    const { items, delivery_id, booked_by } = req.body;
    if (!items || !Array.isArray(items) || !delivery_id) {
      return res.status(400).json({ error: 'items[] und delivery_id sind erforderlich' });
    }

    const delivery = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(delivery_id) as Record<string, unknown> | undefined;
    if (!delivery) return res.status(404).json({ error: 'Lieferung nicht gefunden' });

    const now = new Date().toISOString();
    const inserted: unknown[] = [];

    const ins = db.prepare(`
      INSERT INTO inventory_items (id, package_id, delivery_id, article_number, description,
        quantity, serial_number, location, project, cost_center, booked_at, booked_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items: Record<string, unknown>[]) => {
      for (const item of items) {
        // Check for duplicate serial number
        if (item.serial_number) {
          const dup = db.prepare('SELECT id FROM inventory_items WHERE serial_number = ?').get(item.serial_number);
          if (dup) throw new Error(`Seriennummer ${item.serial_number} bereits im Bestand vorhanden`);
        }
        const id = uuidv4();
        ins.run(
          id, item.package_id || null, delivery_id,
          item.article_number || null, item.description,
          item.quantity || 1, item.serial_number || null,
          item.location || null, item.project || null,
          item.cost_center || null, now, booked_by || null, now
        );
        inserted.push({ id, ...item });
      }
    });

    insertMany(items as Record<string, unknown>[]);

    // Mark delivery as completed if all packages inspected
    const packages = db.prepare('SELECT status FROM packages WHERE delivery_id = ?').all(delivery_id) as { status: string }[];
    const allDone = packages.length > 0 && packages.every(p => p.status === 'ok' || p.status === 'damaged' || p.status === 'discrepancy');
    const anyDamaged = packages.some(p => p.status === 'damaged');

    if (allDone && !anyDamaged && delivery.status !== 'completed') {
      db.prepare(`UPDATE deliveries SET status = 'completed', updated_at = ? WHERE id = ?`).run(now, delivery_id);
      logActivity('delivery', delivery_id, 'completed', 'Lieferung erfolgreich eingebucht', booked_by);
    }

    logActivity('inventory', delivery_id, 'booked', `${inserted.length} Artikel eingebucht`, booked_by);
    res.status(201).json({ booked: inserted.length, items: inserted });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Update inventory item
router.put('/:id', (req: Request, res: Response) => {
  try {
    const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Artikel nicht gefunden' });

    const { description, quantity, location, project, cost_center, serial_number, article_number } = req.body;
    db.prepare(`
      UPDATE inventory_items SET description = ?, quantity = ?, location = ?,
        project = ?, cost_center = ?, serial_number = ?, article_number = ? WHERE id = ?
    `).run(description, quantity, location, project, cost_center, serial_number, article_number, req.params.id);

    res.json(db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Delete inventory item
router.delete('/:id', (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM inventory_items WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
