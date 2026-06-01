import { Router } from 'express';
import {
  createMonitor,
  listMonitors,
  getMonitor,
  updateMonitor,
  deleteMonitor,
  getMonitorStats,
  getMonitorIncidents,
  listAllIncidents,
  listEmailLogs
} from '../controllers/monitor-controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Protect all routes with auth middleware
router.use(authMiddleware);

router.post('/', createMonitor);
router.get('/', listMonitors);
router.get('/incidents', listAllIncidents);
router.get('/email-logs', listEmailLogs);
router.get('/:id', getMonitor);
router.put('/:id', updateMonitor);
router.delete('/:id', deleteMonitor);
router.get('/:id/stats', getMonitorStats);
router.get('/:id/incidents', getMonitorIncidents);

export default router;
