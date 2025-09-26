import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getQuizTypeLabel } from '../utils/quiz';
import { QuizItem } from '../api';
import { QuizCard } from '../components/QuizCard';
import { buildTeacherFilename, getTeacherAssetUrl } from '../utils/assets';

const teacherImages = Array.from({ length: 12 }, (_, index) =>
  getTeacherAssetUrl(buildTeacherFilename(index))
);

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

const quizTypes = ['MCQ', 'SHORT', 'OX', 'CLOZE', 'ORDER', 'MATCH'];

// 샘플 퀴즈 데이터 (QuizItem 형식에 맞게 수정)
const sampleQuizzes: QuizItem[] = [
  {
    id: 1,
    content_id: 1,
    type: 'MCQ',
    payload: {
      question: '고구려를 건국한 인물은 누구인가?',
      options: ['주몽', '온조', '박혁거세', '김수로'],
      answer: 0
    },
    created_at: new Date().toISOString(),
    visibility: 'PUBLIC',
    owner_id: 1
  },
  {
    id: 2,
    content_id: 1,
    type: 'SHORT',
    payload: {
      prompt: '조선 전기 과거제도의 최고 시험은?',
      answer: '대과(문과)'
    },
    created_at: new Date().toISOString(),
    visibility: 'PUBLIC',
    owner_id: 1
  },
  {
    id: 3,
    content_id: 1,
    type: 'OX',
    payload: {
      statement: '세종대왕이 훈민정음을 창제했다.',
      answer: true
    },
    created_at: new Date().toISOString(),
    visibility: 'PUBLIC',
    owner_id: 1
  },
  {
    id: 4,
    content_id: 1,
    type: 'CLOZE',
    payload: {
      text: '1392년 {{c1::이성계}}가 조선을 건국하였다.'
    },
    created_at: new Date().toISOString(),
    visibility: 'PUBLIC',
    owner_id: 1
  },
  {
    id: 5,
    content_id: 1,
    type: 'ORDER',
    payload: {
      items: ['고구려 건국', '백제 건국', '신라 건국', '가야 건국']
    },
    created_at: new Date().toISOString(),
    visibility: 'PUBLIC',
    owner_id: 1
  },
  {
    id: 6,
    content_id: 1,
    type: 'MATCH',
    payload: {
      pairs: [
        { left: '세종대왕', right: '훈민정음' },
        { left: '이순신', right: '거북선' },
        { left: '장보고', right: '청해진' }
      ]
    },
    created_at: new Date().toISOString(),
    visibility: 'PUBLIC',
    owner_id: 1
  }
];

// 샘플 퀴즈 렌더링 함수
const renderSampleQuiz = (quiz: QuizItem) => {
  if (!quiz) return <div className="text-sm text-slate-600">퀴즈를 불러오는 중...</div>;

  // Use QuizCard for MCQ type quizzes
  if (quiz.type === 'MCQ') {
    return <QuizCard quiz={quiz} />;
  }

  // For other quiz types, use the existing renderer
  switch (quiz.type) {
    case 'SHORT':
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-800">{quiz.payload.prompt}</p>
          <div className="p-2 rounded bg-slate-50 border border-slate-200">
            <input 
              type="text" 
              placeholder="답을 입력하세요..." 
              className="w-full text-xs bg-transparent border-none outline-none"
              disabled
            />
          </div>
        </div>
      );
    
    case 'OX':
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-800">{quiz.payload.statement}</p>
          <div className="flex gap-2">
            <div className="flex-1 p-2 rounded bg-slate-50 text-center text-xs font-medium">O</div>
            <div className="flex-1 p-2 rounded bg-slate-50 text-center text-xs font-medium">X</div>
          </div>
        </div>
      );
    
    case 'CLOZE':
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-800">
            {quiz.payload.text?.replace(/\{\{c\d+::(.*?)\}\}/g, '____')}
          </p>
          <div className="p-2 rounded bg-slate-50 border border-slate-200">
            <input 
              type="text" 
              placeholder="빈칸을 채우세요..." 
              className="w-full text-xs bg-transparent border-none outline-none"
              disabled
            />
          </div>
        </div>
      );
    
    case 'ORDER':
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-800">올바른 순서로 배열하세요</p>
          <div className="space-y-1">
            {quiz.payload.items?.map((item: string, idx: number) => (
              <div key={idx} className="p-2 rounded bg-slate-50 text-xs border border-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>
      );
    
    case 'MATCH':
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-800">올바른 짝을 맞추세요</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              {quiz.payload.pairs?.map((pair: any, idx: number) => (
                <div key={idx} className="p-2 rounded bg-slate-50 text-xs border border-slate-200">
                  {pair.left}
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {quiz.payload.pairs?.map((pair: any, idx: number) => (
                <div key={idx} className="p-2 rounded bg-slate-50 text-xs border border-slate-200">
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

export default function HomePage() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isStudyMode, setIsStudyMode] = useState(true); // true: 학습 중, false: 학습 완료
  const [currentTeacher, setCurrentTeacher] = useState(0);
  const [currentQuiz, setCurrentQuiz] = useState(0);

  // 슬라이드 자동 전환
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide(prev => {
        const nextSlide = (prev + 1) % 2; // 0: 학습 중, 1: 학습 완료
        setIsStudyMode(nextSlide === 0);
        
        // 새로운 슬라이드마다 랜덤 teacher와 quiz 선택
        setCurrentTeacher(Math.floor(Math.random() * teacherImages.length));
        setCurrentQuiz(Math.floor(Math.random() * sampleQuizzes.length));
        
        return nextSlide;
      });
    }, 4000); // 4초마다 전환

    return () => clearInterval(interval);
  }, []);

  // 초기 랜덤 설정
  useEffect(() => {
    setCurrentTeacher(Math.floor(Math.random() * teacherImages.length));
    setCurrentQuiz(Math.floor(Math.random() * sampleQuizzes.length));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      {/* Hero Section */}
      <section className="w-full py-12">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-center text-primary-600">
            HiStudyCard
          </h1>
          <p className="text-lg md:text-xl text-center text-slate-600 mt-4">
            한국사 학습을 위한 스마트 카드 시스템
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center space-y-12">
          {/* 학습 페이지 슬라이드 */}
          <div className="w-full max-w-7xl relative overflow-hidden rounded-2xl shadow-2xl bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="relative h-96 md:h-[500px]">
              {/* 슬라이드 인디케이터 */}
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                <div className={`w-3 h-3 rounded-full transition-all ${isStudyMode ? 'bg-primary-500' : 'bg-white/50'}`}></div>
                <div className={`w-3 h-3 rounded-full transition-all ${!isStudyMode ? 'bg-primary-500' : 'bg-white/50'}`}></div>
              </div>
              
              {/* 학습 중 슬라이드 */}
              <div className={`absolute inset-0 transition-transform duration-1000 ease-in-out ${isStudyMode ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-full px-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* 왼쪽: Teacher 이미지 */}
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      <img 
                        src={teacherImages[currentTeacher]} 
                        alt="Teacher" 
                        className="w-full max-w-xs h-auto object-contain drop-shadow-lg"
                      />
                      <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-full px-4 py-2 shadow-lg border border-slate-200">
                        <p className="text-sm font-medium text-slate-700">
                          {getQuizTypeLabel(sampleQuizzes[currentQuiz]?.type)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 오른쪽: 퀴즈 카드 */}
                  <div className="flex items-center justify-center">
                    <div className={`w-full max-w-sm rounded-2xl border-2 shadow-xl p-6 ${getQuizTypeColor(sampleQuizzes[currentQuiz]?.type)}`}>
                      {/* 카드 헤더 */}
                      <div className="text-center mb-4">
                        <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm">
                          <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                          <span className="text-xs font-semibold text-slate-700">학습 중</span>
                        </div>
                      </div>

                      {/* 퀴즈 콘텐츠 (예시) */}
                      <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-sm">
                        {renderSampleQuiz(sampleQuizzes[currentQuiz])}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 학습 완료 슬라이드 */}
              <div className={`absolute inset-0 transition-transform duration-1000 ease-in-out ${!isStudyMode ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="h-full px-4 grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* 왼쪽: Teacher 이미지 */}
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      <img 
                        src={teacherImages[currentTeacher]} 
                        alt="Teacher" 
                        className="w-full max-w-xs h-auto object-contain drop-shadow-lg"
                      />
                      <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-white rounded-full px-4 py-2 shadow-lg border border-slate-200">
                        <p className="text-sm font-bold text-emerald-600">🏆 훌륭해요!</p>
                      </div>
                    </div>
                  </div>

                  {/* 오른쪽: 결과 카드 */}
                  <div className="flex items-center justify-center">
                    <div className="w-full max-w-sm bg-gradient-to-br from-white to-slate-50 rounded-2xl border-2 border-slate-200 shadow-xl p-6">
                      {/* 점수 표시 */}
                      <div className="text-center mb-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full text-xl font-bold text-white shadow-lg bg-gradient-to-br from-emerald-400 to-emerald-600">
                          95%
                        </div>
                      </div>

                      {/* 완료 메시지 */}
                      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
                        <h3 className="text-sm font-semibold text-slate-800 mb-2 text-center">🎉 학습 완료!</h3>
                        <p className="text-xs text-slate-600 text-center">점수: 19 / 20 (95%)</p>
                      </div>

                      {/* 버튼 (비활성화) */}
                      <div className="space-y-2">
                        <div className="w-full rounded-lg bg-primary-400 px-4 py-2 text-xs font-semibold text-white text-center opacity-75">
                          🔄 다시 학습하기
                        </div>
                        <div className="w-full rounded-lg border border-primary-400 px-4 py-2 text-xs font-semibold text-primary-400 text-center opacity-75">
                          📚 학습 리스트로 돌아가기
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="text-center max-w-2xl space-y-6">
            <h2 className="text-2xl md:text-3xl font-semibold text-slate-800">
              효율적인 한국사 학습의 시작
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              AI 기반 퀴즈 생성과 체계적인 학습 관리로 
              한국사를 더 쉽고 재미있게 공부하세요.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl mt-16">
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

      {/* Footer */}
      <footer className="w-full py-8 mt-16 border-t border-slate-200">
        <div className="container mx-auto px-4 text-center">
          <p className="text-slate-500">
            © {new Date().getFullYear()} HiStudyCard.
          </p>
        </div>
      </footer>
    </div>
  );
}
