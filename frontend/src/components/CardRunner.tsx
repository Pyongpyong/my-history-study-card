import type { QuizCard, MCQCard, ShortCard, OXCard, ClozeCard, OrderCard, MatchCard, CardStyle } from '../api';

import MCQView from './runner/MCQView';
import ShortView from './runner/ShortView';
import OXView from './runner/OXView';
import ClozeView from './runner/ClozeView';
import OrderView from './runner/OrderView';
import MatchView from './runner/MatchView';

interface CardRunnerProps {
  card: QuizCard;
  disabled: boolean;
  onSubmit: (correct: boolean) => void;
  cardStyle?: CardStyle | null;
}

export default function CardRunner({ card, disabled, onSubmit, cardStyle }: CardRunnerProps) {
  switch (card.type) {
    case 'MCQ':
      return <MCQView card={card as MCQCard} disabled={disabled} onSubmit={onSubmit} cardStyle={cardStyle} />;
    case 'SHORT':
      return <ShortView card={card as ShortCard} disabled={disabled} onSubmit={onSubmit} cardStyle={cardStyle} />;
    case 'OX':
      return <OXView card={card as OXCard} disabled={disabled} onSubmit={onSubmit} cardStyle={cardStyle} />;
    case 'CLOZE':
      return <ClozeView card={card as ClozeCard} disabled={disabled} onSubmit={onSubmit} cardStyle={cardStyle} />;
    case 'ORDER':
      return <OrderView card={card as OrderCard} disabled={disabled} onSubmit={onSubmit} cardStyle={cardStyle} />;
    case 'MATCH':
      return <MatchView card={card as MatchCard} disabled={disabled} onSubmit={onSubmit} cardStyle={cardStyle} />;
    default:
      return <p className="text-sm text-slate-600">지원하지 않는 카드 유형입니다: {card?.type}</p>;
  }
}
