import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createContentRequest } from '../api';

function parseList(value: string): string[] {
  return Array.from(new Set(value.split('\n').map((item) => item.trim()).filter(Boolean)));
}

export default function ContentCreatePage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [highlights, setHighlights] = useState('');
  const [chronologyStart, setChronologyStart] = useState('');
  const [chronologyEnd, setChronologyEnd] = useState('');
  const [chronologyEvents, setChronologyEvents] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      alert('제목과 본문을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        title: title.trim(),
        content: body.trim(),
        tags: parseList(tags.replace(/,/g, '\n')),
        highlights: parseList(highlights),
        cards: [],
      };
      const eventsList = parseList(chronologyEvents).map((line) => {
        const [yearPart, ...labelParts] = line.split(':');
        const year = Number(yearPart.trim());
        const label = labelParts.join(':').trim();
        if (Number.isNaN(year) || !label) return null;
        return { year, label };
      }).filter(Boolean);
      if (chronologyStart || chronologyEnd || eventsList.length) {
        payload.chronology = {
          start_year: chronologyStart ? Number(chronologyStart) : undefined,
          end_year: chronologyEnd ? Number(chronologyEnd) : undefined,
          events: eventsList,
        };
      }
      const contentId = await createContentRequest(payload);
      alert('콘텐츠가 생성되었습니다.');
      navigate(`/contents/${contentId}`);
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '콘텐츠를 생성하지 못했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-xs text-primary-300 hover:text-primary-200"
        >
          ← 이전으로
        </button>
        <h1 className="text-2xl font-semibold text-primary-300">콘텐츠 추가</h1>
        <p className="text-sm text-slate-400">학습에 사용할 콘텐츠를 등록합니다.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/70 p-6">
        <label className="flex flex-col gap-2 text-sm text-slate-300">
          제목
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-300">
          본문
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="h-64 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            required
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-300">
          태그 (쉼표 또는 줄바꿈으로 구분)
          <textarea
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            className="h-20 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="예) 조선, 왕, 역사"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-slate-300">
          하이라이트 (줄바꿈으로 구분)
          <textarea
            value={highlights}
            onChange={(event) => setHighlights(event.target.value)}
            className="h-24 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder={'예) 세조\n경국대전'}
          />
        </label>

        <fieldset className="space-y-3 rounded border border-slate-800 p-4">
          <legend className="px-2 text-sm font-semibold text-primary-200">연표 (선택)</legend>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-xs text-slate-300">
              시작 연도
              <input
                type="number"
                value={chronologyStart}
                onChange={(event) => setChronologyStart(event.target.value)}
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs text-slate-300">
              종료 연도
              <input
                type="number"
                value={chronologyEnd}
                onChange={(event) => setChronologyEnd(event.target.value)}
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>
          </div>
          <label className="flex flex-col gap-2 text-xs text-slate-300">
            사건 목록 (한 줄에 "연도: 설명" 형식)
            <textarea
              value={chronologyEvents}
              onChange={(event) => setChronologyEvents(event.target.value)}
              className="h-32 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder={'예) 1455: 단종 폐위\n1460: 경국대전 편찬 추진'}
            />
          </label>
        </fieldset>

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-700"
        >
          {submitting ? '생성 중…' : '콘텐츠 만들기'}
        </button>
      </form>
    </section>
  );
}
