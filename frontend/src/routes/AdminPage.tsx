import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  fetchAllUsersRequest,
  createAdminUserRequest,
  createLearningHelperRequest,
  updateLearningHelperRequest,
  uploadLearningHelperImageRequest,
  type UserProfile,
  type LearningHelperOut,
} from '../api';
import { useAuth } from '../context/AuthContext';
import { useLearningHelpers } from '../hooks/useLearningHelpers';
import { buildTeacherFilename, getTeacherAssetUrl, getHelperAssetUrl } from '../utils/assets';

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [makeAdmin, setMakeAdmin] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
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
      await createLearningHelperRequest({
        name: newHelperName.trim(),
        level_requirement: levelValue,
        description: newHelperDescription.trim() ? newHelperDescription.trim() : undefined,
      });
      setHelperStatus({ type: 'success', message: '새 학습 도우미가 생성되었습니다.' });
      setNewHelperName('');
      setNewHelperLevel('');
      setNewHelperDescription('');
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

  const handleHelperFileSelect = (
    helperId: number,
    variant: 'idle' | 'correct' | 'incorrect',
    file: File | null,
  ) => {
    setHelperStatus(null);
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
            <h2 className="text-lg font-semibold text-primary-600">학습 도우미 관리</h2>
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
                    </div>
                    <div className="space-y-3 text-xs text-slate-600">
                      {(['idle', 'correct', 'incorrect'] as const).map((variant) => {
                        const pendingFile = pendingVariantFiles[helper.id]?.[variant] ?? null;
                        return (
                          <div
                            key={variant}
                            className="flex items-center gap-3 rounded border border-slate-200 bg-white p-3"
                          >
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
                                <span className="text-[11px] text-slate-400">변경 저장을 눌러 업로드가 적용됩니다.</span>
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
      </section>
    </section>
  );
}
