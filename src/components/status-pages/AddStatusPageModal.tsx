import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { Monitor } from '../../types';
import { Globe, Link as LinkIcon, Image, Palette } from 'lucide-react';

interface AddStatusPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  monitors: Monitor[];
  onSubmit: (data: {
    title: string;
    slug: string;
    description: string;
    logo_url: string;
    theme: 'dark' | 'light';
    monitor_ids: string[];
  }) => Promise<void>;
}

export const AddStatusPageModal: React.FC<AddStatusPageModalProps> = ({
  isOpen,
  onClose,
  monitors,
  onSubmit,
}) => {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [selectedMonitorIds, setSelectedMonitorIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-generate slug from title if slug not manually edited
  const handleTitleChange = (val: string) => {
    setTitle(val);
    const generated = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(generated);
  };

  const handleToggleMonitor = (id: string) => {
    setSelectedMonitorIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedMonitorIds.length === 0) {
      setError('Please select at least one monitored endpoint to include on this status page.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        title: title.trim(),
        slug: slug.trim().toLowerCase(),
        description: description.trim(),
        logo_url: logoUrl.trim(),
        theme,
        monitor_ids: selectedMonitorIds,
      });

      // Reset
      setTitle('');
      setSlug('');
      setDescription('');
      setLogoUrl('');
      setTheme('light');
      setSelectedMonitorIds([]);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create status page.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Public Status Dashboard"
      subtitle="Publish an uptime dashboard accessible to your customers and visitors."
      maxWidth="560px"
    >
      <form onSubmit={handleSubmit} className="modal-form-wrap">
        {error && <div className="form-error-banner">{error}</div>}

        <div className="field-group">
          <label className="field-label" htmlFor="page-title">
            Dashboard Name
          </label>
          <input
            id="page-title"
            type="text"
            required
            placeholder="e.g. Acme Corp System Status"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="field-input"
          />
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="page-slug">
            <LinkIcon size={14} style={{ display: 'inline', marginRight: '4px' }} />
            URL Path Slug (letters, numbers, hyphens)
          </label>
          <div className="slug-input-wrapper">
            <span className="slug-prefix">/status/</span>
            <input
              id="page-slug"
              type="text"
              required
              placeholder="acme-status"
              pattern="[a-z0-9\-]+"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              className="field-input slug-input-field"
            />
          </div>
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="page-desc">
            Subtitle / Summary Description
          </label>
          <textarea
            id="page-desc"
            rows={2}
            placeholder="Real-time availability metrics and incident communications."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="field-textarea"
          />
        </div>

        <div className="field-row-2col">
          <div className="field-group">
            <label className="field-label" htmlFor="page-logo">
              <Image size={14} style={{ display: 'inline', marginRight: '4px' }} />
              Logo Image URL (Optional)
            </label>
            <input
              id="page-logo"
              type="url"
              placeholder="https://example.com/logo.svg"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="field-input"
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="page-theme">
              <Palette size={14} style={{ display: 'inline', marginRight: '4px' }} />
              Default Theme
            </label>
            <select
              id="page-theme"
              className="field-select"
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}
            >
              <option value="light">Warm Light Theme</option>
              <option value="dark">Dark Theme</option>
            </select>
          </div>
        </div>

        <div className="field-group">
          <label className="field-label">
            <Globe size={14} style={{ display: 'inline', marginRight: '4px' }} />
            Attached Monitored Endpoints ({selectedMonitorIds.length} selected)
          </label>
          <div className="monitor-multiselect-container">
            {monitors.map((m) => {
              const isChecked = selectedMonitorIds.includes(m.id);
              return (
                <label key={m.id} className={`monitor-checkbox-item ${isChecked ? 'selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleMonitor(m.id)}
                  />
                  <div className="monitor-checkbox-info">
                    <span className="monitor-checkbox-name">{m.name}</span>
                    <span className="monitor-checkbox-url">{m.url}</span>
                  </div>
                </label>
              );
            })}
            {monitors.length === 0 && (
              <div className="no-monitors-notice">
                No active monitors found. Please configure a website monitor first.
              </div>
            )}
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
            disabled={monitors.length === 0}
            isLoading={isSubmitting}
          >
            Create Status Page
          </Button>
        </div>
      </form>
    </Modal>
  );
};
