import React from 'react';
import {
  Activity,
  Flame,
  LayoutDashboard,
  Mail,
  Settings,
  Sun,
  Moon,
  LogOut,
  X,
} from 'lucide-react';
import type { ViewType, User } from '../../types';
import { useTheme } from '../../context/useTheme';

interface SidebarProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  user: User | null;
  onLogout: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  user,
  onLogout,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const { theme, toggleTheme } = useTheme();

  const navItems: { view: ViewType; label: string; icon: React.ReactNode }[] = [
    { view: 'dashboard', label: 'Monitors', icon: <LayoutDashboard size={18} /> },
    { view: 'incidents', label: 'Incidents & Outages', icon: <Flame size={18} /> },
    { view: 'status-pages', label: 'Status Dashboards', icon: <Activity size={18} /> },
    { view: 'email-logs', label: 'Notification Logs', icon: <Mail size={18} /> },
    { view: 'settings', label: 'Settings', icon: <Settings size={18} /> },
  ];

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpenMobile && (
        <div
          className="sidebar-mobile-backdrop"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside className={`app-sidebar ${isOpenMobile ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand-header">
          <div className="sidebar-brand">
            <div className="brand-mark-sm">
              <Activity size={18} />
            </div>
            <span className="brand-title">PingAlert</span>
          </div>
          {isOpenMobile && (
            <button
              type="button"
              className="sidebar-close-btn"
              onClick={onCloseMobile}
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="sidebar-nav">
          <ul className="sidebar-menu-list">
            {navItems.map((item) => {
              const isActive = currentView === item.view;
              return (
                <li key={item.view}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectView(item.view);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-user-footer">
          <div className="user-profile-row">
            <div className="user-avatar-circle">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-details">
              <div className="user-name-text">{user?.name || 'Developer'}</div>
              <div className="user-email-text">{user?.email || 'admin@pingalert.dev'}</div>
            </div>
          </div>

          <div className="sidebar-action-row">
            <button
              type="button"
              className="sidebar-theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>

            <button
              type="button"
              className="sidebar-logout-btn"
              onClick={onLogout}
              aria-label="Sign out"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
