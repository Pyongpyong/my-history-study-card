import { NavLink, Link } from 'react-router-dom';
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
        <Link 
          to="/" 
          className="text-lg font-semibold text-primary-600 hover:text-primary-700 transition-colors"
        >
          HiStudyCard
        </Link>
        <nav className="nav-links flex items-center gap-2">
          <NavLink to="/contents" className={navClass} end>
            콘텐츠
          </NavLink>
          <NavLink to="/quizzes" className={navClass}>
            퀴즈
          </NavLink>
          <NavLink to="/studies" className={navClass}>
            {user ? '내 학습' : '공개 학습'}
          </NavLink>
          {user && (
            <NavLink to="/rewards" className={navClass}>
              보상
            </NavLink>
          )}
        </nav>
        <div className="header-actions flex items-center gap-3">
          {user ? (
            <>
              <div className="flex items-center gap-4">
                <NavLink 
                  to="/profile" 
                  className="text-sm font-medium text-slate-700 hover:text-primary-600 transition-colors"
                >
                  {user.email}
                </NavLink>
              </div>
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
