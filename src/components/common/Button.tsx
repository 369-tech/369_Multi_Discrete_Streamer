import React from 'react';

const VARIANTS = {
  primary: 'bg-accent text-ink-950 hover:bg-accent-dark shadow-[0_0_0_1px_rgba(45,212,191,0.18)]',
  danger: 'bg-danger text-white hover:bg-danger-dark',
  ghost: 'bg-ink-800 text-white hover:bg-ink-700',
  outline: 'bg-surface-soft border border-slate-600 text-slate-100 hover:border-accent hover:text-accent',
  subtle: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-3 text-base',
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  fullWidth?: boolean;
};

/**
 * Generic button used across the app.
 * variant: primary | danger | ghost | outline | subtle
 * size: sm | md | lg
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  fullWidth = false,
  disabled = false,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold tracking-tight transition-colors duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
