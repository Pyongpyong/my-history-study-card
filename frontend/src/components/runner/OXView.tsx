import { useEffect } from 'react';

interface OXViewProps {
  card: any;
  disabled: boolean;
  onSubmit: (correct: boolean) => void;
}

export default function OXView({ card, disabled, onSubmit }: OXViewProps) {
  const handleChoice = (value: boolean) => {
    if (disabled) return;
    onSubmit(Boolean(value) === Boolean(card.answer));
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (disabled) return;
      const key = event.key.toLowerCase();
      if (key === 'o') {
        event.preventDefault();
        handleChoice(true);
      }
      if (key === 'x') {
        event.preventDefault();
        handleChoice(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [disabled, card.answer]);

  return (
    <div className="space-y-4 text-center text-slate-100">
      <p className="text-lg font-semibold text-primary-200">{card.statement ?? '문장 없음'}</p>
      <div className="flex justify-center gap-6">
        <button
          type="button"
          onClick={() => handleChoice(true)}
          disabled={disabled}
          className={`h-20 w-20 rounded-full text-xl font-bold transition ${
            disabled && card.answer
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-700 text-white hover:bg-emerald-600'
          } disabled:cursor-not-allowed disabled:bg-slate-700`}
        >
          O
        </button>
        <button
          type="button"
          onClick={() => handleChoice(false)}
          disabled={disabled}
          className={`h-20 w-20 rounded-full text-xl font-bold transition ${
            disabled && !card.answer
              ? 'bg-rose-600 text-white'
              : 'bg-rose-700 text-white hover:bg-rose-600'
          } disabled:cursor-not-allowed disabled:bg-slate-700`}
        >
          X
        </button>
      </div>
    </div>
  );
}
