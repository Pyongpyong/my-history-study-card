import { FormEvent, useEffect, useMemo, useState } from 'react';

interface ShortViewProps {
  card: any;
  disabled: boolean;
  onSubmit: (correct: boolean) => void;
}

const normalize = (value: string) => value.trim().toLowerCase();

export default function ShortView({ card, disabled, onSubmit }: ShortViewProps) {
  const [value, setValue] = useState('');

  const acceptable = useMemo(() => {
    const aliases: string[] = Array.isArray(card?.rubric?.aliases) ? card.rubric.aliases : [];
    return [card.answer, ...aliases].map((entry) => normalize(String(entry ?? ''))).filter(Boolean);
  }, [card.answer, card?.rubric?.aliases]);

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
    <form onSubmit={handleSubmit} className="space-y-4 text-sm text-slate-100">
      <p className="text-lg font-semibold text-primary-200">{card.prompt ?? '질문 없음'}</p>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        className="w-full rounded border border-slate-700 bg-slate-900 px-4 py-2"
        placeholder="정답을 입력하고 Enter 키를 누르세요"
      />
      <button
        type="submit"
        disabled={disabled}
        className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-700"
      >
        제출
      </button>
      {disabled ? <p className="text-xs text-slate-400">정답: {card.answer}</p> : null}
    </form>
  );
}
