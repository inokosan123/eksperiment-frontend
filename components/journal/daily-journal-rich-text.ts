type PromptWithAnswer = {
  id: string;
  a: string;
};

export function dailyPromptEditorId(date: string, promptId: string) {
  return `daily:${date}:prompt:${promptId}`;
}

export function dailyFreeWritingEditorId(date: string) {
  return `daily:${date}:free-writing`;
}

/**
 * Binds an async native flush to the revision that existed before the bridge
 * request started. Input arriving while the flush is in flight therefore
 * remains a newer dirty revision and cannot be acknowledged by the old HTML.
 */
export async function captureDailyJournalSaveSnapshot<Patch>(
  getRevision: () => number,
  buildPatch: () => Promise<Patch>,
) {
  const revision = getRevision();
  const patch = await buildPatch();
  return { patch, revision };
}

export async function settleDailyJournalDraft({
  isDirty,
  saveOnce,
  maxAttempts = 3,
  label,
}: {
  isDirty: () => boolean;
  saveOnce: () => Promise<void>;
  maxAttempts?: number;
  label: string;
}) {
  let attempts = 0;
  while (isDirty() && attempts < maxAttempts) {
    attempts += 1;
    await saveOnce();
  }

  if (isDirty()) {
    throw new Error(`${label} is still dirty after ${attempts} save attempts`);
  }
  return attempts;
}

export function mergeDailyRichTextDraft<Prompt extends PromptWithAnswer>({
  date,
  prompts,
  freeWriting,
  htmlByEditorId,
}: {
  date: string;
  prompts: Prompt[];
  freeWriting: string;
  htmlByEditorId?: Record<string, string>;
}) {
  if (!htmlByEditorId) return { prompts, freeWriting };

  let promptsChanged = false;
  const mergedPrompts = prompts.map(prompt => {
    const answer = htmlByEditorId[dailyPromptEditorId(date, prompt.id)];
    if (answer === undefined || answer === prompt.a) return prompt;
    promptsChanged = true;
    return { ...prompt, a: answer };
  });

  return {
    prompts: promptsChanged ? mergedPrompts : prompts,
    freeWriting:
      htmlByEditorId[dailyFreeWritingEditorId(date)] ?? freeWriting,
  };
}
