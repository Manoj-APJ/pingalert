import React, { useState, useEffect } from 'react';

// API Fetch helper
const apiRequest = async (url: string, method = 'GET', body: any = null) => {
  const token = localStorage.getItem('pingalert_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options: RequestInit = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
  }
  return res.json();
};

export default function App() {
  // Routing and Auth states
  const [token, setToken] = useState<string | null>(localStorage.getItem('pingalert_token'));
  const [user, setUser] = useState<any>(null);
  const [currentView, setCurrentView] = useState<string>('dashboard'); // dashboard, incidents, status-pages, settings
  const [publicStatusSlug, setPublicStatusSlug] = useState<string | null>(null);
  
  // Theme state
  const [theme, setTheme] = useState<string>(localStorage.getItem('pingalert_theme') || 'dark');

  // Monitors & Incidents data
  const [monitors, setMonitors] = useState<any[]>([]);
  const [globalIncidents, setGlobalIncidents] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [statusPages, setStatusPages] = useState<any[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState<any>(null);
  const [monitorStats, setMonitorStats] = useState<any>(null);
  const [monitorIncidents, setMonitorIncidents] = useState<any[]>([]);

  // Auth Forms state
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Modals and Forms state
  const [showAddMonitorModal, setShowAddMonitorModal] = useState(false);
  const [newMonitorName, setNewMonitorName] = useState('');
  const [newMonitorUrl, setNewMonitorUrl] = useState('');
  const [newMonitorInterval, setNewMonitorInterval] = useState('5');
  const [newMonitorTimeout, setNewMonitorTimeout] = useState('10');
  const [monitorFormError, setMonitorFormError] = useState('');

  const [showAddStatusPageModal, setShowAddStatusPageModal] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageSlug, setNewPageSlug] = useState('');
  const [newPageDesc, setNewPageDesc] = useState('');
  const [newPageLogo, setNewPageLogo] = useState('');
  const [newPageTheme, setNewPageTheme] = useState('dark');
  const [newPageMonitors, setNewPageMonitors] = useState<string[]>([]);
  const [statusPageFormError, setStatusPageFormError] = useState('');

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Parse path for public status page
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/status/')) {
      const slug = path.split('/')[2];
      setPublicStatusSlug(slug);
    }
  }, []);

  // Theme effect
  useEffect(() => {
    const body = document.body;
    if (theme === 'light') {
      body.classList.add('light-theme');
    } else {
      body.classList.remove('light-theme');
    }
    localStorage.setItem('pingalert_theme', theme);
  }, [theme]);

  // Load User and App Data
  useEffect(() => {
    if (token && !publicStatusSlug) {
      // Fetch user profile info
      apiRequest('/api/auth/me')
        .then(profile => {
          setUser(profile);
          loadAppData();
        })
        .catch(err => {
          console.error(err);
          handleLogout();
        });
    }
  }, [token, publicStatusSlug]);

  const loadAppData = async () => {
    try {
      const monitorList = await apiRequest('/api/monitors');
      setMonitors(monitorList);

      const incidentList = await apiRequest('/api/monitors/incidents');
      setGlobalIncidents(incidentList);

      const pagesList = await apiRequest('/api/status-pages');
      setStatusPages(pagesList);

      const logsList = await apiRequest('/api/monitors/email-logs');
      setEmailLogs(logsList);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await apiRequest('/api/auth/login', 'POST', {
        email: authEmail,
        password: authPassword,
      });
      localStorage.setItem('pingalert_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setAuthPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Login failed');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await apiRequest('/api/auth/register', 'POST', {
        name: authName,
        email: authEmail,
        password: authPassword,
      });
      localStorage.setItem('pingalert_token', res.token);
      setToken(res.token);
      setUser(res.user);
      setAuthPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('pingalert_token');
    setToken(null);
    setUser(null);
    setSelectedMonitor(null);
    setCurrentView('dashboard');
  };

  // Add Monitor
  const handleAddMonitor = async (e: React.FormEvent) => {
    e.preventDefault();
    setMonitorFormError('');
    try {
      const newMonitor = await apiRequest('/api/monitors', 'POST', {
        name: newMonitorName,
        url: newMonitorUrl,
        interval_minutes: parseInt(newMonitorInterval, 10),
        timeout_seconds: parseInt(newMonitorTimeout, 10),
      });

      setMonitors([...monitors, newMonitor]);
      setShowAddMonitorModal(false);
      
      // Reset inputs
      setNewMonitorName('');
      setNewMonitorUrl('');
      setNewMonitorInterval('5');
      setNewMonitorTimeout('10');
    } catch (err: any) {
      setMonitorFormError(err.message || 'Failed to create monitor');
    }
  };

  // Toggle monitor pause/resume
  const handleToggleMonitor = async (monitor: any) => {
    try {
      const updated = await apiRequest(`/api/monitors/${monitor.id}`, 'PUT', {
        is_active: !monitor.is_active,
      });
      setMonitors(monitors.map(m => m.id === monitor.id ? updated : m));
      if (selectedMonitor && selectedMonitor.id === monitor.id) {
        setSelectedMonitor(updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Monitor
  const handleDeleteMonitor = async (monitorId: string) => {
    if (!confirm('Are you sure you want to delete this monitor? All historical stats will be lost.')) return;
    try {
      await apiRequest(`/api/monitors/${monitorId}`, 'DELETE');
      setMonitors(monitors.filter(m => m.id !== monitorId));
      setSelectedMonitor(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch stats for detail view
  const handleViewDetails = async (monitor: any) => {
    setSelectedMonitor(monitor);
    setMonitorStats(null);
    setMonitorIncidents([]);
    try {
      const stats = await apiRequest(`/api/monitors/${monitor.id}/stats`);
      setMonitorStats(stats);

      const incidents = await apiRequest(`/api/monitors/${monitor.id}/incidents`);
      setMonitorIncidents(incidents);
    } catch (err) {
      console.error(err);
    }
  };

  // Add Status Page
  const handleAddStatusPage = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusPageFormError('');
    try {
      const newPage = await apiRequest('/api/status-pages', 'POST', {
        title: newPageTitle,
        slug: newPageSlug,
        description: newPageDesc,
        logo_url: newPageLogo,
        theme: newPageTheme,
        monitor_ids: newPageMonitors
      });

      setStatusPages([...statusPages, newPage]);
      setShowAddStatusPageModal(false);

      // Reset
      setNewPageTitle('');
      setNewPageSlug('');
      setNewPageDesc('');
      setNewPageLogo('');
      setNewPageTheme('dark');
      setNewPageMonitors([]);
    } catch (err: any) {
      setStatusPageFormError(err.message || 'Failed to create status page');
    }
  };

  // Delete Status Page
  const handleDeleteStatusPage = async (pageId: string) => {
    if (!confirm('Are you sure you want to delete this status page?')) return;
    try {
      await apiRequest(`/api/status-pages/${pageId}`, 'DELETE');
      setStatusPages(statusPages.filter(p => p.id !== pageId));
    } catch (err) {
      console.error(err);
    }
  };

  // Render Public Status Page Component
  if (publicStatusSlug) {
    return <PublicStatusView slug={publicStatusSlug} theme={theme} setTheme={setTheme} />;
  }

  // Render unauthenticated login/signup card
  if (!token) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-logo">🚨 PingAlert</h1>
            <p className="auth-subtitle">Production-grade website monitoring</p>
          </div>

          {authError && <div className="badge badge-error" style={{ width: '100%', justifyContent: 'center', marginBottom: '20px', borderRadius: '6px', textTransform: 'none' }}>{authError}</div>}

          {authView === 'login' ? (
            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@company.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>Log In</button>
              <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Don't have an account?{' '}
                <a href="#register" onClick={() => { setAuthView('register'); setAuthError(''); }}>Create an Account</a>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@company.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Min 6 characters"
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>Sign Up</button>
              <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Already have an account?{' '}
                <a href="#login" onClick={() => { setAuthView('login'); setAuthError(''); }}>Log In</a>
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Calculate quick overview metrics
  const activeMonitorsCount = monitors.filter(m => m.is_active).length;
  const downMonitorsCount = monitors.filter(m => m.is_active && m.status === 'down').length;
  
  // Calculate average response times from active ones
  const filteredMonitors = monitors.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>🚨</span> PingAlert
        </div>
        
        <ul className="sidebar-menu">
          <li 
            className={`sidebar-item ${currentView === 'dashboard' && !selectedMonitor ? 'active' : ''}`}
            onClick={() => { setCurrentView('dashboard'); setSelectedMonitor(null); }}
          >
            📊 Monitors Dashboard
          </li>
          <li 
            className={`sidebar-item ${currentView === 'incidents' ? 'active' : ''}`}
            onClick={() => { setCurrentView('incidents'); setSelectedMonitor(null); }}
          >
            🔥 Outages & Incidents
          </li>
          <li 
            className={`sidebar-item ${currentView === 'status-pages' ? 'active' : ''}`}
            onClick={() => { setCurrentView('status-pages'); setSelectedMonitor(null); }}
          >
            🖥️ Public Status Pages
          </li>
          <li 
            className={`sidebar-item ${currentView === 'email-logs' ? 'active' : ''}`}
            onClick={() => { setCurrentView('email-logs'); setSelectedMonitor(null); }}
          >
            ✉️ Email Alert Logs
          </li>
          <li 
            className={`sidebar-item ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => { setCurrentView('settings'); setSelectedMonitor(null); }}
          >
            ⚙️ Account Settings
          </li>
        </ul>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{user?.name || 'Logged In'}</span>
            <button 
              className="btn btn-secondary" 
              style={{ padding: '4px 8px', fontSize: '12px' }}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>
          </div>
          <button 
            className="btn btn-danger" 
            style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        <header className="header">
          <div className="header-title">
            {selectedMonitor ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <a href="#back" onClick={() => setSelectedMonitor(null)} style={{ fontSize: '14px', marginRight: '8px' }}>← Back</a>
                <span>{selectedMonitor.name}</span>
                <span className={`badge ${selectedMonitor.status === 'up' ? 'badge-success' : selectedMonitor.status === 'down' ? 'badge-error' : 'badge-warning'}`}>
                  {selectedMonitor.status}
                </span>
              </div>
            ) : (
              currentView === 'dashboard' ? 'Uptime Monitoring' : 
              currentView === 'incidents' ? 'Downtime Incident History' :
              currentView === 'status-pages' ? 'Status Page Configurator' :
              currentView === 'email-logs' ? 'Alert Log History (50 Days)' :
              'Account Overview'
            )}
          </div>

          <div className="header-actions">
            {!selectedMonitor && currentView === 'dashboard' && (
              <button className="btn btn-primary" onClick={() => setShowAddMonitorModal(true)}>+ Add Monitor</button>
            )}
            {!selectedMonitor && currentView === 'status-pages' && (
              <button className="btn btn-primary" onClick={() => setShowAddStatusPageModal(true)}>+ Create Status Page</button>
            )}
          </div>
        </header>

        <div className="content-body">
          {selectedMonitor ? (
            /* =========================================================
               DETAILED MONITOR VIEW
               ========================================================= */
            <div>
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-label">Current Status</span>
                  <span className="stat-value" style={{ color: selectedMonitor.status === 'up' ? 'var(--success)' : selectedMonitor.status === 'down' ? 'var(--error)' : 'var(--warning)' }}>
                    {selectedMonitor.status.toUpperCase()}
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">30-Day Uptime</span>
                  <span className="stat-value">
                    {monitorStats ? `${monitorStats.uptimePercentage}%` : 'Loading...'}
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Avg Latency (30d)</span>
                  <span className="stat-value">
                    {monitorStats ? `${monitorStats.avgResponseTimeMs} ms` : 'Loading...'}
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Check Interval</span>
                  <span className="stat-value">{selectedMonitor.interval_minutes}m</span>
                </div>
              </div>

              {/* 30-Day Status Bar Grid */}
              <div className="card">
                <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>30-Day Availability History</h3>
                {monitorStats ? (
                  <div>
                    <UptimeCalendarGrid dailyHistory={monitorStats.dailyHistory} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                      <span>30 days ago</span>
                      <span>Today</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading history calendar...</div>
                )}
              </div>

              {/* SVG Area Chart for Response Times */}
              <div className="card">
                <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Response Time Latency (Last 24h)</h3>
                {monitorStats ? (
                  <SvgAreaChart history={monitorStats.hourlyHistory} />
                ) : (
                  <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    Loading performance chart...
                  </div>
                )}
              </div>

              {/* Incident History Grid */}
              <div className="card">
                <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Incident History Logs</h3>
                {monitorIncidents.length > 0 ? (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Start Time</th>
                          <th>End Time</th>
                          <th>Duration</th>
                          <th>Cause</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monitorIncidents.map((incident: any) => (
                          <tr key={incident.id}>
                            <td>{new Date(incident.started_at).toLocaleString()}</td>
                            <td>{incident.ended_at ? new Date(incident.ended_at).toLocaleString() : '—'}</td>
                            <td>
                              {incident.ended_at 
                                ? formatSeconds(Math.floor((new Date(incident.ended_at).getTime() - new Date(incident.started_at).getTime()) / 1000))
                                : 'Active outage'}
                            </td>
                            <td><code>{incident.cause || 'Network Timeout'}</code></td>
                            <td>
                              <span className={`badge ${incident.is_resolved ? 'badge-success' : 'badge-error'}`}>
                                {incident.is_resolved ? 'Resolved' : 'Critical'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-secondary)', padding: '10px 0' }}>No incidents recorded for this website.</p>
                )}
              </div>

              {/* Control Options */}
              <div className="card" style={{ display: 'flex', gap: '16px', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                <div style={{ flexGrow: 1 }}>
                  <h4 style={{ color: 'var(--error)', marginBottom: '4px' }}>Danger Zone</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Deleting this website monitor removes all stored uptime statistics and outage incident logs permanently.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button className="btn btn-danger" onClick={() => handleDeleteMonitor(selectedMonitor.id)}>Delete Monitor</button>
                </div>
              </div>
            </div>
          ) : currentView === 'dashboard' ? (
            /* =========================================================
               MONITORS DASHBOARD OVERVIEW
               ========================================================= */
            <div>
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-label">Total Monitors</span>
                  <span className="stat-value">{monitors.length}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Active Checks</span>
                  <span className="stat-value">{activeMonitorsCount}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Active Outages</span>
                  <span className="stat-value" style={{ color: downMonitorsCount > 0 ? 'var(--error)' : 'inherit' }}>
                    {downMonitorsCount}
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">System Health</span>
                  <span className="stat-value" style={{ color: downMonitorsCount === 0 ? 'var(--success)' : 'var(--warning)' }}>
                    {downMonitorsCount === 0 ? '100%' : `${Math.round(((activeMonitorsCount - downMonitorsCount) / activeMonitorsCount) * 100)}%`}
                  </span>
                </div>
              </div>

              {/* Search and Filters */}
              <div style={{ marginBottom: '24px' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ maxWidth: '400px' }}
                  placeholder="Search websites by name or URL..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Monitors list */}
              {filteredMonitors.length > 0 ? (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Name & Target URL</th>
                          <th>Interval</th>
                          <th>Last Checked</th>
                          <th>State Change</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMonitors.map((m: any) => (
                          <tr key={m.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className={`pulse-dot ${!m.is_active ? 'unknown' : m.status === 'up' ? '' : 'down'}`} />
                                <span className={`badge ${!m.is_active ? 'badge-info' : m.status === 'up' ? 'badge-success' : m.status === 'down' ? 'badge-error' : 'badge-warning'}`}>
                                  {!m.is_active ? 'Paused' : m.status}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: '15px' }}>{m.name}</div>
                              <a href={m.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{m.url}</a>
                            </td>
                            <td>{m.interval_minutes}m</td>
                            <td>{m.last_checked_at ? new Date(m.last_checked_at).toLocaleTimeString() : '—'}</td>
                            <td>{m.last_status_change_at ? getRelativeTime(m.last_status_change_at) : '—'}</td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '8px' }}>
                                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={() => handleViewDetails(m)}>
                                  Metrics →
                                </button>
                                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={() => handleToggleMonitor(m)}>
                                  {m.is_active ? 'Pause' : 'Resume'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-secondary)' }}>
                  <p style={{ fontSize: '16px', marginBottom: '16px' }}>No website monitors configured yet.</p>
                  <button className="btn btn-primary" onClick={() => setShowAddMonitorModal(true)}>Add your first website</button>
                </div>
              )}
            </div>
          ) : currentView === 'incidents' ? (
            /* =========================================================
               GLOBAL INCIDENTS LIST
               ========================================================= */
            <div className="card">
              <h3 style={{ marginBottom: '20px', fontSize: '16px' }}>Recent Downtime Incidents</h3>
              {globalIncidents.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Website Name</th>
                        <th>Started At</th>
                        <th>Ended At</th>
                        <th>Downtime Duration</th>
                        <th>Outage Cause</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {globalIncidents.map((incident: any) => (
                        <tr key={incident.id}>
                          <td>
                            <strong>{incident.monitor_name}</strong>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{incident.monitor_url}</div>
                          </td>
                          <td>{new Date(incident.started_at).toLocaleString()}</td>
                          <td>{incident.ended_at ? new Date(incident.ended_at).toLocaleString() : '—'}</td>
                          <td>
                            {incident.ended_at 
                              ? formatSeconds(Math.floor((new Date(incident.ended_at).getTime() - new Date(incident.started_at).getTime()) / 1000))
                              : 'Active outage'}
                          </td>
                          <td><code>{incident.cause || 'Network Timeout'}</code></td>
                          <td>
                            <span className={`badge ${incident.is_resolved ? 'badge-success' : 'badge-error'}`}>
                              {incident.is_resolved ? 'Resolved' : 'Active'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                  🎉 Excellent! No website downtime incidents logged.
                </div>
              )}
            </div>
          ) : currentView === 'status-pages' ? (
            /* =========================================================
               PUBLIC STATUS PAGES
               ========================================================= */
            <div>
              {statusPages.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                  {statusPages.map((page: any) => (
                    <div key={page.id} className="card" style={{ display: 'flex', flexDirection: 'column', margin: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <h3 style={{ fontSize: '18px' }}>{page.title}</h3>
                        <span className="badge badge-info">{page.theme} theme</span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px', flexGrow: 1 }}>
                        {page.description || 'No description provided.'}
                      </p>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                        Slug: <code>{page.slug}</code>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <a 
                          href={`/status/${page.slug}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="btn btn-primary"
                          style={{ flexGrow: 1, padding: '8px 12px', fontSize: '13px' }}
                        >
                          Open Page ↗
                        </a>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '8px 12px', fontSize: '13px' }}
                          onClick={() => handleDeleteStatusPage(page.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card" style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-secondary)' }}>
                  <p style={{ fontSize: '16px', marginBottom: '16px' }}>No public status dashboards created yet.</p>
                  <button className="btn btn-primary" onClick={() => setShowAddStatusPageModal(true)}>Create a status page</button>
                </div>
              )}
            </div>
          ) : currentView === 'email-logs' ? (
            /* =========================================================
               EMAIL ALERT LOGS
               ========================================================= */
            <div className="card">
              <h3 style={{ marginBottom: '20px', fontSize: '16px' }}>Dispatched Notification History</h3>
              {emailLogs.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Website Name</th>
                        <th>Sent To</th>
                        <th>Subject / Event</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emailLogs.map((log: any) => (
                        <tr key={log.id}>
                          <td><strong>{log.monitor_name}</strong></td>
                          <td><code>{log.recipient}</code></td>
                          <td>
                            <strong style={{ color: log.subject.includes('back UP') ? 'var(--success)' : 'var(--error)' }}>
                              {log.subject}
                            </strong>
                          </td>
                          <td>{new Date(log.sent_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                  No email alerts have been logged yet.
                </div>
              )}
            </div>
          ) : (
            /* =========================================================
               ACCOUNT SETTINGS VIEW
               ========================================================= */
            <div className="card" style={{ maxWidth: '600px' }}>
              <h3 style={{ marginBottom: '24px', fontSize: '18px' }}>Profile Information</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Account Name</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{user?.name}</span>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Registered Email Address</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{user?.email}</span>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>User ID Key</span>
                  <span style={{ fontSize: '13px', fontFamily: 'monospace' }}>{user?.id}</span>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Active Monitored Web Endpoints</span>
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{monitors.length}</span>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Account Created On</span>
                  <span style={{ fontSize: '15px' }}>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* =========================================================
         ADD WEBSITE MONITOR MODAL
         ========================================================= */}
      {showAddMonitorModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ fontSize: '16px' }}>Configure New Website Monitor</h3>
              <button 
                onClick={() => { setShowAddMonitorModal(false); setMonitorFormError(''); }} 
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAddMonitor}>
              <div className="modal-body">
                {monitorFormError && (
                  <div className="badge badge-error" style={{ width: '100%', marginBottom: '16px', borderRadius: '4px', textTransform: 'none' }}>
                    {monitorFormError}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Friendly Name</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="My Marketing Site"
                    value={newMonitorName}
                    onChange={(e) => setNewMonitorName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Target URL Address</label>
                  <input
                    type="url"
                    className="form-input"
                    required
                    placeholder="https://example.com"
                    value={newMonitorUrl}
                    onChange={(e) => setNewMonitorUrl(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Check Interval (Minutes)</label>
                    <select 
                      className="form-input" 
                      value={newMonitorInterval} 
                      onChange={(e) => setNewMonitorInterval(e.target.value)}
                    >
                      <option value="1">1 minute</option>
                      <option value="5">5 minutes</option>
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="60">60 minutes</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Request Timeout (Sec)</label>
                    <input
                      type="number"
                      min="3"
                      max="30"
                      className="form-input"
                      required
                      value={newMonitorTimeout}
                      onChange={(e) => setNewMonitorTimeout(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowAddMonitorModal(false); setMonitorFormError(''); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Monitor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
         CREATE STATUS PAGE CONFIG MODAL
         ========================================================= */}
      {showAddStatusPageModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '16px' }}>Design New Public Status Dashboard</h3>
              <button 
                onClick={() => { setShowAddStatusPageModal(false); setStatusPageFormError(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px' }}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleAddStatusPage}>
              <div className="modal-body">
                {statusPageFormError && (
                  <div className="badge badge-error" style={{ width: '100%', marginBottom: '16px', borderRadius: '4px', textTransform: 'none' }}>
                    {statusPageFormError}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Dashboard Name / Title</label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    placeholder="Acme Corp Status"
                    value={newPageTitle}
                    onChange={(e) => setNewPageTitle(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">URL Slug Path (a-z, 0-9, dashes)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>/status/</span>
                    <input
                      type="text"
                      className="form-input"
                      required
                      placeholder="acme-status"
                      value={newPageSlug}
                      onChange={(e) => setNewPageSlug(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Subheading / Description</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Availability metrics and performance reports."
                    value={newPageDesc}
                    onChange={(e) => setNewPageDesc(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Logo Image URL</label>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://example.com/logo.png"
                      value={newPageLogo}
                      onChange={(e) => setNewPageLogo(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Color Theme</label>
                    <select 
                      className="form-input" 
                      value={newPageTheme} 
                      onChange={(e) => setNewPageTheme(e.target.value)}
                    >
                      <option value="dark">Dark Theme</option>
                      <option value="light">Light Theme</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Include Website Components</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto', border: '1px solid var(--border-color)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                    {monitors.map(m => (
                      <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                        <input
                          type="checkbox"
                          checked={newPageMonitors.includes(m.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewPageMonitors([...newPageMonitors, m.id]);
                            } else {
                              setNewPageMonitors(newPageMonitors.filter(id => id !== m.id));
                            }
                          }}
                        />
                        {m.name} <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>({m.url})</span>
                      </label>
                    ))}
                    {monitors.length === 0 && (
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Configure monitors first to associate them.</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowAddStatusPageModal(false); setStatusPageFormError(''); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={monitors.length === 0}>Create Status Page</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Uptime sparkline component for grid lists
function UptimeCalendarGrid({ dailyHistory }: { dailyHistory: any[] }) {
  // Pre-fill 30 slots
  const bars = Array(30).fill(null);
  
  // Align history to the last 30 slots
  const offset = 30 - dailyHistory.length;
  dailyHistory.forEach((day, i) => {
    if (i + offset >= 0 && i + offset < 30) {
      bars[i + offset] = day;
    }
  });

  return (
    <div className="uptime-bar-container">
      {bars.map((bar, i) => {
        let title = '';
        let className = 'uptime-bar no-data';

        if (bar) {
          const dateStr = new Date(bar.date).toLocaleDateString();
          title = `${dateStr} | Uptime: ${bar.uptime.toFixed(3)}% | Latency: ${Math.round(bar.avgResponseTimeMs)}ms`;
          className = bar.uptime >= 100 ? 'uptime-bar' : 'uptime-bar downtime';
        } else {
          title = 'No monitoring records available';
        }

        return (
          <div key={i} className={className}>
            <span className="tooltip">{title}</span>
          </div>
        );
      })}
    </div>
  );
}

// Svg area curve chart drawing helper
function SvgAreaChart({ history }: { history: any[] }) {
  if (history.length === 0) {
    return <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No data points gathered yet.</div>;
  }

  const width = 800;
  const height = 240;
  const paddingLeft = 40;
  const paddingRight = 10;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const latencies = history.map(d => d.avgResponseTimeMs);
  const maxVal = Math.max(...latencies, 200); // Floor limit at 200ms
  const minVal = 0;

  // Build points path coordinates
  const points = history.map((d, index) => {
    const x = paddingLeft + (index / (history.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((d.avgResponseTimeMs - minVal) / (maxVal - minVal)) * chartHeight;
    return { x, y };
  });

  let pathD = '';
  let areaD = '';

  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    // Close shape to draw gradient fill
    areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
  }

  // Draw 4 helper gridlines
  const yTicks = [0, 0.33, 0.66, 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="svg-chart" style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map((tick, i) => {
        const y = paddingTop + tick * chartHeight;
        const value = Math.round(maxVal - tick * (maxVal - minVal));
        return (
          <g key={i}>
            <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="var(--border-color)" strokeDasharray="4 4" strokeWidth="1" />
            <text x={paddingLeft - 8} y={y + 4} fill="var(--text-secondary)" fontSize="10" textAnchor="end">{value}ms</text>
          </g>
        );
      })}

      {/* Latency line & gradient */}
      {points.length > 0 && (
        <>
          <path d={areaD} fill="url(#chartGradient)" />
          <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {/* Points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--bg-secondary)" stroke="var(--primary)" strokeWidth="2" />
      ))}

      {/* X Labels */}
      {history.map((d, i) => {
        // Render label only for every 4th element to avoid overcrowding labels
        if (i % 4 !== 0) return null;
        const x = paddingLeft + (i / (history.length - 1)) * chartWidth;
        const timeStr = new Date(d.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return (
          <text key={i} x={x} y={height - 8} fill="var(--text-secondary)" fontSize="10" textAnchor="middle">
            {timeStr}
          </text>
        );
      })}
    </svg>
  );
}

// Public status page view layout (Unauthenticated)
function PublicStatusView({ slug, theme, setTheme }: { slug: string, theme: string, setTheme: any }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const body = document.body;
    if (theme === 'light') {
      body.classList.add('light-theme');
    } else {
      body.classList.remove('light-theme');
    }
  }, [theme]);

  useEffect(() => {
    fetch(`/api/status-pages/public/${slug}`)
      .then(res => {
        if (!res.ok) throw new Error('Status dashboard not found.');
        return res.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch status page data.');
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <p style={{ fontSize: '18px', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>Loading status details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', padding: '20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '16px' }}>🚨</h1>
        <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>404 Status Page Not Found</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px' }}>The status dashboard url you are trying to view does not exist or has been disabled by its owner.</p>
      </div>
    );
  }

  const { page, monitors, overallStatus, dailyHistories, recentIncidents } = data;

  return (
    <div className="public-status-container">
      {/* Header */}
      <header className="public-status-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {page.logo_url ? (
            <img src={page.logo_url} alt="Logo" className="public-status-logo" />
          ) : (
            <span style={{ fontSize: '28px' }}>🚨</span>
          )}
          <div>
            <h1 style={{ fontSize: '22px' }}>{page.title}</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{page.description}</p>
          </div>
        </div>
        <button 
          className="btn btn-secondary"
          style={{ padding: '6px 12px', fontSize: '13px' }}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </header>

      {/* Overall Banner */}
      <div className={`status-summary-banner ${overallStatus === 'operational' ? 'operational' : 'outage'}`}>
        <span>
          {overallStatus === 'operational' ? '🟢 All Systems Operational' : 
           overallStatus === 'partial_outage' ? '🟡 Partial Service Outage' : 
           '🔴 Major System Outage'}
        </span>
        <span style={{ fontSize: '12px', opacity: 0.8, fontWeight: 'normal' }}>
          Updated Live
        </span>
      </div>

      {/* Components listing */}
      <div className="card" style={{ padding: '8px 24px' }}>
        <h2 style={{ fontSize: '16px', margin: '16px 0 8px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>Monitor Statuses</h2>
        {monitors.map((m: any) => {
          const history = dailyHistories[m.id] || [];
          return (
            <div key={m.id} className="public-monitor-row" style={{ display: 'block', padding: '20px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div className="public-monitor-info">
                  <span className="public-monitor-name">{m.name}</span>
                </div>
                <span className={`public-monitor-status ${m.status === 'up' ? 'up' : 'down'}`}>
                  {m.status === 'up' ? 'Operational' : 'Major Outage'}
                </span>
              </div>
              {/* Uptime bars */}
              <UptimeCalendarGrid dailyHistory={history} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                <span>30 days ago</span>
                <span>Today</span>
              </div>
            </div>
          );
        })}
        {monitors.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', padding: '20px 0', textAlign: 'center' }}>No components associated with this status dashboard.</p>
        )}
      </div>

      {/* Incidents section */}
      <div className="public-incidents-section">
        <h2 style={{ fontSize: '18px', marginBottom: '24px' }}>Uptime Incident History</h2>
        {recentIncidents.length > 0 ? (
          recentIncidents.map((incident: any) => (
            <div key={incident.id} className="public-incident-item">
              <h3 className="public-incident-title">
                {incident.monitor_name}: Outage Identified
              </h3>
              <div className="public-incident-time">
                Outage Started: {new Date(incident.started_at).toLocaleString()}
                {incident.ended_at && ` | Outage Resolved: ${new Date(incident.ended_at).toLocaleString()}`}
              </div>
              <p className="public-incident-desc">
                {incident.is_resolved ? (
                  <span>
                    The service experienced temporary outages but recovered and is now back online. Total downtime duration was{' '}
                    <strong>{formatSeconds(Math.floor((new Date(incident.ended_at).getTime() - new Date(incident.started_at).getTime()) / 1000))}</strong>.
                  </span>
                ) : (
                  <span>
                    Our monitoring system is actively detecting connection issues. The site is currently offline: <code>{incident.cause || 'Network Timeout'}</code>.
                  </span>
                )}
              </p>
            </div>
          ))
        ) : (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>All checks passed. No outages reported in the last 15 incidents.</p>
        )}
      </div>
    </div>
  );
}

// Helpers
function getRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return date.toLocaleDateString();
}

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
}
