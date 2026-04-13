import { Router, Request, Response } from 'express';
import { db, uuidv4, logActivity } from '../db/database';

const router = Router();

// List discrepancies
router.get('/', (req: Request, res: Response) => {
  try {
    const { status, type, delivery_id, assigned_to } = req.query;
    let query = `SELECT d.*, del.supplier_name, del.delivery_note_number
                 FROM discrepancies d LEFT JOIN deliveries del ON del.id = d.delivery_id WHERE 1=1`;
    const params: unknown[] = [];

    if (status) { query += ` AND d.status = ?`; params.push(status); }
    if (type) { query += ` AND d.type = ?`; params.push(type); }
    if (delivery_id) { query += ` AND d.delivery_id = ?`; params.push(delivery_id); }
    if (assigned_to) { query += ` AND d.assigned_to = ?`; params.push(assigned_to); }

    query += ` ORDER BY d.created_at DESC`;
    res.json(db.prepare(query).all(...params));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Get single discrepancy
router.get('/:id', (req: Request, res: Response) => {
  try {
    const disc = db.prepare(`
      SELECT d.*, del.supplier_name, del.delivery_note_number, del.purchase_order_number
      FROM discrepancies d LEFT JOIN deliveries del ON del.id = d.delivery_id
      WHERE d.id = ?
    `).get(req.params.id);
    if (!disc) return res.status(404).json({ error: 'Abweichung nicht gefunden' });
    res.json(disc);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Create discrepancy
router.post('/', (req: Request, res: Response) => {
  try {
    const { delivery_id, package_id, type, description, assigned_to, created_by } = req.body;
    if (!delivery_id || !type || !description) {
      return res.status(400).json({ error: 'delivery_id, type und description sind erforderlich' });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO discrepancies (id, delivery_id, package_id, type, description, status, assigned_to, created_at)
      VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
    `).run(id, delivery_id, package_id || null, type, description, assigned_to || null, now);

    // Flag the delivery
    db.prepare(`UPDATE deliveries SET status = 'flagged', updated_at = ? WHERE id = ?`).run(now, delivery_id);

    // Flag the package if specified
    if (package_id) {
      db.prepare(`UPDATE packages SET status = 'discrepancy' WHERE id = ?`).run(package_id);
    }

    logActivity('discrepancy', id, 'created', `Abweichung gemeldet: ${type} — ${description.slice(0, 60)}`, created_by);
    logActivity('delivery', delivery_id, 'flagged', 'Lieferung wegen Abweichung eskaliert', created_by);

    res.status(201).json(db.prepare('SELECT * FROM discrepancies WHERE id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Update discrepancy
router.put('/:id', (req: Request, res: Response) => {
  try {
    const disc = db.prepare('SELECT * FROM discrepancies WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!disc) return res.status(404).json({ error: 'Abweichung nicht gefunden' });

    const { status, assigned_to, description, supplier_communication_log, performed_by } = req.body;
    const now = new Date().toISOString();
    const resolvedAt = status === 'resolved' ? now : (disc.resolved_at as string | null);

    db.prepare(`
      UPDATE discrepancies SET
        status = ?, assigned_to = ?, description = ?,
        supplier_communication_log = ?, resolved_at = ?
      WHERE id = ?
    `).run(
      status ?? disc.status,
      assigned_to ?? disc.assigned_to,
      description ?? disc.description,
      supplier_communication_log ?? disc.supplier_communication_log,
      resolvedAt,
      req.params.id
    );

    if (status === 'resolved') {
      logActivity('discrepancy', req.params.id, 'resolved', 'Abweichung als gelöst markiert', performed_by);
    } else {
      logActivity('discrepancy', req.params.id, 'updated', 'Abweichung aktualisiert', performed_by);
    }

    res.json(db.prepare('SELECT * FROM discrepancies WHERE id = ?').get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Append to communication log
router.post('/:id/log', (req: Request, res: Response) => {
  try {
    const disc = db.prepare('SELECT * FROM discrepancies WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!disc) return res.status(404).json({ error: 'Abweichung nicht gefunden' });

    const { entry, performed_by } = req.body;
    const timestamp = new Date().toLocaleString('de-DE');
    const existingLog = (disc.supplier_communication_log as string) || '';
    const newLog = existingLog
      ? `${existingLog}\n\n[${timestamp}] ${performed_by || 'System'}:\n${entry}`
      : `[${timestamp}] ${performed_by || 'System'}:\n${entry}`;

    db.prepare('UPDATE discrepancies SET supplier_communication_log = ? WHERE id = ?').run(newLog, req.params.id);
    logActivity('discrepancy', req.params.id, 'log_entry', 'Kommunikationseintrag hinzugefügt', performed_by);

    res.json({ supplier_communication_log: newLog });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
