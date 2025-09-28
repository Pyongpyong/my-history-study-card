import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteContent, fetchContents } from '../api';
import Badge from '../components/Badge';
import { useAuth } from '../context/AuthContext';

export default function ContentListPage() {
  const [contents, setContents] = useState<Awaited<ReturnType<typeof fetchContents>>['items']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeKeywords, setActiveKeywords] = useState<string[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchContents();
      setContents(data.items);
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '콘텐츠 목록을 불러오지 못했습니다.';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (event: MouseEvent, id: number) => {
    event.preventDefault();
    event.stopPropagation();
    if (!confirm('해당 콘텐츠와 관련 퀴즈를 삭제할까요?')) return;
    try {
      await deleteContent(id);
      await load();
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '삭제에 실패했습니다.';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    }
  };

  const availableKeywords = useMemo(() => {
    const keywordsSet = new Set<string>();
    contents.forEach((item) => {
      (item.keywords ?? []).forEach((keyword) => {
        if (keyword && keyword.trim()) {
          keywordsSet.add(keyword);
        }
      });
    });
    return Array.from(keywordsSet).sort((a, b) => a.localeCompare(b));
  }, [contents]);

  const toggleKeyword = (keyword: string) => {
    setActiveKeywords((prev) =>
      prev.includes(keyword) ? prev.filter((item) => item !== keyword) : [...prev, keyword],
    );
  };

  const filteredContents = useMemo(() => {
    if (!activeKeywords.length) {
      return contents;
    }
    return contents.filter((item) => {
      const itemKeywords = item.keywords ?? [];
      return activeKeywords.every((keyword) => itemKeywords.includes(keyword));
    });
  }, [contents, activeKeywords]);


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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">총 {contents.length}개의 콘텐츠</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        </div>
      </div>

      {!contents.length ? (
        <p className="text-sm text-slate-600">아직 등록된 콘텐츠가 없습니다.</p>
      ) : null}

      {availableKeywords.length ? (
        <div className="flex flex-wrap gap-2">
          {availableKeywords.map((keyword) => {
            const active = activeKeywords.includes(keyword);
            return (
              <button
                key={keyword}
                type="button"
                onClick={() => toggleKeyword(keyword)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? 'border border-primary-500 bg-primary-100 text-primary-600'
                    : 'border border-slate-300 text-slate-600 hover:bg-slate-100'
                }`}
              >
                #{keyword}
              </button>
            );
          })}
          {activeKeywords.length ? (
            <button
              type="button"
              onClick={() => setActiveKeywords([])}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
            >
              키워드 초기화
            </button>
          ) : null}
        </div>
      ) : null}

      {filteredContents.length ? (
        filteredContents.map((item) => (
          <Link
            key={item.id}
            to={`/contents/${item.id}`}
            className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-primary-500"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-primary-600">{item.title}</h2>
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
                  className="rounded border border-rose-500 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10"
                >
                  삭제
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-sm text-slate-700">
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
        ))
      ) : (
        <p className="text-sm text-slate-600">선택한 키워드에 해당하는 콘텐츠가 없습니다.</p>
      )}
    </div>
  );
}
