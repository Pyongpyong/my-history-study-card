import Badge from './Badge';
import type { ContentDetail } from '../api';

type ContentSnapshotProps = {
  content: ContentDetail;
};

export default function ContentSnapshot({ content }: ContentSnapshotProps) {
  const timelineEntries = content.timeline ?? [];
  const chronology = content.chronology;
  const chronologyEvents = chronology?.events
    ? [...chronology.events].sort((a, b) => a.year - b.year)
    : [];

  return (
    <article className="space-y-4 text-sm leading-relaxed text-slate-700">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-xl font-semibold text-primary-600">{content.title}</h3>
        <Badge color={content.visibility === 'PUBLIC' ? 'success' : 'default'}>
          {content.visibility === 'PUBLIC' ? '공개' : '비공개'}
        </Badge>
        <span className="text-xs text-slate-500">
          {new Date(content.created_at).toLocaleString()}
        </span>
      </div>

      <p className="whitespace-pre-wrap">{content.content}</p>

      {content.keywords?.length ? (
        <div className="flex flex-wrap gap-2">
          {content.keywords.map((keyword) => (
            <Badge key={`keyword-${keyword}`} color="default">
              {keyword}
            </Badge>
          ))}
        </div>
      ) : null}

      {content.categories?.length ? (
        <div className="flex flex-wrap gap-2">
          {content.categories.map((category) => (
            <Badge key={`category-${category}`} color="default">
              {category}
            </Badge>
          ))}
        </div>
      ) : null}

      {content.eras?.length ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <span className="text-sm font-semibold text-primary-600">연대</span>
          <ul className="space-y-1 text-xs text-slate-600">
            {content.eras.map((entry, index) => (
              <li key={`${entry.period}-${index}`} className="flex items-start gap-3">
                <span className="font-semibold text-primary-600">{entry.period}</span>
                {entry.detail ? <span>{entry.detail}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {timelineEntries.length ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <span className="text-sm font-semibold text-primary-600">타임라인</span>
          <ul className="space-y-2 text-xs text-slate-600">
            {timelineEntries.map((entry, index) => (
              <li
                key={`${index}-${entry.title}-${entry.description}`}
                className="flex gap-3"
              >
                <span className="text-primary-500">•</span>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-primary-600">{entry.title}</span>
                  {entry.description ? (
                    <span className="text-slate-600">{entry.description}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {chronology ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between text-sm text-slate-700">
            <span className="font-semibold text-primary-600">연표</span>
            <span className="text-xs text-slate-500">
              {chronology.start_year ?? '알 수 없음'}
              {' '}–{' '}
              {chronology.end_year ?? '알 수 없음'}
            </span>
          </div>
          {chronologyEvents.length ? (
            <ul className="space-y-2 text-xs text-slate-600">
              {chronologyEvents.map((event) => (
                <li key={`${event.year}-${event.label}`} className="flex items-start gap-3">
                  <span className="font-semibold text-primary-600">{event.year}</span>
                  <span>{event.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">등록된 사건이 없습니다.</p>
          )}
        </div>
      ) : null}
    </article>
  );
}
