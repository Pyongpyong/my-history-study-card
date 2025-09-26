import axios from 'axios';

export function resolveApiBaseUrl(): string {
  const override = import.meta.env.VITE_API_BASE_URL;
  if (override && typeof override === 'string' && override.trim().length) {
    return override.trim();
  }
  if (typeof window !== 'undefined') {
    const { protocol, host, hostname } = window.location;
    const apiPort = import.meta.env.VITE_API_PORT;
    const isLocalHost = ['localhost', '127.0.0.1'].includes(hostname);
    const targetPort = apiPort && apiPort.toString().trim().length ? apiPort.toString().trim() : '8000';
    if (isLocalHost) {
      return `${protocol}//${hostname}:${targetPort}`;
    }
    return `${protocol}//${host || hostname}`;
  }
  return 'http://localhost:8000';
}

export const api = axios.create({
  baseURL: resolveApiBaseUrl(),
});

let apiKey: string | null = null;

export function setApiKey(value: string | null) {
  apiKey = value;
}

api.interceptors.request.use((config) => {
  if (apiKey) {
    config.headers = config.headers ?? {};
    config.headers['X-API-Key'] = apiKey;
  }
  return config;
});

export type Visibility = 'PUBLIC' | 'PRIVATE';

export interface ContentItem {
  id: number;
  title: string;
  content: string;
  keywords: string[];
  chronology?: ContentChronology | null;
  timeline: TimelineEntry[];
  categories: string[];
  eras: EraEntry[];
  created_at: string;
  visibility: Visibility;
  owner_id?: number | null;
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

export interface TimelineEntry {
  title: string;
  description: string;
}

export interface EraEntry {
  period: string;
  detail: string;
}

export interface ContentDetail extends ContentItem {
  highlights: string[];
}

export type QuizType = 'MCQ' | 'SHORT' | 'OX' | 'CLOZE' | 'ORDER' | 'MATCH';

export type AiDifficulty = 'easy' | 'medium' | 'hard';

export interface AiMeta {
  cached: boolean;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
}

export interface AiGenerateRequest {
  content: string;
  highlights: string[];
  types: QuizType[];
  difficulty: AiDifficulty;
  no_cache?: boolean;
  focus_mode?: 'highlight' | 'timeline';
  timeline?: AiChronologyEvent[];
}

export interface AiGenerateResponse {
  cards: Array<Record<string, any>>;
  facts: Record<string, any>;
  meta: AiMeta;
}

export interface AiTaxonomy {
  era?: string | null;
  sub_era?: string | null;
  topic?: string[];
  entity?: string[];
  region?: string[];
  keywords?: string[];
}

export interface AiChronoPoint {
  year: number;
  precision?: 'year' | 'month' | 'day';
}

export interface AiChronologyEvent {
  year: number;
  label: string;
}

export interface AiChronology {
  start?: AiChronoPoint | null;
  end?: AiChronoPoint | null;
  events?: AiChronologyEvent[];
}

export interface AiGenerateAndImportRequest extends AiGenerateRequest {
  title: string;
  tags: string[];
  taxonomy?: AiTaxonomy | null;
  chronology?: AiChronology | null;
  visibility?: Visibility;
  upsert?: boolean;
}

export interface AiGenerateAndImportResponse extends AiGenerateResponse {
  content_id: number;
  highlight_ids: number[];
  quiz_ids: number[];
  counts: Record<string, number>;
  generated_count: number;
}

export interface QuizSubmitResponse {
  success: boolean;
  is_correct: boolean;
  points_earned: number;
  total_points: number;
  message: string;
}

export interface QuizItem {
  id: number;
  content_id: number;
  type: QuizType;
  payload: Record<string, any>;
  created_at: string;
  visibility: Visibility;
  owner_id?: number | null;
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
  answers?: Record<number | string, boolean>;
  tags: string[];
  rewards: Reward[];
  owner_id: number;
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
  owner_id: number;
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

const isQuizListResponse = (data: unknown): data is QuizListResponse =>
  Boolean(data) && typeof data === 'object' && Array.isArray((data as QuizListResponse).items);

export async function fetchContentCards(id: number | string): Promise<any[]> {
  try {
    const { data } = await api.get<QuizListResponse | { cards?: any[] }>(`/contents/${id}/cards`, {
      params: { page: 1, size: 100 },
    });

    const rawItems = isQuizListResponse(data)
      ? data.items
      : Array.isArray(data?.cards)
        ? data.cards
        : [];

    return rawItems
      .filter((item): item is Record<string, any> => Boolean(item) && typeof item === 'object')
      .map((item) => {
        const { payload, ...rest } = item;
        const payloadData = typeof payload === 'object' && payload !== null ? payload : {};

        return {
          ...payloadData,
          ...rest,
          id: rest.id ?? payloadData.id,
          type: rest.type ?? payloadData.type,
          content_id: rest.content_id ?? payloadData.content_id,
          created_at: rest.created_at ?? payloadData.created_at,
          visibility: rest.visibility ?? payloadData.visibility,
          owner_id: rest.owner_id ?? payloadData.owner_id,
        };
      });
  } catch (error) {
    console.error('Error fetching content cards:', error);
    return [];
  }
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
    highlights: string[];
    chronology: any;
    keywords: string[];
    timeline: TimelineEntry[] | null;
    eras: EraEntry[] | null;
    categories: string[] | null;
  }> ,
): Promise<ContentDetail> {
  const { data } = await api.patch<ContentDetail>(`/contents/${id}`, updates);
  return data;
}

export async function fetchQuiz(id: number | string): Promise<QuizItem> {
  const { data } = await api.get<QuizItem>(`/quizzes/${id}`);
  return data;
}

export async function submitQuizAnswer(quizId: number, isCorrect: boolean): Promise<QuizSubmitResponse> {
  const { data } = await api.post<QuizSubmitResponse>('/quizzes/submit', {
    quiz_id: quizId,
    is_correct: isCorrect
  });
  return data;
}

export async function updateQuizRequest<T extends Record<string, any>>(
  id: number | string,
  payload: T,
): Promise<QuizItem> {
  const { data } = await api.patch<QuizItem>(`/quizzes/${id}`, payload);
  return data;
}

export interface UserProfile {
  id: number;
  email: string;
  created_at: string;
  is_admin: boolean;
  points: number;
  level: number;
  points_to_next_level: number;
  is_max_level: boolean;
}

export interface AuthResponse {
  user: UserProfile;
  api_key: string;
}

export async function registerUserRequest(payload: { email: string; password: string }): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/users', payload);
  return data;
}

export async function loginUserRequest(payload: { email: string; password: string }): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>('/users/me');
  return data;
}

export async function changePasswordRequest(payload: {
  current_password: string;
  new_password: string;
}): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/users/me/password', payload);
  return data;
}

export async function deleteAccountRequest(payload: { password: string }): Promise<void> {
  await api.request({ method: 'delete', url: '/users/me', data: payload });
}

export async function fetchAllUsersRequest(): Promise<UserProfile[]> {
  const { data } = await api.get<UserProfile[]>('/admin/users');
  return data;
}

export async function createAdminUserRequest(payload: {
  email: string;
  password: string;
  is_admin?: boolean;
}): Promise<UserProfile> {
  const { data } = await api.post<UserProfile>('/admin/users', payload);
  return data;
}

export async function aiGenerateRequest(payload: AiGenerateRequest): Promise<AiGenerateResponse> {
  const { data } = await api.post<AiGenerateResponse>('/ai/generate', payload);
  return data;
}

export async function aiGenerateAndImportRequest(
  payload: AiGenerateAndImportRequest,
): Promise<AiGenerateAndImportResponse> {
  const { data } = await api.post<AiGenerateAndImportResponse>('/ai/generate-and-import', payload);
  return data;
}
