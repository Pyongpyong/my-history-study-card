import { useEffect, useMemo, useState } from 'react';

interface MatchViewProps {
  card: any;
  disabled: boolean;
  onSubmit: (correct: boolean) => void;
}

export default function MatchView({ card, disabled, onSubmit }: MatchViewProps) {
  const left: string[] = Array.isArray(card.left) ? card.left : [];
  const right: string[] = Array.isArray(card.right) ? card.right : [];
  const pairs: Array<[number, number]> = Array.isArray(card.pairs) ? card.pairs : [];

  const [order, setOrder] = useState<number[]>(right.map((_, idx) => idx));
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const expectedOrder = useMemo(() => {
    const mapping = new Map<number, number>();
    pairs.forEach(([l, r]) => {
      mapping.set(l, r);
    });
    return left.map((_, index) => mapping.get(index) ?? index);
  }, [left, pairs]);

  useEffect(() => {
    setOrder(right.map((_, idx) => idx));
    setDragIndex(null);
  }, [right]);

  const reorder = (list: number[], start: number, end: number) => {
    const result = [...list];
    const [removed] = result.splice(start, 1);
    result.splice(end, 0, removed);
    return result;
  };

  const handleSubmit = () => {
    if (disabled) return;
    const correct = order.every((value, index) => expectedOrder[index] === value);
    onSubmit(correct);
  };

  const rowStyles = [
    { background: 'bg-red-500/15', line: 'bg-red-300/60' },
    { background: 'bg-primary-500/15', line: 'bg-primary-300/60' },
    { background: 'bg-orange-500/15', line: 'bg-orange-300/60' },
    { background: 'bg-emerald-500/15', line: 'bg-emerald-300/60' },
    { background: 'bg-sky-500/15', line: 'bg-sky-300/60' },
    { background: 'bg-amber-500/15', line: 'bg-amber-300/60' },
    { background: 'bg-rose-500/15', line: 'bg-rose-300/60' },
    { background: 'bg-lime-500/15', line: 'bg-lime-300/60' },
    { background: 'bg-yellow-500/20', line: 'bg-yellow-300/60' },
  ];

  const getRowStyle = (index: number) => rowStyles[index % rowStyles.length];

  return (
    <div className="space-y-4 text-sm text-slate-100">
      <p className="text-lg font-semibold text-primary-200">대응되는 항목을 맞춰보세요</p>
      <p className="text-xs text-slate-400">오른쪽 항목을 드래그하여 순서를 조정하세요.</p>
      <div className="space-y-2">
        {left.map((leftValue, index) => {
          const { background, line } = getRowStyle(index);
          const rightIndex = order[index];
          const rightValue = right[rightIndex];
          return (
            <div
              key={`row-${index}`}
              className="flex items-stretch text-sm"
            >
              <div
                className={`flex-1 rounded-l border border-slate-800 px-3 py-2 text-primary-100 ${background}`}
              >
                <p className="font-semibold">{leftValue}</p>
              </div>
              <div className="flex items-center justify-center px-3">
                <span className={`block h-0.5 w-12 rounded-full ${line}`} />
              </div>
              <div
                className={`flex-1 rounded-r border border-slate-800 px-3 py-2 text-slate-100 transition ${background} ${
                  disabled ? 'cursor-default' : 'cursor-grab'
                } ${dragIndex === index ? 'ring-2 ring-primary-500' : ''}`}
                draggable={!disabled}
                onDragStart={() => {
                  if (disabled) return;
                  setDragIndex(index);
                }}
                onDragOver={(event) => {
                  if (disabled) return;
                  event.preventDefault();
                }}
                onDragEnter={() => {
                  if (disabled) return;
                  if (dragIndex !== null && dragIndex !== index) {
                    setOrder((prev) => reorder(prev, dragIndex, index));
                    setDragIndex(index);
                  }
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragIndex(null);
                }}
              >
                {rightValue}
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled}
        className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-700"
      >
        매칭 확인
      </button>
      {disabled ? (
        <div className="text-xs text-slate-400">
          <p>정답:</p>
          <ul className="mt-1 space-y-1">
            {pairs.map(([l, r]) => (
              <li key={`${l}-${r}`}>
                {left[l]} ↔ {right[r]}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
