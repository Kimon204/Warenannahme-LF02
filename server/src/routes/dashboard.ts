import { Router } from 'express';
import { db } from '../db/database';

const router = Router();

router.get('/', (_req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const deliveriesToday = (db.prepare(
      `SELECT COUNT(*) as c FROM deliveries WHERE date(actual_arrival_date) = ? OR date(created_at) = ?`
    ).get(today, today) as { c: number }).c;

    const openInspections = (db.prepare(
      `SELECT COUNT(*) as c FROM deliveries WHERE status IN ('arrived', 'in_inspection')`
    ).get() as { c: number }).c;

    const flaggedItems = (db.prepare(
      `SELECT COUNT(*) as c FROM deliveries WHERE status = 'flagged'`
    ).get() as { c: number }).c;

    const pendingReturns = (db.prepare(
      `SELECT COUNT(*) as c FROM deliveries WHERE status = 'returned'`
    ).get() as { c: number }).c;

    const openDiscrepancies = (db.prepare(
      `SELECT COUNT(*) as c FROM discrepancies WHERE status != 'resolved'`
    ).get() as { c: number }).c;

    const pipeline = db.prepare(
      `SELECT status, COUNT(*) as count FROM deliveries GROUP BY status`
    ).all() as { status: string; count: number }[];

    const pipelineMap: Record<string, number> = {
      expected: 0, arrived: 0, in_inspection: 0, completed: 0, flagged: 0, returned: 0
    };
    pipeline.forEach(p => { pipelineMap[p.status] = p.count; });

    const recentActivity = db.prepare(
      `SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 20`
    ).all();

    res.json({
      deliveries_today: deliveriesToday,
      open_inspections: openInspections,
      flagged_items: flaggedItems,
      pending_returns: pendingReturns,
      open_discrepancies: openDiscrepancies,
      pipeline: pipelineMap,
      recent_activity: recentActivity,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
