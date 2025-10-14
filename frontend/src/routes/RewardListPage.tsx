import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  fetchRewards,
  createRewardRequest,
  updateRewardRequest,
  deleteRewardRequest,
  type Reward,
} from '../api';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function RewardListPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchRewards();
      setRewards(items);
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '보상 목록을 불러오지 못했습니다.';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !duration.trim()) {
      alert('제목과 기간을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      await createRewardRequest({
        title: title.trim(),
        duration: duration.trim(),
        valid_until: validUntil ? new Date(validUntil).toISOString() : undefined,
      });
      setTitle('');
      setDuration('');
      setValidUntil('');
      await load();
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '보상을 생성하지 못했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setSaving(false);
    }
  };

  const sortedRewards = useMemo(
    () =>
      [...rewards].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [rewards],
  );

  const toggleUsage = async (reward: Reward) => {
    try {
      const updated = await updateRewardRequest(reward.id, { used: !reward.used });
      setRewards((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '보상 상태를 변경하지 못했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    }
  };

  const handleDelete = async (reward: Reward) => {
    if (!confirm('해당 보상을 삭제하시겠습니까?')) return;
    try {
      await deleteRewardRequest(reward.id);
      setRewards((prev) => prev.filter((item) => item.id !== reward.id));
    } catch (err: any) {
      console.error(err);
      const message = err?.response?.data?.detail ?? '보상을 삭제하지 못했습니다.';
      alert(typeof message === 'string' ? message : JSON.stringify(message));
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-600">불러오는 중…</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-primary-600">보상 리스트</h1>
        <p className="text-sm text-slate-500">보상을 생성하고 학습 세트에 추가할 수 있습니다.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-primary-600">새 보상 추가</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            제목
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="예) 30분 휴식"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            기간
            <input
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="예) 30분"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            유효기간
            <input
              type="datetime-local"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </label>
        </div>
        <button
          type="submit"
          className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={saving}
        >
          {saving ? '추가 중…' : '보상 추가'}
        </button>
      </form>

      <div className="space-y-3">
        {sortedRewards.length ? (
          sortedRewards.map((reward) => (
            <div
              key={reward.id}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-primary-600">{reward.title}</h3>
                  <p className="text-sm text-slate-600">기간: {reward.duration}</p>
                  <p className="text-xs text-slate-500">생성일: {formatDate(reward.created_at)}</p>
                  <p className="text-xs text-slate-500">유효기간: {formatDate(reward.valid_until)}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-600">
                  <span className={reward.used ? 'text-emerald-600' : 'text-amber-300'}>
                    {reward.used ? '사용됨' : '미사용'}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleUsage(reward)}
                    className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
                  >
                    {reward.used ? '미사용으로 변경' : '사용 완료 처리'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(reward)}
                    className="rounded border border-rose-500 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-600">등록된 보상이 없습니다.</p>
        )}
      </div>
    </section>
  );
}
