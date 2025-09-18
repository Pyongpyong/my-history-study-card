import { FormEvent, useEffect, useState } from 'react';
import type { QuizType } from '../api';

type TagsState = string;

type SharedFormProps = {
  onSubmit: (payload: Record<string, any>) => Promise<void>;
  submitLabel?: string;
  initial?: Record<string, any> | null;
};

function parseTags(text: TagsState): string[] {
  return Array.from(new Set(text.split(',').map((item) => item.trim()).filter(Boolean)));
}

function MCQForm({ onSubmit, submitLabel = '퀴즈 만들기', initial }: SharedFormProps) {
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [options, setOptions] = useState<string[]>(
    initial?.options && initial.options.length ? [...initial.options] : ['', '', '', ''],
  );
  const [answerIndex, setAnswerIndex] = useState(initial?.answer_index ?? 0);
  const [explain, setExplain] = useState(initial?.explain ?? '');
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(','));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!initial) return;
    setQuestion(initial.question ?? '');
    setOptions(initial.options && initial.options.length ? [...initial.options] : ['', '', '', '']);
    setAnswerIndex(initial.answer_index ?? 0);
    setExplain(initial.explain ?? '');
    setTagsInput((initial.tags ?? []).join(','));
  }, [initial]);

  const canSubmit = question.trim().length > 0 && options.every((option) => option.trim().length > 0);

  const addOption = () => {
    if (options.length >= 6) return;
    setOptions((prev) => [...prev, '']);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    const next = options.filter((_, idx) => idx !== index);
    setOptions(next);
    if (answerIndex >= next.length) {
      setAnswerIndex(Math.max(0, next.length - 1));
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) {
      alert('질문과 보기 내용을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        type: 'MCQ',
        question: question.trim(),
        options: options.map((option) => option.trim()),
        answer_index: answerIndex,
        explain: explain.trim() || undefined,
        tags: parseTags(tagsInput),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        질문
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="h-24 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
          required
        />
      </label>
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm text-primary-600">
          <span>보기</span>
          <button
            type="button"
            onClick={addOption}
            disabled={options.length >= 6}
            className="rounded border border-primary-500 px-3 py-1 text-xs font-semibold text-primary-600 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            보기 추가
          </button>
        </div>
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={option}
              onChange={(event) =>
                setOptions((prev) => prev.map((item, idx) => (idx === index ? event.target.value : item)))
              }
              className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder={`보기 ${index + 1}`}
              required
            />
            {options.length > 2 ? (
              <button
                type="button"
                onClick={() => removeOption(index)}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
              >
                삭제
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        정답
        <select
          value={answerIndex}
          onChange={(event) => setAnswerIndex(Number(event.target.value))}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          {options.map((_, idx) => (
            <option key={idx} value={idx}>
              보기 {idx + 1}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        해설
        <textarea
          value={explain}
          onChange={(event) => setExplain(event.target.value)}
          className="h-20 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        태그 (콤마로 구분)
        <input
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </label>
      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? '저장 중…' : submitLabel}
      </button>
    </form>
  );
}

function ShortForm({ onSubmit, submitLabel = '퀴즈 만들기', initial }: SharedFormProps) {
  const [prompt, setPrompt] = useState(initial?.prompt ?? '');
  const [answer, setAnswer] = useState(initial?.answer ?? '');
  const [aliases, setAliases] = useState((initial?.rubric?.aliases ?? []).join(','));
  const [explain, setExplain] = useState(initial?.explain ?? '');
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(','));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!initial) return;
    setPrompt(initial.prompt ?? '');
    setAnswer(initial.answer ?? '');
    setAliases((initial.rubric?.aliases ?? []).join(','));
    setExplain(initial.explain ?? '');
    setTagsInput((initial.tags ?? []).join(','));
  }, [initial]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!prompt.trim() || !answer.trim()) {
      alert('문항과 정답을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const aliasesList = parseTags(aliases);
      await onSubmit({
        type: 'SHORT',
        prompt: prompt.trim(),
        answer: answer.trim(),
        explain: explain.trim() || undefined,
        tags: parseTags(tagsInput),
        rubric: aliasesList.length ? { aliases: aliasesList } : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        질문
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          className="h-20 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        정답
        <textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          className="h-20 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        허용되는 대체 답안 (콤마 구분)
        <input
          value={aliases}
          onChange={(event) => setAliases(event.target.value)}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="예) 수양, 수양대"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        해설
        <textarea
          value={explain}
          onChange={(event) => setExplain(event.target.value)}
          className="h-20 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        태그 (콤마로 구분)
        <input
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? '저장 중…' : submitLabel}
      </button>
    </form>
  );
}

function OxForm({ onSubmit, submitLabel = '퀴즈 만들기', initial }: SharedFormProps) {
  const [statement, setStatement] = useState(initial?.statement ?? '');
  const [answer, setAnswer] = useState(
    typeof initial?.answer === 'boolean' ? initial.answer : true,
  );
  const [explain, setExplain] = useState(initial?.explain ?? '');
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(','));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!initial) return;
    setStatement(initial.statement ?? '');
    setAnswer(typeof initial.answer === 'boolean' ? initial.answer : true);
    setExplain(initial.explain ?? '');
    setTagsInput((initial.tags ?? []).join(','));
  }, [initial]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!statement.trim()) {
      alert('문장을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        type: 'OX',
        statement: statement.trim(),
        answer,
        explain: explain.trim() || undefined,
        tags: parseTags(tagsInput),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        문장
        <textarea
          value={statement}
          onChange={(event) => setStatement(event.target.value)}
          className="h-24 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        정답
        <select
          value={answer ? 'true' : 'false'}
          onChange={(event) => setAnswer(event.target.value === 'true')}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="true">O (참)</option>
          <option value="false">X (거짓)</option>
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        해설
        <textarea
          value={explain}
          onChange={(event) => setExplain(event.target.value)}
          className="h-20 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        태그 (콤마로 구분)
        <input
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? '저장 중…' : submitLabel}
      </button>
    </form>
  );
}

function ClozeForm({ onSubmit, submitLabel = '퀴즈 만들기', initial }: SharedFormProps) {
  const [text, setText] = useState(initial?.text ?? '');
  const [explain, setExplain] = useState(initial?.explain ?? '');
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(','));
  const [placeholders, setPlaceholders] = useState<string[]>([]);
  const [clozeValues, setClozeValues] = useState<Record<string, string>>(
    (initial?.clozes as Record<string, string>) ?? {},
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const matches = Array.from(text.matchAll(/\{\{(.*?)\}\}/g)) as RegExpMatchArray[];
    const unique = Array.from(
      new Set(matches.map((match) => match[1] ?? '').filter((value) => value.length > 0)),
    );
    setPlaceholders(unique);
    setClozeValues((prev) => {
      const next: Record<string, string> = {};
      unique.forEach((key) => {
        next[key] = prev[key] ?? '';
      });
      return next;
    });
  }, [text]);

  useEffect(() => {
    if (!initial) return;
    setText(initial.text ?? '');
    setExplain(initial.explain ?? '');
    setTagsInput((initial.tags ?? []).join(','));
    setClozeValues((initial.clozes as Record<string, string>) ?? {});
  }, [initial]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) {
      alert('본문을 입력해주세요.');
      return;
    }
    for (const key of placeholders) {
      if (!clozeValues[key]?.trim()) {
        alert(`빈칸 ${key}의 정답을 입력해주세요.`);
        return;
      }
    }
    setSubmitting(true);
    try {
      await onSubmit({
        type: 'CLOZE',
        text,
        clozes: Object.fromEntries(
          placeholders.map((key) => [key, clozeValues[key]?.trim() ?? ''])
        ),
        explain: explain.trim() || undefined,
        tags: parseTags(tagsInput),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        본문 (빈칸은 {'{{c1}}'}, {'{{c2}}'} 처럼 표기)
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="h-32 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
          required
        />
      </label>
      {placeholders.length ? (
        <div className="space-y-2 text-sm text-slate-600">
          <p className="font-semibold text-primary-600">빈칸 정답</p>
          {placeholders.map((key) => (
            <label key={key} className="flex flex-col gap-1 text-xs text-slate-600">
              {key}
              <input
                value={clozeValues[key] ?? ''}
                onChange={(event) =>
                  setClozeValues((prev) => ({ ...prev, [key]: event.target.value }))
                }
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                required
              />
            </label>
          ))}
        </div>
      ) : null}
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        해설
        <textarea
          value={explain}
          onChange={(event) => setExplain(event.target.value)}
          className="h-20 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        태그 (콤마로 구분)
        <input
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? '저장 중…' : submitLabel}
      </button>
    </form>
  );
}

function OrderForm({ onSubmit, submitLabel = '퀴즈 만들기', initial }: SharedFormProps) {
  const [items, setItems] = useState<string[]>(
    initial?.items && initial.items.length ? [...initial.items] : [''],
  );
  const [explain, setExplain] = useState(initial?.explain ?? '');
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(','));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!initial) return;
    setItems(initial.items && initial.items.length ? [...initial.items] : ['']);
    setExplain(initial.explain ?? '');
    setTagsInput((initial.tags ?? []).join(','));
  }, [initial]);

  const addItem = () => setItems((prev) => [...prev, '']);
  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const cleaned = items.map((item) => item.trim()).filter(Boolean);
    if (!cleaned.length) {
      alert('순서에 포함될 항목을 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        type: 'ORDER',
        items: cleaned,
        answer_order: cleaned.map((_, idx) => idx),
        explain: explain.trim() || undefined,
        tags: parseTags(tagsInput),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm text-primary-600">
          <span>항목</span>
          <button
            type="button"
            onClick={addItem}
            className="rounded border border-primary-500 px-3 py-1 text-xs font-semibold text-primary-600 transition hover:bg-primary-50"
          >
            항목 추가
          </button>
        </div>
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              value={item}
              onChange={(event) =>
                setItems((prev) => prev.map((value, idx) => (idx === index ? event.target.value : value)))
              }
              className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder={`항목 ${index + 1}`}
              required
            />
            {items.length > 1 ? (
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
              >
                삭제
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        해설
        <textarea
          value={explain}
          onChange={(event) => setExplain(event.target.value)}
          className="h-20 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        태그 (콤마로 구분)
        <input
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? '저장 중…' : submitLabel}
      </button>
    </form>
  );
}

function MatchForm({ onSubmit, submitLabel = '퀴즈 만들기', initial }: SharedFormProps) {
  const [pairs, setPairs] = useState<Array<{ left: string; right: string }>>(
    initial?.left && initial?.right
      ? initial.left.map((left: string, index: number) => ({ left, right: initial.right[index] }))
      : [{ left: '', right: '' }],
  );
  const [explain, setExplain] = useState(initial?.explain ?? '');
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(','));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!initial) return;
    if (initial.left && initial.right) {
      setPairs(initial.left.map((left: string, index: number) => ({ left, right: initial.right[index] })));
    } else {
      setPairs([{ left: '', right: '' }]);
    }
    setExplain(initial.explain ?? '');
    setTagsInput((initial.tags ?? []).join(','));
  }, [initial]);

  const addPair = () => setPairs((prev) => [...prev, { left: '', right: '' }]);
  const removePair = (index: number) => {
    if (pairs.length <= 1) return;
    setPairs((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const cleaned = pairs
      .map((pair) => ({ left: pair.left.trim(), right: pair.right.trim() }))
      .filter((pair) => pair.left && pair.right);
    if (!cleaned.length) {
      alert('왼쪽과 오른쪽 항목을 모두 입력해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        type: 'MATCH',
        left: cleaned.map((pair) => pair.left),
        right: cleaned.map((pair) => pair.right),
        pairs: cleaned.map((_, idx) => [idx, idx]),
        explain: explain.trim() || undefined,
        tags: parseTags(tagsInput),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm text-primary-600">
          <span>연결 항목</span>
          <button
            type="button"
            onClick={addPair}
            className="rounded border border-primary-500 px-3 py-1 text-xs font-semibold text-primary-600 transition hover:bg-primary-50"
          >
            항목 추가
          </button>
        </div>
        {pairs.map((pair, index) => (
          <div key={index} className="grid gap-2 md:grid-cols-2">
            <input
              value={pair.left}
              onChange={(event) =>
                setPairs((prev) =>
                  prev.map((item, idx) => (idx === index ? { ...item, left: event.target.value } : item)),
                )
              }
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="왼쪽 항목"
              required
            />
            <div className="flex items-center gap-2">
              <input
                value={pair.right}
                onChange={(event) =>
                  setPairs((prev) =>
                    prev.map((item, idx) => (idx === index ? { ...item, right: event.target.value } : item)),
                  )
                }
                className="flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="오른쪽 항목"
                required
              />
              {pairs.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removePair(index)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
                >
                  삭제
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        해설
        <textarea
          value={explain}
          onChange={(event) => setExplain(event.target.value)}
          className="h-20 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm text-slate-600">
        태그 (콤마로 구분)
        <input
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? '저장 중…' : submitLabel}
      </button>
    </form>
  );
}

export type QuizFormProps = {
  type: QuizType;
  onSubmit: (payload: Record<string, any>) => Promise<void>;
  submitLabel?: string;
  initial?: Record<string, any> | null;
};

export function QuizForm({ type, onSubmit, submitLabel, initial }: QuizFormProps) {
  switch (type) {
    case 'MCQ':
      return <MCQForm onSubmit={onSubmit} submitLabel={submitLabel} initial={initial} />;
    case 'SHORT':
      return <ShortForm onSubmit={onSubmit} submitLabel={submitLabel} initial={initial} />;
    case 'OX':
      return <OxForm onSubmit={onSubmit} submitLabel={submitLabel} initial={initial} />;
    case 'CLOZE':
      return <ClozeForm onSubmit={onSubmit} submitLabel={submitLabel} initial={initial} />;
    case 'ORDER':
      return <OrderForm onSubmit={onSubmit} submitLabel={submitLabel} initial={initial} />;
    case 'MATCH':
      return <MatchForm onSubmit={onSubmit} submitLabel={submitLabel} initial={initial} />;
    default:
      return <p className="text-sm text-rose-600">지원하지 않는 퀴즈 형식입니다: {type}</p>;
  }
}

export default QuizForm;
