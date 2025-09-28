import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchStudySessionById,
  updateStudySessionRequest,
  assignRewardToSession,
  fetchRewards,
  fetchCardDecksRequest,
  fetchQuizzes,
  StudySession,
  Reward,
  CardDeck,
  QuizItem,
  QuizListResponse,
} from '../api';
import { useAuth } from '../context/AuthContext';
import HelperPickerModal from '../components/HelperPickerModal';
import { useLearningHelpers } from '../hooks/useLearningHelpers';
import { getHelperAssetUrl, getCardDeckImageUrl } from '../utils/assets';

export default function StudyEditPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<StudySession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // 기본 정보 상태
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // 퀴즈 관련 상태
  const [selectedCards, setSelectedCards] = useState<any[]>([]);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [availableQuizzes, setAvailableQuizzes] = useState<QuizItem[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [selectedQuizIds, setSelectedQuizIds] = useState<number[]>([]);

  // 학습 도우미 관련 상태
  const [helperModalOpen, setHelperModalOpen] = useState(false);
  const [pendingHelperId, setPendingHelperId] = useState<number | null>(null);
  const [helperSubmitting, setHelperSubmitting] = useState(false);

  // 카드덱 관련 상태
  const [cardDecks, setCardDecks] = useState<CardDeck[]>([]);
  const [selectedCardDeckId, setSelectedCardDeckId] = useState<number | null>(null);

  // 보상 관련 상태
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [selectingRewardId, setSelectingRewardId] = useState<number | null>(null);

  const { helpers, loading: helpersLoading, error: helpersError, refresh: refreshHelpers } = useLearningHelpers();

  // 데이터 로드
  useEffect(() => {
    if (!id || !user) {
      navigate('/studies');
      return;
    }
    loadData();
  }, [id, user]);

  const loadData = async () => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [sessionData, cardDecksData] = await Promise.all([
        fetchStudySessionById(parseInt(id, 10)),
        fetchCardDecksRequest(),
      ]);

      setSession(sessionData);
      setTitle(sessionData.title || '');
      setTags(sessionData.tags || []);
      setSelectedCards(sessionData.cards || []);
      setPendingHelperId(sessionData.helper?.id || null);
      setSelectedCardDeckId(sessionData.card_deck?.id || null);

      setCardDecks(cardDecksData.items);
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '학습 세션을 불러오지 못했습니다.';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  };

  // 기본 정보 저장
  const handleSaveBasicInfo = async () => {
    if (!session) return;

    setSaving(true);
    try {
      await updateStudySessionRequest(session.id, {
        title: title.trim() || '학습 세션',
        tags: tags.filter(tag => tag.trim()),
      });
      alert('기본 정보가 저장되었습니다.');
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '저장에 실패했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setSaving(false);
    }
  };

  // 태그 추가
  const handleAddTag = () => {
    const tag = newTag.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setNewTag('');
    }
  };

  // 태그 제거
  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // 퀴즈 순서 변경
  const moveCard = (fromIndex: number, toIndex: number) => {
    const newCards = [...selectedCards];
    const [movedCard] = newCards.splice(fromIndex, 1);
    newCards.splice(toIndex, 0, movedCard);
    setSelectedCards(newCards);
  };

  // 퀴즈 추가 (선택된 퀴즈들을 학습 세션에 추가)
  const handleAddSelectedQuizzes = () => {
    const quizzesToAdd = availableQuizzes.filter(quiz => selectedQuizIds.includes(quiz.id));
    const newCards = quizzesToAdd.map(quiz => ({
      id: quiz.id,
      content_id: quiz.content_id,
      type: quiz.type,
      quiz_type: quiz.type,
      payload: quiz.payload,
      ...quiz.payload, // payload 내용을 직접 펼침
      created_at: quiz.created_at,
      visibility: quiz.visibility,
      owner_id: quiz.owner_id,
    }));
    
    setSelectedCards([...selectedCards, ...newCards]);
    setQuizModalOpen(false);
    setSelectedQuizIds([]);
  };

  // 퀴즈 제거
  const handleRemoveQuiz = (index: number) => {
    const newCards = [...selectedCards];
    newCards.splice(index, 1);
    setSelectedCards(newCards);
  };

  // 퀴즈 변경사항 저장 및 정답률 리셋
  const handleSaveQuizzes = async () => {
    if (!session) return;

    setSaving(true);
    try {
      await updateStudySessionRequest(session.id, {
        cards: selectedCards,
        score: null, // 정답률 리셋
        total: null,
        completed_at: null,
      });
      alert('퀴즈가 저장되었고 정답률이 초기화되었습니다.');
      await loadData(); // 데이터 새로고침
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '퀴즈 저장에 실패했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setSaving(false);
    }
  };

  // 학습 도우미 변경
  const handleHelperConfirm = async () => {
    if (!session || pendingHelperId == null) return;

    const selectedHelper = helpers.find(item => item.id === pendingHelperId);
    if (selectedHelper && !selectedHelper.unlocked) {
      alert('아직 잠금 해제되지 않은 학습 도우미입니다.');
      return;
    }

    setHelperSubmitting(true);
    try {
      await updateStudySessionRequest(session.id, { helper_id: pendingHelperId });
      setHelperModalOpen(false);
      await loadData();
      alert('학습 도우미가 변경되었습니다.');
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '학습 도우미 변경에 실패했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setHelperSubmitting(false);
    }
  };

  // 카드덱 변경
  const handleCardDeckChange = async () => {
    if (!session) return;

    setSaving(true);
    try {
      await updateStudySessionRequest(session.id, { card_deck_id: selectedCardDeckId });
      await loadData();
      alert('카드덱이 변경되었습니다.');
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '카드덱 변경에 실패했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setSaving(false);
    }
  };

  // 보상 추가
  const handleAssignReward = async () => {
    if (!session || selectingRewardId == null) return;

    try {
      await assignRewardToSession(session.id, selectingRewardId);
      setRewardModalOpen(false);
      setSelectingRewardId(null);
      await loadData();
      alert('보상이 추가되었습니다.');
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '보상 추가에 실패했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    }
  };

  // 보상 모달 열기
  const openRewardModal = async () => {
    setRewardModalOpen(true);
    setRewardsLoading(true);
    try {
      const items = await fetchRewards();
      setRewards(items);
    } catch (err: any) {
      console.error(err);
      alert('보상 목록을 불러오지 못했습니다.');
    } finally {
      setRewardsLoading(false);
    }
  };

  // 퀴즈 모달 열기
  const openQuizModal = async () => {
    setQuizModalOpen(true);
    setQuizzesLoading(true);
    try {
      const response = await fetchQuizzes(1, 100); // 최대 100개 퀴즈 로드
      setAvailableQuizzes(response.items);
    } catch (err: any) {
      console.error(err);
      alert('퀴즈 목록을 불러오지 못했습니다.');
    } finally {
      setQuizzesLoading(false);
    }
  };

  // 퀴즈 선택 토글
  const toggleQuizSelection = (quizId: number) => {
    setSelectedQuizIds(prev => 
      prev.includes(quizId) 
        ? prev.filter(id => id !== quizId)
        : [...prev, quizId]
    );
  };

  // 이미 추가된 퀴즈인지 확인
  const isQuizAlreadyAdded = (quizId: number) => {
    return selectedCards.some(card => card.id === quizId);
  };

  if (loading) {
    return <p className="text-sm text-slate-600">불러오는 중…</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }

  if (!session) {
    return <p className="text-sm text-slate-600">학습 세션을 찾을 수 없습니다.</p>;
  }

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary-600">학습 편집</h1>
          <p className="mt-1 text-sm text-slate-600">학습 세션의 설정과 퀴즈를 관리합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/studies')}
          className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          목록으로 돌아가기
        </button>
      </div>

      {/* 기본 정보 섹션 */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">기본 정보</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="학습 세션 제목을 입력하세요"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">태그</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="새 태그 입력"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
              >
                추가
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-600"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-primary-400 hover:text-primary-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveBasicInfo}
            disabled={saving}
            className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? '저장 중...' : '기본 정보 저장'}
          </button>
        </div>
      </section>

      {/* 퀴즈 관리 섹션 */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">퀴즈 관리</h2>
          <button
            type="button"
            onClick={handleSaveQuizzes}
            disabled={saving}
            className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? '저장 중...' : '퀴즈 저장 (정답률 초기화)'}
          </button>
        </div>

        {/* 퀴즈 추가 */}
        <div className="mb-6">
          <button
            type="button"
            onClick={openQuizModal}
            className="w-full rounded border border-primary-500 px-4 py-3 text-sm font-semibold text-primary-600 transition hover:bg-primary-50"
          >
            퀴즈 목록에서 선택하여 추가
          </button>
        </div>

        {/* 현재 퀴즈 목록 */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-700">
            현재 퀴즈 ({selectedCards.length}개)
          </h3>
          {selectedCards.length > 0 ? (
            <div className="space-y-2">
              {selectedCards.map((card, index) => (
                <div
                  key={`${card.id}-${index}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', index.toString());
                    e.currentTarget.classList.add('opacity-50');
                  }}
                  onDragEnd={(e) => {
                    e.currentTarget.classList.remove('opacity-50');
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('bg-primary-50');
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove('bg-primary-50');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('bg-primary-50');
                    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                    const toIndex = index;
                    if (fromIndex !== toIndex) {
                      moveCard(fromIndex, toIndex);
                    }
                  }}
                  className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-move hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center text-slate-400">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M2 4h2v2H2V4zm4 0h2v2H6V4zm4 0h2v2h-2V4zM2 8h2v2H2V8zm4 0h2v2H6V8zm4 0h2v2h-2V8zM2 12h2v2H2v-2zm4 0h2v2H6v-2zm4 0h2v2h-2v-2z"/>
                    </svg>
                  </div>
                  
                  <div className="flex-1">
                    {/* 디버그: 실제 데이터 구조 확인 
                    <details className="mb-2">
                      <summary className="text-xs text-slate-400 cursor-pointer">디버그: 데이터 구조 보기</summary>
                      <pre className="text-xs bg-slate-100 p-2 rounded mt-1 overflow-auto">
                        {JSON.stringify(card, null, 2)}
                      </pre>
                    </details>*/}
                    
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-slate-900">
                        {index + 1}. {(card.type || card.quiz_type) === 'MCQ' ? (card.question) : 
                          (card.type || card.quiz_type) === 'SHORT' ? (card.prompt) :
                          (card.type || card.quiz_type) === 'OX' ? (card.statement) :
                          (card.type || card.quiz_type) === 'CLOZE' ? (card.text) :
                          (card.type || card.quiz_type) === 'ORDER' ? '순서맞추기' :
                          (card.type || card.quiz_type) === 'MATCH' ? '짝맞추기':
                          (card.type || card.quiz_type)}
                      </p>
                      {(card.type || card.quiz_type) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {(card.type || card.quiz_type) === 'MCQ' ? '객관식' : 
                           (card.type || card.quiz_type) === 'SHORT' ? '주관식' :
                           (card.type || card.quiz_type) === 'OX' ? 'OX' :
                           (card.type || card.quiz_type) === 'CLOZE' ? '빈칸채우기' :
                           (card.type || card.quiz_type) === 'ORDER' ? '순서맞추기' :
                           (card.type || card.quiz_type) === 'MATCH' ? '짝맞추기' :
                           (card.type || card.quiz_type)}
                        </span>
                      )}
                    </div>
                    
                    {/* 추가 정보 표시 - 타입별로 다른 정보 */}
                    {(() => {
                      const quizType = card.type || card.quiz_type;
                      const payload = card.payload || card;
                      
                      // MCQ - 객관식 선택지
                      if ((quizType === 'MCQ' || quizType === 'multiple_choice') && (payload.options || payload.choices)) {
                        const options = payload.options || payload.choices;
                        return (
                          <div className="text-xs text-slate-600 mb-2">
                            <span className="font-medium">선택지:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {options.slice(0, 4).map((option: string, optIndex: number) => (
                                <span key={optIndex} className="px-2 py-0.5 bg-slate-100 rounded text-xs">
                                  {optIndex + 1}. {option.length > 20 ? option.substring(0, 20) + '...' : option}
                                </span>
                              ))}                             
                            </div>
                          </div>
                        );
                      }
                      
                      // ORDER - 순서배열
                      if (quizType === 'ORDER' || quizType === 'ordering') {
                        const items = payload.items || payload.sequence || payload.order_items;
                        if (items && items.length > 0) {
                          return (
                            <div className="text-xs text-slate-600 mb-2">
                              
                                {items.map((item: string, itemIndex: number) => (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                  {item}
                                  </div>
                                ))}
                              
                            </div>
                          );
                        }
                      }
                      
                      // MATCH - 연결
                      if (quizType === 'MATCH' || quizType === 'matching') {
                        const pairlefts = payload.left;
                        const pairrights = payload.right;
                        if (pairlefts && pairlefts.length > 0) {
                          return (
                            <div className="text-xs text-slate-600 mb-2">
                              
                                {pairlefts.map((pair: any, pairIndex: number) => (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {pair} ↔ {pairrights[pairIndex]} 
                                  </div>
                                ))}
                                
                              
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}
                    
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleRemoveQuiz(index)}
                    className="rounded border border-rose-500 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    제거
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">아직 추가된 퀴즈가 없습니다.</p>
          )}
        </div>
      </section>

      {/* 학습 설정 섹션 */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">학습 설정</h2>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* 학습 도우미 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">학습 도우미</label>
            <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg">
              {session.helper && getHelperAssetUrl(String(session.helper.id)) && (
                <img
                  src={getHelperAssetUrl(String(session.helper.id))!}
                  alt={session.helper.name || '학습 도우미'}
                  className="h-10 w-10 rounded-full border border-slate-200 bg-slate-50 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {session.helper?.name ?? 'Level 1 학습도우미'}
                </p>
                <p className="text-xs text-slate-500">
                  레벨 {session.helper?.level_requirement ?? 1} 요구
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHelperModalOpen(true)}
                className="rounded border border-primary-500 px-3 py-1 text-xs font-semibold text-primary-600 transition hover:bg-primary-50"
              >
                변경
              </button>
            </div>
          </div>

          {/* 카드덱 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">카드덱</label>
            <div className="space-y-2">
              <select
                value={selectedCardDeckId ?? ''}
                onChange={(e) => setSelectedCardDeckId(e.target.value ? parseInt(e.target.value, 10) : null)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">기본 카드덱</option>
                {cardDecks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name} {deck.is_default ? '(기본)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleCardDeckChange}
                disabled={saving}
                className="w-full rounded bg-slate-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {saving ? '변경 중...' : '카드덱 변경'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 보상 섹션 */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">보상</h2>
          <button
            type="button"
            onClick={openRewardModal}
            className="rounded border border-primary-500 px-4 py-2 text-sm font-semibold text-primary-600 transition hover:bg-primary-50"
          >
            보상 추가
          </button>
        </div>

        {session.rewards && session.rewards.length > 0 ? (
          <div className="space-y-2">
            {session.rewards.map((reward) => (
              <div key={reward.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-slate-900">{reward.title}</p>
                  <p className="text-xs text-slate-500">기간: {reward.duration}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  reward.used 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {reward.used ? '사용됨' : '미사용'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">아직 추가된 보상이 없습니다.</p>
        )}
      </section>


      {/* 학습 도우미 선택 모달 */}
      {helperModalOpen && (
        <HelperPickerModal
          isOpen={helperModalOpen}
          helpers={helpers}
          selectedId={pendingHelperId}
          onSelect={setPendingHelperId}
          onClose={() => setHelperModalOpen(false)}
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
      )}

      {/* 퀴즈 선택 모달 */}
      {quizModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-4xl space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-900 shadow-xl">
            <header className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-primary-600">퀴즈 선택</h3>
                <p className="text-xs text-slate-500">추가할 퀴즈를 선택하세요</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQuizModalOpen(false);
                  setSelectedQuizIds([]);
                }}
                className="text-sm text-slate-500 transition hover:text-slate-700"
              >
                닫기
              </button>
            </header>
            
            {quizzesLoading ? (
              <p className="text-sm text-slate-600">퀴즈 목록을 불러오는 중…</p>
            ) : availableQuizzes.length ? (
              <div className="space-y-4">
                <div className="text-sm text-slate-600">
                  선택된 퀴즈: {selectedQuizIds.length}개
                </div>
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {availableQuizzes.map((quiz) => {
                    const alreadyAdded = isQuizAlreadyAdded(quiz.id);
                    const isSelected = selectedQuizIds.includes(quiz.id);
                    
                    return (
                      <div
                        key={quiz.id}
                        className={`rounded border p-3 transition ${
                          alreadyAdded 
                            ? 'border-slate-200 bg-slate-50 opacity-50' 
                            : isSelected
                            ? 'border-primary-300 bg-primary-50'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleQuizSelection(quiz.id)}
                            disabled={alreadyAdded}
                            className="mt-1 h-4 w-4 accent-primary-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                quiz.type === 'MCQ' ? 'bg-blue-100 text-blue-800' :
                                quiz.type === 'SHORT' ? 'bg-green-100 text-green-800' :
                                quiz.type === 'OX' ? 'bg-purple-100 text-purple-800' :
                                quiz.type === 'CLOZE' ? 'bg-orange-100 text-orange-800' :
                                quiz.type === 'ORDER' ? 'bg-pink-100 text-pink-800' :
                                quiz.type === 'MATCH' ? 'bg-indigo-100 text-indigo-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {quiz.type === 'MCQ' ? '객관식' :
                                 quiz.type === 'SHORT' ? '주관식' :
                                 quiz.type === 'OX' ? 'OX' :
                                 quiz.type === 'CLOZE' ? '빈칸채우기' :
                                 quiz.type === 'ORDER' ? '순서맞추기' :
                                 quiz.type === 'MATCH' ? '짝맞추기' :
                                 quiz.type}
                              </span>
                              {alreadyAdded && (
                                <span className="text-xs text-emerald-600 font-medium">이미 추가됨</span>
                              )}
                            </div>
                            
                            <div className="text-sm font-medium text-slate-900 mb-1">
                              {quiz.type === 'MCQ' ? quiz.payload.question :
                               quiz.type === 'SHORT' ? quiz.payload.prompt :
                               quiz.type === 'OX' ? quiz.payload.statement :
                               quiz.type === 'CLOZE' ? quiz.payload.text :
                               quiz.type === 'ORDER' ? '순서맞추기 문제' :
                               quiz.type === 'MATCH' ? '짝맞추기 문제' :
                               '퀴즈'}
                            </div>
                            
                            {/* 퀴즈 타입별 추가 정보 표시 */}
                            {quiz.type === 'MCQ' && quiz.payload.options && (
                              <div className="text-xs text-slate-600">
                                <span className="font-medium">선택지:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {quiz.payload.options.slice(0, 4).map((option: string, optIndex: number) => (
                                    <span key={optIndex} className="px-2 py-0.5 bg-slate-100 rounded text-xs">
                                      {optIndex + 1}. {option.length > 15 ? option.substring(0, 15) + '...' : option}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {quiz.type === 'ORDER' && quiz.payload.items && (
                              <div className="text-xs text-slate-600">
                                <span className="font-medium">항목:</span>
                                <div className="mt-1">
                                  {quiz.payload.items.slice(0, 3).map((item: string, itemIndex: number) => (
                                    <div key={itemIndex} className="text-xs">{item}</div>
                                  ))}
                                  {quiz.payload.items.length > 3 && (
                                    <div className="text-xs text-slate-400">...외 {quiz.payload.items.length - 3}개</div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {quiz.type === 'MATCH' && quiz.payload.left && quiz.payload.right && (
                              <div className="text-xs text-slate-600">
                                <span className="font-medium">연결:</span>
                                <div className="mt-1">
                                  {quiz.payload.left.slice(0, 2).map((left: string, pairIndex: number) => (
                                    <div key={pairIndex} className="text-xs">
                                      {left} ↔ {quiz.payload.right[pairIndex]}
                                    </div>
                                  ))}
                                  {quiz.payload.left.length > 2 && (
                                    <div className="text-xs text-slate-400">...외 {quiz.payload.left.length - 2}개</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">등록된 퀴즈가 없습니다.</p>
            )}
            
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setQuizModalOpen(false);
                  setSelectedQuizIds([]);
                }}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAddSelectedQuizzes}
                className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
                disabled={selectedQuizIds.length === 0}
              >
                선택한 퀴즈 추가 ({selectedQuizIds.length}개)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 보상 추가 모달 */}
      {rewardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-slate-900 shadow-xl">
            <header className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-primary-600">보상 추가</h3>
                <p className="text-xs text-slate-500">{session.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setRewardModalOpen(false)}
                className="text-sm text-slate-500 transition hover:text-slate-700"
              >
                닫기
              </button>
            </header>
            {rewardsLoading ? (
              <p className="text-sm text-slate-600">보상 목록을 불러오는 중…</p>
            ) : rewards.length ? (
              <ul className="max-h-60 space-y-2 overflow-y-auto">
                {rewards.map((reward) => {
                  const alreadyAssigned = session.rewards?.some((item) => item.id === reward.id);
                  return (
                    <li key={reward.id}>
                      <label className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                        <div>
                          <p className="font-semibold text-primary-600">{reward.title}</p>
                          <p className="text-xs text-slate-500">기간: {reward.duration}</p>
                          {alreadyAssigned && (
                            <p className="text-[11px] text-emerald-600">이미 추가된 보상</p>
                          )}
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
              <p className="text-sm text-slate-600">등록된 보상이 없습니다.</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRewardModalOpen(false)}
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAssignReward}
                className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
                disabled={!selectingRewardId}
              >
                보상 추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
