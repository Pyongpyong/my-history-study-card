import { useEffect, useState } from 'react';

const questionClass = 'w-full bg-white px-4 py-3 text-lg font-semibold text-primary-600 text-center shadow-sm';

interface MCQViewProps {
  card: any;
  disabled: boolean;
  onSubmit: (correct: boolean) => void;
}

export default function MCQView({ card, disabled, onSubmit }: MCQViewProps) {
  const options: string[] = Array.isArray(card.options) ? card.options : [];
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (index: number) => {
    if (disabled) return;
    setSelected(index);
    onSubmit(index === Number(card.answer_index));
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (disabled) return;
      const value = Number.parseInt(event.key, 10);
      if (!Number.isNaN(value) && value >= 1 && value <= options.length) {
        event.preventDefault();
        handleSelect(value - 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [disabled, options.length]);

  useEffect(() => {
    setSelected(null);
  }, [card.question]);

  return (
    <div className="space-y-4 text-sm text-slate-900">
      <p className={questionClass}>{card.question ?? '질문 없음'}</p>
      <div className="grid gap-2">
        {options.map((option, index) => {
          const isCorrect = index === Number(card.answer_index);
          const isSelected = index === selected;

          let className = 'flex items-center justify-center gap-3 px-3 py-2 text-center transition-colors bg-white shadow-sm';

          if (disabled) {
            if (isCorrect) {
              className += ' bg-emerald-100';
            } else if (isSelected) {
              className += ' bg-rose-100';
            }
          } else {
            className += ' cursor-pointer hover:bg-slate-100';
            if (isSelected) {
              className += ' bg-slate-100';
            }
          }

          return (
            <button
              key={`${option}-${index}`}
              type="button"
              className={className}
              onClick={() => handleSelect(index)}
              disabled={disabled}
            >
              <span>{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
