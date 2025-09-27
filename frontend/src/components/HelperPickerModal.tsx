import { useMemo } from 'react';
import { buildTeacherFilename, getTeacherAssetUrl, getHelperAssetUrl } from '../utils/assets';
import type { LearningHelperOut } from '../api';

export interface HelperPickerModalProps {
  isOpen: boolean;
  helpers: LearningHelperOut[];
  selectedId: number | null;
  onSelect: (helperId: number) => void;
  onClose: () => void;
  onConfirm: () => void;
  userLevel: number;
  confirmLabel?: string;
  title?: string;
  description?: string;
  submitting?: boolean;
}

export default function HelperPickerModal({
  isOpen,
  helpers,
  selectedId,
  onSelect,
  onClose,
  onConfirm,
  userLevel,
  confirmLabel = '선택 완료',
  title = '학습 도우미 선택',
  description,
  submitting = false,
}: HelperPickerModalProps) {
  const fallbackBase = useMemo(
    () => ({
      idle: getTeacherAssetUrl(buildTeacherFilename(0)),
    }),
    [],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <header className="space-y-2">
          <h3 className="text-xl font-semibold text-primary-600">{title}</h3>
          <p className="text-sm text-slate-500">
            {description ?? '사용 가능한 학습 도우미를 선택하세요. 레벨이 높을수록 더 많은 도우미가 잠금 해제됩니다.'}
          </p>
          <p className="text-xs text-slate-400">현재 레벨: {userLevel}</p>
        </header>

        <div className="grid max-h-[420px] grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2">
          {helpers.map((helper) => {
            const fallbackLevelIndex = Math.max(Math.min(helper.level_requirement, 12) - 1, 0);
            const idleVariant = getHelperAssetUrl(helper.variants.idle);
            const fallbackImage = idleVariant ?? getTeacherAssetUrl(buildTeacherFilename(fallbackLevelIndex));
            const unlocked = helper.unlocked;
            const isSelected = helper.id === selectedId;
            return (
              <label
                key={helper.id}
                className={`relative flex h-full cursor-pointer flex-col gap-3 rounded-xl border p-4 transition ${
                  isSelected ? 'border-primary-500 shadow-[0_12px_30px_-16px_rgba(59,130,246,0.75)]' : 'border-slate-200 hover:border-primary-300'
                } ${unlocked ? 'bg-white' : 'bg-slate-50'}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{helper.name}</p>
                    <p className="text-xs text-slate-500">레벨 {helper.level_requirement} 이상</p>
                  </div>
                  <input
                    type="radio"
                    className="h-4 w-4 accent-primary-500"
                    name="helper-picker"
                    value={helper.id}
                    checked={isSelected}
                    onChange={() => {
                      if (unlocked) {
                        onSelect(helper.id);
                      }
                    }}
                    disabled={!unlocked}
                  />
                </div>
                <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  <img
                    src={fallbackImage ?? fallbackBase.idle}
                    alt={helper.name}
                    className={`h-48 w-full object-contain ${unlocked ? '' : 'opacity-60'}`}
                  />
                  {!unlocked ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-xs font-medium text-white">
                      레벨 {helper.level_requirement}에서 잠금 해제
                    </div>
                  ) : null}
                </div>
                {helper.description ? (
                  <p className="text-xs leading-relaxed text-slate-600">{helper.description}</p>
                ) : null}
              </label>
            );
          })}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-100"
            disabled={submitting}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={submitting || selectedId == null}
          >
            {submitting ? '적용 중…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
