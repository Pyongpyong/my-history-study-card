import { useEffect, useState } from 'react';

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
      <p className="text-lg font-semibold text-primary-600">{card.question ?? '질문 없음'}</p>
      <div className="grid gap-2">
        {options.map((option, index) => {
          const isCorrect = index === Number(card.answer_index);
          const isSelected = index === selected;
          const stateClass = disabled
            ? isCorrect
              ? 'border-emerald-500 bg-emerald-500/10'
              : isSelected
              ? 'border-rose-500 bg-rose-500/10'
              : 'border-slate-300'
            : isSelected
            ? 'border-primary-500 bg-primary-50'
            : 'border-slate-300 hover:border-primary-500';
          return (
            <button
              key={`${option}-${index}`}
              type="button"
              className={`rounded border px-3 py-2 text-left transition ${stateClass}`}
              onClick={() => handleSelect(index)}
              disabled={disabled}
            >
              <span className="mr-2 text-xs text-slate-500">{index + 1}.</span>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
