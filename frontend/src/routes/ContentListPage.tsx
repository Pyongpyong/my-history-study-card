import { MouseEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deleteContent, fetchContents, exportContents } from '../api';
import Badge from '../components/Badge';

export default function ContentListPage() {
  const [contents, setContents] = useState<Awaited<ReturnType<typeof fetchContents>>['items']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);

  const load = async () => {
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
  };

  useEffect(() => {
    load();
  }, []);

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

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    contents.forEach((item) => {
      (item.tags ?? []).forEach((tag) => {
        if (tag && tag.trim()) {
          tags.add(tag);
        }
      });
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [contents]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag],
    );
  };

  const filteredContents = useMemo(() => {
    if (!activeTags.length) {
      return contents;
    }
    return contents.filter((item) => {
      const itemTags = item.tags ?? [];
      return activeTags.every((tag) => itemTags.includes(tag));
    });
  }, [contents, activeTags]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportContents();
      const exportedBlob = blob instanceof Blob ? blob : new Blob([blob]);
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const defaultName = `my_history_data_${yyyy}${mm}${dd}.json`;

      const saveAsDialog = (window as unknown as { showSaveFilePicker?: Function }).showSaveFilePicker;
      if (saveAsDialog) {
        try {
          const fileHandle = await saveAsDialog({
            suggestedName: defaultName,
            types: [
              {
                description: 'JSON Files',
                accept: { 'application/json': ['.json'] },
              },
            ],
          });
          const writable = await fileHandle.createWritable();
          await writable.write(exportedBlob);
          await writable.close();
        } catch (err: any) {
          if (err?.name !== 'AbortError') {
            throw err;
          }
        }
      } else {
        const url = URL.createObjectURL(exportedBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = defaultName;
        link.rel = 'noopener';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '콘텐츠를 내보내지 못했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-300">불러오는 중…</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-400">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-primary-300">콘텐츠 리스트</h1>
        <button
          type="button"
          onClick={() => navigate('/contents/new')}
          className="rounded border border-primary-500 px-3 py-1 text-xs font-semibold text-primary-300 transition hover:bg-primary-500/10"
        >
          콘텐츠 추가
        </button>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">총 {contents.length}개의 콘텐츠</p>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !contents.length}
          className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? '내보내는 중…' : 'JSON 내보내기'}
        </button>
      </div>

      {!contents.length ? (
        <p className="text-sm text-slate-300">아직 등록된 콘텐츠가 없습니다.</p>
      ) : null}

      {availableTags.length ? (
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => {
            const active = activeTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? 'border border-primary-500 bg-primary-500/20 text-primary-200'
                    : 'border border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                #{tag}
              </button>
            );
          })}
          {activeTags.length ? (
            <button
              type="button"
              onClick={() => setActiveTags([])}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:bg-slate-800"
            >
              태그 초기화
            </button>
          ) : null}
        </div>
      ) : null}

      {filteredContents.length ? (
        filteredContents.map((item) => (
          <Link
            key={item.id}
            to={`/contents/${item.id}`}
            className="block rounded-lg border border-slate-800 bg-slate-900/70 p-4 transition hover:border-primary-500"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-primary-300">{item.title}</h2>
                <time className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString()}</time>
              </div>
              <button
                type="button"
                onClick={(event) => handleDelete(event, item.id)}
                className="rounded border border-rose-500 px-3 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10"
              >
                삭제
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-200">
              {item.content.length > 120 ? `${item.content.slice(0, 120)}…` : item.content}
            </p>
            {item.tags?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <Badge key={`${item.id}-${tag}`} color="primary">
                    #{tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </Link>
        ))
      ) : (
        <p className="text-sm text-slate-300">선택한 태그에 해당하는 콘텐츠가 없습니다.</p>
      )}
    </div>
  );
}
