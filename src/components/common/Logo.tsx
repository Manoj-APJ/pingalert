import React from 'react';

export interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  title?: string;
}

export const Logo: React.FC<LogoProps> = ({
  size = 24,
  className = '',
  title = 'PingAlert Logo',
  style,
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label={title}
      className={`pingalert-logo ${className}`.trim()}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
      {...props}
    >
      {title && <title>{title}</title>}

      {/* Central Warm Peach Disc */}
      <circle cx="100" cy="100" r="87.5" fill="#FAECE7" />

      {/* Terracotta / Rust Annular Segmented Ring */}
      <g fill="#993C1D">
        <path d="M 95.83 4.59 A 95.5 95.5 0 0 1 120.34 6.69 L 116.94 22.32 A 79.5 79.5 0 0 0 96.53 20.58 Z" />
        <path d="M 139.29 12.87 A 95.5 95.5 0 0 1 160.27 24.98 L 150.19 37.58 A 79.5 79.5 0 0 0 132.72 27.50 Z" />
        <path d="M 174.22 36.98 A 95.5 95.5 0 0 1 187.16 53.64 L 172.58 61.42 A 79.5 79.5 0 0 0 161.81 47.55 Z" />
        <path d="M 193.26 68.61 A 95.5 95.5 0 0 1 193.30 131.50 L 177.67 126.22 A 79.5 79.5 0 0 0 177.64 73.86 Z" />
        <path d="M 185.06 142.92 A 95.5 95.5 0 0 1 169.96 159.26 L 158.26 149.34 A 79.5 79.5 0 0 0 170.83 135.74 Z" />
        <path d="M 154.51 172.07 A 95.5 95.5 0 0 1 131.78 185.00 L 126.47 170.73 A 79.5 79.5 0 0 0 145.39 159.97 Z" />
        <path d="M 116.19 194.12 A 95.5 95.5 0 0 1 91.20 195.12 L 92.68 179.19 A 79.5 79.5 0 0 0 113.48 178.36 Z" />
        <path d="M 71.39 191.13 A 95.5 95.5 0 0 1 49.33 180.20 L 57.70 166.75 A 79.5 79.5 0 0 0 76.06 175.85 Z" />
        <path d="M 33.56 168.04 A 95.5 95.5 0 0 1 18.23 150.31 L 30.70 139.75 A 79.5 79.5 0 0 0 43.46 154.51 Z" />
        <path d="M 10.37 136.19 A 95.5 95.5 0 0 1 4.70 111.45 L 20.68 109.53 A 79.5 79.5 0 0 0 25.40 130.13 Z" />
        <path d="M 5.86 96.67 A 95.5 95.5 0 0 1 14.15 72.39 L 28.52 76.99 A 79.5 79.5 0 0 0 21.62 97.22 Z" />
        <path d="M 21.05 58.74 A 95.5 95.5 0 0 1 37.66 39.46 L 48.11 49.61 A 79.5 79.5 0 0 0 34.28 65.66 Z" />
        <path d="M 48.78 28.27 A 95.5 95.5 0 0 1 73.19 14.77 L 77.67 28.98 A 79.5 79.5 0 0 0 57.34 40.22 Z" />
      </g>

      {/* Blue Heartbeat / Uptime Pulse Waveform */}
      <path
        d="M 58.5 100 H 80 L 88.5 80 L 108.5 120 L 118.5 100 H 141.5"
        fill="none"
        stroke="#86B6EF"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
