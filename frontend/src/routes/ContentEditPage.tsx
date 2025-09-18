import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchContent, updateContentRequest, type ContentDetail, type Visibility } from '../api';

function listToTextarea(values: string[] | undefined): string {
  return (values ?? []).join('\n');
}

export default function ContentEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [highlightsInput, setHighlightsInput] = useState('');
  const [chronologyStart, setChronologyStart] = useState('');
  const [chronologyEnd, setChronologyEnd] = useState('');
  const [chronologyEvents, setChronologyEvents] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('PRIVATE');

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
        setTagsInput(listToTextarea(detail.tags));
        setHighlightsInput(listToTextarea(detail.highlights));
        setChronologyStart(detail.chronology?.start_year ? String(detail.chronology.start_year) : '');
        setChronologyEnd(detail.chronology?.end_year ? String(detail.chronology.end_year) : '');
        if (detail.chronology?.events?.length) {
          setChronologyEvents(
            detail.chronology.events.map((event) => `${event.year}: ${event.label}`).join('\n'),
          );
        } else {
          setChronologyEvents('');
        }
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

  const tags = useMemo(
    () => Array.from(new Set(tagsInput.split(/\n|,/).map((item) => item.trim()).filter(Boolean))),
    [tagsInput],
  );

  const highlights = useMemo(
    () => highlightsInput.split('\n').map((item) => item.trim()).filter(Boolean),
    [highlightsInput],
  );

  const eventsList = useMemo(() => {
    return chronologyEvents
      .split('\n')
      .map((line) => {
        const [yearPart, ...labelParts] = line.split(':');
        const year = Number(yearPart.trim());
        const label = labelParts.join(':').trim();
        if (!yearPart || Number.isNaN(year) || !label) {
          return null;
        }
        return { year, label };
      })
      .filter(Boolean) as Array<{ year: number; label: string }>;
  }, [chronologyEvents]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!id) return;
    if (!title.trim() || !body.trim()) {
      alert('제목과 본문을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        content: body.trim(),
        tags,
        highlights,
        visibility,
      };
      const startYear = chronologyStart ? Number(chronologyStart) : null;
      const endYear = chronologyEnd ? Number(chronologyEnd) : null;
      const hasChronology = Boolean(chronologyStart || chronologyEnd || eventsList.length);
      if (hasChronology) {
        payload.chronology = {
          start_year: startYear ?? undefined,
          end_year: endYear ?? undefined,
          events: eventsList,
        };
      } else {
        payload.chronology = null;
      }
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
          태그 (쉼표 또는 줄바꿈으로 구분)
          <textarea
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            className="h-20 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-600">
          하이라이트 (줄바꿈으로 구분)
          <textarea
            value={highlightsInput}
            onChange={(event) => setHighlightsInput(event.target.value)}
            className="h-24 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </label>

        <fieldset className="space-y-3 rounded border border-slate-200 p-4">
          <legend className="px-2 text-sm font-semibold text-primary-600">연표 (선택)</legend>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs text-slate-600">
              시작 연도
              <input
                type="number"
                value={chronologyStart}
                onChange={(event) => setChronologyStart(event.target.value)}
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs text-slate-600">
              종료 연도
              <input
                type="number"
                value={chronologyEnd}
                onChange={(event) => setChronologyEnd(event.target.value)}
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>
          </div>
          <label className="flex flex-col gap-2 text-xs text-slate-600">
            사건 목록 (한 줄에 "연도: 설명" 형식)
            <textarea
              value={chronologyEvents}
              onChange={(event) => setChronologyEvents(event.target.value)}
              className="h-32 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder={'예) 1455: 단종 폐위\n1460: 경국대전 편찬 추진'}
            />
          </label>
        </fieldset>

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

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
            disabled={submitting}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? '수정 중…' : '콘텐츠 수정'}
          </button>
        </div>
      </form>
    </section>
  );
}
