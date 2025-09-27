import { useState, useEffect } from 'react';
import { QuizItem } from '../api';
import { buildTeacherFilename, getTeacherAssetUrl } from '../utils/assets';
import cardFrameFront from '../assets/card_frame_front.png';
import cardFrameBack from '../assets/card_frame_back.png';

const sampleQuizzes: QuizItem[] = [
  {
    id: 1,
    content_id: 1,
    type: 'MCQ',
    payload: {
      question: '고구려를 건국한 인물은 누구인가?',
      options: ['주몽', '온조', '박혁거세', '김수로'],
      answer: 0,
    },
    created_at: new Date().toISOString(),
    visibility: 'PUBLIC',
    owner_id: 1,
  },
  {
    id: 2,
    content_id: 1,
    type: 'SHORT',
    payload: {
      prompt: '조선 전기 과거제도의 최고 시험은?',
      answer: '대과(문과)',
    },
    created_at: new Date().toISOString(),
    visibility: 'PUBLIC',
    owner_id: 1,
  },
  {
    id: 3,
    content_id: 1,
    type: 'OX',
    payload: {
      statement: '세종대왕이 훈민정음을 창제했다.',
      answer: true,
    },
    created_at: new Date().toISOString(),
    visibility: 'PUBLIC',
    owner_id: 1,
  },
  {
    id: 4,
    content_id: 1,
    type: 'CLOZE',
    payload: {
      text: '1392년 {{c1::이성계}}가 조선을 건국하였다.',
    },
    created_at: new Date().toISOString(),
    visibility: 'PUBLIC',
    owner_id: 1,
  },
  {
    id: 5,
    content_id: 1,
    type: 'ORDER',
    payload: {
      items: ['고구려 건국', '백제 건국', '신라 건국', '가야 건국'],
    },
    created_at: new Date().toISOString(),
    visibility: 'PUBLIC',
    owner_id: 1,
  },
  {
    id: 6,
    content_id: 1,
    type: 'MATCH',
    payload: {
      pairs: [
        { left: '세종대왕', right: '훈민정음' },
        { left: '이순신', right: '거북선' },
        { left: '장보고', right: '청해진' },
      ],
    },
    created_at: new Date().toISOString(),
    visibility: 'PUBLIC',
    owner_id: 1,
  },
];

type TeacherMood = 'idle' | 'correct' | 'incorrect';

const teacherVariants = Array.from({ length: 12 }, (_, index) => ({
  idle: getTeacherAssetUrl(buildTeacherFilename(index)),
  correct: getTeacherAssetUrl(buildTeacherFilename(index, '_o')),
  incorrect: getTeacherAssetUrl(buildTeacherFilename(index, '_x')),
}));

const sampleOutcomes = sampleQuizzes.map((_, index) => index % 3 !== 1);

const sampleExplanations = [
  '주몽이 졸본에서 고구려를 세워 한강 이북을 장악했습니다.',
  '대과(문과)는 조선 전기 문관을 선발하는 최고 수준의 시험이었습니다.',
  '세종대왕은 집현전을 중심으로 훈민정음을 반포했습니다.',
  '1392년 이성계가 조선을 건국하며 새 왕조를 열었습니다.',
  '고구려·백제·신라·가야 순서로 삼국과 가야가 성립했습니다.',
  '세종대왕-훈민정음, 이순신-거북선, 장보고-청해진이 대표적 연결입니다.',
];

const renderSampleQuiz = (quiz: QuizItem) => {
  if (!quiz) return <div className="text-sm text-slate-600">퀴즈를 불러오는 중...</div>;

  const questionBlock = (text: string) => (
    <p className="w-full bg-white px-4 py-3 text-base font-semibold text-primary-600 text-center shadow-sm">{text}</p>
  );

  if (quiz.type === 'MCQ') {
    const options: string[] = Array.isArray(quiz.payload.options) ? quiz.payload.options : [];
    return (
      <div className="space-y-4 text-sm text-slate-900">
        {questionBlock(quiz.payload.question ?? '질문 없음')}
        <div className="space-y-2">
          {options.map((option, index) => (
            <div key={`${option}-${index}`} className="flex items-center justify-center gap-3 bg-white px-3 py-2 text-sm shadow-sm">
              <span>{option}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  switch (quiz.type) {
    case 'SHORT':
      return (
        <div className="space-y-3">
          {questionBlock(quiz.payload.prompt)}
          <div className="bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">정답 입력 영역 (예시)</div>
        </div>
      );
    case 'OX':
      return (
        <div className="space-y-3">
          {questionBlock(quiz.payload.statement)}
          <div className="flex gap-2">
            <div className="flex-1 rounded bg-white py-3 text-center text-xs font-semibold text-emerald-600 shadow-sm">O</div>
            <div className="flex-1 rounded bg-white py-3 text-center text-xs font-semibold text-rose-600 shadow-sm">X</div>
          </div>
        </div>
      );
    case 'CLOZE':
      return (
        <div className="space-y-3">
          {questionBlock(quiz.payload.text?.replace(/\{\{c\d+::(.*?)\}\}/g, '____') ?? '')}
          <div className="bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">빈칸 입력 영역 (예시)</div>
        </div>
      );
    case 'ORDER':
      return (
        <div className="space-y-3">
          {questionBlock('올바른 순서로 배열하세요')}
          <div className="space-y-1">
            {quiz.payload.items?.map((item: string, idx: number) => (
              <div key={idx} className="rounded bg-white px-3 py-2 text-xs text-center shadow-sm">
                {item}
              </div>
            ))}
          </div>
        </div>
      );
    case 'MATCH':
      return (
        <div className="space-y-3">
          {questionBlock('올바른 짝을 맞추세요')}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              {quiz.payload.pairs?.map((pair: any, idx: number) => (
                <div key={idx} className="rounded bg-white px-3 py-2 text-xs shadow-sm">
                  {pair.left}
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {quiz.payload.pairs?.map((pair: any, idx: number) => (
                <div key={idx} className="rounded bg-white px-3 py-2 text-xs shadow-sm">
                  {pair.right}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    default:
      return <div className="text-sm text-slate-600">지원하지 않는 퀴즈 유형입니다.</div>;
  }
};

const renderSampleAnswer = (isCorrect: boolean, explanation?: string) => (
  <div className="space-y-4 text-slate-800">
    <div
      className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold ${
        isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
      }`}
    >
      {isCorrect ? '🎉 정답입니다!' : '❌ 틀렸습니다.'}
    </div>
    {explanation ? (
      <p className="text-sm leading-relaxed text-slate-700">{explanation}</p>
    ) : (
      <p className="text-sm text-slate-500">다음 문제로 이동하세요.</p>
    )}
  </div>
);

export default function HomePage() {
  const [currentQuiz, setCurrentQuiz] = useState(() => Math.floor(Math.random() * sampleQuizzes.length));
  const [showAnswer, setShowAnswer] = useState(false);
  const [teacherVariantIndex] = useState(() => Math.floor(Math.random() * teacherVariants.length));
  const [teacherMood, setTeacherMood] = useState<TeacherMood>('idle');

  const currentTeacherImage =
    teacherVariants[teacherVariantIndex]?.[teacherMood] ?? teacherVariants[0].idle;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (showAnswer) {
        setCurrentQuiz((prev) => {
          const next = Math.floor(Math.random() * sampleQuizzes.length);
          return next === prev && sampleQuizzes.length > 1 ? (next + 1) % sampleQuizzes.length : next;
        });
        setShowAnswer(false);
      } else {
        setShowAnswer(true);
      }
    }, showAnswer ? 4000 : 6000);

    return () => window.clearTimeout(timeout);
  }, [showAnswer]);

  useEffect(() => {
    if (showAnswer) {
      const isCorrect = sampleOutcomes[currentQuiz];
      setTeacherMood(isCorrect ? 'correct' : 'incorrect');
    } else {
      setTeacherMood('idle');
    }
  }, [showAnswer, currentQuiz]);

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
                      style={{ backgroundImage: `url(${cardFrameFront})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    >
                    <div className="absolute inset-0 bg-white/55" />
                    <div className="absolute inset-[18px] flex h-full flex-col items-stretch justify-center gap-6 rounded-[28px] bg-white/92 p-6 shadow-inner">
                        <div className="max-h-full overflow-y-auto text-slate-900">
                          {renderSampleQuiz(sampleQuizzes[currentQuiz])}
                        </div>
                    </div>
                    </div>
                    <div
                      className="absolute inset-0 overflow-hidden rounded-[36px] border border-slate-200 shadow-[0_28px_60px_-20px_rgba(30,41,59,0.45)] [backface-visibility:hidden] [transform:rotateY(180deg)]"
                      style={{ backgroundImage: `url(${cardFrameBack})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    >
                      <div className="absolute inset-0 bg-white/55" />
                      <div className="absolute inset-[18px] flex h-full flex-col items-center justify-center gap-5 rounded-[28px] bg-white/94 p-6 text-center shadow-inner">
                        <div className="w-full overflow-y-auto pr-1 text-left text-slate-900">
                          {renderSampleAnswer(sampleOutcomes[currentQuiz], sampleExplanations[currentQuiz])}
                        </div>
                        <button
                          type="button"
                          className="w-full rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2"
                        >
                          다음 문제로 이동하세요.
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

          <div className="grid w-full max-w-4xl grid-cols-1 gap-8 md:grid-cols-3 mt-16">
            <div className="text-center p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">체계적인 콘텐츠</h3>
              <p className="text-slate-600">한국사 전 영역을 체계적으로 정리한 학습 자료</p>
            </div>

            <div className="text-center p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">AI 퀴즈 생성</h3>
              <p className="text-slate-600">인공지능이 생성하는 맞춤형 퀴즈</p>
            </div>

            <div className="text-center p-6 bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">맞춤형 보상</h3>
              <p className="text-slate-600">다양한 보상으로 학습 관리</p>
            </div>
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
