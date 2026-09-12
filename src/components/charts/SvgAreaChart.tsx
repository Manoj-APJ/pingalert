import React, { useState, useMemo, memo } from 'react';
import type { HourlyHistoryItem } from '../../types';

interface SvgAreaChartProps {
  history: HourlyHistoryItem[];
  height?: number;
}

export const SvgAreaChart: React.FC<SvgAreaChartProps> = memo(({ history = [], height = 220 }) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    item: HourlyHistoryItem;
  } | null>(null);

  const width = 800;
  const paddingLeft = 46;
  const paddingRight = 16;
  const paddingTop = 20;
  const paddingBottom = 32;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const { points, maxVal, pathD, areaD, yTicks } = useMemo(() => {
    if (!history || history.length === 0) {
      return { points: [], maxVal: 200, pathD: '', areaD: '', yTicks: [] };
    }

    const latencies = history.map(d => d.avgResponseTimeMs);
    const calculatedMax = Math.max(...latencies, 50);
    // Round max up to neat round number
    const maxVal = Math.ceil(calculatedMax / 50) * 50;
    const minVal = 0;
    const divisor = history.length > 1 ? history.length - 1 : 1;

    const points = history.map((item, index) => {
      const x = paddingLeft + (index / divisor) * chartWidth;
      const y =
        paddingTop +
        chartHeight -
        ((item.avgResponseTimeMs - minVal) / (maxVal - minVal)) * chartHeight;
      return { x, y, item };
    });

    let pathD = '';
    let areaD = '';

    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
      areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
    }

    const yTicks = [0, 0.33, 0.66, 1];

    return { points, maxVal, pathD, areaD, yTicks };
  }, [history, chartWidth, chartHeight, paddingLeft, paddingTop]);

  if (!history || history.length === 0) {
    return (
      <div className="chart-empty-state">
        <p>No response time samples recorded in the last 24 hours.</p>
      </div>
    );
  }

  return (
    <div className="svg-chart-container">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="svg-area-chart"
        onMouseLeave={() => setHoveredPoint(null)}
      >
        <defs>
          <linearGradient id="chartGradientFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-line, #1A1A1A)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--chart-line, #1A1A1A)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Y Grid lines */}
        {yTicks.map((tick, i) => {
          const y = paddingTop + tick * chartHeight;
          const value = Math.round(maxVal - tick * maxVal);
          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="var(--chart-grid, rgba(0, 0, 0, 0.08))"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={paddingLeft - 8}
                y={y + 4}
                fill="var(--text-secondary)"
                fontSize="11"
                textAnchor="end"
                className="chart-tick-text"
              >
                {value}ms
              </text>
            </g>
          );
        })}

        {/* Area fill & main line */}
        {points.length > 0 && (
          <>
            <path d={areaD} fill="url(#chartGradientFill)" />
            <path
              d={pathD}
              fill="none"
              stroke="var(--chart-line, #1A1A1A)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {/* Interactive points & hover targets */}
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hoveredPoint?.item === p.item ? 5 : 3}
              fill="var(--bg-card)"
              stroke="var(--chart-line, #1A1A1A)"
              strokeWidth="2"
              className="chart-dot"
            />
            {/* Invisible larger hover hitbox */}
            <circle
              cx={p.x}
              cy={p.y}
              r={16}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredPoint(p)}
            />
          </g>
        ))}

        {/* Hover vertical crosshair */}
        {hoveredPoint && (
          <line
            x1={hoveredPoint.x}
            y1={paddingTop}
            x2={hoveredPoint.x}
            y2={paddingTop + chartHeight}
            stroke="var(--chart-line, #1A1A1A)"
            strokeDasharray="2 2"
            strokeWidth="1"
            opacity="0.4"
          />
        )}

        {/* X Axis time labels */}
        {history.map((d, i) => {
          if (i % 4 !== 0 && i !== history.length - 1) return null;
          const divisor = history.length > 1 ? history.length - 1 : 1;
          const x = paddingLeft + (i / divisor) * chartWidth;
          const timeStr = new Date(d.hour).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          });
          return (
            <text
              key={i}
              x={x}
              y={height - 8}
              fill="var(--text-secondary)"
              fontSize="11"
              textAnchor="middle"
              className="chart-tick-text"
            >
              {timeStr}
            </text>
          );
        })}
      </svg>

      {/* Floating tooltip on hover */}
      {hoveredPoint && (
        <div
          className="chart-floating-tooltip"
          style={{
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100}%`,
          }}
        >
          <div className="chart-tooltip-time">
            {new Date(hoveredPoint.item.hour).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </div>
          <div className="chart-tooltip-val">
            <strong>{Math.round(hoveredPoint.item.avgResponseTimeMs)} ms</strong> latency
          </div>
        </div>
      )}
    </div>
  );
});

SvgAreaChart.displayName = 'SvgAreaChart';
