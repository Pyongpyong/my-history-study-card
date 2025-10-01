import { useEffect } from 'react';

const questionClass = 'w-full bg-white px-4 py-3 text-lg font-semibold text-primary-600 text-center shadow-sm';

interface OXViewProps {
  card: any;
  disabled: boolean;
  onSubmit: (correct: boolean) => void;
  cardStyle?: any;
}

export default function OXView({ card, disabled, onSubmit, cardStyle }: OXViewProps) {
  const handleChoice = (value: boolean) => {
    if (disabled) return;
    onSubmit(Boolean(value) === Boolean(card.answer));
  };

  // 카드 스타일 적용
  const titleClass = cardStyle 
    ? `w-full bg-white px-4 py-3 ${cardStyle.front_title_size} ${cardStyle.front_title_color} ${cardStyle.front_title_align} font-semibold shadow-sm`
    : questionClass;

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
    <div className="space-y-4 text-center text-slate-900">
      <p className={titleClass}>{card.statement ?? '문장 없음'}</p>
      <div className="flex justify-center gap-6">
        <button
          type="button"
          onClick={() => handleChoice(true)}
          disabled={disabled}
          className={`h-20 w-20 rounded-full text-xl font-bold transition ${
            disabled && card.answer
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-700 text-white hover:bg-emerald-600'
          } disabled:cursor-not-allowed disabled:bg-slate-300`}
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
          } disabled:cursor-not-allowed disabled:bg-slate-300`}
        >
          X
        </button>
      </div>
    </div>
  );
}
