import type { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarCheck, ChevronRight } from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


type Variant = 'soft' | 'scripture';

type Props = {
  onPress: () => void;
  variant?: Variant;
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  textMaxFontSizeMultiplier?: number;
  /**
   * A background light drawn inside the card, behind its contents. Scripture
   * hands its own door motif in so this card carries the same faint ruling as
   * the doors it sits beneath; nothing else passes one.
   */
  ornament?: ReactNode;
  /**
   * The plate's corner registration marks. Scripture passes its own so all
   * four of its doors are finished the same way; nothing else passes any.
   */
  corners?: ReactNode;
};

export default function SetAsDailyTaskCard({
  onPress,
  variant = 'soft',
  title = 'Set as Daily Task',
  subtitle = 'Add to your daily routine',
  style,
  textMaxFontSizeMultiplier = 1.08,
  ornament,
  corners,
}: Props) {
  const scripture = variant === 'scripture';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.84} style={style}>
      <LinearGradient
        colors={scripture ? ['#FFFDF8', '#FFF7EA'] : ['#FFFBF2', '#FFF8E7']}
        start={{ x: 0, y: scripture ? 0 : 0 }}
        end={{ x: scripture ? 0 : 1, y: 1 }}
        style={[s.base, scripture ? s.scriptureBase : s.softBase]}
      >
        {/* In Scripture this card stands last in a row of doors, so it wears
            what they wear: the same faint motif, the ruled inner frame, the
            corner registration and the lit top edge. Without them it read as
            the one plain plaque in a set of four. */}
        {scripture && (
          <>
            {ornament}
            <View pointerEvents="none" style={s.scriptureFrame} />
            {corners}
            <View pointerEvents="none" style={s.litEdge} />
          </>
        )}
        <View style={[s.iconBase, scripture ? s.scriptureIconBase : s.softIconBase]}>
          {scripture ? (
            <>
              <View pointerEvents="none" style={s.scriptureHaloOuter} />
              <View style={s.scriptureIconCore}>
                <CalendarCheck s={15} c={C.gold} />
              </View>
            </>
          ) : (
            <CalendarCheck s={20} c={C.gold} />
          )}
        </View>

        <View style={s.copy}>
          <Text
            style={[s.titleBase, scripture ? s.scriptureTitle : s.softTitle]}
            allowFontScaling={false}
            maxFontSizeMultiplier={textMaxFontSizeMultiplier}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            {title}
          </Text>
          <Text
            style={[s.subtitleBase, scripture ? s.scriptureSubtitle : s.softSubtitle]}
            allowFontScaling={false}
            numberOfLines={scripture ? 1 : 2}
            maxFontSizeMultiplier={textMaxFontSizeMultiplier}
            adjustsFontSizeToFit={scripture}
            minimumFontScale={0.82}
          >
            {subtitle}
          </Text>
        </View>

        {/* Scripture seats its chevron in a ghost ring, as its doors do. */}
        <View style={[s.chevronSlot, scripture && s.scriptureChevronSeat]}>
          <ChevronRight s={15} c={scripture ? '#BCA476' : 'rgba(197,160,89,0.4)'} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  softBase: {
    gap: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(232,220,196,0.7)',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  scriptureBase: {
    // 64 and a 14pt gutter: the doors above use both, and this card sits in
    // their column.
    minHeight: 64,
    gap: 14,
    borderRadius: 19,
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
  scriptureFrame: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
  },
  litEdge: {
    position: 'absolute',
    top: 1,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  scriptureChevronSeat: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(180,155,103,0.28)',
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  iconBase: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  softIconBase: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(197,160,89,0.1)',
  },
  // The doors' halo seat, to the point: a white ring at 34 holding a toned
  // core. This was a squarer 15-radius plaque, which read as a different
  // family from the three icons directly above it.
  scriptureIconBase: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.38)',
    backgroundColor: '#FFFFFF',
    // The nimbus overflows this ring by 5 on every side.
    overflow: 'visible',
  },
  scriptureHaloOuter: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.16)',
  },
  scriptureIconCore: {
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
  chevronSlot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleBase: {
    color: '#374151',
  },
  softTitle: {
    fontFamily: F.sansSemiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  scriptureTitle: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0,
    color: '#2B2723',
  },
  subtitleBase: {
    marginTop: 2,
    color: '#9CA3AF',
  },
  softSubtitle: {
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 16,
  },
  scriptureSubtitle: {
    fontFamily: F.serif,
    fontSize: 12.5,
    lineHeight: 16,
    color: '#9F9890',
  },
});
