import axios from 'axios';

function resolveApiBaseUrl(): string {
  const override = import.meta.env.VITE_API_BASE_URL;
  if (override && typeof override === 'string' && override.trim().length) {
    return override.trim();
  }
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    const port = import.meta.env.VITE_API_PORT ?? '8000';
    return `${protocol}//${hostname}:${port}`;
  }
  return 'http://localhost:8000';
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
});

export interface ContentItem {
  id: number;
  title: string;
  content: string;
  tags: string[];
  chronology?: ContentChronology | null;
  created_at: string;
}

export interface ContentListResponse {
  items: ContentItem[];
  meta: {
    page: number;
    size: number;
    total: number;
  };
}

export interface ContentChronologyEvent {
  year: number;
  label: string;
}

export interface ContentChronology {
  start_year?: number | null;
  end_year?: number | null;
  events: ContentChronologyEvent[];
}

export interface ContentDetail extends ContentItem {
  highlights: string[];
}

export type QuizType = 'MCQ' | 'SHORT' | 'OX' | 'CLOZE' | 'ORDER' | 'MATCH';

export interface QuizItem {
  id: number;
  content_id: number;
  type: QuizType;
  payload: Record<string, any>;
  created_at: string;
}

export interface QuizListResponse {
  items: QuizItem[];
  meta: {
    page: number;
    size: number;
    total: number;
  };
}

export type StudySessionCard = Record<string, any> & {
  attempts?: number;
  correct?: number;
};

export interface StudySession {
  id: number;
  title: string;
  quiz_ids: number[];
  cards: StudySessionCard[];
  created_at: string;
  updated_at: string;
  score?: number | null;
  total?: number | null;
  completed_at?: string | null;
  tags: string[];
  rewards: Reward[];
}

export interface StudySessionListResponse {
  items: StudySession[];
  meta: {
    page: number;
    size: number;
    total: number;
  };
}

export interface Reward {
  id: number;
  title: string;
  duration: string;
  created_at: string;
  valid_until?: string | null;
  used: boolean;
}

export interface RewardListResponse {
  items: Reward[];
}

export async function fetchContents(page = 1, size = 20): Promise<ContentListResponse> {
  const { data } = await api.get<ContentListResponse>('/contents', { params: { page, size } });
  return data;
}

export async function fetchContent(id: number | string): Promise<ContentDetail> {
  const { data } = await api.get<ContentDetail>(`/contents/${id}`);
  return data;
}

export async function fetchContentCards(id: number | string): Promise<any[]> {
  const { data } = await api.get<QuizListResponse>(`/contents/${id}/quizzes`, {
    params: { page: 1, size: 100 },
  });
  return data.items.map((item) => ({
    ...item.payload,
    id: item.id,
    type: item.type,
    content_id: item.content_id,
    created_at: item.created_at,
  }));
}

export async function fetchQuizzes(page = 1, size = 20): Promise<QuizListResponse> {
  const { data } = await api.get<QuizListResponse>('/quizzes', { params: { page, size } });
  return data;
}

export async function uploadJsonFile(file: File): Promise<Array<{ content_id: number }>> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post('/import/json-file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return Array.isArray(data) ? data : [data];
}

export async function deleteContent(id: number | string): Promise<void> {
  await api.delete(`/contents/${id}`);
}

export async function createStudySession(payload: {
  title: string;
  quiz_ids: number[];
  cards: StudySessionCard[];
}): Promise<StudySession> {
  const { data } = await api.post<StudySession>('/study-sessions', payload);
  return data;
}

export async function fetchStudySessions(page = 1, size = 50): Promise<StudySessionListResponse> {
  const { data } = await api.get<StudySessionListResponse>('/study-sessions', { params: { page, size } });
  return data;
}

export async function fetchStudySession(id: number | string): Promise<StudySession> {
  const { data } = await api.get<StudySession>(`/study-sessions/${id}`);
  return data;
}

export async function updateStudySessionRequest(id: number | string, updates: Partial<StudySession>): Promise<StudySession> {
  const { data } = await api.patch<StudySession>(`/study-sessions/${id}`, updates);
  return data;
}

export async function deleteStudySessionRequest(id: number | string): Promise<void> {
  await api.delete(`/study-sessions/${id}`);
}

export async function fetchRewards(): Promise<Reward[]> {
  const { data } = await api.get<RewardListResponse>('/rewards');
  return data.items;
}

export async function createRewardRequest(payload: {
  title: string;
  duration: string;
  valid_until?: string | null;
}): Promise<Reward> {
  const { data } = await api.post<Reward>('/rewards', payload);
  return data;
}

export async function updateRewardRequest(id: number, updates: Partial<Reward>): Promise<Reward> {
  const { data } = await api.patch<Reward>(`/rewards/${id}`, updates);
  return data;
}

export async function assignRewardToSession(sessionId: number, rewardId: number): Promise<StudySession> {
  const { data } = await api.post<StudySession>(`/study-sessions/${sessionId}/rewards`, { reward_id: rewardId });
  return data;
}

export async function createQuizForContent<T extends Record<string, any>>(contentId: number | string, payload: T): Promise<QuizItem> {
  const { data } = await api.post<QuizItem>(`/contents/${contentId}/quizzes`, payload);
  return data;
}

export async function createContentRequest(payload: Record<string, any>): Promise<number> {
  const { data } = await api.post('/import/json', payload);
  if (Array.isArray(data)) {
    return data[0]?.content_id;
  }
  return data.content_id;
}

export async function deleteQuizRequest(id: number | string): Promise<void> {
  await api.delete(`/quizzes/${id}`);
}

export async function exportContents(): Promise<Blob> {
  const response = await api.get('/contents/export', {
    responseType: 'blob',
  });
  return response.data;
}

export async function deleteRewardRequest(id: number | string): Promise<void> {
  await api.delete(`/rewards/${id}`);
}

export async function updateContentRequest(
  id: number | string,
  updates: Partial<{
    title: string;
    content: string;
    tags: string[];
    highlights: string[];
    chronology: any;
  }> ,
): Promise<ContentDetail> {
  const { data } = await api.patch<ContentDetail>(`/contents/${id}`, updates);
  return data;
}

export async function fetchQuiz(id: number | string): Promise<QuizItem> {
  const { data } = await api.get<QuizItem>(`/quizzes/${id}`);
  return data;
}

export async function updateQuizRequest<T extends Record<string, any>>(
  id: number | string,
  payload: T,
): Promise<QuizItem> {
  const { data } = await api.patch<QuizItem>(`/quizzes/${id}`, payload);
  return data;
}
