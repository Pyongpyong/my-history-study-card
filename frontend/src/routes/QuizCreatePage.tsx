import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CardPreview from '../components/CardPreview';
import QuizForm from '../components/QuizForm';
import {
  createQuizForContent,
  fetchContent,
  fetchContentCards,
  type ContentDetail,
  type QuizItem,
  type QuizType,
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

export default function QuizCreatePage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const quizTypeParam = (searchParams.get('type') ?? '').toUpperCase();
  const quizType = quizTypeParam as QuizType;
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [cards, setCards] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const [detail, cardList] = await Promise.all([fetchContent(id), fetchContentCards(id)]);
        setContent(detail);
        setCards(cardList);
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

  const handleSubmit = async (payload: Record<string, any>) => {
    if (!id) return;
    setSubmitting(true);
    try {
      await createQuizForContent(id, payload);
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
        <p className="text-sm text-rose-400">지원하지 않는 퀴즈 형식입니다.</p>
        <Link to={`/contents/${id}`} className="text-sm text-primary-300 hover:text-primary-200">
          콘텐츠 상세로 돌아가기
        </Link>
      </section>
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-300">불러오는 중…</p>;
  }

  if (error || !content) {
    return <p className="text-sm text-rose-400">{error ?? '콘텐츠를 찾을 수 없습니다.'}</p>;
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
        <h1 className="text-2xl font-semibold text-primary-300">퀴즈 만들기</h1>
        <p className="text-sm text-slate-400">
          형식: {quizTypeLabels[quizType]} ( {quizType} )
        </p>
        {submitting ? (
          <p className="text-xs text-primary-300">저장 중…</p>
        ) : null}
      </header>

      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
        <QuizForm type={quizType} onSubmit={handleSubmit} />
      </div>

      <section className="space-y-6 rounded-lg border border-slate-800 bg-slate-900/60 p-6">
        <header className="space-y-2">
          <h2 className="text-lg font-semibold text-primary-200">콘텐츠 정보</h2>
          <p className="text-xs text-slate-400">새 퀴즈를 작성할 때 참고하세요.</p>
        </header>
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
        {cards.length ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-primary-200">기존 퀴즈 미리보기</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => (
                <div key={card.id} className="space-y-2 rounded border border-slate-800 bg-slate-900/70 p-4 text-xs">
                  <CardPreview card={card} />
                  <p className="text-[11px] text-slate-400">
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
