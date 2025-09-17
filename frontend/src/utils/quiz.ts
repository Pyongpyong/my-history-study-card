const QUIZ_TYPE_WITH_LABEL: Record<string, string> = {
  MCQ: 'MCQ-객관식',
  SHORT: 'SHORT-주관식',
  CLOZE: 'CLOZE-빈칸채우기',
  ORDER: 'ORDER-순서맞추기',
  MATCH: 'MATCH-짝맞추기',
  OX: 'OX-참거짓',
};

export function getQuizTypeLabel(type?: string | null): string {
  if (!type) {
    return '기타';
  }
  const key = type.toUpperCase();
  return QUIZ_TYPE_WITH_LABEL[key] ?? type;
}

