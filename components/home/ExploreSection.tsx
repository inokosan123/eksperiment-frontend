import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import RibbonSectionCard from '@/components/shared/RibbonSectionCard';
import { HOME_ORGANIZE_SECTION_CARDS } from '@/components/shared/sectionCardData';
import { C, F } from '@/constants/tokens';

export default function OrganizeSection() {
  const router = useRouter();

  return (
    <View style={s.wrap}>
      <Text style={s.heading}>Organize</Text>
      {HOME_ORGANIZE_SECTION_CARDS.map((card, i) => (
        <RibbonSectionCard
          key={card.id}
          {...card}
          index={i}
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
