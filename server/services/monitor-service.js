import { query, pool } from '../db/index.js';
import { alertQueue, pingQueue } from '../queue/index.js';
import { config } from '../config/index.js';
import dns from 'dns/promises';
import ipaddr from 'ipaddr.js';

/**
 * Helper to determine if an IP address is internal/private (RFC1918, loopback, link-local, etc.)
 */
const isPrivateIP = (ipStr) => {
  try {
    let addr = ipaddr.parse(ipStr);
    
    // Normalize IPv4-mapped IPv6 addresses to strictly check their underlying IPv4 range
    if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
      addr = addr.toIPv4Address();
    }
    
    // ipaddr.js range() returns 'unicast' for public routable IPs.
    // It returns 'private', 'loopback', 'linkLocal', 'uniqueLocal', etc. for internal IPs.
    return addr.range() !== 'unicast';
  } catch (err) {
    return true; // Default deny if the IP address cannot be parsed
  }
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
      // Use { all: true } to catch DNS Multi-Record / Happy Eyeballs bypasses
      const lookupInfos = await dns.lookup(parsedUrl.hostname, { all: true });
      for (const info of lookupInfos) {
        if (isPrivateIP(info.address)) {
          throw new Error(`SSRF Blocked: URL resolves to internal IP ${info.address}`);
        }
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
  const currentHour = new Date(now);
  currentHour.setMinutes(0, 0, 0); // Floor to nearest hour
  
  const client = await pool.connect();
  const queueOps = [];

  try {
    await client.query('BEGIN');

    // Find current monitor details
    // FOR UPDATE ensures row-level locking during the transaction
    const monitorRes = await client.query('SELECT * FROM monitors WHERE id = $1 FOR UPDATE', [monitorId]);
    if (monitorRes.rowCount === 0) {
      await client.query('ROLLBACK');
      client.release();
      return;
    }
    const monitor = monitorRes.rows[0];

    const prevStatus = monitor.status || 'unknown';
    let nextStatus = prevStatus;
    let consecutiveFailures = monitor.consecutive_failures || 0;
    let lastStatusChangeAt = monitor.last_status_change_at;

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
        const incidentRes = await client.query(
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
          queueOps.push(() => alertQueue.add('alert-resolved', {
            monitorId,
            monitorName: monitor.name,
            monitorUrl: monitor.url,
            userId: monitor.user_id,
            type: 'UP',
            startedAt: incident.started_at,
            endedAt: now,
            durationSec
          }));
        }
      }

      // Update monitors state table
      const nextCheck = new Date(now.getTime() + monitor.interval_minutes * 60 * 1000);
      await client.query(
        `UPDATE monitors 
         SET status = $1, last_checked_at = $2, last_status_change_at = $3, 
             consecutive_failures = $4, next_check_at = $5, updated_at = $6
         WHERE id = $7`,
        [nextStatus, now, lastStatusChangeAt || now, consecutiveFailures, nextCheck, now, monitorId]
      );

      // Save/Update Hourly Stats
      await client.query(
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
          await client.query(
            `INSERT INTO incidents (id, monitor_id, started_at, cause, is_resolved)
             VALUES ($1, $2, $3, $4, false)`,
            [incidentId, monitorId, now, checkResult.cause]
          );

          // Queue critical outage alert notification
          queueOps.push(() => alertQueue.add('alert-outage', {
            monitorId,
            monitorName: monitor.name,
            monitorUrl: monitor.url,
            userId: monitor.user_id,
            type: 'DOWN',
            startedAt: now,
            cause: checkResult.cause
          }));
        }

        // Schedule next standard check
        const nextCheck = new Date(now.getTime() + monitor.interval_minutes * 60 * 1000);
        await client.query(
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
        await client.query(
          `UPDATE monitors 
           SET consecutive_failures = $1, last_checked_at = $2, updated_at = $3
           WHERE id = $4`,
          [consecutiveFailures, now, now, monitorId]
        );

        queueOps.push(() => pingQueue.add(
          'ping-retry',
          { monitorId },
          { 
            jobId: `ping-${monitorId}`,
            delay: config.pingRetryDelaySec * 1000,
            removeOnComplete: true,
            removeOnFail: true
          }
        ));
      }

      // Save/Update Hourly Stats (Record failure in latency history)
      await client.query(
        `INSERT INTO hourly_stats (monitor_id, hour, ping_count, up_count, avg_response_time_ms)
         VALUES ($1, $2, 1, 0, $3)
         ON CONFLICT (monitor_id, hour) DO UPDATE SET
           avg_response_time_ms = ((hourly_stats.avg_response_time_ms * hourly_stats.ping_count) + EXCLUDED.avg_response_time_ms) / (hourly_stats.ping_count + 1),
           ping_count = hourly_stats.ping_count + 1`,
        [monitorId, currentHour, checkResult.responseTimeMs]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Monitor Service] Error processing check result transaction:', error);
  } finally {
    client.release();
  }

  // Execute queue operations only after successful transaction commit
  for (const op of queueOps) {
    try {
      await op();
    } catch (queueErr) {
      console.error('[Monitor Service] Error adding job to queue:', queueErr);
    }
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
