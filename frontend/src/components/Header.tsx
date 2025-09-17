import { NavLink } from 'react-router-dom';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-2 text-sm font-semibold transition ${
    isActive ? 'bg-primary-600 text-white' : 'text-slate-300 hover:bg-slate-800'
  }`;

export default function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <span className="text-lg font-semibold text-primary-400">나만의 한국사 학습 카드</span>
        <nav className="flex items-center gap-2">
          <NavLink to="/contents" className={navClass} end>
            콘텐츠 리스트
          </NavLink>
          <NavLink to="/quizzes" className={navClass}>
            퀴즈 리스트
          </NavLink>
          <NavLink to="/studies" className={navClass}>
            학습 리스트
          </NavLink>
          <NavLink to="/rewards" className={navClass}>
            보상 리스트
          </NavLink>
          <NavLink to="/upload" className={navClass}>
            Upload JSON
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
