import React, {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  EMPTY_RICH_TEXT_FORMAT_STATE,
  type NativeRichTextEditorRef,
  type RichTextFormatState,
} from '@/components/shared/rich-text/rich-text-types';
import { withRichTextFlushTimeout } from '@/components/shared/rich-text/rich-text-flush';
import {
  recordRichTextEditorDirty,
  recordRichTextFlush,
  richTextDiagnosticNow,
} from '@/components/shared/rich-text/rich-text-diagnostics';

type RegisteredEditor = {
  ref: React.RefObject<NativeRichTextEditorRef | null>;
};

type ActiveEditor = {
  id: string;
  focused: boolean;
  formats: RichTextFormatState;
};

type RichTextEditorContextValue = {
  activeEditor: ActiveEditor | null;
  registerEditor: (id: string, editor: RegisteredEditor) => () => void;
  focusEditor: (id: string) => void;
  blurEditor: (id: string) => void;
  updateFormats: (id: string, formats: RichTextFormatState) => void;
  markDirty: (id: string) => void;
  clearBlurredEditor: (id: string) => void;
  runActiveCommand: (command: keyof Pick<
    NativeRichTextEditorRef,
    'bold' | 'italic' | 'underline' | 'bulletList' | 'orderedList'
  >) => void;
  dismissActiveEditor: () => void;
  flushEditor: (id: string) => Promise<string | null>;
  flushAll: () => Promise<Record<string, string>>;
  flushDirty: () => Promise<Record<string, string>>;
  getDirtyEditorIds: () => string[];
  clearDirtyEditorIds: (ids?: string[]) => void;
};

type RichTextEditorActions = Omit<RichTextEditorContextValue, 'activeEditor'>;

const RichTextEditorActionsContext = createContext<RichTextEditorActions | null>(null);
const RichTextEditorStateContext = createContext<ActiveEditor | null | undefined>(undefined);

function formatsEqual(left: RichTextFormatState, right: RichTextFormatState) {
  return (
    left.bold === right.bold
    && left.italic === right.italic
    && left.underline === right.underline
    && left.bulletList === right.bulletList
    && left.orderedList === right.orderedList
  );
}

async function flushRegisteredEditor(editorId: string, editor: NativeRichTextEditorRef) {
  const startedAt = richTextDiagnosticNow();
  try {
    const html = await withRichTextFlushTimeout(editorId, editor.flush());
    recordRichTextFlush(
      editorId,
      richTextDiagnosticNow() - startedAt,
      html.length,
      true,
    );
    return html;
  } catch (error) {
    recordRichTextFlush(
      editorId,
      richTextDiagnosticNow() - startedAt,
      0,
      false,
    );
    throw error;
  }
}

export function RichTextEditorProvider({
  children,
  onDirty,
}: {
  children: React.ReactNode;
  onDirty?: (editorId: string) => void;
}) {
  const editorsRef = useRef(new Map<string, RegisteredEditor>());
  const dirtyEditorIdsRef = useRef(new Set<string>());
  const dismissFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeEditor, setActiveEditor] = useState<ActiveEditor | null>(null);
  const activeEditorRef = useRef<ActiveEditor | null>(null);
  activeEditorRef.current = activeEditor;

  useEffect(() => () => {
    if (dismissFallbackRef.current) clearTimeout(dismissFallbackRef.current);
  }, []);

  const registerEditor = useCallback((id: string, editor: RegisteredEditor) => {
    editorsRef.current.set(id, editor);
    return () => {
      const current = editorsRef.current.get(id);
      if (current === editor) editorsRef.current.delete(id);
      dirtyEditorIdsRef.current.delete(id);
      setActiveEditor(active => active?.id === id ? null : active);
    };
  }, []);

  const focusEditor = useCallback((id: string) => {
    if (dismissFallbackRef.current) {
      clearTimeout(dismissFallbackRef.current);
      dismissFallbackRef.current = null;
    }
    setActiveEditor(active => ({
      id,
      focused: true,
      formats: active?.id === id ? active.formats : EMPTY_RICH_TEXT_FORMAT_STATE,
    }));
  }, []);

  const blurEditor = useCallback((id: string) => {
    setActiveEditor(active => active?.id === id ? { ...active, focused: false } : active);
  }, []);

  const updateFormats = useCallback((id: string, formats: RichTextFormatState) => {
    setActiveEditor(active => (
      active?.id === id && !formatsEqual(active.formats, formats)
        ? { ...active, formats }
        : active
    ));
  }, []);

  const markDirty = useCallback((id: string) => {
    dirtyEditorIdsRef.current.add(id);
    recordRichTextEditorDirty(id);
    onDirty?.(id);
  }, [onDirty]);

  const clearBlurredEditor = useCallback((id: string) => {
    if (dismissFallbackRef.current) {
      clearTimeout(dismissFallbackRef.current);
      dismissFallbackRef.current = null;
    }
    setActiveEditor(active => (
      active?.id === id && !active.focused ? null : active
    ));
  }, []);

  const runActiveCommand = useCallback<RichTextEditorContextValue['runActiveCommand']>((command) => {
    const active = activeEditorRef.current;
    if (!active) return;
    editorsRef.current.get(active.id)?.ref.current?.[command]();
  }, []);

  const dismissActiveEditor = useCallback(() => {
    const active = activeEditorRef.current;
    if (!active) return;
    editorsRef.current.get(active.id)?.ref.current?.blur();
    setActiveEditor(current => (
      current?.id === active.id ? { ...current, focused: false } : current
    ));
    if (dismissFallbackRef.current) clearTimeout(dismissFallbackRef.current);
    const dismissedEditorId = active.id;
    dismissFallbackRef.current = setTimeout(() => {
      dismissFallbackRef.current = null;
      setActiveEditor(current => (
        current?.id === dismissedEditorId ? null : current
      ));
    }, 360);
  }, []);

  const flushEditor = useCallback(async (id: string) => {
    const editor = editorsRef.current.get(id)?.ref.current;
    if (!editor) return null;
    return flushRegisteredEditor(id, editor);
  }, []);

  const flushAll = useCallback(async () => {
    const entries = Array.from(editorsRef.current.entries());
    const values = await Promise.all(entries.map(async ([id, editor]) => {
      const instance = editor.ref.current;
      return [
        id,
        instance
          ? await flushRegisteredEditor(id, instance)
          : undefined,
      ] as const;
    }));
    return values.reduce<Record<string, string>>((result, [id, html]) => {
      if (html !== undefined) result[id] = html;
      return result;
    }, {});
  }, []);

  const flushDirty = useCallback(async () => {
    const ids = Array.from(dirtyEditorIdsRef.current);
    const values = await Promise.all(ids.map(async id => {
      const instance = editorsRef.current.get(id)?.ref.current;
      return [
        id,
        instance
          ? await flushRegisteredEditor(id, instance)
          : undefined,
      ] as const;
    }));
    return values.reduce<Record<string, string>>((result, [id, html]) => {
      if (html !== undefined) result[id] = html;
      return result;
    }, {});
  }, []);

  const getDirtyEditorIds = useCallback(() => Array.from(dirtyEditorIdsRef.current), []);

  const clearDirtyEditorIds = useCallback((ids?: string[]) => {
    if (!ids) {
      dirtyEditorIdsRef.current.clear();
      return;
    }
    ids.forEach(id => dirtyEditorIdsRef.current.delete(id));
  }, []);

  const actions = useMemo<RichTextEditorActions>(() => ({
    registerEditor,
    focusEditor,
    blurEditor,
    updateFormats,
    markDirty,
    clearBlurredEditor,
    runActiveCommand,
    dismissActiveEditor,
    flushEditor,
    flushAll,
    flushDirty,
    getDirtyEditorIds,
    clearDirtyEditorIds,
  }), [
    registerEditor,
    focusEditor,
    blurEditor,
    updateFormats,
    markDirty,
    clearBlurredEditor,
    runActiveCommand,
    dismissActiveEditor,
    flushEditor,
    flushAll,
    flushDirty,
    getDirtyEditorIds,
    clearDirtyEditorIds,
  ]);

  return (
    <RichTextEditorActionsContext.Provider value={actions}>
      <RichTextEditorStateContext.Provider value={activeEditor}>
        {children}
      </RichTextEditorStateContext.Provider>
    </RichTextEditorActionsContext.Provider>
  );
}

export function useRichTextEditorCoordinator() {
  const context = useOptionalRichTextEditorCoordinator();
  if (!context) {
    throw new Error('Native rich-text editors must be inside RichTextEditorProvider');
  }
  return context;
}

export function useOptionalRichTextEditorCoordinator() {
  const actions = use(RichTextEditorActionsContext);
  const activeEditor = use(RichTextEditorStateContext);
  if (!actions || activeEditor === undefined) return null;
  return { ...actions, activeEditor };
}

export function useRichTextEditorActions() {
  const actions = use(RichTextEditorActionsContext);
  if (!actions) {
    throw new Error('Native rich-text editors must be inside RichTextEditorProvider');
  }
  return actions;
}
