import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  createStudySession,
  fetchQuizzes,
  fetchStudySessions,
  updateStudySessionRequest,
  deleteQuizRequest,
  type QuizItem,
  type StudySession,
} from '../api';
import Badge from '../components/Badge';
import CardPreview from '../components/CardPreview';
import { getQuizTypeLabel } from '../utils/quiz';
import { useAuth } from '../context/AuthContext';

const PAGE_SIZE = 40;

function getStem(quiz: any): string {
  const payload = quiz.payload ?? {};
  if (payload.question) return payload.question;
  if (payload.prompt) return payload.prompt;
  if (payload.statement) return payload.statement;
  if (typeof payload.text === 'string') {
    return payload.text.replace(/\{\{c\d+\}\}/g, '____');
  }
  return '설명 없음';
}

export default function QuizListPage() {
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
  const [submitting, setSubmitting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sessionTitleInput, setSessionTitleInput] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQuizzes(page, PAGE_SIZE);
      setQuizzes(data.items);
      setMeta(data.meta);
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

  const handleAddToStudy = async () => {
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
    setShowCreateModal(true);
  };

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
    if (!activeTags.length) {
      return quizzes;
    }
    return quizzes.filter((quiz) => {
      const payloadTags = Array.isArray((quiz.payload as any)?.tags) ? (quiz.payload as any).tags : [];
      return activeTags.every((tag) => payloadTags.includes(tag));
    });
  }, [quizzes, activeTags]);

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
    void loadStudySessions();
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setTargetQuiz(null);
    setSubmitting(false);
    setSessionError(null);
    setSelectedSessionId(null);
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
        const updated = await updateStudySessionRequest(session.id, {
          quiz_ids: [...session.quiz_ids, normalizedTargetCard.id],
          cards: [...session.cards, normalizedTargetCard],
        });
        setStudySessions((prev) => prev.map((item) => (item.id === session.id ? updated : item)));
        alert('학습 세트에 추가되었습니다.');
        handleCloseModal();
      } catch (err: any) {
        console.error(err);
        const message = err?.response?.data?.detail ?? '학습 세트 업데이트에 실패했습니다.';
        alert(typeof message === 'string' ? message : JSON.stringify(message));
        setSubmitting(false);
      }
      return;
    }

    const title = newSessionTitle.trim() || `학습 ${new Date().toLocaleString()}`;
    setSubmitting(true);
    try {
      const created = await createStudySession({
        title,
        quiz_ids: [normalizedTargetCard.id],
        cards: [normalizedTargetCard],
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
                <input
                  type="text"
                  value={newSessionTitle}
                  onChange={(event) => setNewSessionTitle(event.target.value)}
                  placeholder="새 학습 세트 이름"
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
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
            <h2 className="text-lg font-semibold text-primary-600">등록된 퀴즈</h2>
            <p className="text-xs text-slate-500">총 {meta.total}개 · 페이지 {page} / {totalPages}</p>
          </div>
          <button
            type="button"
            onClick={handleAddToStudy}
            disabled={saving}
            className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            학습 리스트에 추가
          </button>
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
            return (
              <div
                key={quiz.id}
                className="relative cursor-pointer rounded-lg border border-slate-200 bg-white p-4 transition hover:border-primary-500"
                onClick={() => navigate(`/contents/${quiz.content_id}`)}
              >
                <div className="absolute left-3 top-3">
                  <input
                    type="checkbox"
                    checked={!!selected[quiz.id]}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => toggleSelection(event.currentTarget.checked, quiz)}
                    className="h-4 w-4 accent-primary-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge color="primary">{getQuizTypeLabel(quiz.type)}</Badge>
                    <Badge color={quiz.visibility === 'PUBLIC' ? 'success' : 'default'}>
                      {quiz.visibility === 'PUBLIC' ? '공개' : '비공개'}
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-500">#{quiz.content_id}</span>
                </div>
                <div className="mt-3">
                  <CardPreview card={cardData} />
                </div>
                <p className="mt-3 text-xs text-slate-500">{getStem(quiz)}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(quiz.created_at).toLocaleString()}</p>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleOpenModal(quiz);
                    }}
                    className="rounded border border-primary-500 px-3 py-1 text-xs font-semibold text-primary-600 transition hover:bg-primary-50"
                  >
                    학습에 추가
                  </button>
                  {user?.id === quiz.owner_id ? (
                    <>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/quizzes/${quiz.id}/edit?content=${quiz.content_id}`);
                        }}
                        className="rounded border border-sky-500 px-3 py-1 text-xs font-semibold text-sky-600 transition hover:bg-sky-500/10"
                      >
                        편집
                      </button>
                      <button
                        type="button"
                        onClick={async (event) => {
                          event.stopPropagation();
                          if (!confirm('이 퀴즈를 삭제하시겠습니까?')) return;
                          try {
                            await deleteQuizRequest(quiz.id);
                            load();
                          } catch (err: any) {
                            console.error(err);
                            const message = err?.response?.data?.detail ?? '퀴즈를 삭제하지 못했습니다.';
                            alert(typeof message === 'string' ? message : JSON.stringify(message));
                          }
                        }}
                        className="rounded border border-rose-500 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10"
                      >
                        삭제
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-600">선택한 태그에 해당하는 퀴즈가 없습니다.</p>
      )}
      <div className="flex items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => canGoPrev && setPage((prev) => Math.max(1, prev - 1))}
          disabled={!canGoPrev}
          className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          이전
        </button>
        <span className="text-xs text-slate-500">{page} / {totalPages}</span>
        <button
          type="button"
          onClick={() => canGoNext && setPage((prev) => prev + 1)}
          disabled={!canGoNext}
          className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          다음
        </button>
      </div>
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
    </>
  );
}
