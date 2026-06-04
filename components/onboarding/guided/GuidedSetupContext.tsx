import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { loadGuidedSetupSession, saveGuidedSetupSession } from './guidedSetupStorage';
import type {
  GuidedChapter,
  GuidedEvent,
  GuidedOverlayPresentation,
  GuidedPhase,
  GuidedSessionState,
  GuidedStep,
  GuidedTargetId,
  GuidedTargetLayout,
} from './types';

type StartGuidedSetupInput = {
  currentChapter: GuidedChapter;
  chapterOrder: GuidedChapter[];
  activeStep: GuidedStep;
  phase: GuidedPhase;
  route: string;
};

type GuidedSetupContextValue = {
  hydrated: boolean;
  session: GuidedSessionState | null;
  presentation: GuidedOverlayPresentation | null;
  targetLayouts: Record<GuidedTargetId, GuidedTargetLayout>;
  beginGuidedSetup: (input: StartGuidedSetupInput) => void;
  patchSession: (patch: Partial<GuidedSessionState>) => void;
  completeStep: (step: GuidedStep) => void;
  endGuidedSetup: () => void;
  setPresentation: (presentation: GuidedOverlayPresentation | null) => void;
  registerTarget: (id: GuidedTargetId, layout: GuidedTargetLayout) => void;
  unregisterTarget: (id: GuidedTargetId) => void;
};

const GuidedSetupContext = createContext<GuidedSetupContextValue | null>(null);

type GuidedEventListener = (event: GuidedEvent) => void;
const guidedEventListeners = new Set<GuidedEventListener>();

export function notifyGuideEvent(event: GuidedEvent) {
  guidedEventListeners.forEach(listener => listener(event));
}

function addUniqueStep(steps: GuidedStep[], step: GuidedStep) {
  return steps.includes(step) ? steps : [...steps, step];
}

export function GuidedSetupProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<GuidedSessionState | null>(null);
  const [presentation, setPresentation] = useState<GuidedOverlayPresentation | null>(null);
  const [targetLayouts, setTargetLayouts] = useState<Record<GuidedTargetId, GuidedTargetLayout>>({});
  const skipNextSessionSave = useRef(true);

  useEffect(() => {
    let alive = true;
    loadGuidedSetupSession()
      .then(saved => {
        if (!alive) return;
        setSession(saved?.active ? saved : null);
        setHydrated(true);
      })
      .catch(error => {
        console.warn('[GuidedSetup] restore failed', error);
        if (alive) setHydrated(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextSessionSave.current) {
      skipNextSessionSave.current = false;
      return;
    }
    saveGuidedSetupSession(session).catch(error => {
      console.warn('[GuidedSetup] save failed', error);
    });
  }, [hydrated, session]);

  const beginGuidedSetup = useCallback((input: StartGuidedSetupInput) => {
    skipNextSessionSave.current = false;
    setPresentation(null);
    setSession(previous => ({
      version: 1,
      active: true,
      currentChapter: input.currentChapter,
      chapterOrder: input.chapterOrder,
      activeStep: input.activeStep,
      phase: input.phase,
      route: input.route,
      completedSteps: previous?.completedSteps ?? [],
      createdIds: previous?.createdIds ?? {},
      updatedAt: Date.now(),
    }));
  }, []);

  const patchSession = useCallback((patch: Partial<GuidedSessionState>) => {
    skipNextSessionSave.current = false;
    setSession(previous => (
      previous
        ? { ...previous, ...patch, updatedAt: Date.now() }
        : previous
    ));
  }, []);

  const completeStep = useCallback((step: GuidedStep) => {
    skipNextSessionSave.current = false;
    setSession(previous => (
      previous
        ? {
            ...previous,
            completedSteps: addUniqueStep(previous.completedSteps, step),
            updatedAt: Date.now(),
          }
        : previous
    ));
  }, []);

  const endGuidedSetup = useCallback(() => {
    skipNextSessionSave.current = false;
    setPresentation(null);
    setTargetLayouts({});
    setSession(null);
  }, []);

  const registerTarget = useCallback((id: GuidedTargetId, layout: GuidedTargetLayout) => {
    setTargetLayouts(previous => {
      const existing = previous[id];
      if (
        existing &&
        existing.x === layout.x &&
        existing.y === layout.y &&
        existing.width === layout.width &&
        existing.height === layout.height
      ) {
        return previous;
      }
      return { ...previous, [id]: layout };
    });
  }, []);

  const unregisterTarget = useCallback((id: GuidedTargetId) => {
    setTargetLayouts(previous => {
      if (!previous[id]) return previous;
      const next = { ...previous };
      delete next[id];
      return next;
    });
  }, []);

  useEffect(() => {
    const onGuidedEvent = (event: GuidedEvent) => {
      skipNextSessionSave.current = false;
      setSession(previous => {
        if (!previous?.active) return previous;
        const nextCreatedIds =
          event.entityKey && event.entityId
            ? { ...previous.createdIds, [event.entityKey]: event.entityId }
            : previous.createdIds;
        const nextCompletedSteps =
          event.type === 'completed'
            ? addUniqueStep(previous.completedSteps, event.step)
            : previous.completedSteps;
        return {
          ...previous,
          phase: event.phase ?? previous.phase,
          createdIds: nextCreatedIds,
          completedSteps: nextCompletedSteps,
          updatedAt: Date.now(),
        };
      });
    };
    guidedEventListeners.add(onGuidedEvent);
    return () => {
      guidedEventListeners.delete(onGuidedEvent);
    };
  }, []);

  const value = useMemo<GuidedSetupContextValue>(() => ({
    hydrated,
    session,
    presentation,
    targetLayouts,
    beginGuidedSetup,
    patchSession,
    completeStep,
    endGuidedSetup,
    setPresentation,
    registerTarget,
    unregisterTarget,
  }), [
    beginGuidedSetup,
    completeStep,
    endGuidedSetup,
    hydrated,
    patchSession,
    presentation,
    registerTarget,
    session,
    targetLayouts,
    unregisterTarget,
  ]);

  return <GuidedSetupContext.Provider value={value}>{children}</GuidedSetupContext.Provider>;
}

export function useGuidedSetup() {
  const context = useContext(GuidedSetupContext);
  if (!context) {
    throw new Error('useGuidedSetup must be used inside <GuidedSetupProvider>');
  }
  return context;
}

export function useGuideTarget(id: GuidedTargetId, enabled = true) {
  const ref = useRef<any>(null);
  const { session, registerTarget, unregisterTarget } = useGuidedSetup();
  const active = enabled && session?.active === true;

  const measure = useCallback(() => {
    if (!active) return;
    requestAnimationFrame(() => {
      ref.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
        if (width <= 0 || height <= 0) return;
        registerTarget(id, { x, y, width, height });
      });
    });
  }, [active, id, registerTarget]);

  const onLayout = useCallback((_event: LayoutChangeEvent) => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (active) measure();
    return () => unregisterTarget(id);
  }, [active, id, measure, unregisterTarget]);

  return useMemo(() => ({ ref, onLayout, measure }), [measure, onLayout]);
}
