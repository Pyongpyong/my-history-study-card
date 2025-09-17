import { ChangeEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadJsonFile } from '../api';

export default function UploadJSONPage() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Array<{ content_id: number }> | null>(null);
  const navigate = useNavigate();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setResult(null);
    setFile(event.target.files?.[0] ?? null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('업로드할 JSON 파일을 선택하세요.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const entries = await uploadJsonFile(file);
      setResult(entries);
      if (entries.length === 1) {
        navigate(`/contents/${entries[0].content_id}`);
      }
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '업로드에 실패했습니다.';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-xl font-semibold text-primary-300">JSON 업로드</h2>
        <p className="mt-2 text-sm text-slate-300">생성된 플래시카드를 포함한 JSON 파일을 업로드하세요.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            accept="application/json"
            onChange={handleFileChange}
            className="w-full rounded border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-100"
          />
          <button
            type="button"
            onClick={handleUpload}
            disabled={loading}
            className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {loading ? '업로드 중…' : 'JSON 업로드'}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
        {result ? (
          <div className="mt-4 space-y-2 text-sm text-emerald-200">
            <p>총 {result.length}개의 콘텐츠가 생성되었습니다.</p>
            <ul className="space-y-1 text-xs text-primary-200">
              {result.map((entry) => (
                <li key={entry.content_id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/contents/${entry.content_id}`)}
                    className="underline hover:text-primary-100"
                  >
                    콘텐츠 #{entry.content_id} 보기
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
