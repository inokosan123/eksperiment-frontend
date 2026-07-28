import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { GuidedOverlayPresentation, GuidedTargetLayout } from './types';

export const GUIDED_TRANSITION = {
  spotlightMoveMs: 280,
  dimExitMs: 150,
  ringExitMs: 140,
  longJumpMinPx: 260,
  longJumpViewportRatio: 0.38,
  longJumpExitLeadMs: 155,
  scrollFallbackMs: 320,
  targetSettleMs: 32,
  minRepositionPx: 14,
  measureRetryMs: 48,
  maxMeasureAttempts: 36,
  scrollQuietMs: 90,
} as const;

type ScrollController = {
  scrollTo: (options: { y: number; animated?: boolean }) => void;
};

type MeasureNode = {
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

export type GuidedTargetBinding = {
  ref: { current: MeasureNode | null };
  measure: () => void;
  measureNow?: (onMeasured?: (layout: GuidedTargetLayout | null) => void) => void;
};

export type GuidedTargetPosition = 'origin' | ((targetHeight: number) => number);

type UseGuidedScrollTransitionOptions = {
  scrollRef: { current: ScrollController | null };
  screenHeight: number;
  setPresentation: (presentation: GuidedOverlayPresentation | null) => void;
  scrollFallbackMs?: number;
  dismissOnAnyReposition?: boolean;
};

// Shared choreography for every scroll-based guided setup:
// - short moves preserve the mounted dim layer;
// - long jumps clear it before scrolling;
// - the next spotlight is measured and shown only once native scrolling rests.
export function useGuidedScrollTransition({
  scrollRef,
  screenHeight,
  setPresentation,
  scrollFallbackMs = GUIDED_TRANSITION.scrollFallbackMs,
  dismissOnAnyReposition = false,
}: UseGuidedScrollTransitionOptions) {
  const scrollYRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const framesRef = useRef<number[]>([]);
  const pendingRevealRef = useRef<(() => void) | null>(null);
  const stageTokenRef = useRef(0);
  const lastScrollAtRef = useRef(0);

  const clear = useCallback(() => {
    stageTokenRef.current += 1;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    framesRef.current.forEach(cancelAnimationFrame);
    framesRef.current = [];
    pendingRevealRef.current = null;
  }, []);

  const finish = useCallback(() => {
    pendingRevealRef.current?.();
  }, []);

  const schedule = useCallback((callback: () => void, delayMs: number) => {
    timersRef.current.push(setTimeout(callback, delayMs));
  }, []);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = event.nativeEvent.contentOffset.y;
    lastScrollAtRef.current = Date.now();
  }, []);

  const stageTarget = useCallback((
    binding: GuidedTargetBinding | null,
    position: GuidedTargetPosition,
    present: () => void,
    onUnavailable?: () => void,
  ) => {
    const stageToken = ++stageTokenRef.current;
    let terminal = false;
    const isCurrentStage = () => stageTokenRef.current === stageToken;
    const failClosed = () => {
      if (!isCurrentStage() || terminal) return;
      terminal = true;
      pendingRevealRef.current = null;
      onUnavailable?.();
    };
    const scheduleCurrent = (callback: () => void, delayMs: number) => {
      timersRef.current.push(setTimeout(() => {
        if (isCurrentStage() && !terminal) callback();
      }, delayMs));
    };

    // Register a fresh native rect, then allow the overlay context two frames
    // to publish it before the presentation starts referencing targetId.
    const presentAfterFreshMeasure = (attempt = 0) => {
      if (!isCurrentStage()) return;

      const publish = () => {
        const firstFrame = requestAnimationFrame(() => {
          const secondFrame = requestAnimationFrame(() => {
            if (isCurrentStage()) present();
          });
          framesRef.current.push(secondFrame);
        });
        framesRef.current.push(firstFrame);
      };

      if (!binding) {
        publish();
        return;
      }

      const onMeasured = (layout: GuidedTargetLayout | null) => {
        if (!isCurrentStage()) return;
        const visible = !!layout
          && layout.y < screenHeight - 8
          && layout.y + layout.height > 8;
        if (visible) {
          publish();
          return;
        }
        if (attempt < GUIDED_TRANSITION.maxMeasureAttempts) {
          scheduleCurrent(
            () => presentAfterFreshMeasure(attempt + 1),
            GUIDED_TRANSITION.measureRetryMs,
          );
        } else {
          failClosed();
        }
      };

      if (binding.measureNow) {
        binding.measureNow(onMeasured);
        return;
      }

      const node = binding.ref.current;
      if (!node?.measureInWindow) {
        onMeasured(null);
        return;
      }
      node.measureInWindow((x, y, targetWidth, targetHeight) => {
        const valid = Number.isFinite(x)
          && Number.isFinite(y)
          && Number.isFinite(targetWidth)
          && Number.isFinite(targetHeight)
          && targetWidth > 4
          && targetHeight > 4;
        if (valid) binding.measure();
        onMeasured(valid ? { x, y, width: targetWidth, height: targetHeight } : null);
      });
    };

    const presentAtRest = () => {
      pendingRevealRef.current = null;
      presentAfterFreshMeasure();
    };

    const scrollThenPresent = (targetY: number) => {
      const distance = Math.abs(targetY - scrollYRef.current);
      const longJumpThreshold = Math.max(
        GUIDED_TRANSITION.longJumpMinPx,
        screenHeight * GUIDED_TRANSITION.longJumpViewportRatio,
      );
      const isLongJump = distance >= longJumpThreshold;

      const startScroll = () => {
        const reveal = () => {
          if (pendingRevealRef.current !== reveal) return;
          const quietFor = Date.now() - lastScrollAtRef.current;
          if (quietFor < GUIDED_TRANSITION.scrollQuietMs) {
            scheduleCurrent(reveal, GUIDED_TRANSITION.scrollQuietMs - quietFor);
            return;
          }
          pendingRevealRef.current = null;
          presentAfterFreshMeasure();
        };

        pendingRevealRef.current = reveal;
        scrollRef.current?.scrollTo({ y: targetY, animated: true });
        scheduleCurrent(reveal, scrollFallbackMs);
      };

      if (isLongJump || dismissOnAnyReposition) {
        setPresentation(null);
        scheduleCurrent(startScroll, GUIDED_TRANSITION.longJumpExitLeadMs);
      } else {
        startScroll();
      }
    };

    const measureAndStage = (attempt: number) => {
      if (position === 'origin') {
        if (scrollYRef.current < 4) {
          presentAtRest();
          return;
        }
        scrollThenPresent(0);
        return;
      }

      const node = binding?.ref.current;
      if (!binding || !node?.measureInWindow) {
        if (attempt < GUIDED_TRANSITION.maxMeasureAttempts) {
          scheduleCurrent(
            () => measureAndStage(attempt + 1),
            GUIDED_TRANSITION.measureRetryMs,
          );
        } else {
          failClosed();
        }
        return;
      }

      node.measureInWindow((_x, targetY, targetWidth, targetHeight) => {
        const valid = Number.isFinite(targetY)
          && Number.isFinite(targetWidth)
          && Number.isFinite(targetHeight)
          && targetWidth > 4
          && targetHeight > 4;
        if (!valid) {
          if (attempt < GUIDED_TRANSITION.maxMeasureAttempts) {
            scheduleCurrent(
              () => measureAndStage(attempt + 1),
              GUIDED_TRANSITION.measureRetryMs,
            );
          } else {
            failClosed();
          }
          return;
        }

        const desiredY = position(targetHeight);
        const delta = targetY - desiredY;
        if (Math.abs(delta) < GUIDED_TRANSITION.minRepositionPx) {
          presentAtRest();
          return;
        }
        const nextScrollY = Math.max(0, scrollYRef.current + delta);
        if (Math.abs(nextScrollY - scrollYRef.current) < GUIDED_TRANSITION.minRepositionPx) {
          presentAtRest();
          return;
        }
        scrollThenPresent(nextScrollY);
      });
    };

    measureAndStage(0);
  }, [dismissOnAnyReposition, screenHeight, scrollFallbackMs, scrollRef, setPresentation]);

  return {
    clear,
    finish,
    onScroll,
    schedule,
    scrollYRef,
    stageTarget,
  };
}

