import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent-600 text-white hover:bg-accent-700 shadow-card',
  secondary:
    'border-edge bg-surface text-ink hover:border-edge-strong hover:bg-surface-muted border',
  ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  danger: 'border-destructive/40 text-destructive hover:bg-destructive/10 border',
};

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-9 px-3.5 text-sm',
};

/** The only place a button's look is defined. */
export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      {...props}
      className={`rounded-control inline-flex shrink-0 items-center justify-center gap-1.5 font-medium transition-colors disabled:pointer-events-none disabled:opacity-45 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
}
