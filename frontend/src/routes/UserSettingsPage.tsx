import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function UserSettingsPage() {
  const { user, changePassword, deleteAccount } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);
    if (!currentPassword.trim() || !newPassword.trim()) {
      setPasswordError('현재 비밀번호와 새 비밀번호를 입력해주세요.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setPasswordSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMessage('비밀번호가 변경되었습니다. 다시 로그인할 필요 없이 계속 이용할 수 있습니다.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '비밀번호를 변경하지 못했습니다.';
      setPasswordError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleDeleteAccount = async (event: FormEvent) => {
    event.preventDefault();
    setDeleteError(null);
    if (!deletePassword.trim()) {
      setDeleteError('비밀번호를 입력해주세요.');
      return;
    }
    if (deleteConfirm.trim().toLowerCase() !== '삭제') {
      setDeleteError('확인 문구에 "삭제"를 입력해주세요.');
      return;
    }
    if (!confirm('정말로 계정을 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.')) {
      return;
    }
    setDeleteSubmitting(true);
    try {
      await deleteAccount(deletePassword);
      alert('계정이 삭제되었습니다. 그동안 이용해주셔서 감사합니다.');
      navigate('/');
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '계정을 삭제하지 못했습니다.';
      setDeleteError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <section className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-primary-600">사용자 설정</h1>
        <p className="text-sm text-slate-500">비밀번호 변경 및 계정 삭제와 같은 보안 관련 설정을 관리합니다.</p>
        {user ? (
          <p className="text-xs text-slate-500">현재 로그인: {user.email}</p>
        ) : null}
      </header>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-primary-600">비밀번호 변경</h2>
        <p className="text-xs text-slate-500">현재 비밀번호를 확인하고 새 비밀번호로 변경합니다.</p>
        <form onSubmit={handlePasswordSubmit} className="space-y-4 text-sm text-slate-600">
          <label className="flex flex-col gap-2">
            현재 비밀번호
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              required
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              새 비밀번호
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={6}
                className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                required
              />
            </label>
            <label className="flex flex-col gap-2">
              새 비밀번호 확인
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={6}
                className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                required
              />
            </label>
          </div>
          {passwordError ? <p className="text-sm text-rose-600">{passwordError}</p> : null}
          {passwordMessage ? <p className="text-sm text-emerald-600">{passwordMessage}</p> : null}
          <button
            type="submit"
            disabled={passwordSubmitting}
            className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {passwordSubmitting ? '변경 중…' : '비밀번호 변경'}
          </button>
        </form>
      </section>

      <section className="space-y-4 rounded-lg border border-rose-200 bg-rose-50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-rose-600">계정 삭제</h2>
        <p className="text-xs text-rose-500">
          계정을 삭제하면 학습 기록, 보상, 개인 콘텐츠 등 모든 데이터가 삭제되며 복구할 수 없습니다.
        </p>
        <form onSubmit={handleDeleteAccount} className="space-y-4 text-sm text-slate-600">
          <label className="flex flex-col gap-2">
            비밀번호 확인
            <input
              type="password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
              required
            />
          </label>
          <label className="flex flex-col gap-2">
            확인 문구 입력 ("삭제")
            <input
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder="삭제"
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
              required
            />
          </label>
          {deleteError ? <p className="text-sm text-rose-600">{deleteError}</p> : null}
          <button
            type="submit"
            disabled={deleteSubmitting}
            className="rounded border border-rose-500 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleteSubmitting ? '삭제 중…' : '계정 삭제'}
          </button>
        </form>
      </section>
    </section>
  );
}
