import React from 'react';
import { motion } from 'framer-motion';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (val: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
  size = 'md',
}: SegmentedControlProps<T>) {
  return (
    <div className={`segmented-control segmented-${size} ${className}`} role="tablist">
      {options.map(option => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(option.value)}
            className={`segmented-item ${isSelected ? 'selected' : ''}`}
          >
            {isSelected && (
              <motion.div
                layoutId="segmented-pill-active"
                className="segmented-active-bg"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="segmented-label">
              {option.icon && <span className="segmented-icon">{option.icon}</span>}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
