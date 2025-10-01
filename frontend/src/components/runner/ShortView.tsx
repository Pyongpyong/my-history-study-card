import { FormEvent, useEffect, useMemo, useState } from 'react';

const questionClass = 'w-full bg-white px-4 py-3 text-lg font-semibold text-primary-600 text-center shadow-sm';

interface ShortViewProps {
  card: any;
  disabled: boolean;
  onSubmit: (correct: boolean) => void;
  cardStyle?: any;
}

const normalize = (value: string) => value.trim().toLowerCase();

export default function ShortView({ card, disabled, onSubmit, cardStyle }: ShortViewProps) {
  const [value, setValue] = useState('');

  const acceptable = useMemo(() => {
    const aliases: string[] = Array.isArray(card?.rubric?.aliases) ? card.rubric.aliases : [];
    return [card.answer, ...aliases].map((entry) => normalize(String(entry ?? ''))).filter(Boolean);
  }, [card.answer, card?.rubric?.aliases]);

  // 카드 스타일 적용
  const titleClass = cardStyle 
    ? `w-full bg-white px-4 py-3 ${cardStyle.front_title_size} ${cardStyle.front_title_color} ${cardStyle.front_title_align} font-semibold shadow-sm`
    : questionClass;

  useEffect(() => {
    setValue('');
  }, [card.prompt]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    const answer = normalize(value);
    onSubmit(acceptable.includes(answer));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm text-slate-900">
      <p className={titleClass}>{card.prompt ?? '질문 없음'}</p>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        className="w-full rounded border border-slate-300 bg-white px-4 py-2"
        placeholder="정답을 입력하고 Enter 키를 누르세요"
      />
      <button
        type="submit"
        disabled={disabled}
        className="mx-auto block rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        제출
      </button>
    </form>
  );
}
