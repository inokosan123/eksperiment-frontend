import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line } from 'react-native-svg';
import { CalendarCheck, ChevronRight } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';

// ONE card, everywhere. This row appears at the foot of Scripture, Prayer
// Book, Journal and Ideal Self, and it used to come in two registers — a
// "scripture" one that had been detailed and a "soft" one that had not — so
// the same button looked like two different buttons depending on where you
// met it. It is now a single element with no variants: change it here and it
// changes on all four screens, which is the point of it being shared.
//
// The look is Scripture's, because that is where it was worked out: a
// parchment plaque under a double rule, a faint ruling of light behind the
// copy, a haloed icon and a chevron in its own ghost seat. Everything is
// drawn inside the component — nothing is passed in — so no caller can end
// up with a different card by forgetting an argument.

type Props = {
  onPress: () => void;
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  textMaxFontSizeMultiplier?: number;
};

// The door motif from the Scripture shelf: a fall of light raked across the
// plate's right side, well under the copy.
function CardMotif() {
  const W = 150;
  const H = 96;
  return (
    <View pointerEvents="none" style={s.motifAnchor}>
      <Svg width={W} height={H}>
        {Array.from({ length: 5 }).map((_, index) => {
          const offset = index * 24;
          return (
            <Line
              key={index}
              x1={W - offset}
              y1={-6}
              x2={W - offset - 54}
              y2={H + 6}
              stroke="#B49B67"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
          );
        })}
      </Svg>
    </View>
  );
}

export default function SetAsDailyTaskCard({
  onPress,
  title = 'Set as Daily Task',
  subtitle = 'Add to your daily routine',
  style,
  textMaxFontSizeMultiplier = 1.08,
}: Props) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.84} style={style}>
      <LinearGradient
        colors={['#FFFDF8', '#FFF7EA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={s.card}
      >
        <CardMotif />
        {/* The double rule: a firmer line with a finer one just inside it. */}
        <View pointerEvents="none" style={s.frame} />
        <View pointerEvents="none" style={s.frameInner} />
        {/* The plate catches the light along its top edge. */}
        <View pointerEvents="none" style={s.litEdge} />

        <View style={s.iconSeat}>
          <View pointerEvents="none" style={s.haloOuter} />
          <View style={s.iconCore}>
            <CalendarCheck s={15} c={C.gold} />
          </View>
        </View>

        <View style={s.copy}>
          <Text
            style={s.title}
            allowFontScaling={false}
            maxFontSizeMultiplier={textMaxFontSizeMultiplier}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            {title}
          </Text>
          <Text
            style={s.subtitle}
            allowFontScaling={false}
            numberOfLines={1}
            maxFontSizeMultiplier={textMaxFontSizeMultiplier}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            {subtitle}
          </Text>
        </View>

        <View style={s.chevronSeat}>
          <ChevronRight s={15} c="#BCA476" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    // 64 and a 14pt gutter: the Scripture doors use both, and this card sits
    // in their column.
    minHeight: 64,
    gap: 14,
    borderRadius: 19,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.26)',
    paddingHorizontal: 14,
    paddingVertical: 11,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.045,
    shadowRadius: 14,
    elevation: 1,
  },
  motifAnchor: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  frame: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.2)',
  },
  frameInner: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.11)',
  },
  litEdge: {
    position: 'absolute',
    top: 1,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  // The doors' halo seat: a white ring at 34 holding a toned core, with the
  // nimbus around it. It overflows the ring by 5 a side, hence the visible
  // overflow.
  iconSeat: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.38)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'visible',
  },
  haloOuter: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
  },
  iconCore: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(197,160,89,0.10)',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 2,
  },
  title: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0,
    color: '#2B2723',
  },
  subtitle: {
    marginTop: 2,
    fontFamily: F.serif,
    fontSize: 12.5,
    lineHeight: 16,
    color: '#9F9890',
  },
  chevronSeat: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(180,155,103,0.28)',
    backgroundColor: 'rgba(255,255,255,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
