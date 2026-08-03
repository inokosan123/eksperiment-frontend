import { memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import RibbonSectionCard from '@/components/shared/RibbonSectionCard';
import {
  HOME_ORGANIZE_SECTION_CARDS,
  type SectionCardConfig,
  type SectionCardRoute,
} from '@/components/shared/sectionCardData';
import { C, F } from '@/constants/tokens';

type OrganizeRibbonCardProps = {
  card: SectionCardConfig;
  index: number;
  active: boolean;
  estimatedWidth: number;
  onFrameLayout?: (index: number, event: LayoutChangeEvent) => void;
  onNavigate: (route: SectionCardRoute) => void;
};

const OrganizeRibbonCard = memo(function OrganizeRibbonCard({
  card,
  index,
  active,
  estimatedWidth,
  onFrameLayout,
  onNavigate,
}: OrganizeRibbonCardProps) {
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    onFrameLayout?.(index, event);
  }, [index, onFrameLayout]);
  const handlePress = useCallback(() => {
    onNavigate(card.route);
  }, [card.route, onNavigate]);

  return (
    <RibbonSectionCard
      {...card}
      index={index}
      active={active}
      readableCopy
      estimatedWidth={estimatedWidth}
      onFrameLayout={handleLayout}
      onPress={handlePress}
    />
  );
});

type Props = {
  motionEnabled?: boolean;
  activeMask?: number;
  onSectionLayout?: (event: LayoutChangeEvent) => void;
  onCardLayout?: (index: number, event: LayoutChangeEvent) => void;
};

function OrganizeSection({
  motionEnabled = true,
  activeMask = (1 << HOME_ORGANIZE_SECTION_CARDS.length) - 1,
  onSectionLayout,
  onCardLayout,
}: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const navigate = useCallback((route: SectionCardRoute) => {
    router.push(route as never);
  }, [router]);

  return (
    <View style={s.wrap} onLayout={onSectionLayout}>
      <Text style={s.heading}>Organize</Text>
      {HOME_ORGANIZE_SECTION_CARDS.map((card, i) => (
        <OrganizeRibbonCard
          key={card.id}
          card={card}
          index={i}
          active={motionEnabled && (activeMask & (1 << i)) !== 0}
          estimatedWidth={width - 40}
          onFrameLayout={onCardLayout}
          onNavigate={navigate}
        />
      ))}
    </View>
  );
}

export default memo(OrganizeSection);

const s = StyleSheet.create({
  wrap: {
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  heading: {
    fontFamily: F.serifMedium,
    fontSize: 20,
    color: C.text,
    marginBottom: 10,
  },
});
