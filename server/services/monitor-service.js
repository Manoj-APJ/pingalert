import { query } from '../db/index.js';
import { alertQueue, pingQueue } from '../queue/index.js';
import { config } from '../config/index.js';
import dns from 'dns/promises';

/**
 * Helper to determine if an IP address is internal/private (RFC1918, loopback, link-local, etc.)
 */
const isPrivateIP = (ip) => {
  if (ip === '::1' || ip === '::' || ip === '0.0.0.0' || ip === '127.0.0.1') return true;
  if (ip.startsWith('::ffff:')) ip = ip.substring(7);
  
  const parts = ip.split('.');
  if (parts.length === 4) {
    const num = parseInt(parts[0], 10);
    if (num === 10) return true; // 10.0.0.0/8
    if (num === 127) return true; // 127.0.0.0/8
    if (num === 169 && parseInt(parts[1], 10) === 254) return true; // 169.254.0.0/16
    if (num === 172 && parseInt(parts[1], 10) >= 16 && parseInt(parts[1], 10) <= 31) return true; // 172.16.0.0/12
    if (num === 192 && parseInt(parts[1], 10) === 168) return true; // 192.168.0.0/16
    if (num === 0) return true; // 0.0.0.0/8
  }

  // IPv6 checks
  if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true; // Unique Local
  if (ip.toLowerCase().startsWith('fe8') || ip.toLowerCase().startsWith('fe9') || ip.toLowerCase().startsWith('fea') || ip.toLowerCase().startsWith('feb')) return true; // Link Local

  return false;
};

/**
 * Executes a network ping (HTTP request) to a monitor URL.
 */
export const performPing = async (monitor) => {
  const startTime = Date.now();
  const timeoutMs = (monitor.timeout_seconds || 10) * 1000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const parsedUrl = new URL(monitor.url);
    
    // SSRF Protection: Resolve the hostname and check if it targets a private IP
    try {
      const lookupInfo = await dns.lookup(parsedUrl.hostname);
      if (isPrivateIP(lookupInfo.address)) {
        throw new Error(`SSRF Blocked: URL resolves to internal IP ${lookupInfo.address}`);
      }
    } catch (dnsErr) {
      // If DNS resolution fails entirely, throw an error to be handled as downtime
      if (dnsErr.message.includes('SSRF Blocked')) throw dnsErr;
      throw new Error(`DNS Resolution failed: ${dnsErr.message}`);
    }

    const response = await fetch(monitor.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'PingAlert/1.0 (Website Availability Monitor)'
      },
      redirect: 'manual', // SSRF Protection: Prevent following redirects to internal targets
      signal: controller.signal
    });

    const responseTimeMs = Date.now() - startTime;
    clearTimeout(timeoutId);

    // Consider 2xx and 3xx status codes as "UP". 
    // 3xx is considered UP since we use manual redirects to avoid SSRF chains.
    const isUp = response.status >= 200 && response.status < 400;
    return {
      isUp,
      responseTimeMs,
      statusCode: response.status,
      cause: isUp ? null : `HTTP Status Code ${response.status}`
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;
    let cause = error.message || 'Unknown network error';
    if (error.name === 'AbortError') {
      cause = `Timeout after ${monitor.timeout_seconds || 10}s`;
    }
    return {
      isUp: false,
      responseTimeMs,
      statusCode: 0,
      cause
    };
  }
};

/**
 * Processes the check result of a monitor and updates db tables in a transaction.
 */
export const handleCheckResult = async (monitorId, checkResult) => {
  const now = new Date();
  
  // Find current monitor details
  const monitorRes = await query('SELECT * FROM monitors WHERE id = $1', [monitorId]);
  if (monitorRes.rowCount === 0) return;
  const monitor = monitorRes.rows[0];

  const prevStatus = monitor.status || 'unknown';
  let nextStatus = prevStatus;
  let consecutiveFailures = monitor.consecutive_failures || 0;
  let lastStatusChangeAt = monitor.last_status_change_at;

  const currentHour = new Date(now);
  currentHour.setMinutes(0, 0, 0); // Floor to nearest hour

  // Perform database updates
  if (checkResult.isUp) {
    // -----------------------------------------------------
    // CASE 1: SUCCESSFUL CHECK
    // -----------------------------------------------------
    consecutiveFailures = 0;
    nextStatus = 'up';

    if (prevStatus === 'down') {
      // Transition: DOWN -> UP
      lastStatusChangeAt = now;

      // Close the active incident
      const incidentRes = await query(
        `UPDATE incidents 
         SET ended_at = $1, is_resolved = true 
         WHERE monitor_id = $2 AND is_resolved = false
         RETURNING id, started_at`,
        [now, monitorId]
      );

      if (incidentRes.rowCount > 0) {
        const incident = incidentRes.rows[0];
        const durationSec = Math.floor((now - new Date(incident.started_at)) / 1000);

        // Queue notification job for resolved incident
        await alertQueue.add('alert-resolved', {
          monitorId,
          monitorName: monitor.name,
          monitorUrl: monitor.url,
          userId: monitor.user_id,
          type: 'UP',
          startedAt: incident.started_at,
          endedAt: now,
          durationSec
        });
      }
    }

    // Update monitors state table
    const nextCheck = new Date(now.getTime() + monitor.interval_minutes * 60 * 1000);
    await query(
      `UPDATE monitors 
       SET status = $1, last_checked_at = $2, last_status_change_at = $3, 
           consecutive_failures = $4, next_check_at = $5, updated_at = $6
       WHERE id = $7`,
      [nextStatus, now, lastStatusChangeAt || now, consecutiveFailures, nextCheck, now, monitorId]
    );

    // Save/Update Hourly Stats
    await query(
      `INSERT INTO hourly_stats (monitor_id, hour, ping_count, up_count, avg_response_time_ms)
       VALUES ($1, $2, 1, 1, $3)
       ON CONFLICT (monitor_id, hour) DO UPDATE SET
         avg_response_time_ms = ((hourly_stats.avg_response_time_ms * hourly_stats.ping_count) + EXCLUDED.avg_response_time_ms) / (hourly_stats.ping_count + 1),
         ping_count = hourly_stats.ping_count + 1,
         up_count = hourly_stats.up_count + 1`,
      [monitorId, currentHour, checkResult.responseTimeMs]
    );

  } else {
    // -----------------------------------------------------
    // CASE 2: FAILED CHECK
    // -----------------------------------------------------
    consecutiveFailures += 1;

    // Check if the retries threshold is crossed
    if (consecutiveFailures >= config.pingRetryCount) {
      nextStatus = 'down';

      if (prevStatus === 'up' || prevStatus === 'unknown') {
        // Transition: UP -> DOWN
        lastStatusChangeAt = now;

        // Open a new outage incident record
        const incidentId = crypto.randomUUID();
        await query(
          `INSERT INTO incidents (id, monitor_id, started_at, cause, is_resolved)
           VALUES ($1, $2, $3, $4, false)`,
          [incidentId, monitorId, now, checkResult.cause]
        );

        // Queue critical outage alert notification
        await alertQueue.add('alert-outage', {
          monitorId,
          monitorName: monitor.name,
          monitorUrl: monitor.url,
          userId: monitor.user_id,
          type: 'DOWN',
          startedAt: now,
          cause: checkResult.cause
        });
      }

      // Schedule next standard check
      const nextCheck = new Date(now.getTime() + monitor.interval_minutes * 60 * 1000);
      await query(
        `UPDATE monitors 
         SET status = $1, last_checked_at = $2, last_status_change_at = $3, 
             consecutive_failures = $4, next_check_at = $5, updated_at = $6
         WHERE id = $7`,
        [nextStatus, now, lastStatusChangeAt || now, consecutiveFailures, nextCheck, now, monitorId]
      );
    } else {
      // transient failure! Queue an immediate check retry with delay
      console.log(`Monitor ${monitor.name} failed. Attempt ${consecutiveFailures}/${config.pingRetryCount}. Scheduling retry in ${config.pingRetryDelaySec}s.`);
      
      // Update consecutive failures on monitor immediately
      await query(
        `UPDATE monitors 
         SET consecutive_failures = $1, last_checked_at = $2, updated_at = $3
         WHERE id = $4`,
        [consecutiveFailures, now, now, monitorId]
      );

      await pingQueue.add(
        'ping-retry',
        { monitorId },
        { delay: config.pingRetryDelaySec * 1000 }
      );
    }

    // Save/Update Hourly Stats (Record failure in latency history)
    await query(
      `INSERT INTO hourly_stats (monitor_id, hour, ping_count, up_count, avg_response_time_ms)
       VALUES ($1, $2, 1, 0, $3)
       ON CONFLICT (monitor_id, hour) DO UPDATE SET
         avg_response_time_ms = ((hourly_stats.avg_response_time_ms * hourly_stats.ping_count) + EXCLUDED.avg_response_time_ms) / (hourly_stats.ping_count + 1),
         ping_count = hourly_stats.ping_count + 1`,
      [monitorId, currentHour, checkResult.responseTimeMs]
    );
  }
};

/**
 * Deletes email notification logs older than 50 days.
 */
export const pruneEmailLogs = async () => {
  try {
    const res = await query(
      `DELETE FROM email_logs 
       WHERE sent_at < NOW() - INTERVAL '50 days'`
    );
    console.log(`Pruned ${res.rowCount} old email logs (older than 50 days)`);
  } catch (error) {
    console.error('Error during email logs pruning:', error);
  }
};
