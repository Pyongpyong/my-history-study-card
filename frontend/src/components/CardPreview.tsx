import { getQuizTypeLabel } from '../utils/quiz';

interface CardPreviewProps {
  card: Record<string, any> & { type: string };
}

export default function CardPreview({ card }: CardPreviewProps) {
  const label = getQuizTypeLabel(card.type);

  const body = (() => {
    switch (card.type) {
      case 'MCQ':
        return (
          <>
            <p className="text-sm text-slate-900">{card.question ?? '질문 없음'}</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {(card.options ?? []).map((option: string, idx: number) => (
                <li key={`${option}-${idx}`}>{idx + 1}. {option}</li>
              ))}
            </ul>
          </>
        );
      case 'SHORT':
        return (
          <>
            <p className="text-sm text-slate-900">{card.prompt ?? '질문 없음'}</p>
            <p className="mt-2 text-xs text-slate-600">정답: {card.answer}</p>
          </>
        );
      case 'OX':
        return (
          <>
            <p className="text-sm text-slate-900">{card.statement ?? '문장 없음'}</p>
            <p className="mt-2 text-xs text-slate-600">정답: {card.answer ? 'O' : 'X'}</p>
          </>
        );
      case 'CLOZE':
        return (
          <>
            <p className="text-sm text-slate-900">{(card.text ?? '').replace(/\{\{c\d+\}\}/g, '____')}</p>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {Object.entries((card.clozes ?? {}) as Record<string, string>).map(
                ([key, value]) => (
                  <li key={key}>{value}</li>
                )
              )}
            </ul>
          </>
        );
      case 'ORDER':
        return (
          <ol className="mt-2 list-decimal list-inside space-y-1 text-xs text-slate-600">
            {(card.items ?? []).map((item: string, idx: number) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ol>
        );
      case 'MATCH':
        return (
          <div className="mt-2 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
            <div className="space-y-1">
              {(card.left ?? []).map((value: string, idx: number) => (
                <div key={`left-${idx}`} className="rounded bg-slate-100 px-2 py-1">
                  L{idx + 1}. {value}
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {(card.right ?? []).map((value: string, idx: number) => (
                <div key={`right-${idx}`} className="rounded bg-slate-100 px-2 py-1">
                  R{idx + 1}. {value}
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return <p className="text-sm text-slate-600">알 수 없는 카드 타입: {label}</p>;
    }
  })();

  return (
    <div>
      <h3 className="font-semibold text-primary-600">{label}</h3>
      {body}
    </div>
  );
}
