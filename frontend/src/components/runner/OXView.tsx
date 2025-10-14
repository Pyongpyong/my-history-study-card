import { useEffect } from 'react';

const questionClass = 'w-full px-4 py-3 text-lg font-semibold text-primary-600 text-center bg-white';

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

  const oSize = cardStyle?.ox_button_o_size || 'h-20 w-20 text-xl';
  const oBackground = cardStyle?.ox_button_o_background_color || 'bg-emerald-700 text-white';
  const oRadius = cardStyle?.ox_button_o_radius || 'rounded-full';
  const oBorderColor = cardStyle?.ox_button_o_border_color || 'none';
  const oBorderWidth = cardStyle?.ox_button_o_border_width || 'border';

  const xSize = cardStyle?.ox_button_x_size || 'h-20 w-20 text-xl';
  const xBackground = cardStyle?.ox_button_x_background_color || 'bg-rose-700 text-white';
  const xRadius = cardStyle?.ox_button_x_radius || 'rounded-full';
  const xBorderColor = cardStyle?.ox_button_x_border_color || 'none';
  const xBorderWidth = cardStyle?.ox_button_x_border_width || 'border';

  const oxGap = Number.parseInt(cardStyle?.ox_button_gap ?? '24', 10) || 0;

  const borderClass = (color?: string, width?: string) => {
    if (!color || color === 'none') return '';
    return `${width || 'border'} ${color}`;
  };

  const baseButtonClasses = 'font-bold transition focus:outline-none disabled:cursor-not-allowed';

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
      <div
        className="flex justify-center"
        style={{ gap: `${oxGap}px` }}
      >
        <button
          type="button"
          onClick={() => handleChoice(true)}
          disabled={disabled}
          className={[
            oSize,
            oRadius,
            baseButtonClasses,
            oBackground,
            !disabled ? 'hover:opacity-90' : 'opacity-80',
            disabled && card.answer ? 'ring-2 ring-emerald-400' : '',
            borderClass(oBorderColor, oBorderWidth),
          ].filter(Boolean).join(' ')}
        >
          O
        </button>
        <button
          type="button"
          onClick={() => handleChoice(false)}
          disabled={disabled}
          className={[
            xSize,
            xRadius,
            baseButtonClasses,
            xBackground,
            !disabled ? 'hover:opacity-90' : 'opacity-80',
            disabled && !card.answer ? 'ring-2 ring-rose-400' : '',
            borderClass(xBorderColor, xBorderWidth),
          ].filter(Boolean).join(' ')}
        >
          X
        </button>
      </div>
    </div>
  );
}
