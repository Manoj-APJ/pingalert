import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Search,
  ExternalLink,
  ChevronRight,
  Pause,
  Play,
  Activity,
  ShieldAlert,
  Server,
  CheckCircle,
  Plus,
} from 'lucide-react';
import type { Monitor } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { PulseDot } from '../ui/PulseDot';
import { NumberCounter } from '../ui/NumberCounter';
import { getRelativeTime } from '../../lib/utils';

interface MonitorListProps {
  monitors: Monitor[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSelectMonitor: (monitor: Monitor) => void;
  onToggleMonitor: (monitor: Monitor) => void;
  onOpenAddModal: () => void;
  isLoading?: boolean;
}

export const MonitorList: React.FC<MonitorListProps> = ({
  monitors,
  searchTerm,
  onSearchChange,
  onSelectMonitor,
  onToggleMonitor,
  onOpenAddModal,
}) => {
  const prefersReducedMotion = useReducedMotion();

  // Overview metrics
  const activeMonitorsCount = useMemo(() => monitors.filter((m) => m.is_active).length, [monitors]);
  const downMonitorsCount = useMemo(
    () => monitors.filter((m) => m.is_active && m.status === 'down').length,
    [monitors]
  );
  const healthPercentage = useMemo(() => {
    if (activeMonitorsCount === 0) return 100;
    return Math.round(((activeMonitorsCount - downMonitorsCount) / activeMonitorsCount) * 100);
  }, [activeMonitorsCount, downMonitorsCount]);

  // Filtered monitors list
  const filteredMonitors = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return monitors;
    return monitors.filter(
      (m) => m.name.toLowerCase().includes(term) || m.url.toLowerCase().includes(term)
    );
  }, [monitors, searchTerm]);

  // Motion variants for container and list items
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
    <div className="monitors-dashboard-view">
      {/* Overview Stat Cards Grid */}
      <div className="overview-stats-grid">
        <Card className="metric-stat-card">
          <div className="metric-stat-header">
            <span className="metric-stat-label">Total Endpoints</span>
            <Server size={18} className="metric-stat-icon" />
          </div>
          <div className="metric-stat-number">
            <NumberCounter value={monitors.length} />
          </div>
          <div className="metric-stat-meta">Configured targets</div>
        </Card>

        <Card className="metric-stat-card">
          <div className="metric-stat-header">
            <span className="metric-stat-label">Active Monitoring</span>
            <Activity size={18} className="metric-stat-icon active-icon" />
          </div>
          <div className="metric-stat-number">
            <NumberCounter value={activeMonitorsCount} />
          </div>
          <div className="metric-stat-meta">Periodic health checks</div>
        </Card>

        <Card className="metric-stat-card">
          <div className="metric-stat-header">
            <span className="metric-stat-label">Active Outages</span>
            <ShieldAlert
              size={18}
              className={`metric-stat-icon ${downMonitorsCount > 0 ? 'error-icon' : ''}`}
            />
          </div>
          <div
            className="metric-stat-number"
            style={{ color: downMonitorsCount > 0 ? 'var(--error)' : 'inherit' }}
          >
            <NumberCounter value={downMonitorsCount} />
          </div>
          <div className="metric-stat-meta">
            {downMonitorsCount === 0 ? 'All services operational' : 'Requires immediate attention'}
          </div>
        </Card>

        <Card className="metric-stat-card">
          <div className="metric-stat-header">
            <span className="metric-stat-label">Fleet Health</span>
            <CheckCircle
              size={18}
              className={`metric-stat-icon ${
                healthPercentage >= 99
                  ? 'success-icon'
                  : healthPercentage >= 80
                  ? 'warning-icon'
                  : 'error-icon'
              }`}
            />
          </div>
          <div
            className="metric-stat-number"
            style={{
              color:
                healthPercentage === 100
                  ? 'var(--success)'
                  : healthPercentage >= 80
                  ? 'var(--warning)'
                  : 'var(--error)',
            }}
          >
            <NumberCounter value={healthPercentage} suffix="%" />
          </div>
          <div className="metric-stat-meta">Live check availability</div>
        </Card>
      </div>

      {/* Search & Actions Bar */}
      <div className="table-controls-row">
        <div className="search-box-wrapper">
          <Search size={16} className="search-box-icon" />
          <input
            type="text"
            className="search-box-input"
            placeholder="Search by name or URL..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <div className="table-count-label">
          Showing <strong>{filteredMonitors.length}</strong> of {monitors.length} monitors
        </div>
      </div>

      {/* Monitors Table List */}
      {filteredMonitors.length > 0 ? (
        <Card padded={false} className="monitors-table-card">
          <div className="table-responsive">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Status</th>
                  <th>Endpoint & Target URL</th>
                  <th style={{ width: '110px' }}>Interval</th>
                  <th style={{ width: '140px' }}>Last Checked</th>
                  <th style={{ width: '130px' }}>State Changed</th>
                  <th style={{ width: '170px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <motion.tbody variants={containerVariants} initial="hidden" animate="show">
                {filteredMonitors.map((m) => {
                  const statusVariant = !m.is_active
                    ? 'neutral'
                    : m.status === 'up'
                    ? 'success'
                    : m.status === 'down'
                    ? 'error'
                    : 'warning';

                  return (
                    <motion.tr key={m.id} variants={itemVariants} className="table-row-item">
                      <td>
                        <div className="status-cell-wrap">
                          <PulseDot status={m.status} isActive={m.is_active} size="sm" />
                          <Badge variant={statusVariant} size="sm">
                            {!m.is_active ? 'Paused' : m.status.toUpperCase()}
                          </Badge>
                        </div>
                      </td>

                      <td>
                        <div className="endpoint-cell-title">
                          <button
                            type="button"
                            className="endpoint-title-btn"
                            onClick={() => onSelectMonitor(m)}
                          >
                            {m.name}
                          </button>
                        </div>
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="endpoint-url-link"
                          title="Open URL in new tab"
                        >
                          <span>{m.url}</span>
                          <ExternalLink size={12} className="url-link-icon" />
                        </a>
                      </td>

                      <td>
                        <span className="interval-pill">{m.interval_minutes}m</span>
                      </td>

                      <td className="timestamp-cell">
                        {m.last_checked_at
                          ? new Date(m.last_checked_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : '—'}
                      </td>

                      <td className="timestamp-cell">
                        {m.last_status_change_at ? getRelativeTime(m.last_status_change_at) : '—'}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div className="row-actions-group">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onToggleMonitor(m)}
                            icon={m.is_active ? <Pause size={13} /> : <Play size={13} />}
                            title={m.is_active ? 'Pause checks' : 'Resume checks'}
                          >
                            {m.is_active ? 'Pause' : 'Resume'}
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onSelectMonitor(m)}
                            icon={<ChevronRight size={14} />}
                          >
                            Metrics
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            </table>
          </div>
        </Card>
      ) : monitors.length === 0 ? (
        /* Empty State (No monitors configured) */
        <Card className="empty-state-card">
          <div className="empty-state-icon-wrap">
            <Server size={32} />
          </div>
          <h3 className="empty-state-title">No website endpoints configured yet</h3>
          <p className="empty-state-desc">
            Add your first website, API route, or web service to begin collecting live response-time
            latency metrics and receiving downtime alerts.
          </p>
          <div style={{ marginTop: '20px' }}>
            <Button
              variant="primary"
              size="md"
              icon={<Plus size={16} />}
              showArrow
              onClick={onOpenAddModal}
            >
              Add Your First Endpoint
            </Button>
          </div>
        </Card>
      ) : (
        /* Empty Search Filter Result */
        <Card className="empty-state-card">
          <div className="empty-state-icon-wrap">
            <Search size={28} />
          </div>
          <h3 className="empty-state-title">No matching endpoints found</h3>
          <p className="empty-state-desc">
            No monitors matched your search query "<strong>{searchTerm}</strong>". Try clearing your
            filter or searching by full hostname.
          </p>
          <div style={{ marginTop: '16px' }}>
            <Button variant="secondary" size="sm" onClick={() => onSearchChange('')}>
              Clear Search Filter
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
