import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, Sun, Notebook, Book, Feather } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

const EXPLORE_THEMES = {
  blue:  { bg: '#EEEAF5', border: '#DDD5ED', labelC: '#6D5AAE', titleC: '#3B2F76', bodyC: '#6D5AAE', arrowBg: '#2E2478' },
  amber: { bg: '#FBF3DE', border: '#F0E3B8', labelC: '#A9863F', titleC: '#6D4F13', bodyC: '#A9863F', arrowBg: '#8A5A1A' },
  red:   { bg: '#FBE6E9', border: '#F5CDD3', labelC: '#B54155', titleC: '#7F1B2D', bodyC: '#B54155', arrowBg: '#8C2636' },
  stone: { bg: '#EFEEEB', border: '#DEDCD6', labelC: '#5b564f', titleC: '#1c1917', bodyC: '#5b564f', arrowBg: '#1c1917' },
};

const CARDS = [
  { label: 'RULE OF PRAYER',  title: 'Prayer Book', description: 'Morning, evening, and mealtime prayers to guide your rhythm of life.', theme: 'blue',  Icon: Sun     },
  { label: 'SELF-CORRECTION', title: 'Notes',        description: 'Quick thoughts and reflections throughout the day.',                    theme: 'amber', Icon: Notebook },
  { label: 'BIBLE & PSALTER', title: 'Scripture',    description: 'The divinely inspired Word of God.',                                    theme: 'red',   Icon: Book    },
  { label: 'REFLECT',         title: 'Journal',      description: 'Capture your daily thoughts and spiritual progress.',                   theme: 'stone', Icon: Feather  },
];

export default function ExploreSection() {
  return (
    <View style={s.wrap}>
      <Text style={s.heading}>Explore</Text>
      {CARDS.map((card, i) => {
        const th = EXPLORE_THEMES[card.theme as keyof typeof EXPLORE_THEMES];
        return (
          <TouchableOpacity
            key={i}
            activeOpacity={0.85}
            style={[s.card, { backgroundColor: th.bg, borderColor: th.border }]}
          >
            {/* Beli gradient odozgo — isti efekat kao na SectionCard */}
            <LinearGradient
              colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />

            {/* Original decor veličina */}
            <View style={s.decorWrap} pointerEvents="none">
              <card.Icon s={56} c={th.labelC} w={1.3} />
            </View>

            <View style={s.content}>
              <Text style={[s.label, { color: th.labelC }]}>{card.label}</Text>
              <Text style={[s.title, { color: th.titleC }]}>{card.title}</Text>
              <Text style={[s.desc, { color: th.bodyC }]}>{card.description}</Text>
            </View>

            <View style={[s.arrow, { backgroundColor: th.arrowBg }]}>
              <ArrowUpRight s={15} c="#fff" w={2.6} />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingTop: 22, paddingHorizontal: 20, paddingBottom: 8 },
  heading: { fontFamily: F.serifMedium, fontSize: 20, color: C.text, marginBottom: 10 },
  card: {
    position: 'relative',
    padding: 16,
    paddingBottom: 52,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
    minHeight: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  decorWrap: {
    position: 'absolute',
    right: 12,
    top: 12,
    opacity: 0.16,
  },
  content: { paddingRight: 80 },
  label: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4 },
  title: { fontFamily: F.serifMedium, fontSize: 22, marginTop: 4, lineHeight: 26 },
  desc: { fontFamily: F.sans, fontSize: 12, marginTop: 5, lineHeight: 17 },
  arrow: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
});
