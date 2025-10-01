import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  fetchContent,
  fetchContentCards,
  fetchStudySession,
  fetchPublicStudySession,
  updateStudySessionRequest,
  fetchDefaultCardStyle,
  fetchCardStyleByType,
  type StudySessionCard,
  type StudySession,
  type Reward,
  type LearningHelperPublic,
  type CardStyle,
} from '../api';
import CardRunner from '../components/CardRunner';
import ProgressBar from '../components/ProgressBar';
import { getQuizTypeLabel } from '../utils/quiz';
import { buildTeacherFilename, getTeacherAssetUrl, getHelperAssetUrl, getCardDeckImageUrl } from '../utils/assets';
import { useAuth } from '../context/AuthContext';
import HelperPickerModal from '../components/HelperPickerModal';
import { useLearningHelpers } from '../hooks/useLearningHelpers';

type TeacherMood = 'idle' | 'correct' | 'incorrect';

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
  const [session, setSession] = useState<StudySession | null>(null);
  const [cards, setCards] = useState<StudySessionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [lastExplanation, setLastExplanation] = useState<string | null>(null);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [completed, setCompleted] = useState(false);
  const [sessionRewards, setSessionRewards] = useState<Reward[]>([]);
  const [sessionTags, setSessionTags] = useState<string[]>([]);
  const [teacherMood, setTeacherMood] = useState<TeacherMood>('idle');
  const [finalResultFlipped, setFinalResultFlipped] = useState(false);
  const [nextActionLabel, setNextActionLabel] = useState<'➡️ 다음 문제' | '🏁 결과 보기'>('➡️ 다음 문제');
  const [cardSessionKey, setCardSessionKey] = useState(0);
  const [finalFrontCorrect, setFinalFrontCorrect] = useState<boolean | null>(null);
  const [finalFrontExplanation, setFinalFrontExplanation] = useState<string | null>(null);
  const [restarting, setRestarting] = useState(false);
  const [helper, setHelper] = useState<LearningHelperPublic | null>(null);
  const [helperModalOpen, setHelperModalOpen] = useState(false);
  const [pendingHelperId, setPendingHelperId] = useState<number | null>(null);
  const [helperSubmitting, setHelperSubmitting] = useState(false);
  const [cardStyle, setCardStyle] = useState<CardStyle | null>(null);
  const [cardStyleCache, setCardStyleCache] = useState<Record<string, CardStyle>>({});
  const resultResetTimer = useRef<number | null>(null);
  const restartTimer = useRef<number | null>(null);
  const { helpers, refresh: refreshHelpers } = useLearningHelpers();

  const userId = user?.id;

  const baseVariants = useMemo(
    () => ({
      idle: getTeacherAssetUrl(buildTeacherFilename(0)),
      correct: getTeacherAssetUrl(buildTeacherFilename(0, '_o')),
      incorrect: getTeacherAssetUrl(buildTeacherFilename(0, '_x')),
    }),
    [],
  );

  const activeHelper = helper ?? user?.selected_helper ?? null;

  // 카드덱 이미지 URL 생성
  const cardDeckFrontImage = useMemo(() => {
    const deckFrontImage = session?.card_deck?.front_image;
    return getCardDeckImageUrl(deckFrontImage) ?? getCardDeckImageUrl('card_frame_front.png') ?? null;
  }, [session?.card_deck?.front_image]);

  const cardDeckBackImage = useMemo(() => {
    const deckBackImage = session?.card_deck?.back_image;
    return getCardDeckImageUrl(deckBackImage) ?? getCardDeckImageUrl('card_frame_back.png') ?? null;
  }, [session?.card_deck?.back_image]);

  const helperVariants = useMemo(() => {
    const variants = activeHelper?.variants ?? {};
    const idle = getHelperAssetUrl(variants.idle) ?? baseVariants.idle;
    const correct = getHelperAssetUrl(variants.correct) ?? idle ?? baseVariants.correct;
    const incorrect = getHelperAssetUrl(variants.incorrect) ?? idle ?? baseVariants.incorrect;
    return {
      idle,
      correct,
      incorrect,
    };
  }, [activeHelper, baseVariants]);

  const currentTeacherImage = helperVariants[teacherMood] ?? baseVariants.idle;

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        if (sessionId) {
          // 로그인 상태에 따라 공개/개인 세션 API 분기
          const session = userId
            ? await fetchStudySession(sessionId)
            : await fetchPublicStudySession(sessionId);
          setSession(session);
          const cardsFromSession = Array.isArray(session.cards)
            ? session.cards.map((card: any) => ({
                ...card,
                attempts: typeof card?.attempts === 'number' ? card.attempts : 0,
                correct: typeof card?.correct === 'number' ? card.correct : 0,
              }))
            : [];
          setSessionRewards(session.rewards ?? []);
          setSessionTags(session.tags ?? []);
          setHelper(session.helper ?? user?.selected_helper ?? null);
          setPendingHelperId(
            session.helper?.id ?? session.helper_id ?? user?.selected_helper_id ?? null,
          );
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
          setHelper(user?.selected_helper ?? null);
          setPendingHelperId(user?.selected_helper_id ?? null);
        }
        setIndex(0);
        setSubmitted(false);
        setLastCorrect(null);
        setLastExplanation(null);
        setResults([]);
        setCompleted(false);
        setFinalResultFlipped(false);
        setFinalFrontCorrect(null);
        setFinalFrontExplanation(null);
        setRestarting(false);
        setNextActionLabel('➡️ 다음 문제');
        setCardSessionKey((prev) => prev + 1);
        if (resultResetTimer.current) {
          window.clearTimeout(resultResetTimer.current);
          resultResetTimer.current = null;
        }
        setTeacherMood('idle');
        
        // 기본 카드 스타일 로드
        try {
          const defaultStyle = await fetchDefaultCardStyle();
          setCardStyle(defaultStyle);
          setCardStyleCache({ 'ALL': defaultStyle });
        } catch (styleErr) {
          console.warn('카드 스타일 로드 실패:', styleErr);
        }
      } catch (err: any) {
        console.error(err);
        const message = err?.response?.data?.detail ?? err?.message ?? '학습 데이터를 불러오지 못했습니다.';
        setError(typeof message === 'string' ? message : JSON.stringify(message));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, sessionId, userId, user?.selected_helper_id, user?.selected_helper, location, navigate]);

  const score = useMemo(() => results.filter((item) => item?.correct).length, [results]);

  const hasSyncedResult = useRef(false);

  const handleHelperConfirm = async () => {
    if (pendingHelperId == null) {
      alert('학습 도우미를 선택해주세요.');
      return;
    }
    const selectedHelper = helpers.find((item) => item.id === pendingHelperId);
    if (!selectedHelper) {
      alert('선택한 학습 도우미를 찾을 수 없습니다.');
      return;
    }
    if (!selectedHelper.unlocked) {
      alert('아직 잠금 해제되지 않은 학습 도우미입니다.');
      return;
    }

    if (!sessionId) {
      setHelper(selectedHelper);
      setHelperModalOpen(false);
      return;
    }

    setHelperSubmitting(true);
    try {
      const updated = await updateStudySessionRequest(sessionId, { helper_id: pendingHelperId });
      setHelper(updated.helper ?? selectedHelper);
      setHelperModalOpen(false);
      refreshHelpers();
    } catch (err: any) {
      console.error('학습 도우미 변경 실패', err);
      const message = err?.response?.data?.detail ?? err?.message ?? '학습 도우미를 변경하지 못했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setHelperSubmitting(false);
    }
  };

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
    setLastExplanation(targetCard?.explain ?? null);
    const hasMoreCards = index < cards.length - 1;
    setNextActionLabel(hasMoreCards ? '➡️ 다음 문제' : '🏁 결과 보기');
    setCards(updatedCards);
    setResults((prev) => {
      const next = [...prev];
      next[index] = { correct };
      return next;
    });
    setCompleted(false);
    setFinalResultFlipped(false);
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
      setFinalFrontCorrect(lastCorrect);
      setFinalFrontExplanation(lastExplanation);
      setLastCorrect(null);
      setLastExplanation(null);
      const finalCorrect = finalResults.filter((item) => item?.correct).length;
      const finalPercentage = cards.length ? Math.round((finalCorrect / cards.length) * 100) : 0;
      setTeacherMood(finalPercentage >= 50 ? 'correct' : 'incorrect');
    setCompleted(true);
      if (resultResetTimer.current) {
        window.clearTimeout(resultResetTimer.current);
        resultResetTimer.current = null;
      }
      return;
    }
    setIndex((prev) => prev + 1);
    setSubmitted(false);
    setCompleted(false);
    setFinalResultFlipped(false);
    setTeacherMood('idle');
    setNextActionLabel('➡️ 다음 문제');
    if (resultResetTimer.current) {
      window.clearTimeout(resultResetTimer.current);
    }
    resultResetTimer.current = window.setTimeout(() => {
      setLastCorrect(null);
      setLastExplanation(null);
      resultResetTimer.current = null;
    }, 500);
  };

  const finished = completed;
  const currentCard = cards[Math.min(index, cards.length - 1)];
  const cardsCount = cards.length;
  const hasResult = lastCorrect !== null || lastExplanation !== null;
  const isResultFrame = finalResultFlipped || (finished && !restarting);

  // 현재 카드 유형에 맞는 스타일 로드
  const loadCardStyleForType = async (cardType: string) => {
    if (cardStyleCache[cardType]) {
      setCardStyle(cardStyleCache[cardType]);
      return;
    }

    try {
      const style = await fetchCardStyleByType(cardType);
      setCardStyleCache(prev => ({ ...prev, [cardType]: style }));
      setCardStyle(style);
    } catch (err) {
      console.warn(`카드 유형 ${cardType}의 스타일 로드 실패, 기본 스타일 사용:`, err);
      if (cardStyleCache['ALL']) {
        setCardStyle(cardStyleCache['ALL']);
      }
    }
  };

  // 현재 카드가 변경될 때마다 해당 유형의 스타일 로드
  useEffect(() => {
    if (currentCard?.type) {
      loadCardStyleForType(currentCard.type);
    }
  }, [currentCard?.type, cardStyleCache]);


  useEffect(() => {
    if (finished) {
      setFinalResultFlipped(true);
    } else {
      setFinalResultFlipped(false);
    }
  }, [finished]);

  useEffect(() => {
    return () => {
      if (resultResetTimer.current) {
        window.clearTimeout(resultResetTimer.current);
      }
      if (restartTimer.current) {
        window.clearTimeout(restartTimer.current);
      }
    };
  }, []);

  const beginRestart = () => {
    if (restarting) {
      return;
    }
    setRestarting(true);
    setFinalFrontCorrect(null);
    setFinalFrontExplanation(null);
    setNextActionLabel('➡️ 다음 문제');
    setFinalResultFlipped(false);
    if (restartTimer.current) {
      window.clearTimeout(restartTimer.current);
    }
    restartTimer.current = window.setTimeout(() => {
      setIndex(0);
      setResults([]);
      setSubmitted(false);
      setLastCorrect(null);
      setLastExplanation(null);
      setCompleted(false);
      setFinalFrontCorrect(null);
      setFinalFrontExplanation(null);
      setFinalResultFlipped(false);
      setCardSessionKey((prev) => prev + 1);
      if (resultResetTimer.current) {
        window.clearTimeout(resultResetTimer.current);
        resultResetTimer.current = null;
      }
      setTeacherMood('idle');
      setRestarting(false);
      restartTimer.current = null;
    }, 700);
  };

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
      <>
      <div className="min-h-screen bg-white py-6">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col items-center gap-10">
            <div className="relative w-full max-w-5xl rounded-[40px] bg-white p-8 shadow-[0_32px_60px_-28px_rgba(30,41,59,0.35)]">
              {/* 작은 헤더 - 중앙 상단 */}
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-xl px-4 py-2 shadow-lg border border-slate-200 z-10">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-primary-600">🎉 학습 완료!</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{score}/{cards.length} ({scorePercentage}%)</span>
                    <div className="w-12 bg-slate-200 rounded-full h-1">
                      <div 
                        className="bg-primary-500 h-1 rounded-full transition-all duration-300"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-10 lg:flex-row lg:items-center">
                <div className="relative flex-[0_0_50%]">
                  <img
                    src={currentTeacherImage}
                    alt="Teacher"
                    className="w-full h-auto object-contain"
                  />
                </div>

                <div className="relative flex-1">
                  <div
                    key={`completed-${cardSessionKey}`}
                    className="relative w-full max-w-sm lg:ml-auto"
                    style={{ perspective: '1500px' }}
                  >
                    <div
                      className={`relative aspect-[3/5] w-full transform transition-transform duration-700 [transform-style:preserve-3d] ${finalResultFlipped ? '[transform:rotateY(180deg)]' : ''}`}
                    >
                      <div
                        className="absolute inset-0 overflow-hidden rounded-[36px] border border-slate-200 shadow-[0_28px_60px_-20px_rgba(30,41,59,0.45)] [backface-visibility:hidden]"
                        style={{
                          ...(isResultFrame ? cardDeckBackImage : cardDeckFrontImage) 
                            ? {
                                backgroundImage: `url(${isResultFrame ? cardDeckBackImage : cardDeckFrontImage})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                              }
                            : {
                                backgroundColor: '#f8fafc',
                              }
                        }}
                      >
                        <div className="absolute inset-0 bg-white/55" />
                        <div className="absolute inset-[18px] flex flex-col items-center justify-center gap-5 rounded-[28px] bg-white/94 p-6 text-center">
                          {finalFrontCorrect !== null || finalFrontExplanation ? (
                            <>
                              <div
                                className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold ${finalFrontCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}
                              >
                                {finalFrontCorrect ? '🎉 정답입니다!' : '❌ 틀렸습니다.'}
                              </div>
                              {finalFrontExplanation ? (
                                <p className="text-sm leading-relaxed text-slate-700">{finalFrontExplanation}</p>
                              ) : (
                                <p className="text-sm text-slate-500">최종 결과를 준비하고 있어요.</p>
                              )}
                              <button
                                type="button"
                                className="w-full rounded-xl bg-primary-600/30 px-4 py-2 text-sm font-semibold text-primary-600/70 shadow-lg pointer-events-none"
                                tabIndex={-1}
                                aria-hidden="true"
                              >
                                {nextActionLabel}
                              </button>
                            </>
                          ) : (
                            <p className="inline-flex items-center justify-center rounded-full bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-500">
                              새로운 학습을 준비하고 있어요...
                            </p>
                          )}
                        </div>
                      </div>

                      <div
                        className="absolute inset-0 overflow-hidden rounded-[36px] border border-slate-200 shadow-[0_28px_60px_-20px_rgba(30,41,59,0.45)] [transform:rotateY(180deg)] [backface-visibility:hidden]"
                        style={{
                          ...(cardDeckBackImage) 
                            ? {
                                backgroundImage: `url(${cardDeckBackImage})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                              }
                            : {
                                backgroundColor: '#f8fafc',
                              }
                        }}
                      >
                        <div className="absolute inset-0 bg-white/55" />
                        <div className="absolute inset-[18px] flex flex-col rounded-[28px] bg-white/92 p-6">
                          <div className="flex h-full flex-col gap-5 text-slate-900">
                            <div className="text-center">
                              <div
                                className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold text-white shadow-lg ${
                                  isExcellent
                                    ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                                    : isGood
                                    ? 'bg-gradient-to-br from-blue-400 to-blue-600'
                                    : 'bg-gradient-to-br from-orange-400 to-orange-600'
                                }`}
                              >
                                {scorePercentage}%
                              </div>
                              <p className="mt-3 text-sm font-semibold text-slate-600">
                                점수 {score} / {cards.length}
                              </p>
                            </div>

                            <div className="flex-1 overflow-y-auto rounded-2xl bg-white/90 p-4">
                              <h3 className="mb-3 text-center text-sm font-semibold text-slate-700">📊 상세 결과</h3>
                              <div className="space-y-2 pr-1">
                                {cards.map((card, idx) => (
                                  <div
                                    key={`${card.type}-${idx}`}
                                    className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                                        {idx + 1}
                                      </span>
                                      <span className="text-slate-700">{getQuizTypeLabel(card.type)}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs">
                                      <span
                                        className={`font-semibold ${
                                          results[idx]?.correct ? 'text-emerald-600' : 'text-rose-600'
                                        }`}
                                      >
                                        {results[idx]?.correct ? '✓ 정답' : '✗ 오답'}
                                      </span>
                                      <span className="text-slate-500">{card?.attempts ?? 0}회 시도</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-3">
                              <button
                                type="button"
                                onClick={beginRestart}
                                disabled={restarting}
                                className={`w-full rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg transition focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 ${
                                  restarting
                                    ? 'bg-primary-300 pointer-events-none'
                                    : 'bg-primary-600 hover:bg-primary-500'
                                }`}
                              >
                                🔄 다시 학습하기
                              </button>
                              {sessionId && (
                                <button
                                  type="button"
                                  onClick={() => navigate('/studies', { state: { refresh: Date.now() } })}
                                  className="w-full rounded-xl border-2 border-primary-500 px-6 py-3 text-sm font-semibold text-primary-600 transition hover:bg-primary-50"
                                >
                                  📚 학습 리스트로 돌아가기
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 text-xs uppercase tracking-[0.2em] text-slate-500 lg:ml-auto lg:max-w-sm lg:items-end">
                    <span>카드 총 {cards.length}개 · 정답 {score}개</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
      <HelperPickerModal
        isOpen={helperModalOpen}
        helpers={helpers}
        selectedId={pendingHelperId}
        onSelect={setPendingHelperId}
        onClose={() => {
          if (!helperSubmitting) {
            setHelperModalOpen(false);
          }
        }}
        onConfirm={handleHelperConfirm}
        userLevel={user?.level ?? 1}
        submitting={helperSubmitting}
        confirmLabel={sessionId ? '학습 도우미 변경' : '선택'}
        description={sessionId ? undefined : '임시 학습에서는 선택한 도우미가 현재 화면에만 적용됩니다.'}
      />
      </>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-white py-6">
      {/* 메인 콘텐츠 - 통합 프레임 */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col items-center gap-10">
          <div className="relative w-full max-w-5xl rounded-[40px] bg-white p-8 shadow-[0_32px_60px_-28px_rgba(30,41,59,0.35)]">
            {/* 작은 헤더 - 중앙 상단 */}
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-xl px-4 py-2 shadow-lg border border-slate-200 z-10">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-primary-600">{content.title}</h3>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{index + 1}/{cards.length}</span>
                  <div className="w-12 bg-slate-200 rounded-full h-1">
                    <div 
                      className="bg-primary-500 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${((index + (submitted ? 1 : 0)) / cards.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-10 lg:flex-row lg:items-center">
              {/* Teacher 영역 */}
              <div className="relative flex-[0_0_50%]">
                <img
                  src={currentTeacherImage}
                  alt="Teacher"
                  className="w-full h-auto object-contain"
                />
              </div>

              {/* 카드 영역 */}
              <div className="relative flex-1">
                <div
                  key={`card-${cardSessionKey}`}
                  className="relative w-full max-w-sm lg:ml-auto"
                  style={{ perspective: '1500px' }}
                >
                  <div
                    className={`relative aspect-[3/5] w-full transform transition-transform duration-700 [transform-style:preserve-3d] ${submitted ? '[transform:rotateY(180deg)]' : ''}`}
                  >
                    <div
                      className="absolute inset-0 overflow-hidden rounded-[36px] border border-slate-200 shadow-[0_28px_60px_-20px_rgba(30,41,59,0.45)] [backface-visibility:hidden]"
                      style={{
                        ...(cardDeckFrontImage) 
                          ? {
                              backgroundImage: `url(${cardDeckFrontImage})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }
                          : {
                              backgroundColor: '#f8fafc',
                            }
                      }}
                    >
                      <div className="absolute inset-0 bg-white/55" />
                      <div className={`absolute inset-0 flex h-full flex-col rounded-[36px] bg-white/92 p-6 ${
                        cardStyle?.front_layout === 'top' ? 'justify-start' :
                        cardStyle?.front_layout === 'center' ? 'justify-center' :
                        cardStyle?.front_layout === 'bottom' ? 'justify-end' :
                        cardStyle?.front_layout === 'split' ? 'justify-between' : 'justify-center'
                      }`}>
                        {cardStyle?.front_layout === 'split' ? (
                          // 상하단 정렬: 문제는 상단, 답변은 하단
                          <div className="flex flex-col h-full justify-between">
                            
                            {/* 답변 영역 - 하단 */}
                            <div style={{
                              marginTop: `${cardStyle?.front_content_margin_top || '0'}px`,
                              marginBottom: `${cardStyle?.front_title_margin_bottom || '16'}px`,
                              marginLeft: `${cardStyle?.front_content_margin_left || '0'}px`,
                              marginRight: `${cardStyle?.front_content_margin_right || '0'}px`
                            }}>
                              <CardRunner card={currentCard} disabled={submitted} onSubmit={handleSubmit} cardStyle={cardStyle} />
                            </div>
                          </div>
                        ) : (
                          // 일반 레이아웃 (상단, 중앙, 하단)
                          <div className="max-h-full overflow-y-auto text-slate-900">
                            <div className="space-y-4">
                              
                              {/* 답변 영역 */}
                              <div style={{
                                marginTop: `${cardStyle?.front_content_margin_top || '0'}px`,
                                marginBottom: cardStyle?.front_layout === 'bottom' 
                                  ? `${cardStyle?.front_title_margin_bottom || '16'}px`
                                  : `${cardStyle?.front_content_margin_bottom || '0'}px`,
                                marginLeft: `${cardStyle?.front_content_margin_left || '0'}px`,
                                marginRight: `${cardStyle?.front_content_margin_right || '0'}px`
                              }}>
                                <CardRunner card={currentCard} disabled={submitted} onSubmit={handleSubmit} cardStyle={cardStyle} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      className="absolute inset-0 overflow-hidden rounded-[36px] border border-slate-200 shadow-[0_28px_60px_-20px_rgba(30,41,59,0.45)] [transform:rotateY(180deg)] [backface-visibility:hidden]"
                      style={{
                        ...(cardDeckBackImage) 
                          ? {
                              backgroundImage: `url(${cardDeckBackImage})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }
                          : {
                              backgroundColor: '#f8fafc',
                            }
                      }}
                    >
                      <div className="absolute inset-0 bg-white/55" />
                      <div className={`absolute inset-0 flex h-full flex-col rounded-[36px] bg-white/94 p-6 ${
                        cardStyle?.back_layout === 'top' ? 'justify-start' :
                        cardStyle?.back_layout === 'center' ? 'justify-center' :
                        cardStyle?.back_layout === 'bottom' ? 'justify-end' :
                        cardStyle?.back_layout === 'split' ? 'justify-between' : 'items-center justify-center'
                      }`}>
                        {cardStyle?.back_layout ? (
                          cardStyle.back_layout === 'split' ? (
                            // 상하단 정렬: 정답은 상단, 설명은 중앙, 버튼은 하단
                            <div className="flex flex-col h-full justify-between">
                              {/* 정답 영역 - 상단 */}
                              <div style={{
                                marginTop: `${cardStyle?.back_title_margin_top || '0'}px`,
                                marginBottom: `${cardStyle?.back_title_margin_bottom || '16'}px`,
                                marginLeft: `${cardStyle?.back_title_margin_left || '0'}px`,
                                marginRight: `${cardStyle?.back_title_margin_right || '0'}px`
                              }}>
                                <div className={`${cardStyle?.back_title_size || 'text-sm'} ${cardStyle?.back_title_color || ''} ${cardStyle?.back_title_align || 'text-center'}`}>
                                  {hasResult ? (
                                    <div className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold ${lastCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                      {lastCorrect ? '🎉 정답입니다!' : '❌ 틀렸습니다.'}
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center justify-center rounded-full bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-500">
                                      정답을 제출하면 결과가 표시됩니다.
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* 설명 영역 - 중앙 */}
                              <div style={{
                                marginTop: `${cardStyle?.back_content_margin_top || '0'}px`,
                                marginBottom: `${cardStyle?.back_content_margin_bottom || '0'}px`,
                                marginLeft: `${cardStyle?.back_content_margin_left || '0'}px`,
                                marginRight: `${cardStyle?.back_content_margin_right || '0'}px`
                              }}>
                                <div className={`${cardStyle?.back_content_size || 'text-sm'} ${cardStyle?.back_content_color || 'text-slate-700'} ${cardStyle?.back_content_align || 'text-center'}`}>
                                  {hasResult && lastExplanation ? (
                                    <p className="leading-relaxed">{lastExplanation}</p>
                                  ) : hasResult ? (
                                    <p>다음 문제로 이동하세요.</p>
                                  ) : null}
                                </div>
                              </div>
                              
                              {/* 버튼 영역 - 하단 */}
                              <div style={{
                                marginTop: `${cardStyle?.back_button_margin_top || '0'}px`,
                                marginBottom: `${cardStyle?.back_button_margin_bottom || '0'}px`,
                                marginLeft: `${cardStyle?.back_button_margin_left || '0'}px`,
                                marginRight: `${cardStyle?.back_button_margin_right || '0'}px`
                              }}>
                                <div className={`${cardStyle?.back_button_align || 'text-center'} w-full`}>
                                  <button
                                    type="button"
                                    onClick={handleNext}
                                    className={`w-full rounded-xl ${cardStyle?.back_button_size || 'px-4 py-2'} ${cardStyle?.back_button_color || 'bg-primary-600 text-white'} text-sm font-semibold shadow-lg transition hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2`}
                                  >
                                    {nextActionLabel}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            // 일반 레이아웃 (상단, 중앙, 하단)
                            <div className="flex flex-col gap-5 text-center">
                              {/* 정답 영역 */}
                              <div style={{
                                marginTop: `${cardStyle?.back_title_margin_top || '0'}px`,
                                marginBottom: cardStyle?.back_layout === 'bottom' 
                                  ? `${cardStyle?.back_title_margin_top || '0'}px`
                                  : `${cardStyle?.back_title_margin_bottom || '16'}px`,
                                marginLeft: `${cardStyle?.back_title_margin_left || '0'}px`,
                                marginRight: `${cardStyle?.back_title_margin_right || '0'}px`
                              }}>
                                <div className={`${cardStyle?.back_title_size || 'text-sm'} ${cardStyle?.back_title_color || ''} ${cardStyle?.back_title_align || 'text-center'}`}>
                                  {hasResult ? (
                                    <div className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold ${lastCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                      {lastCorrect ? '🎉 정답입니다!' : '❌ 틀렸습니다.'}
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center justify-center rounded-full bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-500">
                                      정답을 제출하면 결과가 표시됩니다.
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* 설명 영역 */}
                              <div style={{
                                marginTop: `${cardStyle?.back_content_margin_top || '0'}px`,
                                marginBottom: cardStyle?.back_layout === 'bottom' 
                                  ? `${cardStyle?.back_title_margin_bottom || '16'}px`
                                  : `${cardStyle?.back_content_margin_bottom || '0'}px`,
                                marginLeft: `${cardStyle?.back_content_margin_left || '0'}px`,
                                marginRight: `${cardStyle?.back_content_margin_right || '0'}px`
                              }}>
                                <div className={`${cardStyle?.back_content_size || 'text-sm'} ${cardStyle?.back_content_color || 'text-slate-700'} ${cardStyle?.back_content_align || 'text-center'}`}>
                                  {hasResult && lastExplanation ? (
                                    <p className="leading-relaxed">{lastExplanation}</p>
                                  ) : hasResult ? (
                                    <p>다음 문제로 이동하세요.</p>
                                  ) : null}
                                </div>
                              </div>
                              
                              {/* 버튼 영역 */}
                              <div style={{
                                marginTop: `${cardStyle?.back_button_margin_top || '0'}px`,
                                marginBottom: `${cardStyle?.back_button_margin_bottom || '0'}px`,
                                marginLeft: `${cardStyle?.back_button_margin_left || '0'}px`,
                                marginRight: `${cardStyle?.back_button_margin_right || '0'}px`
                              }}>
                                <div className={`${cardStyle?.back_button_align || 'text-center'} w-full`}>
                                  <button
                                    type="button"
                                    onClick={handleNext}
                                    className={`w-full rounded-xl ${cardStyle?.back_button_size || 'px-4 py-2'} ${cardStyle?.back_button_color || 'bg-primary-600 text-white'} text-sm font-semibold shadow-lg transition hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2`}
                                  >
                                    {nextActionLabel}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        ) : (
                          // cardStyle이 없을 때 기존 방식
                          <div className="flex flex-col gap-5 text-center">
                            {hasResult ? (
                              <>
                                <div className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold ${lastCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                  {lastCorrect ? '🎉 정답입니다!' : '❌ 틀렸습니다.'}
                                </div>
                                {lastExplanation ? (
                                  <p className="text-sm leading-relaxed text-slate-700">{lastExplanation}</p>
                                ) : (
                                  <p className="text-sm text-slate-500">다음 문제로 이동하세요.</p>
                                )}
                              </>
                            ) : (
                              <p className="inline-flex items-center justify-center rounded-full bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-500">
                                정답을 제출하면 결과가 표시됩니다.
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={handleNext}
                              className="w-full rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2"
                            >
                              {nextActionLabel}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 text-xs uppercase tracking-[0.2em] text-slate-500 lg:ml-auto lg:max-w-sm lg:items-end">
                  <span>시도 {currentCard?.attempts ?? 0}회 · 정답 {currentCard?.correct ?? 0}회</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <HelperPickerModal
        isOpen={helperModalOpen}
        helpers={helpers}
        selectedId={pendingHelperId}
        onSelect={setPendingHelperId}
        onClose={() => {
          if (!helperSubmitting) {
            setHelperModalOpen(false);
          }
        }}
        onConfirm={handleHelperConfirm}
        userLevel={user?.level ?? 1}
        submitting={helperSubmitting}
        confirmLabel={sessionId ? '학습 도우미 변경' : '선택'}
        description={sessionId ? undefined : '임시 학습에서는 선택한 도우미가 현재 화면에만 적용됩니다.'}
      />
    </div>
    </>
  );
}
