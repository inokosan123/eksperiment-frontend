import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import SectionCard from '@/components/shared/SectionCard';
import { INNER_SECTION_CARDS } from '@/components/shared/sectionCardData';
import { C, F } from '@/constants/tokens';

export default function InnerLifeView() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitleBar title="INNER LIFE" />
        <View style={s.quoteWrap}>
          <Text style={s.quote}>{'"The Kingdom of God is within you."'}</Text>
          <Text style={s.ref}>LUKE 17:21</Text>
        </View>

        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          {INNER_SECTION_CARDS.map(card => (
            <SectionCard
              key={card.id}
              {...card}
              onPress={() => router.push(card.route as any)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  quoteWrap: { paddingHorizontal: 26, paddingTop: 8, paddingBottom: 6, alignItems: 'center' },
  quote: { fontFamily: F.serifMediumItalic, fontSize: 17, color: C.textSecondary, lineHeight: 21.5, textAlign: 'center' },
  ref: { marginTop: 10, fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: C.gold },
});
