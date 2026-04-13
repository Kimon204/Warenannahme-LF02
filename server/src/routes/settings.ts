import { Router, Request, Response } from 'express';
import { db, uuidv4 } from '../db/database';

const router = Router();

// ── Suppliers ──────────────────────────────────────────────────────────────
router.get('/suppliers', (_req, res) => {
  res.json(db.prepare('SELECT * FROM suppliers ORDER BY name').all());
});

router.post('/suppliers', (req: Request, res: Response) => {
  const { name, contact_email, contact_phone, address } = req.body;
  if (!name) return res.status(400).json({ error: 'Name ist erforderlich' });
  const id = uuidv4();
  db.prepare('INSERT INTO suppliers (id, name, contact_email, contact_phone, address) VALUES (?, ?, ?, ?, ?)')
    .run(id, name, contact_email || null, contact_phone || null, address || null);
  res.status(201).json(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id));
});

router.put('/suppliers/:id', (req: Request, res: Response) => {
  const { name, contact_email, contact_phone, address } = req.body;
  db.prepare('UPDATE suppliers SET name = ?, contact_email = ?, contact_phone = ?, address = ? WHERE id = ?')
    .run(name, contact_email || null, contact_phone || null, address || null, req.params.id);
  res.json(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id));
});

router.delete('/suppliers/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Employees ──────────────────────────────────────────────────────────────
router.get('/employees', (_req, res) => {
  res.json(db.prepare('SELECT * FROM employees ORDER BY name').all());
});

router.post('/employees', (req: Request, res: Response) => {
  const { name, email, role } = req.body;
  if (!name) return res.status(400).json({ error: 'Name ist erforderlich' });
  const id = uuidv4();
  db.prepare('INSERT INTO employees (id, name, email, role) VALUES (?, ?, ?, ?)')
    .run(id, name, email || null, role || 'Prüfer');
  res.status(201).json(db.prepare('SELECT * FROM employees WHERE id = ?').get(id));
});

router.put('/employees/:id', (req: Request, res: Response) => {
  const { name, email, role } = req.body;
  db.prepare('UPDATE employees SET name = ?, email = ?, role = ? WHERE id = ?')
    .run(name, email || null, role || null, req.params.id);
  res.json(db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id));
});

router.delete('/employees/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── Locations ──────────────────────────────────────────────────────────────
router.get('/locations', (_req, res) => {
  res.json(db.prepare('SELECT * FROM stock_locations ORDER BY name').all());
});

router.post('/locations', (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name ist erforderlich' });
  const id = uuidv4();
  db.prepare('INSERT INTO stock_locations (id, name, description) VALUES (?, ?, ?)')
    .run(id, name, description || null);
  res.status(201).json(db.prepare('SELECT * FROM stock_locations WHERE id = ?').get(id));
});

router.put('/locations/:id', (req: Request, res: Response) => {
  const { name, description } = req.body;
  db.prepare('UPDATE stock_locations SET name = ?, description = ? WHERE id = ?')
    .run(name, description || null, req.params.id);
  res.json(db.prepare('SELECT * FROM stock_locations WHERE id = ?').get(req.params.id));
});

router.delete('/locations/:id', (req: Request, res: Response) => {
  db.prepare('DELETE FROM stock_locations WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ── App Settings ───────────────────────────────────────────────────────────
router.get('/app', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

router.put('/app', (req: Request, res: Response) => {
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const updateMany = db.transaction((data: Record<string, string>) => {
    for (const [key, value] of Object.entries(data)) {
      upsert.run(key, value);
    }
  });
  updateMany(req.body as Record<string, string>);
  res.json({ success: true });
});

export default router;
