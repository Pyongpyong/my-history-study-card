import { useMemo, useState } from 'react';

export interface HighlightItem {
  value: string;
  selected: boolean;
}

interface HighlightInputProps {
  highlights: HighlightItem[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  onToggle?: (value: string) => void;
  placeholder?: string;
  allowToggle?: boolean;
  addButtonLabel?: string;
}

export default function HighlightInput({
  highlights,
  onAdd,
  onRemove,
  onToggle,
  placeholder,
  allowToggle = true,
  addButtonLabel = '추가',
}: HighlightInputProps) {
  const [draft, setDraft] = useState('');

  const selectedCount = useMemo(() => highlights.filter((item) => item.selected).length, [highlights]);
  const canToggle = allowToggle && typeof onToggle === 'function';

  const commitDraft = () => {
    const segments = draft
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!segments.length) {
      return;
    }
    for (const segment of segments) {
      onAdd(segment);
    }
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {highlights.map((item) => {
          const { value, selected } = item;
          const chipState = selected && canToggle;
          return (
            <div
              key={value}
              className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
                chipState
                  ? 'border-primary-500 bg-primary-100 text-primary-600'
                  : 'border-slate-300 bg-white text-slate-600'
              }`}
            >
              <button
                type="button"
                onClick={() => (canToggle ? onToggle?.(value) : undefined)}
                className={`max-w-[10rem] truncate text-left font-medium outline-none transition ${
                  canToggle ? 'cursor-pointer hover:text-primary-600' : 'cursor-default'
                }`}
                disabled={!canToggle}
                title={value}
              >
                {value}
              </button>
              <button
                type="button"
                onClick={() => onRemove(value)}
                className="text-xs text-slate-400 transition hover:text-rose-500"
                aria-label={`${value} 제거`}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitDraft();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={commitDraft}
          className="rounded border border-primary-500 px-3 py-2 text-xs font-semibold text-primary-600 transition hover:bg-primary-50"
        >
          {addButtonLabel}
        </button>
      </div>

      {highlights.length ? (
        <p className="text-xs text-slate-500">
          {canToggle ? `선택 ${selectedCount} / 총 ${highlights.length}` : `총 ${highlights.length}개`}
        </p>
      ) : null}
    </div>
  );
}
