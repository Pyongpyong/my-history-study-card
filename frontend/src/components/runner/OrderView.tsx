import { useEffect, useRef, useState } from 'react';

const questionClass = 'w-full px-4 py-3 text-lg font-semibold text-primary-600 text-center bg-white';

interface OrderViewProps {
  card: any;
  disabled: boolean;
  onSubmit: (correct: boolean) => void;
  cardStyle?: any;
}

export default function OrderView({ card, disabled, onSubmit, cardStyle }: OrderViewProps) {
  const items: string[] = Array.isArray(card.items) ? card.items : [];
  const answerOrder: number[] = Array.isArray(card.answer_order)
    ? card.answer_order
    : items.map((_, index) => index);
  const [order, setOrder] = useState<number[]>(items.map((_, idx) => idx));
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

  const itemBackground = cardStyle?.order_item_background_color || 'bg-white';
  const itemBorderColor = cardStyle?.order_item_border_color || 'border-slate-300';
  const itemBorderWidth = cardStyle?.order_item_border_width || 'border';
  const itemGap = Number.parseInt(cardStyle?.order_item_gap ?? '8', 10) || 0;

  const buttonClass = [
    'mx-auto',
    'block',
    'rounded',
    cardStyle?.order_button_size || 'px-4 py-2',
    cardStyle?.order_button_color || 'bg-primary-600 text-white',
    cardStyle?.order_button_font_size || 'text-sm',
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
    cardStyle?.order_guide_font_size || 'text-xs',
    cardStyle?.order_guide_background_color || 'bg-transparent',
    cardStyle?.order_guide_border_color && cardStyle.order_guide_border_color !== 'none'
      ? `${cardStyle.order_guide_border_width || 'border'} ${cardStyle.order_guide_border_color}`
      : cardStyle?.order_guide_border_color === 'none'
      ? ''
      : cardStyle?.order_guide_border_width || '',
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    setOrder(items.map((_, idx) => idx));
  }, [items]);

  useEffect(() => () => cleanupPreview(), []);

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
      itemBackground,
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

  const reorder = (list: number[], start: number, end: number) => {
    const result = [...list];
    const [removed] = result.splice(start, 1);
    result.splice(end, 0, removed);
    return result;
  };

  const handleDrop = (position: number) => {
    if (disabled || dragIndex === null) return;
    const next = reorder(order, dragIndex, position);
    setOrder(next);
    setDragIndex(null);
    setHoverIndex(null);
    cleanupPreview();
  };

  const clearDragState = () => {
    setDragIndex(null);
    setHoverIndex(null);
    cleanupPreview();
  };

  const handleSubmit = () => {
    if (disabled) return;
    const correct = order.every((value, index) => answerOrder[index] === value);
    onSubmit(correct);
  };

  return (
    <div className="space-y-4 text-sm text-slate-900">
      <p className={titleClass}>올바른 순서를 맞춰보세요</p>
      <div className={`w-full ${cardStyle?.order_guide_align || 'text-left'}`}>
        <span className={guideClasses}>항목을 드래그하여 순서를 변경한 뒤, 순서 확인 버튼을 눌러주세요.</span>
      </div>
      <ul
        className="flex flex-col"
        style={{ gap: `${itemGap}px` }}
      >
        {order.map((originalIndex, position) => (
          <li
            key={`${items[originalIndex]}-${originalIndex}`}
            className={[
              'flex items-center justify-center rounded px-3 py-2 transition',
              disabled ? 'cursor-default' : 'cursor-grab hover:border-primary-500',
              itemBackground,
              itemBorderColor && itemBorderColor !== 'none'
                ? `${itemBorderWidth || 'border'} ${itemBorderColor}`
                : itemBorderColor === 'none'
                ? ''
                : itemBorderWidth || '',
              dragIndex === position
                ? 'border-primary-500 bg-primary-100'
                : hoverIndex === position
                ? 'border-primary-500 bg-primary-50'
                : '',
            ]
              .filter(Boolean)
              .join(' ')}
            draggable={!disabled}
            onDragStart={(event) => {
              if (disabled) return;
              setDragIndex(position);
              setHoverIndex(position);
              if (event.dataTransfer) {
                event.dataTransfer.setData('text/plain', '');
                const preview = createPreview(items[originalIndex]);
                event.dataTransfer.setDragImage(preview, preview.offsetWidth / 2, preview.offsetHeight / 2);
              }
            }}
            onDragOver={(event) => {
              if (disabled) return;
              event.preventDefault();
            }}
            onDragEnter={() => {
              if (disabled) return;
              if (dragIndex !== null && dragIndex !== position) {
                setHoverIndex(position);
              }
            }}
            onDragLeave={() => {
              if (hoverIndex === position) {
                setHoverIndex(null);
              }
            }}
            onDragEnd={clearDragState}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(position);
            }}
          >
            <div className="flex items-center justify-center">
              <span>{items[originalIndex]}</span>
            </div>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled}
        className={buttonClass}
      >
        순서 확인
      </button>
    </div>
  );
}
