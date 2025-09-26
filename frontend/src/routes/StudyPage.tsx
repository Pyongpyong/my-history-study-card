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
import { buildTeacherFilename, getTeacherAssetUrl } from '../utils/assets';
import { useAuth } from '../context/AuthContext';

type TeacherMood = 'idle' | 'correct' | 'incorrect';

const teacherVariants = Array.from({ length: 12 }, (_, index) => ({
  idle: getTeacherAssetUrl(buildTeacherFilename(index)),
  correct: getTeacherAssetUrl(buildTeacherFilename(index, '_o')),
  incorrect: getTeacherAssetUrl(buildTeacherFilename(index, '_x')),
}));

// 퀴즈 타입별 배경색 정의
const getQuizTypeColor = (type: string) => {
  switch (type) {
    case 'MCQ': return 'bg-gradient-to-br from-blue-100 to-blue-200 border-blue-300';
    case 'SHORT': return 'bg-gradient-to-br from-green-100 to-green-200 border-green-300';
    case 'OX': return 'bg-gradient-to-br from-purple-100 to-purple-200 border-purple-300';
    case 'CLOZE': return 'bg-gradient-to-br from-yellow-100 to-yellow-200 border-yellow-300';
    case 'ORDER': return 'bg-gradient-to-br from-pink-100 to-pink-200 border-pink-300';
    case 'MATCH': return 'bg-gradient-to-br from-indigo-100 to-indigo-200 border-indigo-300';
    default: return 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-300';
  }
};

interface QuizResult {
  correct: boolean;
}

export default function StudyPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refresh } = useAuth();
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
  const [teacherVariantIndex, setTeacherVariantIndex] = useState(() =>
    Math.floor(Math.random() * teacherVariants.length),
  );
  const [teacherMood, setTeacherMood] = useState<TeacherMood>('idle');
  const currentTeacherImage =
    teacherVariants[teacherVariantIndex]?.[teacherMood] ?? teacherVariants[0].idle;

  const userId = user?.id;

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      if (sessionId && !userId) {
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
        // 랜덤 teacher 이미지 선택
        const randomIndex = Math.floor(Math.random() * teacherVariants.length);
        setTeacherVariantIndex(randomIndex);
        setTeacherMood('idle');
      } catch (err: any) {
        console.error(err);
        const message = err?.response?.data?.detail ?? err?.message ?? '학습 데이터를 불러오지 못했습니다.';
        setError(typeof message === 'string' ? message : JSON.stringify(message));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, sessionId, userId, location, navigate]);

  const score = useMemo(() => results.filter((item) => item?.correct).length, [results]);

  const hasSyncedResult = useRef(false);

  const handleSubmit = (correct: boolean) => {
    if (submitted) return;
    const targetCard = cards[index];
    const updatedCards = cards.map((card, cardIndex) => {
      if (cardIndex !== index) {
        return card;
      }
      const attempts = typeof card?.attempts === 'number' ? card.attempts + 1 : 1;
      const correctCount = typeof card?.correct === 'number' ? card.correct + (correct ? 1 : 0) : correct ? 1 : 0;
      return { ...card, attempts, correct: correctCount };
    });
    setSubmitted(true);
    setLastCorrect(correct);
    setCards(updatedCards);
    setResults((prev) => {
      const next = [...prev];
      next[index] = { correct };
      return next;
    });
    setCompleted(false);
    setTeacherMood(correct ? 'correct' : 'incorrect');

    if (!sessionId || !user) {
      return;
    }

    const answerPayload: Record<number, boolean> = {};
    if (targetCard && typeof targetCard.id === 'number') {
      answerPayload[targetCard.id] = correct;
    }

    const normalizedCards = updatedCards.map((card) => {
      const { attempts = 0, correct: correctCount = 0, ...rest } = card ?? {};
      return { ...rest, attempts, correct: correctCount };
    });

    updateStudySessionRequest(sessionId, {
      cards: normalizedCards,
      ...(Object.keys(answerPayload).length ? { answers: answerPayload } : {}),
    })
      .then(async () => {
        try {
          await refresh();
        } catch (err) {
          console.error('사용자 정보 갱신 실패', err);
        }
      })
      .catch((err) => {
        console.error('실시간 학습 결과 저장 실패', err);
      });
  };

  const handleNext = async () => {
    if (index + 1 >= cards.length) {
      const finalResults = [...results];
      finalResults[index] = { correct: lastCorrect ?? false };
      setResults(finalResults);
      setSubmitted(true);
      setLastCorrect(null);
      const finalCorrect = finalResults.filter((item) => item?.correct).length;
      const finalPercentage = cards.length ? Math.round((finalCorrect / cards.length) * 100) : 0;
      setTeacherMood(finalPercentage >= 50 ? 'correct' : 'incorrect');
      setCompleted(true);
      return;
    }
    setIndex((prev) => prev + 1);
    setSubmitted(false);
    setLastCorrect(null);
    setCompleted(false);
    setTeacherMood('idle');
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
    const answersPayload = cards.reduce<Record<number, boolean>>((acc, card, cardIndex) => {
      if (!card || typeof card.id !== 'number') {
        return acc;
      }
      const outcome = results[cardIndex];
      if (!outcome || typeof outcome.correct !== 'boolean') {
        return acc;
      }
      acc[card.id] = outcome.correct;
      return acc;
    }, {});
    const hasAnswers = Object.keys(answersPayload).length > 0;
    hasSyncedResult.current = true;
    updateStudySessionRequest(sessionId, {
      score: finalScore,
      total: cardsCount,
      completed_at: new Date().toISOString(),
      cards: cards.map((card) => {
        const { attempts = 0, correct = 0, ...rest } = card ?? {};
        return { ...rest, attempts, correct };
      }),
      ...(hasAnswers ? { answers: answersPayload } : {}),
    })
      .then(async (updated) => {
        setSessionRewards(updated.rewards ?? []);
        try {
          await refresh();
        } catch (err) {
          console.error('사용자 정보 갱신 실패', err);
        }
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
    const scorePercentage = Math.round((score / cards.length) * 100);
    const isExcellent = scorePercentage >= 90;
    const isGood = scorePercentage >= 70;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* 헤더 */}
        <header className="bg-white border-b border-slate-200 p-4 mb-6">
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-primary-600">🎉 학습 완료!</h2>
            <p className="text-lg text-slate-700 mt-2">
              점수: <span className="font-bold text-primary-600">{score}</span> / {cards.length} 
              <span className="ml-2 text-sm">({scorePercentage}%)</span>
            </p>
          </div>
        </header>

        {/* 메인 콘텐츠 - 2단 레이아웃 */}
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[calc(100vh-200px)]">
          {/* 왼쪽: Teacher 이미지 */}
          <div className="flex items-center justify-center">
            <div className="relative">
              <img 
                src={currentTeacherImage} 
                alt="Teacher" 
                className="w-full max-w-md h-auto object-contain drop-shadow-lg"
              />
              <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-full px-6 py-3 shadow-lg border border-slate-200">
                <p className="text-lg font-bold text-center">
                  {isExcellent ? (
                    <span className="text-emerald-600">🏆 훌륭해요!</span>
                  ) : isGood ? (
                    <span className="text-blue-600">👍 잘했어요!</span>
                  ) : (
                    <span className="text-orange-600">💪 다시 도전!</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* 오른쪽: 결과 카드 */}
          <div className="flex items-center justify-center">
            <div className="w-full max-w-lg bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 shadow-xl p-8">
              {/* 점수 표시 */}
              <div className="text-center mb-8">
                <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full text-3xl font-bold text-white shadow-lg ${
                  isExcellent ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' :
                  isGood ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                  'bg-gradient-to-br from-orange-400 to-orange-600'
                }`}>
                  {scorePercentage}%
                </div>
              </div>

              {/* 상세 결과 */}
              <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 text-center">📊 상세 결과</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {cards.map((card, idx) => (
                    <div
                      key={`${card.type}-${idx}`}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-sm text-slate-700">{getQuizTypeLabel(card.type)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-semibold ${results[idx]?.correct ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {results[idx]?.correct ? '✓ 정답' : '✗ 오답'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {card?.attempts ?? 0}회 시도
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 액션 버튼들 */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setIndex(0);
                    setResults([]);
                    setSubmitted(false);
                    setLastCorrect(null);
                    setCompleted(false);
                    // 새로운 랜덤 teacher 이미지 선택
                    const randomIndex = Math.floor(Math.random() * teacherVariants.length);
                    setTeacherVariantIndex(randomIndex);
                    setTeacherMood('idle');
                  }}
                  className="w-full rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-500 shadow-lg"
                >
                  🔄 다시 학습하기
                </button>
                {sessionId && (
                  <button
                    type="button"
                    onClick={() => navigate('/studies', { state: { refresh: Date.now() } })}
                    className="w-full rounded-lg border-2 border-primary-500 px-6 py-3 text-sm font-semibold text-primary-600 transition hover:bg-primary-50"
                  >
                    📚 학습 리스트로 돌아가기
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 성취 메시지 */}
        <div className="max-w-7xl mx-auto px-4 mt-8 mb-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-center">
            <p className="text-lg font-medium text-slate-700">
              {isExcellent ? (
                <>🌟 완벽한 성과입니다! 모든 문제를 거의 다 맞히셨네요.</>
              ) : isGood ? (
                <>👏 좋은 결과입니다! 조금만 더 노력하면 완벽할 거예요.</>
              ) : (
                <>💪 포기하지 마세요! 다시 도전해서 더 좋은 결과를 만들어보세요.</>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 헤더 */}
      <header className="bg-white border-b border-slate-200 p-4 mb-6">
        <div className="max-w-7xl mx-auto">
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
          <p className="text-xs uppercase tracking-wide text-slate-500 mt-2">
            진행도 {index + 1} / {cards.length}
          </p>
          <ProgressBar current={index + (submitted ? 1 : 0)} total={cards.length} />
        </div>
      </header>

      {/* 메인 콘텐츠 - 2단 레이아웃 */}
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[calc(100vh-200px)]">
        {/* 왼쪽: Teacher 이미지 */}
        <div className="flex items-center justify-center">
          <div className="relative">
            <img 
              src={currentTeacherImage} 
              alt="Teacher" 
              className="w-full max-w-md h-auto object-contain drop-shadow-lg"
            />
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-full px-4 py-2 shadow-lg border border-slate-200">
              <p className="text-sm font-medium text-slate-700">
                {getQuizTypeLabel(currentCard?.type)}
              </p>
            </div>
          </div>
        </div>

        {/* 오른쪽: 퀴즈 카드 */}
        <div className="flex items-center justify-center">
          <div className={`w-full max-w-lg rounded-2xl border-2 shadow-xl p-8 ${getQuizTypeColor(currentCard?.type)}`}>
            {/* 카드 헤더 */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-4 py-2 shadow-sm">
                <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                <span className="text-sm font-semibold text-slate-700">
                  문제 {index + 1}
                </span>
              </div>
            </div>

            {/* 퀴즈 콘텐츠 */}
            <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-sm">
              <CardRunner card={currentCard} disabled={submitted} onSubmit={handleSubmit} />
            </div>

            {/* 결과 및 다음 버튼 */}
            {submitted && (
              <div className="mt-6 bg-white/90 backdrop-blur-sm rounded-xl p-6 shadow-sm">
                <p className={`text-lg font-semibold mb-3 ${lastCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {lastCorrect ? '🎉 정답입니다!' : '❌ 틀렸습니다.'}
                </p>
                {currentCard.explain && (
                  <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm font-medium text-slate-600 mb-2">💡 해설</p>
                    <p className="text-sm text-slate-700">{currentCard.explain}</p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-500 shadow-lg"
                >
                  {index + 1 >= cards.length ? '🏁 결과 보기' : '➡️ 다음 문제'}
                </button>
              </div>
            )}

            {/* 카드 푸터 */}
            <div className="mt-6 text-center">
              <div className="flex justify-center gap-4 text-xs text-slate-600">
                <span>시도: {currentCard?.attempts ?? 0}회</span>
                <span>•</span>
                <span>정답: {currentCard?.correct ?? 0}회</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 추가 정보 (태그, 보상) */}
      {(sessionTags.length > 0 || sessionRewards.length > 0) && (
        <div className="max-w-7xl mx-auto px-4 mt-8">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            {sessionTags.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-primary-600 mb-2">🏷️ 학습 태그</p>
                <div className="flex flex-wrap gap-2">
                  {sessionTags.map((tag) => (
                    <span key={tag} className="rounded-full border border-primary-500/40 bg-primary-50 px-3 py-1 text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {sessionRewards.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-primary-600 mb-2">🎁 보상</p>
                <div className="flex flex-wrap gap-2">
                  {sessionRewards.map((reward) => (
                    <span key={reward.id} className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs">
                      {reward.title} · {reward.duration}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
