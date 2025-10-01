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
  cardStyle?: any;
}

export default function CardRunner({ card, disabled, onSubmit, cardStyle }: CardRunnerProps) {
  switch (card?.type) {
    case 'MCQ':
      return <MCQView card={card} disabled={disabled} onSubmit={onSubmit} cardStyle={cardStyle} />;
    case 'SHORT':
      return <ShortView card={card} disabled={disabled} onSubmit={onSubmit} cardStyle={cardStyle} />;
    case 'OX':
      return <OXView card={card} disabled={disabled} onSubmit={onSubmit} cardStyle={cardStyle} />;
    case 'CLOZE':
      return <ClozeView card={card} disabled={disabled} onSubmit={onSubmit} cardStyle={cardStyle} />;
    case 'ORDER':
      return <OrderView card={card} disabled={disabled} onSubmit={onSubmit} cardStyle={cardStyle} />;
    case 'MATCH':
      return <MatchView card={card} disabled={disabled} onSubmit={onSubmit} cardStyle={cardStyle} />;
    default:
      return <p className="text-sm text-slate-600">지원하지 않는 카드 유형입니다: {card?.type}</p>;
  }
}
