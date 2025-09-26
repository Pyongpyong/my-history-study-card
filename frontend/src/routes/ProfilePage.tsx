import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Refresh user data to ensure we have the latest points and level
    if (user) {
      refresh();
    }
  }, [user, refresh]);
  
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const handleGoToSettings = () => {
    navigate('/settings');
  };

  const handleGoToAi = () => {
    navigate('/ai');
  };

  const handleGoToAdmin = () => {
    navigate('/admin');
  };

  const remainingToNext = user.is_max_level ? 0 : Math.max(0, user.points_to_next_level);
  const progressPercentage = user.is_max_level
    ? 100
    : Math.min(100, Math.max(0, 100 - remainingToNext));

  const stats: Array<{ label: string; value: string | number; accent: string }> = [
    { label: '현재 레벨', value: user.level, accent: 'text-blue-600' },
    { label: '보유 포인트', value: user.points.toLocaleString(), accent: 'text-green-600' },
    { label: '남은 포인트', value: user.is_max_level ? '0' : `${remainingToNext}`, accent: 'text-amber-600' },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-2xl font-bold mb-6 text-gray-800">프로필</h1>
        
        <div className="space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-lg font-medium text-gray-700 mb-2">계정 정보</h2>
            <div className="space-y-2">
              <p><span className="font-medium">이메일:</span> {user.email}</p>
              <p><span className="font-medium">가입일:</span> {new Date(user.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="border-b pb-4">
            <h2 className="text-lg font-medium text-gray-700 mb-4">학습 현황</h2>
            
            <div className="bg-gray-100 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <span className="text-sm font-medium text-gray-700">레벨 {user.level}</span>
                  {user.is_max_level ? (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                      최고 레벨 달성!
                    </span>
                  ) : (
                    <span className="ml-2 text-xs text-gray-500">
                      Lv. {user.level}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium text-primary-600">
                  {user.points.toLocaleString()} 포인트
                </span>
              </div>
              
              {!user.is_max_level && (
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-primary-600 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              )}
              
              {!user.is_max_level && (
                <p className="text-xs text-gray-500 mt-2">
                  다음 레벨까지 {remainingToNext}점 남았어요!
                </p>
              )}
            </div>
            
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {stats.map((item) => (
                <div key={item.label} className="bg-slate-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-slate-700">{item.label}</h3>
                  <p className={`text-2xl font-bold ${item.accent}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="pt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={handleGoToSettings}
              className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
            >
              사용자 설정 이동
            </button>
            <div className="flex flex-col gap-2 sm:flex-row">
              {user.is_admin ? (
                <>
                  <button
                    onClick={handleGoToAi}
                    className="w-full sm:w-auto px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 transition-colors"
                  >
                    AI 생성 테스트
                  </button>
                  <button
                    onClick={handleGoToAdmin}
                    className="w-full sm:w-auto px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 transition-colors"
                  >
                    관리자 페이지
                  </button>
                </>
              ) : null}
              <button
                onClick={handleLogout}
                className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
