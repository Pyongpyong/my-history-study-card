import { useCallback, useEffect, useState } from 'react';
import { fetchLearningHelpers, type LearningHelperOut } from '../api';

export function useLearningHelpers() {
  const [helpers, setHelpers] = useState<LearningHelperOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchLearningHelpers();
      setHelpers(items);
    } catch (err: any) {
      console.error('학습 도우미 목록을 불러오는 데 실패했습니다.', err);
      const message = err?.response?.data?.detail ?? err?.message ?? '학습 도우미 목록을 불러오지 못했습니다.';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { helpers, loading, error, refresh: load };
}
