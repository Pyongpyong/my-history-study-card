import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  deleteContent,
  fetchContent,
  fetchContentCards,
  fetchStudySessions,
  createStudySession,
  updateStudySessionRequest,
  deleteQuizRequest,
  type StudySession,
  type ContentDetail,
} from '../api';
import Badge from '../components/Badge';
import CardPreview from '../components/CardPreview';
import { getQuizTypeLabel } from '../utils/quiz';
import { useAuth } from '../context/AuthContext';
import { useLearningHelpers } from '../hooks/useLearningHelpers';

export default function ContentDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [targetCard, setTargetCard] = useState<any | null>(null);
  const [selection, setSelection] = useState<'existing' | 'new'>('existing');
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionHelperId, setNewSessionHelperId] = useState<number | null>(user?.selected_helper_id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [showQuizTypeModal, setShowQuizTypeModal] = useState(false);
  const [selectedQuizTypeIndex, setSelectedQuizTypeIndex] = useState<number>(0);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    helpers: helperOptions,
    loading: helperLoading,
    error: helperFetchError,
  } = useLearningHelpers();

  useEffect(() => {
    if (!showModal) {
      return;
    }
    if (selection !== 'new') {
      return;
    }
    if (!helperOptions.length) {
      return;
    }
    const defaultId =
      user?.selected_helper_id ??
      helperOptions.find((item) => item.unlocked)?.id ??
      helperOptions[0]?.id ??
      null;
    setNewSessionHelperId((prev) => (prev == null ? defaultId : prev));
  }, [helperOptions, selection, showModal, user?.selected_helper_id]);

  const loadContent = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, cardList] = await Promise.all([fetchContent(id), fetchContentCards(id)]);
      setContent(detail);
      setCards(
        cardList.map((card: any) => ({
          ...card,
          attempts: typeof card?.attempts === 'number' ? card.attempts : 0,
          correct: typeof card?.correct === 'number' ? card.correct : 0,
        })),
      );
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '콘텐츠 정보를 불러오지 못했습니다.';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const normalizedCard = useMemo(() => {
    if (!targetCard) return null;
    const { attempts = 0, correct = 0, ...rest } = targetCard;
    return { ...rest, attempts, correct };
  }, [targetCard]);

  const handleDelete = async () => {
    if (!content) return;
    if (!confirm('해당 콘텐츠와 관련 퀴즈를 삭제할까요?')) return;
    try {
      await deleteContent(content.id);
      navigate('/contents', { replace: true });
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '삭제에 실패했습니다.';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    }
  };


  const chronologyEvents = content?.chronology?.events
    ? [...content.chronology.events].sort((a, b) => a.year - b.year)
    : [];
  const timelineEntries = content?.timeline ?? [];

  const loadStudySessions = async () => {
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

  const handleDeleteQuiz = async (quizId: number) => {
    if (!confirm('해당 퀴즈를 삭제할까요?')) return;
    try {
      await deleteQuizRequest(quizId);
      await loadContent();
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '퀴즈를 삭제하지 못했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    }
  };

  const handleOpenModal = (card: any) => {
    if (!user) {
      alert('학습 기능을 사용하려면 로그인해주세요.');
      navigate('/auth', { state: { from: location } });
      return;
    }
    setTargetCard(card);
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
    setTargetCard(null);
    setSubmitting(false);
    setSessionError(null);
    setSelectedSessionId(null);
    setNewSessionHelperId(user?.selected_helper_id ?? null);
  };

  const quizTypeLabels = [
    '객관식',
    '주관식', 
    'OX',
    '빈칸채우기',
    '순서맞추기',
    '짝맞추기'
  ];

  const quizTypeMapping = ['MCQ', 'SHORT', 'OX', 'CLOZE', 'ORDER', 'MATCH'];

  const handleQuizTypeConfirm = () => {
    if (!content?.id) return;
    setShowQuizTypeModal(false);
    const selectedType = quizTypeMapping[selectedQuizTypeIndex];
    navigate(`/contents/${content.id}/quizzes/new?type=${selectedType}`);
  };

  const handleSubmitToStudy = async () => {
    if (!normalizedCard) return;
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
      const alreadyExists = session.quiz_ids?.includes(normalizedCard.id);
      if (alreadyExists) {
        alert('이미 존재합니다.');
        handleCloseModal();
        return;
      }
      setSubmitting(true);
      try {
        const updated = await updateStudySessionRequest(session.id, {
          quiz_ids: [...session.quiz_ids, normalizedCard.id],
          cards: [...session.cards, { ...normalizedCard, attempts: 0, correct: 0 }],
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
        quiz_ids: [normalizedCard.id],
        cards: [{ ...normalizedCard, attempts: 0, correct: 0 }],
        helper_id: helperIdForCreation ?? undefined,
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

  if (loading) {
    return <p className="text-sm text-slate-600">불러오는 중…</p>;
  }

  if (error || !content) {
    return <p className="text-sm text-rose-600">{error ?? '콘텐츠를 찾을 수 없습니다.'}</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-primary-600">{content.title}</h1>
              <Badge color={content.visibility === 'PUBLIC' ? 'success' : 'default'}>
                {content.visibility === 'PUBLIC' ? '공개' : '비공개'}
              </Badge>
              {content.eras?.length
                ? content.eras.map((entry, index) => (
                    <Badge key={`${entry.period}-${index}`} color="primary">
                      {entry.period}
                      {entry.detail ? ` · ${entry.detail}` : ''}
                    </Badge>
                  ))
                : null}
            </div>
            <time className="block text-xs text-slate-500">{new Date(content.created_at).toLocaleString()}</time>
          </div>
          {user?.id === content.owner_id ? (
            <div className="flex flex-col gap-2 text-xs md:flex-row">
              <button
                type="button"
                onClick={() => navigate(`/contents/${content.id}/edit`)}
                className="rounded border border-primary-500 px-3 py-1 font-semibold text-primary-600 transition hover:bg-primary-50"
              >
                콘텐츠 수정
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded border border-rose-500 px-3 py-1 font-semibold text-rose-600 transition hover:bg-rose-500/10"
              >
                삭제
              </button>
            </div>
          ) : null}
        </header>
        <article className="mt-4 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
          {content.content}
        </article>
        {content.keywords?.length ? (
          <div className="mt-4 space-y-2">
            <span className="text-sm font-semibold text-primary-600">키워드</span>
            <div className="flex flex-wrap gap-2">
              {content.keywords.map((keyword: string) => (
                <Badge key={`keyword-${keyword}`} color="default">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
        {content.categories?.length ? (
          <div className="mt-4 space-y-2">
            <span className="text-sm font-semibold text-primary-600">분류</span>
            <div className="flex flex-wrap gap-2">
              {content.categories.map((category: string) => (
                <Badge key={`category-${category}`} color="success">
                  {category}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
        {timelineEntries.length ? (
          <div className="mt-6 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <span className="text-sm font-semibold text-primary-600">타임라인</span>
            <ul className="space-y-2 text-xs text-slate-600">
              {timelineEntries.map((entry, index) => (
                <li
                  key={`${index}-${entry.title}-${entry.description}`}
                  className="flex gap-3"
                >
                  <span className="text-primary-500">•</span>
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-primary-600">{entry.title}</span>
                    {entry.description ? <span className="text-slate-600">{entry.description}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {content.chronology ? (
          <div className="mt-6 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm text-slate-700">
              <span className="font-semibold text-primary-600">연표</span>
              <span className="text-xs text-slate-500">
                {content.chronology.start_year ?? '알 수 없음'}
                {' '}–{' '}
                {content.chronology.end_year ?? '알 수 없음'}
              </span>
            </div>
            {chronologyEvents.length ? (
              <ul className="space-y-2 text-xs text-slate-600">
                {chronologyEvents.map((event) => (
                  <li key={`${event.year}-${event.label}`} className="flex items-start gap-3">
                    <span className="font-semibold text-primary-600">{event.year}</span>
                    <span>{event.label}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">등록된 사건이 없습니다.</p>
            )}
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary-600">퀴즈</h2>
          {user?.id === content.owner_id ? (
            <button
              type="button"
              onClick={() => setShowQuizTypeModal(true)}
              className="rounded border border-primary-500 px-3 py-1 text-xs font-semibold text-primary-600 transition hover:bg-primary-50"
            >
              퀴즈 추가
            </button>
          ) : null}
        </div>
        {cards.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card, index) => (
              <div key={`${card.type}-${index}`} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
                <CardPreview card={card} />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{getQuizTypeLabel(card.type)}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenModal(card)}
                      className="rounded border border-primary-500 px-3 py-1 text-xs font-semibold text-primary-600 transition hover:bg-primary-50"
                    >
                      학습에 추가
                    </button>
                    {user?.id === content.owner_id ? (
                      <>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/quizzes/${card.id}/edit?content=${content.id}`);
                          }}
                          className="rounded border border-sky-500 px-3 py-1 text-xs font-semibold text-sky-600 transition hover:bg-sky-500/10"
                        >
                          편집
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteQuiz(card.id);
                          }}
                          className="rounded border border-rose-500 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10"
                        >
                          삭제
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">등록된 카드가 없습니다.</p>
        )}
      </section>

      {showModal && normalizedCard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-900 shadow-xl">
            <header className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-primary-600">학습에 추가</h3>
                <p className="text-xs text-slate-500">{getQuizTypeLabel(normalizedCard.type)} · #{normalizedCard.id}</p>
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
              <CardPreview card={normalizedCard} />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-primary-600">학습 세트 선택</p>
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-xs text-slate-600">
                  <input
                    type="radio"
                    name="study-session-mode"
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
                              name="study-session-id"
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
                    name="study-session-mode"
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
                onClick={handleSubmitToStudy}
                className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={submitting}
              >
                {submitting ? '처리 중…' : '추가하기'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showQuizTypeModal ? (
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
              {quizTypeLabels.map((label, index) => (
                <label
                  key={index}
                  className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span>{label}</span>
                  <input
                    type="radio"
                    name="quiz-type"
                    value={index}
                    checked={selectedQuizTypeIndex === index}
                    onChange={() => setSelectedQuizTypeIndex(index)}
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
                onClick={handleQuizTypeConfirm}
                className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
              >
                만들기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
