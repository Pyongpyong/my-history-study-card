import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  color?: 'default' | 'primary';
}

export default function Badge({ children, color = 'default' }: BadgeProps) {
  const base = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold';
  const palette =
    color === 'primary'
      ? 'bg-primary-500/20 text-primary-200'
      : 'bg-slate-800 text-slate-200';
  return <span className={`${base} ${palette}`}>{children}</span>;
}
