import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CardPreview from '../components/CardPreview';
import ContentSnapshot from '../components/ContentSnapshot';
import QuizForm from '../components/QuizForm';
import { useAuth } from '../context/AuthContext';
import {
  createQuizForContent,
  fetchContent,
  fetchContentCards,
  aiGenerateRequest,
  type ContentDetail,
  type QuizItem,
  type QuizType,
  type Visibility,
  type AiDifficulty,
  type AiGenerateRequest,
  type AiGenerateResponse,
} from '../api';
import { getQuizTypeLabel } from '../utils/quiz';

const quizTypeLabels: Record<string, string> = {
  MCQ: '객관식',
  SHORT: '주관식',
  OX: 'OX',
  CLOZE: '빈칸채우기',
  ORDER: '순서맞추기',
  MATCH: '짝맞추기',
};

const HIGHLIGHT_TYPES: QuizType[] = ['MCQ', 'SHORT', 'OX', 'CLOZE', 'ORDER', 'MATCH'];
const TIMELINE_TYPES: QuizType[] = ['MCQ', 'SHORT', 'OX', 'CLOZE', 'ORDER', 'MATCH'];
const DIFFICULTIES: AiDifficulty[] = ['easy', 'medium', 'hard'];

type FocusMode = 'highlight' | 'timeline';

export default function QuizCreatePage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const quizTypeParam = (searchParams.get('type') ?? '').toUpperCase();
  const quizType = quizTypeParam as QuizType;
  const isAdmin = user?.is_admin === true;
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [cards, setCards] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('PRIVATE');

  // AI 생성 관련 state
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [focusMode, setFocusMode] = useState<FocusMode>('highlight');
  const [difficulty, setDifficulty] = useState<AiDifficulty>('medium');
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [generateResult, setGenerateResult] = useState<AiGenerateResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const selectedHighlights = useMemo(
    () => {
      if (!content?.keywords) return [];
      if (focusMode !== 'highlight') return [];
      
      if (quizType === 'MATCH') {
        return selectedKeywords;
      } else {
        return selectedKeyword ? [selectedKeyword] : [];
      }
    },
    [content?.keywords, selectedKeywords, selectedKeyword, focusMode, quizType],
  );

  useEffect(() => {
    if (focusMode === 'timeline') {
      if (!TIMELINE_TYPES.includes(quizType)) {
        setFocusMode('highlight');
      }
    } else if (!HIGHLIGHT_TYPES.includes(quizType)) {
      setFocusMode('highlight');
    }
  }, [quizType, focusMode]);

  useEffect(() => {
    if (quizType === 'ORDER') {
      setFocusMode('timeline');
    }
  }, [quizType]);

  // 첫 번째 키워드를 자동으로 선택
  useEffect(() => {
    if (content?.keywords && content.keywords.length > 0 && !selectedKeyword) {
      setSelectedKeyword(content.keywords[0]);
    }
  }, [content?.keywords, selectedKeyword]);

  // MATCH 타입 선택 시 키워드 3개 자동 선택
  useEffect(() => {
    if (quizType === 'MATCH' && content?.keywords && content.keywords.length >= 3) {
      setSelectedKeywords(content.keywords.slice(0, 3));
    } else if (quizType !== 'MATCH') {
      setSelectedKeywords([]);
    }
  }, [quizType, content?.keywords]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const [detail, cardList] = await Promise.all([fetchContent(id), fetchContentCards(id)]);
        setContent(detail);
        setCards(cardList);
        setVisibility(detail.visibility);
      } catch (err: any) {
        console.error(err);
        const message = err?.response?.data?.detail ?? '콘텐츠 정보를 불러오지 못했습니다.';
        setError(typeof message === 'string' ? message : JSON.stringify(message));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const buildGeneratePayload = (): AiGenerateRequest | null => {
    if (!content) return null;
    
    const payload: AiGenerateRequest = {
      content: content.content || '',
      highlights: focusMode === 'highlight' && quizType === 'MATCH' 
        ? selectedHighlights 
        : selectedHighlights.slice(0, 1),
      types: [quizType],
      difficulty,
      no_cache: false,
      focus_mode: focusMode,
    };
    
    // timeline 모드일 때 timeline 정보 추가
    if (focusMode === 'timeline' && content.timeline && content.timeline.length > 0) {
      (payload as any).timeline = content.timeline.map((entry: any) => ({
        year: parseInt(entry.title?.match(/\d{4}/)?.[0] || '0'),
        label: entry.description || entry.title
      })).filter((item: any) => item.year > 0);
    }
    
    return payload;
  };

  const handleAiGenerate = async () => {
    if (!content) return;
    
    if (focusMode === 'highlight' && quizType !== 'MATCH' && !selectedKeyword) {
      setAiError('키워드 기반 모드에서는 하이라이트로 사용할 키워드를 선택해주세요.');
      return;
    }
    if (focusMode === 'highlight' && quizType === 'MATCH' && selectedKeywords.length < 3) {
      setAiError('MATCH 유형은 키워드를 최소 3개 이상 선택해야 합니다.');
      return;
    }

    const payload = buildGeneratePayload();
    if (!payload) return;

    setAiError(null);
    setLoadingGenerate(true);
    try {
      console.log('AI Generate Payload:', payload);
      const response = await aiGenerateRequest(payload);
      setGenerateResult(response);
    } catch (err: any) {
      console.error('AI Generate Error:', err);
      const message = err?.response?.data?.detail ?? err?.message ?? '생성에 실패했습니다.';
      setAiError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoadingGenerate(false);
    }
  };

  const handleSubmit = async (payload: Record<string, any>) => {
    if (!id) return;
    setSubmitting(true);
    try {
      await createQuizForContent(id, { ...payload, visibility });
      alert('퀴즈가 생성되었습니다.');
      navigate(`/contents/${id}`, { replace: true, state: { refresh: Date.now() } });
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '퀴즈를 생성하지 못했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setSubmitting(false);
    }
  };

  if (!quizTypeParam || !quizTypeLabels[quizTypeParam]) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-rose-600">지원하지 않는 퀴즈 형식입니다.</p>
        <Link to={`/contents/${id}`} className="text-sm text-primary-600 hover:text-primary-700">
          콘텐츠 상세로 돌아가기
        </Link>
      </section>
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-600">불러오는 중…</p>;
  }

  if (error || !content) {
    return <p className="text-sm text-rose-600">{error ?? '콘텐츠를 찾을 수 없습니다.'}</p>;
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-xs text-primary-600 hover:text-primary-700"
        >
          ← 이전으로
        </button>
        <h1 className="text-2xl font-semibold text-primary-600">퀴즈 만들기</h1>
        <p className="text-sm text-slate-500">
          형식: {quizTypeLabels[quizType]}
        </p>
        {submitting ? (
          <p className="text-xs text-primary-600">저장 중…</p>
        ) : null}
      </header>

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
        <label className="flex w-full flex-col gap-2 text-sm text-slate-600">
          공개 범위
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as Visibility)}
            className="max-w-xs rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="PRIVATE">비공개 (나만 보기)</option>
            <option value="PUBLIC">공개 (모두 보기)</option>
          </select>
        </label>
        <QuizForm
          type={quizType}
          onSubmit={handleSubmit}
          keywordOptions={content.keywords ?? []}
        />
      </div>

      {isAdmin && (
        <div className="space-y-4 rounded-lg border border-primary-200 bg-primary-50 p-5">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold text-primary-600">AI 생성 테스트</h2>
          <p className="text-sm text-slate-600">
            AI를 활용해 퀴즈를 미리 생성해보고 참고할 수 있습니다.
          </p>
        </header>

        <div className="space-y-4">
          <fieldset className="space-y-2 rounded border border-slate-200 bg-white p-3">
            <legend className="text-xs font-semibold text-slate-600">퀴즈 생성 방식</legend>
            <div className="flex flex-col gap-2 text-xs text-slate-600">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="focus-mode"
                  value="highlight"
                  checked={focusMode === 'highlight'}
                  onChange={() => setFocusMode('highlight')}
                  className="h-4 w-4"
                  disabled={quizType === 'ORDER'}
                />
                선택된 키워드를 중심으로 퀴즈 생성
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="focus-mode"
                  value="timeline"
                  checked={focusMode === 'timeline'}
                  onChange={() => setFocusMode('timeline')}
                  className="h-4 w-4"
                />
                주요 사건 기반으로 퀴즈 생성
              </label>
              {quizType === 'ORDER' ? (
                <p className="text-[11px] text-primary-600">ORDER 유형 선택 시, 퀴즈 생성 방식은 "주요 사건 기반"만 사용됩니다.</p>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-500">
              {focusMode === 'highlight'
                ? '키워드 기반 모드에서는 등록된 키워드를 중심으로 퀴즈가 생성됩니다.'
                : '타임라인 기반 모드에서는 타임라인 정보를 바탕으로 퀴즈가 생성되며, 키워드는 사용되지 않습니다.'}
            </p>
          </fieldset>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">하이라이트 (키워드에서 선택됨)</label>
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              {content?.keywords && content.keywords.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {content.keywords.map((keyword) => {
                      const isSelected = focusMode === 'highlight' && (
                        quizType === 'MATCH' ? selectedKeywords.includes(keyword) : keyword === selectedKeyword
                      );
                      const isClickable = focusMode === 'highlight';
                      
                      return (
                        <button
                          key={keyword}
                          type="button"
                          onClick={() => {
                            if (isClickable) {
                              if (quizType === 'MATCH') {
                                if (selectedKeywords.includes(keyword)) {
                                  // 선택 해제 (최소 3개 유지)
                                  if (selectedKeywords.length > 3) {
                                    setSelectedKeywords(selectedKeywords.filter(k => k !== keyword));
                                  }
                                } else {
                                  // 선택 추가
                                  setSelectedKeywords([...selectedKeywords, keyword]);
                                }
                              } else {
                                setSelectedKeyword(keyword === selectedKeyword ? null : keyword);
                              }
                            }
                          }}
                          disabled={!isClickable}
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition ${
                            isSelected
                              ? 'bg-primary-100 text-primary-700'
                              : 'bg-slate-200 text-slate-600'
                          } ${
                            isClickable 
                              ? 'cursor-pointer hover:bg-primary-50 hover:text-primary-600' 
                              : 'cursor-default'
                          }`}
                        >
                          {keyword}
                          {isSelected && (
                            <span className="ml-1 text-primary-500">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-600">
                    {focusMode === 'highlight' ? (
                      quizType === 'MATCH' ? (
                        `선택된 키워드(${selectedKeywords.length}개)가 하이라이트로 사용됩니다. 최소 3개 이상 선택해야 합니다.`
                      ) : selectedKeyword ? (
                        `선택된 키워드(${selectedKeyword})가 하이라이트로 사용됩니다. 다른 키워드를 클릭하여 변경할 수 있습니다.`
                      ) : (
                        '키워드를 클릭하여 하이라이트로 사용할 키워드를 선택하세요.'
                      )
                    ) : (
                      '타임라인 모드에서는 하이라이트가 사용되지 않습니다.'
                    )}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  콘텐츠에 키워드가 등록되어 있지 않습니다.
                </p>
              )}
            </div>
            {focusMode === 'highlight' && quizType === 'MATCH' && selectedKeywords.length < 3 ? (
              <p className="mt-1 text-[11px] text-amber-600">MATCH 유형은 키워드를 최소 3개 이상 선택해야 합니다.</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">난이도</label>
            <select
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as AiDifficulty)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            >
              {DIFFICULTIES.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={loadingGenerate}
              className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:opacity-60"
            >
              {loadingGenerate ? '생성 중…' : 'AI로 미리보기 생성'}
            </button>
          </div>

          {aiError ? <p className="text-sm text-rose-600">{aiError}</p> : null}

          {generateResult ? (
            <div className="mt-4 space-y-3 rounded border border-slate-200 bg-white p-4">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-primary-600">생성 결과</h3>
                <div className="text-xs text-slate-600">
                  <span className="mr-3">cached: {generateResult.meta.cached ? 'yes' : 'no'}</span>
                  <span className="mr-3">tokens: {generateResult.meta.tokens_in + generateResult.meta.tokens_out}</span>
                  <span>latency: {generateResult.meta.latency_ms}ms</span>
                </div>
              </header>
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-xs font-semibold text-slate-700">Cards</h4>
                  <pre className="max-h-60 overflow-auto rounded bg-slate-900/90 p-3 text-xs text-slate-100">
                    {JSON.stringify(generateResult.cards, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        </div>
      )}

      <section className="space-y-6 rounded-lg border border-slate-200 bg-slate-50 p-6">
        <header className="space-y-2">
          <h2 className="text-lg font-semibold text-primary-600">콘텐츠 정보</h2>
          <p className="text-xs text-slate-500">새 퀴즈를 작성할 때 참고하세요.</p>
        </header>
        <ContentSnapshot content={content} />
        {cards.length ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-primary-600">기존 퀴즈 미리보기</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => (
                <div key={card.id} className="space-y-2 rounded border border-slate-200 bg-white p-4 text-xs">
                  <CardPreview card={card} />
                  <p className="text-[11px] text-slate-500">
                    생성일: {new Date(card.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
