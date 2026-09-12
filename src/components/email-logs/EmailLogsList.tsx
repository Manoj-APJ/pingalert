import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Mail, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import type { EmailLog } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface EmailLogsListProps {
  emailLogs: EmailLog[];
  isLoading?: boolean;
}

export const EmailLogsList: React.FC<EmailLogsListProps> = ({ emailLogs = [] }) => {
  const prefersReducedMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: prefersReducedMotion
        ? { duration: 0.05 }
        : { staggerChildren: 0.04, delayChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.2, ease: 'easeOut' as const },
    },
  };

  return (
    <div className="email-logs-view-container">
      <div className="view-intro-header">
        <div>
          <h2 className="view-headline">Dispatched Notification Logs</h2>
          <p className="view-subtext">
            Audit trail of automated SMTP email alerts dispatched during downtime occurrences and
            recovery resolutions.
          </p>
        </div>
      </div>

      {emailLogs.length > 0 ? (
        <Card padded={false} className="monitors-table-card">
          <div className="table-responsive">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Monitored Target</th>
                  <th>Recipient</th>
                  <th>Subject & Event</th>
                  <th>Delivery Status</th>
                  <th style={{ textAlign: 'right' }}>Dispatched At</th>
                </tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                {emailLogs.map((log) => {
                  const isSuccess = log.status === 'sent';
                  const isMocked = log.status === 'mocked';

                  return (
                    <motion.tr key={log.id} variants={itemVariants} className="table-row-item">
                      <td>
                        <strong>{log.monitor_name}</strong>
                      </td>

                      <td>
                        <span className="email-recipient-code">{log.recipient}</span>
                      </td>

                      <td>
                        <span
                          className={`email-subject-line ${
                            log.subject.includes('back UP') || log.subject.includes('RESOLVED')
                              ? 'subject-up'
                              : 'subject-down'
                          }`}
                        >
                          {log.subject}
                        </span>
                      </td>

                      <td>
                        <div className="delivery-status-cell">
                          <Badge
                            variant={isSuccess ? 'success' : isMocked ? 'warning' : 'error'}
                            size="sm"
                          >
                            {isSuccess ? (
                              <CheckCircle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                            ) : isMocked ? (
                              <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                            ) : (
                              <AlertCircle size={12} style={{ display: 'inline', marginRight: '4px' }} />
                            )}
                            {log.status ? log.status.toUpperCase() : 'SENT'}
                          </Badge>
                          {log.error && (
                            <div className="delivery-error-tooltip" title={log.error}>
                              {log.error}
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="timestamp-cell" style={{ textAlign: 'right' }}>
                        {new Date(log.sent_at).toLocaleString()}
                      </td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="empty-state-card">
          <div className="empty-state-icon-wrap">
            <Mail size={36} />
          </div>
          <h3 className="empty-state-title">No email alerts dispatched yet</h3>
          <p className="empty-state-desc">
            When a monitored website experiences downtime or recovers, an automated email notification
            will be dispatched to your registered address and logged here.
          </p>
        </Card>
      )}
    </div>
  );
};
