import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Activity, ExternalLink, Copy, Trash2, Plus, Globe } from 'lucide-react';
import type { StatusPage } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useToast } from '../../context/useToast';

interface StatusPageListProps {
  statusPages: StatusPage[];
  onDelete: (pageId: string) => void;
  onOpenAddModal: () => void;
  isLoading?: boolean;
}

export const StatusPageList: React.FC<StatusPageListProps> = ({
  statusPages = [],
  onDelete,
  onOpenAddModal,
}) => {
  const { showToast } = useToast();
  const prefersReducedMotion = useReducedMotion();

  const handleCopyLink = (slug: string) => {
    const fullUrl = `${window.location.origin}/status/${slug}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      showToast('Public status page URL copied to clipboard', 'success');
    });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: prefersReducedMotion
        ? { duration: 0.05 }
        : { staggerChildren: 0.06, delayChildren: 0.05 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.25, ease: 'easeOut' as const },
    },
  };

  return (
    <div className="status-pages-view-container">
      <div className="view-intro-header">
        <div>
          <h2 className="view-headline">Public Status Dashboards</h2>
          <p className="view-subtext">
            Publish client-facing status dashboards to communicate scheduled maintenance and real-time
            availability.
          </p>
        </div>
      </div>

      {statusPages.length > 0 ? (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="status-cards-grid"
        >
          {statusPages.map((page) => (
            <motion.div key={page.id} variants={itemVariants}>
              <Card interactive className="status-dashboard-card">
                <div className="status-card-header">
                  <div className="status-card-title-group">
                    {page.logo_url ? (
                      <img src={page.logo_url} alt="" className="status-card-logo" />
                    ) : (
                      <div className="status-card-icon-mark">
                        <Activity size={18} />
                      </div>
                    )}
                    <div>
                      <h3 className="status-card-name">{page.title}</h3>
                      <div className="status-card-slug">/status/{page.slug}</div>
                    </div>
                  </div>

                  <Badge variant={page.theme === 'dark' ? 'neutral' : 'info'} size="sm">
                    {page.theme} theme
                  </Badge>
                </div>

                <p className="status-card-desc">
                  {page.description || 'Live availability metrics and incident communications.'}
                </p>

                <div className="status-card-meta">
                  <span className="meta-pill">
                    <Globe size={13} style={{ marginRight: '4px' }} />
                    {page.monitor_ids ? page.monitor_ids.length : 0} endpoints attached
                  </span>
                </div>

                <div className="status-card-actions">
                  <a
                    href={`/status/${page.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-pill btn-primary btn-sm status-open-btn"
                  >
                    <span>View Page</span>
                    <ExternalLink size={13} />
                  </a>

                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Copy size={13} />}
                    onClick={() => handleCopyLink(page.slug)}
                    title="Copy URL"
                  >
                    Copy Link
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={() => onDelete(page.id)}
                    title="Delete status page"
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <Card className="empty-state-card">
          <div className="empty-state-icon-wrap">
            <Activity size={36} />
          </div>
          <h3 className="empty-state-title">No public status pages configured</h3>
          <p className="empty-state-desc">
            Build a branded, public-facing status page for your users to view uptime SLAs, recent
            incidents, and service operational status.
          </p>
          <div style={{ marginTop: '20px' }}>
            <Button
              variant="primary"
              size="md"
              icon={<Plus size={16} />}
              showArrow
              onClick={onOpenAddModal}
            >
              Create Your First Status Page
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
