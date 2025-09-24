import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CardPreview from '../components/CardPreview';
import ContentSnapshot from '../components/ContentSnapshot';
import QuizForm from '../components/QuizForm';
import {
  fetchContent,
  fetchQuiz,
  updateQuizRequest,
  type ContentDetail,
  type QuizItem,
  type Visibility,
} from '../api';
import { getQuizTypeLabel } from '../utils/quiz';

function ensureStringArray(value: any, fallback: string[] = []): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : fallback;
}

function ensureStringRecord(value: any): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const result: Record<string, string> = {};
  Object.entries(value).forEach(([key, val]) => {
    if (typeof val === 'string') {
      result[key] = val;
    }
  });
  return result;
}

function buildInitialPayload(quiz: QuizItem): Record<string, any> {
  const payload = quiz.payload ?? {};
  const tags = ensureStringArray((payload as any).tags, []);
  const explain = typeof (payload as any).explain === 'string' ? (payload as any).explain : '';

  switch (quiz.type) {
    case 'MCQ':
      return {
        question: typeof (payload as any).question === 'string' ? (payload as any).question : '',
        options: ensureStringArray((payload as any).options, ['', '', '', '']),
        answer_index: typeof (payload as any).answer_index === 'number' ? (payload as any).answer_index : 0,
        explain,
        tags,
      };
    case 'SHORT':
      return {
        prompt: typeof (payload as any).prompt === 'string' ? (payload as any).prompt : '',
        answer: typeof (payload as any).answer === 'string' ? (payload as any).answer : '',
        explain,
        tags,
        rubric:
          (payload as any).rubric && Array.isArray((payload as any).rubric?.aliases)
            ? { aliases: ensureStringArray((payload as any).rubric.aliases) }
            : undefined,
      };
    case 'OX':
      return {
        statement: typeof (payload as any).statement === 'string' ? (payload as any).statement : '',
        answer: typeof (payload as any).answer === 'boolean' ? (payload as any).answer : true,
        explain,
        tags,
      };
    case 'CLOZE':
      return {
        text: typeof (payload as any).text === 'string' ? (payload as any).text : '',
        clozes: ensureStringRecord((payload as any).clozes),
        explain,
        tags,
      };
    case 'ORDER':
      return {
        items: ensureStringArray((payload as any).items, ['']),
        explain,
        tags,
      };
    case 'MATCH': {
      const left = ensureStringArray((payload as any).left, ['']);
      let right = ensureStringArray((payload as any).right, []);
      if (!left.length) {
        left.push('');
      }
      if (right.length < left.length) {
        right = [...right, ...Array(left.length - right.length).fill('')];
      }
      if (!right.length) {
        right.push('');
      }
      return {
        left,
        right,
        explain,
        tags,
      };
    }
    default:
      return {};
  }
}

export default function QuizEditPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<QuizItem | null>(null);
  const [content, setContent] = useState<ContentDetail | null>(null);
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
        const quizItem = await fetchQuiz(id);
        setQuiz(quizItem);
        setVisibility(quizItem.visibility);
        try {
          const detail = await fetchContent(quizItem.content_id);
          setContent(detail);
        } catch (contentErr) {
          console.error(contentErr);
          setContent(null);
        }
      } catch (err: any) {
        console.error(err);
        const message = err?.response?.data?.detail ?? '퀴즈 정보를 불러오지 못했습니다.';
        setError(typeof message === 'string' ? message : JSON.stringify(message));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const initialPayload = useMemo(() => {
    if (!quiz) return null;
    return buildInitialPayload(quiz);
  }, [quiz]);

  const keywordOptions = useMemo(() => {
    const base = content?.keywords ?? [];
    const set = new Set<string>();
    base.forEach((keyword) => {
      if (typeof keyword !== 'string') return;
      const trimmed = keyword.trim();
      if (trimmed) {
        set.add(trimmed);
      }
    });
    if (initialPayload && Array.isArray((initialPayload as any).tags)) {
      (initialPayload as any).tags.forEach((tag: unknown) => {
        if (typeof tag !== 'string') return;
        const trimmed = tag.trim();
        if (trimmed) {
          set.add(trimmed);
        }
      });
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [content, initialPayload]);

  const previewCard = useMemo(() => {
    if (!quiz) return null;
    return {
      ...quiz.payload,
      id: quiz.id,
      type: quiz.type,
      content_id: quiz.content_id,
      created_at: quiz.created_at,
      visibility: quiz.visibility,
    };
  }, [quiz]);

  const handleSubmit = async (payload: Record<string, any>) => {
    if (!id || !quiz) return;
    setSubmitting(true);
    try {
      await updateQuizRequest(id, { ...payload, visibility });
      alert('퀴즈가 수정되었습니다.');
      const contentParam = searchParams.get('content');
      const targetContentId = contentParam ?? String(quiz.content_id);
      navigate(`/contents/${targetContentId}`, { replace: true, state: { refresh: Date.now() } });
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '퀴즈를 수정하지 못했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-600">불러오는 중…</p>;
  }

  if (error || !quiz) {
    return <p className="text-sm text-rose-600">{error ?? '퀴즈를 찾을 수 없습니다.'}</p>;
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
        <h1 className="text-2xl font-semibold text-primary-600">퀴즈 수정</h1>
        <p className="text-sm text-slate-500">
          형식: {getQuizTypeLabel(quiz.type)} ( {quiz.type} )
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
          type={quiz.type}
          initial={initialPayload}
          submitLabel="퀴즈 수정"
          onSubmit={handleSubmit}
          keywordOptions={keywordOptions}
        />
      </div>

      <section className="space-y-6 rounded-lg border border-slate-200 bg-slate-50 p-6">
        <header className="space-y-2">
          <h2 className="text-lg font-semibold text-primary-600">관련 정보</h2>
          <p className="text-xs text-slate-500">수정 시 참고용으로 콘텐츠/퀴즈 미리보기 정보를 제공합니다.</p>
        </header>
        {content ? (
          <ContentSnapshot content={content} />
        ) : (
          <p className="text-xs text-slate-500">콘텐츠 정보를 불러오지 못했습니다.</p>
        )}
        {previewCard ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-primary-600">현재 퀴즈</h3>
            <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <CardPreview card={previewCard} />
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
