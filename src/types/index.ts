export interface User {
  id: string;
  name: string;
  email: string;
  created_at?: string;
}

export type MonitorStatus = 'up' | 'down' | 'pending';

export interface Monitor {
  id: string;
  user_id: string;
  name: string;
  url: string;
  interval_minutes: number;
  timeout_seconds: number;
  status: MonitorStatus;
  is_active: boolean;
  last_checked_at: string | null;
  last_status_change_at: string | null;
  created_at?: string;
}

export interface DailyHistoryItem {
  date: string;
  uptime: number;
  avgResponseTimeMs: number;
}

export interface HourlyHistoryItem {
  hour: string;
  avgResponseTimeMs: number;
  up_count?: number;
  down_count?: number;
}

export interface MonitorStats {
  uptimePercentage: number;
  avgResponseTimeMs: number;
  dailyHistory: DailyHistoryItem[];
  hourlyHistory: HourlyHistoryItem[];
}

export interface Incident {
  id: string;
  monitor_id: string;
  monitor_name?: string;
  monitor_url?: string;
  started_at: string;
  ended_at: string | null;
  cause: string | null;
  is_resolved: boolean;
}

export interface StatusPage {
  id: string;
  user_id?: string;
  title: string;
  slug: string;
  description: string;
  logo_url: string;
  theme: 'light' | 'dark';
  monitor_ids: string[];
  created_at?: string;
}

export interface EmailLog {
  id: string;
  monitor_id: string;
  monitor_name: string;
  recipient: string;
  subject: string;
  status: 'sent' | 'mocked' | 'failed';
  error: string | null;
  sent_at: string;
}

export interface PublicStatusData {
  page: StatusPage;
  monitors: Monitor[];
  overallStatus: 'operational' | 'pending' | 'partial_outage' | 'major_outage';
  dailyHistories: Record<string, DailyHistoryItem[]>;
  recentIncidents: Incident[];
}

export type ViewType = 'dashboard' | 'incidents' | 'status-pages' | 'email-logs' | 'settings';
