import { FormEvent, useCallback, useEffect, useState } from 'react';
import { fetchAllUsersRequest, createAdminUserRequest, type UserProfile } from '../api';
import { useAuth } from '../context/AuthContext';

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
    </section>
  );
}
