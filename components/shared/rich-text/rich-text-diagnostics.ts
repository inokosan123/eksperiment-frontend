export type RichTextEditorDiagnostic = {
  renderCount: number;
  focusCount: number;
  dirtyEventCount: number;
  flushCount: number;
  flushFailureCount: number;
  lastKeyboardLatencyMs?: number;
  maxKeyboardLatencyMs?: number;
  lastFlushDurationMs?: number;
  maxFlushDurationMs?: number;
  lastHtmlLength?: number;
};

export type JournalSaveDiagnostic = {
  queuedCount: number;
  saveCount: number;
  failureCount: number;
  maxQueueDepth: number;
  lastQueuedRevision?: number;
  lastSuccessfulRevision?: number;
  lastDurationMs?: number;
  maxDurationMs?: number;
};

export type RichTextDiagnosticsSnapshot = {
  capturedAt: number;
  editors: Record<string, RichTextEditorDiagnostic>;
  journalDates: Record<string, JournalSaveDiagnostic>;
};

type MutableEditorDiagnostic = RichTextEditorDiagnostic & {
  focusStartedAt?: number;
  keyboardRecordedForFocusAt?: number;
};

const editors = new Map<string, MutableEditorDiagnostic>();
const journalDates = new Map<string, JournalSaveDiagnostic>();

export function richTextDiagnosticNow() {
  if (!isRichTextDiagnosticsEnabled()) return 0;
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function isRichTextDiagnosticsEnabled() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

function editorMetric(editorId: string) {
  const existing = editors.get(editorId);
  if (existing) return existing;
  const created: MutableEditorDiagnostic = {
    renderCount: 0,
    focusCount: 0,
    dirtyEventCount: 0,
    flushCount: 0,
    flushFailureCount: 0,
  };
  editors.set(editorId, created);
  return created;
}

function journalMetric(date: string) {
  const existing = journalDates.get(date);
  if (existing) return existing;
  const created: JournalSaveDiagnostic = {
    queuedCount: 0,
    saveCount: 0,
    failureCount: 0,
    maxQueueDepth: 0,
  };
  journalDates.set(date, created);
  return created;
}

export function recordRichTextEditorRender(editorId: string) {
  if (!isRichTextDiagnosticsEnabled()) return;
  editorMetric(editorId).renderCount += 1;
}

export function recordRichTextEditorFocus(editorId: string) {
  if (!isRichTextDiagnosticsEnabled()) return;
  const metric = editorMetric(editorId);
  metric.focusCount += 1;
  metric.focusStartedAt = richTextDiagnosticNow();
  metric.keyboardRecordedForFocusAt = undefined;
}

export function recordRichTextEditorDirty(editorId: string) {
  if (!isRichTextDiagnosticsEnabled()) return;
  const metric = editorMetric(editorId);
  metric.dirtyEventCount = (metric.dirtyEventCount ?? 0) + 1;
}

export function recordRichTextKeyboardVisible(editorId: string) {
  if (!isRichTextDiagnosticsEnabled()) return;
  const metric = editorMetric(editorId);
  const focusStartedAt = metric.focusStartedAt;
  if (
    focusStartedAt === undefined
    || metric.keyboardRecordedForFocusAt === focusStartedAt
  ) return;

  const duration = Math.max(0, richTextDiagnosticNow() - focusStartedAt);
  metric.keyboardRecordedForFocusAt = focusStartedAt;
  metric.lastKeyboardLatencyMs = duration;
  metric.maxKeyboardLatencyMs = Math.max(metric.maxKeyboardLatencyMs ?? 0, duration);
}

export function recordRichTextFlush(
  editorId: string,
  durationMs: number,
  htmlLength: number,
  succeeded: boolean,
) {
  if (!isRichTextDiagnosticsEnabled()) return;
  const metric = editorMetric(editorId);
  metric.flushCount += 1;
  if (!succeeded) metric.flushFailureCount += 1;
  metric.lastFlushDurationMs = durationMs;
  metric.maxFlushDurationMs = Math.max(metric.maxFlushDurationMs ?? 0, durationMs);
  metric.lastHtmlLength = htmlLength;
}

export function recordJournalSaveQueued(date: string, revision: number, queueDepth: number) {
  if (!isRichTextDiagnosticsEnabled()) return;
  const metric = journalMetric(date);
  metric.queuedCount += 1;
  metric.lastQueuedRevision = revision;
  metric.maxQueueDepth = Math.max(metric.maxQueueDepth, queueDepth);
}

export function recordJournalSaveCompleted(
  date: string,
  revision: number,
  durationMs: number,
  succeeded: boolean,
) {
  if (!isRichTextDiagnosticsEnabled()) return;
  const metric = journalMetric(date);
  metric.saveCount += 1;
  if (succeeded) metric.lastSuccessfulRevision = revision;
  else metric.failureCount += 1;
  metric.lastDurationMs = durationMs;
  metric.maxDurationMs = Math.max(metric.maxDurationMs ?? 0, durationMs);
}

export function getRichTextDiagnosticsSnapshot(): RichTextDiagnosticsSnapshot {
  const editorEntries = Array.from(editors.entries()).map(([id, metric]) => {
    const {
      focusStartedAt: _focusStartedAt,
      keyboardRecordedForFocusAt: _keyboardRecordedForFocusAt,
      ...publicMetric
    } = metric;
    return [id, { ...publicMetric }] as const;
  });

  return {
    capturedAt: Date.now(),
    editors: Object.fromEntries(editorEntries),
    journalDates: Object.fromEntries(
      Array.from(journalDates.entries()).map(([date, metric]) => [date, { ...metric }]),
    ),
  };
}

export function resetRichTextDiagnostics() {
  if (!isRichTextDiagnosticsEnabled()) return;
  editors.clear();
  journalDates.clear();
}
