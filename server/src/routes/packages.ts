import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db, uuidv4, logActivity } from '../db/database';

const router = Router();

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype));
  },
});

// Get all packages for a delivery
router.get('/delivery/:deliveryId', (req: Request, res: Response) => {
  try {
    const packages = db.prepare('SELECT * FROM packages WHERE delivery_id = ? ORDER BY package_number').all(req.params.deliveryId);
    const parsed = (packages as Record<string, unknown>[]).map(p => ({
      ...p,
      checklist_json: JSON.parse((p.checklist_json as string) || '{}'),
      serial_numbers: JSON.parse((p.serial_numbers as string) || '[]'),
      photos: JSON.parse((p.photos as string) || '[]'),
    }));
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Get single package
router.get('/:id', (req: Request, res: Response) => {
  try {
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!pkg) return res.status(404).json({ error: 'Paket nicht gefunden' });
    res.json({
      ...pkg,
      checklist_json: JSON.parse((pkg.checklist_json as string) || '{}'),
      serial_numbers: JSON.parse((pkg.serial_numbers as string) || '[]'),
      photos: JSON.parse((pkg.photos as string) || '[]'),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Update package (checklist, serial numbers, notes, status)
router.put('/:id', (req: Request, res: Response) => {
  try {
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!pkg) return res.status(404).json({ error: 'Paket nicht gefunden' });

    const { status, checklist_json, serial_numbers, notes, inspected_by } = req.body;

    const existingChecklist = JSON.parse((pkg.checklist_json as string) || '{}');
    const newChecklist = checklist_json ? { ...existingChecklist, ...checklist_json } : existingChecklist;

    const existingSerials = JSON.parse((pkg.serial_numbers as string) || '[]');
    const newSerials = serial_numbers ?? existingSerials;

    const newStatus = status ?? pkg.status;
    const inspectedAt = (newStatus === 'ok' || newStatus === 'damaged') && !pkg.inspected_at
      ? new Date().toISOString()
      : pkg.inspected_at;

    db.prepare(`
      UPDATE packages SET
        status = ?, checklist_json = ?, serial_numbers = ?,
        notes = ?, inspected_by = ?, inspected_at = ?
      WHERE id = ?
    `).run(
      newStatus,
      JSON.stringify(newChecklist),
      JSON.stringify(newSerials),
      notes ?? pkg.notes,
      inspected_by ?? pkg.inspected_by,
      inspectedAt,
      req.params.id
    );

    // Check if any package in delivery is damaged → flag delivery
    if (newStatus === 'damaged') {
      db.prepare(`UPDATE deliveries SET status = 'flagged', updated_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), pkg.delivery_id);
      logActivity('delivery', pkg.delivery_id as string, 'flagged',
        `Paket ${pkg.package_number} als beschädigt markiert`, inspected_by);
    }

    // Check if delivery status should advance to in_inspection
    const delivery = db.prepare('SELECT * FROM deliveries WHERE id = ?').get(pkg.delivery_id) as Record<string, unknown>;
    if (delivery.status === 'arrived') {
      db.prepare(`UPDATE deliveries SET status = 'in_inspection', updated_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), pkg.delivery_id);
    }

    logActivity('package', req.params.id, 'updated', `Paket ${pkg.package_number} aktualisiert`, inspected_by);

    const updated = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json({
      ...updated,
      checklist_json: JSON.parse((updated.checklist_json as string) || '{}'),
      serial_numbers: JSON.parse((updated.serial_numbers as string) || '[]'),
      photos: JSON.parse((updated.photos as string) || '[]'),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Complete package inspection
router.post('/:id/complete', (req: Request, res: Response) => {
  try {
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!pkg) return res.status(404).json({ error: 'Paket nicht gefunden' });

    const { inspected_by, status } = req.body;
    const finalStatus = status || 'ok';
    const now = new Date().toISOString();

    db.prepare(`UPDATE packages SET status = ?, inspected_by = ?, inspected_at = ? WHERE id = ?`)
      .run(finalStatus, inspected_by, now, req.params.id);

    // Check if all packages in delivery are done
    const allPackages = db.prepare('SELECT status FROM packages WHERE delivery_id = ?').all(pkg.delivery_id) as { status: string }[];
    const allDone = allPackages.every(p => p.status === 'ok' || p.status === 'damaged' || p.status === 'discrepancy');
    const anyDamaged = allPackages.some(p => p.status === 'damaged');

    if (allDone) {
      const newDeliveryStatus = anyDamaged ? 'flagged' : 'in_inspection';
      db.prepare(`UPDATE deliveries SET status = ?, updated_at = ? WHERE id = ?`)
        .run(newDeliveryStatus, now, pkg.delivery_id);
    }

    logActivity('package', req.params.id, 'inspection_complete',
      `Inspektion Paket ${pkg.package_number} abgeschlossen (${finalStatus})`, inspected_by);

    const updated = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json({
      ...updated,
      checklist_json: JSON.parse((updated.checklist_json as string) || '{}'),
      serial_numbers: JSON.parse((updated.serial_numbers as string) || '[]'),
      photos: JSON.parse((updated.photos as string) || '[]'),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Upload photo for package
router.post('/:id/photos', upload.array('photos', 10), (req: Request, res: Response) => {
  try {
    const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
    if (!pkg) return res.status(404).json({ error: 'Paket nicht gefunden' });

    const existingPhotos: string[] = JSON.parse((pkg.photos as string) || '[]');
    const newPhotos = (req.files as Express.Multer.File[]).map(f => `/uploads/${f.filename}`);
    const allPhotos = [...existingPhotos, ...newPhotos];

    db.prepare('UPDATE packages SET photos = ? WHERE id = ?').run(JSON.stringify(allPhotos), req.params.id);
    logActivity('package', req.params.id, 'photos_added', `${newPhotos.length} Foto(s) hochgeladen`, req.body.uploaded_by);

    res.json({ photos: allPhotos });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
