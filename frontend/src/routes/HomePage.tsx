import { useState, useEffect, useMemo } from 'react';
import { buildTeacherFilename, getTeacherAssetUrl, getHelperAssetUrl, getCardDeckImageUrl } from '../utils/assets';
import CardRunner from '../components/CardRunner';
import { fetchLearningHelpers, type LearningHelperPublic } from '../api';
import { useAuth } from '../context/AuthContext';

interface SampleCardConfig {
  card: any;
  correct: boolean;
  explanation?: string;
}

const sampleCards: SampleCardConfig[] = [
  {
    card: {
      type: 'MCQ',
      question: '고구려를 건국한 인물은 누구인가?',
      options: ['주몽', '온조', '박혁거세', '김수로'],
      answer_index: 0,
    },
    correct: true,
    explanation: '주몽이 졸본에서 고구려를 세워 한강 이북을 장악했습니다.',
  },
  {
    card: {
      type: 'SHORT',
      prompt: '조선 전기 과거제도의 최고 시험은?',
      answer: '대과(문과)',
      rubric: { aliases: ['대과', '문과'] },
    },
    correct: true,
    explanation: '조선 시대 과거 시험 가운데 문관을 선발하는 최고 시험이 대과(문과)였습니다.',
  },
  {
    card: {
      type: 'OX',
      statement: '세종대왕이 훈민정음을 창제했다.',
      answer: true,
    },
    correct: true,
    explanation: '세종대왕은 훈민정음을 창제해 반포했습니다.',
  },
  {
    card: {
      type: 'CLOZE',
      text: '1392년 {{c1}}가 조선을 건국하였다.',
      clozes: { c1: '이성계' },
    },
    correct: true,
    explanation: '1392년 이성계가 조선을 건국하면서 고려를 계승했습니다.',
  },
  {
    card: {
      type: 'ORDER',
      items: ['고구려 건국', '백제 건국', '신라 건국', '가야 건국'],
      answer_order: [0, 1, 2, 3],
    },
    correct: true,
    explanation: '삼국과 가야의 건국 순서는 고구려 → 백제 → 신라 → 가야입니다.',
  },
  {
    card: {
      type: 'MATCH',
      left: ['세종대왕', '이순신', '장보고'],
      right: ['훈민정음', '거북선', '청해진'],
      pairs: [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
    },
    correct: true,
    explanation: '세종대왕-훈민정음, 이순신-거북선, 장보고-청해진이 대표적인 연결입니다.',
  },
];

type TeacherMood = 'idle' | 'correct' | 'incorrect';

const renderSampleAnswer = ({ correct, explanation }: SampleCardConfig) => (
  <div className="space-y-4 text-slate-800">
    <div
      className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold ${
        correct ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
      }`}
    >
      {correct ? '🎉 정답입니다!' : '❌ 틀렸습니다.'}
    </div>
    {explanation ? (
      <p className="text-sm leading-relaxed text-slate-700">{explanation}</p>
    ) : (
      <p className="text-sm text-slate-500">다음 문제로 이동하세요.</p>
    )}
  </div>
);

export default function HomePage() {
  const { user } = useAuth();
  const initialIndex = Math.floor(Math.random() * sampleCards.length);
  const [frontIndex, setFrontIndex] = useState(initialIndex);
  const [answerIndex, setAnswerIndex] = useState(initialIndex);
  const [showAnswer, setShowAnswer] = useState(false);
  const [teacherMood, setTeacherMood] = useState<TeacherMood>('idle');
  const [fallbackHelper, setFallbackHelper] = useState<LearningHelperPublic | null>(null);

  const baseVariants = useMemo(
    () => ({
      idle: getTeacherAssetUrl(buildTeacherFilename(0)),
      correct: getTeacherAssetUrl(buildTeacherFilename(0, '_o')),
      incorrect: getTeacherAssetUrl(buildTeacherFilename(0, '_x')),
    }),
    [],
  );

  const activeHelper = user?.selected_helper ?? fallbackHelper;

  // 기본 카드덱 이미지 URL
  const cardDeckFrontImage = getCardDeckImageUrl('card_frame_front.png');
  const cardDeckBackImage = getCardDeckImageUrl('card_frame_back.png');

  const helperVariants = useMemo(() => {
    const variants = activeHelper?.variants ?? {};
    const idle = getHelperAssetUrl(variants.idle) ?? baseVariants.idle;
    const correct = getHelperAssetUrl(variants.correct) ?? idle ?? baseVariants.correct;
    const incorrect = getHelperAssetUrl(variants.incorrect) ?? idle ?? baseVariants.incorrect;
    return {
      idle,
      correct,
      incorrect,
    } as Record<TeacherMood, string>;
  }, [activeHelper, baseVariants]);

  const currentTeacherImage = helperVariants[teacherMood] ?? baseVariants.idle;

  useEffect(() => {
    let cancelled = false;
    if (user?.selected_helper) {
      setFallbackHelper(null);
      return () => {
        cancelled = true;
      };
    }
    fetchLearningHelpers()
      .then((items) => {
        if (cancelled) return;
        const defaultHelper =
          items.find((item) => item.level_requirement === 1) ?? items.find((item) => item.unlocked) ?? items[0] ?? null;
        setFallbackHelper(defaultHelper ?? null);
      })
      .catch((error: any) => {
        if (cancelled) return;
        console.error('학습 도우미 정보를 불러오지 못했습니다.', error);
        setFallbackHelper(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.selected_helper_id, user?.selected_helper]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (showAnswer) {
        setShowAnswer(false);
        setTeacherMood('idle');
        setFrontIndex((prev) => {
          if (sampleCards.length <= 1) {
            return prev;
          }
          let next = Math.floor(Math.random() * sampleCards.length);
          if (next === prev) {
            next = (next + 1) % sampleCards.length;
          }
          return next;
        });
      } else {
        setAnswerIndex(frontIndex);
        setShowAnswer(true);
      }
    }, showAnswer ? 4000 : 6000);

    return () => window.clearTimeout(timeout);
  }, [showAnswer, frontIndex]);

  useEffect(() => {
    if (showAnswer) {
      const isCorrect = sampleCards[answerIndex]?.correct ?? false;
      setTeacherMood(isCorrect ? 'correct' : 'incorrect');
    } else {
      setTeacherMood('idle');
    }
  }, [showAnswer, answerIndex]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <section className="w-full py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-center text-primary-600">HiStudyCard</h1>
          <p className="mt-4 text-lg md:text-xl text-center text-slate-600">한국사 학습을 위한 스마트 카드 시스템</p>
        </div>
      </section>

      <main className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center space-y-12">
          <div className="relative w-full max-w-5xl rounded-[40px] bg-white p-8 shadow-[0_32px_60px_-28px_rgba(30,41,59,0.35)]">
            <div className="flex flex-col gap-10 lg:flex-row lg:items-center">
              <div className="relative flex-[0_0_50%]">
                <img src={currentTeacherImage} alt="Teacher" className="w-full h-auto object-contain" />
              </div>
              <div className="relative flex-1">
                <div className="relative w-full max-w-sm lg:ml-auto" style={{ perspective: '1500px' }}>
                  <div
                    className={`relative aspect-[3/5] w-full transform transition-transform duration-700 ease-in-out [transform-style:preserve-3d] ${
                      showAnswer ? '[transform:rotateY(180deg)]' : ''
                    }`}
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
                    <div className="absolute inset-[18px] flex h-full flex-col items-stretch justify-center gap-6 rounded-[28px] bg-white/92 p-6">
                        <div className="max-h-full overflow-y-auto text-slate-900">
                          <div className="pointer-events-none select-none">
                            <CardRunner
                              card={sampleCards[frontIndex].card}
                              disabled={false}
                              onSubmit={() => {}}
                            />
                          </div>
                        </div>
                    </div>
                    </div>
                    <div
                      className="absolute inset-0 overflow-hidden rounded-[36px] border border-slate-200 shadow-[0_28px_60px_-20px_rgba(30,41,59,0.45)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
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
                      <div className="absolute inset-[18px] flex h-full flex-col items-center justify-center gap-5 rounded-[28px] bg-white/94 p-6 text-center">
                        <div className="w-full overflow-y-auto px-1 text-center text-slate-900">
                          {renderSampleAnswer(sampleCards[answerIndex])}
                        </div>
                        <button
                          type="button"
                          className="w-full rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2"
                        >
                          ➡️ 다음 문제
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center max-w-2xl space-y-6">
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-800">효율적인 한국사 학습의 시작</h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              AI 기반 퀴즈 생성과 체계적인 학습 관리로 한국사를 더 쉽고 재미있게 공부하세요.
            </p>
          </div>
        
        </div>
      </main>

      <footer className="w-full py-8 mt-16 border-t border-slate-200">
        <div className="container mx-auto px-4 text-center">
          <p className="text-slate-500">© {new Date().getFullYear()} HiStudyCard.</p>
        </div>
      </footer>
    </div>
  );
}
