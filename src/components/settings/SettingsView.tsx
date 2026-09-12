import React from 'react';
import { motion } from 'framer-motion';
import { User, Shield, Mail, Calendar, Key, Server } from 'lucide-react';
import type { User as UserType } from '../../types';
import { Card } from '../ui/Card';

interface SettingsViewProps {
  user: UserType | null;
  totalMonitorsCount: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ user, totalMonitorsCount }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="settings-view-container"
    >
      <div className="view-intro-header">
        <div>
          <h2 className="view-headline">Account & Profile Settings</h2>
          <p className="view-subtext">
            Manage your developer credentials, notification preferences, and account configuration.
          </p>
        </div>
      </div>

      <div className="settings-cards-stack">
        <Card className="settings-card">
          <div className="settings-section-header">
            <User size={20} className="settings-icon" />
            <h3 className="settings-card-title">Profile Information</h3>
          </div>

          <div className="settings-fields-grid">
            <div className="settings-field-item">
              <span className="field-meta-label">Full Name</span>
              <span className="field-meta-value">{user?.name || 'Administrator'}</span>
            </div>

            <div className="settings-field-item">
              <span className="field-meta-label">
                <Mail size={13} style={{ display: 'inline', marginRight: '4px' }} />
                Email Address
              </span>
              <span className="field-meta-value">{user?.email || 'admin@pingalert.dev'}</span>
            </div>

            <div className="settings-field-item">
              <span className="field-meta-label">
                <Key size={13} style={{ display: 'inline', marginRight: '4px' }} />
                Account Identifier (UUID)
              </span>
              <span className="field-meta-value code-font">{user?.id || '—'}</span>
            </div>

            <div className="settings-field-item">
              <span className="field-meta-label">
                <Calendar size={13} style={{ display: 'inline', marginRight: '4px' }} />
                Member Since
              </span>
              <span className="field-meta-value">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active Member'}
              </span>
            </div>
          </div>
        </Card>

        <Card className="settings-card">
          <div className="settings-section-header">
            <Server size={20} className="settings-icon" />
            <h3 className="settings-card-title">Fleet Monitoring Capacity</h3>
          </div>

          <div className="settings-fields-grid">
            <div className="settings-field-item">
              <span className="field-meta-label">Active Monitored Endpoints</span>
              <span className="field-meta-value">
                <strong>{totalMonitorsCount}</strong> targets configured
              </span>
            </div>

            <div className="settings-field-item">
              <span className="field-meta-label">
                <Shield size={13} style={{ display: 'inline', marginRight: '4px' }} />
                Alert Routing
              </span>
              <span className="field-meta-value">Immediate SMTP email notifications</span>
            </div>
          </div>
        </Card>
      </div>
    </motion.div>
  );
};
