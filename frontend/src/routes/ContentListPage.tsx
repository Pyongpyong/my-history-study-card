import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteContent, fetchContents } from '../api';
import Badge from '../components/Badge';
import { useAuth } from '../context/AuthContext';

export default function ContentListPage() {
  const [contents, setContents] = useState<Awaited<ReturnType<typeof fetchContents>>['items']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [activePeriod, setActivePeriod] = useState<string>('전체');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();

  const pageSize = 20;

  const periods = ['전체', '고대', '고려', '조선', '근대', '현대'];

  const load = useCallback(async (page: number = currentPage) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchContents(page, pageSize);
      setContents(data.items);
      setTotalItems(data.meta.total);
      setTotalPages(Math.ceil(data.meta.total / pageSize));
      setCurrentPage(page);
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '콘텐츠 목록을 불러오지 못했습니다.';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (event: MouseEvent, id: number) => {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm('해당 콘텐츠와 관련 퀴즈를 삭제할까요?')) return;
    try {
      await deleteContent(id);
      await load(currentPage);
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '삭제에 실패했습니다.';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      load(page);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(1, currentPage - 2);
      const end = Math.min(totalPages, start + maxVisiblePages - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  const availableCategories = useMemo(() => {
    const categoriesSet = new Set<string>();
    contents.forEach((item) => {
      (item.categories ?? []).forEach((category) => {
        if (category && category.trim()) {
          categoriesSet.add(category);
        }
      });
    });
    return Array.from(categoriesSet).sort((a, b) => a.localeCompare(b));
  }, [contents]);

  const toggleCategory = (category: string) => {
    setActiveCategories((prev) =>
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category],
    );
  };

  const filteredContents = useMemo(() => {
    let filtered = contents;
    
    // 시대별 필터링
    if (activePeriod !== '전체') {
      filtered = filtered.filter((item) => {
        const itemPeriods = item.eras?.map(era => era.period) ?? [];
        return itemPeriods.includes(activePeriod);
      });
    }
    
    // 카테고리 필터링
    if (activeCategories.length) {
      filtered = filtered.filter((item) => {
        const itemCategories = item.categories ?? [];
        return activeCategories.every((category) => itemCategories.includes(category));
      });
    }
    
    return filtered;
  }, [contents, activeCategories, activePeriod]);


  if (loading) {
    return <p className="text-sm text-slate-600">불러오는 중…</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-primary-600">콘텐츠 리스트</h1>
        {user ? (
          <button
            type="button"
            onClick={() => navigate('/contents/new')}
            className="rounded border border-primary-500 px-3 py-1 text-xs font-semibold text-primary-600 transition hover:bg-primary-50"
          >
            콘텐츠 추가
          </button>
        ) : null}
      </div>
      {/* 시대별 탭 메뉴 */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-8">
          {periods.map((period) => (
            <button
              key={period}
              onClick={() => setActivePeriod(period)}
              className={`whitespace-nowrap border-b-2 py-2 px-1 text-sm font-medium transition ${
                activePeriod === period
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              }`}
            >
              {period}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          총 {totalItems}개의 콘텐츠 (페이지 {currentPage}/{totalPages})
          {activePeriod !== '전체' && ` - ${activePeriod}: ${filteredContents.length}개 표시`}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        </div>
      </div>

      {!contents.length ? (
        <p className="text-sm text-slate-600">아직 등록된 콘텐츠가 없습니다.</p>
      ) : null}

      {availableCategories.length ? (
        <div className="flex flex-wrap gap-2">
          {availableCategories.map((category) => {
            const active = activeCategories.includes(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() => toggleCategory(category)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? 'border border-primary-500 bg-primary-100 text-primary-600'
                    : 'border border-slate-300 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {category}
              </button>
            );
          })}
          {activeCategories.length ? (
            <button
              type="button"
              onClick={() => setActiveCategories([])}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
            >
              카테고리 초기화
            </button>
          ) : null}
        </div>
      ) : null}

      {filteredContents.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredContents.map((item) => (
            <Link
              key={item.id}
              to={`/contents/${item.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-primary-500"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-primary-600 truncate">{item.title}</h2>
                  <time className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</time>
                  <div className="mt-1">
                    <Badge color={item.visibility === 'PUBLIC' ? 'success' : 'default'}>
                      {item.visibility === 'PUBLIC' ? '공개' : '비공개'}
                    </Badge>
                  </div>
                </div>
                {user && item.owner_id === user.id ? (
                  <button
                    type="button"
                    onClick={(event) => handleDelete(event, item.id)}
                    className="rounded border border-rose-500 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10 flex-shrink-0"
                  >
                    삭제
                  </button>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-slate-700 line-clamp-3">
                {item.content.length > 120 ? `${item.content.slice(0, 120)}…` : item.content}
              </p>
              {item.categories?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.categories.map((category) => (
                    <Badge key={`${item.id}-category-${category}`}>{category}</Badge>
                  ))}
                </div>
              ) : null}
              {item.eras?.length ? (
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                  {item.eras.map((entry, index) => (
                    <span key={`${item.id}-era-${index}`} className="inline-flex items-center gap-1">
                      <span className="font-semibold text-primary-600">{entry.period}</span>
                      {entry.detail ? <span className="text-slate-500">{entry.detail}</span> : null}
                    </span>
                  ))}
                </div>
              ) : null}
              {item.keywords?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.keywords.map((keyword) => (
                    <Badge key={`${item.id}-keyword-${keyword}`}>{keyword}</Badge>
                  ))}
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          {activePeriod !== '전체' 
            ? `${activePeriod} 시대에 해당하는 콘텐츠가 없습니다.`
            : '선택한 카테고리에 해당하는 콘텐츠가 없습니다.'
          }
        </p>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 mt-8">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm font-medium text-slate-500 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            이전
          </button>
          
          {getPageNumbers().map((page) => (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                page === currentPage
                  ? 'text-white bg-primary-600 border border-primary-600'
                  : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-50'
              }`}
            >
              {page}
            </button>
          ))}
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm font-medium text-slate-500 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
