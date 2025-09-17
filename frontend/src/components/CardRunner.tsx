import MCQView from './runner/MCQView';
import ShortView from './runner/ShortView';
import OXView from './runner/OXView';
import ClozeView from './runner/ClozeView';
import OrderView from './runner/OrderView';
import MatchView from './runner/MatchView';

interface CardRunnerProps {
  card: any;
  disabled: boolean;
  onSubmit: (correct: boolean) => void;
}

export default function CardRunner({ card, disabled, onSubmit }: CardRunnerProps) {
  switch (card?.type) {
    case 'MCQ':
      return <MCQView card={card} disabled={disabled} onSubmit={onSubmit} />;
    case 'SHORT':
      return <ShortView card={card} disabled={disabled} onSubmit={onSubmit} />;
    case 'OX':
      return <OXView card={card} disabled={disabled} onSubmit={onSubmit} />;
    case 'CLOZE':
      return <ClozeView card={card} disabled={disabled} onSubmit={onSubmit} />;
    case 'ORDER':
      return <OrderView card={card} disabled={disabled} onSubmit={onSubmit} />;
    case 'MATCH':
      return <MatchView card={card} disabled={disabled} onSubmit={onSubmit} />;
    default:
      return <p className="text-sm text-slate-300">지원하지 않는 카드 유형입니다: {card?.type}</p>;
  }
}
