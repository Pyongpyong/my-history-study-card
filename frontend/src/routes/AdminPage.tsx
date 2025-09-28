import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchAllUsersRequest,
  createAdminUserRequest,
  createLearningHelperRequest,
  updateLearningHelperRequest,
  deleteLearningHelperRequest,
  uploadLearningHelperImageRequest,
  fetchCardDecksRequest,
  createCardDeckRequest,
  updateCardDeckRequest,
  deleteCardDeckRequest,
  uploadCardDeckImageRequest,
  exportContents,
  type UserProfile,
  type LearningHelperOut,
  type CardDeck,
  type CardDeckCreate,
  type CardDeckUpdate,
} from '../api';
import { useAuth } from '../context/AuthContext';
import { useLearningHelpers } from '../hooks/useLearningHelpers';
import { buildTeacherFilename, getTeacherAssetUrl, getHelperAssetUrl, getCardDeckImageUrl } from '../utils/assets';

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // JSON 관련 상태
  const [exporting, setExporting] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [makeAdmin, setMakeAdmin] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  
  // 탭 상태
  const [activeTab, setActiveTab] = useState<'jsonManagement' | 'helpers' | 'cardDecks'>('jsonManagement');
  const {
    helpers: helperList,
    loading: helperLoading,
    error: helperError,
    refresh: refreshHelpers,
  } = useLearningHelpers();
  const [helperEdits, setHelperEdits] = useState<Record<number, { name: string; level: string; description: string }>>({});
  const [newHelperName, setNewHelperName] = useState('');
  const [newHelperLevel, setNewHelperLevel] = useState('');
  const [newHelperDescription, setNewHelperDescription] = useState('');
  const [helperStatus, setHelperStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [creatingHelper, setCreatingHelper] = useState(false);
  const [uploadingVariant, setUploadingVariant] = useState<{ id: number; variant: 'idle' | 'correct' | 'incorrect' } | null>(null);
  const [pendingVariantFiles, setPendingVariantFiles] = useState<Record<number, Partial<Record<'idle' | 'correct' | 'incorrect', File>>>>({});
  const variantLabels: Record<'idle' | 'correct' | 'incorrect', string> = {
    idle: '기본',
    correct: '정답',
    incorrect: '오답',
  };

  // Card Deck states
  const [cardDecks, setCardDecks] = useState<CardDeck[]>([]);
  const [cardDecksLoading, setCardDecksLoading] = useState(true);
  const [cardDecksError, setCardDecksError] = useState<string | null>(null);
  const [newCardDeck, setNewCardDeck] = useState<CardDeckCreate>({
    name: '',
    description: '',
    front_image: '',
    back_image: '',
    is_default: false,
  });
  const [cardDeckEdits, setCardDeckEdits] = useState<Record<number, CardDeckUpdate>>({});
  const [creatingCardDeck, setCreatingCardDeck] = useState(false);
  const [cardDeckStatus, setCardDeckStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [uploadingCardDeckImage, setUploadingCardDeckImage] = useState<{ id: number; type: 'front' | 'back' } | null>(null);
  const [pendingCardDeckFiles, setPendingCardDeckFiles] = useState<Record<number, Partial<Record<'front' | 'back', File>>>>({});
  
  // 새 카드덱을 위한 파일 미리보기 상태
  const [newCardDeckFiles, setNewCardDeckFiles] = useState<{ front?: File; back?: File }>({});
  const [newCardDeckPreviews, setNewCardDeckPreviews] = useState<{ front?: string; back?: string }>({});
  
  // 기존 카드덱 편집을 위한 파일 미리보기 상태
  const [editCardDeckFiles, setEditCardDeckFiles] = useState<Record<number, { front?: File; back?: File }>>({});
  const [editCardDeckPreviews, setEditCardDeckPreviews] = useState<Record<number, { front?: string; back?: string }>>({});
  
  // 학습 도우미 편집을 위한 파일 미리보기 상태
  const [helperFiles, setHelperFiles] = useState<Record<number, Partial<Record<'idle' | 'correct' | 'incorrect', File>>>>({});
  const [helperPreviews, setHelperPreviews] = useState<Record<number, Partial<Record<'idle' | 'correct' | 'incorrect', string>>>>({});
  
  // 새 학습 도우미를 위한 파일 미리보기 상태
  const [newHelperFiles, setNewHelperFiles] = useState<Partial<Record<'idle' | 'correct' | 'incorrect', File>>>({});
  const [newHelperPreviews, setNewHelperPreviews] = useState<Partial<Record<'idle' | 'correct' | 'incorrect', string>>>({});

  const getHelperEdit = (helperId: number) =>
    helperEdits[helperId] ?? { name: '', level: '', description: '' };

  const handleHelperInputChange = (
    helperId: number,
    field: 'name' | 'level' | 'description',
    value: string,
  ) => {
    setHelperEdits((prev) => {
      const existing = prev[helperId] ?? { name: '', level: '', description: '' };
      return {
        ...prev,
        [helperId]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  const handleHelperCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHelperStatus(null);
    const levelValue = parseInt(newHelperLevel, 10);
    if (!Number.isInteger(levelValue) || levelValue < 1) {
      setHelperStatus({ type: 'error', message: '레벨은 1 이상의 정수여야 합니다.' });
      return;
    }
    if (!newHelperName.trim()) {
      setHelperStatus({ type: 'error', message: '학습 도우미 이름을 입력하세요.' });
      return;
    }
    
    setCreatingHelper(true);
    try {
      // 학습 도우미 생성
      const newHelper = await createLearningHelperRequest({
        name: newHelperName.trim(),
        level_requirement: levelValue,
        description: newHelperDescription.trim() ? newHelperDescription.trim() : undefined,
      });
      
      // 이미지 파일이 있으면 업로드
      const files = newHelperFiles;
      if (files.idle || files.correct || files.incorrect) {
        if (files.idle) {
          await uploadLearningHelperImageRequest(newHelper.id, 'idle', files.idle);
        }
        if (files.correct) {
          await uploadLearningHelperImageRequest(newHelper.id, 'correct', files.correct);
        }
        if (files.incorrect) {
          await uploadLearningHelperImageRequest(newHelper.id, 'incorrect', files.incorrect);
        }
      }
      
      setHelperStatus({ type: 'success', message: '새 학습 도우미가 생성되었습니다.' });
      
      // 상태 초기화
      setNewHelperName('');
      setNewHelperLevel('');
      setNewHelperDescription('');
      setNewHelperFiles({});
      // 미리보기 URL 정리
      Object.values(newHelperPreviews).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
      setNewHelperPreviews({});
      
      await refreshHelpers();
    } catch (err: any) {
      const message = err?.response?.data?.detail ?? err?.message ?? '학습 도우미를 생성하지 못했습니다.';
      setHelperStatus({
        type: 'error',
        message: typeof message === 'string' ? message : JSON.stringify(message),
      });
    } finally {
      setCreatingHelper(false);
    }
  };

  const handleHelperUpdate = async (helperId: number) => {
    const edit = getHelperEdit(helperId);
    const levelValue = parseInt(edit.level, 10);
    if (!Number.isInteger(levelValue) || levelValue < 1) {
      setHelperStatus({ type: 'error', message: '레벨은 1 이상의 정수여야 합니다.' });
      return;
    }
    setHelperStatus(null);
    const pendingFiles = pendingVariantFiles[helperId] ?? {};
    try {
      await updateLearningHelperRequest(helperId, {
        name: edit.name.trim(),
        level_requirement: levelValue,
        description: edit.description.trim() ? edit.description.trim() : undefined,
      });
      const entries = Object.entries(pendingFiles).filter(([, file]) => file instanceof File) as Array<[
        'idle' | 'correct' | 'incorrect',
        File
      ]>;
      for (const [variant, file] of entries) {
        setUploadingVariant({ id: helperId, variant });
        await uploadLearningHelperImageRequest(helperId, variant, file);
      }
      setUploadingVariant(null);
      if (entries.length) {
        setHelperStatus({ type: 'success', message: '학습 도우미 정보와 이미지가 업데이트되었습니다.' });
      } else {
        setHelperStatus({ type: 'success', message: '학습 도우미 정보가 업데이트되었습니다.' });
      }
      setPendingVariantFiles((prev) => ({ ...prev, [helperId]: {} }));
      await refreshHelpers();
    } catch (err: any) {
      setUploadingVariant(null);
      const message = err?.response?.data?.detail ?? err?.message ?? '학습 도우미 정보를 수정하지 못했습니다.';
      setHelperStatus({
        type: 'error',
        message: typeof message === 'string' ? message : JSON.stringify(message),
      });
    }
  };

  const handleHelperDelete = async (helperId: number, helperName: string) => {
    if (!confirm(`정말로 "${helperName}" 학습 도우미를 삭제하시겠습니까?`)) {
      return;
    }
    setHelperStatus(null);
    try {
      await deleteLearningHelperRequest(helperId);
      setHelperStatus({ type: 'success', message: '학습 도우미가 삭제되었습니다.' });
      await refreshHelpers();
    } catch (err: any) {
      const message = err?.response?.data?.detail ?? err?.message ?? '학습 도우미를 삭제하지 못했습니다.';
      setHelperStatus({
        type: 'error',
        message: typeof message === 'string' ? message : JSON.stringify(message),
      });
    }
  };

  const handleHelperFileSelect = (
    helperId: number,
    variant: 'idle' | 'correct' | 'incorrect',
    file: File | null,
  ) => {
    setHelperStatus(null);
    
    if (file) {
      // 파일 저장
      setHelperFiles(prev => ({
        ...prev,
        [helperId]: {
          ...prev[helperId],
          [variant]: file,
        },
      }));

      // 미리보기 URL 생성
      const previewUrl = URL.createObjectURL(file);
      setHelperPreviews(prev => {
        // 이전 URL 정리
        if (prev[helperId]?.[variant]) {
          URL.revokeObjectURL(prev[helperId]![variant]!);
        }
        return {
          ...prev,
          [helperId]: {
            ...prev[helperId],
            [variant]: previewUrl,
          },
        };
      });
    }
    
    setPendingVariantFiles((prev) => {
      const existing = prev[helperId] ?? {};
      return {
        ...prev,
        [helperId]: {
          ...existing,
          [variant]: file ?? undefined,
        },
      };
    });
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllUsersRequest();
      setUsers(data);
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '사용자 목록을 불러오지 못했습니다.';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setHelperEdits(() => {
      const next: Record<number, { name: string; level: string; description: string }> = {};
      helperList.forEach((helper) => {
        next[helper.id] = {
          name: helper.name,
          level: String(helper.level_requirement),
          description: helper.description ?? '',
        };
      });
      return next;
    });
  }, [helperList]);

  useEffect(() => {
    if (!helperList.length) {
      return;
    }
    if (newHelperLevel) {
      return;
    }
    const maxLevel = Math.max(...helperList.map((helper) => helper.level_requirement));
    setNewHelperLevel(String(maxLevel + 1));
  }, [helperList, newHelperLevel]);

  // Card Deck functions
  const loadCardDecks = useCallback(async () => {
    try {
      setCardDecksLoading(true);
      setCardDecksError(null);
      const response = await fetchCardDecksRequest(1, 100);
      setCardDecks(response.items);
    } catch (err: any) {
      const message = err?.response?.data?.detail ?? err?.message ?? '카드덱을 불러오지 못했습니다.';
      setCardDecksError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setCardDecksLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCardDecks();
  }, [loadCardDecks]);

  useEffect(() => {
    setCardDeckEdits(() => {
      const next: Record<number, CardDeckUpdate> = {};
      cardDecks.forEach((deck) => {
        next[deck.id] = {
          name: deck.name,
          description: deck.description,
          front_image: deck.front_image,
          back_image: deck.back_image,
          is_default: deck.is_default,
        };
      });
      return next;
    });
  }, [cardDecks]);

  const handleCreateCardDeck = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCardDeck.name.trim()) {
      setCardDeckStatus({ type: 'error', message: '카드덱 이름은 필수입니다.' });
      return;
    }
    if (!newCardDeckFiles.front || !newCardDeckFiles.back) {
      setCardDeckStatus({ type: 'error', message: '앞면과 뒷면 이미지를 모두 선택해주세요.' });
      return;
    }
    
    setCardDeckStatus(null);
    setCreatingCardDeck(true);
    try {
      // 앞면 이미지 업로드
      const frontResult = await uploadCardDeckImageRequest(newCardDeckFiles.front);
      // 뒷면 이미지 업로드
      const backResult = await uploadCardDeckImageRequest(newCardDeckFiles.back);
      
      // 카드덱 생성
      const cardDeckData = {
        ...newCardDeck,
        front_image: frontResult.filename,
        back_image: backResult.filename,
      };
      
      await createCardDeckRequest(cardDeckData);
      setCardDeckStatus({ type: 'success', message: '새 카드덱이 생성되었습니다.' });
      
      // 상태 초기화
      setNewCardDeck({
        name: '',
        description: '',
        front_image: '',
        back_image: '',
        is_default: false,
      });
      setNewCardDeckFiles({});
      // 미리보기 URL 정리
      Object.values(newCardDeckPreviews).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
      setNewCardDeckPreviews({});
      await loadCardDecks();
    } catch (err: any) {
      const message = err?.response?.data?.detail ?? err?.message ?? '카드덱을 생성하지 못했습니다.';
      setCardDeckStatus({
        type: 'error',
        message: typeof message === 'string' ? message : JSON.stringify(message),
      });
    } finally {
      setCreatingCardDeck(false);
    }
  };

  const handleUpdateCardDeck = async (deckId: number) => {
    const edit = cardDeckEdits[deckId];
    if (!edit || !edit.name?.trim()) {
      setCardDeckStatus({ type: 'error', message: '카드덱 이름은 필수입니다.' });
      return;
    }
    
    setCardDeckStatus(null);
    try {
      let updateData = { ...edit };
      
      // 새로 선택된 파일이 있으면 업로드
      const files = editCardDeckFiles[deckId];
      if (files?.front) {
        const frontResult = await uploadCardDeckImageRequest(files.front);
        updateData.front_image = frontResult.filename;
      }
      if (files?.back) {
        const backResult = await uploadCardDeckImageRequest(files.back);
        updateData.back_image = backResult.filename;
      }
      
      await updateCardDeckRequest(deckId, updateData);
      setCardDeckStatus({ type: 'success', message: '카드덱이 업데이트되었습니다.' });
      
      // 파일 상태 정리
      if (files) {
        setEditCardDeckFiles(prev => ({
          ...prev,
          [deckId]: {},
        }));
        // 미리보기 URL 정리
        const previews = editCardDeckPreviews[deckId];
        if (previews) {
          Object.values(previews).forEach(url => {
            if (url) URL.revokeObjectURL(url);
          });
          setEditCardDeckPreviews(prev => ({
            ...prev,
            [deckId]: {},
          }));
        }
      }
      
      await loadCardDecks();
    } catch (err: any) {
      const message = err?.response?.data?.detail ?? err?.message ?? '카드덱을 업데이트하지 못했습니다.';
      setCardDeckStatus({
        type: 'error',
        message: typeof message === 'string' ? message : JSON.stringify(message),
      });
    }
  };

  const handleDeleteCardDeck = async (deckId: number) => {
    if (!confirm('정말로 이 카드덱을 삭제하시겠습니까?')) {
      return;
    }
    setCardDeckStatus(null);
    try {
      await deleteCardDeckRequest(deckId);
      setCardDeckStatus({ type: 'success', message: '카드덱이 삭제되었습니다.' });
      await loadCardDecks();
    } catch (err: any) {
      const message = err?.response?.data?.detail ?? err?.message ?? '카드덱을 삭제하지 못했습니다.';
      setCardDeckStatus({
        type: 'error',
        message: typeof message === 'string' ? message : JSON.stringify(message),
      });
    }
  };

  const getCardDeckEdit = (deckId: number) =>
    cardDeckEdits[deckId] ?? { name: '', description: '', front_image: '', back_image: '', is_default: false };

  const handleCardDeckInputChange = (deckId: number, field: keyof CardDeckUpdate, value: string | boolean) => {
    setCardDeckEdits((prev) => ({
      ...prev,
      [deckId]: {
        ...prev[deckId],
        [field]: value,
      },
    }));
  };

  const handleCardDeckImageSelect = (deckId: number, type: 'front' | 'back', file: File) => {
    setPendingCardDeckFiles((prev) => ({
      ...prev,
      [deckId]: {
        ...prev[deckId],
        [type]: file,
      },
    }));
  };

  const uploadCardDeckImage = async (deckId: number, type: 'front' | 'back') => {
    const file = pendingCardDeckFiles[deckId]?.[type];
    if (!file) return;

    setUploadingCardDeckImage({ id: deckId, type });
    try {
      const result = await uploadCardDeckImageRequest(file);
      const imageUrl = result.filename;

      // 카드덱 편집 상태 업데이트
      handleCardDeckInputChange(deckId, type === 'front' ? 'front_image' : 'back_image', imageUrl);
      
      // 업로드된 파일 제거
      setPendingCardDeckFiles((prev) => ({
        ...prev,
        [deckId]: {
          ...prev[deckId],
          [type]: undefined,
        },
      }));

      setCardDeckStatus({ type: 'success', message: `${type === 'front' ? '앞면' : '뒷면'} 이미지가 업로드되었습니다.` });
    } catch (err: any) {
      setCardDeckStatus({ type: 'error', message: err.message || '이미지 업로드에 실패했습니다.' });
    } finally {
      setUploadingCardDeckImage(null);
    }
  };

  const uploadNewCardDeckImage = async (type: 'front' | 'back') => {
    const file = pendingCardDeckFiles[-1]?.[type];
    if (!file) return;

    setUploadingCardDeckImage({ id: -1, type });
    try {
      const result = await uploadCardDeckImageRequest(file);
      const imageUrl = result.filename;

      // 새 카드덱 상태 업데이트
      setNewCardDeck(prev => ({
        ...prev,
        [type === 'front' ? 'front_image' : 'back_image']: imageUrl,
      }));
      
      // 업로드된 파일 제거
      setPendingCardDeckFiles((prev) => ({
        ...prev,
        [-1]: {
          ...prev[-1],
          [type]: undefined,
        },
      }));

      setCardDeckStatus({ type: 'success', message: `${type === 'front' ? '앞면' : '뒷면'} 이미지가 업로드되었습니다.` });
    } catch (err: any) {
      setCardDeckStatus({ type: 'error', message: err.message || '이미지 업로드에 실패했습니다.' });
    } finally {
      setUploadingCardDeckImage(null);
    }
  };

  const handleNewCardDeckFileSelect = (type: 'front' | 'back', file: File) => {
    // 파일 저장
    setNewCardDeckFiles(prev => ({
      ...prev,
      [type]: file,
    }));

    // 미리보기 URL 생성
    const previewUrl = URL.createObjectURL(file);
    setNewCardDeckPreviews(prev => {
      // 이전 URL 정리
      if (prev[type]) {
        URL.revokeObjectURL(prev[type]!);
      }
      return {
        ...prev,
        [type]: previewUrl,
      };
    });
  };

  const handleNewHelperFileSelect = (variant: 'idle' | 'correct' | 'incorrect', file: File) => {
    // 파일 저장
    setNewHelperFiles(prev => ({
      ...prev,
      [variant]: file,
    }));

    // 미리보기 URL 생성
    const previewUrl = URL.createObjectURL(file);
    setNewHelperPreviews(prev => {
      // 이전 URL 정리
      if (prev[variant]) {
        URL.revokeObjectURL(prev[variant]!);
      }
      return {
        ...prev,
        [variant]: previewUrl,
      };
    });
  };

  const handleEditCardDeckFileSelect = (deckId: number, type: 'front' | 'back', file: File) => {
    // 파일 저장
    setEditCardDeckFiles(prev => ({
      ...prev,
      [deckId]: {
        ...prev[deckId],
        [type]: file,
      },
    }));

    // 미리보기 URL 생성
    const previewUrl = URL.createObjectURL(file);
    setEditCardDeckPreviews(prev => {
      // 이전 URL 정리
      if (prev[deckId]?.[type]) {
        URL.revokeObjectURL(prev[deckId]![type]!);
      }
      return {
        ...prev,
        [deckId]: {
          ...prev[deckId],
          [type]: previewUrl,
        },
      };
    });
  };


  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    setCreateMessage(null);
    if (!email.trim() || !password.trim()) {
      setCreateError('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    if (password.length < 6) {
      setCreateError('비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    setCreating(true);
    try {
      const created = await createAdminUserRequest({ email: email.trim(), password, is_admin: makeAdmin });
      setCreateMessage(`${created.email} 계정이 생성되었습니다.`);
      setEmail('');
      setPassword('');
      setMakeAdmin(true);
      await loadUsers();
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '계정을 생성하지 못했습니다.';
      setCreateError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setCreating(false);
    }
  };

  // JSON 내보내기 함수
  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportContents();
      const exportedBlob = blob instanceof Blob ? blob : new Blob([blob]);
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const defaultName = `my_history_data_${yyyy}${mm}${dd}.json`;

      const saveAsDialog = (window as unknown as { showSaveFilePicker?: Function }).showSaveFilePicker;
      if (saveAsDialog) {
        try {
          const fileHandle = await saveAsDialog({
            suggestedName: defaultName,
            types: [
              {
                description: 'JSON Files',
                accept: { 'application/json': ['.json'] },
              },
            ],
          });
          const writable = await fileHandle.createWritable();
          await writable.write(exportedBlob);
          await writable.close();
        } catch (err: any) {
          if (err?.name !== 'AbortError') {
            throw err;
          }
        }
      } else {
        const url = URL.createObjectURL(exportedBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = defaultName;
        link.rel = 'noopener';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '콘텐츠를 내보내지 못했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-primary-600">관리자 페이지</h1>
        <p className="text-sm text-slate-500">사용자 계정과 권한을 관리합니다.</p>
        {user ? <p className="text-xs text-slate-500">현재 관리자: {user.email}</p> : null}
      </header>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary-600">새 계정 생성</h2>
        <p className="text-xs text-slate-500">필요에 따라 일반 사용자 또는 관리자 계정을 만들 수 있습니다.</p>
        <form onSubmit={handleCreate} className="space-y-4 text-sm text-slate-600">
          <label className="flex flex-col gap-2">
            이메일
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              required
            />
          </label>
          <label className="flex flex-col gap-2">
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              required
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={makeAdmin}
              onChange={(event) => setMakeAdmin(event.target.checked)}
              className="h-4 w-4"
            />
            관리자 권한 부여
          </label>
          {createError ? <p className="text-sm text-rose-600">{createError}</p> : null}
          {createMessage ? <p className="text-sm text-emerald-600">{createMessage}</p> : null}
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {creating ? '생성 중…' : '계정 생성'}
          </button>
        </form>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary-600">사용자 목록</h2>
          <button
            type="button"
            onClick={() => {
              void loadUsers();
            }}
            className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
          >
            새로고침
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-slate-600">불러오는 중…</p>
        ) : error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : users.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">이메일</th>
                  <th className="px-3 py-2">권한</th>
                  <th className="px-3 py-2">가입일</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id} className="border-b border-slate-200 text-slate-600">
                    <td className="px-3 py-2">{item.email}</td>
                    <td className="px-3 py-2">{item.is_admin ? '관리자' : '일반 사용자'}</td>
                    <td className="px-3 py-2 text-xs">{new Date(item.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-600">등록된 사용자가 없습니다.</p>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary-600">콘텐츠 관리</h2>
            <p className="text-xs text-slate-500">JSON 데이터, 학습 도우미, 카드덱을 관리합니다.</p>
          </div>
        </div>

        {/* 탭 메뉴 */}
        <div className="border-b border-slate-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('jsonManagement')}
              className={`whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium ${
                activeTab === 'jsonManagement'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              JSON 데이터 관리
            </button>
            <button
              onClick={() => setActiveTab('helpers')}
              className={`whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium ${
                activeTab === 'helpers'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              학습 도우미 관리
            </button>
            <button
              onClick={() => setActiveTab('cardDecks')}
              className={`whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium ${
                activeTab === 'cardDecks'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              카드덱 관리
            </button>
          </nav>
        </div>

        {/* JSON 데이터 관리 탭 */}
        {activeTab === 'jsonManagement' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium text-slate-900">JSON 데이터 관리</h3>
                <p className="text-xs text-slate-500">콘텐츠 데이터를 가져오거나 내보냅니다.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-base font-medium text-slate-900 mb-2">JSON 가져오기</h4>
                <p className="text-xs text-slate-500 mb-3">
                  콘텐츠와 퀴즈 데이터를 JSON 파일로 가져옵니다.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/upload')}
                  className="w-full rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
                >
                  JSON 파일 업로드
                </button>
              </div>

              <div className="rounded border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-base font-medium text-slate-900 mb-2">JSON 내보내기</h4>
                <p className="text-xs text-slate-500 mb-3">
                  모든 콘텐츠와 퀴즈 데이터를 JSON 파일로 내보냅니다.
                </p>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  className="w-full rounded bg-slate-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {exporting ? '내보내는 중…' : 'JSON 파일 다운로드'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 학습 도우미 관리 탭 */}
        {activeTab === 'helpers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium text-slate-900">학습 도우미 관리</h3>
                <p className="text-xs text-slate-500">레벨별 학습 도우미 정보를 수정하고 이미지를 업로드합니다.</p>
              </div>
          <button
            type="button"
            onClick={() => {
              setHelperStatus(null);
              void refreshHelpers();
            }}
            className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
            disabled={helperLoading}
          >
            새로고침
          </button>
        </div>

        <form onSubmit={handleHelperCreate} className="grid gap-3 rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-3">
          <label className="flex flex-col gap-1">
            이름
            <input
              value={newHelperName}
              onChange={(event) => setNewHelperName(event.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="예: Level 13 학습도우미"
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            레벨
            <input
              type="number"
              min={1}
              value={newHelperLevel}
              onChange={(event) => setNewHelperLevel(event.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="예: 13"
              required
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-1">
            설명 (선택)
            <input
              value={newHelperDescription}
              onChange={(event) => setNewHelperDescription(event.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="간단한 메모"
            />
          </label>
          
          {/* 이미지 업로드 섹션 */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-sm font-medium text-slate-700">이미지 (선택)</h4>
            <div className="grid gap-3 md:grid-cols-3">
              {(['idle', 'correct', 'incorrect'] as const).map((variant) => (
                <div key={variant} className="rounded border border-slate-200 bg-white p-3">
                  <div className="flex items-center space-x-2">
                    {/* 미리보기 */}
                    {newHelperPreviews[variant] && (
                      <div className="text-center">
                        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-green-300 bg-slate-50">
                          <img
                            src={newHelperPreviews[variant]}
                            alt={`${variantLabels[variant]} 미리보기`}
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <p className="mt-1 text-xs text-green-600">미리보기</p>
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        {variantLabels[variant]} 이미지
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleNewHelperFileSelect(variant, file);
                          }
                        }}
                        className="block w-full text-xs text-slate-500 file:mr-2 file:rounded file:border-0 file:bg-primary-50 file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary-700 hover:file:bg-primary-100"
                      />
                      <p className="mt-1 text-xs text-slate-400">선택하면 미리보기가 표시됩니다.</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="md:col-span-3 flex justify-end">
            <button
              type="submit"
              disabled={creatingHelper}
              className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {creatingHelper ? '생성 중…' : '새 학습 도우미 추가'}
            </button>
          </div>
        </form>

        {helperStatus ? (
          <p
            className={`text-sm ${helperStatus.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}
          >
            {helperStatus.message}
          </p>
        ) : null}

        {helperLoading ? (
          <p className="text-sm text-slate-600">학습 도우미 정보를 불러오는 중…</p>
        ) : helperError ? (
          <p className="text-sm text-rose-600">{helperError}</p>
        ) : helperList.length ? (
          <div className="space-y-4">
            {helperList
              .slice()
              .sort((a, b) => a.level_requirement - b.level_requirement)
              .map((helper) => {
                const edit = getHelperEdit(helper.id);
                const fallbackIndex = Math.max(Math.min(helper.level_requirement, 12) - 1, 0);
                const fallbackImage = getTeacherAssetUrl(buildTeacherFilename(fallbackIndex));
                return (
                  <div
                    key={helper.id}
                    className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2"
                  >
                    <div className="space-y-3 text-sm text-slate-700">
                      <div className="flex items-center gap-3">
                        <span className="rounded bg-primary-100 px-2 py-1 text-xs font-semibold text-primary-600">
                          레벨 {helper.level_requirement}
                        </span>
                        <span className="text-xs text-slate-500">ID: {helper.id}</span>
                      </div>
                      <label className="flex flex-col gap-1">
                        이름
                        <input
                          value={edit.name}
                          onChange={(event) => handleHelperInputChange(helper.id, 'name', event.target.value)}
                          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        레벨
                        <input
                          type="number"
                          min={1}
                          value={edit.level}
                          onChange={(event) => handleHelperInputChange(helper.id, 'level', event.target.value)}
                          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        설명
                        <textarea
                          value={edit.description}
                          onChange={(event) => handleHelperInputChange(helper.id, 'description', event.target.value)}
                          rows={2}
                          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          void handleHelperUpdate(helper.id);
                        }}
                        className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500"
                      >
                        변경 저장
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleHelperDelete(helper.id, helper.name);
                        }}
                        className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                      >
                        삭제
                      </button>
                    </div>
                    <div className="space-y-3 text-xs text-slate-600">
                      {(['idle', 'correct', 'incorrect'] as const).map((variant) => {
                        const pendingFile = pendingVariantFiles[helper.id]?.[variant] ?? null;
                        return (
                          <div
                            key={variant}
                            className="flex items-center gap-3 rounded border border-slate-200 bg-white p-3"
                          >
                            <div className="flex items-center space-x-2">
                              {/* 현재 이미지 */}
                              <div className="text-center">
                                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                                  {(() => {
                                    const asset = getHelperAssetUrl(helper.variants[variant]) ?? fallbackImage;
                                    return asset ? (
                                      <img
                                        src={asset}
                                        alt={`${helper.name} ${variantLabels[variant]}`}
                                        className="h-full w-full object-contain"
                                      />
                                    ) : (
                                      <span className="text-[11px] text-slate-400">이미지 없음</span>
                                    );
                                  })()}
                                </div>
                                <p className="mt-1 text-xs text-slate-500">현재</p>
                              </div>
                              
                              {/* 새 이미지 미리보기 */}
                              {helperPreviews[helper.id]?.[variant] && (
                                <div className="text-center">
                                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-green-300 bg-slate-50">
                                    <img
                                      src={helperPreviews[helper.id]?.[variant]}
                                      alt={`새 ${variantLabels[variant]}`}
                                      className="h-full w-full object-contain"
                                    />
                                  </div>
                                  <p className="mt-1 text-xs text-green-600">새 이미지</p>
                                </div>
                              )}
                            </div>
                            <label className="flex flex-1 flex-col gap-1">
                              <span className="font-semibold text-slate-700">{variantLabels[variant]} 이미지</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(event) => {
                                  const file = event.target.files?.[0] ?? null;
                                  handleHelperFileSelect(helper.id, variant, file);
                                  event.target.value = '';
                                }}
                                disabled={uploadingVariant?.id === helper.id && uploadingVariant.variant === variant}
                                className="text-xs text-slate-500"
                              />
                              {pendingFile ? (
                                <span className="text-[11px] text-slate-500">선택된 파일: {pendingFile.name}</span>
                              ) : (
                                <span className="text-[11px] text-slate-400">이미지를 선택하면 미리보기가 표시됩니다.</span>
                              )}
                              {uploadingVariant?.id === helper.id && uploadingVariant.variant === variant ? (
                                <span className="text-[11px] text-slate-500">업로드 중…</span>
                              ) : null}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <p className="text-sm text-slate-600">등록된 학습 도우미가 없습니다.</p>
        )}
          </div>
        )}

        {/* 카드덱 관리 탭 */}
        {activeTab === 'cardDecks' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium text-slate-900">카드덱 관리</h3>
                <p className="text-xs text-slate-500">학습 카드의 앞뒤면 이미지를 관리합니다.</p>
              </div>
            </div>

        {cardDeckStatus && (
          <div
            className={`rounded-md p-3 text-sm ${
              cardDeckStatus.type === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {cardDeckStatus.message}
          </div>
        )}

        <form onSubmit={handleCreateCardDeck} className="space-y-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <h3 className="text-sm font-medium text-slate-700">새 카드덱 생성</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600">이름 *</label>
              <input
                type="text"
                value={newCardDeck.name}
                onChange={(e) => setNewCardDeck({ ...newCardDeck, name: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="카드덱 이름"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">설명</label>
              <input
                type="text"
                value={newCardDeck.description}
                onChange={(e) => setNewCardDeck({ ...newCardDeck, description: e.target.value })}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="카드덱 설명"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">앞면 이미지 *</label>
              <div className="mt-1 flex items-center space-x-3">
                {newCardDeckPreviews.front && (
                  <img
                    src={newCardDeckPreviews.front}
                    alt="앞면 미리보기"
                    className="h-20 w-12 rounded-md border border-slate-200 object-cover"
                  />
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleNewCardDeckFileSelect('front', file);
                      }
                    }}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-xs file:font-medium file:text-primary-700 hover:file:bg-primary-100"
                  />
                  <p className="mt-1 text-xs text-slate-500">이미지를 선택하면 미리보기가 표시됩니다.</p>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">뒷면 이미지 *</label>
              <div className="mt-1 flex items-center space-x-3">
                {newCardDeckPreviews.back && (
                  <img
                    src={newCardDeckPreviews.back}
                    alt="뒷면 미리보기"
                    className="h-20 w-12 rounded-md border border-slate-200 object-cover"
                  />
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleNewCardDeckFileSelect('back', file);
                      }
                    }}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-xs file:font-medium file:text-primary-700 hover:file:bg-primary-100"
                  />
                  <p className="mt-1 text-xs text-slate-500">이미지를 선택하면 미리보기가 표시됩니다.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="new-card-deck-default"
              checked={newCardDeck.is_default}
              onChange={(e) => setNewCardDeck({ ...newCardDeck, is_default: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="new-card-deck-default" className="text-xs text-slate-600">
              기본 카드덱으로 설정
            </label>
          </div>
          <button
            type="submit"
            disabled={creatingCardDeck}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {creatingCardDeck ? '생성 중…' : '카드덱 생성'}
          </button>
        </form>

        {cardDecksLoading ? (
          <p className="text-sm text-slate-600">카드덱을 불러오는 중…</p>
        ) : cardDecksError ? (
          <p className="text-sm text-red-600">오류: {cardDecksError}</p>
        ) : cardDecks.length ? (
          <div className="space-y-4">
            {cardDecks.map((deck) => {
              const edit = cardDeckEdits[deck.id] || {};
              return (
                <div key={deck.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium text-slate-800">{deck.name}</h4>
                      {deck.is_default && (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">기본</span>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleUpdateCardDeck(deck.id)}
                        className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        변경 저장
                      </button>
                      {!deck.is_default && (
                        <button
                          onClick={() => handleDeleteCardDeck(deck.id)}
                          className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600">이름</label>
                      <input
                        type="text"
                        value={edit.name || ''}
                        onChange={(e) => handleCardDeckInputChange(deck.id, 'name', e.target.value)}
                        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600">설명</label>
                      <input
                        type="text"
                        value={edit.description || ''}
                        onChange={(e) => handleCardDeckInputChange(deck.id, 'description', e.target.value)}
                        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600">앞면 이미지</label>
                      <div className="mt-1 flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          {deck.front_image && (
                            <div className="text-center">
                              <img
                                src={getCardDeckImageUrl(deck.front_image) || ''}
                                alt="현재 앞면"
                                className="h-20 w-12 rounded-md border border-slate-200 object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjFGNUY5Ii8+CjxwYXRoIGQ9Ik0zMiAyMEM0NC40IDIwIDUyIDI3LjYgNTIgNDBDNTIgNTIuNCA0NC40IDYwIDMyIDYwQzE5LjYgNjAgMTIgNTIuNCAxMiA0MEMxMiAyNy42IDE5LjYgMjAgMzIgMjBaIiBmaWxsPSIjRTJFOEYwIi8+CjxwYXRoIGQ9Ik0zMiAzMkMzNS4zIDMyIDM4IDM0LjcgMzggMzhDMzggNDEuMyAzNS4zIDQ0IDMyIDQ0QzI4LjcgNDQgMjYgNDEuMyAyNiAzOEMyNiAzNC43IDI4LjcgMzIgMzIgMzJaIiBmaWxsPSIjOTRBM0I4Ii8+CjwvZXZnPgo=';
                                }}
                              />
                              <p className="mt-1 text-xs text-slate-500">현재</p>
                            </div>
                          )}
                          {editCardDeckPreviews[deck.id]?.front && (
                            <div className="text-center">
                              <img
                                src={editCardDeckPreviews[deck.id]?.front}
                                alt="새 앞면"
                                className="h-20 w-12 rounded-md border border-green-300 object-cover"
                              />
                              <p className="mt-1 text-xs text-green-600">새 이미지</p>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleEditCardDeckFileSelect(deck.id, 'front', file);
                              }
                            }}
                            className="block w-full text-xs text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-xs file:font-medium file:text-primary-700 hover:file:bg-primary-100"
                          />
                          <p className="mt-1 text-xs text-slate-500">이미지를 선택하면 미리보기가 표시됩니다.</p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600">뒷면 이미지</label>
                      <div className="mt-1 flex items-center space-x-3">
                        <div className="flex items-center space-x-2">
                          {deck.back_image && (
                            <div className="text-center">
                              <img
                                src={getCardDeckImageUrl(deck.back_image) || ''}
                                alt="현재 뒷면"
                                className="h-20 w-12 rounded-md border border-slate-200 object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <p className="mt-1 text-xs text-slate-500">현재</p>
                            </div>
                          )}
                          {editCardDeckPreviews[deck.id]?.back && (
                            <div className="text-center">
                              <img
                                src={editCardDeckPreviews[deck.id]?.back}
                                alt="새 뒷면"
                                className="h-20 w-12 rounded-md border border-green-300 object-cover"
                              />
                              <p className="mt-1 text-xs text-green-600">새 이미지</p>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleEditCardDeckFileSelect(deck.id, 'back', file);
                              }
                            }}
                            className="block w-full text-xs text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-primary-50 file:px-4 file:py-2 file:text-xs file:font-medium file:text-primary-700 hover:file:bg-primary-100"
                          />
                          <p className="mt-1 text-xs text-slate-500">이미지를 선택하면 미리보기가 표시됩니다.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center">
                    <input
                      type="checkbox"
                      id={`card-deck-default-${deck.id}`}
                      checked={edit.is_default || false}
                      onChange={(e) => handleCardDeckInputChange(deck.id, 'is_default', e.target.checked)}
                      className="mr-2"
                    />
                    <label htmlFor={`card-deck-default-${deck.id}`} className="text-xs text-slate-600">
                      기본 카드덱으로 설정
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-600">등록된 카드덱이 없습니다.</p>
        )}
          </div>
        )}
      </section>

    </section>
  );
}
