import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchContent, updateContentRequest, type ContentDetail, type EraEntry, type TimelineEntry, type Visibility } from '../api';

function normalizeEntry(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export default function ContentEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [timelinePeriodInput, setTimelinePeriodInput] = useState('');
  const [timelineDescriptionInput, setTimelineDescriptionInput] = useState('');
  const [timelineEntries, setTimelineEntries] = useState<TimelineEntry[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [eraPeriodInput, setEraPeriodInput] = useState('');
  const [eraDetailInput, setEraDetailInput] = useState('');
  const [eraEntries, setEraEntries] = useState<EraEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('PRIVATE');

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
  };

  const handleKeywordKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addKeyword();
    }
  };

  const removeKeyword = (target: string) => {
    setKeywords((prev) => prev.filter((item) => item !== target));
  };

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const detail = await fetchContent(id);
        setContent(detail);
        setTitle(detail.title);
        setBody(detail.content);
        setKeywords(detail.keywords ?? []);
        setTimelineEntries(detail.timeline ?? []);
        setCategories(detail.categories ?? []);
        setEraEntries(detail.eras ? detail.eras.map((entry) => ({ ...entry })) : []);
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

  const updateTimelineEntry = (index: number, updates: Partial<TimelineEntry>) => {
    setTimelineEntries((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item)),
    );
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

  const updateEraEntry = (index: number, updates: Partial<EraEntry>) => {
    setEraEntries((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item)),
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!id) return;
    if (!title.trim() || !body.trim()) {
      alert('제목과 본문을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        title: title.trim(),
        content: body.trim(),
        keywords,
        highlights: [],
        timeline: timelineEntries,
        cards: [],
        visibility,
        categories,
      };
      payload.eras = eraEntries;
      await updateContentRequest(id, payload);
      alert('콘텐츠가 수정되었습니다.');
      navigate(`/contents/${id}`);
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '콘텐츠를 수정하지 못했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setSubmitting(false);
    }
  };

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
        <h1 className="text-2xl font-semibold text-primary-600">콘텐츠 수정</h1>
        <p className="text-sm text-slate-500">콘텐츠 정보를 수정합니다.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <label className="flex flex-col gap-2 text-sm text-slate-600">
          제목
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-600">
          본문
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="h-64 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-600">
          키워드 추가
          <div className="flex gap-2">
            <input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={handleKeywordKeyDown}
              className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
        </label>

        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>타임라인</span>
            <span className="text-xs text-slate-400">(Ctrl/⌘ + Enter 로 빠르게 추가)</span>
          </div>
          <div className="flex flex-col gap-2 rounded border border-slate-200 p-4">
            <div className="grid gap-2 md:grid-cols-[200px_1fr_auto]">
              <input
                value={timelinePeriodInput}
                onChange={(event) => setTimelinePeriodInput(event.target.value)}
                onKeyDown={handleTimelineKeyDown}
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="연도/기간 (예: 1392년, 14세기, 1392~1400년)"
              />
              <textarea
                value={timelineDescriptionInput}
                onChange={(event) => setTimelineDescriptionInput(event.target.value)}
                onKeyDown={handleTimelineKeyDown}
                className="h-20 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                    key={`timeline-entry-${index}`}
                    className="flex items-start justify-between gap-3 rounded border border-slate-200 bg-white p-3 text-xs text-slate-700"
                  >
                    <div className="flex-1 space-y-2">
                      <input
                        value={entry.title}
                        onChange={(event) => updateTimelineEntry(index, { title: event.target.value })}
                        className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="연도/기간"
                      />
                      <textarea
                        value={entry.description ?? ''}
                        onChange={(event) => updateTimelineEntry(index, { description: event.target.value })}
                        className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="설명"
                        rows={2}
                      />
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

        <label className="flex flex-col gap-2 text-sm text-slate-600">
          분류 추가
          <div className="flex gap-2">
            <input
              value={categoryInput}
              onChange={(event) => setCategoryInput(event.target.value)}
              onKeyDown={handleCategoryKeyDown}
              className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
        </label>

        <div className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center justify-between">
            <span>연대 · 세부 연대</span>
            <span className="text-xs text-slate-400">(Ctrl/⌘ + Enter 로 빠르게 추가)</span>
          </div>
          <div className="flex flex-col gap-2 rounded border border-slate-200 p-4">
            <div className="grid gap-2 md:grid-cols-[220px_1fr_auto]">
              <input
                value={eraPeriodInput}
                onChange={(event) => setEraPeriodInput(event.target.value)}
                onKeyDown={handleEraKeyDown}
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="연대 (예: 고려 말기부터 조선 초기)"
              />
              <textarea
                value={eraDetailInput}
                onChange={(event) => setEraDetailInput(event.target.value)}
                onKeyDown={handleEraKeyDown}
                className="h-20 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
                    key={`era-entry-${index}`}
                    className="flex items-start justify-between gap-3 rounded border border-slate-200 bg-white p-3 text-xs text-slate-700"
                  >
                    <div className="flex-1 space-y-2">
                      <input
                        value={entry.period}
                        onChange={(event) => updateEraEntry(index, { period: event.target.value })}
                        className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="연대"
                      />
                      <textarea
                        value={entry.detail ?? ''}
                        onChange={(event) => updateEraEntry(index, { detail: event.target.value })}
                        className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        placeholder="세부 연대"
                        rows={2}
                      />
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

        <label className="flex flex-col gap-2 text-sm text-slate-600">
          공개 범위
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as Visibility)}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="PRIVATE">비공개 (나만 보기)</option>
            <option value="PUBLIC">공개 (모두 보기)</option>
          </select>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? '수정 중…' : '콘텐츠 수정'}
        </button>
      </form>
    </section>
  );
}
