import { useCallback, useEffect, useState } from 'react';
import { fetchLearningHelpers, type LearningHelperOut } from '../api';
import { extractApiErrorMessage } from '../utils/error';

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
    } catch (error) {
      console.error('학습 도우미 목록을 불러오는 데 실패했습니다.', error);
      setError(extractApiErrorMessage(error, '학습 도우미 목록을 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { helpers, loading, error, refresh: load };
}
