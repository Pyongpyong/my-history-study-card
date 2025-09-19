import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-2 text-sm font-semibold transition ${
    isActive
      ? 'bg-primary-600 text-white hover:bg-primary-500 hover:text-white'
      : 'text-slate-700 hover:bg-primary-50 hover:text-primary-700'
  }`;

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-slate-100">
      <div className="header-wrapper mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <span className="text-lg font-semibold text-primary-600">HistudyCard</span>
        <nav className="nav-links flex items-center gap-2">
          <NavLink to="/contents" className={navClass} end>
            콘텐츠 리스트
          </NavLink>
          <NavLink to="/quizzes" className={navClass}>
            퀴즈 리스트
          </NavLink>
          {user ? (
            <>
              <NavLink to="/studies" className={navClass}>
                학습 리스트
              </NavLink>
              <NavLink to="/rewards" className={navClass}>
                보상 리스트
              </NavLink>
              <NavLink to="/upload" className={navClass}>
                Upload JSON
              </NavLink>
              <NavLink to="/settings" className={navClass}>
                사용자 설정
              </NavLink>
              {user.is_admin ? (
                <NavLink to="/admin" className={navClass}>
                  관리자 페이지
                </NavLink>
              ) : null}
            </>
          ) : null}
        </nav>
        <div className="header-actions flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-slate-700">{user.email}</span>
              <button
                type="button"
                onClick={logout}
                className="rounded border border-primary-600 px-3 py-1 text-sm font-semibold text-primary-600 transition hover:bg-primary-50"
              >
                로그아웃
              </button>
            </>
          ) : (
            <NavLink to="/auth" className={navClass}>
              로그인
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}
