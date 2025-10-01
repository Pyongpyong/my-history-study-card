import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchCardStyle,
  fetchDefaultCardStyle,
  createCardStyle,
  updateCardStyle,
  fetchCardDecksRequest,
  type CardStyle,
  type CardStyleCreate,
  type CardStyleUpdate,
  type CardDeck,
} from '../api';
import { useAuth } from '../context/AuthContext';
import { getCardDeckImageUrl } from '../utils/assets';
import CardRunner from '../components/CardRunner';

// 스타일 옵션 정의
const FONT_SIZES = [
  { value: 'text-xs', label: '매우 작게 (12px)' },
  { value: 'text-sm', label: '작게 (14px)' },
  { value: 'text-base', label: '기본 (16px)' },
  { value: 'text-lg', label: '크게 (18px)' },
  { value: 'text-xl', label: '더 크게 (20px)' },
  { value: 'text-2xl', label: '매우 크게 (24px)' },
];

const TEXT_COLORS = [
  { value: 'text-slate-900', label: '진한 회색' },
  { value: 'text-slate-700', label: '회색' },
  { value: 'text-slate-600', label: '연한 회색' },
  { value: 'text-primary-600', label: '올리브 (기본)' },
  { value: 'text-primary-700', label: '진한 올리브' },
  { value: 'text-blue-600', label: '파란색' },
  { value: 'text-red-600', label: '빨간색' },
  { value: 'text-green-600', label: '녹색' },
  { value: 'text-purple-600', label: '보라색' },
  { value: 'text-black', label: '검은색' },
  { value: 'text-white', label: '흰색' },
];

const BACKGROUND_COLORS = [
  { value: 'bg-white', label: '흰색 (기본)' },
  { value: 'bg-transparent', label: '투명' },
  { value: 'bg-slate-50', label: '아주 연한 회색' },
  { value: 'bg-slate-100', label: '연한 회색' },
  { value: 'bg-slate-200', label: '밝은 회색' },
  { value: 'bg-primary-50', label: '연한 올리브' },
  { value: 'bg-primary-100', label: '밝은 올리브' },
  { value: 'bg-emerald-50', label: '연한 초록' },
  { value: 'bg-blue-50', label: '연한 파랑' },
  { value: 'bg-amber-50', label: '연한 노랑' },
  { value: 'bg-rose-50', label: '연한 붉은색' },
  { value: 'bg-purple-50', label: '연한 보라색' },
];

const BORDER_COLORS = [
  { value: 'none', label: '없음 (기본)' },
  { value: 'border-slate-200', label: '연한 회색' },
  { value: 'border-slate-300', label: '회색' },
  { value: 'border-slate-400', label: '진한 회색' },
  { value: 'border-primary-300', label: '연한 올리브' },
  { value: 'border-primary-500', label: '올리브' },
  { value: 'border-primary-600', label: '진한 올리브' },
  { value: 'border-emerald-400', label: '초록' },
  { value: 'border-emerald-500', label: '진한 초록' },
  { value: 'border-blue-400', label: '파랑' },
  { value: 'border-blue-500', label: '진한 파랑' },
  { value: 'border-rose-400', label: '붉은색' },
  { value: 'border-rose-500', label: '진한 붉은색' },
  { value: 'border-purple-400', label: '보라색' },
  { value: 'border-black', label: '검정' },
];

const BORDER_WIDTHS = [
  { value: 'border', label: '기본 (1px)' },
  { value: 'border-2', label: '두껍게 (2px)' },
  { value: 'border-4', label: '더 두껍게 (4px)' },
  { value: 'border-8', label: '매우 두껍게 (8px)' },
  { value: 'border-[1px]', label: '1px' },
  { value: 'border-[3px]', label: '3px' },
  { value: 'border-[6px]', label: '6px' },
];

const INPUT_HEIGHTS = [
  { value: 'h-10', label: '40px (h-10)' },
  { value: 'h-12', label: '48px (h-12)' },
  { value: 'h-14', label: '56px (h-14)' },
  { value: 'h-16', label: '64px (h-16)' },
  { value: 'h-auto', label: '자동 높이' },
];

const BUTTON_FONT_SIZES = [
  { value: 'text-xs', label: '매우 작게 (12px)' },
  { value: 'text-sm', label: '작게 (14px)' },
  { value: 'text-base', label: '기본 (16px)' },
  { value: 'text-lg', label: '크게 (18px)' },
  { value: 'text-xl', label: '더 크게 (20px)' },
];

const OX_BUTTON_SIZES = [
  { value: 'h-16 w-16 text-lg', label: '작게 (64px)' },
  { value: 'h-20 w-20 text-xl', label: '기본 (80px)' },
  { value: 'h-24 w-24 text-2xl', label: '크게 (96px)' },
  { value: 'h-28 w-28 text-3xl', label: '매우 크게 (112px)' },
];

const BUTTON_RADIUS_OPTIONS = [
  { value: 'rounded', label: '작은 라운드' },
  { value: 'rounded-md', label: '중간 라운드' },
  { value: 'rounded-lg', label: '큰 라운드' },
  { value: 'rounded-xl', label: '아주 큰 라운드' },
  { value: 'rounded-full', label: '완전 원형' },
];

const OX_O_COLOR_OPTIONS = [
  { value: 'bg-emerald-700 text-white', label: '진한 초록' },
  { value: 'bg-emerald-600 text-white', label: '초록' },
  { value: 'bg-emerald-500 text-white', label: '밝은 초록' },
  { value: 'bg-emerald-100 text-emerald-700', label: '연한 초록' },
  { value: 'bg-white text-emerald-700', label: '흰색 배경' },
];

const OX_X_COLOR_OPTIONS = [
  { value: 'bg-rose-700 text-white', label: '진한 붉은색' },
  { value: 'bg-rose-600 text-white', label: '붉은색' },
  { value: 'bg-rose-500 text-white', label: '밝은 붉은색' },
  { value: 'bg-rose-100 text-rose-700', label: '연한 붉은색' },
  { value: 'bg-white text-rose-700', label: '흰색 배경' },
];

const UNDERLINE_WIDTHS = [
  { value: 'border-b', label: '얇게 (1px)' },
  { value: 'border-b-2', label: '두껍게 (2px)' },
  { value: 'border-b-4', label: '더 두껍게 (4px)' },
  { value: 'border-b-0', label: '없음' },
];

const UNDERLINE_FOCUS_COLORS = [
  { value: 'focus:border-primary-500', label: '올리브' },
  { value: 'focus:border-emerald-500', label: '초록' },
  { value: 'focus:border-blue-500', label: '파랑' },
  { value: 'focus:border-rose-500', label: '붉은색' },
  { value: 'focus:border-slate-500', label: '회색' },
];

const BUTTON_COLOR_OPTIONS = [
  { value: 'bg-primary-600 text-white', label: '올리브 (기본)' },
  { value: 'bg-primary-500 text-white', label: '밝은 올리브' },
  { value: 'bg-emerald-600 text-white', label: '초록' },
  { value: 'bg-blue-600 text-white', label: '파랑' },
  { value: 'bg-rose-600 text-white', label: '붉은색' },
  { value: 'bg-slate-800 text-white', label: '짙은 회색' },
  { value: 'bg-white text-slate-900 border border-slate-300', label: '흰색 테두리' },
];

const TEXT_ALIGNS = [
  { value: 'text-left', label: '왼쪽 정렬' },
  { value: 'text-center', label: '가운데 정렬' },
  { value: 'text-right', label: '오른쪽 정렬' },
];

const BACK_LAYOUTS = [
  { value: 'top', label: '상단 정렬' },
  { value: 'center', label: '중앙 정렬' },
  { value: 'bottom', label: '하단 정렬' },
  { value: 'split', label: '상하단 정렬' },
];

const BUTTON_SIZES = [
  { value: 'px-2 py-1 text-xs', label: '매우 작게' },
  { value: 'px-3 py-1.5 text-sm', label: '작게' },
  { value: 'px-4 py-2', label: '보통' },
  { value: 'px-6 py-3 text-lg', label: '크게' },
  { value: 'px-8 py-4 text-xl', label: '매우 크게' },
];

const BUTTON_COLORS = [
  { value: 'bg-primary-600 text-white', label: '올리브 (기본)' },
  { value: 'bg-primary-700 text-white', label: '진한 올리브' },
  { value: 'bg-blue-600 text-white', label: '파란색' },
  { value: 'bg-red-600 text-white', label: '빨간색' },
  { value: 'bg-green-600 text-white', label: '녹색' },
  { value: 'bg-purple-600 text-white', label: '보라색' },
  { value: 'bg-gray-600 text-white', label: '회색' },
  { value: 'bg-slate-100 text-slate-900', label: '연한 회색' },
  { value: 'bg-white text-slate-900 border border-slate-300', label: '흰색 테두리' },
];

const LAYOUT_OPTIONS = [
  { value: 'top', label: '상단 정렬', description: '문제와 답변이 상단에 배치' },
  { value: 'center', label: '중앙 정렬', description: '문제와 답변이 중앙에 배치' },
  { value: 'bottom', label: '하단 정렬', description: '문제와 답변이 하단에 배치' },
  { value: 'split', label: '상하단 정렬', description: '문제는 상단, 답변은 하단에 배치' },
];

interface StyleFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function StyleField({ label, value, onChange, options }: StyleFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// 카드 유형 정의
const CARD_TYPES = [
  { value: 'ALL', label: '전체 (기본)' },
  { value: 'MCQ', label: '객관식 (MCQ)' },
  { value: 'SHORT', label: '주관식 (SHORT)' },
  { value: 'OX', label: 'OX 문제' },
  { value: 'CLOZE', label: '빈칸 문제' },
  { value: 'ORDER', label: '순서 문제' },
  { value: 'MATCH', label: '짝맞추기' },
];

// 카드 유형별 샘플 데이터
const SAMPLE_CARDS = {
  MCQ: {
    type: 'MCQ',
    question: '조선 전기 과거제도에서 문과의 최종 시험은?',
    options: ['전시', '회시', '복시', '생원시'],
    answer_index: 0,
    explain: '전시는 문과의 최종 시험으로, 왕이 직접 출제하고 채점했습니다.',
  },
  SHORT: {
    type: 'SHORT',
    prompt: '조선 전기 과거제도에서 문과의 최종 시험의 이름을 쓰시오.',
    answer: '전시',
    explain: '전시는 문과의 최종 시험으로, 왕이 직접 출제하고 채점했습니다.',
  },
  OX: {
    type: 'OX',
    statement: '조선 전기 과거제도에서 문과의 최종 시험은 전시이다.',
    answer: true,
    explain: '전시는 문과의 최종 시험으로, 왕이 직접 출제하고 채점했습니다.',
  },
  CLOZE: {
    type: 'CLOZE',
    text: '조선 전기 과거제도에서 문과의 최종 시험은 {{c1}}이다.',
    clozes: { c1: '전시' },
    explain: '전시는 문과의 최종 시험으로, 왕이 직접 출제하고 채점했습니다.',
  },
  ORDER: {
    type: 'ORDER',
    question: '다음 조선 전기 과거제도의 시험 순서를 올바르게 배열하시오.',
    items: ['생원시', '회시', '전시'],
    answer_order: [0, 1, 2],
    explain: '생원시 → 회시 → 전시 순서로 진행되었습니다.',
  },
  MATCH: {
    type: 'MATCH',
    question: '다음 시험과 그 특징을 올바르게 연결하시오.',
    left: ['생원시', '회시', '전시'],
    right: ['초시', '복시', '최종시험'],
    pairs: [[0, 0], [1, 1], [2, 2]],
    explain: '각 시험은 해당하는 특징과 연결됩니다.',
  },
  ALL: {
    type: 'MCQ',
    question: '조선 전기 과거제도에서 문과의 최종 시험은?',
    options: ['전시', '회시', '복시', '생원시'],
    answer_index: 0,
    explain: '전시는 문과의 최종 시험으로, 왕이 직접 출제하고 채점했습니다.',
  },
};

export default function CardStyleEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardStyle, setCardStyle] = useState<CardStyle | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardDecks, setCardDecks] = useState<CardDeck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<CardDeck | null>(null);

  const applyDefaultCardStyleValues = (style: CardStyle): CardStyle => ({
    ...style,
    front_title_background_color: style.front_title_background_color || 'bg-white',
    front_title_border_color: style.front_title_border_color || 'none',
    front_title_border_width: style.front_title_border_width || 'border',
    front_content_size: style.front_content_size || 'text-sm',
    front_content_color: style.front_content_color || 'text-slate-900',
    front_content_align: style.front_content_align || 'text-left',
    front_content_margin_top: style.front_content_margin_top || '0',
    front_content_margin_bottom: style.front_content_margin_bottom || '0',
    front_content_margin_left: style.front_content_margin_left || '0',
    front_content_margin_right: style.front_content_margin_right || '0',
    mcq_option_background_color: style.mcq_option_background_color || 'bg-white',
    mcq_option_border_color: style.mcq_option_border_color || 'none',
    mcq_option_border_width: style.mcq_option_border_width || 'border',
    mcq_option_gap: style.mcq_option_gap || '8',
    short_input_height: style.short_input_height || 'h-12',
    short_input_background_color: style.short_input_background_color || 'bg-white',
    short_input_border_color: style.short_input_border_color || 'border-slate-300',
    short_input_border_width: style.short_input_border_width || 'border',
    ox_button_o_size: style.ox_button_o_size || 'h-20 w-20 text-xl',
    ox_button_o_background_color: style.ox_button_o_background_color || 'bg-emerald-700 text-white',
    ox_button_o_radius: style.ox_button_o_radius || 'rounded-full',
    ox_button_o_border_color: style.ox_button_o_border_color || 'none',
    ox_button_o_border_width: style.ox_button_o_border_width || 'border',
    ox_button_x_size: style.ox_button_x_size || 'h-20 w-20 text-xl',
    ox_button_x_background_color: style.ox_button_x_background_color || 'bg-rose-700 text-white',
    ox_button_x_radius: style.ox_button_x_radius || 'rounded-full',
    ox_button_x_border_color: style.ox_button_x_border_color || 'none',
    ox_button_x_border_width: style.ox_button_x_border_width || 'border',
    ox_button_gap: style.ox_button_gap || '24',
    cloze_input_font_size: style.cloze_input_font_size || 'text-base',
    cloze_input_background_color: style.cloze_input_background_color || 'bg-transparent',
    cloze_input_border_color: style.cloze_input_border_color || 'border-primary-500',
    cloze_input_border_width: style.cloze_input_border_width || 'border-b',
    cloze_input_underline_color: style.cloze_input_underline_color || 'focus:border-primary-500',
    cloze_button_size: style.cloze_button_size || 'px-4 py-2',
    cloze_button_color: style.cloze_button_color || 'bg-primary-600 text-white',
    cloze_button_font_size: style.cloze_button_font_size || 'text-sm',
    order_item_background_color: style.order_item_background_color || 'bg-white',
    order_item_border_color: style.order_item_border_color || 'border-slate-300',
    order_item_border_width: style.order_item_border_width || 'border',
    order_item_gap: style.order_item_gap || '8',
    order_button_size: style.order_button_size || 'px-4 py-2',
    order_button_color: style.order_button_color || 'bg-primary-600 text-white',
    order_button_font_size: style.order_button_font_size || 'text-sm',
    order_guide_align: style.order_guide_align || 'text-left',
    order_guide_font_size: style.order_guide_font_size || 'text-xs',
    order_guide_background_color: style.order_guide_background_color || 'bg-transparent',
    order_guide_border_color: style.order_guide_border_color || 'none',
    order_guide_border_width: style.order_guide_border_width || 'border',
    match_item_background_color: style.match_item_background_color || 'bg-white',
    match_item_border_color: style.match_item_border_color || 'border-slate-200',
    match_item_border_width: style.match_item_border_width || 'border',
    match_item_gap: style.match_item_gap || '8',
    match_line_color: style.match_line_color || 'default',
    match_button_size: style.match_button_size || 'px-4 py-2',
    match_button_color: style.match_button_color || 'bg-primary-600 text-white',
    match_button_font_size: style.match_button_font_size || 'text-sm',
    match_guide_align: style.match_guide_align || 'text-left',
    match_guide_font_size: style.match_guide_font_size || 'text-xs',
    match_guide_background_color: style.match_guide_background_color || 'bg-transparent',
    match_guide_border_color: style.match_guide_border_color || 'none',
    match_guide_border_width: style.match_guide_border_width || 'border',
  });

  const renderCardTypeSpecificControls = () => {
    if (!cardStyle) return null;

    // const typeOrder: Array<CardStyle['card_type']> = ['MCQ', 'SHORT', 'OX', 'CLOZE', 'ORDER', 'MATCH'];
    const targetTypes = cardStyle.card_type === 'ALL' ? [] : [cardStyle.card_type as CardStyle['card_type']];
    console.log('Target Types:', targetTypes);
    console.log('Current Card Type:', cardStyle.card_type);
    const typeLabels: Record<string, string> = {
      MCQ: '객관식 (MCQ)',
      SHORT: '주관식 (SHORT)',
      OX: 'OX',
      CLOZE: '빈칸 (CLOZE)',
      ORDER: '순서 (ORDER)',
      MATCH: '짝맞추기 (MATCH)',
    };

    return (
      <div className="space-y-8 mt-6">
        {targetTypes.map((type) => {
          switch (type) {
            case 'MCQ':
              return (
                <div key={type} className="space-y-4">
                  <h3 className="text-md font-medium text-primary-700">{typeLabels[type]} 전용 스타일</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <StyleField
                      label="답변 배경 색상"
                      value={cardStyle.mcq_option_background_color || 'bg-white'}
                      onChange={(value) => updateCardStyleField('mcq_option_background_color', value)}
                      options={BACKGROUND_COLORS}
                    />
                    <StyleField
                      label="답변 외곽선 색상"
                      value={cardStyle.mcq_option_border_color || 'none'}
                      onChange={(value) => updateCardStyleField('mcq_option_border_color', value)}
                      options={BORDER_COLORS}
                    />
                    <StyleField
                      label="답변 외곽선 두께"
                      value={cardStyle.mcq_option_border_width || 'border'}
                      onChange={(value) => updateCardStyleField('mcq_option_border_width', value)}
                      options={BORDER_WIDTHS}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">답변 항목 간 간격 (px)</label>
                    <input
                      type="number"
                      min="0"
                      value={cardStyle.mcq_option_gap || '8'}
                      onChange={(e) => updateCardStyleField('mcq_option_gap', e.target.value || '0')}
                      className="w-32 rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>
              );
            case 'SHORT':
              return (
                <div key={type} className="space-y-4">
                  <h3 className="text-md font-medium text-primary-700">{typeLabels[type]} 전용 스타일</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <StyleField
                      label="답변 입력 높이"
                      value={cardStyle.short_input_height || 'h-12'}
                      onChange={(value) => updateCardStyleField('short_input_height', value)}
                      options={INPUT_HEIGHTS}
                    />
                    <StyleField
                      label="배경 색상"
                      value={cardStyle.short_input_background_color || 'bg-white'}
                      onChange={(value) => updateCardStyleField('short_input_background_color', value)}
                      options={BACKGROUND_COLORS}
                    />
                    <StyleField
                      label="외곽선 색상"
                      value={cardStyle.short_input_border_color || 'border-slate-300'}
                      onChange={(value) => updateCardStyleField('short_input_border_color', value)}
                      options={BORDER_COLORS}
                    />
                    <StyleField
                      label="외곽선 두께"
                      value={cardStyle.short_input_border_width || 'border'}
                      onChange={(value) => updateCardStyleField('short_input_border_width', value)}
                      options={BORDER_WIDTHS}
                    />
                  </div>
                </div>
              );
            case 'OX':
              return (
                <div key={type} className="space-y-4">
                  <h3 className="text-md font-medium text-primary-700">{typeLabels[type]} 전용 스타일</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <StyleField
                      label="O 버튼 크기"
                      value={cardStyle.ox_button_o_size || 'h-20 w-20 text-xl'}
                      onChange={(value) => updateCardStyleField('ox_button_o_size', value)}
                      options={OX_BUTTON_SIZES}
                    />
                    <StyleField
                      label="O 버튼 배경"
                      value={cardStyle.ox_button_o_background_color || 'bg-emerald-700 text-white'}
                      onChange={(value) => updateCardStyleField('ox_button_o_background_color', value)}
                      options={OX_O_COLOR_OPTIONS}
                    />
                    <StyleField
                      label="O 버튼 라운드"
                      value={cardStyle.ox_button_o_radius || 'rounded-full'}
                      onChange={(value) => updateCardStyleField('ox_button_o_radius', value)}
                      options={BUTTON_RADIUS_OPTIONS}
                    />
                    <StyleField
                      label="O 버튼 외곽선 색상"
                      value={cardStyle.ox_button_o_border_color || 'none'}
                      onChange={(value) => updateCardStyleField('ox_button_o_border_color', value)}
                      options={BORDER_COLORS}
                    />
                    <StyleField
                      label="O 버튼 외곽선 두께"
                      value={cardStyle.ox_button_o_border_width || 'border'}
                      onChange={(value) => updateCardStyleField('ox_button_o_border_width', value)}
                      options={BORDER_WIDTHS}
                    />
                    <StyleField
                      label="X 버튼 크기"
                      value={cardStyle.ox_button_x_size || 'h-20 w-20 text-xl'}
                      onChange={(value) => updateCardStyleField('ox_button_x_size', value)}
                      options={OX_BUTTON_SIZES}
                    />
                    <StyleField
                      label="X 버튼 배경"
                      value={cardStyle.ox_button_x_background_color || 'bg-rose-700 text-white'}
                      onChange={(value) => updateCardStyleField('ox_button_x_background_color', value)}
                      options={OX_X_COLOR_OPTIONS}
                    />
                    <StyleField
                      label="X 버튼 라운드"
                      value={cardStyle.ox_button_x_radius || 'rounded-full'}
                      onChange={(value) => updateCardStyleField('ox_button_x_radius', value)}
                      options={BUTTON_RADIUS_OPTIONS}
                    />
                    <StyleField
                      label="X 버튼 외곽선 색상"
                      value={cardStyle.ox_button_x_border_color || 'none'}
                      onChange={(value) => updateCardStyleField('ox_button_x_border_color', value)}
                      options={BORDER_COLORS}
                    />
                    <StyleField
                      label="X 버튼 외곽선 두께"
                      value={cardStyle.ox_button_x_border_width || 'border'}
                      onChange={(value) => updateCardStyleField('ox_button_x_border_width', value)}
                      options={BORDER_WIDTHS}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">OX 버튼 간 간격 (px)</label>
                    <input
                      type="number"
                      min="0"
                      value={cardStyle.ox_button_gap || '24'}
                      onChange={(e) => updateCardStyleField('ox_button_gap', e.target.value || '0')}
                      className="w-32 rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                </div>
              );
            case 'CLOZE':
              return (
                <div key={type} className="space-y-4">
                  <h3 className="text-md font-medium text-primary-700">{typeLabels[type]} 전용 스타일</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <StyleField
                      label="빈칸 입력 글자 크기"
                      value={cardStyle.cloze_input_font_size || 'text-base'}
                      onChange={(value) => updateCardStyleField('cloze_input_font_size', value)}
                      options={FONT_SIZES}
                    />
                    <StyleField
                      label="빈칸 배경 색상"
                      value={cardStyle.cloze_input_background_color || 'bg-transparent'}
                      onChange={(value) => updateCardStyleField('cloze_input_background_color', value)}
                      options={BACKGROUND_COLORS}
                    />
                    <StyleField
                      label="밑줄 색상"
                      value={cardStyle.cloze_input_border_color || 'border-primary-500'}
                      onChange={(value) => updateCardStyleField('cloze_input_border_color', value)}
                      options={BORDER_COLORS}
                    />
                    <StyleField
                      label="밑줄 두께"
                      value={cardStyle.cloze_input_border_width || 'border-b'}
                      onChange={(value) => updateCardStyleField('cloze_input_border_width', value)}
                      options={UNDERLINE_WIDTHS}
                    />
                    <StyleField
                      label="포커스 밑줄 색상"
                      value={cardStyle.cloze_input_underline_color || 'border-primary-500'}
                      onChange={(value) => updateCardStyleField('cloze_input_underline_color', value)}
                      options={UNDERLINE_FOCUS_COLORS}
                    />
                    <StyleField
                      label="제출 버튼 크기"
                      value={cardStyle.cloze_button_size || 'px-4 py-2'}
                      onChange={(value) => updateCardStyleField('cloze_button_size', value)}
                      options={BUTTON_SIZES}
                    />
                    <StyleField
                      label="제출 버튼 색상"
                      value={cardStyle.cloze_button_color || 'bg-primary-600 text-white'}
                      onChange={(value) => updateCardStyleField('cloze_button_color', value)}
                      options={BUTTON_COLOR_OPTIONS}
                    />
                    <StyleField
                      label="제출 버튼 글자 크기"
                      value={cardStyle.cloze_button_font_size || 'text-sm'}
                      onChange={(value) => updateCardStyleField('cloze_button_font_size', value)}
                      options={BUTTON_FONT_SIZES}
                    />
                  </div>
                </div>
              );
            case 'ORDER':
              return (
                <div key={type} className="space-y-4">
                  <h3 className="text-md font-medium text-primary-700">{typeLabels[type]} 전용 스타일</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <StyleField
                      label="항목 배경 색상"
                      value={cardStyle.order_item_background_color || 'bg-white'}
                      onChange={(value) => updateCardStyleField('order_item_background_color', value)}
                      options={BACKGROUND_COLORS}
                    />
                    <StyleField
                      label="항목 외곽선 색상"
                      value={cardStyle.order_item_border_color || 'border-slate-300'}
                      onChange={(value) => updateCardStyleField('order_item_border_color', value)}
                      options={BORDER_COLORS}
                    />
                    <StyleField
                      label="항목 외곽선 두께"
                      value={cardStyle.order_item_border_width || 'border'}
                      onChange={(value) => updateCardStyleField('order_item_border_width', value)}
                      options={BORDER_WIDTHS}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">항목 간 간격 (px)</label>
                    <input
                      type="number"
                      min="0"
                      value={cardStyle.order_item_gap || '8'}
                      onChange={(e) => updateCardStyleField('order_item_gap', e.target.value || '0')}
                      className="w-32 rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <StyleField
                      label="확인 버튼 크기"
                      value={cardStyle.order_button_size || 'px-4 py-2'}
                      onChange={(value) => updateCardStyleField('order_button_size', value)}
                      options={BUTTON_SIZES}
                    />
                    <StyleField
                      label="확인 버튼 색상"
                      value={cardStyle.order_button_color || 'bg-primary-600 text-white'}
                      onChange={(value) => updateCardStyleField('order_button_color', value)}
                      options={BUTTON_COLOR_OPTIONS}
                    />
                    <StyleField
                      label="확인 버튼 글자 크기"
                      value={cardStyle.order_button_font_size || 'text-sm'}
                      onChange={(value) => updateCardStyleField('order_button_font_size', value)}
                      options={BUTTON_FONT_SIZES}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <StyleField
                      label="가이드 정렬"
                      value={cardStyle.order_guide_align || 'text-left'}
                      onChange={(value) => updateCardStyleField('order_guide_align', value)}
                      options={TEXT_ALIGNS}
                    />
                    <StyleField
                      label="가이드 글자 크기"
                      value={cardStyle.order_guide_font_size || 'text-xs'}
                      onChange={(value) => updateCardStyleField('order_guide_font_size', value)}
                      options={FONT_SIZES}
                    />
                    <StyleField
                      label="가이드 배경 색상"
                      value={cardStyle.order_guide_background_color || 'bg-transparent'}
                      onChange={(value) => updateCardStyleField('order_guide_background_color', value)}
                      options={BACKGROUND_COLORS}
                    />
                    <StyleField
                      label="가이드 외곽선 색상"
                      value={cardStyle.order_guide_border_color || 'none'}
                      onChange={(value) => updateCardStyleField('order_guide_border_color', value)}
                      options={BORDER_COLORS}
                    />
                    <StyleField
                      label="가이드 외곽선 두께"
                      value={cardStyle.order_guide_border_width || 'border'}
                      onChange={(value) => updateCardStyleField('order_guide_border_width', value)}
                      options={BORDER_WIDTHS}
                    />
                  </div>
                </div>
              );
            case 'MATCH':
              return (
                <div key={type} className="space-y-4">
                  <h3 className="text-md font-medium text-primary-700">{typeLabels[type]} 전용 스타일</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <StyleField
                      label="항목 배경 색상"
                      value={cardStyle.match_item_background_color || 'bg-white'}
                      onChange={(value) => updateCardStyleField('match_item_background_color', value)}
                      options={BACKGROUND_COLORS}
                    />
                    <StyleField
                      label="항목 외곽선 색상"
                      value={cardStyle.match_item_border_color || 'border-slate-200'}
                      onChange={(value) => updateCardStyleField('match_item_border_color', value)}
                      options={BORDER_COLORS}
                    />
                    <StyleField
                      label="항목 외곽선 두께"
                      value={cardStyle.match_item_border_width || 'border'}
                      onChange={(value) => updateCardStyleField('match_item_border_width', value)}
                      options={BORDER_WIDTHS}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">항목 간 간격 (px)</label>
                    <input
                      type="number"
                      min="0"
                      value={cardStyle.match_item_gap || '8'}
                      onChange={(e) => updateCardStyleField('match_item_gap', e.target.value || '0')}
                      className="w-32 rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <StyleField
                      label="확인 버튼 크기"
                      value={cardStyle.match_button_size || 'px-4 py-2'}
                      onChange={(value) => updateCardStyleField('match_button_size', value)}
                      options={BUTTON_SIZES}
                    />
                    <StyleField
                      label="확인 버튼 색상"
                      value={cardStyle.match_button_color || 'bg-primary-600 text-white'}
                      onChange={(value) => updateCardStyleField('match_button_color', value)}
                      options={BUTTON_COLOR_OPTIONS}
                    />
                    <StyleField
                      label="확인 버튼 글자 크기"
                      value={cardStyle.match_button_font_size || 'text-sm'}
                      onChange={(value) => updateCardStyleField('match_button_font_size', value)}
                      options={BUTTON_FONT_SIZES}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <StyleField
                      label="가이드 정렬"
                      value={cardStyle.match_guide_align || 'text-left'}
                      onChange={(value) => updateCardStyleField('match_guide_align', value)}
                      options={TEXT_ALIGNS}
                    />
                    <StyleField
                      label="가이드 글자 크기"
                      value={cardStyle.match_guide_font_size || 'text-xs'}
                      onChange={(value) => updateCardStyleField('match_guide_font_size', value)}
                      options={FONT_SIZES}
                    />
                    <StyleField
                      label="가이드 배경 색상"
                      value={cardStyle.match_guide_background_color || 'bg-transparent'}
                      onChange={(value) => updateCardStyleField('match_guide_background_color', value)}
                      options={BACKGROUND_COLORS}
                    />
                    <StyleField
                      label="가이드 외곽선 색상"
                      value={cardStyle.match_guide_border_color || 'none'}
                      onChange={(value) => updateCardStyleField('match_guide_border_color', value)}
                      options={BORDER_COLORS}
                    />
                    <StyleField
                      label="가이드 외곽선 두께"
                      value={cardStyle.match_guide_border_width || 'border'}
                      onChange={(value) => updateCardStyleField('match_guide_border_width', value)}
                      options={BORDER_WIDTHS}
                    />
                  </div>
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
    );
  };


  const previewCard = useMemo(() => {
    const typeKey = (cardStyle?.card_type ?? 'ALL') as keyof typeof SAMPLE_CARDS;
    return SAMPLE_CARDS[typeKey] ?? SAMPLE_CARDS.ALL;
  }, [cardStyle?.card_type]);

  const defaultFrontDeckImage = getCardDeckImageUrl('card_frame_front.png') ?? undefined;
  const defaultBackDeckImage = getCardDeckImageUrl('card_frame_back.png') ?? undefined;
  const previewFrontImage = selectedDeck?.front_image
    ? getCardDeckImageUrl(selectedDeck.front_image)
    : defaultFrontDeckImage;
  const previewBackImage = selectedDeck?.back_image
    ? getCardDeckImageUrl(selectedDeck.back_image)
    : defaultBackDeckImage;
  const previewExplanation = previewCard?.explain ?? '정답 설명이 여기에 표시됩니다.';
  const previewNextActionLabel = '다음 문제';
  const previewIsCorrect = true;
  const handlePreviewSubmit = () => {};

  const isNew = id === 'new';
  const isAdmin = user?.is_admin;

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        
        // 카드덱 목록 로드
        const cardDecksResponse = await fetchCardDecksRequest(1, 100);
        setCardDecks(cardDecksResponse.items);
        
        // 기본 카드덱 선택
        const defaultDeck = cardDecksResponse.items.find(deck => deck.is_default) || cardDecksResponse.items[0];
        setSelectedDeck(defaultDeck);
        
        // 카드 스타일 로드
        if (isNew) {
          // 새 스타일 생성 시 기본값 사용
          const defaultStyle = applyDefaultCardStyleValues(await fetchDefaultCardStyle());
          setCardStyle({
            ...defaultStyle,
            id: 0,
            name: '',
            description: '',
            is_default: false,
          });
        } else {
          const style = await fetchCardStyle(Number(id));
          setCardStyle(applyDefaultCardStyleValues(style));
        }
      } catch (err) {
        console.error('데이터 로드 실패:', err);
        setError('데이터를 불러올 수 없습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, isAdmin, navigate, isNew]);

  const handleSave = async () => {
    if (!cardStyle || !cardStyle.name.trim()) {
      setError('스타일 이름을 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isNew) {
        const createData: CardStyleCreate = {
          name: cardStyle.name,
          description: cardStyle.description,
          card_type: cardStyle.card_type,
          is_default: cardStyle.is_default,
          front_layout: cardStyle.front_layout,
          front_title_size: cardStyle.front_title_size,
          front_title_color: cardStyle.front_title_color,
          front_title_align: cardStyle.front_title_align,
          front_title_margin_top: cardStyle.front_title_margin_top,
          front_title_margin_bottom: cardStyle.front_title_margin_bottom,
          front_title_margin_left: cardStyle.front_title_margin_left,
          front_title_margin_right: cardStyle.front_title_margin_right,
          front_title_background_color: cardStyle.front_title_background_color,
          front_title_border_color: cardStyle.front_title_border_color,
          front_title_border_width: cardStyle.front_title_border_width,
          front_content_size: cardStyle.front_content_size,
          front_content_color: cardStyle.front_content_color,
          front_content_align: cardStyle.front_content_align,
          front_content_margin_top: cardStyle.front_content_margin_top,
          front_content_margin_bottom: cardStyle.front_content_margin_bottom,
          front_content_margin_left: cardStyle.front_content_margin_left,
          front_content_margin_right: cardStyle.front_content_margin_right,
          mcq_option_background_color: cardStyle.mcq_option_background_color,
          mcq_option_border_color: cardStyle.mcq_option_border_color,
          mcq_option_border_width: cardStyle.mcq_option_border_width,
          mcq_option_gap: cardStyle.mcq_option_gap,
          short_input_height: cardStyle.short_input_height,
          short_input_background_color: cardStyle.short_input_background_color,
          short_input_border_color: cardStyle.short_input_border_color,
          short_input_border_width: cardStyle.short_input_border_width,
          ox_button_o_size: cardStyle.ox_button_o_size,
          ox_button_o_background_color: cardStyle.ox_button_o_background_color,
          ox_button_o_radius: cardStyle.ox_button_o_radius,
          ox_button_o_border_color: cardStyle.ox_button_o_border_color,
          ox_button_o_border_width: cardStyle.ox_button_o_border_width,
          ox_button_x_size: cardStyle.ox_button_x_size,
          ox_button_x_background_color: cardStyle.ox_button_x_background_color,
          ox_button_x_radius: cardStyle.ox_button_x_radius,
          ox_button_x_border_color: cardStyle.ox_button_x_border_color,
          ox_button_x_border_width: cardStyle.ox_button_x_border_width,
          ox_button_gap: cardStyle.ox_button_gap,
          cloze_input_font_size: cardStyle.cloze_input_font_size,
          cloze_input_background_color: cardStyle.cloze_input_background_color,
          cloze_input_border_color: cardStyle.cloze_input_border_color,
          cloze_input_border_width: cardStyle.cloze_input_border_width,
          cloze_input_underline_color: cardStyle.cloze_input_underline_color,
          cloze_button_size: cardStyle.cloze_button_size,
          cloze_button_color: cardStyle.cloze_button_color,
          cloze_button_font_size: cardStyle.cloze_button_font_size,
          order_item_background_color: cardStyle.order_item_background_color,
          order_item_border_color: cardStyle.order_item_border_color,
          order_item_border_width: cardStyle.order_item_border_width,
          order_item_gap: cardStyle.order_item_gap,
          order_button_size: cardStyle.order_button_size,
          order_button_color: cardStyle.order_button_color,
          order_button_font_size: cardStyle.order_button_font_size,
          order_guide_align: cardStyle.order_guide_align,
          order_guide_font_size: cardStyle.order_guide_font_size,
          order_guide_background_color: cardStyle.order_guide_background_color,
          order_guide_border_color: cardStyle.order_guide_border_color,
          order_guide_border_width: cardStyle.order_guide_border_width,
          match_item_background_color: cardStyle.match_item_background_color,
          match_item_border_color: cardStyle.match_item_border_color,
          match_item_border_width: cardStyle.match_item_border_width,
          match_item_gap: cardStyle.match_item_gap,
          match_line_color: cardStyle.match_line_color,
          match_button_size: cardStyle.match_button_size,
          match_button_color: cardStyle.match_button_color,
          match_button_font_size: cardStyle.match_button_font_size,
          match_guide_align: cardStyle.match_guide_align,
          match_guide_font_size: cardStyle.match_guide_font_size,
          match_guide_background_color: cardStyle.match_guide_background_color,
          match_guide_border_color: cardStyle.match_guide_border_color,
          match_guide_border_width: cardStyle.match_guide_border_width,
          back_layout: cardStyle.back_layout,
          back_title_size: cardStyle.back_title_size,
          back_title_color: cardStyle.back_title_color,
          back_title_align: cardStyle.back_title_align,
          back_title_position: cardStyle.back_title_position,
          back_title_margin_top: cardStyle.back_title_margin_top,
          back_title_margin_bottom: cardStyle.back_title_margin_bottom,
          back_title_margin_left: cardStyle.back_title_margin_left,
          back_title_margin_right: cardStyle.back_title_margin_right,
          back_content_size: cardStyle.back_content_size,
          back_content_color: cardStyle.back_content_color,
          back_content_align: cardStyle.back_content_align,
          back_content_position: cardStyle.back_content_position,
          back_content_margin_top: cardStyle.back_content_margin_top,
          back_content_margin_bottom: cardStyle.back_content_margin_bottom,
          back_content_margin_left: cardStyle.back_content_margin_left,
          back_content_margin_right: cardStyle.back_content_margin_right,
          back_button_size: cardStyle.back_button_size,
          back_button_color: cardStyle.back_button_color,
          back_button_position: cardStyle.back_button_position,
          back_button_align: cardStyle.back_button_align,
          back_button_margin_top: cardStyle.back_button_margin_top,
          back_button_margin_bottom: cardStyle.back_button_margin_bottom,
          back_button_margin_left: cardStyle.back_button_margin_left,
          back_button_margin_right: cardStyle.back_button_margin_right,
        };
        await createCardStyle(createData);
      } else {
        const updateData: CardStyleUpdate = {
          name: cardStyle.name,
          description: cardStyle.description,
          card_type: cardStyle.card_type,
          is_default: cardStyle.is_default,
          front_layout: cardStyle.front_layout,
          front_title_size: cardStyle.front_title_size,
          front_title_color: cardStyle.front_title_color,
          front_title_align: cardStyle.front_title_align,
          front_title_margin_top: cardStyle.front_title_margin_top,
          front_title_margin_bottom: cardStyle.front_title_margin_bottom,
          front_title_margin_left: cardStyle.front_title_margin_left,
          front_title_margin_right: cardStyle.front_title_margin_right,
          front_title_background_color: cardStyle.front_title_background_color,
          front_title_border_color: cardStyle.front_title_border_color,
          front_title_border_width: cardStyle.front_title_border_width,
          front_content_size: cardStyle.front_content_size,
          front_content_color: cardStyle.front_content_color,
          front_content_align: cardStyle.front_content_align,
          front_content_margin_top: cardStyle.front_content_margin_top,
          front_content_margin_bottom: cardStyle.front_content_margin_bottom,
          front_content_margin_left: cardStyle.front_content_margin_left,
          front_content_margin_right: cardStyle.front_content_margin_right,
          mcq_option_background_color: cardStyle.mcq_option_background_color,
          mcq_option_border_color: cardStyle.mcq_option_border_color,
          mcq_option_border_width: cardStyle.mcq_option_border_width,
          mcq_option_gap: cardStyle.mcq_option_gap,
          short_input_height: cardStyle.short_input_height,
          short_input_background_color: cardStyle.short_input_background_color,
          short_input_border_color: cardStyle.short_input_border_color,
          short_input_border_width: cardStyle.short_input_border_width,
          ox_button_o_size: cardStyle.ox_button_o_size,
          ox_button_o_background_color: cardStyle.ox_button_o_background_color,
          ox_button_o_radius: cardStyle.ox_button_o_radius,
          ox_button_o_border_color: cardStyle.ox_button_o_border_color,
          ox_button_o_border_width: cardStyle.ox_button_o_border_width,
          ox_button_x_size: cardStyle.ox_button_x_size,
          ox_button_x_background_color: cardStyle.ox_button_x_background_color,
          ox_button_x_radius: cardStyle.ox_button_x_radius,
          ox_button_x_border_color: cardStyle.ox_button_x_border_color,
          ox_button_x_border_width: cardStyle.ox_button_x_border_width,
          ox_button_gap: cardStyle.ox_button_gap,
          cloze_input_font_size: cardStyle.cloze_input_font_size,
          cloze_input_background_color: cardStyle.cloze_input_background_color,
          cloze_input_border_color: cardStyle.cloze_input_border_color,
          cloze_input_border_width: cardStyle.cloze_input_border_width,
          cloze_input_underline_color: cardStyle.cloze_input_underline_color,
          cloze_button_size: cardStyle.cloze_button_size,
          cloze_button_color: cardStyle.cloze_button_color,
          cloze_button_font_size: cardStyle.cloze_button_font_size,
          order_item_background_color: cardStyle.order_item_background_color,
          order_item_border_color: cardStyle.order_item_border_color,
          order_item_border_width: cardStyle.order_item_border_width,
          order_item_gap: cardStyle.order_item_gap,
          order_button_size: cardStyle.order_button_size,
          order_button_color: cardStyle.order_button_color,
          order_button_font_size: cardStyle.order_button_font_size,
          order_guide_align: cardStyle.order_guide_align,
          order_guide_font_size: cardStyle.order_guide_font_size,
          order_guide_background_color: cardStyle.order_guide_background_color,
          order_guide_border_color: cardStyle.order_guide_border_color,
          order_guide_border_width: cardStyle.order_guide_border_width,
          match_item_background_color: cardStyle.match_item_background_color,
          match_item_border_color: cardStyle.match_item_border_color,
          match_item_border_width: cardStyle.match_item_border_width,
          match_item_gap: cardStyle.match_item_gap,
          match_line_color: cardStyle.match_line_color,
          match_button_size: cardStyle.match_button_size,
          match_button_color: cardStyle.match_button_color,
          match_button_font_size: cardStyle.match_button_font_size,
          match_guide_align: cardStyle.match_guide_align,
          match_guide_font_size: cardStyle.match_guide_font_size,
          match_guide_background_color: cardStyle.match_guide_background_color,
          match_guide_border_color: cardStyle.match_guide_border_color,
          match_guide_border_width: cardStyle.match_guide_border_width,
          back_layout: cardStyle.back_layout,
          back_title_size: cardStyle.back_title_size,
          back_title_color: cardStyle.back_title_color,
          back_title_align: cardStyle.back_title_align,
          back_title_position: cardStyle.back_title_position,
          back_title_margin_top: cardStyle.back_title_margin_top,
          back_title_margin_bottom: cardStyle.back_title_margin_bottom,
          back_title_margin_left: cardStyle.back_title_margin_left,
          back_title_margin_right: cardStyle.back_title_margin_right,
          back_content_size: cardStyle.back_content_size,
          back_content_color: cardStyle.back_content_color,
          back_content_align: cardStyle.back_content_align,
          back_content_position: cardStyle.back_content_position,
          back_content_margin_top: cardStyle.back_content_margin_top,
          back_content_margin_bottom: cardStyle.back_content_margin_bottom,
          back_content_margin_left: cardStyle.back_content_margin_left,
          back_content_margin_right: cardStyle.back_content_margin_right,
          back_button_size: cardStyle.back_button_size,
          back_button_color: cardStyle.back_button_color,
          back_button_position: cardStyle.back_button_position,
          back_button_align: cardStyle.back_button_align,
          back_button_margin_top: cardStyle.back_button_margin_top,
          back_button_margin_bottom: cardStyle.back_button_margin_bottom,
          back_button_margin_left: cardStyle.back_button_margin_left,
          back_button_margin_right: cardStyle.back_button_margin_right,
        };
        await updateCardStyle(Number(cardStyle.id), updateData);
      }

      // 저장 성공 후 현재 페이지에 머물기 (관리자 페이지로 이동하지 않음)
      // navigate('/admin');
    } catch (err: any) {
      console.error('카드 스타일 저장 실패:', err);
      console.error('에러 응답:', err.response);
      console.error('에러 상세:', err.response?.data);
      
      // 상세 에러 메시지 구성
      let errorMessage = '카드 스타일 저장에 실패했습니다.';
      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          // Pydantic 검증 에러 (배열 형태)
          errorMessage = err.response.data.detail.map((e: any) => 
            `${e.loc?.join('.')} : ${e.msg}`
          ).join(', ');
        } else if (typeof err.response.data.detail === 'string') {
          // 문자열 에러 메시지
          errorMessage = err.response.data.detail;
        } else {
          // 객체 형태 에러
          errorMessage = JSON.stringify(err.response.data.detail);
        }
      }
      
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const updateCardStyleField = (field: keyof CardStyle, value: any) => {
    if (!cardStyle) return;
    setCardStyle((prev) => {
      const updated = { ...prev, [field]: value } as CardStyle;

      if (field === 'match_item_background_color') {
        updated.match_line_color = value && value !== 'bg-white' ? value : 'default';
      }

      return applyDefaultCardStyleValues(updated);
    });
  };

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <p className="text-slate-600">카드 스타일을 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !cardStyle) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <p className="text-red-600">{error || '카드 스타일을 찾을 수 없습니다.'}</p>
            <button
              onClick={() => navigate('/admin')}
              className="mt-4 text-primary-600 hover:text-primary-700"
            >
              관리자 페이지로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* 헤더 */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {isNew ? '새 카드 스타일 생성' : '카드 스타일 편집'}
              </h1>
              <p className="text-slate-600 mt-1">
                퀴즈 카드의 앞뒤면 스타일을 설정할 수 있습니다.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/admin')}
                className="px-4 py-2 text-slate-600 hover:text-slate-700"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 설정 패널 */}
          <div className="space-y-6">
            {/* 기본 정보 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">기본 정보</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    스타일 이름
                  </label>
                  <input
                    type="text"
                    value={cardStyle.name}
                    onChange={(e) => updateCardStyleField('name', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="스타일 이름을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    설명
                  </label>
                  <textarea
                    value={cardStyle.description || ''}
                    onChange={(e) => updateCardStyleField('description', e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="스타일에 대한 설명을 입력하세요"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_default"
                    checked={cardStyle.is_default}
                    onChange={(e) => updateCardStyleField('is_default', e.target.checked)}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="is_default" className="ml-2 text-sm text-slate-700">
                    기본 스타일로 설정
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    카드 유형
                  </label>
                  <select
                    value={cardStyle.card_type}
                    onChange={(e) => updateCardStyleField('card_type', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    {CARD_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    이 스타일이 적용될 카드 유형을 선택하세요
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    미리보기 카드덱
                  </label>
                  <select
                    value={selectedDeck?.id || ''}
                    onChange={(e) => {
                      const deckId = Number(e.target.value);
                      const deck = cardDecks.find(d => d.id === deckId);
                      setSelectedDeck(deck || null);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    {cardDecks.map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        {deck.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    미리보기에 사용할 카드덱을 선택하세요
                  </p>
                </div>
              </div>
            </div>

            {/* 앞면/뒷면 탭 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex space-x-1 mb-6">
                <button
                  onClick={() => setIsFlipped(false)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !isFlipped
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-slate-600 hover:text-slate-700'
                  }`}
                >
                  앞면 스타일
                </button>
                <button
                  onClick={() => setIsFlipped(true)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isFlipped
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-slate-600 hover:text-slate-700'
                  }`}
                >
                  뒷면 스타일
                </button>
              </div>

              <div className="space-y-4">
                {!isFlipped ? (
                  // 앞면 스타일 설정
                  <>
                    <h3 className="text-md font-medium text-slate-900 mb-3">레이아웃</h3>
                    <div className="mb-6">
                      <StyleField
                        label="카드 레이아웃"
                        value={cardStyle.front_layout || 'top'}
                        onChange={(value) => updateCardStyleField('front_layout', value)}
                        options={LAYOUT_OPTIONS}
                      />
                      <div className="mt-2 text-xs text-slate-500">
                        {LAYOUT_OPTIONS.find(opt => opt.value === (cardStyle.front_layout || 'top'))?.description}
                      </div>
                    </div>

                    <h3 className="text-md font-medium text-slate-900 mb-3">문제 영역 스타일</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <StyleField
                        label="글자 크기"
                        value={cardStyle.front_title_size}
                        onChange={(value) => updateCardStyleField('front_title_size', value)}
                        options={FONT_SIZES}
                      />
                      <StyleField
                        label="글자 색상"
                        value={cardStyle.front_title_color}
                        onChange={(value) => updateCardStyleField('front_title_color', value)}
                        options={TEXT_COLORS}
                      />
                      <StyleField
                        label="정렬"
                        value={cardStyle.front_title_align}
                        onChange={(value) => updateCardStyleField('front_title_align', value)}
                        options={TEXT_ALIGNS}
                      />
                      <StyleField
                        label="배경 색상"
                        value={cardStyle.front_title_background_color || 'bg-white'}
                        onChange={(value) => updateCardStyleField('front_title_background_color', value)}
                        options={BACKGROUND_COLORS}
                      />
                      <StyleField
                        label="외곽선 색상"
                        value={cardStyle.front_title_border_color || 'none'}
                        onChange={(value) => updateCardStyleField('front_title_border_color', value)}
                        options={BORDER_COLORS}
                      />
                      <StyleField
                        label="외곽선 두께"
                        value={cardStyle.front_title_border_width || 'border'}
                        onChange={(value) => updateCardStyleField('front_title_border_width', value)}
                        options={BORDER_WIDTHS}
                      />
                    </div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2 mt-4">문제 영역 마진</h4>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">상단</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.front_title_margin_top || '0'}
                          onChange={(e) => updateCardStyleField('front_title_margin_top', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">하단</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.front_title_margin_bottom || '16'}
                          onChange={(e) => updateCardStyleField('front_title_margin_bottom', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">좌측</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.front_title_margin_left || '0'}
                          onChange={(e) => updateCardStyleField('front_title_margin_left', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">우측</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.front_title_margin_right || '0'}
                          onChange={(e) => updateCardStyleField('front_title_margin_right', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <h3 className="text-md font-medium text-slate-900 mb-3 mt-6">답변 영역 스타일</h3>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <StyleField
                        label="글자 크기"
                        value={cardStyle.front_content_size}
                        onChange={(value) => updateCardStyleField('front_content_size', value)}
                        options={FONT_SIZES}
                      />
                      <StyleField
                        label="글자 색상"
                        value={cardStyle.front_content_color}
                        onChange={(value) => updateCardStyleField('front_content_color', value)}
                        options={TEXT_COLORS}
                      />
                      <StyleField
                        label="정렬"
                        value={cardStyle.front_content_align}
                        onChange={(value) => updateCardStyleField('front_content_align', value)}
                        options={TEXT_ALIGNS}
                      />
                    </div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2 mt-4">답변 영역 마진</h4>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">상단</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.front_content_margin_top || '0'}
                          onChange={(e) => updateCardStyleField('front_content_margin_top', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">하단</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.front_content_margin_bottom || '0'}
                          onChange={(e) => updateCardStyleField('front_content_margin_bottom', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">좌측</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.front_content_margin_left || '0'}
                          onChange={(e) => updateCardStyleField('front_content_margin_left', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">우측</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.front_content_margin_right || '0'}
                          onChange={(e) => updateCardStyleField('front_content_margin_right', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {renderCardTypeSpecificControls()}
                  </>
                ) : (
                  // 뒷면 스타일 설정
                  <>
                    <h3 className="text-md font-medium text-slate-900 mb-3">레이아웃</h3>
                    <div className="grid grid-cols-1 gap-4 mb-6">
                      <StyleField
                        label="레이아웃"
                        value={cardStyle.back_layout}
                        onChange={(value) => updateCardStyleField('back_layout', value)}
                        options={BACK_LAYOUTS}
                      />
                    </div>

                    <h3 className="text-md font-medium text-slate-900 mb-3">정답 영역 스타일</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <StyleField
                        label="글자 크기"
                        value={cardStyle.back_title_size}
                        onChange={(value) => updateCardStyleField('back_title_size', value)}
                        options={FONT_SIZES}
                      />
                      <StyleField
                        label="글자 색상"
                        value={cardStyle.back_title_color}
                        onChange={(value) => updateCardStyleField('back_title_color', value)}
                        options={TEXT_COLORS}
                      />
                      <StyleField
                        label="정렬"
                        value={cardStyle.back_title_align}
                        onChange={(value) => updateCardStyleField('back_title_align', value)}
                        options={TEXT_ALIGNS}
                      />
                    </div>

                    <h4 className="text-sm font-medium text-slate-700 mb-2 mt-4">정답 영역 마진</h4>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">상단</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_title_margin_top || '0'}
                          onChange={(e) => updateCardStyleField('back_title_margin_top', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">하단</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_title_margin_bottom || '16'}
                          onChange={(e) => updateCardStyleField('back_title_margin_bottom', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">좌측</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_title_margin_left || '0'}
                          onChange={(e) => updateCardStyleField('back_title_margin_left', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">우측</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_title_margin_right || '0'}
                          onChange={(e) => updateCardStyleField('back_title_margin_right', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <h3 className="text-md font-medium text-slate-900 mb-3 mt-6">설명 스타일</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <StyleField
                        label="글자 크기"
                        value={cardStyle.back_content_size}
                        onChange={(value) => updateCardStyleField('back_content_size', value)}
                        options={FONT_SIZES}
                      />
                      <StyleField
                        label="글자 색상"
                        value={cardStyle.back_content_color}
                        onChange={(value) => updateCardStyleField('back_content_color', value)}
                        options={TEXT_COLORS}
                      />
                      <StyleField
                        label="정렬"
                        value={cardStyle.back_content_align}
                        onChange={(value) => updateCardStyleField('back_content_align', value)}
                        options={TEXT_ALIGNS}
                      />
                    </div>

                    <h4 className="text-sm font-medium text-slate-700 mb-2 mt-4">설명 영역 마진</h4>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">상단</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_content_margin_top || '0'}
                          onChange={(e) => updateCardStyleField('back_content_margin_top', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">하단</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_content_margin_bottom || '0'}
                          onChange={(e) => updateCardStyleField('back_content_margin_bottom', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">좌측</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_content_margin_left || '0'}
                          onChange={(e) => updateCardStyleField('back_content_margin_left', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">우측</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_content_margin_right || '0'}
                          onChange={(e) => updateCardStyleField('back_content_margin_right', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <h3 className="text-md font-medium text-slate-900 mb-3 mt-6">버튼 스타일</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <StyleField
                        label="크기"
                        value={cardStyle.back_button_size}
                        onChange={(value) => updateCardStyleField('back_button_size', value)}
                        options={BUTTON_SIZES}
                      />
                      <StyleField
                        label="색상"
                        value={cardStyle.back_button_color}
                        onChange={(value) => updateCardStyleField('back_button_color', value)}
                        options={BUTTON_COLORS}
                      />
                      <StyleField
                        label="정렬"
                        value={cardStyle.back_button_align}
                        onChange={(value) => updateCardStyleField('back_button_align', value)}
                        options={TEXT_ALIGNS}
                      />
                    </div>

                    <h4 className="text-sm font-medium text-slate-700 mb-2 mt-4">버튼 영역 마진</h4>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">상단</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_button_margin_top || '0'}
                          onChange={(e) => updateCardStyleField('back_button_margin_top', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">하단</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_button_margin_bottom || '0'}
                          onChange={(e) => updateCardStyleField('back_button_margin_bottom', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">좌측</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_button_margin_left || '0'}
                          onChange={(e) => updateCardStyleField('back_button_margin_left', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">우측</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_button_margin_right || '0'}
                          onChange={(e) => updateCardStyleField('back_button_margin_right', e.target.value || '0')}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 미리보기 패널 */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">미리보기</h2>
            <div className="flex justify-center">
              <div
                className="relative w-80 aspect-[3/5] cursor-pointer"
                style={{ perspective: '1500px' }}
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <div
                  className={`relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] ${
                    isFlipped ? '[transform:rotateY(180deg)]' : ''
                  }`}
                >
                  <div
                    className="absolute inset-0 overflow-hidden rounded-[36px] border border-slate-200 shadow-[0_28px_60px_-20px_rgba(30,41,59,0.45)] [backface-visibility:hidden]"
                    style={{
                      ...(previewFrontImage
                        ? {
                            backgroundImage: `url(${previewFrontImage})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }
                        : {
                            backgroundColor: '#f8fafc',
                          })
                    }}
                  >
                    <div className="absolute inset-0 bg-white/55" />
                    <div className={`absolute inset-0 flex h-full flex-col rounded-[36px] bg-white/92 p-6 ${
                      cardStyle.front_layout === 'top'
                        ? 'justify-start'
                        : cardStyle.front_layout === 'center'
                        ? 'justify-center'
                        : cardStyle.front_layout === 'bottom'
                        ? 'justify-end'
                        : cardStyle.front_layout === 'split'
                        ? 'justify-between'
                        : 'justify-center'
                    }`}>
                      {cardStyle.front_layout === 'split' ? (
                        <div className="flex flex-col h-full justify-between">
                          <div
                            style={{
                              marginTop: `${cardStyle.front_content_margin_top || '0'}px`,
                              marginBottom: `${cardStyle.front_title_margin_bottom || '16'}px`,
                              marginLeft: `${cardStyle.front_content_margin_left || '0'}px`,
                              marginRight: `${cardStyle.front_content_margin_right || '0'}px`,
                            }}
                          >
                            <CardRunner
                              card={previewCard}
                              disabled={false}
                              onSubmit={handlePreviewSubmit}
                              cardStyle={cardStyle}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="max-h-full overflow-y-auto text-slate-900">
                          <div
                            style={{
                              marginTop: `${cardStyle.front_content_margin_top || '0'}px`,
                              marginBottom:
                                cardStyle.front_layout === 'bottom'
                                  ? `${cardStyle.front_title_margin_bottom || '16'}px`
                                  : `${cardStyle.front_content_margin_bottom || '0'}px`,
                              marginLeft: `${cardStyle.front_content_margin_left || '0'}px`,
                              marginRight: `${cardStyle.front_content_margin_right || '0'}px`,
                            }}
                          >
                            <CardRunner
                              card={previewCard}
                              disabled={false}
                              onSubmit={handlePreviewSubmit}
                              cardStyle={cardStyle}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className="absolute inset-0 overflow-hidden rounded-[36px] border border-slate-200 shadow-[0_28px_60px_-20px_rgba(30,41,59,0.45)] [transform:rotateY(180deg)] [backface-visibility:hidden]"
                    style={{
                      ...(previewBackImage
                        ? {
                            backgroundImage: `url(${previewBackImage})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }
                        : {
                            backgroundColor: '#f8fafc',
                          })
                    }}
                  >
                    <div className="absolute inset-0 bg-white/55" />
                    <div className={`absolute inset-0 flex h-full flex-col rounded-[36px] bg-white/94 p-6 ${
                      cardStyle.back_layout === 'top'
                        ? 'justify-start'
                        : cardStyle.back_layout === 'center'
                        ? 'justify-center'
                        : cardStyle.back_layout === 'bottom'
                        ? 'justify-end'
                        : cardStyle.back_layout === 'split'
                        ? 'justify-between'
                        : 'items-center justify-center'
                    }`}>
                      {cardStyle.back_layout === 'split' ? (
                        <div className="flex flex-col h-full justify-between">
                          <div
                            style={{
                              marginTop: `${cardStyle.back_title_margin_top || '0'}px`,
                              marginBottom: `${cardStyle.back_title_margin_bottom || '16'}px`,
                              marginLeft: `${cardStyle.back_title_margin_left || '0'}px`,
                              marginRight: `${cardStyle.back_title_margin_right || '0'}px`,
                            }}
                          >
                            <div
                              className={`${cardStyle.back_title_size} ${cardStyle.back_title_color} ${cardStyle.back_title_align}`}
                            >
                              <div
                                className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold ${
                                  previewIsCorrect
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                {previewIsCorrect ? '🎉 정답입니다!' : '❌ 틀렸습니다.'}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              marginTop: `${cardStyle.back_content_margin_top || '0'}px`,
                              marginBottom: `${cardStyle.back_content_margin_bottom || '0'}px`,
                              marginLeft: `${cardStyle.back_content_margin_left || '0'}px`,
                              marginRight: `${cardStyle.back_content_margin_right || '0'}px`,
                            }}
                          >
                            <div
                              className={`${cardStyle.back_content_size} ${cardStyle.back_content_color} ${cardStyle.back_content_align}`}
                            >
                              <p className="leading-relaxed">{previewExplanation}</p>
                            </div>
                          </div>

                          <div
                            style={{
                              marginTop: `${cardStyle.back_button_margin_top || '0'}px`,
                              marginBottom: `${cardStyle.back_button_margin_bottom || '0'}px`,
                              marginLeft: `${cardStyle.back_button_margin_left || '0'}px`,
                              marginRight: `${cardStyle.back_button_margin_right || '0'}px`,
                            }}
                          >
                            <div className={`${cardStyle.back_button_align} w-full`}>
                              <button
                                className={`${cardStyle.back_button_size} ${cardStyle.back_button_color} rounded-xl font-medium shadow-lg transition w-full`}
                              >
                                {previewNextActionLabel}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-5 text-center">
                          <div
                            style={{
                              marginTop: `${cardStyle.back_title_margin_top || '0'}px`,
                              marginBottom:
                                cardStyle.back_layout === 'bottom'
                                  ? `${cardStyle.back_title_margin_top || '0'}px`
                                  : `${cardStyle.back_title_margin_bottom || '16'}px`,
                              marginLeft: `${cardStyle.back_title_margin_left || '0'}px`,
                              marginRight: `${cardStyle.back_title_margin_right || '0'}px`,
                            }}
                          >
                            <div
                              className={`${cardStyle.back_title_size} ${cardStyle.back_title_color} ${cardStyle.back_title_align}`}
                            >
                              <div
                                className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold ${
                                  previewIsCorrect
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                {previewIsCorrect ? '🎉 정답입니다!' : '❌ 틀렸습니다.'}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              marginTop: `${cardStyle.back_content_margin_top || '0'}px`,
                              marginBottom:
                                cardStyle.back_layout === 'bottom'
                                  ? `${cardStyle.back_title_margin_bottom || '16'}px`
                                  : `${cardStyle.back_content_margin_bottom || '0'}px`,
                              marginLeft: `${cardStyle.back_content_margin_left || '0'}px`,
                              marginRight: `${cardStyle.back_content_margin_right || '0'}px`,
                            }}
                          >
                            <div
                              className={`${cardStyle.back_content_size} ${cardStyle.back_content_color} ${cardStyle.back_content_align}`}
                            >
                              <p className="leading-relaxed">{previewExplanation}</p>
                            </div>
                          </div>

                          <div
                            style={{
                              marginTop: `${cardStyle.back_button_margin_top || '0'}px`,
                              marginBottom: `${cardStyle.back_button_margin_bottom || '0'}px`,
                              marginLeft: `${cardStyle.back_button_margin_left || '0'}px`,
                              marginRight: `${cardStyle.back_button_margin_right || '0'}px`,
                            }}
                          >
                            <div className={`${cardStyle.back_button_align} w-full`}>
                              <button
                                className={`${cardStyle.back_button_size} ${cardStyle.back_button_color} rounded-xl font-medium shadow-lg transition w-full`}
                              >
                                {previewNextActionLabel}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-sm text-slate-500 mt-4">
              카드를 클릭하면 앞뒤면을 확인할 수 있습니다
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
