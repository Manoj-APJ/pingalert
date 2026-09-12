import React, { memo } from 'react';
import type { DailyHistoryItem } from '../../types';
import { formatPercentage } from '../../lib/utils';

interface UptimeCalendarGridProps {
  dailyHistory: DailyHistoryItem[];
  days?: number;
}

export const UptimeCalendarGrid: React.FC<UptimeCalendarGridProps> = memo(
  ({ dailyHistory = [], days = 30 }) => {
    // Pre-fill slots
    const bars: (DailyHistoryItem | null)[] = Array(days).fill(null);
    const offset = days - dailyHistory.length;

    dailyHistory.forEach((day, i) => {
      if (i + offset >= 0 && i + offset < days) {
        bars[i + offset] = day;
      }
    });

    return (
      <div className="uptime-grid-wrapper">
        <div className="uptime-bar-container" role="img" aria-label="30-day uptime availability bars">
          {bars.map((bar, i) => {
            let label: string;
            let statusClass = 'uptime-bar-empty';

            if (bar) {
              const dateStr = new Date(bar.date).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              });
              label = `${dateStr} · Uptime: ${formatPercentage(bar.uptime)} · Avg: ${Math.round(bar.avgResponseTimeMs)}ms`;
              statusClass = bar.uptime >= 100 ? 'uptime-bar-up' : bar.uptime > 0 ? 'uptime-bar-degraded' : 'uptime-bar-down';
            } else {
              label = 'No check history recorded';
            }

            return (
              <div
                key={i}
                className={`uptime-bar-item ${statusClass}`}
                tabIndex={0}
                aria-label={label}
              >
                <div className="uptime-tooltip" role="tooltip">
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

UptimeCalendarGrid.displayName = 'UptimeCalendarGrid';
