import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import SectionCard from '@/components/shared/SectionCard';
import { HOME_EXPLORE_SECTION_CARDS } from '@/components/shared/sectionCardData';
import { C, F } from '@/constants/tokens';

export default function ExploreSection() {
  const router = useRouter();

  return (
    <View style={s.wrap}>
      <Text style={s.heading}>Explore</Text>
      {HOME_EXPLORE_SECTION_CARDS.map(card => (
        <SectionCard
          key={card.id}
          {...card}
          onPress={() => router.push(card.route as any)}
        />
      ))}
    </View>
  );
}

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
