import { useEffect, useMemo, useRef, useState } from 'react';

const questionClass = 'w-full px-4 py-3 text-lg font-semibold text-primary-600 text-center bg-white';

interface MatchViewProps {
  card: any;
  disabled: boolean;
  onSubmit: (correct: boolean) => void;
  cardStyle?: any;
}

export default function MatchView({ card, disabled, onSubmit, cardStyle }: MatchViewProps) {
  const left: string[] = Array.isArray(card.left) ? card.left : [];
  const right: string[] = Array.isArray(card.right) ? card.right : [];
  const pairs: Array<[number, number]> = Array.isArray(card.pairs) ? card.pairs : [];

  const [order, setOrder] = useState<number[]>(right.map((_, idx) => idx));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);

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

  const customMatchBackground = cardStyle?.match_item_background_color && cardStyle.match_item_background_color !== 'bg-white'
    ? cardStyle.match_item_background_color
    : null;
  const itemBorderColor = cardStyle?.match_item_border_color || 'border-slate-200';
  const itemBorderWidth = cardStyle?.match_item_border_width || 'border';
  const itemGap = Number.parseInt(cardStyle?.match_item_gap ?? '8', 10) || 0;
  
  // 4개 항목별 스타일 배열
  const itemStyles = [
    {
      background: cardStyle?.match_item_1_background_color || 'bg-white',
      borderColor: cardStyle?.match_item_1_border_color || 'border-slate-200',
      borderWidth: cardStyle?.match_item_1_border_width || 'border',
      fontSize: cardStyle?.match_item_1_font_size || 'text-sm',
      textAlign: cardStyle?.match_item_1_text_align || 'text-left',
    },
    {
      background: cardStyle?.match_item_2_background_color || 'bg-white',
      borderColor: cardStyle?.match_item_2_border_color || 'border-slate-200',
      borderWidth: cardStyle?.match_item_2_border_width || 'border',
      fontSize: cardStyle?.match_item_2_font_size || 'text-sm',
      textAlign: cardStyle?.match_item_2_text_align || 'text-left',
    },
    {
      background: cardStyle?.match_item_3_background_color || 'bg-white',
      borderColor: cardStyle?.match_item_3_border_color || 'border-slate-200',
      borderWidth: cardStyle?.match_item_3_border_width || 'border',
      fontSize: cardStyle?.match_item_3_font_size || 'text-sm',
      textAlign: cardStyle?.match_item_3_text_align || 'text-left',
    },
    {
      background: cardStyle?.match_item_4_background_color || 'bg-white',
      borderColor: cardStyle?.match_item_4_border_color || 'border-slate-200',
      borderWidth: cardStyle?.match_item_4_border_width || 'border',
      fontSize: cardStyle?.match_item_4_font_size || 'text-sm',
      textAlign: cardStyle?.match_item_4_text_align || 'text-left',
    },
  ];

  const buttonClass = [
    'mx-auto',
    'block',
    'rounded',
    cardStyle?.match_button_size || 'px-4 py-2',
    cardStyle?.match_button_color || 'bg-primary-600 text-white',
    cardStyle?.match_button_font_size || 'text-sm',
    'font-semibold',
    'transition',
    'hover:opacity-90',
    'disabled:cursor-not-allowed',
    'disabled:opacity-60',
  ]
    .filter(Boolean)
    .join(' ');

  const guideClasses = [
    'inline-block',
    'px-3',
    'py-2',
    'rounded',
    'text-slate-600',
    cardStyle?.match_guide_font_size || 'text-xs',
    cardStyle?.match_guide_background_color || 'bg-transparent',
    cardStyle?.match_guide_border_color && cardStyle.match_guide_border_color !== 'none'
      ? `${cardStyle.match_guide_border_width || 'border'} ${cardStyle.match_guide_border_color}`
      : cardStyle?.match_guide_border_color === 'none'
      ? ''
      : cardStyle?.match_guide_border_width || '',
  ]
    .filter(Boolean)
    .join(' ');

  const expectedOrder = useMemo(() => {
    const mapping = new Map<number, number>();
    pairs.forEach(([l, r]) => {
      mapping.set(l, r);
    });
    return left.map((_, index) => mapping.get(index) ?? index);
  }, [left, pairs]);

  const cleanupPreview = () => {
    if (dragPreviewRef.current) {
      document.body.removeChild(dragPreviewRef.current);
      dragPreviewRef.current = null;
    }
  };

  const createPreview = (text: string) => {
    cleanupPreview();
    const preview = document.createElement('div');
    preview.textContent = text;
    const previewClasses = [
      'rounded',
      'px-3',
      'py-2',
      'text-sm',
      'font-semibold',
      'text-slate-700',
      'shadow-lg',
      customMatchBackground || 'bg-white',
      itemBorderColor && itemBorderColor !== 'none'
        ? `${itemBorderWidth || 'border'} ${itemBorderColor}`
        : itemBorderColor === 'none'
        ? ''
        : itemBorderWidth || '',
    ]
      .filter(Boolean)
      .join(' ');
    preview.className = previewClasses;
    preview.style.position = 'absolute';
    preview.style.top = '-9999px';
    preview.style.left = '-9999px';
    preview.style.pointerEvents = 'none';
    document.body.appendChild(preview);
    dragPreviewRef.current = preview;
    return preview;
  };

  useEffect(() => {
    setOrder(right.map((_, idx) => idx));
    setDragIndex(null);
    setHoverIndex(null);
    cleanupPreview();
  }, [right]);

  useEffect(() => () => cleanupPreview(), []);

  const reorder = (list: number[], start: number, end: number) => {
    const result = [...list];
    const [removed] = result.splice(start, 1);
    result.splice(end, 0, removed);
    return result;
  };

  const handleSubmit = () => {
    if (disabled) return;
    const correct = order.every((value, index) => expectedOrder[index] === value);
    onSubmit(correct);
  };

  const handleDrop = (index: number) => {
    if (disabled || dragIndex === null) return;
    setOrder((prev) => reorder(prev, dragIndex, index));
    setDragIndex(null);
    setHoverIndex(null);
    cleanupPreview();
  };

  const rowStyles = [
    { background: 'bg-red-500/15', line: 'bg-red-300/60' },
    { background: 'bg-primary-500/15', line: 'bg-primary-300/60' },
    { background: 'bg-orange-500/15', line: 'bg-orange-300/60' },
    { background: 'bg-emerald-500/15', line: 'bg-emerald-300/60' },
    { background: 'bg-sky-500/15', line: 'bg-sky-300/60' },
    { background: 'bg-amber-500/15', line: 'bg-amber-300/60' },
    { background: 'bg-rose-500/15', line: 'bg-rose-300/60' },
    { background: 'bg-lime-500/15', line: 'bg-lime-300/60' },
    { background: 'bg-yellow-500/20', line: 'bg-yellow-300/60' },
  ];

  const getRowStyle = (index: number) => rowStyles[index % rowStyles.length];

    return (
    <div className="space-y-4 text-sm text-slate-900">
      <p className={titleClass}>대응되는 항목을 맞춰보세요</p>
      <div className={`w-full ${cardStyle?.match_guide_align || 'text-left'}`}>
        <span className={guideClasses}>오른쪽 항목을 드래그하여 순서를 조정하세요.</span>
      </div>
      <div
        className="flex flex-col"
        style={{ gap: `${itemGap}px` }}
      >
        {left.map((leftValue, index) => {
          const { background, line } = getRowStyle(index);
          const rightIndex = order[index];
          const rightValue = right[rightIndex];
          
          // 항목별 스타일 적용 (최대 4개까지, 그 이상은 순환)
          const itemStyle = itemStyles[index % itemStyles.length];
          const leftBackground = customMatchBackground || itemStyle.background || background;
          const rightBackground = customMatchBackground || itemStyle.background || background;
          const leftBorderColor = itemStyle.borderColor;
          const leftBorderWidth = itemStyle.borderWidth;
          const rightBorderColor = itemStyle.borderColor;
          const rightBorderWidth = itemStyle.borderWidth;
          const itemFontSize = itemStyle.fontSize;
          const itemTextAlign = itemStyle.textAlign;
          
          return (
            <div
              key={`row-${index}`}
              className="flex items-stretch text-sm"
            >
              <div
                className={[
                  'flex-1 rounded-l px-3 py-2 text-primary-100',
                  leftBorderColor && leftBorderColor !== 'none'
                    ? `${leftBorderWidth || 'border'} ${leftBorderColor}`
                    : leftBorderColor === 'none'
                    ? ''
                    : leftBorderWidth || '',
                  leftBackground,
                  itemFontSize,
                  itemTextAlign,
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <p className="font-semibold">{leftValue}</p>
              </div>
              <div className="flex items-center justify-center px-1">
              </div>
              <div
                className={[
                  'flex-1 rounded-r px-3 py-2 text-slate-900 transition',
                  disabled ? 'cursor-default' : 'cursor-grab hover:border-primary-500',
                  rightBorderColor && rightBorderColor !== 'none'
                    ? `${rightBorderWidth || 'border'} ${rightBorderColor}`
                    : rightBorderColor === 'none'
                    ? ''
                    : rightBorderWidth || '',
                  rightBackground,
                  itemFontSize,
                  itemTextAlign,
                  dragIndex === index ? 'ring-2 ring-primary-500' : '',
                  hoverIndex === index && dragIndex !== null && dragIndex !== index ? 'border-primary-500 bg-primary-50' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                draggable={!disabled}
                onDragStart={(event) => {
                  if (disabled) return;
                  setDragIndex(index);
                  setHoverIndex(index);
                  if (event.dataTransfer) {
                    event.dataTransfer.setData('text/plain', '');
                    const preview = createPreview(rightValue ?? '');
                    event.dataTransfer.setDragImage(preview, preview.offsetWidth / 2, preview.offsetHeight / 2);
                  }
                }}
                onDragOver={(event) => {
                  if (disabled) return;
                  event.preventDefault();
                }}
                onDragEnter={() => {
                  if (disabled) return;
                  if (dragIndex !== null) {
                    setHoverIndex(index);
                  }
                }}
                onDragLeave={() => {
                  if (hoverIndex === index) {
                    setHoverIndex(null);
                  }
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setHoverIndex(null);
                  cleanupPreview();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(index);
                }}
              >
                {rightValue}
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled}
        className={buttonClass}
      >
        매칭 확인
      </button>
    </div>
  );
}
