import type { ScriptureTaskConfig } from '@/components/tasks/taskTypes';

export const DEFAULT_SCRIPTURE_TASK_TITLE = 'Scripture Reading';
export const UNIVERSAL_SCRIPTURE_READING_TYPE: ScriptureTaskConfig['readingType'] = 'custom';
export const UNIVERSAL_SCRIPTURE_CHECKPOINT_KINDS = [
  'new_testament',
  'old_testament',
  'psalter',
] as const;
export const DEFAULT_SCRIPTURE_SESSION_AMOUNT = 1;
export const MAX_SCRIPTURE_SESSION_AMOUNT = 10;

export function normalizeScriptureSessionAmount(value: unknown) {
  const numeric = typeof value === 'number'
    ? value
    : Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_SCRIPTURE_SESSION_AMOUNT;
  return Math.min(MAX_SCRIPTURE_SESSION_AMOUNT, Math.max(1, Math.round(numeric)));
}

export function scriptureSessionAmountLabel(value: unknown) {
  const amount = normalizeScriptureSessionAmount(value);
  return amount === 1
    ? '1 chapter or psalm per session'
    : `${amount} chapters or psalms per session`;
}

export function scriptureSessionUnitLabel(value: unknown) {
  return normalizeScriptureSessionAmount(value) === 1
    ? 'Chapter or psalm per session'
    : 'Chapters or psalms per session';
}
