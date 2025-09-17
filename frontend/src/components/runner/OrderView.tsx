import { useEffect, useState } from 'react';

interface OrderViewProps {
  card: any;
  disabled: boolean;
  onSubmit: (correct: boolean) => void;
}

export default function OrderView({ card, disabled, onSubmit }: OrderViewProps) {
  const items: string[] = Array.isArray(card.items) ? card.items : [];
  const answerOrder: number[] = Array.isArray(card.answer_order)
    ? card.answer_order
    : items.map((_, index) => index);
  const [order, setOrder] = useState<number[]>(items.map((_, idx) => idx));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    setOrder(items.map((_, idx) => idx));
  }, [items]);

  const reorder = (list: number[], start: number, end: number) => {
    const result = [...list];
    const [removed] = result.splice(start, 1);
    result.splice(end, 0, removed);
    return result;
  };

  const handleDrop = (position: number) => {
    if (disabled || dragIndex === null) return;
    const next = reorder(order, dragIndex, position);
    setOrder(next);
    setDragIndex(null);
    setHoverIndex(null);
  };

  const clearDragState = () => {
    setDragIndex(null);
    setHoverIndex(null);
  };

  const handleSubmit = () => {
    if (disabled) return;
    const correct = order.every((value, index) => answerOrder[index] === value);
    onSubmit(correct);
  };

  return (
    <div className="space-y-4 text-sm text-slate-100">
      <p className="text-lg font-semibold text-primary-200">올바른 순서를 맞춰보세요</p>
      <p className="text-xs text-slate-400">항목을 드래그하여 순서를 변경한 뒤, 순서 확인 버튼을 눌러주세요.</p>
      <ul className="space-y-2">
        {order.map((originalIndex, position) => (
          <li
            key={`${items[originalIndex]}-${originalIndex}`}
            className={`flex items-center justify-between rounded border px-3 py-2 transition ${
              dragIndex === position
                ? 'cursor-grabbing border-primary-500 bg-primary-900/20'
                : hoverIndex === position
                ? 'border-primary-500 bg-primary-900/10'
                : 'border-slate-700 bg-slate-900'
            } ${disabled ? 'cursor-default' : 'cursor-grab hover:border-primary-500'}`}
            draggable={!disabled}
            onDragStart={() => {
              if (disabled) return;
              setDragIndex(position);
              setHoverIndex(position);
            }}
            onDragOver={(event) => {
              if (disabled) return;
              event.preventDefault();
            }}
            onDragEnter={() => {
              if (disabled) return;
              if (dragIndex !== null && dragIndex !== position) {
                setHoverIndex(position);
              }
            }}
            onDragLeave={() => {
              if (hoverIndex === position) {
                setHoverIndex(null);
              }
            }}
            onDragEnd={clearDragState}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(position);
            }}
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs text-slate-300">
                {position + 1}
              </span>
              <span>{items[originalIndex]}</span>
            </div>
          </li>
        ))}
        {!disabled ? (
          <li
            className={`flex items-center justify-center rounded border px-3 py-2 text-xs text-slate-400 transition ${
              hoverIndex === order.length ? 'border-primary-500 bg-primary-900/10 text-primary-200' : 'border-dashed border-slate-700'
            }`}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDragEnter={() => {
              if (dragIndex !== null) {
                setHoverIndex(order.length);
              }
            }}
            onDragLeave={() => {
              if (hoverIndex === order.length) {
                setHoverIndex(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragIndex === null) return;
              const targetIndex = Math.max(order.length - 1, 0);
              const next = reorder(order, dragIndex, targetIndex);
              setOrder(next);
              clearDragState();
            }}
          >
            마지막 위치로 이동하려면 여기로 드래그하세요
          </li>
        ) : null}
      </ul>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled}
        className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-700"
      >
        순서 확인
      </button>
      {disabled ? (
        <p className="text-xs text-slate-400">
          정답: {answerOrder.map((value) => items[value]).join(' → ')}
        </p>
      ) : null}
    </div>
  );
}
