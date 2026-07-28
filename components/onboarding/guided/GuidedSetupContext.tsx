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
  beginGuidedSetup: (input: StartGuidedSetupInput) => void;
  patchSession: (patch: Partial<GuidedSessionState>) => void;
  completeStep: (step: GuidedStep) => void;
  endGuidedSetup: () => void;
  setPresentation: (presentation: GuidedOverlayPresentation | null) => void;
  registerTarget: (id: GuidedTargetId, layout: GuidedTargetLayout) => void;
  unregisterTarget: (id: GuidedTargetId) => void;
};

// Presentation + measured target rects live in their own context so that the
// per-frame churn of presenting, scrolling, and re-measuring re-renders ONLY
// the overlay host — never the heavy screens that merely drive the guide.
type GuidedOverlayStateValue = {
  presentation: GuidedOverlayPresentation | null;
  targetLayouts: Record<GuidedTargetId, GuidedTargetLayout>;
};

const GuidedSetupContext = createContext<GuidedSetupContextValue | null>(null);
const GuidedOverlayStateContext = createContext<GuidedOverlayStateValue | null>(null);

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
  // A cold-start restore must never overwrite a guide the user has already
  // opened. This epoch makes an explicit runtime mutation authoritative while
  // the async persisted-session read is still in flight.
  const sessionMutationEpochRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const restoreEpoch = sessionMutationEpochRef.current;
    loadGuidedSetupSession()
      .then(saved => {
        if (!alive) return;
        if (sessionMutationEpochRef.current === restoreEpoch) {
          setSession(saved?.active ? saved : null);
        }
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
    sessionMutationEpochRef.current += 1;
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
    sessionMutationEpochRef.current += 1;
    skipNextSessionSave.current = false;
    setSession(previous => (
      previous
        ? { ...previous, ...patch, updatedAt: Date.now() }
        : previous
    ));
  }, []);

  const completeStep = useCallback((step: GuidedStep) => {
    sessionMutationEpochRef.current += 1;
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
    sessionMutationEpochRef.current += 1;
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
    registerTarget,
    session,
    unregisterTarget,
  ]);

  const overlayValue = useMemo<GuidedOverlayStateValue>(() => ({
    presentation,
    targetLayouts,
  }), [presentation, targetLayouts]);

  return (
    <GuidedSetupContext.Provider value={value}>
      <GuidedOverlayStateContext.Provider value={overlayValue}>
        {children}
      </GuidedOverlayStateContext.Provider>
    </GuidedSetupContext.Provider>
  );
}

export function useGuidedSetup() {
  const context = useContext(GuidedSetupContext);
  if (!context) {
    throw new Error('useGuidedSetup must be used inside <GuidedSetupProvider>');
  }
  return context;
}

export function useGuidedOverlayState() {
  const context = useContext(GuidedOverlayStateContext);
  if (!context) {
    throw new Error('useGuidedOverlayState must be used inside <GuidedSetupProvider>');
  }
  return context;
}

export function useGuideTarget(id: GuidedTargetId, enabled = true) {
  const ref = useRef<any>(null);
  const measurementEpochRef = useRef(0);
  const { session, registerTarget, unregisterTarget } = useGuidedSetup();
  const active = enabled && session?.active === true;

  const measureNow = useCallback((
    onMeasured?: (layout: GuidedTargetLayout | null) => void,
  ) => {
    const measurementEpoch = ++measurementEpochRef.current;
    if (!active) {
      onMeasured?.(null);
      return;
    }
    requestAnimationFrame(() => {
      if (measurementEpochRef.current !== measurementEpoch) {
        onMeasured?.(null);
        return;
      }
      const node = ref.current;
      if (!node?.measureInWindow) {
        onMeasured?.(null);
        return;
      }
      node.measureInWindow((x: number, y: number, width: number, height: number) => {
        if (measurementEpochRef.current !== measurementEpoch) {
          onMeasured?.(null);
          return;
        }
        const valid = Number.isFinite(x)
          && Number.isFinite(y)
          && Number.isFinite(width)
          && Number.isFinite(height)
          && width > 0
          && height > 0;
        if (!valid) {
          onMeasured?.(null);
          return;
        }
        const layout = { x, y, width, height };
        registerTarget(id, layout);
        onMeasured?.(layout);
      });
    });
  }, [active, id, registerTarget]);

  const measure = useCallback(() => {
    measureNow();
  }, [measureNow]);

  const onLayout = useCallback((_event: LayoutChangeEvent) => {
    measure();
  }, [measure]);

  useEffect(() => {
    if (active) measure();
    return () => {
      measurementEpochRef.current += 1;
      unregisterTarget(id);
    };
  }, [active, id, measure, unregisterTarget]);

  return useMemo(
    () => ({ ref, onLayout, measure, measureNow }),
    [measure, measureNow, onLayout],
  );
}
