import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  fetchQuizzes,
  fetchStudySessions,
  createStudySession,
  deleteQuizRequest,
  fetchContent,
  fetchContents,
  fetchCardDecksRequest,
  updateStudySessionRequest,
  type QuizItem,
  type StudySession,
  type CardDeck,
} from '../api';
import Badge from '../components/Badge';
import CardPreview from '../components/CardPreview';
import { getQuizTypeLabel } from '../utils/quiz';
import { useAuth } from '../context/AuthContext';
import { useLearningHelpers } from '../hooks/useLearningHelpers';

const PAGE_SIZE = 40;



export default function QuizListPage() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Awaited<ReturnType<typeof fetchQuizzes>>['items']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ page: number; size: number; total: number }>({
    page: 1,
    size: PAGE_SIZE,
    total: 0,
  });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [selectedDetails, setSelectedDetails] = useState<Record<number, QuizItem>>({});
  const [saving, setSaving] = useState(false);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [targetQuiz, setTargetQuiz] = useState<QuizItem | null>(null);
  const [selection, setSelection] = useState<'existing' | 'new'>('existing');
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionHelperId, setNewSessionHelperId] = useState<number | null>(user?.selected_helper_id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sessionTitleInput, setSessionTitleInput] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [cardDecks, setCardDecks] = useState<CardDeck[]>([]);
  const [selectedCardDeckId, setSelectedCardDeckId] = useState<number | null>(null);
  const [newSessionCardDeckId, setNewSessionCardDeckId] = useState<number | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [newSessionIsPublic, setNewSessionIsPublic] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [contentTitles, setContentTitles] = useState<Record<number, string>>({});
  const [activePeriod, setActivePeriod] = useState<string>('전체');
  const [activeQuizType, setActiveQuizType] = useState<string>('전체');

  const periods = ['전체', '고대', '고려', '조선', '근대', '현대'];
  const quizTypes = [
    { value: '전체', label: '전체' },
    { value: 'MCQ', label: '객관식' },
    { value: 'SHORT', label: '주관식' },
    { value: 'OX', label: 'OX' },
    { value: 'CLOZE', label: '빈칸채우기' },
    { value: 'ORDER', label: '순서맞추기' },
    { value: 'MATCH', label: '짝맞추기' },
  ];
  const [showQuizCreateModal, setShowQuizCreateModal] = useState(false);
  const [showContentSelectModal, setShowContentSelectModal] = useState(false);
  const [showQuizTypeModal, setShowQuizTypeModal] = useState(false);
  const [selectedContentForQuiz, setSelectedContentForQuiz] = useState<number | null>(null);
  const [selectedQuizType, setSelectedQuizType] = useState<string>('');
  const [contents, setContents] = useState<any[]>([]);
  const [contentsLoading, setContentsLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    helpers: helperOptions,
    loading: helperLoading,
    error: helperFetchError,
  } = useLearningHelpers();

  useEffect(() => {
    if (!helperOptions.length) {
      return;
    }
    const defaultId =
      user?.selected_helper_id ??
      helperOptions.find((item) => item.unlocked)?.id ??
      helperOptions[0]?.id ??
      null;
    if (showModal && selection === 'new' && newSessionHelperId == null) {
      setNewSessionHelperId(defaultId);
    }
    if (showCreateModal && newSessionHelperId == null) {
      setNewSessionHelperId(defaultId);
    }
  }, [helperOptions, showModal, showCreateModal, selection, user?.selected_helper_id, newSessionHelperId]);

  useEffect(() => {
    const loadCardDecks = async () => {
      if (!user) return; // 로그인한 사용자만 카드덱 로드
      
      try {
        const response = await fetchCardDecksRequest(1, 100);
        setCardDecks(response.items);
        // 기본 카드덱을 선택
        const defaultDeck = response.items.find(deck => deck.is_default);
        if (defaultDeck) {
          setSelectedCardDeckId(defaultDeck.id);
          setNewSessionCardDeckId(defaultDeck.id);
        }
      } catch (err) {
        console.error('카드덱 로딩 실패:', err);
      }
    };
    loadCardDecks();
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQuizzes(page, PAGE_SIZE);
      setQuizzes(data.items);
      setMeta(data.meta);
      
      // 콘텐츠 타이틀과 eras 정보 로드 (content_id가 null이 아닌 것만)
      const contentIds = [...new Set(data.items.map(quiz => quiz.content_id).filter(id => id !== null))];
      const contentPromises = contentIds.map(async (contentId) => {
        try {
          const content = await fetchContent(contentId);
          return { 
            id: contentId, 
            title: content.title,
            eras: content.eras || []
          };
        } catch {
          return { 
            id: contentId, 
            title: `콘텐츠 #${contentId}`,
            eras: []
          };
        }
      });
      
      const contentData = await Promise.all(contentPromises);
      const titleMap = contentData.reduce((acc, { id, title }) => {
        acc[id] = title;
        return acc;
      }, {} as Record<number, string>);
      
      // 콘텐츠별 eras 정보도 저장
      const contentErasMap = contentData.reduce((acc, { id, eras }) => {
        acc[id] = eras;
        return acc;
      }, {} as Record<number, any[]>);
      
      setContentTitles(titleMap);
      // 콘텐츠 eras 정보를 퀴즈에 연결
      const enrichedQuizzes = data.items.map(quiz => ({
        ...quiz,
        contentEras: quiz.content_id ? contentErasMap[quiz.content_id] || [] : []
      }));
      setQuizzes(enrichedQuizzes);
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '퀴즈 목록을 불러오지 못했습니다.';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  }, [page, user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
    setSelected({});
    setSelectedDetails({});
    if (!user) {
      setShowModal(false);
      setShowCreateModal(false);
      setTargetQuiz(null);
      setSelection('existing');
      setSelectedSessionId(null);
      setNewSessionTitle('');
      setSessionError(null);
    }
  }, [user]);

  useEffect(() => {
    if (!showModal) return;
    if (selection !== 'existing') return;
    if (sessionsLoading) return;
    if (sessionError) return;
    if (!studySessions.length) return;
    if (selectedSessionId) return;
    setSelectedSessionId(studySessions[0].id);
  }, [showModal, selection, sessionsLoading, sessionError, studySessions, selectedSessionId]);

  useEffect(() => {
    if (!showModal) return;
    if (sessionsLoading) return;
    if (sessionError) return;
    if (studySessions.length) return;
    setSelection('new');
  }, [showModal, sessionsLoading, sessionError, studySessions]);

  const toggleSelection = (checked: boolean, quiz: QuizItem) => {
    const id = quiz.id;
    setSelected((prev) => {
      if (checked) {
        return { ...prev, [id]: true };
      }
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSelectedDetails((prev) => {
      if (checked) {
        return { ...prev, [id]: quiz };
      }
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const selectedQuizzes = useMemo(() => Object.values(selectedDetails), [selectedDetails]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    quizzes.forEach((quiz) => {
      const payloadTags = Array.isArray((quiz.payload as any)?.tags) ? (quiz.payload as any).tags : [];
      payloadTags.forEach((tag: string) => {
        if (tag && typeof tag === 'string' && tag.trim()) {
          tags.add(tag);
        }
      });
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [quizzes]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  };

  const filteredQuizzes = useMemo(() => {
    let filtered = quizzes;
    
    // 시대별 필터링
    if (activePeriod !== '전체') {
      filtered = filtered.filter((quiz) => {
        if (!quiz.content_id) return false; // 독립 퀴즈는 시대별 필터에서 제외
        const contentEras = (quiz as any).contentEras || [];
        return contentEras.some((era: any) => era.period === activePeriod);
      });
    }
    
    // 퀴즈 타입별 필터링
    if (activeQuizType !== '전체') {
      filtered = filtered.filter((quiz) => quiz.type === activeQuizType);
    }
    
    // 태그 필터링
    if (activeTags.length) {
      filtered = filtered.filter((quiz) => {
        const payloadTags = Array.isArray((quiz.payload as any)?.tags) ? (quiz.payload as any).tags : [];
        return activeTags.every((tag) => payloadTags.includes(tag));
      });
    }
    
    return filtered;
  }, [quizzes, activeTags, activePeriod, activeQuizType]);

  const loadStudySessions = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      navigate('/auth', { state: { from: location } });
      return;
    }
    setSessionsLoading(true);
    setSessionError(null);
    try {
      const data = await fetchStudySessions(1, 100);
      setStudySessions(data.items);
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '학습 목록을 불러오지 못했습니다.';
      setSessionError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleOpenModal = (quiz: QuizItem) => {
    if (!user) {
      alert('학습 기능을 사용하려면 로그인해주세요.');
      navigate('/auth', { state: { from: location } });
      return;
    }
    setTargetQuiz(quiz);
    setSelection('existing');
    setSelectedSessionId(null);
    setNewSessionTitle('');
    const defaultHelperId =
      user?.selected_helper_id ??
      helperOptions.find((item) => item.unlocked)?.id ??
      helperOptions[0]?.id ??
      null;
    setNewSessionHelperId(defaultHelperId);
    void loadStudySessions();
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setTargetQuiz(null);
    setSubmitting(false);
    setSessionError(null);
    setSelectedSessionId(null);
    setNewSessionHelperId(user?.selected_helper_id ?? null);
    setIsPublic(false);
  };

  const normalizedTargetCard = useMemo(() => {
    if (!targetQuiz) return null;
    const { payload, id, type, content_id } = targetQuiz;
    const base = { ...payload, id, type, content_id };
    if (typeof (base as any).attempts !== 'number') {
      (base as any).attempts = 0;
    }
    if (typeof (base as any).correct !== 'number') {
      (base as any).correct = 0;
    }
    return base as typeof payload & {
      id: number;
      type: string;
      content_id: number;
      attempts: number;
      correct: number;
    };
  }, [targetQuiz]);

  const handleSubmitSingle = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      navigate('/auth', { state: { from: location } });
      return;
    }
    if (!normalizedTargetCard) return;
    if (selection === 'existing') {
      if (!selectedSessionId) {
        alert('학습 세트를 선택하세요.');
        return;
      }
      const session = studySessions.find((item) => item.id === selectedSessionId);
      if (!session) {
        alert('선택한 학습 세트를 찾을 수 없습니다.');
        return;
      }
      if (session.quiz_ids?.includes(normalizedTargetCard.id)) {
        alert('이미 존재합니다.');
        handleCloseModal();
        return;
      }
      setSubmitting(true);
      try {
        // Create the update payload
        const updatePayload: any = {
          quiz_ids: [...session.quiz_ids, normalizedTargetCard.id]
        };

        // Only include cards if they exist in the session
        if (Array.isArray(session.cards)) {
          updatePayload.cards = [...session.cards, normalizedTargetCard];
        }

        const updated = await updateStudySessionRequest(session.id, updatePayload);
        
        // Update the local state with the updated session
        setStudySessions((prev) => 
          prev.map((item) => (item.id === session.id ? updated : item))
        );
        
        alert('학습 세트에 추가되었습니다.');
        handleCloseModal();
      } catch (err: any) {
        console.error('Error updating study session:', err);
        let errorMessage = '학습 세트 업데이트에 실패했습니다.';
        
        if (err?.response?.data?.detail) {
          errorMessage = typeof err.response.data.detail === 'string' 
            ? err.response.data.detail 
            : JSON.stringify(err.response.data.detail);
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        alert(errorMessage);
        setSubmitting(false);
      }
      return;
    }

    const title = newSessionTitle.trim() || `학습 ${new Date().toLocaleString()}`;
    const helperIdForCreation =
      newSessionHelperId ??
      user?.selected_helper_id ??
      helperOptions.find((item) => item.unlocked)?.id ??
      helperOptions[0]?.id ??
      null;
    const helperRecord = helperIdForCreation
      ? helperOptions.find((item) => item.id === helperIdForCreation)
      : null;
    if (helperRecord && !helperRecord.unlocked) {
      alert('현재 레벨에서 사용할 수 없는 학습 도우미입니다.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createStudySession({
        title,
        quiz_ids: [normalizedTargetCard.id],
        cards: [normalizedTargetCard],
        helper_id: helperIdForCreation ?? undefined,
        card_deck_id: newSessionCardDeckId ?? undefined,
        is_public: isPublic,
      });
      setStudySessions((prev) => [created, ...prev]);
      alert('새 학습 세트가 생성되었습니다.');
      handleCloseModal();
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '학습 세트를 생성하지 못했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
      setSubmitting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(meta.total / PAGE_SIZE));
  const canGoPrev = page > 1;
  const canGoNext = page < totalPages;

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(1, page - 2);
      const end = Math.min(totalPages, start + maxVisiblePages - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  const handleNavigateToContent = async (contentId: number) => {
    try {
      const content = await fetchContent(contentId);
      navigate(`/contents/${contentId}`, { state: { content } });
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404 || status === 403) {
        alert('비공개 콘텐츠입니다.');
        return;
      }
      const message = err?.response?.data?.detail ?? err?.message ?? '콘텐츠를 불러오지 못했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    }
  };

  const handleEditMode = useCallback(() => {
    if (editMode) {
      // 편집 모드 종료
      setEditMode(false);
      setSelected({});
      setSelectedDetails({});
    } else {
      // 편집 모드 시작
      setEditMode(true);
    }
  }, [editMode]);

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedQuizzes.length) {
      alert('선택된 퀴즈가 없습니다.');
      return;
    }
    
    if (!confirm(`선택된 ${selectedQuizzes.length}개의 퀴즈를 삭제하시겠습니까?`)) {
      return;
    }
    
    try {
      await Promise.all(selectedQuizzes.map(quiz => deleteQuizRequest(quiz.id)));
      setSelected({});
      setSelectedDetails({});
      load();
      alert('선택된 퀴즈가 삭제되었습니다.');
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '퀴즈 삭제에 실패했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    }
  }, [selectedQuizzes, load]);

  const handleDeleteSingle = useCallback(async (quizId: number) => {
    if (!confirm('이 퀴즈를 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      await deleteQuizRequest(quizId);
      load();
      alert('퀴즈가 삭제되었습니다.');
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '퀴즈 삭제에 실패했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    }
  }, [load]);

  const handleAddToStudy = useCallback(async () => {
    if (!user) {
      alert('학습 기능을 사용하려면 로그인해주세요.');
      navigate('/auth', { state: { from: location } });
      return;
    }
    if (selectedQuizzes.length === 0) {
      alert('학습 리스트에 추가할 퀴즈를 선택하세요.');
      return;
    }
    const defaultTitle = `학습 ${new Date().toLocaleString()}`;
    setSessionTitleInput(defaultTitle);
    const defaultHelperId =
      user?.selected_helper_id ??
      helperOptions.find((item) => item.unlocked)?.id ??
      helperOptions[0]?.id ??
      null;
    setNewSessionHelperId(defaultHelperId);
    setShowCreateModal(true);
  }, [selectedQuizzes, user, navigate, location, helperOptions]);

  const handleCreateQuiz = useCallback(() => {
    if (!user) {
      alert('퀴즈 생성 기능을 사용하려면 로그인해주세요.');
      navigate('/auth', { state: { from: location } });
      return;
    }
    setShowQuizCreateModal(true);
  }, [user, navigate, location]);

  const handleContentSelect = useCallback(async (contentId: number | null) => {
    setSelectedContentForQuiz(contentId);
    setShowContentSelectModal(false);
    setSelectedQuizType('MCQ'); // 기본값 설정
    setShowQuizTypeModal(true);
  }, []);

  const handleQuizTypeSelect = useCallback((quizType: string) => {
    setShowQuizTypeModal(false);
    
    // 퀴즈 만들기 페이지로 이동
    if (selectedContentForQuiz) {
      navigate(`/quizzes/create?content=${selectedContentForQuiz}&type=${quizType}`);
    } else {
      navigate(`/quizzes/create?type=${quizType}`);
    }
    
    // 상태 초기화
    setSelectedContentForQuiz(null);
    setSelectedQuizType('');
    setShowQuizCreateModal(false);
  }, [selectedContentForQuiz, navigate]);

  const loadContents = useCallback(async () => {
    if (!user) return;
    
    setContentsLoading(true);
    try {
      const response = await fetchContents(1, 100);
      setContents(response.items);
    } catch (err: any) {
      console.error('콘텐츠 로딩 실패:', err);
    } finally {
      setContentsLoading(false);
    }
  }, [user]);

  const renderModal = () => {
    if (!normalizedTargetCard) {
      return null;
    }
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-900 shadow-xl">
          <header className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-primary-600">학습에 추가</h3>
              <p className="text-xs text-slate-500">{getQuizTypeLabel(normalizedTargetCard.type)} · #{normalizedTargetCard.id}</p>
            </div>
            <button
              type="button"
              onClick={handleCloseModal}
              className="text-sm text-slate-500 transition hover:text-slate-700"
            >
              닫기
            </button>
          </header>

          <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <CardPreview card={normalizedTargetCard} />
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-primary-600">학습 세트 선택</p>
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-xs text-slate-600">
                <input
                  type="radio"
                  name="quiz-single-mode"
                  checked={selection === 'existing'}
                  onChange={() => setSelection('existing')}
                  className="mt-1"
                />
                <span>기존 학습 세트에 추가</span>
              </label>
              {selection === 'existing' ? (
                <div className="max-h-40 space-y-2 overflow-y-auto rounded border border-slate-200 p-2 text-xs">
                  {sessionsLoading ? (
                    <p className="text-slate-500">학습 목록을 불러오는 중…</p>
                  ) : sessionError ? (
                    <p className="text-rose-600">{sessionError}</p>
                  ) : studySessions.length ? (
                    studySessions.map((session) => (
                      <label key={session.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-slate-100">
                        <span className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="quiz-session-id"
                            value={session.id}
                            checked={selectedSessionId === session.id}
                            onChange={() => setSelectedSessionId(session.id)}
                          />
                          <span className="font-medium text-slate-900">{session.title}</span>
                        </span>
                        <span className="text-[11px] text-slate-500">카드 {session.cards.length}개</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-slate-500">등록된 학습 세트가 없습니다.</p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-2 text-xs text-slate-600">
                <input
                  type="radio"
                  name="quiz-single-mode"
                  checked={selection === 'new'}
                  onChange={() => setSelection('new')}
                  className="mt-1"
                />
                <span>새 학습 세트 생성</span>
              </label>
              {selection === 'new' ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newSessionTitle}
                    onChange={(event) => setNewSessionTitle(event.target.value)}
                    placeholder="새 학습 세트 이름"
                    className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">학습 도우미 선택</label>
                    <select
                      value={newSessionHelperId ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setNewSessionHelperId(value ? Number(value) : null);
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      disabled={helperLoading}
                    >
                      {helperOptions.map((helper) => (
                        <option key={helper.id} value={helper.id} disabled={!helper.unlocked}>
                          {helper.name} {helper.unlocked ? '' : '(잠금)'}
                        </option>
                      ))}
                      {!helperOptions.length ? <option value="">사용 가능한 학습 도우미가 없습니다</option> : null}
                    </select>
                    {helperLoading ? (
                      <p className="text-[11px] text-slate-500">학습 도우미 정보를 불러오는 중…</p>
                    ) : null}
                    {helperFetchError ? (
                      <p className="text-[11px] text-rose-600">{helperFetchError}</p>
                    ) : null}
                    <p className="text-[10px] text-slate-400">선택하지 않으면 Level 1 학습 도우미가 적용됩니다.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">카드덱 선택</label>
                    <select
                      value={newSessionCardDeckId ?? ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setNewSessionCardDeckId(value ? parseInt(value, 10) : null);
                      }}
                      className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">기본 카드덱</option>
                      {cardDecks.map((deck) => (
                        <option key={deck.id} value={deck.id}>
                          {deck.name} {deck.is_default ? '(기본)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400">카드의 앞뒤면 디자인을 선택합니다.</p>
                  </div>
                  {user?.is_admin && (
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
                        <input
                          type="checkbox"
                          checked={isPublic}
                          onChange={(event) => setIsPublic(event.target.checked)}
                          className="h-3 w-3 accent-primary-500"
                        />
                        공개 학습으로 생성
                      </label>
                      <p className="text-[10px] text-slate-400">공개 학습은 로그인 없이 누구나 접근할 수 있습니다.</p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCloseModal}
              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
              disabled={submitting}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmitSingle}
              className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={submitting}
            >
              {submitting ? '처리 중…' : '추가하기'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const handleCreateModalClose = () => {
    if (!saving) {
      setShowCreateModal(false);
      setNewSessionHelperId(user?.selected_helper_id ?? null);
      setNewSessionIsPublic(false);
    }
  };

  const handleCreateConfirm = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      navigate('/auth', { state: { from: location } });
      return;
    }
    if (selectedQuizzes.length === 0) {
      setShowCreateModal(false);
      return;
    }
    const helperIdForCreation =
      newSessionHelperId ??
      user?.selected_helper_id ??
      helperOptions.find((item) => item.unlocked)?.id ??
      helperOptions[0]?.id ??
      null;
    const helperRecord = helperIdForCreation
      ? helperOptions.find((item) => item.id === helperIdForCreation)
      : null;
    if (helperRecord && !helperRecord.unlocked) {
      alert('현재 레벨에서 사용할 수 없는 학습 도우미입니다.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: sessionTitleInput.trim() || `학습 ${new Date().toLocaleString()}`,
        quiz_ids: selectedQuizzes.map((quiz) => quiz.id),
        cards: selectedQuizzes.map((quiz) => ({
          ...quiz.payload,
          id: quiz.id,
          type: quiz.type,
          content_id: quiz.content_id,
        })),
        helper_id: helperIdForCreation ?? undefined,
        card_deck_id: selectedCardDeckId ?? undefined,
        is_public: newSessionIsPublic,
      };
      await createStudySession(payload);
      alert('학습 리스트에 추가되었습니다.');
      setSelected({});
      setSelectedDetails({});
      setShowCreateModal(false);
      navigate('/studies');
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '학습 리스트에 추가하지 못했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setSaving(false);
    }
  };

  const renderQuizCreateModal = () => {
    if (!showQuizCreateModal) return null;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-900 shadow-xl">
          <header className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-primary-600">퀴즈 생성 방식 선택</h3>
            <button
              type="button"
              onClick={() => setShowQuizCreateModal(false)}
              className="text-sm text-slate-500 transition hover:text-slate-700"
            >
              닫기
            </button>
          </header>
          
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setShowQuizCreateModal(false);
                setShowContentSelectModal(true);
                loadContents();
              }}
              className="w-full rounded border border-primary-500 bg-primary-50 p-4 text-left transition hover:bg-primary-100"
            >
              <div className="font-semibold text-primary-700">콘텐츠 기반 퀴즈 생성</div>
              <div className="text-sm text-primary-600">기존 콘텐츠를 선택하여 퀴즈를 만듭니다</div>
            </button>
            
            <button
              type="button"
              onClick={() => {
                setShowQuizCreateModal(false);
                setSelectedQuizType('MCQ'); // 기본값 설정
                setShowQuizTypeModal(true);
              }}
              className="w-full rounded border border-slate-300 bg-slate-50 p-4 text-left transition hover:bg-slate-100"
            >
              <div className="font-semibold text-slate-700">독립 퀴즈 생성</div>
              <div className="text-sm text-slate-600">콘텐츠 없이 퀴즈만 만듭니다</div>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderContentSelectModal = () => {
    if (!showContentSelectModal) return null;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-2xl space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-900 shadow-xl">
          <header className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-primary-600">콘텐츠 선택</h3>
            <button
              type="button"
              onClick={() => setShowContentSelectModal(false)}
              className="text-sm text-slate-500 transition hover:text-slate-700"
            >
              닫기
            </button>
          </header>
          
          {contentsLoading ? (
            <p className="text-center text-sm text-slate-600">콘텐츠를 불러오는 중...</p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {contents.map((content) => (
                <button
                  key={content.id}
                  type="button"
                  onClick={() => handleContentSelect(content.id)}
                  className="w-full rounded border border-slate-200 p-3 text-left transition hover:border-primary-500 hover:bg-primary-50"
                >
                  <div className="font-semibold text-slate-900">{content.title}</div>
                  <div className="text-sm text-slate-600">{content.description || '설명 없음'}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderQuizTypeModal = () => {
    if (!showQuizTypeModal) return null;
    
    const quizTypes = [
      { value: 'MCQ', label: '객관식' },
      { value: 'SHORT', label: '주관식' },
      { value: 'OX', label: 'OX' },
      { value: 'CLOZE', label: '빈칸채우기' },
      { value: 'ORDER', label: '순서맞추기' },
      { value: 'MATCH', label: '짝맞추기' },
    ];
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-900 shadow-xl">
          <header className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-primary-600">추가할 퀴즈 형식</h3>
            <button
              type="button"
              onClick={() => setShowQuizTypeModal(false)}
              className="text-sm text-slate-500 transition hover:text-slate-700"
            >
              닫기
            </button>
          </header>
          
          <div className="space-y-2">
            {quizTypes.map((type, index) => (
              <label
                key={type.value}
                className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <span>{type.label}</span>
                <input
                  type="radio"
                  name="quiz-type"
                  value={type.value}
                  checked={selectedQuizType === type.value}
                  onChange={() => setSelectedQuizType(type.value)}
                  className="h-4 w-4 accent-primary-500"
                />
              </label>
            ))}
          </div>
          
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowQuizTypeModal(false)}
              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => selectedQuizType && handleQuizTypeSelect(selectedQuizType)}
              disabled={!selectedQuizType}
              className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:opacity-50"
            >
              만들기
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return <p className="text-sm text-slate-600">불러오는 중…</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }

  return (
    <>
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary-600">퀴즈 리스트</h2>
            <p className="text-xs text-slate-500">
              총 {meta.total}개 · 페이지 {page} / {totalPages}
              {(activePeriod !== '전체' || activeQuizType !== '전체') && 
                ` (필터링됨: ${filteredQuizzes.length}개)`
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user && editMode ? (
              <>
                <button
                  type="button"
                  onClick={handleAddToStudy}
                  disabled={!selectedQuizzes.length || saving}
                  className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  학습 리스트에 추가 ({selectedQuizzes.length})
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelected}
                  disabled={!selectedQuizzes.length || saving}
                  className="rounded bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  삭제 ({selectedQuizzes.length})
                </button>
                <button
                  type="button"
                  onClick={handleEditMode}
                  disabled={saving}
                  className="rounded bg-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  취소
                </button>
              </>
            ) : user && !editMode ? (
              <>
                <button
                  type="button"
                  onClick={handleCreateQuiz}
                  disabled={saving}
                  className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  퀴즈 추가
                </button>
                <button
                  type="button"
                  onClick={handleEditMode}
                  disabled={saving}
                  className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  편집
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* 시대별 탭 메뉴 */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-8 overflow-x-auto">
            {periods.map((period) => (
              <button
                key={period}
                onClick={() => setActivePeriod(period)}
                className={`whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium transition ${
                  activePeriod === period
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                {period}
              </button>
            ))}
          </nav>
        </div>

        {/* 퀴즈 타입별 탭 메뉴 */}
        <div className="border-b border-slate-200">
          <nav className="flex space-x-6 overflow-x-auto">
            {quizTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => setActiveQuizType(type.value)}
                className={`whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium transition ${
                  activeQuizType === type.value
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                {type.label}
              </button>
            ))}
          </nav>
        </div>

      {availableTags.length ? (
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => {
            const active = activeTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? 'border border-primary-500 bg-primary-100 text-primary-600'
                    : 'border border-slate-300 text-slate-600 hover:bg-slate-100'
                }`}
              >
                #{tag}
              </button>
            );
          })}
          {activeTags.length ? (
            <button
              type="button"
              onClick={() => setActiveTags([])}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
            >
              태그 초기화
            </button>
          ) : null}
        </div>
      ) : null}

      {filteredQuizzes.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredQuizzes.map((quiz) => {
            const cardData = { ...quiz.payload, type: quiz.type };
            const contentTitle = quiz.content_id 
              ? (contentTitles[quiz.content_id] || `콘텐츠 #${quiz.content_id}`)
              : '독립 퀴즈';
            return (
              <div
                key={quiz.id}
                className="relative flex flex-col rounded-lg border border-slate-200 bg-white p-4 transition hover:border-primary-500"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {editMode && (
                      <input
                        type="checkbox"
                        checked={!!selected[quiz.id]}
                        onChange={(event) => toggleSelection(event.currentTarget.checked, quiz)}
                        className="h-4 w-4 accent-primary-500"
                      />
                    )}
                    <Badge color={quiz.visibility === 'PUBLIC' ? 'success' : 'default'}>
                      {quiz.visibility === 'PUBLIC' ? '공개' : '비공개'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {quiz.content_id ? (
                      <button
                        type="button"
                        onClick={() => handleNavigateToContent(quiz.content_id)}
                        className="text-xs text-primary-600 hover:text-primary-800 hover:underline"
                      >
                        {contentTitle}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">
                        {contentTitle}
                      </span>
                    )}
                    {editMode && user?.id === quiz.owner_id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSingle(quiz.id)}
                        className="rounded border border-rose-500 px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex-1">
                  <CardPreview card={cardData} />
                </div>
                <p className="mt-3 text-xs text-slate-500"></p>
                <p className="mt-1 text-xs text-slate-500">{new Date(quiz.created_at).toLocaleString()}</p>
                <div className="mt-3 flex justify-end gap-2">
                  {!editMode && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenModal(quiz)}
                        className="rounded border border-primary-500 px-3 py-1 text-xs font-semibold text-primary-600 transition hover:bg-primary-50"
                      >
                        학습에 추가
                      </button>
                      {user?.id === quiz.owner_id && (
                        <button
                          type="button"
                          onClick={() => navigate(`/quizzes/${quiz.id}/edit?content=${quiz.content_id}`)}
                          className="rounded border border-sky-500 px-3 py-1 text-xs font-semibold text-sky-600 transition hover:bg-sky-500/10"
                        >
                          편집
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          {activePeriod !== '전체' || activeQuizType !== '전체' || activeTags.length > 0
            ? '선택한 필터 조건에 해당하는 퀴즈가 없습니다.'
            : '등록된 퀴즈가 없습니다.'
          }
        </p>
      )}
      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 mt-8">
          <button
            onClick={() => canGoPrev && setPage((prev) => Math.max(1, prev - 1))}
            disabled={!canGoPrev}
            className="px-3 py-2 text-sm font-medium text-slate-500 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            이전
          </button>
          
          {getPageNumbers().map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => setPage(pageNum)}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                pageNum === page
                  ? 'text-white bg-primary-600 border border-primary-600'
                  : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-50'
              }`}
            >
              {pageNum}
            </button>
          ))}
          
          <button
            onClick={() => canGoNext && setPage((prev) => prev + 1)}
            disabled={!canGoNext}
            className="px-3 py-2 text-sm font-medium text-slate-500 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            다음
          </button>
        </div>
      )}
      </section>
      {showModal && renderModal()}
      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-900 shadow-xl">
            <header className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-primary-600">새 학습 세트 제목</h3>
              <button
                type="button"
                onClick={handleCreateModalClose}
                className="text-sm text-slate-500 transition hover:text-slate-700"
                disabled={saving}
              >
                닫기
              </button>
            </header>
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              제목
              <input
                value={sessionTitleInput}
                onChange={(event) => setSessionTitleInput(event.target.value)}
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                autoFocus
              />
            </label>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">학습 도우미 선택</label>
              <select
                value={newSessionHelperId ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setNewSessionHelperId(value ? Number(value) : null);
                }}
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                disabled={helperLoading}
              >
                {helperOptions.map((helper) => (
                  <option key={helper.id} value={helper.id} disabled={!helper.unlocked}>
                    {helper.name} {helper.unlocked ? '' : '(잠금)'}
                  </option>
                ))}
                {!helperOptions.length ? <option value="">사용 가능한 학습 도우미가 없습니다</option> : null}
              </select>
              {helperLoading ? (
                <p className="text-[11px] text-slate-500">학습 도우미 정보를 불러오는 중…</p>
              ) : null}
              {helperFetchError ? (
                <p className="text-[11px] text-rose-600">{helperFetchError}</p>
              ) : null}
              <p className="text-[10px] text-slate-400">선택하지 않으면 Level 1 학습 도우미가 적용됩니다.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">카드덱 선택</label>
              <select
                value={selectedCardDeckId ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedCardDeckId(value ? parseInt(value, 10) : null);
                }}
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">기본 카드덱</option>
                {cardDecks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name} {deck.is_default ? '(기본)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400">카드의 앞뒤면 디자인을 선택합니다.</p>
            </div>
            {user?.is_admin && (
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={newSessionIsPublic}
                    onChange={(event) => setNewSessionIsPublic(event.target.checked)}
                    className="h-3 w-3 accent-primary-500"
                  />
                  공개 학습으로 생성
                </label>
                <p className="text-[10px] text-slate-400">공개 학습은 로그인 없이 누구나 접근할 수 있습니다.</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCreateModalClose}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
                disabled={saving}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCreateConfirm}
                className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={saving}
              >
                {saving ? '생성 중…' : '만들기'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      
      {renderQuizCreateModal()}
      {renderContentSelectModal()}
      {renderQuizTypeModal()}
    </>
  );
}
