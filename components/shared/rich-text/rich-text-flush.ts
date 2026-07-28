export const RICH_TEXT_FLUSH_TIMEOUT_MS = 2500;

export class RichTextFlushTimeoutError extends Error {
  readonly editorId: string;

  constructor(editorId: string, timeoutMs: number) {
    super(`Rich-text editor "${editorId}" did not flush within ${timeoutMs}ms`);
    this.name = 'RichTextFlushTimeoutError';
    this.editorId = editorId;
  }
}

/**
 * Native rich-text bridges should resolve quickly, but a navigation or
 * background save must never wait forever if a native promise is lost.
 * Rejecting keeps the draft dirty so the caller can retry instead of
 * pretending that an incomplete snapshot was saved.
 */
export async function withRichTextFlushTimeout<T>(
  editorId: string,
  operation: Promise<T>,
  timeoutMs = RICH_TEXT_FLUSH_TIMEOUT_MS,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new RichTextFlushTimeoutError(editorId, timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
