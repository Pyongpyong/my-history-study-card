import { useEffect, useState } from 'react';

const questionClass = 'w-full px-4 py-3 text-lg font-semibold text-primary-600 text-center bg-white';

interface MCQViewProps {
  card: any;
  disabled: boolean;
  onSubmit: (correct: boolean) => void;
  cardStyle?: any;
}

export default function MCQView({ card, disabled, onSubmit, cardStyle }: MCQViewProps) {
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

  const titleClass = cardStyle
    ? [
        'w-full',
        'px-4',
        'py-3',
        cardStyle.front_title_size || 'text-lg',
        cardStyle.front_title_color || 'text-primary-600',
        cardStyle.front_title_align || 'text-center',
        cardStyle.front_title_background_color || 'bg-white',
        cardStyle.front_title_border_color && cardStyle.front_title_border_color !== 'none'
          ? `${cardStyle.front_title_border_width || 'border'} ${cardStyle.front_title_border_color}`
          : '',
        'font-semibold',
      ]
        .filter(Boolean)
        .join(' ')
    : questionClass;
    
  const contentClass = cardStyle 
    ? `${cardStyle.front_content_size} ${cardStyle.front_content_color}`
    : 'text-sm text-slate-900';

  const optionBackground = cardStyle?.mcq_option_background_color || 'bg-white';
  const optionBorderColor = cardStyle?.mcq_option_border_color || 'none';
  const optionBorderWidth = cardStyle?.mcq_option_border_width || 'border';
  const optionGap = Number.parseInt(cardStyle?.mcq_option_gap ?? '8', 10) || 0;

  return (
    <div className="space-y-4">
      <p className={titleClass}>{card.question ?? '질문 없음'}</p>
      <div
        className={`grid ${contentClass}`}
        style={{ gap: `${optionGap}px` }}
      >
        {options.map((option, index) => {
          const isCorrect = index === Number(card.answer_index);
          const isSelected = index === selected;

          const borderClasses = optionBorderColor && optionBorderColor !== 'none'
            ? `${optionBorderWidth || 'border'} ${optionBorderColor}`
            : optionBorderColor === 'none'
              ? ''
              : optionBorderWidth || 'border';

          let className = `flex items-center justify-center gap-3 px-3 py-2 ${cardStyle?.front_content_align || 'text-center'} transition-colors ${optionBackground} ${borderClasses} ${contentClass}`.trim();
          className += ' disabled:cursor-not-allowed';

          if (disabled) {
            if (isCorrect) {
              className += ' bg-emerald-100';
            } else if (isSelected) {
              className += ' bg-rose-100';
            }
          } else {
            className += ' cursor-pointer hover:bg-slate-100';
            if (isSelected) {
              className += ' bg-slate-100';
            }
          }

          return (
            <button
              key={`${option}-${index}`}
              type="button"
              className={className}
              onClick={() => handleSelect(index)}
              disabled={disabled}
            >
              <span>{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
