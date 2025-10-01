import { useEffect, useState } from 'react';
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

const POSITIONS = [
  { value: 'mb-2', label: '매우 작은 간격' },
  { value: 'mb-4', label: '작은 간격' },
  { value: 'mb-6', label: '보통 간격' },
  { value: 'mb-8', label: '큰 간격' },
  { value: 'mt-auto', label: '하단 고정' },
  { value: 'my-auto', label: '중앙 고정' },
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

const MARGIN_OPTIONS = [
  { value: '0', label: '0px' },
  { value: '4', label: '4px' },
  { value: '8', label: '8px' },
  { value: '12', label: '12px' },
  { value: '16', label: '16px' },
  { value: '20', label: '20px' },
  { value: '24', label: '24px' },
  { value: '32', label: '32px' },
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

interface MarginFieldProps {
  label: string;
  top: string;
  bottom: string;
  left: string;
  right: string;
  onTopChange: (value: string) => void;
  onBottomChange: (value: string) => void;
  onLeftChange: (value: string) => void;
  onRightChange: (value: string) => void;
}

function MarginField({ label, top, bottom, left, right, onTopChange, onBottomChange, onLeftChange, onRightChange }: MarginFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-slate-600 mb-1">상단</label>
          <select
            value={top}
            onChange={(e) => onTopChange(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {MARGIN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">하단</label>
          <select
            value={bottom}
            onChange={(e) => onBottomChange(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {MARGIN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">좌측</label>
          <select
            value={left}
            onChange={(e) => onLeftChange(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {MARGIN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-600 mb-1">우측</label>
          <select
            value={right}
            onChange={(e) => onRightChange(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {MARGIN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
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
    question: '조선 전기 과거제도에서 문과의 최종 시험은 전시이다.',
    answer: true,
    explain: '전시는 문과의 최종 시험으로, 왕이 직접 출제하고 채점했습니다.',
  },
  CLOZE: {
    type: 'CLOZE',
    text: '조선 전기 과거제도에서 문과의 최종 시험은 {{전시}}이다.',
    clozes: { '전시': '전시' },
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
          const defaultStyle = await fetchDefaultCardStyle();
          setCardStyle({
            ...defaultStyle,
            id: 0,
            name: '',
            description: '',
            is_default: false,
          });
        } else {
          const style = await fetchCardStyle(Number(id));
          setCardStyle(style);
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
          front_content_size: cardStyle.front_content_size,
          front_content_color: cardStyle.front_content_color,
          front_content_align: cardStyle.front_content_align,
          front_content_margin_top: cardStyle.front_content_margin_top,
          front_content_margin_bottom: cardStyle.front_content_margin_bottom,
          front_content_margin_left: cardStyle.front_content_margin_left,
          front_content_margin_right: cardStyle.front_content_margin_right,
          front_button_size: cardStyle.front_button_size,
          front_button_color: cardStyle.front_button_color,
          front_button_position: cardStyle.front_button_position,
          front_button_align: cardStyle.front_button_align,
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
          front_content_size: cardStyle.front_content_size,
          front_content_color: cardStyle.front_content_color,
          front_content_align: cardStyle.front_content_align,
          front_content_margin_top: cardStyle.front_content_margin_top,
          front_content_margin_bottom: cardStyle.front_content_margin_bottom,
          front_content_margin_left: cardStyle.front_content_margin_left,
          front_content_margin_right: cardStyle.front_content_margin_right,
          front_button_size: cardStyle.front_button_size,
          front_button_color: cardStyle.front_button_color,
          front_button_position: cardStyle.front_button_position,
          front_button_align: cardStyle.front_button_align,
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
    } catch (err) {
      console.error('카드 스타일 저장 실패:', err);
      setError('카드 스타일 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const updateCardStyleField = (field: keyof CardStyle, value: any) => {
    if (!cardStyle) return;
    setCardStyle({ ...cardStyle, [field]: value });
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
                    </div>
                    <MarginField
                      label="문제 영역 마진"
                      top={cardStyle.front_title_margin_top || '0'}
                      bottom={cardStyle.front_title_margin_bottom || '16'}
                      left={cardStyle.front_title_margin_left || '0'}
                      right={cardStyle.front_title_margin_right || '0'}
                      onTopChange={(value) => updateCardStyleField('front_title_margin_top', value)}
                      onBottomChange={(value) => updateCardStyleField('front_title_margin_bottom', value)}
                      onLeftChange={(value) => updateCardStyleField('front_title_margin_left', value)}
                      onRightChange={(value) => updateCardStyleField('front_title_margin_right', value)}
                    />

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
                    <MarginField
                      label="답변 영역 마진"
                      top={cardStyle.front_content_margin_top || '0'}
                      bottom={cardStyle.front_content_margin_bottom || '0'}
                      left={cardStyle.front_content_margin_left || '0'}
                      right={cardStyle.front_content_margin_right || '0'}
                      onTopChange={(value) => updateCardStyleField('front_content_margin_top', value)}
                      onBottomChange={(value) => updateCardStyleField('front_content_margin_bottom', value)}
                      onLeftChange={(value) => updateCardStyleField('front_content_margin_left', value)}
                      onRightChange={(value) => updateCardStyleField('front_content_margin_right', value)}
                    />

                    <h3 className="text-md font-medium text-slate-900 mb-3 mt-6">버튼 스타일</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <StyleField
                        label="크기"
                        value={cardStyle.front_button_size}
                        onChange={(value) => updateCardStyleField('front_button_size', value)}
                        options={BUTTON_SIZES}
                      />
                      <StyleField
                        label="색상"
                        value={cardStyle.front_button_color}
                        onChange={(value) => updateCardStyleField('front_button_color', value)}
                        options={BUTTON_COLORS}
                      />
                      <StyleField
                        label="정렬"
                        value={cardStyle.front_button_align}
                        onChange={(value) => updateCardStyleField('front_button_align', value)}
                        options={TEXT_ALIGNS}
                      />
                      <StyleField
                        label="위치"
                        value={cardStyle.front_button_position}
                        onChange={(value) => updateCardStyleField('front_button_position', value)}
                        options={POSITIONS}
                      />
                    </div>
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
                          value={cardStyle.back_title_margin_top || 0}
                          onChange={(e) => updateCardStyleField('back_title_margin_top', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">하단</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_title_margin_bottom || 16}
                          onChange={(e) => updateCardStyleField('back_title_margin_bottom', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">좌측</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_title_margin_left || 0}
                          onChange={(e) => updateCardStyleField('back_title_margin_left', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">우측</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_title_margin_right || 0}
                          onChange={(e) => updateCardStyleField('back_title_margin_right', parseInt(e.target.value) || 0)}
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
                          value={cardStyle.back_content_margin_top || 0}
                          onChange={(e) => updateCardStyleField('back_content_margin_top', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">하단</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_content_margin_bottom || 0}
                          onChange={(e) => updateCardStyleField('back_content_margin_bottom', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">좌측</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_content_margin_left || 0}
                          onChange={(e) => updateCardStyleField('back_content_margin_left', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">우측</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_content_margin_right || 0}
                          onChange={(e) => updateCardStyleField('back_content_margin_right', parseInt(e.target.value) || 0)}
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
                          value={cardStyle.back_button_margin_top || 0}
                          onChange={(e) => updateCardStyleField('back_button_margin_top', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">하단</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_button_margin_bottom || 0}
                          onChange={(e) => updateCardStyleField('back_button_margin_bottom', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">좌측</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_button_margin_left || 0}
                          onChange={(e) => updateCardStyleField('back_button_margin_left', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:border-primary-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">우측</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={cardStyle.back_button_margin_right || 0}
                          onChange={(e) => updateCardStyleField('back_button_margin_right', parseInt(e.target.value) || 0)}
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
                  {/* 앞면 - StudyPage와 동일한 구조 */}
                  <div 
                    className="absolute inset-0 overflow-hidden rounded-[36px] border border-slate-200 shadow-[0_28px_60px_-20px_rgba(30,41,59,0.45)] [backface-visibility:hidden]"
                    style={{
                      ...(selectedDeck?.front_image) 
                        ? {
                            backgroundImage: `url(${getCardDeckImageUrl(selectedDeck.front_image)})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }
                        : {
                            backgroundColor: '#f8fafc',
                          }
                    }}
                  >
                    <div className="absolute inset-0 bg-white/55" />
                    <div className={`absolute inset-0 flex h-full flex-col rounded-[36px] bg-white/92 p-6 ${
                      cardStyle.front_layout === 'top' ? 'justify-start' :
                      cardStyle.front_layout === 'center' ? 'justify-center' :
                      cardStyle.front_layout === 'bottom' ? 'justify-end' :
                      cardStyle.front_layout === 'split' ? 'justify-between' : 'justify-center'
                    }`}>
                      {cardStyle.front_layout === 'split' ? (
                        // 상하단 정렬: 문제는 상단, 답변은 하단
                        <div className="flex flex-col h-full justify-between">
                          {/* 문제 영역 - 상단 */}
                          <div style={{
                            marginTop: `${cardStyle.front_title_margin_top || '0'}px`,
                            marginBottom: `${cardStyle.front_title_margin_bottom || '16'}px`,
                            marginLeft: `${cardStyle.front_title_margin_left || '0'}px`,
                            marginRight: `${cardStyle.front_title_margin_right || '0'}px`
                          }}>
                            <p className={`w-full bg-white px-4 py-3 ${cardStyle.front_title_size} ${cardStyle.front_title_color} ${cardStyle.front_title_align} font-semibold shadow-sm`}>
                              {(() => {
                                const currentCard = SAMPLE_CARDS[cardStyle.card_type as keyof typeof SAMPLE_CARDS] || SAMPLE_CARDS.ALL;
                                return currentCard.type === 'MCQ' ? (currentCard as any).question :
                                       currentCard.type === 'SHORT' ? (currentCard as any).prompt :
                                       currentCard.type === 'OX' ? (currentCard as any).statement :
                                       currentCard.type === 'CLOZE' ? (currentCard as any).text :
                                       currentCard.type === 'ORDER' ? '다음 항목들을 올바른 순서로 배열하세요:' :
                                       currentCard.type === 'MATCH' ? '다음 항목들을 올바르게 연결하세요:' : '문제';
                              })()}
                            </p>
                          </div>
                          
                          {/* 답변 영역 - 하단 */}
                          <div style={{
                            marginTop: `${cardStyle.front_content_margin_top || '0'}px`,
                            marginBottom: `${cardStyle.front_title_margin_bottom || '16'}px`,
                            marginLeft: `${cardStyle.front_content_margin_left || '0'}px`,
                            marginRight: `${cardStyle.front_content_margin_right || '0'}px`
                          }}>
                            {(() => {
                              const currentCard = SAMPLE_CARDS[cardStyle.card_type as keyof typeof SAMPLE_CARDS] || SAMPLE_CARDS.ALL;
                              return (
                                <div className="grid gap-2">
                                  {currentCard.type === 'MCQ' && (currentCard as any).options?.map((option: string, index: number) => (
                                    <button
                                      key={`${option}-${index}`}
                                      type="button"
                                      className={`flex items-center justify-center gap-3 px-3 py-2 ${cardStyle.front_content_align || 'text-center'} transition-colors bg-white shadow-sm cursor-pointer hover:bg-slate-100 ${cardStyle.front_content_size} ${cardStyle.front_content_color}`}
                                    >
                                      <span>{option}</span>
                                    </button>
                                  ))}
                                  {currentCard.type === 'SHORT' && (
                                    <input
                                      type="text"
                                      placeholder="답을 입력하세요..."
                                      className={`w-full rounded-lg border border-slate-300 px-3 py-2 ${cardStyle.front_content_size} ${cardStyle.front_content_color} ${cardStyle.front_content_align} focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
                                    />
                                  )}
                                  {currentCard.type === 'OX' && (
                                    <div className="flex gap-4 justify-center">
                                      <button className={`px-6 py-3 rounded-lg bg-emerald-100 text-emerald-700 font-semibold ${cardStyle.front_content_size}`}>
                                        O (참)
                                      </button>
                                      <button className={`px-6 py-3 rounded-lg bg-rose-100 text-rose-700 font-semibold ${cardStyle.front_content_size}`}>
                                        X (거짓)
                                      </button>
                                    </div>
                                  )}
                                  {currentCard.type === 'CLOZE' && (
                                    <input
                                      type="text"
                                      placeholder="빈칸에 들어갈 내용을 입력하세요..."
                                      className={`w-full rounded-lg border border-slate-300 px-3 py-2 ${cardStyle.front_content_size} ${cardStyle.front_content_color} ${cardStyle.front_content_align} focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
                                    />
                                  )}
                                  {currentCard.type === 'ORDER' && (currentCard as any).items?.map((item: string, index: number) => (
                                    <div
                                      key={`${item}-${index}`}
                                      className={`flex items-center gap-3 px-3 py-2 bg-white shadow-sm rounded cursor-move ${cardStyle.front_content_size} ${cardStyle.front_content_color}`}
                                    >
                                      <span className="text-slate-400">⋮⋮</span>
                                      <span>{item}</span>
                                    </div>
                                  ))}
                                  {currentCard.type === 'MATCH' && (
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        {(currentCard as any).left?.map((item: string, index: number) => (
                                          <div key={`left-${index}`} className={`px-3 py-2 bg-blue-50 rounded ${cardStyle.front_content_size} ${cardStyle.front_content_color}`}>
                                            {item}
                                          </div>
                                        ))}
                                      </div>
                                      <div className="space-y-2">
                                        {(currentCard as any).right?.map((item: string, index: number) => (
                                          <div key={`right-${index}`} className={`px-3 py-2 bg-green-50 rounded ${cardStyle.front_content_size} ${cardStyle.front_content_color}`}>
                                            {item}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      ) : (
                        // 일반 레이아웃 (상단, 중앙, 하단)
                        <div className="max-h-full overflow-y-auto text-slate-900">
                          <div className="space-y-4">
                            {(() => {
                              const currentCard = SAMPLE_CARDS[cardStyle.card_type as keyof typeof SAMPLE_CARDS] || SAMPLE_CARDS.ALL;
                              
                              // 하단 정렬일 때는 하단 마진을 상단 마진과 동일하게 적용
                              const titleMarginStyle = cardStyle.front_layout === 'bottom' 
                                ? {
                                    marginTop: `${cardStyle.front_title_margin_top || '0'}px`,
                                    marginBottom: `${cardStyle.front_title_margin_top || '0'}px`,
                                    marginLeft: `${cardStyle.front_title_margin_left || '0'}px`,
                                    marginRight: `${cardStyle.front_title_margin_right || '0'}px`
                                  }
                                : {
                                    marginTop: `${cardStyle.front_title_margin_top || '0'}px`,
                                    marginBottom: `${cardStyle.front_title_margin_bottom || '16'}px`,
                                    marginLeft: `${cardStyle.front_title_margin_left || '0'}px`,
                                    marginRight: `${cardStyle.front_title_margin_right || '0'}px`
                                  };
                              
                              // 하단 정렬일 때는 답변 영역의 하단 마진을 문제 영역의 하단 마진과 동일하게 적용
                              const contentMarginStyle = cardStyle.front_layout === 'bottom' 
                                ? {
                                    marginTop: `${cardStyle.front_content_margin_top || '0'}px`,
                                    marginBottom: `${cardStyle.front_title_margin_bottom || '16'}px`,
                                    marginLeft: `${cardStyle.front_content_margin_left || '0'}px`,
                                    marginRight: `${cardStyle.front_content_margin_right || '0'}px`
                                  }
                                : {
                                    marginTop: `${cardStyle.front_content_margin_top || '0'}px`,
                                    marginBottom: `${cardStyle.front_content_margin_bottom || '0'}px`,
                                    marginLeft: `${cardStyle.front_content_margin_left || '0'}px`,
                                    marginRight: `${cardStyle.front_content_margin_right || '0'}px`
                                  };
                              
                              return (
                                <>
                                  {/* 문제 영역 */}
                                  <div style={titleMarginStyle}>
                                    <p className={`w-full bg-white px-4 py-3 ${cardStyle.front_title_size} ${cardStyle.front_title_color} ${cardStyle.front_title_align} font-semibold shadow-sm`}>
                                      {currentCard.type === 'MCQ' ? (currentCard as any).question :
                                       currentCard.type === 'SHORT' ? (currentCard as any).prompt :
                                       currentCard.type === 'OX' ? (currentCard as any).statement :
                                       currentCard.type === 'CLOZE' ? (currentCard as any).text :
                                       currentCard.type === 'ORDER' ? '다음 항목들을 올바른 순서로 배열하세요:' :
                                       currentCard.type === 'MATCH' ? '다음 항목들을 올바르게 연결하세요:' : '문제'}
                                    </p>
                                  </div>
                                  
                                  {/* 답변 영역 */}
                                  <div style={contentMarginStyle}>
                                  <div className="grid gap-2">
                                    {currentCard.type === 'MCQ' && (currentCard as any).options?.map((option: string, index: number) => (
                                      <button
                                        key={`${option}-${index}`}
                                        type="button"
                                        className={`flex items-center justify-center gap-3 px-3 py-2 ${cardStyle.front_content_align || 'text-center'} transition-colors bg-white shadow-sm cursor-pointer hover:bg-slate-100 ${cardStyle.front_content_size} ${cardStyle.front_content_color}`}
                                      >
                                        <span>{option}</span>
                                      </button>
                                    ))}
                                    {currentCard.type === 'SHORT' && (
                                      <input
                                        type="text"
                                        placeholder="답을 입력하세요..."
                                        className={`w-full rounded-lg border border-slate-300 px-3 py-2 ${cardStyle.front_content_size} ${cardStyle.front_content_color} ${cardStyle.front_content_align} focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
                                      />
                                    )}
                                    {currentCard.type === 'OX' && (
                                      <div className="flex gap-4 justify-center">
                                        <button className={`px-6 py-3 rounded-lg bg-emerald-100 text-emerald-700 font-semibold ${cardStyle.front_content_size}`}>
                                          O (참)
                                        </button>
                                        <button className={`px-6 py-3 rounded-lg bg-rose-100 text-rose-700 font-semibold ${cardStyle.front_content_size}`}>
                                          X (거짓)
                                        </button>
                                      </div>
                                    )}
                                    {currentCard.type === 'CLOZE' && (
                                      <input
                                        type="text"
                                        placeholder="빈칸에 들어갈 내용을 입력하세요..."
                                        className={`w-full rounded-lg border border-slate-300 px-3 py-2 ${cardStyle.front_content_size} ${cardStyle.front_content_color} ${cardStyle.front_content_align} focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500`}
                                      />
                                    )}
                                    {currentCard.type === 'ORDER' && (currentCard as any).items?.map((item: string, index: number) => (
                                      <div
                                        key={`${item}-${index}`}
                                        className={`flex items-center gap-3 px-3 py-2 bg-white shadow-sm rounded cursor-move ${cardStyle.front_content_size} ${cardStyle.front_content_color}`}
                                      >
                                        <span className="text-slate-400">⋮⋮</span>
                                        <span>{item}</span>
                                      </div>
                                    ))}
                                    {currentCard.type === 'MATCH' && (
                                      <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                          {(currentCard as any).left?.map((item: string, index: number) => (
                                            <div key={`left-${index}`} className={`px-3 py-2 bg-blue-50 rounded ${cardStyle.front_content_size} ${cardStyle.front_content_color}`}>
                                              {item}
                                            </div>
                                          ))}
                                        </div>
                                        <div className="space-y-2">
                                          {(currentCard as any).right?.map((item: string, index: number) => (
                                            <div key={`right-${index}`} className={`px-3 py-2 bg-green-50 rounded ${cardStyle.front_content_size} ${cardStyle.front_content_color}`}>
                                              {item}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div 
                    className="absolute inset-0 overflow-hidden rounded-[36px] border border-slate-200 shadow-[0_28px_60px_-20px_rgba(30,41,59,0.45)] [transform:rotateY(180deg)] [backface-visibility:hidden]"
                    style={{
                      ...(selectedDeck?.back_image) 
                        ? {
                            backgroundImage: `url(${getCardDeckImageUrl(selectedDeck.back_image)})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }
                        : {
                            backgroundColor: '#f8fafc',
                          }
                    }}
                  >
                    <div className="absolute inset-0 bg-white/55" />
                    <div className={`absolute inset-0 flex h-full flex-col rounded-[36px] bg-white/94 p-6 ${
                      cardStyle.back_layout === 'top' ? 'justify-start' :
                      cardStyle.back_layout === 'center' ? 'justify-center' :
                      cardStyle.back_layout === 'bottom' ? 'justify-end' :
                      cardStyle.back_layout === 'split' ? 'justify-between' : 'justify-center'
                    }`}>
                      {cardStyle.back_layout === 'split' ? (
                        // 상하단 정렬: 정답은 상단, 설명은 중앙, 버튼은 하단
                        <div className="flex flex-col h-full justify-between">
                          {/* 정답 영역 - 상단 */}
                          <div style={{
                            marginTop: `${cardStyle.back_title_margin_top || '0'}px`,
                            marginBottom: `${cardStyle.back_title_margin_bottom || '16'}px`,
                            marginLeft: `${cardStyle.back_title_margin_left || '0'}px`,
                            marginRight: `${cardStyle.back_title_margin_right || '0'}px`
                          }}>
                            <div className={`${cardStyle.back_title_size} ${cardStyle.back_title_color} ${cardStyle.back_title_align}`}>
                              <div className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold bg-emerald-100 text-emerald-700">
                                🎉 정답입니다!
                              </div>
                            </div>
                          </div>
                          
                          {/* 설명 영역 - 중앙 */}
                          <div style={{
                            marginTop: `${cardStyle.back_content_margin_top || '0'}px`,
                            marginBottom: `${cardStyle.back_content_margin_bottom || '0'}px`,
                            marginLeft: `${cardStyle.back_content_margin_left || '0'}px`,
                            marginRight: `${cardStyle.back_content_margin_right || '0'}px`
                          }}>
                            <div className={`${cardStyle.back_content_size} ${cardStyle.back_content_color} ${cardStyle.back_content_align}`}>
                              <p className="text-sm leading-relaxed">이것은 설명 텍스트입니다.</p>
                            </div>
                          </div>
                          
                          {/* 버튼 영역 - 하단 */}
                          <div style={{
                            marginTop: `${cardStyle.back_button_margin_top || '0'}px`,
                            marginBottom: `${cardStyle.back_button_margin_bottom || '0'}px`,
                            marginLeft: `${cardStyle.back_button_margin_left || '0'}px`,
                            marginRight: `${cardStyle.back_button_margin_right || '0'}px`
                          }}>
                            <div className={`${cardStyle.back_button_align} w-full`}>
                              <button className={`${cardStyle.back_button_size} ${cardStyle.back_button_color} rounded-xl font-medium shadow-lg transition w-full`}>
                                다음 문제
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        // 일반 레이아웃 (상단, 중앙, 하단)
                        <div className="flex flex-col gap-5 text-center">
                          {/* 정답 영역 */}
                          <div style={{
                            marginTop: `${cardStyle.back_title_margin_top || '0'}px`,
                            marginBottom: cardStyle.back_layout === 'bottom' 
                              ? `${cardStyle.back_title_margin_top || '0'}px`
                              : `${cardStyle.back_title_margin_bottom || '16'}px`,
                            marginLeft: `${cardStyle.back_title_margin_left || '0'}px`,
                            marginRight: `${cardStyle.back_title_margin_right || '0'}px`
                          }}>
                            <div className={`${cardStyle.back_title_size} ${cardStyle.back_title_color} ${cardStyle.back_title_align}`}>
                              <div className="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold bg-emerald-100 text-emerald-700">
                                🎉 정답입니다!
                              </div>
                            </div>
                          </div>
                          
                          {/* 설명 영역 */}
                          <div style={{
                            marginTop: `${cardStyle.back_content_margin_top || '0'}px`,
                            marginBottom: cardStyle.back_layout === 'bottom' 
                              ? `${cardStyle.back_title_margin_bottom || '16'}px`
                              : `${cardStyle.back_content_margin_bottom || '0'}px`,
                            marginLeft: `${cardStyle.back_content_margin_left || '0'}px`,
                            marginRight: `${cardStyle.back_content_margin_right || '0'}px`
                          }}>
                            <div className={`${cardStyle.back_content_size} ${cardStyle.back_content_color} ${cardStyle.back_content_align}`}>
                              <p className="text-sm leading-relaxed">이것은 설명 텍스트입니다.</p>
                            </div>
                          </div>
                          
                          {/* 버튼 영역 */}
                          <div style={{
                            marginTop: `${cardStyle.back_button_margin_top || '0'}px`,
                            marginBottom: `${cardStyle.back_button_margin_bottom || '0'}px`,
                            marginLeft: `${cardStyle.back_button_margin_left || '0'}px`,
                            marginRight: `${cardStyle.back_button_margin_right || '0'}px`
                          }}>
                            <div className={`${cardStyle.back_button_align} w-full`}>
                              <button className={`${cardStyle.back_button_size} ${cardStyle.back_button_color} rounded-xl font-medium shadow-lg transition w-full`}>
                                다음 문제
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
