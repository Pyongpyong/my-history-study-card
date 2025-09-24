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
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-primary-600">콘텐츠/퀴즈 JSON 가져오기</h2>
        <p className="mt-2 text-sm text-slate-600">
          콘텐츠 본문, 키워드·분류, 연대/타임라인, 연표 그리고 연결된 퀴즈 정보까지 포함된 HistudyCard JSON을 불러옵니다.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-500">
          <li>콘텐츠 리스트 화면에서 내보낸 JSON 파일을 그대로 가져올 수 있습니다.</li>
          <li>파일 한 개에 여러 콘텐츠가 들어 있는 경우 각 콘텐츠가 순차로 생성됩니다.</li>
          <li>
            기존 JSON 스키마에
            {' '}
            <strong className="font-semibold text-primary-600">keywords</strong>,
            {' '}
            <strong className="font-semibold text-primary-600">categories</strong>,
            {' '}
            <strong className="font-semibold text-primary-600">timeline</strong>,
            {' '}
            <strong className="font-semibold text-primary-600">eras</strong>,
            {' '}
            <strong className="font-semibold text-primary-600">cards</strong>
            {' '}
            필드가 포함되어야 합니다.
          </li>
        </ul>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            accept="application/json"
            onChange={handleFileChange}
            className="w-full rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900"
          />
          <button
            type="button"
            onClick={handleUpload}
            disabled={loading}
            className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? '가져오는 중…' : 'JSON 가져오기'}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        {result ? (
          <div className="mt-4 space-y-2 text-sm text-emerald-600">
            <p>총 {result.length}개의 콘텐츠와 연결된 퀴즈가 업데이트되었습니다.</p>
            <ul className="space-y-1 text-xs text-primary-600">
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
