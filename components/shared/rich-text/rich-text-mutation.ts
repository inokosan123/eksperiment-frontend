/**
 * Keeps native editor mutation ordering explicit and testable. A failed
 * native command must not claim that a draft changed; a successful command
 * must schedule persistence even when its plain-text value is unchanged.
 */
export function runRichTextMutation(
  mutate: () => void,
  markDirty: () => void,
) {
  mutate();
  markDirty();
}

/**
 * Programmatic native hydration may emit the same plain-text event as user
 * input. `null` is the only "no echo expected" sentinel: an empty string is a
 * real expected echo for a newly hydrated empty editor and must be consumed.
 */
export function isExpectedRichTextPlainTextEcho(
  expected: string | null,
  actual: string,
) {
  return expected !== null && expected === actual;
}

export const MAX_PENDING_RICH_TEXT_ECHOES = 8;

/**
 * Native `defaultValue`/`setValue` commands can emit their plain-text changes
 * after a later hydration command has already been scheduled. Keeping a small
 * bounded queue prevents those legitimate bridge echoes from becoming false
 * user edits while avoiding an unbounded lifetime for stale values.
 */
export function enqueueExpectedRichTextPlainTextEcho(
  pending: readonly string[],
  expected: string,
) {
  const next = [...pending, expected];
  return next.length <= MAX_PENDING_RICH_TEXT_ECHOES
    ? next
    : next.slice(-MAX_PENDING_RICH_TEXT_ECHOES);
}

/**
 * A matching later value also consumes any older pending values. The native
 * view is allowed to coalesce consecutive programmatic changes and emit only
 * the newest one. A non-matching event is a real edit and invalidates the
 * entire pending queue so future user text cannot be swallowed accidentally.
 */
export function consumeExpectedRichTextPlainTextEcho(
  pending: readonly string[],
  actual: string,
) {
  const matchingIndex = pending.indexOf(actual);
  if (matchingIndex < 0) {
    return { matched: false, remaining: [] as string[] };
  }

  return {
    matched: true,
    remaining: pending.slice(matchingIndex + 1),
  };
}
