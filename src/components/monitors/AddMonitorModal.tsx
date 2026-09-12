import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Globe, Clock, Shield } from 'lucide-react';

interface AddMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    url: string;
    interval_minutes: number;
    timeout_seconds: number;
  }) => Promise<void>;
}

export const AddMonitorModal: React.FC<AddMonitorModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [interval, setInterval] = useState('5');
  const [timeout, setTimeoutVal] = useState('10');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        name: name.trim(),
        url: formattedUrl,
        interval_minutes: parseInt(interval, 10),
        timeout_seconds: parseInt(timeout, 10),
      });
      // Reset form
      setName('');
      setUrl('');
      setInterval('5');
      setTimeoutVal('10');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create monitor. Please verify your inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Website Monitor"
      subtitle="Configure an automated endpoint for uptime and latency tracking."
    >
      <form onSubmit={handleSubmit} className="modal-form-wrap">
        {error && <div className="form-error-banner">{error}</div>}

        <div className="field-group">
          <label className="field-label" htmlFor="monitor-name">
            Monitor Friendly Name
          </label>
          <input
            id="monitor-name"
            type="text"
            required
            placeholder="e.g. Marketing Landing Page or Production API"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-input"
          />
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="monitor-url">
            Target URL Address
          </label>
          <div className="field-input-wrap">
            <Globe size={16} className="field-icon" />
            <input
              id="monitor-url"
              type="text"
              required
              placeholder="https://example.com/api/health"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="field-input with-icon"
            />
          </div>
        </div>

        <div className="field-row-2col">
          <div className="field-group">
            <label className="field-label" htmlFor="monitor-interval">
              <Clock size={14} style={{ display: 'inline', marginRight: '4px' }} />
              Check Interval
            </label>
            <select
              id="monitor-interval"
              className="field-select"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            >
              <option value="1">Every 1 minute</option>
              <option value="5">Every 5 minutes</option>
              <option value="15">Every 15 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every 60 minutes</option>
            </select>
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="monitor-timeout">
              <Shield size={14} style={{ display: 'inline', marginRight: '4px' }} />
              Request Timeout
            </label>
            <select
              id="monitor-timeout"
              className="field-select"
              value={timeout}
              onChange={(e) => setTimeoutVal(e.target.value)}
            >
              <option value="5">5 seconds</option>
              <option value="10">10 seconds</option>
              <option value="15">15 seconds</option>
              <option value="30">30 seconds</option>
            </select>
          </div>
        </div>

        <div className="modal-actions-footer">
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            showArrow
            isLoading={isSubmitting}
          >
            Create Monitor
          </Button>
        </div>
      </form>
    </Modal>
  );
};
