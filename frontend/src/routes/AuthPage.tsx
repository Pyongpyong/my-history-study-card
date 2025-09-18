import { FormEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | undefined)?.from;

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }
    if (mode === 'register' && password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password);
      }
      navigate(from?.pathname ? from.pathname : '/contents', { replace: true });
    } catch (err: any) {
      const message = err?.response?.data?.detail ?? err?.message ?? '요청을 처리하지 못했습니다.';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-md space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold text-primary-600">{mode === 'login' ? '로그인' : '회원가입'}</h1>
        <p className="text-sm text-slate-500">
          {mode === 'login' ? '계정이 없다면 회원가입을 진행해주세요.' : '이미 계정이 있다면 로그인으로 이동하세요.'}
        </p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            이메일
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-600">
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

          {mode === 'register' ? (
            <label className="flex flex-col gap-2 text-sm text-slate-600">
              비밀번호 확인
              <input
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                minLength={6}
                className="rounded border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                required
              />
            </label>
          ) : null}

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? '처리 중…' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>
      </div>

      <div className="text-center text-sm text-slate-600">
        {mode === 'login' ? (
          <button type="button" onClick={() => setMode('register')} className="text-primary-600 hover:text-primary-700">
            아직 계정이 없다면 회원가입
          </button>
        ) : (
          <button type="button" onClick={() => setMode('login')} className="text-primary-600 hover:text-primary-700">
            이미 계정이 있다면 로그인
          </button>
        )}
      </div>
    </section>
  );
}
