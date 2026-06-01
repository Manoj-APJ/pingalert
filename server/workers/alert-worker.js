import { Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { query } from '../db/index.js';
import { alertQueueName } from '../queue/index.js';

// Initialize Nodemailer transporter
let transporter = null;
if (config.smtp.host) {
  console.log(`[Alert Worker] Configuring SMTP transporter for host: ${config.smtp.host}`);
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? {
      user: config.smtp.user,
      pass: config.smtp.pass
    } : undefined
  });
} else {
  console.log('[Alert Worker] SMTP not configured. Alerts will be recorded in DB and printed to console.');
}

/**
 * Format duration in seconds to a readable string (e.g. 5m 24s)
 */
const formatDuration = (seconds) => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
};

/**
 * Starts the Alert Worker
 */
export const startAlertWorker = () => {
  console.log(`[Alert Worker] Launching queue processor (concurrency: ${config.alertConcurrency})...`);

  const worker = new Worker(
    alertQueueName,
    async (job) => {
      const { monitorId, monitorName, monitorUrl, userId, type, startedAt, endedAt, durationSec, cause } = job.data;

      // 1. Fetch user email
      const userRes = await query('SELECT email, name FROM users WHERE id = $1', [userId]);
      if (userRes.rowCount === 0) {
        console.error(`[Alert Worker] User ${userId} not found. Cannot send alert.`);
        return;
      }
      const user = userRes.rows[0];
      const recipientEmail = user.email;

      let subject = '';
      let bodyText = '';
      let bodyHtml = '';

      const alertTime = new Date(startedAt).toLocaleString();

      if (type === 'DOWN') {
        subject = `🚨 CRITICAL OUTAGE: ${monitorName} is DOWN`;
        bodyText = `Hi ${user.name},\n\nYour website "${monitorName}" (${monitorUrl}) is currently DOWN.\n\nOutage started: ${alertTime}\nReason: ${cause || 'Unknown network error'}\n\nWe will check again and notify you when it recovers.\n\nBest,\nPingAlert Team`;
        bodyHtml = `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ffccd5; border-radius: 8px; max-width: 600px; background-color: #fff5f5;">
            <h2 style="color: #d90429; margin-top: 0;">🚨 Critical Outage Alert</h2>
            <p>Hi <strong>${user.name}</strong>,</p>
            <p>Our monitoring system has detected that your website is currently offline.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #eee;">Website:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><a href="${monitorUrl}" style="color: #0077b6;">${monitorName}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #eee;">Status:</td>
                <td style="padding: 8px 0; color: #d90429; font-weight: bold; border-bottom: 1px solid #eee;">DOWN</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #eee;">Started At:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${alertTime}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #eee;">Reason:</td>
                <td style="padding: 8px 0; color: #555; border-bottom: 1px solid #eee;"><code>${cause || 'Unknown network error'}</code></td>
              </tr>
            </table>
            <p>We are continuing to monitor the endpoint and will send a notification the moment services recover.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #888;">This is an automated alert from PingAlert.</p>
          </div>
        `;
      } else if (type === 'UP') {
        const recoverTime = new Date(endedAt).toLocaleString();
        const downtimeStr = formatDuration(durationSec);
        subject = `✅ RESOLVED: ${monitorName} is back UP`;
        bodyText = `Hi ${user.name},\n\nYour website "${monitorName}" (${monitorUrl}) is back UP.\n\nOutage started: ${alertTime}\nOutage resolved: ${recoverTime}\nTotal downtime duration: ${downtimeStr}\n\nAll services are back online.\n\nBest,\nPingAlert Team`;
        bodyHtml = `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #d8f3dc; border-radius: 8px; max-width: 600px; background-color: #f4fbf7;">
            <h2 style="color: #2d6a4f; margin-top: 0;">✅ Outage Resolved</h2>
            <p>Hi <strong>${user.name}</strong>,</p>
            <p>Good news! Your website has recovered and is responding normally again.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #eee;">Website:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><a href="${monitorUrl}" style="color: #0077b6;">${monitorName}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #eee;">Status:</td>
                <td style="padding: 8px 0; color: #2d6a4f; font-weight: bold; border-bottom: 1px solid #eee;">UP (Active)</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #eee;">Downtime Duration:</td>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #eee;">${downtimeStr}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #eee;">Resolved At:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${recoverTime}</td>
              </tr>
            </table>
            <p>All checks are passing successfully.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #888;">This is an automated alert from PingAlert.</p>
          </div>
        `;
      }

      // 2. Send actual SMTP email if configured
      if (transporter) {
        try {
          await transporter.sendMail({
            from: config.smtp.from,
            to: recipientEmail,
            subject: subject,
            text: bodyText,
            html: bodyHtml
          });
          console.log(`[Alert Worker] Real email alert dispatched to ${recipientEmail}: ${subject}`);
        } catch (mailErr) {
          console.error(`[Alert Worker] SMTP dispatch failed to ${recipientEmail}:`, mailErr);
        }
      } else {
        console.log(`[Alert Worker] [MOCK EMAIL ALERT SENT TO ${recipientEmail}]\nSubject: ${subject}\nBody: ${bodyText}\n`);
      }

      // 3. Log notification in database
      await query(
        `INSERT INTO email_logs (id, monitor_id, recipient, subject, body, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [crypto.randomUUID(), monitorId, recipientEmail, subject, bodyHtml, new Date()]
      );
    },
    {
      connection: {
        url: config.redisUrl
      },
      concurrency: config.alertConcurrency
    }
  );

  worker.on('error', (err) => {
    console.error('[Alert Worker] Queue connection error:', err);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Alert Worker] Job ${job?.id} failed:`, err);
  });

  return worker;
};
