import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck, ExternalLink } from 'lucide-react';
import type { Incident } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { formatSeconds } from '../../lib/utils';

interface IncidentListProps {
  incidents: Incident[];
  isLoading?: boolean;
}

export const IncidentList: React.FC<IncidentListProps> = ({
  incidents = [],
}) => {
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
    <div className="incidents-view-container">
      <div className="view-intro-header">
        <div>
          <h2 className="view-headline">Outages & Incident Timeline</h2>
          <p className="view-subtext">
            Historical log of downtime events, server timeout alerts, and recovery confirmations.
          </p>
        </div>
      </div>

      {incidents.length > 0 ? (
        <Card padded={false} className="monitors-table-card">
          <div className="table-responsive">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Monitored Endpoint</th>
                  <th>Started At</th>
                  <th>Resolved At</th>
                  <th>Downtime Duration</th>
                  <th>Identified Cause</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                {incidents.map((incident) => {
                  const durationSec = incident.ended_at
                    ? Math.floor(
                        (new Date(incident.ended_at).getTime() -
                          new Date(incident.started_at).getTime()) /
                          1000
                      )
                    : null;

                  return (
                    <motion.tr key={incident.id} variants={itemVariants} className="table-row-item">
                      <td>
                        <div className="endpoint-cell-title">
                          <strong>{incident.monitor_name || 'Website Endpoint'}</strong>
                        </div>
                        {incident.monitor_url && (
                          <div className="endpoint-url-link">
                            <span>{incident.monitor_url}</span>
                            <ExternalLink size={11} className="url-link-icon" />
                          </div>
                        )}
                      </td>

                      <td className="timestamp-cell">
                        {new Date(incident.started_at).toLocaleString()}
                      </td>

                      <td className="timestamp-cell">
                        {incident.ended_at ? new Date(incident.ended_at).toLocaleString() : '—'}
                      </td>

                      <td>
                        {durationSec !== null ? (
                          <span className="duration-pill">{formatSeconds(durationSec)}</span>
                        ) : (
                          <Badge variant="error" size="sm">
                            Active Outage
                          </Badge>
                        )}
                      </td>

                      <td>
                        <code className="code-pill">{incident.cause || 'Network Timeout'}</code>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <Badge variant={incident.is_resolved ? 'success' : 'error'} size="sm">
                          {incident.is_resolved ? 'Resolved' : 'Active'}
                        </Badge>
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
          <div className="empty-state-icon-wrap" style={{ color: 'var(--success)' }}>
            <ShieldCheck size={36} />
          </div>
          <h3 className="empty-state-title">All Systems Operational</h3>
          <p className="empty-state-desc">
            No website downtime incidents or HTTP connection failures have been logged in your account.
          </p>
        </Card>
      )}
    </div>
  );
};
