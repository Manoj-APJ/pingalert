import React from 'react';
import { Menu, Plus, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import type { Monitor, ViewType } from '../../types';

interface HeaderProps {
  currentView: ViewType;
  selectedMonitor: Monitor | null;
  onBackToDashboard: () => void;
  onOpenAddMonitor: () => void;
  onOpenAddStatusPage: () => void;
  onToggleMobileNav: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  selectedMonitor,
  onBackToDashboard,
  onOpenAddMonitor,
  onOpenAddStatusPage,
  onToggleMobileNav,
}) => {
  const getHeaderTitle = () => {
    if (selectedMonitor) {
      return (
        <div className="header-monitor-crumb">
          <button
            type="button"
            className="breadcrumb-back-btn"
            onClick={onBackToDashboard}
            aria-label="Back to monitors dashboard"
          >
            <ArrowLeft size={16} />
            <span>Monitors</span>
          </button>
          <span className="crumb-divider">/</span>
          <span className="crumb-current">{selectedMonitor.name}</span>
          <Badge
            variant={
              !selectedMonitor.is_active
                ? 'neutral'
                : selectedMonitor.status === 'up'
                ? 'success'
                : selectedMonitor.status === 'down'
                ? 'error'
                : 'warning'
            }
            size="sm"
          >
            {!selectedMonitor.is_active ? 'Paused' : selectedMonitor.status.toUpperCase()}
          </Badge>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        return 'Website Monitors';
      case 'incidents':
        return 'Outages & Incidents';
      case 'status-pages':
        return 'Public Status Pages';
      case 'email-logs':
        return 'Dispatched Notifications';
      case 'settings':
        return 'Account & Settings';
      default:
        return 'Dashboard';
    }
  };

  return (
    <header className="top-app-header">
      <div className="header-left">
        <button
          type="button"
          className="mobile-nav-toggle-btn"
          onClick={onToggleMobileNav}
          aria-label="Open navigation menu"
        >
          <Menu size={20} />
        </button>
        <div className="header-title-container">{getHeaderTitle()}</div>
      </div>

      <div className="header-actions">
        {!selectedMonitor && currentView === 'dashboard' && (
          <Button
            variant="primary"
            size="md"
            icon={<Plus size={16} />}
            onClick={onOpenAddMonitor}
          >
            Add Monitor
          </Button>
        )}

        {!selectedMonitor && currentView === 'status-pages' && (
          <Button
            variant="primary"
            size="md"
            icon={<Plus size={16} />}
            onClick={onOpenAddStatusPage}
          >
            Create Status Page
          </Button>
        )}
      </div>
    </header>
  );
};
