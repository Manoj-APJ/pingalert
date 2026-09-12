import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ExternalLink,
  Trash2,
  Pause,
  Play,
  Clock,
  Activity,
  Calendar,
  Zap,
} from 'lucide-react';
import type { Monitor, MonitorStats, Incident } from '../../types';
import { apiRequest } from '../../lib/api';
import { formatSeconds } from '../../lib/utils';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { PulseDot } from '../ui/PulseDot';
import { Skeleton } from '../ui/Skeleton';
import { NumberCounter } from '../ui/NumberCounter';
import { UptimeCalendarGrid } from '../charts/UptimeCalendarGrid';
import { SvgAreaChart } from '../charts/SvgAreaChart';

interface MonitorDetailProps {
  monitor: Monitor;
  onBack: () => void;
  onToggleActive: (monitor: Monitor) => void;
  onDelete: (monitorId: string) => void;
}

export const MonitorDetail: React.FC<MonitorDetailProps> = ({
  monitor,
  onBack,
  onToggleActive,
  onDelete,
}) => {
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      apiRequest<MonitorStats>(`/api/monitors/${monitor.id}/stats`).catch(() => null),
      apiRequest<Incident[]>(`/api/monitors/${monitor.id}/incidents`).catch(() => []),
    ]).then(([statsData, incidentsData]) => {
      if (isMounted) {
        if (statsData) setStats(statsData);
        if (incidentsData) setIncidents(incidentsData);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [monitor.id]);

  const statusVariant = !monitor.is_active
    ? 'neutral'
    : monitor.status === 'up'
    ? 'success'
    : monitor.status === 'down'
    ? 'error'
    : 'warning';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="monitor-detail-view"
    >
      {/* Detail View Header Bar */}
      <div className="detail-hero-header">
        <div className="detail-hero-left">
          <button
            type="button"
            className="back-pill-btn"
            onClick={onBack}
            aria-label="Back to monitors list"
          >
            <ArrowLeft size={16} />
            <span>All Monitors</span>
          </button>

          <div className="detail-title-group">
            <h1 className="detail-monitor-name">{monitor.name}</h1>
            <a
              href={monitor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="detail-url-badge"
            >
              <span>{monitor.url}</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        <div className="detail-hero-actions">
          <Button
            variant="secondary"
            size="md"
            icon={monitor.is_active ? <Pause size={15} /> : <Play size={15} />}
            onClick={() => onToggleActive(monitor)}
          >
            {monitor.is_active ? 'Pause Monitoring' : 'Resume Checks'}
          </Button>
        </div>
      </div>

      {/* Metrics Row Grid */}
      <div className="overview-stats-grid">
        <Card className="metric-stat-card">
          <div className="metric-stat-header">
            <span className="metric-stat-label">Current Status</span>
            <PulseDot status={monitor.status} isActive={monitor.is_active} size="sm" />
          </div>
          <div className="metric-stat-number">
            <Badge variant={statusVariant} size="md">
              {!monitor.is_active ? 'Paused' : monitor.status.toUpperCase()}
            </Badge>
          </div>
          <div className="metric-stat-meta">
            {monitor.last_checked_at
              ? `Checked at ${new Date(monitor.last_checked_at).toLocaleTimeString()}`
              : 'Awaiting initial check'}
          </div>
        </Card>

        <Card className="metric-stat-card">
          <div className="metric-stat-header">
            <span className="metric-stat-label">30-Day Availability</span>
            <Calendar size={18} className="metric-stat-icon" />
          </div>
          <div className="metric-stat-number">
            {isLoading ? (
              <Skeleton width="110px" height="32px" />
            ) : (
              <NumberCounter
                value={stats ? stats.uptimePercentage : 100}
                decimals={2}
                suffix="%"
              />
            )}
          </div>
          <div className="metric-stat-meta">Calculated uptime SLA</div>
        </Card>

        <Card className="metric-stat-card">
          <div className="metric-stat-header">
            <span className="metric-stat-label">Avg Response Latency</span>
            <Zap size={18} className="metric-stat-icon" />
          </div>
          <div className="metric-stat-number">
            {isLoading ? (
              <Skeleton width="90px" height="32px" />
            ) : (
              <NumberCounter
                value={stats ? Math.round(stats.avgResponseTimeMs) : 0}
                suffix=" ms"
              />
            )}
          </div>
          <div className="metric-stat-meta">30-day global average</div>
        </Card>

        <Card className="metric-stat-card">
          <div className="metric-stat-header">
            <span className="metric-stat-label">Frequency & Timeout</span>
            <Clock size={18} className="metric-stat-icon" />
          </div>
          <div className="metric-stat-number">
            <span>{monitor.interval_minutes}m</span>
            <span style={{ fontSize: '16px', fontWeight: 400, color: 'var(--text-secondary)' }}>
              {' '}/ {monitor.timeout_seconds}s
            </span>
          </div>
          <div className="metric-stat-meta">Polling cadence</div>
        </Card>
      </div>

      {/* 30-Day Availability Grid Card */}
      <Card className="detail-section-card">
        <div className="section-card-header">
          <div>
            <h3 className="section-card-title">30-Day Availability Calendar</h3>
            <p className="section-card-subtitle">
              Daily uptime ratio and aggregate check status over the past month.
            </p>
          </div>
          <div className="calendar-legend">
            <span className="legend-item">
              <span className="legend-dot up" /> Operational
            </span>
            <span className="legend-item">
              <span className="legend-dot degraded" /> Degraded
            </span>
            <span className="legend-item">
              <span className="legend-dot down" /> Outage
            </span>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '16px 0' }}>
            <Skeleton height="36px" borderRadius="6px" />
          </div>
        ) : (
          <div>
            <UptimeCalendarGrid dailyHistory={stats ? stats.dailyHistory : []} />
            <div className="calendar-axis-labels">
              <span>30 days ago</span>
              <span>Today</span>
            </div>
          </div>
        )}
      </Card>

      {/* 24-Hour Latency Curve Chart */}
      <Card className="detail-section-card">
        <div className="section-card-header">
          <div>
            <h3 className="section-card-title">Response Time Latency (Last 24 Hours)</h3>
            <p className="section-card-subtitle">
              Hourly average round-trip ping time in milliseconds.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '24px 0' }}>
            <Skeleton height="200px" borderRadius="12px" />
          </div>
        ) : (
          <SvgAreaChart history={stats ? stats.hourlyHistory : []} />
        )}
      </Card>

      {/* Incident History Table */}
      <Card padded={false} className="detail-section-card" style={{ overflow: 'hidden' }}>
        <div className="section-card-header" style={{ padding: '24px 24px 16px' }}>
          <div>
            <h3 className="section-card-title">Incident Log History</h3>
            <p className="section-card-subtitle">
              Recorded downtime occurrences, cause diagnoses, and resolution durations.
            </p>
          </div>
        </div>

        {incidents.length > 0 ? (
          <div className="table-responsive">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th>Started At</th>
                  <th>Resolved At</th>
                  <th>Total Duration</th>
                  <th>Root Cause / Error</th>
                  <th style={{ textAlign: 'right' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((incident) => {
                  const durationSec = incident.ended_at
                    ? Math.floor(
                        (new Date(incident.ended_at).getTime() -
                          new Date(incident.started_at).getTime()) /
                          1000
                      )
                    : null;

                  return (
                    <tr key={incident.id} className="table-row-item">
                      <td className="timestamp-cell">
                        {new Date(incident.started_at).toLocaleString()}
                      </td>
                      <td className="timestamp-cell">
                        {incident.ended_at
                          ? new Date(incident.ended_at).toLocaleString()
                          : '—'}
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
                          {incident.is_resolved ? 'Resolved' : 'Critical'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-empty-notice">
            <Activity size={20} className="empty-notice-icon" />
            <span>No downtime incidents recorded for this endpoint.</span>
          </div>
        )}
      </Card>

      {/* Danger Zone */}
      <div className="danger-zone-card">
        <div className="danger-zone-text">
          <h4 className="danger-zone-title">Danger Zone: Delete Endpoint</h4>
          <p className="danger-zone-desc">
            Permanently removes this website monitor and deletes all historical 30-day stats, latency
            metrics, and incident logs. This action cannot be undone.
          </p>
        </div>
        <div>
          <Button
            variant="danger"
            size="md"
            icon={<Trash2 size={16} />}
            onClick={() => onDelete(monitor.id)}
          >
            Delete Monitor
          </Button>
        </div>
      </div>
    </motion.div>
  );
};
