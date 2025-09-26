import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import {
  AiDifficulty,
  AiGenerateAndImportResponse,
  AiGenerateRequest,
  AiGenerateResponse,
  aiGenerateAndImportRequest,
  aiGenerateRequest,
  QuizType,
  Visibility,
  type EraEntry,
  type TimelineEntry,
} from '../api';
import { useAuth } from '../context/AuthContext';

const HIGHLIGHT_TYPES: QuizType[] = ['MCQ', 'SHORT', 'OX', 'CLOZE', 'ORDER', 'MATCH'];
const TIMELINE_TYPES: QuizType[] = ['MCQ', 'SHORT', 'OX', 'CLOZE', 'ORDER', 'MATCH'];
const DIFFICULTIES: AiDifficulty[] = ['easy', 'medium', 'hard'];

const QUIZ_TYPE_LABELS: Record<QuizType, string> = {
  MCQ: '객관식',
  SHORT: '주관식',
  OX: 'OX',
  CLOZE: '빈칸채우기',
  ORDER: '순서맞추기',
  MATCH: '짝맞추기',
};

type FocusMode = 'highlight' | 'timeline';

function normalizeEntry(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}



export default function AiTestPage() {
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  // 콘텐츠 추가 페이지와 동일한 state 구조
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [timelinePeriodInput, setTimelinePeriodInput] = useState('');
  const [timelineDescriptionInput, setTimelineDescriptionInput] = useState('');
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [eraPeriodInput, setEraPeriodInput] = useState('');
  const [eraDetailInput, setEraDetailInput] = useState('');
  const [eraEntries, setEraEntries] = useState<EraEntry[]>([]);
  
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<QuizType>('MCQ');
  const [difficulty, setDifficulty] = useState<AiDifficulty>('medium');
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC');
  const [upsert, setUpsert] = useState(false);
  const [skipCache, setSkipCache] = useState(false);
  const [focusMode, setFocusMode] = useState<FocusMode>('highlight');
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generateResult, setGenerateResult] = useState<AiGenerateResponse | null>(null);
  const [importResult, setImportResult] = useState<AiGenerateAndImportResponse | null>(null);

  const selectedHighlights = useMemo(
    () => {
      if (focusMode !== 'highlight') return [];
      
      if (selectedType === 'MATCH') {
        return selectedKeywords;
      } else {
        return selectedKeyword ? [selectedKeyword] : [];
      }
    },
    [selectedKeywords, selectedKeyword, focusMode, selectedType],
  );

  useEffect(() => {
    if (focusMode === 'timeline') {
      if (!TIMELINE_TYPES.includes(selectedType)) {
        setSelectedType('MCQ');
      }
    } else if (!HIGHLIGHT_TYPES.includes(selectedType)) {
    }
  }, [focusMode, selectedType]);

  // ORDER 선택 시 타임라인 모드 강제 고정
  useEffect(() => {
    if (selectedType === 'ORDER') {
      setFocusMode('timeline');
    }
  }, [selectedType]);

  // MATCH 타입 선택 시 키워드 3개 자동 선택
  useEffect(() => {
    if (selectedType === 'MATCH' && keywords.length >= 3) {
      setSelectedKeywords(keywords.slice(0, 3));
    } else if (selectedType !== 'MATCH') {
      setSelectedKeywords([]);
    }
  }, [selectedType, keywords]);

  const typeOptions = focusMode === 'timeline' ? TIMELINE_TYPES : HIGHLIGHT_TYPES;

  // 콘텐츠 추가 페이지와 동일한 함수들
  const addKeyword = () => {
    const raw = keywordInput;
    if (!raw.trim()) {
      setKeywordInput('');
      return;
    }
    const candidates = raw
      .split(/,|\n/)
      .map((item) => normalizeEntry(item))
      .filter(Boolean);
    if (!candidates.length) {
      setKeywordInput('');
      return;
    }
    setKeywords((prev) => {
      const next = [...prev];
      for (const item of candidates) {
        if (!next.includes(item)) {
          next.push(item);
        }
      }
      return next;
    });
    setKeywordInput('');
    
    // 첫 번째 키워드가 추가되면 자동으로 선택
    if (keywords.length === 0 && candidates.length > 0) {
      setSelectedKeyword(candidates[0]);
    }
  };

  const handleKeywordKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addKeyword();
    }
  };

  const removeKeyword = (target: string) => {
    setKeywords((prev) => prev.filter((item) => item !== target));
    
    // 선택된 키워드가 제거되면 선택 해제하거나 다른 키워드 선택
    if (selectedKeyword === target) {
      const remainingKeywords = keywords.filter((item) => item !== target);
      setSelectedKeyword(remainingKeywords.length > 0 ? remainingKeywords[0] : null);
    }
  };

  const addTimelineEntry = () => {
    const period = normalizeEntry(timelinePeriodInput);
    const description = timelineDescriptionInput.trim();
    if (!period) return;
    setTimelineEntries((prev) => [...prev, { title: period, description: description }]);
    setTimelinePeriodInput('');
    setTimelineDescriptionInput('');
  };

  const handleTimelineKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      addTimelineEntry();
    }
  };

  const removeTimelineEntry = (index: number) => {
    setTimelineEntries((prev) => prev.filter((_, idx) => idx !== index));
  };

  const addCategory = () => {
    const raw = categoryInput;
    if (!raw.trim()) {
      setCategoryInput('');
      return;
    }
    const candidates = raw
      .split(/,|\n/)
      .map((item) => normalizeEntry(item))
      .filter(Boolean);
    if (!candidates.length) {
      setCategoryInput('');
      return;
    }
    setCategories((prev) => {
      const next = [...prev];
      for (const item of candidates) {
        if (!next.includes(item)) {
          next.push(item);
        }
      }
      return next;
    });
    setCategoryInput('');
  };

  const handleCategoryKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCategory();
    }
  };

  const removeCategory = (target: string) => {
    setCategories((prev) => prev.filter((item) => item !== target));
  };

  const addEraEntry = () => {
    const period = normalizeEntry(eraPeriodInput);
    const detail = eraDetailInput.trim();
    if (!period) return;
    setEraEntries((prev) => [...prev, { period, detail }]);
    setEraPeriodInput('');
    setEraDetailInput('');
  };

  const handleEraKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      addEraEntry();
    }
  };

  const removeEraEntry = (index: number) => {
    setEraEntries((prev) => prev.filter((_, idx) => idx !== index));
  };

  const buildGeneratePayload = (): AiGenerateRequest => {
    const payload: AiGenerateRequest = {
      content: content.trim(),
      highlights:
        focusMode === 'highlight' && selectedType === 'MATCH'
          ? selectedHighlights
          : selectedHighlights.slice(0, 1),
      types: [selectedType],
      difficulty,
      no_cache: skipCache,
      focus_mode: focusMode,
    };
    
    // timeline 모드일 때 timeline 정보 추가
    if (focusMode === 'timeline' && timelineEntries.length > 0) {
      payload.timeline = timelineEntries.map(entry => ({
        year: parseInt(entry.title.match(/\d{4}/)?.[0] || '0'),
        label: entry.description || entry.title
      })).filter(item => item.year > 0);
    }
    
    return payload;
  };

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) {
      setError('본문을 입력해주세요.');
      return;
    }
    if (!selectedType) {
      setError('카드 유형을 선택해주세요.');
      return;
    }
    if (focusMode === 'highlight' && selectedType !== 'MATCH' && !selectedKeyword) {
      setError('키워드 기반 모드에서는 하이라이트로 사용할 키워드를 선택해주세요.');
      return;
    }
    if (focusMode === 'highlight' && selectedType === 'MATCH' && selectedKeywords.length < 3) {
      setError('MATCH 유형은 키워드를 최소 3개 이상 선택해야 합니다.');
      return;
    }
    setError(null);
    setLoadingGenerate(true);
    setImportResult(null);
    try {
      const response = await aiGenerateRequest(buildGeneratePayload());
      setGenerateResult(response);
    } catch (err: any) {
      const message = err?.response?.data?.detail ?? err?.message ?? '생성에 실패했습니다.';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoadingGenerate(false);
    }
  };

  const handleGenerateAndImport = async () => {
    if (!content.trim() || !title.trim()) {
      setError('제목과 본문을 모두 입력해주세요.');
      return;
    }
    if (!selectedType) {
      setError('카드 유형을 선택해주세요.');
      return;
    }
    if (focusMode === 'highlight' && selectedType !== 'MATCH' && !selectedKeyword) {
      setError('키워드 기반 모드에서는 하이라이트로 사용할 키워드를 선택해주세요.');
      return;
    }
    if (focusMode === 'highlight' && selectedType === 'MATCH') {
      if (selectedKeywords.length < 3) {
        setError('MATCH 유형은 키워드를 최소 3개 이상 선택해야 합니다.');
        return;
      }
    }
    setError(null);
    setLoadingImport(true);
    try {

      // 새로운 구조의 데이터를 기존 API 형식으로 변환
      const chronologyData = timelineEntries.length > 0 ? {
        events: timelineEntries.map(entry => ({
          year: parseInt(entry.title.match(/\d{4}/)?.[0] || '0'),
          label: entry.description || entry.title
        })).filter(item => item.year > 0)
      } : undefined;

      const response = await aiGenerateAndImportRequest({
        ...buildGeneratePayload(),
        title: title.trim(),
        tags: keywords, // keywords를 tags로 전송
        chronology: chronologyData,
        visibility,
        upsert,
      });

      setGenerateResult({ cards: response.cards, facts: response.facts, meta: response.meta });
      setImportResult(response);
    } catch (err: any) {
      const details = err?.response?.data?.detail ?? err?.message ?? '생성 및 저장에 실패했습니다.';
      setError(typeof details === 'string' ? details : JSON.stringify(details));
    } finally {
      setLoadingImport(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-primary-600">AI 생성 테스트</h1>
        <p className="text-sm text-slate-600">
          콘텐츠 정보를 입력한 뒤, 카드 유형과 난이도를 선택해 AI가 생성한 퀴즈를 확인할 수 있습니다.
        </p>
        <p className="text-xs text-slate-500">
          생성 결과는 캐시(24시간)되며, 동일 입력은 토큰 소모 없이 즉시 반환됩니다.
        </p>
      </header>

      <form onSubmit={handleGenerate} className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">제목</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="콘텐츠 제목"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">본문</label>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={10}
              placeholder="학습할 본문 내용을 입력하세요."
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>

          {/* 키워드 추가 */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">키워드 추가</label>
            <div className="flex gap-2">
              <input
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                onKeyDown={handleKeywordKeyDown}
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                placeholder="예) 세종"
              />
              <button
                type="button"
                onClick={addKeyword}
                className="rounded bg-primary-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-500"
              >
                추가
              </button>
            </div>
            {keywords.length ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="inline-flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-700"
                  >
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(keyword)}
                      className="text-primary-600 hover:text-primary-800"
                      aria-label={`${keyword} 제거`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">엔터 또는 추가 버튼으로 키워드를 등록하세요.</p>
            )}
          </div>

          {/* 타임라인 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600">타임라인</label>
              <span className="text-xs text-slate-400">(Ctrl/⌘ + Enter 로 빠르게 추가)</span>
            </div>
            <div className="flex flex-col gap-2 rounded border border-slate-200 p-4">
              <div className="grid gap-2 md:grid-cols-[200px_1fr_auto]">
                <input
                  value={timelinePeriodInput}
                  onChange={(event) => setTimelinePeriodInput(event.target.value)}
                  onKeyDown={handleTimelineKeyDown}
                  className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  placeholder="연도/기간 (예: 1392년, 14세기, 1392~1400년)"
                />
                <textarea
                  value={timelineDescriptionInput}
                  onChange={(event) => setTimelineDescriptionInput(event.target.value)}
                  onKeyDown={handleTimelineKeyDown}
                  className="h-20 rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  placeholder="설명"
                />
                <button
                  type="button"
                  onClick={addTimelineEntry}
                  className="rounded bg-primary-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-500"
                >
                  타임라인 추가
                </button>
              </div>
              {timelineEntries.length ? (
                <ul className="space-y-2">
                  {timelineEntries.map((entry, index) => (
                    <li
                      key={`${entry.title}-${index}`}
                      className="flex items-start justify-between gap-3 rounded border border-slate-200 bg-white p-3 text-xs text-slate-700"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-primary-600">{entry.title}</p>
                        {entry.description ? <p className="mt-1 text-slate-600">{entry.description}</p> : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTimelineEntry(index)}
                        className="text-xs text-slate-400 transition hover:text-rose-500"
                        aria-label="타임라인 항목 삭제"
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">연도와 설명을 입력하여 타임라인을 추가하세요.</p>
              )}
            </div>
          </div>

          {/* 분류 추가 */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">분류 추가</label>
            <div className="flex gap-2">
              <input
                value={categoryInput}
                onChange={(event) => setCategoryInput(event.target.value)}
                onKeyDown={handleCategoryKeyDown}
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                placeholder="예) 인물"
              />
              <button
                type="button"
                onClick={addCategory}
                className="rounded bg-primary-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-500"
              >
                추가
              </button>
            </div>
            {categories.length ? (
              <div className="flex flex-wrap gap-2 pt-2">
                {categories.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => removeCategory(item)}
                      className="text-slate-500 hover:text-rose-500"
                      aria-label={`${item} 제거`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">쉼표, 줄바꿈 또는 추가 버튼을 사용해 분류를 등록하세요.</p>
            )}
          </div>

          {/* 연대 · 세부 연대 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600">연대 · 세부 연대</label>
              <span className="text-xs text-slate-400">(Ctrl/⌘ + Enter 로 빠르게 추가)</span>
            </div>
            <div className="flex flex-col gap-2 rounded border border-slate-200 p-4">
              <div className="grid gap-2 md:grid-cols-[220px_1fr_auto]">
                <input
                  value={eraPeriodInput}
                  onChange={(event) => setEraPeriodInput(event.target.value)}
                  onKeyDown={handleEraKeyDown}
                  className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  placeholder="연대 (예: 고려 말기부터 조선 초기)"
                />
                <textarea
                  value={eraDetailInput}
                  onChange={(event) => setEraDetailInput(event.target.value)}
                  onKeyDown={handleEraKeyDown}
                  className="h-20 rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  placeholder="세부 연대 (예: 1392년 조선 건국 이후 초기 개혁기)"
                />
                <button
                  type="button"
                  onClick={addEraEntry}
                  className="rounded bg-primary-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-500"
                >
                  연대 추가
                </button>
              </div>
              {eraEntries.length ? (
                <ul className="space-y-2">
                  {eraEntries.map((entry, index) => (
                    <li
                      key={`${entry.period}-${index}`}
                      className="flex items-start justify-between gap-3 rounded border border-slate-200 bg-white p-3 text-xs text-slate-700"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-primary-600">{entry.period}</p>
                        {entry.detail ? <p className="mt-1 text-slate-600">{entry.detail}</p> : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEraEntry(index)}
                        className="text-xs text-slate-400 transition hover:text-rose-500"
                        aria-label="연대 항목 삭제"
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">연대와 세부 연대를 입력해 추가하세요.</p>
              )}
            </div>
          </div>


        </section>

        <section className="space-y-4">
          <fieldset className="space-y-2 rounded border border-slate-200 p-3">
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
                  disabled={selectedType === 'ORDER'}
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
              {selectedType === 'ORDER' ? (
                <p className="text-[11px] text-primary-600">순서맞추기 유형 선택 시, 퀴즈 생성 방식은 "주요 사건 기반"만 사용됩니다.</p>
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
              {keywords.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((keyword) => {
                      const isSelected = focusMode === 'highlight' && (
                        selectedType === 'MATCH' ? selectedKeywords.includes(keyword) : keyword === selectedKeyword
                      );
                      const isClickable = focusMode === 'highlight';
                      
                      return (
                        <button
                          key={keyword}
                          type="button"
                          onClick={() => {
                            if (isClickable) {
                              if (selectedType === 'MATCH') {
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
                      selectedType === 'MATCH' ? (
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
                  위의 "키워드 추가"에서 키워드를 등록하면 하이라이트로 사용됩니다.
                </p>
              )}
            </div>
            {focusMode === 'highlight' && selectedType === 'MATCH' && selectedKeywords.length < 3 ? (
              <p className="mt-1 text-[11px] text-amber-600">짝맞추기 유형은 키워드를 최소 3개 이상 선택해야 합니다.</p>
            ) : null}
          </div>

          <fieldset className="space-y-2 rounded border border-slate-200 p-3">
            <legend className="text-xs font-semibold text-slate-600">카드 유형 (1개 선택)</legend>
            <div className="flex flex-wrap gap-3">
              {typeOptions.map((type) => (
                <label key={type} className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    type="radio"
                    name="card-type"
                    checked={selectedType === type}
                    onChange={() => setSelectedType(type)}
                    className="h-4 w-4"
                    disabled={false}
                  />
                  {QUIZ_TYPE_LABELS[type]}
                </label>
              ))}
            </div>
          </fieldset>

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



          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">공개 범위</label>
              <select
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as Visibility)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="PUBLIC">PUBLIC</option>
                <option value="PRIVATE">PRIVATE</option>
              </select>
            </div>
            <label className="mt-5 flex items-center gap-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={upsert}
                onChange={(event) => setUpsert(event.target.checked)}
                className="h-4 w-4"
              />
              동일 제목 콘텐츠가 있으면 덮어쓰기(upsert)
            </label>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={skipCache}
              onChange={(event) => setSkipCache(event.target.checked)}
              className="h-4 w-4"
            />
            캐시를 무시하고 새로 생성하기
          </label>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={loadingGenerate}
              className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:opacity-60"
            >
              {loadingGenerate ? '생성 중…' : 'AI로 미리보기 생성'}
            </button>
            <button
              type="button"
              onClick={handleGenerateAndImport}
              disabled={loadingImport}
              className="rounded border border-primary-600 px-4 py-2 text-sm font-semibold text-primary-600 transition hover:bg-primary-50 disabled:opacity-60"
            >
              {loadingImport ? '저장 중…' : 'AI 생성 + 저장'}
            </button>
          </div>
          {!user ? (
            <p className="text-xs text-slate-500">
              로그인하지 않아도 저장은 가능하지만, 소유자가 없는 공개 콘텐츠로 등록됩니다. 개인 저장을 원하면 로그인 후 사용하세요.
            </p>
          ) : null}

          {generateResult ? (
            <div className="mt-6 space-y-3 rounded border border-slate-200 p-4">
              <header className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-primary-600">생성 결과</h2>
                <div className="text-xs text-slate-600">
                  <span className="mr-3">cached: {generateResult.meta.cached ? 'yes' : 'no'}</span>
                  <span className="mr-3">tokens in: {generateResult.meta.tokens_in}</span>
                  <span className="mr-3">tokens out: {generateResult.meta.tokens_out}</span>
                  <span>latency: {generateResult.meta.latency_ms}ms</span>
                </div>
              </header>
              <div className="space-y-4">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">Facts</h3>
                  <pre className="max-h-80 overflow-auto rounded bg-slate-900/90 p-3 text-xs text-slate-100">
                    {JSON.stringify(generateResult.facts, null, 2)}
                  </pre>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">Cards</h3>
                  <pre className="max-h-80 overflow-auto rounded bg-slate-900/90 p-3 text-xs text-slate-100">
                    {JSON.stringify(generateResult.cards, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </form>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}


      {importResult ? (
        <section className="space-y-2 rounded border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="text-lg font-semibold text-emerald-700">저장 완료</h2>
          <p className="text-sm text-emerald-700">
            콘텐츠 #{importResult.content_id}에 카드 {importResult.generated_count}개가 저장되었습니다.
          </p>
          <pre className="max-h-60 overflow-auto rounded bg-emerald-900/80 p-3 text-xs text-emerald-50">
            {JSON.stringify(importResult, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
