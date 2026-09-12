import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Activity, Globe, Zap, Lock, Mail, User as UserIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { SegmentedControl } from '../ui/SegmentedControl';
import { apiRequest, TOKEN_KEY } from '../../lib/api';
import type { User } from '../../types';

interface AuthViewProps {
  onAuthSuccess: (user: User, token: string) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const res = await apiRequest<{ token: string; user: User }>('/api/auth/login', 'POST', {
          email,
          password,
        });
        localStorage.setItem(TOKEN_KEY, res.token);
        onAuthSuccess(res.user, res.token);
      } else {
        const res = await apiRequest<{ token: string; user: User }>('/api/auth/register', 'POST', {
          name,
          email,
          password,
        });
        localStorage.setItem(TOKEN_KEY, res.token);
        onAuthSuccess(res.user, res.token);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-hero-page">
      {/* Top minimal navigation */}
      <header className="auth-top-nav">
        <div className="auth-brand">
          <div className="brand-mark">
            <Activity size={20} />
          </div>
          <span className="brand-name">PingAlert</span>
        </div>

        <div className="auth-nav-center">
          <SegmentedControl
            options={[
              { value: 'login', label: 'Sign In' },
              { value: 'register', label: 'Create Account' },
            ]}
            value={mode}
            onChange={(val) => {
              setMode(val);
              setError('');
            }}
            size="sm"
          />
        </div>

        <div className="auth-nav-right">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Get Started' : 'Log In'}
          </Button>
        </div>
      </header>

      {/* Hero Section Container */}
      <div className="auth-hero-container">
        {/* Editorial Hero Header */}
        <div className="auth-hero-intro">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="auth-badge-row"
          >
            <Badge variant="info" leadingText="Uptime Intelligence:">
              Automated HTTP checks, incident timeline & public status pages
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' }}
            className="hero-display-headline"
          >
            Gain complete visibility into your system reliability
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16, ease: 'easeOut' }}
            className="hero-editorial-subtext"
          >
            PingAlert provides continuous background monitoring for your web APIs, microservices,
            and user endpoints. Get immediate alerts the moment downtime occurs and host branded
            status pages for your users.
          </motion.p>
        </div>

        {/* Auth Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.22, ease: 'easeOut' }}
          className="auth-form-card"
        >
          <div className="auth-card-top">
            <h2 className="auth-card-title">
              {mode === 'login' ? 'Welcome back' : 'Start monitoring today'}
            </h2>
            <p className="auth-card-desc">
              {mode === 'login'
                ? 'Enter your credentials to access your dashboard'
                : 'Create your developer account in seconds'}
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="form-error-banner"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="auth-form-fields">
            {mode === 'register' && (
              <div className="field-group">
                <label className="field-label" htmlFor="auth-name">
                  Full Name
                </label>
                <div className="field-input-wrap">
                  <UserIcon size={16} className="field-icon" />
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="field-input with-icon"
                  />
                </div>
              </div>
            )}

            <div className="field-group">
              <label className="field-label" htmlFor="auth-email">
                Email Address
              </label>
              <div className="field-input-wrap">
                <Mail size={16} className="field-icon" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@company.com"
                  className="field-input with-icon"
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="auth-password">
                Password
              </label>
              <div className="field-input-wrap">
                <Lock size={16} className="field-icon" />
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="field-input with-icon"
                />
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                showArrow
                isLoading={isLoading}
                style={{ width: '100%' }}
              >
                {mode === 'login' ? 'Sign In to Dashboard' : 'Create Free Account'}
              </Button>
            </div>
          </form>

          <div className="auth-card-footer">
            {mode === 'login' ? (
              <p>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  className="inline-link-btn"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                >
                  Create one now
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  className="inline-link-btn"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                >
                  Sign in
                </button>
              </p>
            )}
          </div>
        </motion.div>

        {/* Trust Badges / Social Proof Strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="auth-trust-strip"
        >
          <div className="trust-strip-label">Built for modern engineering teams</div>
          <div className="trust-features-grid">
            <div className="trust-item">
              <ShieldCheck size={16} className="trust-icon" />
              <span>Multi-Attempt Retries</span>
            </div>
            <div className="trust-item">
              <Globe size={16} className="trust-icon" />
              <span>Global HTTP Latency</span>
            </div>
            <div className="trust-item">
              <Zap size={16} className="trust-icon" />
              <span>Instant SMTP Alerts</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
