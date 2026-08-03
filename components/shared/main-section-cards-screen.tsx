import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import RibbonSectionCard, { RibbonMotionProvider } from '@/components/shared/RibbonSectionCard';
import type { SectionCardConfig, SectionCardRoute } from '@/components/shared/sectionCardData';
import { C, F } from '@/constants/tokens';
import {
  useViewportMotionBudget,
  viewportMaskChanged,
} from '@/components/shared/use-viewport-motion-budget';

type CardFrame = { y: number; height: number };

type Props = {
  title: string;
  quote: string;
  quoteReference: string;
  cards: readonly SectionCardConfig[];
  cardsPaddingTop: number;
};

type MainRibbonCardProps = {
  card: SectionCardConfig;
  index: number;
  active: boolean;
  estimatedWidth: number;
  onFrameLayout: (index: number, event: LayoutChangeEvent) => void;
  onNavigate: (route: SectionCardRoute) => void;
};

const MainRibbonCard = memo(function MainRibbonCard({
  card,
  index,
  active,
  estimatedWidth,
  onFrameLayout,
  onNavigate,
}: MainRibbonCardProps) {
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    onFrameLayout(index, event);
  }, [index, onFrameLayout]);
  const handlePress = useCallback(() => {
    onNavigate(card.route);
  }, [card.route, onNavigate]);

  return (
    <RibbonSectionCard
      {...card}
      index={index}
      active={active}
      estimatedWidth={estimatedWidth}
      onFrameLayout={handleLayout}
      onPress={handlePress}
    />
  );
});

export default function MainSectionCardsScreen({
  title,
  quote,
  quoteReference,
  cards,
  cardsPaddingTop,
}: Props) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { height: viewportHeight, width } = useWindowDimensions();
  // `currentState` can be null during the first native bridge round-trip.
  // Treat that launch-only unknown as visible so the first painted card does
  // not wait for an AppState event before its ambient motion starts.
  const [isForeground, setIsForeground] = useState(
    AppState.currentState == null || AppState.currentState === 'active',
  );
  // The first three cards cover the initial viewport on supported phones.
  // Pre-arming them removes the one-frame static-to-live handoff while native
  // layout measurements arrive; the measured mask replaces this immediately.
  const initiallyActiveCardCount = Math.min(cards.length, 3);
  const initialMask = (1 << initiallyActiveCardCount) - 1;
  const [nearViewportMask, setNearViewportMask] = useState(initialMask);
  const nearViewportMaskRef = useRef(initialMask);
  const stackTopRef = useRef(0);
  const cardFramesRef = useRef(new Map<number, CardFrame>());
  const scrollYRef = useRef(0);

  const updateNearViewport = useCallback((scrollY: number) => {
    scrollYRef.current = scrollY;
    // Start ahead of the first visible pixel so a fast fling or one delayed JS
    // scroll event can never expose a frozen first frame.
    const preload = Math.min(160, viewportHeight * 0.18);
    const viewportTop = scrollY - preload;
    const viewportBottom = scrollY + viewportHeight + preload;
    let nextMask = 0;

    // A stack and its children can report layout in separate native batches.
    // Keep any not-yet-measured first-viewport card live until its own frame
    // arrives, instead of briefly replacing the launch animation with a still.
    for (let index = 0; index < initiallyActiveCardCount; index += 1) {
      if (!cardFramesRef.current.has(index)) nextMask |= 1 << index;
    }

    for (const [index, frame] of cardFramesRef.current) {
      const top = stackTopRef.current + frame.y;
      if (top <= viewportBottom && top + frame.height >= viewportTop) {
        nextMask |= 1 << index;
      }
    }

    if (!viewportMaskChanged(nearViewportMaskRef.current, nextMask)) return;
    nearViewportMaskRef.current = nextMask;
    setNearViewportMask(nextMask);
  }, [initiallyActiveCardCount, viewportHeight]);

  const scheduleViewportUpdate = useViewportMotionBudget(updateNearViewport);

  const handleStackLayout = useCallback((event: LayoutChangeEvent) => {
    stackTopRef.current = event.nativeEvent.layout.y;
    scheduleViewportUpdate(scrollYRef.current);
  }, [scheduleViewportUpdate]);

  const handleCardLayout = useCallback((index: number, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    const current = cardFramesRef.current.get(index);
    if (current?.y === y && current.height === height) return;
    cardFramesRef.current.set(index, { y, height });
    scheduleViewportUpdate(scrollYRef.current);
  }, [scheduleViewportUpdate]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = event.nativeEvent.contentOffset.y;
    scheduleViewportUpdate(scrollYRef.current);
  }, [scheduleViewportUpdate]);

  const navigate = useCallback((route: SectionCardRoute) => {
    router.push(route as never);
  }, [router]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      setIsForeground(next === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    updateNearViewport(scrollYRef.current);
  }, [updateNearViewport]);

  const screenMotionEnabled = isFocused && isForeground;
  const estimatedWidth = width - 32;

  return (
    <View style={s.root}>
      <ScrollView
          contentContainerStyle={s.content}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          // Visibility bookkeeping does not drive the animation itself. A
          // 160px pre-arm margin lets us sample at ~30Hz and keep twice as
          // many scroll events off the JS thread without exposing a still
          // card during a fling.
          scrollEventThrottle={32}
        >
          <ScreenTitleBar title={title} />
          <View style={s.quoteWrap}>
            <Text style={s.quote}>{quote}</Text>
            <Text style={s.ref}>{quoteReference}</Text>
          </View>

          <View
            onLayout={handleStackLayout}
            style={[s.cards, { paddingTop: cardsPaddingTop }]}
          >
            <RibbonMotionProvider active={screenMotionEnabled && nearViewportMask !== 0}>
              {cards.map((card, index) => (
                <MainRibbonCard
                  key={card.id}
                  card={card}
                  index={index}
                  active={screenMotionEnabled && (nearViewportMask & (1 << index)) !== 0}
                  estimatedWidth={estimatedWidth}
                  onFrameLayout={handleCardLayout}
                  onNavigate={navigate}
                />
              ))}
            </RibbonMotionProvider>
          </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { paddingBottom: 120 },
  quoteWrap: { paddingHorizontal: 26, paddingTop: 8, paddingBottom: 6, alignItems: 'center' },
  quote: { fontFamily: F.serifMediumItalic, fontSize: 17, color: C.textSecondary, lineHeight: 21.5, textAlign: 'center' },
  ref: { marginTop: 10, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.gold },
  cards: { paddingHorizontal: 16 },
});
