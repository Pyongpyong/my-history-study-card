import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CardPreview from '../components/CardPreview';
import QuizForm from '../components/QuizForm';
import {
  fetchContent,
  fetchQuiz,
  updateQuizRequest,
  type ContentDetail,
  type QuizItem,
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

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const quizItem = await fetchQuiz(id);
        setQuiz(quizItem);
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

  const previewCard = useMemo(() => {
    if (!quiz) return null;
    return {
      ...quiz.payload,
      id: quiz.id,
      type: quiz.type,
      content_id: quiz.content_id,
      created_at: quiz.created_at,
    };
  }, [quiz]);

  const handleSubmit = async (payload: Record<string, any>) => {
    if (!id || !quiz) return;
    setSubmitting(true);
    try {
      await updateQuizRequest(id, payload);
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
    return <p className="text-sm text-slate-300">불러오는 중…</p>;
  }

  if (error || !quiz) {
    return <p className="text-sm text-rose-400">{error ?? '퀴즈를 찾을 수 없습니다.'}</p>;
  }

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
        <h1 className="text-2xl font-semibold text-primary-300">퀴즈 수정</h1>
        <p className="text-sm text-slate-400">
          형식: {getQuizTypeLabel(quiz.type)} ( {quiz.type} )
        </p>
        {submitting ? (
          <p className="text-xs text-primary-300">저장 중…</p>
        ) : null}
      </header>

      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
        <QuizForm type={quiz.type} initial={initialPayload} submitLabel="퀴즈 수정" onSubmit={handleSubmit} />
      </div>

      <section className="space-y-6 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <header className="space-y-2">
          <h2 className="text-lg font-semibold text-primary-200">관련 정보</h2>
          <p className="text-xs text-slate-400">수정 시 참고용으로 콘텐츠/퀴즈 미리보기 정보를 제공합니다.</p>
        </header>
        {content ? (
          <article className="space-y-4 text-sm leading-relaxed text-slate-200">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-semibold text-primary-300">{content.title}</h3>
              <span className="text-xs text-slate-400">{new Date(content.created_at).toLocaleString()}</span>
            </div>
            <p className="whitespace-pre-wrap">{content.content}</p>
            {content.highlights?.length ? (
              <div className="flex flex-wrap gap-2">
                {content.highlights.map((highlight) => (
                  <span key={highlight} className="rounded bg-primary-500/20 px-3 py-1 text-xs text-primary-200">
                    {highlight}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ) : (
          <p className="text-xs text-slate-400">콘텐츠 정보를 불러오지 못했습니다.</p>
        )}
        {previewCard ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-primary-200">현재 퀴즈</h3>
            <div className="rounded border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
              <CardPreview card={previewCard} />
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
