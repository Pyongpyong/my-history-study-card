interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-slate-200">
      <div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}
