import React from 'react';
import type { MonitorStatus } from '../../types';

interface PulseDotProps {
  status?: MonitorStatus | 'unknown' | 'paused';
  isActive?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const PulseDot: React.FC<PulseDotProps> = ({
  status = 'pending',
  isActive = true,
  size = 'md',
}) => {
  let effectiveStatus: string = status;
  if (!isActive) {
    effectiveStatus = 'paused';
  }

  return (
    <span className={`pulse-container pulse-size-${size}`} aria-hidden="true">
      <span className={`pulse-dot-core status-${effectiveStatus}`} />
      {effectiveStatus === 'up' && (
        <span className="pulse-dot-ring status-up-ring" />
      )}
      {effectiveStatus === 'down' && (
        <span className="pulse-dot-ring status-down-ring" />
      )}
    </span>
  );
};
