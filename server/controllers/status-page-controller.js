import { query } from '../db/index.js';

/**
 * Helper to update junction table mappings for status page monitors
 */
const updateStatusPageMonitors = async (statusPageId, monitorIds) => {
  // 1. Delete all existing mappings
  await query('DELETE FROM status_page_monitors WHERE status_page_id = $1', [statusPageId]);

  if (!monitorIds || monitorIds.length === 0) return;

  // 2. Insert new mappings
  for (const monitorId of monitorIds) {
    await query(
      `INSERT INTO status_page_monitors (status_page_id, monitor_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [statusPageId, monitorId]
    );
  }
};

/**
 * Create a new status page config
 */
export const createStatusPage = async (req, res) => {
  const { title, slug, description, logo_url, theme, monitor_ids } = req.body;
  const userId = req.user.id;

  if (!title || !slug) {
    return res.status(400).json({ error: 'Title and custom slug are required.' });
  }

  // Format slug
  const formattedSlug = slug.toLowerCase().replace(/[^a-z0-9-_]/g, '-');

  try {
    // Check if slug is already taken
    const slugCheck = await query('SELECT id FROM status_pages WHERE slug = $1', [formattedSlug]);
    if (slugCheck.rowCount > 0) {
      return res.status(409).json({ error: 'This status page slug is already taken.' });
    }

    const statusPageId = crypto.randomUUID();

    // Insert status page
    const insertRes = await query(
      `INSERT INTO status_pages (id, user_id, slug, title, description, logo_url, theme, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [statusPageId, userId, formattedSlug, title, description || '', logo_url || '', theme || 'dark']
    );

    const statusPage = insertRes.rows[0];

    // Associate monitors in junction table
    await updateStatusPageMonitors(statusPageId, monitor_ids);

    res.status(201).json({ ...statusPage, monitor_ids: monitor_ids || [] });
  } catch (error) {
    console.error('[Status Page Controller] Create error:', error);
    res.status(500).json({ error: 'Failed to create status page.' });
  }
};

/**
 * List all status pages belonging to the user
 */
export const listStatusPages = async (req, res) => {
  const userId = req.user.id;

  try {
    const listRes = await query(
      `SELECT sp.*, COALESCE(
         (SELECT ARRAY_AGG(monitor_id) FROM status_page_monitors WHERE status_page_id = sp.id), 
         '{}'
       ) as monitor_ids
       FROM status_pages sp 
       WHERE sp.user_id = $1 
       ORDER BY sp.title ASC`,
      [userId]
    );
    res.json(listRes.rows);
  } catch (error) {
    console.error('[Status Page Controller] List error:', error);
    res.status(500).json({ error: 'Failed to fetch status pages.' });
  }
};

/**
 * Get a single status page details
 */
export const getStatusPage = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const pageRes = await query(
      'SELECT * FROM status_pages WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (pageRes.rowCount === 0) {
      return res.status(404).json({ error: 'Status page not found or unauthorized.' });
    }

    const page = pageRes.rows[0];

    // Fetch monitor associations
    const monitorsRes = await query(
      'SELECT monitor_id FROM status_page_monitors WHERE status_page_id = $1',
      [id]
    );

    res.json({
      ...page,
      monitor_ids: monitorsRes.rows.map(r => r.monitor_id)
    });
  } catch (error) {
    console.error('[Status Page Controller] Get error:', error);
    res.status(500).json({ error: 'Failed to fetch status page.' });
  }
};

/**
 * Update status page configuration
 */
export const updateStatusPage = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { title, slug, description, logo_url, theme, monitor_ids } = req.body;

  try {
    // 1. Check ownership
    const checkRes = await query('SELECT * FROM status_pages WHERE id = $1 AND user_id = $2', [id, userId]);
    if (checkRes.rowCount === 0) {
      return res.status(404).json({ error: 'Status page not found or unauthorized.' });
    }

    const currentPage = checkRes.rows[0];

    // Validate and format slug if it changed
    let formattedSlug = currentPage.slug;
    if (slug && slug !== currentPage.slug) {
      formattedSlug = slug.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      const slugCheck = await query('SELECT id FROM status_pages WHERE slug = $1 AND id != $2', [formattedSlug, id]);
      if (slugCheck.rowCount > 0) {
        return res.status(409).json({ error: 'This slug is already taken.' });
      }
    }

    const nextTitle = title || currentPage.title;
    const nextDesc = description !== undefined ? description : currentPage.description;
    const nextLogo = logo_url !== undefined ? logo_url : currentPage.logo_url;
    const nextTheme = theme || currentPage.theme;

    // Update main page details
    const updateRes = await query(
      `UPDATE status_pages 
       SET title = $1, slug = $2, description = $3, logo_url = $4, theme = $5
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [nextTitle, formattedSlug, nextDesc, nextLogo, nextTheme, id, userId]
    );

    const updatedPage = updateRes.rows[0];

    // Update associated monitors
    if (monitor_ids !== undefined) {
      await updateStatusPageMonitors(id, monitor_ids);
    }

    res.json({
      ...updatedPage,
      monitor_ids: monitor_ids || []
    });

  } catch (error) {
    console.error('[Status Page Controller] Update error:', error);
    res.status(500).json({ error: 'Failed to update status page.' });
  }
};

/**
 * Delete a status page config
 */
export const deleteStatusPage = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const deleteRes = await query(
      'DELETE FROM status_pages WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (deleteRes.rowCount === 0) {
      return res.status(404).json({ error: 'Status page not found or unauthorized.' });
    }

    res.json({ message: 'Status page successfully deleted.', id });
  } catch (error) {
    console.error('[Status Page Controller] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete status page.' });
  }
};

/**
 * Public facing endpoint to load status page details, associated monitor status,
 * 30-day daily histories, and recent incidents (unauthenticated).
 */
export const getPublicStatusPage = async (req, res) => {
  const { slug } = req.params;

  try {
    // 1. Fetch public status page config
    const pageRes = await query(
      'SELECT id, title, description, logo_url, theme, created_at FROM status_pages WHERE slug = $1',
      [slug.toLowerCase()]
    );

    if (pageRes.rowCount === 0) {
      return res.status(404).json({ error: 'Status page not found.' });
    }

    const page = pageRes.rows[0];

    // 2. Fetch associated monitors and their current live status
    const monitorsRes = await query(
      `SELECT m.id, m.name, m.url, m.type, m.status, m.last_checked_at, m.last_status_change_at
       FROM monitors m
       JOIN status_page_monitors spm ON m.id = spm.monitor_id
       WHERE spm.status_page_id = $1 AND m.is_active = true
       ORDER BY m.name ASC`,
      [page.id]
    );

    const monitors = monitorsRes.rows;
    const monitorIds = monitors.map(m => m.id);

    let dailyHistories = {};
    let recentIncidents = [];
    let overallStatus = 'operational'; // operational, partial_outage, major_outage

    if (monitorIds.length > 0) {
      // 3. Determine overall status summary
      const statuses = monitors.map(m => m.status);
      const downCount = statuses.filter(s => s === 'down').length;

      if (downCount === statuses.length) {
        overallStatus = 'major_outage';
      } else if (downCount > 0) {
        overallStatus = 'partial_outage';
      }

      // 4. Fetch last 30 days of daily aggregates for each associated monitor
      const statsRes = await query(
        `SELECT 
           monitor_id,
           DATE_TRUNC('day', hour) as date, 
           SUM(ping_count)::integer as total_pings, 
           SUM(up_count)::integer as total_up, 
           AVG(avg_response_time_ms)::double precision as avg_latency
         FROM hourly_stats 
         WHERE monitor_id = ANY($1) AND hour >= NOW() - INTERVAL '30 days' 
         GROUP BY monitor_id, DATE_TRUNC('day', hour) 
         ORDER BY date ASC`,
        [monitorIds]
      );

      // Group history by monitor ID
      monitorIds.forEach(id => {
        dailyHistories[id] = [];
      });

      statsRes.rows.forEach(row => {
        const mId = row.monitor_id;
        if (dailyHistories[mId]) {
          dailyHistories[mId].push({
            date: row.date,
            uptime: row.total_pings > 0 ? (row.total_up / row.total_pings) * 100 : 100,
            avgResponseTimeMs: Math.round(row.avg_latency)
          });
        }
      });

      // 5. Fetch last 15 incidents for these monitors
      const incidentsRes = await query(
        `SELECT i.*, m.name as monitor_name 
         FROM incidents i
         JOIN monitors m ON i.monitor_id = m.id
         WHERE i.monitor_id = ANY($1)
         ORDER BY i.started_at DESC
         LIMIT 15`,
        [monitorIds]
      );
      recentIncidents = incidentsRes.rows;
    }

    res.json({
      page,
      monitors,
      overallStatus,
      dailyHistories,
      recentIncidents
    });

  } catch (error) {
    console.error('[Status Page Controller] Public fetch error:', error);
    res.status(500).json({ error: 'Failed to retrieve public status page details.' });
  }
};
