import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import CardPreview from '../components/CardPreview';
import ContentSnapshot from '../components/ContentSnapshot';
import QuizForm from '../components/QuizForm';
import {
  createQuizForContent,
  fetchContent,
  fetchContentCards,
  type ContentDetail,
  type QuizItem,
  type QuizType,
  type Visibility,
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
  const [visibility, setVisibility] = useState<Visibility>('PRIVATE');

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
          형식: {quizTypeLabels[quizType]} ( {quizType} )
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
