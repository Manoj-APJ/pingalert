import React from 'react';

export type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  leadingText?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  leadingText,
  children,
  size = 'md',
  className = '',
  ...props
}) => {
  return (
    <span
      className={`badge-pill badge-${variant} badge-${size} ${className}`}
      {...props}
    >
      {leadingText && <strong className="badge-leading">{leadingText}</strong>}
      <span className="badge-content">{children}</span>
    </span>
  );
};
