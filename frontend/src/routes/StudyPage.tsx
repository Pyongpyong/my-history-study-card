import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  fetchContent,
  fetchContentCards,
  fetchStudySession,
  updateStudySessionRequest,
  type StudySessionCard,
  type Reward,
} from '../api';
import CardRunner from '../components/CardRunner';
import ProgressBar from '../components/ProgressBar';
import { getQuizTypeLabel } from '../utils/quiz';
import { useAuth } from '../context/AuthContext';

interface QuizResult {
  correct: boolean;
}

export default function StudyPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [content, setContent] = useState<any | null>(null);
  const [cards, setCards] = useState<StudySessionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [completed, setCompleted] = useState(false);
  const [sessionRewards, setSessionRewards] = useState<Reward[]>([]);
  const [sessionTags, setSessionTags] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      if (sessionId && !user) {
        navigate('/auth', { state: { from: location } });
        return;
      }
      setLoading(true);
      setError(null);
      try {
        if (sessionId) {
          const session = await fetchStudySession(sessionId);
          const cardsFromSession = Array.isArray(session.cards)
            ? session.cards.map((card: any) => ({
                ...card,
                attempts: typeof card?.attempts === 'number' ? card.attempts : 0,
                correct: typeof card?.correct === 'number' ? card.correct : 0,
              }))
            : [];
          setSessionRewards(session.rewards ?? []);
          setSessionTags(session.tags ?? []);
          if (!cardsFromSession.length) {
            setError('선택된 카드가 없습니다. 학습 리스트에서 세트를 다시 생성해주세요.');
            setContent({ title: session.title?.trim() || '학습 세트', created_at: session.created_at, content: '' });
            setCards([]);
          } else {
            const contentIds = cardsFromSession
              .map((card: any) => card.content_id)
              .filter((value: any, idx: number, arr: any[]) => value && arr.indexOf(value) === idx);
            setContent({
              title: session.title?.trim() || '학습 세트',
              created_at: session.created_at,
              content: '',
              contentIds,
            });
            setCards(cardsFromSession);
          }
        } else {
          const [detail, cardList] = await Promise.all([fetchContent(id), fetchContentCards(id)]);
          setContent(detail);
          setCards(
            cardList.map((card: any) => ({
              ...card,
              attempts: typeof card?.attempts === 'number' ? card.attempts : 0,
              correct: typeof card?.correct === 'number' ? card.correct : 0,
            })),
          );
          setSessionRewards([]);
          setSessionTags([]);
        }
        setIndex(0);
        setSubmitted(false);
        setLastCorrect(null);
        setResults([]);
        setCompleted(false);
      } catch (err: any) {
        console.error(err);
        const message = err?.response?.data?.detail ?? err?.message ?? '학습 데이터를 불러오지 못했습니다.';
        setError(typeof message === 'string' ? message : JSON.stringify(message));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, sessionId, user, location, navigate]);

  const score = useMemo(() => results.filter((item) => item?.correct).length, [results]);

  const hasSyncedResult = useRef(false);

  const handleSubmit = (correct: boolean) => {
    if (submitted) return;
    setSubmitted(true);
    setLastCorrect(correct);
    setCards((prevCards) =>
      prevCards.map((card, cardIndex) => {
        if (cardIndex !== index) {
          return card;
        }
        const attempts = typeof card?.attempts === 'number' ? card.attempts + 1 : 1;
        const correctCount = typeof card?.correct === 'number' ? card.correct + (correct ? 1 : 0) : correct ? 1 : 0;
        return { ...card, attempts, correct: correctCount };
      }),
    );
    setResults((prev) => {
      const next = [...prev];
      next[index] = { correct };
      return next;
    });
    setCompleted(false);
  };

  const handleNext = async () => {
    if (index + 1 >= cards.length) {
      const finalResults = [...results];
      finalResults[index] = { correct: lastCorrect ?? false };
      setResults(finalResults);
      setSubmitted(true);
      setLastCorrect(null);
      setCompleted(true);
      return;
    }
    setIndex((prev) => prev + 1);
    setSubmitted(false);
    setLastCorrect(null);
    setCompleted(false);
  };

  const finished = completed;
  const currentCard = cards[Math.min(index, cards.length - 1)];
  const cardsCount = cards.length;

  useEffect(() => {
    if (!sessionId || !user) {
      return;
    }
    if (!completed) {
      hasSyncedResult.current = false;
      return;
    }
    if (hasSyncedResult.current) {
      return;
    }
    if (!cardsCount) {
      return;
    }
    const finalScore = results.filter((item) => item?.correct).length;
    hasSyncedResult.current = true;
    updateStudySessionRequest(sessionId, {
      score: finalScore,
      total: cardsCount,
      completed_at: new Date().toISOString(),
      cards: cards.map((card) => {
        const { attempts = 0, correct = 0, ...rest } = card ?? {};
        return { ...rest, attempts, correct };
      }),
    })
      .then((updated) => {
        setSessionRewards(updated.rewards ?? []);
      })
      .catch((err) => {
        console.error('학습 결과 저장 실패', err);
        hasSyncedResult.current = false;
      });
  }, [sessionId, completed, cardsCount, cards, results, user]);

  if (!id) {
    return <p className="text-sm text-rose-600">잘못된 경로입니다.</p>;
  }

  if (loading) {
    return <p className="text-sm text-slate-600">불러오는 중…</p>;
  }

  if (error || !content) {
    return <p className="text-sm text-rose-600">{error ?? '콘텐츠를 찾을 수 없습니다.'}</p>;
  }

  if (!cards.length) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">학습할 카드가 없습니다.</p>
        {sessionId ? (
          <button
            type="button"
            onClick={() => navigate('/studies', { state: { refresh: Date.now() } })}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            학습 리스트로 돌아가기
          </button>
        ) : (
          <Link to={`/contents/${id}`} className="text-sm text-primary-600 hover:text-primary-700">
            콘텐츠 상세로 돌아가기
          </Link>
        )}
      </div>
    );
  }

  if (finished) {
    return (
      <section className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
        <h2 className="text-2xl font-semibold text-primary-600">학습 완료!</h2>
        <p className="text-sm text-slate-700">
          점수: {score} / {cards.length}
        </p>
        <div className="text-sm text-slate-600">
          {cards.map((card, idx) => (
            <div
              key={`${card.type}-${idx}`}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 py-2 text-xs"
            >
              <span>{idx + 1}. {getQuizTypeLabel(card.type)}</span>
              <span className={results[idx]?.correct ? 'text-emerald-600' : 'text-rose-600'}>
                {results[idx]?.correct ? '정답' : '오답'}
              </span>
              <span className="text-slate-500">시도 {card?.attempts ?? 0} · 정답 {card?.correct ?? 0}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setIndex(0);
              setResults([]);
              setSubmitted(false);
              setLastCorrect(null);
              setCompleted(false);
            }}
            className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
          >
            다시 학습하기
          </button>
          {sessionId ? (
            <button
              type="button"
              onClick={() => navigate('/studies', { state: { refresh: Date.now() } })}
              className="rounded border border-primary-500 px-4 py-2 text-sm font-semibold text-primary-600 transition hover:bg-primary-50"
            >
              학습 리스트로 돌아가기
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 rounded-lg border border-slate-200 bg-white p-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary-600">학습 중: {content.title}</h2>
          {sessionId ? (
            content.contentIds?.length === 1 && content.contentIds[0] > 0 ? (
              <Link
                to={`/contents/${content.contentIds[0]}`}
                className="text-xs text-primary-600 hover:text-primary-700"
              >
                관련 콘텐츠 보기
              </Link>
            ) : (
              <Link to="/studies" className="text-xs text-primary-600 hover:text-primary-700">
                학습 리스트로 돌아가기
              </Link>
            )
          ) : (
            <Link to={`/contents/${id}`} className="text-xs text-primary-600 hover:text-primary-700">
              콘텐츠 보기
            </Link>
          )}
        </div>
        <p className="text-xs uppercase tracking-wide text-slate-500">
          진행도 {index + 1} / {cards.length}
        </p>
        {sessionTags.length ? (
          <div className="text-xs text-slate-600">
            <p className="font-semibold text-primary-600">학습 태그</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {sessionTags.map((tag) => (
                <span key={tag} className="rounded border border-primary-500/40 bg-primary-50 px-2 py-1">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {sessionRewards.length ? (
          <div className="text-xs text-slate-600">
            <p className="font-semibold text-primary-600">보상</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {sessionRewards.map((reward) => (
                <span key={reward.id} className="rounded border border-slate-300 bg-slate-50 px-2 py-1">
                  {reward.title} · {reward.duration}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        <p className="text-xs text-slate-500">
          시도: {currentCard?.attempts ?? 0}회 · 정답: {currentCard?.correct ?? 0}회
        </p>
        <ProgressBar current={index + (submitted ? 1 : 0)} total={cards.length} />
      </header>
      <CardRunner card={currentCard} disabled={submitted} onSubmit={handleSubmit} />
      {submitted ? (
        <div className="rounded border border-slate-200 bg-slate-100 p-4 text-sm">
          <p className={lastCorrect ? 'text-emerald-600' : 'text-rose-600'}>
            {lastCorrect ? '정답입니다!' : '틀렸습니다.'}
          </p>
          {currentCard.explain ? <p className="mt-2 text-slate-700">{currentCard.explain}</p> : null}
          <button
            type="button"
            onClick={handleNext}
            className="mt-4 rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
          >
            {index + 1 >= cards.length ? '결과 보기' : '다음 문제'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
