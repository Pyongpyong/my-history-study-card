import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AiDifficulty,
  AiGenerateAndImportResponse,
  AiGenerateRequest,
  AiGenerateResponse,
  aiGenerateAndImportRequest,
  aiGenerateRequest,
  QuizType,
  Visibility,
} from '../api';
import HighlightInput, { HighlightItem } from '../components/HighlightInput';
import { useAuth } from '../context/AuthContext';

const HIGHLIGHT_TYPES: QuizType[] = ['MCQ', 'SHORT', 'OX', 'CLOZE', 'ORDER', 'MATCH'];
const TIMELINE_TYPES: QuizType[] = ['MCQ', 'SHORT', 'OX', 'CLOZE', 'ORDER', 'MATCH'];
const DIFFICULTIES: AiDifficulty[] = ['easy', 'medium', 'hard'];

type FocusMode = 'highlight' | 'timeline';

function splitList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

interface ChronologyParseResult {
  startYear?: number;
  endYear?: number;
  events: Array<{ year: number; label: string }>;
}

function parseChronologyInput(start: string, end: string, events: string): ChronologyParseResult {
  const result: ChronologyParseResult = { events: [] };

  const parseYear = (value: string): number | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (Number.isNaN(parsed)) {
      throw new Error(`연도 입력이 올바르지 않습니다: ${value}`);
    }
    return parsed;
  };

  const startYear = parseYear(start);
  if (typeof startYear === 'number') {
    result.startYear = startYear;
  }

  const endYear = parseYear(end);
  if (typeof endYear === 'number') {
    result.endYear = endYear;
  }

  if (events.trim()) {
    const lines = events
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of lines) {
      const [yearPart, ...labelParts] = line.split(',');
      if (!yearPart || !labelParts.length) {
        throw new Error('연표 이벤트는 "연도,설명" 형식으로 입력해주세요.');
      }
      const year = Number(yearPart.trim());
      if (Number.isNaN(year)) {
        throw new Error(`연표 이벤트의 연도가 올바르지 않습니다: ${line}`);
      }
      const label = labelParts.join(',').trim();
      if (!label) {
        throw new Error(`연표 이벤트의 설명이 필요합니다: ${line}`);
      }
      result.events.push({ year, label });
    }
  }

  return result;
}

export default function AiTestPage() {
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [highlightItems, setHighlightItems] = useState<HighlightItem[]>([]);
  const [tagsInput, setTagsInput] = useState('');
  const [taxonomyEra, setTaxonomyEra] = useState('');
  const [taxonomySubEra, setTaxonomySubEra] = useState('');
  const [taxonomyTopic, setTaxonomyTopic] = useState('');
  const [taxonomyEntity, setTaxonomyEntity] = useState('');
  const [taxonomyRegion, setTaxonomyRegion] = useState('');
  const [taxonomyKeywords, setTaxonomyKeywords] = useState('');
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');
  const [eventsInput, setEventsInput] = useState('');
  const [difficulty, setDifficulty] = useState<AiDifficulty>('medium');
  const [selectedType, setSelectedType] = useState<QuizType>('MCQ');
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
    () =>
      focusMode === 'highlight'
        ? highlightItems.filter((item) => item.selected).map((item) => item.value)
        : [],
    [highlightItems, focusMode],
  );

  useEffect(() => {
    if (focusMode === 'timeline') {
      setHighlightItems((prev) => {
        let changed = false;
        const next = prev.map((item) => {
          if (item.selected) {
            changed = true;
            return { ...item, selected: false };
          }
          return item;
        });
        return changed ? next : prev;
      });
      if (!TIMELINE_TYPES.includes(selectedType)) {
        setSelectedType('MCQ');
      }
    } else if (!HIGHLIGHT_TYPES.includes(selectedType)) {
      setSelectedType('MCQ');
    }
  }, [focusMode, selectedType]);

  // ORDER 선택 시 타임라인 모드 강제 고정
  useEffect(() => {
    if (selectedType === 'ORDER' && focusMode !== 'timeline') {
      setFocusMode('timeline');
    }
  }, [selectedType, focusMode]);

  const typeOptions = focusMode === 'timeline' ? TIMELINE_TYPES : HIGHLIGHT_TYPES;

  const handleAddHighlight = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    const normalized = trimmed.toLowerCase();
    setHighlightItems((prev) => {
      const next = prev.map((item) => ({ ...item }));
      const existingIndex = next.findIndex((item) => item.value.toLowerCase() === normalized);
      if (existingIndex >= 0) {
        if (focusMode === 'highlight' && selectedType !== 'MATCH') {
          next.forEach((item, index) => {
            item.selected = index === existingIndex;
          });
        } else {
          next[existingIndex].selected = false;
        }
        return next;
      }
      if (focusMode === 'highlight' && selectedType !== 'MATCH') {
        next.forEach((item) => {
          if (item.selected) {
            item.selected = false;
          }
        });
      }
      next.push({ value: trimmed, selected: focusMode === 'highlight' });
      return next;
    });
  };

  const handleRemoveHighlight = (value: string) => {
    const normalized = value.trim().toLowerCase();
    setHighlightItems((prev) => prev.filter((item) => item.value.toLowerCase() !== normalized));
  };

  const handleToggleHighlight = (value: string) => {
    const normalized = value.trim().toLowerCase();
    setHighlightItems((prev) => {
      const next = prev.map((item) => ({ ...item }));
      const index = next.findIndex((item) => item.value.toLowerCase() === normalized);
      if (index < 0) {
        return next;
      }
      if (focusMode !== 'highlight') {
        next.forEach((item) => {
          if (item.selected) {
            item.selected = false;
          }
        });
        return next;
      }
      if (selectedType === 'MATCH') {
        // allow multi-select in MATCH + highlight mode
        next[index].selected = !next[index].selected;
      } else {
        if (next[index].selected) {
          next[index].selected = false;
        } else {
          next.forEach((item, idx) => {
            item.selected = idx === index;
          });
        }
      }
      return next;
    });
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
    if (focusMode === 'timeline' && eventsInput.trim()) {
      const parsed = parseChronologyInput(startYear, endYear, eventsInput);
      if (parsed.events.length > 0) {
        payload.timeline = parsed.events;
      }
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
    if (focusMode === 'highlight' && selectedType === 'MATCH') {
      if (selectedHighlights.length < 3) {
        setError('MATCH 유형은 하이라이트를 최소 3개 이상 선택해야 합니다.');
        window.alert('MATCH 유형은 하이라이트를 최소 3개 이상 선택해야 합니다.');
        return;
      }
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
    if (focusMode === 'highlight' && selectedType === 'MATCH') {
      if (selectedHighlights.length < 3) {
        setError('MATCH 유형은 하이라이트를 최소 3개 이상 선택해야 합니다.');
        return;
      }
    }
    setError(null);
    setLoadingImport(true);
    try {
      let chronology;
      if (startYear.trim() || endYear.trim() || eventsInput.trim()) {
        const parsed = parseChronologyInput(startYear, endYear, eventsInput);
        chronology = {
          ...(typeof parsed.startYear === 'number'
            ? { start: { year: parsed.startYear, precision: 'year' as const } }
            : {}),
          ...(typeof parsed.endYear === 'number'
            ? { end: { year: parsed.endYear, precision: 'year' as const } }
            : {}),
          ...(parsed.events.length ? { events: parsed.events } : {}),
        };
      }

      const taxonomyCandidate = {
        era: taxonomyEra.trim() || undefined,
        sub_era: taxonomySubEra.trim() || undefined,
        topic: splitList(taxonomyTopic),
        entity: splitList(taxonomyEntity),
        region: splitList(taxonomyRegion),
        keywords: splitList(taxonomyKeywords),
      };

      const hasTaxonomyData =
        Boolean(taxonomyCandidate.era || taxonomyCandidate.sub_era) ||
        taxonomyCandidate.topic.length > 0 ||
        taxonomyCandidate.entity.length > 0 ||
        taxonomyCandidate.region.length > 0 ||
        taxonomyCandidate.keywords.length > 0;

      const response = await aiGenerateAndImportRequest({
        ...buildGeneratePayload(),
        title: title.trim(),
        tags: splitList(tagsInput),
        taxonomy: hasTaxonomyData ? taxonomyCandidate : undefined,
        chronology,
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
          본문과 하이라이트를 입력한 뒤, 카드 유형과 난이도를 선택해 AI가 생성한 퀴즈를 확인할 수 있습니다.
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
                선택된 하이라이트를 중심으로 퀴즈 생성
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
                <p className="text-[11px] text-primary-600">ORDER 유형 선택 시, 퀴즈 생성 방식은 "주요 사건 기반"만 사용됩니다.</p>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-500">
              {focusMode === 'highlight'
                ? '하이라이트는 최대 1개까지 선택할 수 있습니다.'
                : '주요 사건 기반 모드에서는 타임라인 정보를 바탕으로 퀴즈가 생성되며, 하이라이트 선택은 사용되지 않습니다.'}
            </p>
          </fieldset>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">하이라이트</label>
            <HighlightInput
              highlights={highlightItems}
              onAdd={handleAddHighlight}
              onRemove={handleRemoveHighlight}
              onToggle={handleToggleHighlight}
              allowToggle={focusMode === 'highlight'}
              placeholder="예) 세종대왕"
            />
            {focusMode === 'highlight' && selectedType === 'MATCH' ? (
              <p className="mt-1 text-[11px] text-amber-600">MATCH 유형은 하이라이트를 최소 3개 이상 선택해야 합니다.</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">태그 (쉼표 구분)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder="조선, 세종, 훈민정음"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
        </section>

        <section className="space-y-4">
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
                  {type}
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

          <fieldset className="space-y-2 rounded border border-slate-200 p-3">
            <legend className="text-xs font-semibold text-slate-600">분류(Taxonomy)</legend>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">시대(era)</label>
                <input
                  type="text"
                  value={taxonomyEra}
                  onChange={(event) => setTaxonomyEra(event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">세부 시대(sub_era)</label>
                <input
                  type="text"
                  value={taxonomySubEra}
                  onChange={(event) => setTaxonomySubEra(event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">주제(topic)</label>
                <input
                  type="text"
                  value={taxonomyTopic}
                  onChange={(event) => setTaxonomyTopic(event.target.value)}
                  placeholder="쉼표 구분"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">핵심 인물(entity)</label>
                <input
                  type="text"
                  value={taxonomyEntity}
                  onChange={(event) => setTaxonomyEntity(event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">지역(region)</label>
                <input
                  type="text"
                  value={taxonomyRegion}
                  onChange={(event) => setTaxonomyRegion(event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">키워드(keywords)</label>
                <input
                  type="text"
                  value={taxonomyKeywords}
                  onChange={(event) => setTaxonomyKeywords(event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-2 rounded border border-slate-200 p-3">
            <legend className="text-xs font-semibold text-slate-600">연표(Chronology)</legend>
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">시작 연도</label>
                <input
                  type="text"
                  value={startYear}
                  onChange={(event) => setStartYear(event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">종료 연도</label>
                <input
                  type="text"
                  value={endYear}
                  onChange={(event) => setEndYear(event.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">주요 사건 (줄마다 "연도,설명")</label>
              <textarea
                value={eventsInput}
                onChange={(event) => setEventsInput(event.target.value)}
                rows={4}
                placeholder="예)\n1443,훈민정음 창제"
                className="w-full rounded border border-slate-300 px-3 py-2 text-xs focus:border-primary-500 focus:outline-none"
              />
            </div>
          </fieldset>

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
        </section>
      </form>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {generateResult ? (
        <section className="space-y-3 rounded border border-slate-200 p-4">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-primary-600">생성 결과</h2>
            <div className="text-xs text-slate-600">
              <span className="mr-3">cached: {generateResult.meta.cached ? 'yes' : 'no'}</span>
              <span className="mr-3">tokens in: {generateResult.meta.tokens_in}</span>
              <span className="mr-3">tokens out: {generateResult.meta.tokens_out}</span>
              <span>latency: {generateResult.meta.latency_ms}ms</span>
            </div>
          </header>
          <div className="grid gap-3 lg:grid-cols-2">
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
        </section>
      ) : null}

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
