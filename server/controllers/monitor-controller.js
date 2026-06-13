import { query } from '../db/index.js';
import { pingQueue } from '../queue/index.js';

/**
 * Creates a new monitor
 */
export const createMonitor = async (req, res) => {
  const { name, url, type, interval_minutes, timeout_seconds } = req.body;
  const userId = req.user.id;

  if (!name || !url) {
    return res.status(400).json({ error: 'Monitor name and target URL are required.' });
  }

  try {
    // Validate target URL format
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Invalid protocol');
    }
  } catch (urlErr) {
    return res.status(400).json({ error: 'Invalid target URL format. Must use http:// or https://' });
  }

  const interval = parseInt(interval_minutes || '5', 10);
  const timeout = parseInt(timeout_seconds || '10', 10);

  try {
    const monitorId = crypto.randomUUID();
    const now = new Date();

    const insertRes = await query(
      `INSERT INTO monitors (id, user_id, name, url, type, interval_minutes, timeout_seconds, status, next_check_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'unknown', $8, $9, $10)
       RETURNING *`,
      [monitorId, userId, name, url, type || 'HTTPS', interval, timeout, now, now, now]
    );

    const monitor = insertRes.rows[0];

    // Trigger an immediate check on creation
    await pingQueue.add('ping-check', { monitorId: monitor.id });

    res.status(201).json(monitor);
  } catch (error) {
    console.error('[Monitor Controller] Create monitor error:', error);
    res.status(500).json({ error: 'Failed to create website monitor.' });
  }
};

/**
 * List all monitors belonging to the user
 */
export const listMonitors = async (req, res) => {
  const userId = req.user.id;

  try {
    const listRes = await query(
      `SELECT * FROM monitors 
       WHERE user_id = $1 
       ORDER BY name ASC`,
      [userId]
    );
    res.json(listRes.rows);
  } catch (error) {
    console.error('[Monitor Controller] List monitors error:', error);
    res.status(500).json({ error: 'Failed to fetch monitors.' });
  }
};

/**
 * Fetch a single monitor by ID
 */
export const getMonitor = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const monitorRes = await query(
      'SELECT * FROM monitors WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (monitorRes.rowCount === 0) {
      return res.status(404).json({ error: 'Monitor not found or unauthorized.' });
    }

    res.json(monitorRes.rows[0]);
  } catch (error) {
    console.error('[Monitor Controller] Get monitor error:', error);
    res.status(500).json({ error: 'Failed to fetch monitor details.' });
  }
};

/**
 * Updates a monitor configuration
 */
export const updateMonitor = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { name, url, type, interval_minutes, timeout_seconds, is_active } = req.body;

  try {
    // 1. Verify ownership
    const checkRes = await query('SELECT * FROM monitors WHERE id = $1 AND user_id = $2', [id, userId]);
    if (checkRes.rowCount === 0) {
      return res.status(404).json({ error: 'Monitor not found or unauthorized.' });
    }

    const currentMonitor = checkRes.rows[0];

    // Build values
    const nextName = name || currentMonitor.name;
    let nextUrl = currentMonitor.url;
    if (url) {
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          throw new Error('Invalid protocol');
        }
        nextUrl = url;
      } catch (urlErr) {
        return res.status(400).json({ error: 'Invalid target URL format.' });
      }
    }

    const nextType = type || currentMonitor.type;
    const nextInterval = interval_minutes !== undefined ? parseInt(interval_minutes, 10) : currentMonitor.interval_minutes;
    const nextTimeout = timeout_seconds !== undefined ? parseInt(timeout_seconds, 10) : currentMonitor.timeout_seconds;
    
    let nextActive = currentMonitor.is_active;
    let nextCheck = currentMonitor.next_check_at;
    let nextStatus = currentMonitor.status;
    let nextConsecutiveFailures = currentMonitor.consecutive_failures;

    if (is_active !== undefined) {
      nextActive = !!is_active;
      if (nextActive && !currentMonitor.is_active) {
        // If unpausing, schedule to run immediately
        nextCheck = new Date();
        nextStatus = 'unknown';
        nextConsecutiveFailures = 0;
      }
    }

    const now = new Date();
    const updateRes = await query(
      `UPDATE monitors 
       SET name = $1, url = $2, type = $3, interval_minutes = $4, timeout_seconds = $5, 
           is_active = $6, next_check_at = $7, status = $8, consecutive_failures = $9, updated_at = $10
       WHERE id = $11 AND user_id = $12
       RETURNING *`,
      [nextName, nextUrl, nextType, nextInterval, nextTimeout, nextActive, nextCheck, nextStatus, nextConsecutiveFailures, now, id, userId]
    );

    const updatedMonitor = updateRes.rows[0];

    // Trigger check immediately if unpaused
    if (is_active && !currentMonitor.is_active) {
      await pingQueue.add('ping-check', { monitorId: id });
    }

    res.json(updatedMonitor);
  } catch (error) {
    console.error('[Monitor Controller] Update monitor error:', error);
    res.status(500).json({ error: 'Failed to update website monitor configuration.' });
  }
};

/**
 * Delete a monitor
 */
export const deleteMonitor = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const deleteRes = await query(
      'DELETE FROM monitors WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (deleteRes.rowCount === 0) {
      return res.status(404).json({ error: 'Monitor not found or unauthorized.' });
    }

    res.json({ message: 'Monitor successfully deleted.', id });
  } catch (error) {
    console.error('[Monitor Controller] Delete monitor error:', error);
    res.status(500).json({ error: 'Failed to delete website monitor.' });
  }
};

/**
 * Retrieve statistics and uptime history logs for a monitor
 */
export const getMonitorStats = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // 1. Verify monitor exists and belongs to user
    const checkRes = await query('SELECT id FROM monitors WHERE id = $1 AND user_id = $2', [id, userId]);
    if (checkRes.rowCount === 0) {
      return res.status(404).json({ error: 'Monitor not found or unauthorized.' });
    }

    // 2. Fetch last 24 hours of hourly performance stats (to plot response time curves)
    const hourlyRes = await query(
      `SELECT hour, avg_response_time_ms, ping_count, up_count 
       FROM hourly_stats 
       WHERE monitor_id = $1 AND hour >= NOW() - INTERVAL '24 hours' 
       ORDER BY hour ASC`,
      [id]
    );

    // 3. Fetch last 30 days of daily aggregates (to compute uptime bars)
    const dailyRes = await query(
      `SELECT 
         DATE_TRUNC('day', hour) as date, 
         SUM(ping_count)::integer as total_pings, 
         SUM(up_count)::integer as total_up, 
         AVG(avg_response_time_ms)::double precision as avg_latency
       FROM hourly_stats 
       WHERE monitor_id = $1 AND hour >= NOW() - INTERVAL '30 days' 
       GROUP BY DATE_TRUNC('day', hour) 
       ORDER BY date ASC`,
      [id]
    );

    // 4. Calculate overall statistics (Uptime and average response time)
    const summaryRes = await query(
      `SELECT 
         COALESCE(SUM(ping_count), 0)::integer as total_pings,
         COALESCE(SUM(up_count), 0)::integer as total_up,
         COALESCE(AVG(avg_response_time_ms), 0.0)::double precision as avg_latency
       FROM hourly_stats 
       WHERE monitor_id = $1 AND hour >= NOW() - INTERVAL '30 days'`,
      [id]
    );

    const summary = summaryRes.rows[0];
    const totalPings = summary.total_pings;
    const totalUp = summary.total_up;
    const uptimePercentage = totalPings > 0 ? (totalUp / totalPings) * 100 : 100.0;

    res.json({
      uptimePercentage: parseFloat(uptimePercentage.toFixed(3)),
      avgResponseTimeMs: Math.round(summary.avg_latency),
      hourlyHistory: hourlyRes.rows.map(row => ({
        hour: row.hour,
        avgResponseTimeMs: Math.round(row.avg_response_time_ms),
        uptime: row.ping_count > 0 ? (row.up_count / row.ping_count) * 100 : 100
      })),
      dailyHistory: dailyRes.rows.map(row => ({
        date: row.date,
        totalPings: row.total_pings,
        totalUp: row.total_up,
        uptime: row.total_pings > 0 ? (row.total_up / row.total_pings) * 100 : 100,
        avgResponseTimeMs: Math.round(row.avg_latency)
      }))
    });

  } catch (error) {
    console.error('[Monitor Controller] Get monitor stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve monitor statistics.' });
  }
};

/**
 * Fetch incident list for a specific monitor
 */
export const getMonitorIncidents = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    // 1. Verify owner
    const checkRes = await query('SELECT id FROM monitors WHERE id = $1 AND user_id = $2', [id, userId]);
    if (checkRes.rowCount === 0) {
      return res.status(404).json({ error: 'Monitor not found or unauthorized.' });
    }

    const incidentsRes = await query(
      `SELECT * FROM incidents 
       WHERE monitor_id = $1 
       ORDER BY started_at DESC 
       LIMIT 50`,
      [id]
    );

    res.json(incidentsRes.rows);
  } catch (error) {
    console.error('[Monitor Controller] Get incidents error:', error);
    res.status(500).json({ error: 'Failed to retrieve monitor incidents.' });
  }
};

/**
 * List all global incidents across the user's monitors
 */
export const listAllIncidents = async (req, res) => {
  const userId = req.user.id;

  try {
    const listRes = await query(
      `SELECT i.*, m.name as monitor_name, m.url as monitor_url
       FROM incidents i
       JOIN monitors m ON i.monitor_id = m.id
       WHERE m.user_id = $1
       ORDER BY i.started_at DESC
       LIMIT 100`,
      [userId]
    );

    res.json(listRes.rows);
  } catch (error) {
    console.error('[Monitor Controller] List all incidents error:', error);
    res.status(500).json({ error: 'Failed to fetch global incident logs.' });
  }
};

/**
 * List email logs for user monitors
 */
export const listEmailLogs = async (req, res) => {
  const userId = req.user.id;

  try {
    const logsRes = await query(
      `SELECT el.*, m.name as monitor_name 
       FROM email_logs el
       JOIN monitors m ON el.monitor_id = m.id
       WHERE m.user_id = $1
       ORDER BY el.sent_at DESC
       LIMIT 50`,
      [userId]
    );
    res.json(logsRes.rows);
  } catch (error) {
    console.error('[Monitor Controller] List email logs error:', error);
    res.status(500).json({ error: 'Failed to fetch notification email logs.' });
  }
};
