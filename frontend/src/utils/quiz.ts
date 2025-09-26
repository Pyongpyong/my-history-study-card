const QUIZ_TYPE_LABELS: Record<string, string> = {
  MCQ: '객관식',
  SHORT: '주관식',
  CLOZE: '빈칸채우기',
  ORDER: '순서맞추기',
  MATCH: '짝맞추기',
  OX: 'OX',
};

export function getQuizTypeLabel(type?: string | null): string {
  if (!type) {
    return '기타';
  }
  const key = type.toUpperCase();
  return QUIZ_TYPE_LABELS[key] ?? '기타';
}

export function getQuizTypeColor(type: string): string {
  switch (type) {
    case 'MCQ':
      return 'bg-blue-100 text-blue-800 border border-blue-200';
    case 'SHORT':
      return 'bg-green-100 text-green-800 border border-green-200';
    case 'OX':
      return 'bg-purple-100 text-purple-800 border border-purple-200';
    case 'CLOZE':
      return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
    case 'ORDER':
      return 'bg-pink-100 text-pink-800 border border-pink-200';
    case 'MATCH':
      return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-200';
  }
}
