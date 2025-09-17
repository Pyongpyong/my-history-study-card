import { getQuizTypeLabel } from '../utils/quiz';

interface CardPreviewProps {
  card: Record<string, any> & { type: string };
}

export default function CardPreview({ card }: CardPreviewProps) {
  const label = getQuizTypeLabel(card.type);
  const tags = Array.isArray(card.tags) ? card.tags.filter(Boolean) : [];

  const body = (() => {
    switch (card.type) {
      case 'MCQ':
        return (
          <>
            <p className="text-sm text-slate-100">{card.question ?? '질문 없음'}</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              {(card.options ?? []).map((option: string, idx: number) => (
                <li key={`${option}-${idx}`}>{idx + 1}. {option}</li>
              ))}
            </ul>
          </>
        );
      case 'SHORT':
        return (
          <>
            <p className="text-sm text-slate-100">{card.prompt ?? '질문 없음'}</p>
            <p className="mt-2 text-xs text-slate-300">Answer: {card.answer}</p>
          </>
        );
      case 'OX':
        return (
          <>
            <p className="text-sm text-slate-100">{card.statement ?? '문장 없음'}</p>
            <p className="mt-2 text-xs text-slate-300">정답: {card.answer ? 'O' : 'X'}</p>
          </>
        );
      case 'CLOZE':
        return (
          <p className="text-sm text-slate-100">{(card.text ?? '').replace(/\{\{c\d+\}\}/g, '____')}</p>
        );
      case 'ORDER':
        return (
          <ol className="mt-2 list-decimal space-y-1 text-xs text-slate-300">
            {(card.items ?? []).map((item: string, idx: number) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ol>
        );
      case 'MATCH':
        return (
          <div className="mt-2 grid gap-2 text-xs text-slate-300 md:grid-cols-2">
            <div className="space-y-1">
              {(card.left ?? []).map((value: string, idx: number) => (
                <div key={`left-${idx}`} className="rounded bg-slate-800 px-2 py-1">
                  L{idx + 1}. {value}
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {(card.right ?? []).map((value: string, idx: number) => (
                <div key={`right-${idx}`} className="rounded bg-slate-800 px-2 py-1">
                  R{idx + 1}. {value}
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return <p className="text-sm text-slate-300">알 수 없는 카드 타입: {label}</p>;
    }
  })();

  return (
    <div>
      <h3 className="font-semibold text-primary-200">{label}</h3>
      {body}
      {tags.length ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-primary-200/90">
          {tags.map((tag: string) => (
            <span key={tag} className="rounded bg-primary-500/10 px-2 py-1">#{tag}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
