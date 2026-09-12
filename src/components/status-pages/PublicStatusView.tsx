import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, ShieldCheck, Sun, Moon, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { PublicStatusData } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { PulseDot } from '../ui/PulseDot';
import { Skeleton } from '../ui/Skeleton';
import { UptimeCalendarGrid } from '../charts/UptimeCalendarGrid';
import { formatSeconds } from '../../lib/utils';
import { useTheme } from '../../context/useTheme';

interface PublicStatusViewProps {
  slug: string;
}

export const PublicStatusView: React.FC<PublicStatusViewProps> = ({ slug }) => {
  const [data, setData] = useState<PublicStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { theme, toggleTheme, setTheme } = useTheme();

  useEffect(() => {
    let isMounted = true;

    fetch(`/api/status-pages/public/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error('Status dashboard not found or has been disabled.');
        return res.json();
      })
      .then((d: PublicStatusData) => {
        if (isMounted) {
          setData(d);
          if (d.page?.theme && (d.page.theme === 'dark' || d.page.theme === 'light')) {
            setTheme(d.page.theme);
          }
          setIsLoading(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err.message || 'Unable to load status dashboard.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [slug, setTheme]);

  if (isLoading) {
    return (
      <div className="public-status-loading">
        <div className="public-status-skeleton-wrap">
          <Skeleton width="180px" height="32px" borderRadius="16px" />
          <Skeleton width="340px" height="48px" borderRadius="12px" style={{ marginTop: '20px' }} />
          <Skeleton width="100%" height="120px" borderRadius="20px" style={{ marginTop: '30px' }} />
          <Skeleton width="100%" height="280px" borderRadius="20px" style={{ marginTop: '24px' }} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="public-status-error-page">
        <div className="error-card-center">
          <div className="error-icon-circle">
            <AlertTriangle size={36} />
          </div>
          <h1 className="error-title">Status Dashboard Not Found</h1>
          <p className="error-desc">
            The status page URL you requested is not active or may have been deleted.
          </p>
          <a href="/" className="btn-pill btn-primary btn-md" style={{ marginTop: '20px' }}>
            Back to PingAlert Home
          </a>
        </div>
      </div>
    );
  }

  const { page, monitors, overallStatus, dailyHistories, recentIncidents } = data;

  const isAllOperational = overallStatus === 'operational';
  const isPartialOutage = overallStatus === 'partial_outage';
  const isPending = overallStatus === 'pending';

  return (
    <div className="public-status-page">
      {/* Top Header */}
      <header className="public-status-nav">
        <div className="public-status-brand">
          {page.logo_url ? (
            <img src={page.logo_url} alt="" className="public-logo-img" />
          ) : (
            <div className="public-brand-mark">
              <Activity size={20} />
            </div>
          )}
          <span className="public-brand-title">{page.title}</span>
        </div>

        <button
          type="button"
          className="public-theme-pill-btn"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </header>

      {/* Main Container */}
      <main className="public-status-main">
        {/* Editorial Hero Banner */}
        <div className="public-status-hero">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="public-badge-wrap"
          >
            <Badge
              variant={isAllOperational ? 'success' : isPartialOutage ? 'warning' : isPending ? 'info' : 'error'}
              leadingText="Live Status:"
            >
              {isAllOperational
                ? 'All Systems Operational'
                : isPartialOutage
                ? 'Partial Service Degraded'
                : isPending
                ? 'Awaiting Initial Checks'
                : 'Major System Outage'}
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' }}
            className="public-hero-headline"
          >
            {page.title}
          </motion.h1>

          {page.description && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16, ease: 'easeOut' }}
              className="public-hero-description"
            >
              {page.description}
            </motion.p>
          )}
        </div>

        {/* Live Status Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2, ease: 'easeOut' }}
        >
          <div
            className={`public-overall-banner ${
              isAllOperational
                ? 'banner-operational'
                : isPartialOutage
                ? 'banner-partial'
                : isPending
                ? 'banner-pending'
                : 'banner-outage'
            }`}
          >
            <div className="banner-left">
              {isAllOperational ? (
                <CheckCircle2 size={24} className="banner-status-icon" />
              ) : isPartialOutage ? (
                <AlertTriangle size={24} className="banner-status-icon" />
              ) : (
                <Activity size={24} className="banner-status-icon" />
              )}
              <div className="banner-text-group">
                <span className="banner-headline">
                  {isAllOperational
                    ? 'All systems are operating normally'
                    : isPartialOutage
                    ? 'Some endpoints are experiencing degradation'
                    : isPending
                    ? 'Health checks are being scheduled'
                    : 'A critical service outage has been detected'}
                </span>
                <span className="banner-subtext">
                  Automated checks run continuously from global monitoring nodes.
                </span>
              </div>
            </div>

            <div className="banner-right">
              <span className="live-pulse-badge">
                <span className="live-dot" /> Live
              </span>
            </div>
          </div>
        </motion.div>

        {/* System Components Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.28, ease: 'easeOut' }}
        >
          <Card className="public-components-card">
            <div className="public-card-header">
              <h2 className="public-section-title">System Components</h2>
              <span className="public-section-meta">Past 30 Days Availability</span>
            </div>

            <div className="public-components-list">
              {monitors.map((m) => {
                const history = dailyHistories[m.id] || [];
                const statusVariant = m.status === 'up' ? 'success' : m.status === 'down' ? 'error' : 'warning';

                return (
                  <div key={m.id} className="public-component-row">
                    <div className="public-comp-top">
                      <div className="public-comp-info">
                        <PulseDot status={m.status} size="sm" />
                        <span className="public-comp-name">{m.name}</span>
                      </div>
                      <Badge variant={statusVariant} size="sm">
                        {m.status === 'up' ? 'Operational' : m.status === 'down' ? 'Outage' : 'Pending'}
                      </Badge>
                    </div>

                    <div className="public-comp-calendar">
                      <UptimeCalendarGrid dailyHistory={history} />
                      <div className="calendar-axis-labels">
                        <span>30 days ago</span>
                        <span>Today</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {monitors.length === 0 && (
                <div className="no-monitors-public">
                  No components have been configured for this status page.
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Incident History Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.35, ease: 'easeOut' }}
        >
          <div className="public-incidents-block">
            <h2 className="public-section-title" style={{ marginBottom: '16px' }}>
              Past Incident History
            </h2>

            {recentIncidents.length > 0 ? (
              <div className="public-incidents-timeline">
                {recentIncidents.map((incident) => {
                  const durationSec = incident.ended_at
                    ? Math.floor(
                        (new Date(incident.ended_at).getTime() -
                          new Date(incident.started_at).getTime()) /
                          1000
                      )
                    : null;

                  return (
                    <div key={incident.id} className="public-incident-card">
                      <div className="incident-card-top">
                        <h3 className="incident-card-title">
                          {incident.monitor_name}: Service Disruption
                        </h3>
                        <Badge variant={incident.is_resolved ? 'success' : 'error'} size="sm">
                          {incident.is_resolved ? 'Resolved' : 'Active Outage'}
                        </Badge>
                      </div>

                      <div className="incident-timestamp-meta">
                        <Clock size={13} />
                        <span>Started {new Date(incident.started_at).toLocaleString()}</span>
                        {incident.ended_at && (
                          <span> · Resolved {new Date(incident.ended_at).toLocaleString()}</span>
                        )}
                        {durationSec !== null && (
                          <span> ({formatSeconds(durationSec)} duration)</span>
                        )}
                      </div>

                      <p className="incident-desc-text">
                        {incident.is_resolved ? (
                          <>
                            The service experienced temporary latency or connection failure (
                            <code>{incident.cause || 'Network Timeout'}</code>). All automated checks
                            have recovered and the endpoint is responding normally.
                          </>
                        ) : (
                          <>
                            Our monitoring system detected connection issues (
                            <code>{incident.cause || 'Network Timeout'}</code>). Engineers are actively
                            investigating.
                          </>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Card className="no-incidents-card">
                <ShieldCheck size={28} className="no-incidents-icon" />
                <span className="no-incidents-text">
                  No incidents reported. All systems maintained 100% operational uptime.
                </span>
              </Card>
            )}
          </div>
        </motion.div>

        {/* Public Footer */}
        <footer className="public-status-footer">
          <div className="footer-brand-pill">
            <span>Powered by</span>
            <strong>🚨 PingAlert</strong>
          </div>
        </footer>
      </main>
    </div>
  );
};
