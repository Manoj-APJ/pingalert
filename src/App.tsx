import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { User, Monitor, Incident, StatusPage, EmailLog, ViewType } from './types';
import { apiRequest, TOKEN_KEY } from './lib/api';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { useToast } from './context/useToast';
import { AuthView } from './components/auth/AuthView';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MonitorList } from './components/monitors/MonitorList';
import { AddMonitorModal } from './components/monitors/AddMonitorModal';
import { AddStatusPageModal } from './components/status-pages/AddStatusPageModal';
import { Skeleton } from './components/ui/Skeleton';

// Lazy-loaded heavier view components for code-splitting & performance
const LazyMonitorDetail = lazy(() =>
  import('./components/monitors/MonitorDetail').then((m) => ({ default: m.MonitorDetail }))
);
const LazyIncidentList = lazy(() =>
  import('./components/incidents/IncidentList').then((m) => ({ default: m.IncidentList }))
);
const LazyStatusPageList = lazy(() =>
  import('./components/status-pages/StatusPageList').then((m) => ({ default: m.StatusPageList }))
);
const LazyEmailLogsList = lazy(() =>
  import('./components/email-logs/EmailLogsList').then((m) => ({ default: m.EmailLogsList }))
);
const LazySettingsView = lazy(() =>
  import('./components/settings/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const LazyPublicStatusView = lazy(() =>
  import('./components/status-pages/PublicStatusView').then((m) => ({ default: m.PublicStatusView }))
);

function AppContent() {
  const { showToast } = useToast();

  // Routing & Auth state
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [publicStatusSlug] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/status/')) {
      return window.location.pathname.split('/')[2] || null;
    }
    return null;
  });

  // App Data
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [globalIncidents, setGlobalIncidents] = useState<Incident[]>([]);
  const [statusPages, setStatusPages] = useState<StatusPage[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [showAddMonitorModal, setShowAddMonitorModal] = useState(false);
  const [showAddStatusPageModal, setShowAddStatusPageModal] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setSelectedMonitor(null);
    setCurrentView('dashboard');
    showToast('You have been signed out.', 'info');
  }, [showToast]);

  const loadAppData = useCallback(async () => {
    try {
      const [monitorList, incidentList, pagesList, logsList] = await Promise.all([
        apiRequest<Monitor[]>('/api/monitors'),
        apiRequest<Incident[]>('/api/monitors/incidents'),
        apiRequest<StatusPage[]>('/api/status-pages'),
        apiRequest<EmailLog[]>('/api/monitors/email-logs'),
      ]);
      setMonitors(monitorList);
      setGlobalIncidents(incidentList);
      setStatusPages(pagesList);
      setEmailLogs(logsList);
    } catch (err) {
      console.error('Failed to load application data:', err);
    }
  }, []);

  // Check auth and load profile on mount
  useEffect(() => {
    if (token && !publicStatusSlug) {
      apiRequest<User>('/api/auth/me')
        .then((profile) => {
          setUser(profile);
          loadAppData();
        })
        .catch((err) => {
          console.error(err);
          handleLogout();
        });
    }
  }, [token, publicStatusSlug, loadAppData, handleLogout]);

  const handleAuthSuccess = (authenticatedUser: User, authToken: string) => {
    setToken(authToken);
    setUser(authenticatedUser);
    showToast(`Welcome back, ${authenticatedUser.name}!`, 'success');
  };

  // Add Monitor Action
  const handleAddMonitor = async (data: {
    name: string;
    url: string;
    interval_minutes: number;
    timeout_seconds: number;
  }) => {
    const newMonitor = await apiRequest<Monitor>('/api/monitors', 'POST', data);
    setMonitors((prev) => [...prev, newMonitor]);
    showToast(`Created monitor "${newMonitor.name}" successfully`, 'success');
  };

  // Toggle Pause / Resume
  const handleToggleMonitor = async (monitor: Monitor) => {
    try {
      const updated = await apiRequest<Monitor>(`/api/monitors/${monitor.id}`, 'PUT', {
        is_active: !monitor.is_active,
      });
      setMonitors((prev) => prev.map((m) => (m.id === monitor.id ? updated : m)));
      if (selectedMonitor && selectedMonitor.id === monitor.id) {
        setSelectedMonitor(updated);
      }
      showToast(
        `Monitor ${updated.name} ${updated.is_active ? 'resumed' : 'paused'}`,
        'info'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to update monitor state', 'error');
    }
  };

  // Delete Monitor Action
  const handleDeleteMonitor = async (monitorId: string) => {
    if (!window.confirm('Are you sure you want to delete this monitor? Historical uptime metrics will be lost.')) {
      return;
    }
    try {
      await apiRequest(`/api/monitors/${monitorId}`, 'DELETE');
      setMonitors((prev) => prev.filter((m) => m.id !== monitorId));
      setSelectedMonitor(null);
      showToast('Monitor removed successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete monitor', 'error');
    }
  };

  // Add Status Page Action
  const handleAddStatusPage = async (data: {
    title: string;
    slug: string;
    description: string;
    logo_url: string;
    theme: 'dark' | 'light';
    monitor_ids: string[];
  }) => {
    const newPage = await apiRequest<StatusPage>('/api/status-pages', 'POST', data);
    setStatusPages((prev) => [...prev, newPage]);
    showToast(`Status page "${newPage.title}" created`, 'success');
  };

  // Delete Status Page Action
  const handleDeleteStatusPage = async (pageId: string) => {
    if (!window.confirm('Are you sure you want to delete this public status page?')) {
      return;
    }
    try {
      await apiRequest(`/api/status-pages/${pageId}`, 'DELETE');
      setStatusPages((prev) => prev.filter((p) => p.id !== pageId));
      showToast('Status page deleted', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete status page', 'error');
    }
  };

  // 1. Render Public Status Page (Unauthenticated / Public Route)
  if (publicStatusSlug) {
    return (
      <Suspense
        fallback={
          <div className="view-loading-fallback">
            <Skeleton width="180px" height="32px" borderRadius="16px" />
            <Skeleton width="340px" height="48px" borderRadius="12px" style={{ marginTop: '20px' }} />
          </div>
        }
      >
        <LazyPublicStatusView slug={publicStatusSlug} />
      </Suspense>
    );
  }

  // 2. Render Unauthenticated Auth Screen
  if (!token) {
    return <AuthView onAuthSuccess={handleAuthSuccess} />;
  }

  // 3. Render Authenticated Dashboard Layout
  return (
    <div className="app-shell-layout">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onSelectView={(view) => {
          setCurrentView(view);
          setSelectedMonitor(null);
        }}
        user={user}
        onLogout={handleLogout}
        isOpenMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Content Pane */}
      <div className="app-main-pane">
        <Header
          currentView={currentView}
          selectedMonitor={selectedMonitor}
          onBackToDashboard={() => setSelectedMonitor(null)}
          onOpenAddMonitor={() => setShowAddMonitorModal(true)}
          onOpenAddStatusPage={() => setShowAddStatusPageModal(true)}
          onToggleMobileNav={() => setIsMobileNavOpen((prev) => !prev)}
        />

        <main className="app-content-body">
          <AnimatePresence mode="wait">
            {selectedMonitor ? (
              <Suspense
                key={`monitor-detail-${selectedMonitor.id}`}
                fallback={
                  <div className="view-loading-fallback">
                    <Skeleton width="220px" height="36px" borderRadius="12px" />
                    <Skeleton width="100%" height="180px" borderRadius="18px" style={{ marginTop: '20px' }} />
                    <Skeleton width="100%" height="240px" borderRadius="18px" style={{ marginTop: '20px' }} />
                  </div>
                }
              >
                <LazyMonitorDetail
                  monitor={selectedMonitor}
                  onBack={() => setSelectedMonitor(null)}
                  onToggleActive={handleToggleMonitor}
                  onDelete={handleDeleteMonitor}
                />
              </Suspense>
            ) : currentView === 'dashboard' ? (
              <motion.div
                key="view-dashboard"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <MonitorList
                  monitors={monitors}
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  onSelectMonitor={setSelectedMonitor}
                  onToggleMonitor={handleToggleMonitor}
                  onOpenAddModal={() => setShowAddMonitorModal(true)}
                />
              </motion.div>
            ) : currentView === 'incidents' ? (
              <Suspense
                key="view-incidents"
                fallback={
                  <div className="view-loading-fallback">
                    <Skeleton width="200px" height="32px" />
                    <Skeleton width="100%" height="300px" borderRadius="18px" style={{ marginTop: '20px' }} />
                  </div>
                }
              >
                <LazyIncidentList incidents={globalIncidents} />
              </Suspense>
            ) : currentView === 'status-pages' ? (
              <Suspense
                key="view-status-pages"
                fallback={
                  <div className="view-loading-fallback">
                    <Skeleton width="200px" height="32px" />
                    <Skeleton width="100%" height="200px" borderRadius="18px" style={{ marginTop: '20px' }} />
                  </div>
                }
              >
                <LazyStatusPageList
                  statusPages={statusPages}
                  onDelete={handleDeleteStatusPage}
                  onOpenAddModal={() => setShowAddStatusPageModal(true)}
                />
              </Suspense>
            ) : currentView === 'email-logs' ? (
              <Suspense
                key="view-email-logs"
                fallback={
                  <div className="view-loading-fallback">
                    <Skeleton width="200px" height="32px" />
                    <Skeleton width="100%" height="300px" borderRadius="18px" style={{ marginTop: '20px' }} />
                  </div>
                }
              >
                <LazyEmailLogsList emailLogs={emailLogs} />
              </Suspense>
            ) : (
              <Suspense
                key="view-settings"
                fallback={
                  <div className="view-loading-fallback">
                    <Skeleton width="200px" height="32px" />
                    <Skeleton width="100%" height="240px" borderRadius="18px" style={{ marginTop: '20px' }} />
                  </div>
                }
              >
                <LazySettingsView user={user} totalMonitorsCount={monitors.length} />
              </Suspense>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Modals */}
      <AddMonitorModal
        isOpen={showAddMonitorModal}
        onClose={() => setShowAddMonitorModal(false)}
        onSubmit={handleAddMonitor}
      />

      <AddStatusPageModal
        isOpen={showAddStatusPageModal}
        onClose={() => setShowAddStatusPageModal(false)}
        monitors={monitors}
        onSubmit={handleAddStatusPage}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
}
