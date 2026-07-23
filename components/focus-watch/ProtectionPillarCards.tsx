import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import { Eye, Shield } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import { formatMinutesShort, type DayPlan } from './dayPlanStore';
import { PulseDot } from './FocusMeter';
import PlanCardBackdrop from './PlanCardBackdrop';
import { planVisualFor, planVisualForTheme, type PlanVisual } from './planVisuals';

type ScreenTimePlan = Pick<DayPlan, 'id' | 'name' | 'themeId' | 'essentialsOnly'>;

export type ScreenTimeProtectionCardProps = {
  plan: ScreenTimePlan | null;
  kicker?: string;
  statusText?: string | null;
  usedMinutes?: number | null;
  targetMinutes?: number | null;
  numbersColor?: string;
  value?: string | null;
  valueCaption?: string | null;
  valueColor?: string;
  live?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
};

export type WebProtectionCardState = 'on' | 'preview' | 'off';

export type WebProtectionCardProps = {
  state: WebProtectionCardState;
  packsOn: number;
  customSites: number;
  lockCaption: string;
  onPress: () => void;
  accessibilityLabel?: string;
};

export type WebProtectionHeroCardProps = {
  state: Exclude<WebProtectionCardState, 'off'>;
  title: string;
  body: string;
  packsOn: number;
  domainsReady: number;
  lockCaption: string;
};

const WEB_PROTECTION_VISUAL = {
  accent: '#2D7967',
  bloom: 'rgba(61,130,115,0.22)',
};

// One shared visual for the live Focus protection pillar and My Routine.
// Keeping the ornament and motion here means both surfaces evolve together.
function RadiantPlanSeal({ visual }: { visual: PlanVisual }) {
  const reduceMotion = useReducedMotion();
  const breathe = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      breathe.value = 0.6;
      return;
    }
    breathe.value = 0;
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
    return () => cancelAnimation(breathe);
  }, [breathe, reduceMotion]);

  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.4 + breathe.value * 0.6 }));
  const field = 92;
  const center = field / 2;
  const innerRadius = 29;

  return (
    <View style={s.sealStage}>
      <Animated.View pointerEvents="none" style={[s.sealGlow, { backgroundColor: visual.bloom }, glowStyle]} />
      <Svg pointerEvents="none" width={field} height={field} style={s.sealRays}>
        {Array.from({ length: 12 }).map((_, index) => {
          const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
          const long = index % 2 === 0;
          const rayEnd = innerRadius + (long ? 14 : 8);
          return (
            <Line
              key={index}
              x1={center + innerRadius * Math.cos(angle)}
              y1={center + innerRadius * Math.sin(angle)}
              x2={center + rayEnd * Math.cos(angle)}
              y2={center + rayEnd * Math.sin(angle)}
              stroke={visual.accent}
              strokeOpacity={long ? 0.4 : 0.22}
              strokeWidth={long ? 1.7 : 1.3}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
      <View style={[s.sealDisc, { borderColor: visual.border }]}>
        <View style={[s.sealDiscRing, { borderColor: visual.accent }]} />
        <Shield s={21} c={visual.accent} w={1.9} />
      </View>
      <View pointerEvents="none" style={[s.sealGlint, { backgroundColor: visual.accent }]} />
      <View pointerEvents="none" style={[s.sealGlintSmall, { backgroundColor: visual.accent }]} />
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function LatticeWeave({ color }: { color: string }) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const step = 30;
  const lineCount = box.width > 0 ? Math.ceil((box.width + box.height) / step) + 1 : 0;

  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        setBox({ width, height });
      }}
    >
      {lineCount > 0 && (
        <Svg width={box.width} height={box.height} style={StyleSheet.absoluteFill}>
          {Array.from({ length: lineCount }).map((_, index) => {
            const offset = index * step;
            return (
              <Line
                key={`a${index}`}
                x1={offset}
                y1={-4}
                x2={offset - box.height - 8}
                y2={box.height + 4}
                stroke={color}
                strokeOpacity={0.035}
                strokeWidth={1}
              />
            );
          })}
          {Array.from({ length: lineCount }).map((_, index) => {
            const offset = index * step;
            return (
              <Line
                key={`b${index}`}
                x1={box.width - offset}
                y1={-4}
                x2={box.width - offset + box.height + 8}
                y2={box.height + 4}
                stroke={color}
                strokeOpacity={0.035}
                strokeWidth={1}
              />
            );
          })}
        </Svg>
      )}
    </View>
  );
}

function GuardedSightEmblem({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  const patrol = useSharedValue(0);
  const animate = active && !reduceMotion;

  useEffect(() => {
    if (animate) {
      patrol.value = 0;
      patrol.value = withRepeat(withTiming(1, { duration: 11000, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(patrol);
      patrol.value = 0;
    }
    return () => cancelAnimation(patrol);
  }, [animate, patrol]);

  const sentinelProps = useAnimatedProps(() => {
    const angle = -Math.PI / 2 + patrol.value * Math.PI * 2;
    return { cx: 32 + 29 * Math.cos(angle), cy: 32 + 29 * Math.sin(angle) };
  });
  const counterProps = useAnimatedProps(() => {
    const angle = Math.PI / 2 + patrol.value * Math.PI * 2;
    return { cx: 32 + 29 * Math.cos(angle), cy: 32 + 29 * Math.sin(angle) };
  });

  return (
    <View style={s.webEmblemStage}>
      <View pointerEvents="none" style={[s.webEmblemGlow, active && s.webEmblemGlowOn]} />
      <Svg pointerEvents="none" width={64} height={64} style={StyleSheet.absoluteFill}>
        <Circle
          cx={32}
          cy={32}
          r={29}
          stroke="#2D7967"
          strokeOpacity={active ? 0.32 : 0.15}
          strokeWidth={1}
          fill="none"
          strokeDasharray={active ? undefined : '1 5'}
        />
        <Circle cx={32} cy={32} r={24.5} stroke="#2D7967" strokeOpacity={active ? 0.15 : 0.09} strokeWidth={1} fill="none" strokeDasharray="1 4" />
        {active && (
          <>
            <AnimatedCircle animatedProps={sentinelProps} r={2.1} fill="#2D7967" fillOpacity={0.55} />
            <AnimatedCircle animatedProps={counterProps} r={1.5} fill="#2D7967" fillOpacity={0.32} />
          </>
        )}
      </Svg>
      <View style={[s.webEmblemDisc, !active && s.webEmblemDiscOff]}>
        <Eye s={21} c={active ? '#2D7967' : 'rgba(45,121,103,0.6)'} w={1.9} />
        <Svg pointerEvents="none" width={42} height={42} style={StyleSheet.absoluteFill}>
          {[
            { y: 9, x1: 6.3, x2: 35.7 },
            { y: 13.5, x1: 3.9, x2: 38.1 },
            { y: 18, x1: 2.7, x2: 39.3 },
          ].map(line => (
            <Line
              key={line.y}
              x1={line.x1}
              y1={line.y}
              x2={line.x2}
              y2={line.y}
              stroke="#2D7967"
              strokeOpacity={active ? 0.38 : 0.2}
              strokeWidth={1.3}
              strokeLinecap="round"
              strokeDasharray={active ? undefined : '2 4'}
            />
          ))}
        </Svg>
      </View>
    </View>
  );
}

export function ScreenTimeProtectionCard({
  plan,
  kicker = 'TODAY’S PLAN',
  statusText,
  usedMinutes = null,
  targetMinutes = null,
  numbersColor = C.text,
  value,
  valueCaption,
  valueColor = C.text,
  live = false,
  onPress,
  accessibilityLabel,
}: ScreenTimeProtectionCardProps) {
  const visual = plan ? planVisualFor(plan) : planVisualForTheme('stone');
  const essentialsOnly = !!plan?.essentialsOnly;
  const showSpent = usedMinutes != null || (!essentialsOnly && targetMinutes != null);

  return (
    <View style={s.pillarBlock}>
      <Text style={s.pillarLabel}>SCREEN TIME</Text>
      <TouchableOpacity
        style={[s.todayCard, { borderColor: visual.border }]}
        activeOpacity={0.86}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <LinearGradient colors={visual.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <PlanCardBackdrop visual={visual} ringSize={128} live={live} />
        <View style={s.todayHeroRow}>
          <RadiantPlanSeal visual={visual} />
          <View style={s.todayCopy}>
            <Text style={[s.todayKicker, { color: visual.accent }]}>{kicker}</Text>
            <Text style={[s.todayName, { color: visual.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {plan?.name ?? 'Rest day'}
            </Text>
            {!!statusText && (
              <Text style={[s.todayStatus, { color: visual.body }]} numberOfLines={1}>
                {statusText}
              </Text>
            )}
            {showSpent && (
              <View style={s.todaySpentRow}>
                {!essentialsOnly && targetMinutes != null && (
                  <View style={[s.todaySpentRail, { backgroundColor: visual.track }]}>
                    <View
                      style={[
                        s.todaySpentFill,
                        {
                          backgroundColor: numbersColor,
                          width: usedMinutes
                            ? Math.max(4, Math.min(1, usedMinutes / targetMinutes) * 46)
                            : 0,
                        },
                      ]}
                    />
                  </View>
                )}
                <Text numberOfLines={1}>
                  <Text style={[s.todaySpentValue, { color: numbersColor }]}>
                    {usedMinutes == null ? '– –' : formatMinutesShort(usedMinutes)}
                  </Text>
                  <Text style={[s.todaySpentMeta, { color: visual.body }]}>
                    {!essentialsOnly && targetMinutes != null
                      ? ` of ${formatMinutesShort(targetMinutes)}`
                      : ' today'}
                  </Text>
                </Text>
              </View>
            )}
          </View>
          {value != null && (
            <View style={s.todayValueBlock}>
              <Text style={[s.todayValue, { color: valueColor }]} numberOfLines={1}>{value}</Text>
              {!!valueCaption && (
                <Text style={[s.todayValueCaption, { color: visual.body }]} numberOfLines={1}>{valueCaption}</Text>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

export function WebProtectionCard({
  state,
  packsOn,
  customSites,
  lockCaption,
  onPress,
  accessibilityLabel,
}: WebProtectionCardProps) {
  const active = state !== 'off';

  return (
    <View style={s.pillarBlock}>
      <Text style={s.pillarLabel}>WEB PROTECTION</Text>
      <TouchableOpacity
        style={[s.webCard, !active && s.webCardOff]}
        activeOpacity={0.86}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? (
          active
            ? 'Web Protection is standing guard. Open Clean Sight.'
            : 'Web Protection is resting. Open Clean Sight.'
        )}
      >
        <LinearGradient
          colors={!active
            ? ['#EDF3F0', '#FBFDFC', '#FFFFFF']
            : ['#E6F3EC', '#F9FCFA', '#FEFFFE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LatticeWeave color="#2D7967" />
        <View pointerEvents="none" style={[s.webBloom, active && s.webBloomOn]} />
        <View style={s.webHeroRow}>
          <View style={s.webCopy}>
            <Text style={s.webKicker}>CLEAN SIGHT</Text>
            <Text style={[s.webName, !active && s.webNameOff]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {active ? 'Standing guard' : 'The guard is resting'}
            </Text>
            <Text style={s.webStatusLine} numberOfLines={1}>
              {packsOn} {packsOn === 1 ? 'pack' : 'packs'} · {customSites} custom {customSites === 1 ? 'site' : 'sites'} blocked
            </Text>
          </View>
          <GuardedSightEmblem active={active} />
        </View>
        <View style={s.webRule}>
          <View style={s.webRuleLine} />
          <View style={s.webRuleCross}>
            <View style={s.webRuleCrossH} />
            <View style={s.webRuleCrossV} />
          </View>
          <View style={s.webRuleLine} />
        </View>
        <View style={s.webStateRow}>
          {state === 'on' ? (
            <PulseDot size={5} color="#2C7565" />
          ) : (
            <View style={[s.webStateDot, state === 'preview' && s.webStateDotPreview]} />
          )}
          <Text style={[
            s.webStateText,
            state === 'preview' && s.webStateTextPreview,
            state === 'off' && s.webStateTextOff,
          ]}>
            {state === 'on' ? 'ON' : state === 'preview' ? 'PREVIEW' : 'OFF'}
          </Text>
          <Text style={s.webStateCaption} numberOfLines={1}>{lockCaption}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export function WebProtectionHeroCard({
  state,
  title,
  body,
  packsOn,
  domainsReady,
  lockCaption,
}: WebProtectionHeroCardProps) {
  const live = state === 'on';

  return (
    <View style={s.heroShell}>
      <View style={s.heroCard}>
        <LinearGradient
          colors={['#E6F3EC', '#F6FBF8', '#FEFFFE']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <PlanCardBackdrop visual={WEB_PROTECTION_VISUAL} ringSize={218} live={live} />
        <LatticeWeave color="#2D7967" />
        <View pointerEvents="none" style={s.heroShieldWatermark}>
          <Shield s={168} c="#2D7967" w={1.05} />
        </View>

        <View style={s.heroTopRow}>
          <View style={s.heroCopy}>
            <View style={s.heroIdentityRow}>
              <Text style={s.heroKicker}>CLEAN SIGHT</Text>
              <View style={[s.heroStateBadge, !live && s.heroStateBadgePreview]}>
                {live ? (
                  <PulseDot size={5} color="#2C7565" />
                ) : (
                  <View style={s.heroPreviewDot} />
                )}
                <Text style={[s.heroStateText, !live && s.heroStateTextPreview]}>
                  {live ? 'ON' : 'PREVIEW'}
                </Text>
              </View>
            </View>
            <Text selectable style={s.heroTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.84}>
              {title}
            </Text>
            <Text selectable style={s.heroBody} numberOfLines={3}>
              {body}
            </Text>
          </View>
          <View style={s.heroEmblem}>
            <GuardedSightEmblem active />
          </View>
        </View>

        <View style={s.heroRule}>
          <View style={s.heroRuleLine} />
          <View style={s.heroRuleCross}>
            <View style={s.heroRuleCrossH} />
            <View style={s.heroRuleCrossV} />
          </View>
          <View style={s.heroRuleLine} />
        </View>

        <View style={s.heroMetricsSurface}>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.94)', 'rgba(239,249,245,0.82)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={s.heroMetricsHighlight} />
          <View style={s.heroMetric}>
            <Text selectable style={s.heroMetricValue}>{packsOn}</Text>
            <Text style={s.heroMetricLabel}>{packsOn === 1 ? 'active pack' : 'active packs'}</Text>
          </View>
          <View style={s.heroMetricDivider} />
          <View style={s.heroMetric}>
            <Text selectable style={s.heroMetricValue}>{domainsReady}</Text>
            <Text style={s.heroMetricLabel}>{domainsReady === 1 ? 'domain ready' : 'domains ready'}</Text>
          </View>
        </View>

        <View style={s.heroFooter}>
          {live ? <PulseDot size={5} color="#2C7565" /> : <View style={s.heroPreviewDot} />}
          <Text style={[s.heroFooterState, !live && s.heroStateTextPreview]}>
            {live ? 'PROTECTION ACTIVE' : 'PROTECTION PREVIEW'}
          </Text>
          <Text style={s.heroFooterCaption} numberOfLines={1}>{lockCaption}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  pillarBlock: { marginTop: 14 },
  pillarLabel: { marginBottom: 7, marginLeft: 2, fontFamily: F.sansBold, fontSize: 9.5, letterSpacing: 2, color: C.textMuted },
  todayCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: 15,
    paddingTop: 13,
    paddingBottom: 13,
    boxShadow: '0 6px 16px rgba(57, 48, 34, 0.07)',
  },
  todayHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 66 },
  sealStage: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center' },
  sealGlow: { position: 'absolute', left: 4, top: 4, width: 58, height: 58, borderRadius: 29 },
  sealRays: { position: 'absolute', left: -13, top: -13 },
  sealDisc: {
    width: 47,
    height: 47,
    borderRadius: 23.5,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  sealDiscRing: { position: 'absolute', left: 3.5, top: 3.5, right: 3.5, bottom: 3.5, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, opacity: 0.45 },
  sealGlint: { position: 'absolute', right: 6, top: 7, width: 5.5, height: 5.5, borderRadius: 1.5, opacity: 0.72, transform: [{ rotate: '45deg' }] },
  sealGlintSmall: { position: 'absolute', left: 7, bottom: 9, width: 3.2, height: 3.2, borderRadius: 1, opacity: 0.5, transform: [{ rotate: '45deg' }] },
  todayCopy: { flex: 1, minWidth: 0 },
  todayKicker: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.8 },
  todayName: { marginTop: 2.5, fontFamily: F.serifSemiBold, fontSize: 21, lineHeight: 25, letterSpacing: -0.25 },
  todayStatus: { marginTop: 2.5, fontFamily: F.serif, fontSize: 13.5, lineHeight: 17 },
  todayValueBlock: { maxWidth: 104, alignItems: 'flex-end' },
  todayValue: { fontFamily: F.serifSemiBold, fontSize: 19, fontVariant: ['tabular-nums'] },
  todayValueCaption: { marginTop: 1.5, fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.1 },
  todaySpentRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 7, minWidth: 0 },
  todaySpentRail: { width: 46, height: 3, borderRadius: 1.5, overflow: 'hidden' },
  todaySpentFill: { height: 3, borderRadius: 1.5 },
  todaySpentValue: { fontFamily: F.serifSemiBold, fontSize: 14.5, fontVariant: ['tabular-nums'] },
  todaySpentMeta: { fontFamily: F.serif, fontSize: 12.5 },
  webCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#B7D8CA',
    paddingHorizontal: 15,
    paddingTop: 13,
    paddingBottom: 13,
    boxShadow: '0 6px 16px rgba(34, 61, 51, 0.07)',
  },
  webCardOff: { borderColor: '#CFDCD5', boxShadow: '0 4px 12px rgba(34, 61, 51, 0.05)' },
  webBloom: { position: 'absolute', right: -30, top: -38, width: 118, height: 118, borderRadius: 59, backgroundColor: 'rgba(61,130,115,0.07)' },
  webBloomOn: { backgroundColor: 'rgba(61,130,115,0.15)' },
  webHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64 },
  webCopy: { flex: 1, minWidth: 0 },
  webKicker: { fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.8, color: '#2D7967' },
  webName: { marginTop: 2.5, fontFamily: F.serifSemiBold, fontSize: 21, lineHeight: 25, letterSpacing: -0.25, color: '#1F4E45' },
  webNameOff: { color: 'rgba(31,78,69,0.72)' },
  webStatusLine: { marginTop: 2.5, fontFamily: F.serif, fontSize: 13.5, lineHeight: 17, color: '#3D8273' },
  webEmblemStage: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  webEmblemGlow: { position: 'absolute', left: 5, top: 5, width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(61,130,115,0.06)' },
  webEmblemGlowOn: { backgroundColor: 'rgba(61,130,115,0.16)' },
  webEmblemDisc: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#B7D8CA',
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#12271F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  webEmblemDiscOff: { backgroundColor: 'rgba(255,255,255,0.62)', borderColor: 'rgba(183,216,202,0.72)', shadowOpacity: 0.05, elevation: 1 },
  webRule: { marginTop: 10, marginBottom: 9, flexDirection: 'row', alignItems: 'center', gap: 7 },
  webRuleLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#CBE0D5' },
  webRuleCross: { width: 7, height: 7, alignItems: 'center', justifyContent: 'center' },
  webRuleCrossH: { position: 'absolute', width: 7, height: 1, borderRadius: 0.5, backgroundColor: '#2D7967', opacity: 0.65 },
  webRuleCrossV: { position: 'absolute', width: 1, height: 7, borderRadius: 0.5, backgroundColor: '#2D7967', opacity: 0.65 },
  webStateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  webStateDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(42,110,95,0.4)' },
  webStateDotPreview: { backgroundColor: '#7866A4' },
  webStateText: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.2, color: '#2C7565' },
  webStateTextPreview: { color: '#65548E' },
  webStateTextOff: { color: 'rgba(31,78,69,0.55)' },
  webStateCaption: { flex: 1, textAlign: 'right', fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.1, color: '#3D8273' },
  heroShell: {
    borderRadius: 28,
    borderCurve: 'continuous',
    backgroundColor: C.surface,
    boxShadow: '0 14px 34px rgba(31, 78, 69, 0.14)',
  },
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 248,
    borderRadius: 28,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#A9D0C0',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  heroShieldWatermark: { position: 'absolute', right: -32, top: 50, opacity: 0.055, transform: [{ rotate: '4deg' }] },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  heroCopy: { flex: 1, minWidth: 0, paddingTop: 1 },
  heroIdentityRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 9 },
  heroKicker: { fontFamily: F.sansBold, fontSize: 9.5, lineHeight: 13, letterSpacing: 2, color: '#2D7967' },
  heroStateBadge: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: '#B9DACD', backgroundColor: 'rgba(239,249,245,0.90)', paddingHorizontal: 8, paddingVertical: 4 },
  heroStateBadgePreview: { borderColor: '#D3CBE4', backgroundColor: 'rgba(246,242,251,0.92)' },
  heroPreviewDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#7866A4' },
  heroStateText: { fontFamily: F.sansBold, fontSize: 8.5, lineHeight: 11, letterSpacing: 1.2, color: '#2C7565' },
  heroStateTextPreview: { color: '#65548E' },
  heroTitle: { marginTop: 7, fontFamily: F.serifSemiBold, fontSize: 27, lineHeight: 29, letterSpacing: -0.35, color: '#183F37' },
  heroBody: { marginTop: 4, maxWidth: 250, fontFamily: F.serifMedium, fontSize: 14.5, lineHeight: 18.5, color: '#4E746A' },
  heroEmblem: { width: 66, height: 68, alignItems: 'center', justifyContent: 'center' },
  heroRule: { marginTop: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroRuleLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(72,139,124,0.30)' },
  heroRuleCross: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  heroRuleCrossH: { position: 'absolute', width: 8, height: 1, borderRadius: 0.5, backgroundColor: '#2D7967', opacity: 0.72 },
  heroRuleCrossV: { position: 'absolute', width: 1, height: 8, borderRadius: 0.5, backgroundColor: '#2D7967', opacity: 0.72 },
  heroMetricsSurface: { position: 'relative', overflow: 'hidden', minHeight: 57, flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(45,121,103,0.20)', backgroundColor: 'rgba(255,255,255,0.88)', paddingHorizontal: 10, paddingVertical: 9, boxShadow: '0 6px 18px rgba(31,78,69,0.09)' },
  heroMetricsHighlight: { position: 'absolute', left: 14, right: 14, top: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.96)' },
  heroMetric: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'center', gap: 5 },
  heroMetricValue: { fontFamily: F.serifSemiBold, fontSize: 21, lineHeight: 23, color: '#183F37', fontVariant: ['tabular-nums'] },
  heroMetricLabel: { flexShrink: 1, fontFamily: F.serifMedium, fontSize: 13.5, lineHeight: 17, color: '#4E746A', textAlign: 'center' },
  heroMetricDivider: { width: StyleSheet.hairlineWidth, height: 29, backgroundColor: 'rgba(45,121,103,0.22)' },
  heroFooter: { marginTop: 10, minHeight: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroFooterState: { fontFamily: F.sansBold, fontSize: 8.5, letterSpacing: 1.15, color: '#2C7565' },
  heroFooterCaption: { flex: 1, textAlign: 'right', fontFamily: F.sansBold, fontSize: 8, letterSpacing: 1.1, color: '#3D8273' },
});
