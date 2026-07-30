import {
  createContext,
  forwardRef,
  memo,
  use,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type LayoutChangeEvent, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

const FocusMainMotionContext = createContext(true);

export function useFocusMainMotion() {
  return use(FocusMainMotionContext);
}

type ProviderProps = {
  children: ReactNode;
};

export const FocusMainMotionProvider = memo(function FocusMainMotionProvider({ children }: ProviderProps) {
  const isFocused = useIsFocused();
  const [isForeground, setIsForeground] = useState(
    AppState.currentState == null || AppState.currentState === 'active',
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      setIsForeground(next === 'active');
    });
    return () => subscription.remove();
  }, []);

  return (
    <FocusMainMotionContext.Provider value={isFocused && isForeground}>
      {children}
    </FocusMainMotionContext.Provider>
  );
});

FocusMainMotionProvider.displayName = 'FocusMainMotionProvider';

export type FocusViewportMotionHandle = {
  updateViewport: (scrollY: number) => void;
};

type ViewportProps = {
  viewportHeight: number;
  children: ReactNode;
  initiallyActive?: boolean;
};

export const FocusViewportMotionBoundary = memo(forwardRef<FocusViewportMotionHandle, ViewportProps>(
  function FocusViewportMotionBoundary({ viewportHeight, children, initiallyActive = false }, ref) {
    const parentMotionEnabled = useFocusMainMotion();
    const [nearViewport, setNearViewport] = useState(initiallyActive);
    const nearViewportRef = useRef(initiallyActive);
    const frameRef = useRef({ y: Number.POSITIVE_INFINITY, height: 0 });
    const scrollYRef = useRef(0);

    const updateViewport = useCallback((scrollY: number) => {
      scrollYRef.current = scrollY;
      const { y, height } = frameRef.current;
      const preload = Math.min(160, viewportHeight * 0.18);
      const next = y <= scrollY + viewportHeight + preload
        && y + height >= scrollY - preload;
      if (nearViewportRef.current === next) return;
      nearViewportRef.current = next;
      setNearViewport(next);
    }, [viewportHeight]);

    const handleLayout = useCallback((event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      frameRef.current = { y, height };
      updateViewport(scrollYRef.current);
    }, [updateViewport]);

    useImperativeHandle(ref, () => ({ updateViewport }), [updateViewport]);

    return (
      <FocusMainMotionContext.Provider value={parentMotionEnabled && nearViewport}>
        <View onLayout={handleLayout}>{children}</View>
      </FocusMainMotionContext.Provider>
    );
  },
));

FocusViewportMotionBoundary.displayName = 'FocusViewportMotionBoundary';
