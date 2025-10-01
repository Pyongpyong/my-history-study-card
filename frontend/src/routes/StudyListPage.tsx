import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  fetchStudySessions,
  fetchPublicStudySessions,
  deleteStudySessionRequest,
  updateStudySessionRequest,
  assignRewardToSession,
  fetchRewards,
  fetchCardDecksRequest,
  StudySession,
  Reward,
  CardDeck,
} from '../api';
import { useAuth } from '../context/AuthContext';
import HelperPickerModal from '../components/HelperPickerModal';
import { useLearningHelpers } from '../hooks/useLearningHelpers';
import { getHelperAssetUrl, getCardDeckImageUrl } from '../utils/assets';

export default function StudyListPage() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rewardModalSession, setRewardModalSession] = useState<StudySession | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [rewardsError, setRewardsError] = useState<string | null>(null);
  const [selectingRewardId, setSelectingRewardId] = useState<number | null>(null);
  const [helperModalSession, setHelperModalSession] = useState<StudySession | null>(null);
  const [pendingHelperId, setPendingHelperId] = useState<number | null>(null);
  const [helperSubmitting, setHelperSubmitting] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [cardDecks, setCardDecks] = useState<CardDeck[]>([]);
  const [cardDeckModalSession, setCardDeckModalSession] = useState<StudySession | null>(null);
  const [pendingCardDeckId, setPendingCardDeckId] = useState<number | null>(null);
  const [cardDeckSubmitting, setCardDeckSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { helpers, loading: helpersLoading, error: helpersError, refresh: refreshHelpers } = useLearningHelpers();

  const loadCardDecks = async () => {
    try {
      const data = await fetchCardDecksRequest();
      setCardDecks(data.items);
    } catch (err) {
      console.error('Failed to load card decks:', err);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // 로그인한 사용자는 개인 학습 세션을, 비로그인 사용자는 공개 학습 세션을 가져옴
      const data = user ? await fetchStudySessions() : await fetchPublicStudySessions();
      const normalized = await Promise.all(
        data.items.map(async (session, index) => {
          const defaultTitle = session.title && session.title.trim() ? session.title : `학습 ${index + 1}`;
          // 로그인한 사용자만 제목 업데이트 가능
          if (user && (!session.title || !session.title.trim())) {
            try {
              await updateStudySessionRequest(session.id, { title: defaultTitle });
            } catch (error) {
              console.error('Failed to update session title', error);
            }
          }
          return { ...session, title: defaultTitle };
        }),
      );
      setSessions(normalized);
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '학습 세트를 불러오지 못했습니다.';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (user) {
      loadCardDecks();
    }
  }, [location.key, location.state?.refresh, user]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    sessions.forEach((session) => {
      (session.tags ?? []).forEach((tag) => {
        if (tag && tag.trim()) {
          tags.add(tag);
        }
      });
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [sessions]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  };

  const filteredSessions = useMemo(() => {
    if (!activeTags.length) {
      return sessions;
    }
    return sessions.filter((session) => {
      const tags = session.tags ?? [];
      return activeTags.every((tag) => tags.includes(tag));
    });
  }, [sessions, activeTags]);

  const handleTitleBlur = async (session: StudySession, value: string, index: number) => {
    const orderIndex = sessions.findIndex((item) => item.id === session.id);
    const fallbackIndex = orderIndex >= 0 ? orderIndex : index;
    const nextTitle = value.trim() || `학습 ${fallbackIndex + 1}`;
    
    // 제목이 변경되지 않았으면 업데이트하지 않음
    if (nextTitle === session.title) {
      return;
    }
    
    try {
      await updateStudySessionRequest(session.id, { title: nextTitle });
      // 성공 시에만 로컬 상태 업데이트
      setSessions((prev) =>
        prev.map((item) =>
          item.id === session.id ? { ...item, title: nextTitle } : item,
        ),
      );
    } catch (err) {
      console.error('제목 업데이트 실패:', err);
      // 실패 시 원래 제목으로 되돌림
      setSessions((prev) =>
        prev.map((item) =>
          item.id === session.id ? { ...item, title: session.title } : item,
        ),
      );
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('이 학습 세트를 삭제하시겠습니까?')) return;
    await deleteStudySessionRequest(id);
    load();
  };

  const openRewardModal = async (session: StudySession) => {
    setRewardModalSession(session);
    setRewardsError(null);
    setRewardsLoading(true);
    try {
      const items = await fetchRewards();
      setRewards(items);
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '보상 목록을 불러오지 못했습니다.';
      setRewardsError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setRewardsLoading(false);
    }
  };

  const closeRewardModal = () => {
    setRewardModalSession(null);
    setSelectingRewardId(null);
    setRewardsError(null);
  };

  const handleAssignReward = async () => {
    if (!rewardModalSession || selectingRewardId == null) {
      alert('추가할 보상을 선택해주세요.');
      return;
    }
    try {
      const updated = await assignRewardToSession(rewardModalSession.id, selectingRewardId);
      setSessions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      await load();
      closeRewardModal();
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '보상을 추가하지 못했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    }
  };

  const openHelperModal = (session: StudySession) => {
    setHelperModalSession(session);
    const fallback =
      session.helper?.id ??
      session.helper_id ??
      user?.selected_helper_id ??
      helpers.find((item) => item.level_requirement === 1)?.id ??
      helpers.find((item) => item.unlocked)?.id ??
      null;
    setPendingHelperId(fallback);
    void refreshHelpers();
  };

  const closeHelperModal = () => {
    if (helperSubmitting) {
      return;
    }
    setHelperModalSession(null);
    setPendingHelperId(null);
  };

  const handleHelperConfirm = async () => {
    if (!helperModalSession) {
      return;
    }
    if (pendingHelperId == null) {
      alert('학습 도우미를 선택해주세요.');
      return;
    }
    const selectedHelper = helpers.find((item) => item.id === pendingHelperId);
    if (selectedHelper && !selectedHelper.unlocked) {
      alert('아직 잠금 해제되지 않은 학습 도우미입니다.');
      return;
    }
    setHelperSubmitting(true);
    try {
      const updated = await updateStudySessionRequest(helperModalSession.id, { helper_id: pendingHelperId });
      setSessions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      closeHelperModal();
    } catch (err: any) {
      console.error('학습 도우미 변경 실패', err);
      const message = err?.response?.data?.detail ?? err?.message ?? '학습 도우미를 변경하지 못했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setHelperSubmitting(false);
    }
  };

  const openCardDeckModal = (session: StudySession) => {
    setCardDeckModalSession(session);
    setPendingCardDeckId(session.card_deck?.id ?? null);
  };

  const closeCardDeckModal = () => {
    if (cardDeckSubmitting) {
      return;
    }
    setCardDeckModalSession(null);
    setPendingCardDeckId(null);
  };

  const handleCardDeckConfirm = async () => {
    if (!cardDeckModalSession) {
      return;
    }
    setCardDeckSubmitting(true);
    try {
      const updated = await updateStudySessionRequest(cardDeckModalSession.id, { card_deck_id: pendingCardDeckId });
      setSessions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      closeCardDeckModal();
    } catch (err: any) {
      console.error('카드덱 변경 실패', err);
      const message = err?.response?.data?.detail ?? err?.message ?? '카드덱을 변경하지 못했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setCardDeckSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-600">불러오는 중…</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }

  if (!sessions.length) {
    return (
      <p className="text-sm text-slate-600">
        {user ? '저장된 학습 세트가 없습니다.' : '공개된 학습 세트가 없습니다.'}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary-600">
          {user ? '내 학습 세트' : '공개 학습 세트'}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {user 
            ? '나만의 학습 세트를 관리하고 학습을 시작하세요.' 
            : '누구나 접근할 수 있는 공개 학습 세트입니다. 로그인하면 개인 학습 세트를 만들 수 있습니다.'
          }
        </p>
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

      {filteredSessions.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredSessions.map((session, index) => (
            <div key={session.id} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-primary-600">{session.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-slate-500">
                      생성일: {new Date(session.created_at).toLocaleString()}
                    </p>
                    {!user && session.is_public && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        공개
                      </span>
                    )}
                  </div>
                </div>
                {user && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/study-edit/${session.id}`)}
                      className="rounded border border-primary-500 px-3 py-1 text-xs font-semibold text-primary-600 transition hover:bg-primary-50"
                    >
                      편집
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(session.id)}
                      className="rounded border border-rose-500 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-3 text-sm text-slate-900">퀴즈 수: {session.cards.length}</p>
              
              {/* 학습 도우미 정보 */}
              <div className="mt-2">
                <p className="text-xs text-slate-500">
                  학습 도우미: {session.helper?.name ?? 'Level 1 학습도우미'}
                </p>
              </div>
              
              {/* 카드덱 정보 */}
              <div className="mt-1">
                <p className="text-xs text-slate-500">
                  카드덱: {session.card_deck?.name ?? '기본 카드덱'}
                </p>
              </div>
              {session.tags?.length ? (
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-primary-600">
                  {session.tags.map((tag) => (
                    <span key={`${session.id}-${tag}`} className="rounded border border-primary-500/40 bg-primary-50 px-2 py-1">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
              {session.rewards?.length ? (
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  <p className="font-semibold text-primary-600">보상</p>
              <ul className="space-y-1">
                {session.rewards.map((reward) => (
                  <li key={reward.id} className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                    <span>
                      {reward.title} · {reward.duration}
                    </span>
                    <span className={reward.used ? 'text-emerald-600' : 'text-amber-300'}>
                      {reward.used ? '사용됨' : '미사용'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">보상이 아직 없습니다.</p>
          )}
          {session.score != null && session.total ? (
            <div className="mt-2 text-xs text-slate-500">
              <p>마지막 정답률: {Math.round((session.score / session.total) * 100)}%</p>
              {session.completed_at ? (
                <p>학습일: {new Date(session.completed_at).toLocaleString()}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">이전 정답률: 0%</p>
          )}
          <div className="mt-4 flex gap-2 text-sm">
            <button
              type="button"
              onClick={() =>
                navigate(`/study/${session.cards[0]?.content_id ?? 'custom'}?session=${session.id}`)
              }
              className="rounded bg-primary-600 px-4 py-2 font-semibold text-white transition hover:bg-primary-500"
            >
              학습 시작
            </button>
            {!user && (
              <button
                type="button"
                onClick={() => navigate('/auth')}
                className="rounded border border-slate-300 px-4 py-2 font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                로그인하여 개인 학습 만들기
              </button>
            )}
          </div>
          </div>
        ))}
        </div>
      ) : (
        <p className="text-sm text-slate-600">선택한 태그에 해당하는 학습 세트가 없습니다.</p>
      )}
      {rewardModalSession ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-900 shadow-xl">
            <header className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-primary-600">보상 추가</h3>
                <p className="text-xs text-slate-500">{rewardModalSession.title}</p>
              </div>
              <button
                type="button"
                onClick={closeRewardModal}
                className="text-sm text-slate-500 transition hover:text-slate-700"
              >
                닫기
              </button>
            </header>
            {rewardsLoading ? (
              <p className="text-sm text-slate-600">보상 목록을 불러오는 중…</p>
            ) : rewardsError ? (
              <p className="text-sm text-rose-600">{rewardsError}</p>
            ) : rewards.length ? (
              <ul className="max-h-60 space-y-2 overflow-y-auto">
                {rewards.map((reward) => {
                  const alreadyAssigned = rewardModalSession.rewards?.some((item) => item.id === reward.id);
                  return (
                    <li key={reward.id}>
                      <label className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <div>
                          <p className="font-semibold text-primary-600">{reward.title}</p>
                          <p className="text-xs text-slate-500">기간: {reward.duration}</p>
                          <p className="text-[11px] text-slate-500">
                            유효기간: {reward.valid_until ? new Date(reward.valid_until).toLocaleString() : '—'}
                          </p>
                          {alreadyAssigned ? (
                            <p className="text-[11px] text-emerald-600">이미 추가된 보상</p>
                          ) : null}
                        </div>
                        <input
                          type="radio"
                          name="reward"
                          value={reward.id}
                          checked={selectingRewardId === reward.id}
                          onChange={() => setSelectingRewardId(reward.id)}
                          className="h-4 w-4 accent-primary-500"
                          disabled={alreadyAssigned}
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">등록된 보상이 없습니다. 먼저 보상을 생성해주세요.</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeRewardModal}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAssignReward}
                className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
                disabled={!rewards.length}
              >
                보상 추가
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {helperModalSession ? (
        <HelperPickerModal
          isOpen={Boolean(helperModalSession)}
          helpers={helpers}
          selectedId={pendingHelperId}
          onSelect={setPendingHelperId}
          onClose={closeHelperModal}
          onConfirm={handleHelperConfirm}
          userLevel={user?.level ?? 1}
          submitting={helperSubmitting || helpersLoading}
          confirmLabel="학습 도우미 변경"
          description={
            helpersLoading
              ? '학습 도우미 정보를 불러오는 중…'
              : helpersError ?? '사용할 학습 도우미를 선택하세요.'
          }
        />
      ) : null}

      {/* 카드덱 변경 모달 - 로그인 사용자만 */}
      {user && cardDeckModalSession ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">카드덱 변경</h3>
            <p className="mt-2 text-sm text-slate-600">
              "{cardDeckModalSession.title}"의 카드덱을 변경합니다.
            </p>
            
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700">카드덱 선택</label>
              <select
                value={pendingCardDeckId ?? ''}
                onChange={(e) => setPendingCardDeckId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">기본 카드덱</option>
                {cardDecks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name} {deck.is_default ? '(기본)' : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">카드의 앞뒤면 디자인을 선택합니다.</p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeCardDeckModal}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={cardDeckSubmitting}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCardDeckConfirm}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={cardDeckSubmitting}
              >
                {cardDeckSubmitting ? '변경 중...' : '변경'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
