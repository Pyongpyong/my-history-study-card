import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

export default function ContentDetailPage() {
  const { id } = useParams();
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);
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
  const [submitting, setSubmitting] = useState(false);
  const [showQuizTypeModal, setShowQuizTypeModal] = useState(false);
  const [selectedQuizType, setSelectedQuizType] = useState<string>('MCQ');
  const navigate = useNavigate();

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

  const displayContent = content
    ? expanded
      ? content.content
      : content.content.length > 300
      ? `${content.content.slice(0, 300)}…`
      : content.content
    : '';

  const chronologyEvents = content?.chronology?.events
    ? [...content.chronology.events].sort((a, b) => a.year - b.year)
    : [];

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
    setTargetCard(card);
    setSelection('existing');
    setSelectedSessionId(null);
    setNewSessionTitle('');
    void loadStudySessions();
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setTargetCard(null);
    setSubmitting(false);
    setSessionError(null);
    setSelectedSessionId(null);
  };

  const quizTypeOptions = [
    { type: 'MCQ', label: '객관식' },
    { type: 'SHORT', label: '주관식' },
    { type: 'OX', label: 'OX' },
    { type: 'CLOZE', label: '빈칸채우기' },
    { type: 'ORDER', label: '순서맞추기' },
    { type: 'MATCH', label: '짝맞추기' },
  ];

  const handleQuizTypeConfirm = () => {
    if (!content?.id) return;
    setShowQuizTypeModal(false);
    navigate(`/contents/${content.id}/quizzes/new?type=${selectedQuizType}`);
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
    setSubmitting(true);
    try {
      const created = await createStudySession({
        title,
        quiz_ids: [normalizedCard.id],
        cards: [{ ...normalizedCard, attempts: 0, correct: 0 }],
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
    return <p className="text-sm text-slate-300">불러오는 중…</p>;
  }

  if (error || !content) {
    return <p className="text-sm text-rose-400">{error ?? '콘텐츠를 찾을 수 없습니다.'}</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-primary-300">{content.title}</h1>
              {content.tags?.length ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  {content.tags.map((tag) => (
                    <Badge key={tag} color="primary">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
            <time className="block text-xs text-slate-400">{new Date(content.created_at).toLocaleString()}</time>
          </div>
          <div className="flex flex-col gap-2 text-xs md:flex-row">
            <button
              type="button"
              onClick={() => navigate(`/contents/${content.id}/edit`)}
              className="rounded border border-primary-500 px-3 py-1 font-semibold text-primary-300 transition hover:bg-primary-500/10"
            >
              콘텐츠 수정
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded border border-rose-500 px-3 py-1 font-semibold text-rose-300 transition hover:bg-rose-500/10"
            >
              삭제
            </button>
          </div>
        </header>
        <article className="mt-4 text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
          {displayContent}
        </article>
        {content.content.length > 300 ? (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="mt-2 text-xs font-semibold text-primary-300 hover:text-primary-200"
          >
            {expanded ? '접기' : '더 보기'}
          </button>
        ) : null}
        {content.highlights?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {content.highlights.map((highlight: string) => (
              <Badge key={highlight}>{highlight}</Badge>
            ))}
          </div>
        ) : null}
        {content.chronology ? (
          <div className="mt-6 space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between text-sm text-slate-200">
              <span className="font-semibold text-primary-200">연표</span>
              <span className="text-xs text-slate-400">
                {content.chronology.start_year ?? '알 수 없음'}
                {' '}–{' '}
                {content.chronology.end_year ?? '알 수 없음'}
              </span>
            </div>
            {chronologyEvents.length ? (
              <ul className="space-y-2 text-xs text-slate-300">
                {chronologyEvents.map((event) => (
                  <li key={`${event.year}-${event.label}`} className="flex items-start gap-3">
                    <span className="font-semibold text-primary-300">{event.year}</span>
                    <span>{event.label}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">등록된 사건이 없습니다.</p>
            )}
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary-300">퀴즈</h2>
          <button
            type="button"
            onClick={() => setShowQuizTypeModal(true)}
            className="rounded border border-primary-500 px-3 py-1 text-xs font-semibold text-primary-300 transition hover:bg-primary-500/10"
          >
            퀴즈 추가
          </button>
        </div>
        {cards.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card, index) => (
              <div key={`${card.type}-${index}`} className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                <CardPreview card={card} />
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{getQuizTypeLabel(card.type)}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenModal(card)}
                      className="rounded border border-primary-500 px-3 py-1 text-xs font-semibold text-primary-300 transition hover:bg-primary-500/10"
                    >
                      학습에 추가
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/quizzes/${card.id}/edit?content=${content.id}`);
                      }}
                      className="rounded border border-sky-500 px-3 py-1 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/10"
                    >
                      편집
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDeleteQuiz(card.id);
                      }}
                      className="rounded border border-rose-500 px-3 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-300">등록된 카드가 없습니다.</p>
        )}
      </section>

      {showModal && normalizedCard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-xl">
            <header className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-primary-300">학습에 추가</h3>
                <p className="text-xs text-slate-400">{getQuizTypeLabel(normalizedCard.type)} · #{normalizedCard.id}</p>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="text-sm text-slate-400 transition hover:text-slate-200"
              >
                닫기
              </button>
            </header>

            <div className="rounded border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
              <CardPreview card={normalizedCard} />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-primary-200">학습 세트 선택</p>
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-xs text-slate-300">
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
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded border border-slate-800 p-2 text-xs">
                    {sessionsLoading ? (
                      <p className="text-slate-400">학습 목록을 불러오는 중…</p>
                    ) : sessionError ? (
                      <p className="text-rose-400">{sessionError}</p>
                    ) : studySessions.length ? (
                      studySessions.map((session) => (
                        <label key={session.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-slate-800">
                          <span className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="study-session-id"
                              value={session.id}
                              checked={selectedSessionId === session.id}
                              onChange={() => setSelectedSessionId(session.id)}
                            />
                            <span className="font-medium text-slate-100">{session.title}</span>
                          </span>
                          <span className="text-[11px] text-slate-400">카드 {session.cards.length}개</span>
                        </label>
                      ))
                    ) : (
                      <p className="text-slate-400">등록된 학습 세트가 없습니다.</p>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="flex items-start gap-2 text-xs text-slate-300">
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
                  <input
                    type="text"
                    value={newSessionTitle}
                    onChange={(event) => setNewSessionTitle(event.target.value)}
                    placeholder="새 학습 세트 이름"
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                ) : null}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
                disabled={submitting}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSubmitToStudy}
                className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-700"
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
          <div className="w-full max-w-md space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6 text-slate-100 shadow-xl">
            <header className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-primary-300">추가할 퀴즈 형식</h3>
              <button
                type="button"
                onClick={() => setShowQuizTypeModal(false)}
                className="text-sm text-slate-400 transition hover:text-slate-200"
              >
                닫기
              </button>
            </header>
            <div className="space-y-2">
              {quizTypeOptions.map((option) => (
                <label
                  key={option.type}
                  className="flex items-center justify-between gap-3 rounded border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm"
                >
                  <span>{option.label}</span>
                  <input
                    type="radio"
                    name="quiz-type"
                    value={option.type}
                    checked={selectedQuizType === option.type}
                    onChange={() => setSelectedQuizType(option.type)}
                    className="h-4 w-4 accent-primary-500"
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowQuizTypeModal(false)}
                className="rounded border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
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
