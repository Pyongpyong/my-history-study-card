import { ReactNode } from 'react';

type BadgeColor = 'default' | 'primary' | 'success' | 'danger';

interface BadgeProps {
  children: ReactNode;
  color?: BadgeColor;
}

export default function Badge({ children, color = 'default' }: BadgeProps) {
  const base = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold';
  const paletteMap: Record<BadgeColor, string> = {
    default: 'bg-slate-200 text-slate-700',
    primary: 'bg-primary-100 text-primary-700',
    success: 'bg-emerald-100 text-emerald-700',
    danger: 'bg-rose-100 text-rose-700',
  };
  return <span className={`${base} ${paletteMap[color]}`}>{children}</span>;
}
