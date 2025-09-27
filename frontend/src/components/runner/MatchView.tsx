import { useEffect, useMemo, useRef, useState } from 'react';

const questionClass = 'w-full bg-white px-4 py-3 text-lg font-semibold text-primary-600 text-center shadow-sm';

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
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);

  const expectedOrder = useMemo(() => {
    const mapping = new Map<number, number>();
    pairs.forEach(([l, r]) => {
      mapping.set(l, r);
    });
    return left.map((_, index) => mapping.get(index) ?? index);
  }, [left, pairs]);

  const cleanupPreview = () => {
    if (dragPreviewRef.current) {
      document.body.removeChild(dragPreviewRef.current);
      dragPreviewRef.current = null;
    }
  };

  const createPreview = (text: string) => {
    cleanupPreview();
    const preview = document.createElement('div');
    preview.textContent = text;
    preview.className = 'rounded bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-lg border border-primary-400';
    preview.style.position = 'absolute';
    preview.style.top = '-9999px';
    preview.style.left = '-9999px';
    preview.style.pointerEvents = 'none';
    document.body.appendChild(preview);
    dragPreviewRef.current = preview;
    return preview;
  };

  useEffect(() => {
    setOrder(right.map((_, idx) => idx));
    setDragIndex(null);
    setHoverIndex(null);
    cleanupPreview();
  }, [right]);

  useEffect(() => () => cleanupPreview(), []);

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

  const handleDrop = (index: number) => {
    if (disabled || dragIndex === null) return;
    setOrder((prev) => reorder(prev, dragIndex, index));
    setDragIndex(null);
    setHoverIndex(null);
    cleanupPreview();
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
    <div className="space-y-4 text-sm text-slate-900">
      <p className={questionClass}>대응되는 항목을 맞춰보세요</p>
      <p className="text-xs text-slate-500">오른쪽 항목을 드래그하여 순서를 조정하세요.</p>
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
                className={`flex-1 rounded-l border border-slate-200 px-3 py-2 text-primary-100 ${background}`}
              >
                <p className="font-semibold">{leftValue}</p>
              </div>
              <div className="flex items-center justify-center px-3">
                <span className={`block h-0.5 w-12 rounded-full ${line}`} />
              </div>
              <div
                className={`flex-1 rounded-r border border-slate-200 px-3 py-2 text-slate-900 transition ${background} ${
                  disabled ? 'cursor-default' : 'cursor-grab hover:border-primary-500'
                } ${dragIndex === index ? 'ring-2 ring-primary-500' : ''} ${
                  hoverIndex === index && dragIndex !== null && dragIndex !== index ? 'border-primary-500 bg-primary-50' : ''
                }`}
                draggable={!disabled}
                onDragStart={(event) => {
                  if (disabled) return;
                  setDragIndex(index);
                  setHoverIndex(index);
                  if (event.dataTransfer) {
                    event.dataTransfer.setData('text/plain', '');
                    const preview = createPreview(rightValue ?? '');
                    event.dataTransfer.setDragImage(preview, preview.offsetWidth / 2, preview.offsetHeight / 2);
                  }
                }}
                onDragOver={(event) => {
                  if (disabled) return;
                  event.preventDefault();
                }}
                onDragEnter={() => {
                  if (disabled) return;
                  if (dragIndex !== null) {
                    setHoverIndex(index);
                  }
                }}
                onDragLeave={() => {
                  if (hoverIndex === index) {
                    setHoverIndex(null);
                  }
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setHoverIndex(null);
                  cleanupPreview();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(index);
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
        className="mx-auto block rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        매칭 확인
      </button>
    </div>
  );
}
