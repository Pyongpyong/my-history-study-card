import { FormEvent, useEffect, useMemo, useState } from 'react';

const questionClass = 'w-full px-4 py-3 text-lg font-semibold text-primary-600 text-center bg-white';

interface ClozeViewProps {
  card: any;
  disabled: boolean;
  onSubmit: (correct: boolean) => void;
  cardStyle?: any;
}

export default function ClozeView({ card, disabled, onSubmit, cardStyle }: ClozeViewProps) {
  const clozes: Record<string, string> = card.clozes ?? {};
  const placeholders = useMemo(() => Object.keys(clozes).sort(), [clozes]);

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
  const [values, setValues] = useState<Record<string, string>>({});

  const inputClasses = cardStyle
    ? [
        'mx-1',
        'w-24',
        'rounded',
        cardStyle.cloze_input_background_color || 'bg-transparent',
        cardStyle.cloze_input_border_width || 'border-b',
        cardStyle.cloze_input_border_color || 'border-primary-500',
        cardStyle.cloze_input_font_size || 'text-base',
        'text-center',
        'text-primary-600',
        'focus:outline-none',
        cardStyle.cloze_input_underline_color || 'focus:border-primary-500',
      ]
        .filter(Boolean)
        .join(' ')
    : 'mx-1 w-24 rounded border-b border-primary-500 bg-transparent text-center text-sm text-primary-600 focus:outline-none';

  const submitButtonClass = [
    'mx-auto',
    'block',
    'rounded',
    cardStyle?.cloze_button_size || 'px-4 py-2',
    cardStyle?.cloze_button_color || 'bg-primary-600 text-white',
    cardStyle?.cloze_button_font_size || 'text-sm',
    'font-semibold',
    'transition',
    'hover:opacity-90',
    'disabled:cursor-not-allowed',
    'disabled:opacity-60',
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    setValues({});
  }, [card.text]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    const correct = placeholders.every((key) => {
      const expected = String(clozes[key] ?? '').trim();
      const input = String(values[key] ?? '').trim();
      return expected === input;
    });
    onSubmit(correct);
  };

  const renderWithInputs = () => {
    return String(card.text ?? '')
      .split(/(\{\{c\d+\}\})/g)
      .map((segment: string, index: number) => {
        const match = segment.match(/\{\{(c\d+)\}\}/);
        if (!match) {
          return (
            <span key={`text-${index}`} className="text-slate-900">
              {segment}
            </span>
          );
        }
        const key = match[1];
        return (
          <input
            key={key}
            value={values[key] ?? ''}
            onChange={(event) => setValues((prev) => ({ ...prev, [key]: event.target.value }))}
            disabled={disabled}
            className={inputClasses}
          />
        );
      });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm text-slate-900">
      <p className={titleClass}>빈칸을 채워보세요</p>
      <div className="flex flex-wrap items-center justify-center gap-2 text-base leading-relaxed">{renderWithInputs()}</div>
      <button
        type="submit"
        disabled={disabled}
        className={submitButtonClass}
      >
        제출
      </button>
    </form>
  );
}
