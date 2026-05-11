import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {
  Activity, Book, Candle, CheckSmall, CircleIcon, Clock, Cross,
  Feather, Flame, Heart, Home, Moon, Skip, Sparkles, Sun, Target, Utensils,
} from '@/components/icons/Icons';
import { F } from '@/constants/tokens';
import { NotoEmoji } from '@/components/shared/NotoEmoji';
import { HABIT_SVG } from '@/components/shared/notoEmoji/habits';
import { normalizeHabitIcon } from '@/components/shared/notoEmoji/legacyMap';

export type TaskVariant = 'spiritual' | 'routine' | 'quick' | 'habit' | 'challenge' | 'gratitude' | 'reading';
export type TaskState = 'pending' | 'active' | 'done' | 'skipped' | 'locked';

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const safe = normalized.length === 3 ? normalized.split('').map(char => `${char}${char}`).join('') : normalized;
  const v = Number.parseInt(safe, 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export type TaskData = {
  variant: TaskVariant;
  title: string;
  time?: string;
  subtitle?: string;
  state: TaskState;
  type?: 'prayer' | 'reading' | 'journal' | 'church' | 'gratitude' | 'custom';
  habitColor?: string;
  habitIconName?: string;
};

const TYPE_COLORS = {
  prayer:  { bg: 'rgba(197,160,89,0.14)', fg: '#A8853C', border: 'rgba(197,160,89,0.22)' },
  reading: { bg: '#FEE2E2', fg: '#DC2626', border: 'rgba(239,68,68,0.25)' },
  journal: { bg: '#E7E5E4', fg: '#57534E', border: 'rgba(168,162,158,0.4)' },
  church:  { bg: '#E7E5E4', fg: '#44403C', border: 'rgba(168,162,158,0.4)' },
  gratitude: { bg: '#FFE4E6', fg: '#E11D48', border: 'rgba(244,63,94,0.25)' },
  custom:  { bg: '#E5E7EB', fg: '#6B7280', border: 'rgba(156,163,175,0.4)' },
};

type BadgeIcon = React.ComponentType<{ s?: number; c?: string; w?: number }>;

const ICONS: Record<string, BadgeIcon> = {
  Activity, Book, Candle, Cross, Feather, Heart, Home, Moon, Sparkles, Sun, Target, Utensils,
};

const TYPE_ICONS: Record<string, keyof typeof ICONS> = {
  prayer: 'Sun', reading: 'Book', journal: 'Feather', church: 'Cross', gratitude: 'Heart', custom: 'Sparkles',
};

function badgeIconKey(name: string | undefined): keyof typeof ICONS | undefined {
  if (!name) return undefined;
  if (name in ICONS) return name as keyof typeof ICONS;

  switch (name) {
    case 'sun':
      return 'Sun';
    case 'moon':
      return 'Moon';
    case 'cross':
      return 'Cross';
    case 'sparkles':
      return 'Sparkles';
    case 'book':
    case 'openBook':
    case 'bookMarked':
      return 'Book';
    case 'feather':
      return 'Feather';
    case 'notebook':
      return 'Feather';
    case 'calendarCheck':
      return 'Book';
    default:
      return undefined;
  }
}

function StreakBadge({ count }: { count?: number }) {
  if (!count || count < 2) return null;
  return (
    <View style={sb.wrap}>
      <Flame s={10} filled color="#F97316" />
      <Text style={sb.txt}>{count}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9999, backgroundColor: '#FFF7ED', flexShrink: 0 },
  txt: { fontSize: 10, fontFamily: F.sansSemiBold, color: '#F97316' },
});

function TaskCheck({ variant, state, size, habitColor }: { variant: TaskVariant; state: TaskState; size: number; habitColor?: string }) {
  const isDone = state === 'done';
  const isSkipped = state === 'skipped';
  const isLocked = state === 'locked';

  let bg = '#fff', borderColor = '#d6d3d1', borderWidth = 2;
  let iconColor = '#d6d3d1';

  if (isLocked) {
    bg = '#f5f5f4'; borderColor = '#e7e5e4'; iconColor = '#d6d3d1';
  } else if (isSkipped) {
    bg = '#f5f5f4'; borderColor = '#d6d3d1'; iconColor = '#a8a29e';
  } else if (isDone) {
    const fillColor =
      variant === 'habit' ? (habitColor || '#C5A059') :
      variant === 'gratitude' ? '#F43F5E' :
      variant === 'quick' || variant === 'routine' ? '#1c1917' : '#C5A059';
    bg = fillColor; borderColor = fillColor; iconColor = '#fff';
  } else {
    if (variant === 'habit') { borderColor = (habitColor || '#C5A059') + '60'; }
    else if (variant === 'routine') { borderColor = 'rgba(28,25,23,0.28)'; borderWidth = 1.5; }
    else if (variant === 'challenge') { borderColor = 'rgba(197,160,89,0.55)'; borderWidth = 2.5; }
    else if (variant === 'gratitude') { borderColor = 'rgba(244,63,94,0.45)'; }
    else { borderColor = 'rgba(197,160,89,0.4)'; }
  }

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderWidth, borderColor, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {isDone && <CheckSmall s={size * 0.52} c="#fff" w={2.8} />}
      {isSkipped && <Skip s={size * 0.44} c={iconColor} w={2.4} />}
      {(isLocked || (!isDone && !isSkipped)) && <CircleIcon s={size * 0.56} c={iconColor} w={2} />}
    </View>
  );
}

function isNotoIconName(name: string | undefined): boolean {
  if (!name) return false;
  if (name in HABIT_SVG) return true;
  // Legacy emoji glyphs ('🙏' etc) get normalized to a Noto name.
  return /\p{Extended_Pictographic}/u.test(name);
}

function TypeBadge({ variant, type, habitColor, habitIconName }: { variant: TaskVariant; type?: string; habitColor?: string; habitIconName?: string }) {
  if (variant === 'habit') {
    const color = habitColor || '#C5A059';
    const isLucide = !!habitIconName && !!ICONS[habitIconName];
    const isNoto = !isLucide && isNotoIconName(habitIconName);
    const HIcon = ICONS[habitIconName || 'Heart'] ?? Heart;
    return (
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 13,
          backgroundColor: hexToRgba(color, 0.12),
          borderWidth: 1,
          borderColor: hexToRgba(color, 0.20),
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isNoto ? (
          <NotoEmoji name={normalizeHabitIcon(habitIconName)} size={22} />
        ) : (
          <HIcon s={17} c={color} />
        )}
      </View>
    );
  }
  if (variant === 'routine' && habitIconName) {
    const normalizedIcon = badgeIconKey(habitIconName);
    const isLucide = !!normalizedIcon;
    const isNoto = !isLucide && isNotoIconName(habitIconName);
    const RIcon = normalizedIcon ? ICONS[normalizedIcon] : Sparkles;
    return (
      <View style={{ padding: 9, borderRadius: 10, backgroundColor: '#ECEAE8', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isNoto ? (
          <NotoEmoji name={normalizeHabitIcon(habitIconName)} size={20} />
        ) : (
          <RIcon s={18} c="#1C1917" />
        )}
      </View>
    );
  }
  if (variant === 'challenge') {
    const iconName = badgeIconKey(habitIconName) ?? (type ? TYPE_ICONS[type] : undefined);
    const CIcon = (iconName ? ICONS[iconName] : null) ?? Sparkles;
    return (
      <View style={{ padding: 8, borderRadius: 11, backgroundColor: 'rgba(197,160,89,0.14)', borderWidth: 1, borderColor: 'rgba(197,160,89,0.22)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <CIcon s={17} c="#A8853C" />
      </View>
    );
  }
  if (variant === 'reading') {
    return (
      <View style={{ padding: 8, borderRadius: 11, backgroundColor: '#F4EBDC', borderWidth: 1, borderColor: 'rgba(146,116,82,0.30)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Book s={17} c="#9C7C4F" />
      </View>
    );
  }
  if (variant === 'spiritual') {
    // Spiritual tasks (prayer / scripture / journal / church / custom) keep
    // their per-type icon shape (Sun, Book, Feather, Cross, Sparkles) but
    // share one uniform gold/cream "spiritual" badge so the whole spiritual
    // family reads as one visual category in lists.
    const iconKey = badgeIconKey(habitIconName) ?? (type ? TYPE_ICONS[type] : undefined);
    const SIcon = (iconKey ? ICONS[iconKey] : null) ?? Sparkles;
    return (
      <View style={{ padding: 8, borderRadius: 11, backgroundColor: 'rgba(197,160,89,0.14)', borderWidth: 1, borderColor: 'rgba(197,160,89,0.22)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <SIcon s={17} c="#A8853C" />
      </View>
    );
  }
  if (!type || type === 'custom') return null;
  const ct = TYPE_COLORS[type as keyof typeof TYPE_COLORS];
  const iconName = TYPE_ICONS[type];
  const Icon = iconName ? ICONS[iconName] : Sparkles;
  const isRoutine = variant === 'routine';
  return (
    <View style={{ padding: isRoutine ? 7 : 8, borderRadius: isRoutine ? 9 : 11, backgroundColor: ct.bg, borderWidth: 1, borderColor: ct.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon s={isRoutine ? 16 : 17} c={ct.fg} />
    </View>
  );
}

function TaskTitle({ title, variant, state }: { title: string; variant: TaskVariant; state: TaskState }) {
  const isDone = state === 'done', isSkipped = state === 'skipped';
  let color = '#1c1917';
  if (isSkipped) color = '#a8a29e';
  else if (isDone) color =
    (variant === 'spiritual' || variant === 'challenge') ? 'rgba(120,83,20,0.45)' :
    variant === 'routine' ? 'rgba(28,25,23,0.3)' : '#a8a29e';
  else if (variant === 'spiritual') color = '#451a03';
  else if (variant === 'gratitude') color = '#7F1D35';

  const lineColor = (variant === 'spiritual' || variant === 'challenge')
    ? 'rgba(197,160,89,0.55)'
    : 'rgba(28,25,23,0.42)';

  // Animated strike: progress 0→1 draws a line left→right over the title.
  // We need the *rendered* text width — capped by the available container.
  // A hidden absolute-positioned Text without flex constraints gives the
  // intrinsic width; the visible Text fills the flex slot. The strike uses
  // min(intrinsic, container) so it stops at the last glyph (or at the
  // ellipsis edge when the title overflows).
  const progress = useSharedValue(isDone || isSkipped ? 1 : 0);
  const previousState = useRef(state);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const drawWidth = Math.min(naturalWidth, containerWidth);

  useEffect(() => {
    const becameStruck = (isDone || isSkipped) && previousState.current !== state;
    const becameClear = !isDone && !isSkipped && previousState.current !== state;
    previousState.current = state;

    if (becameStruck) {
      // Skipped is instant; done draws across slowly so it lines up with
      // the celebratory burst before the row dims to "inactive".
      progress.value = 0;
      progress.value = withTiming(1, {
        duration: isSkipped ? 260 : 1150,
        easing: Easing.out(Easing.cubic),
      });
    } else if (becameClear) {
      progress.value = withTiming(0, { duration: 200 });
    }
  }, [isDone, isSkipped, progress, state]);

  const lineStyle = useAnimatedStyle(() => ({
    width: drawWidth * progress.value,
    opacity: progress.value < 0.05 ? 0 : 1,
  }));

  const handleNaturalLayout = (event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    if (Math.abs(w - naturalWidth) > 0.5) setNaturalWidth(w);
  };

  const handleContainerLayout = (event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    if (Math.abs(w - containerWidth) > 0.5) setContainerWidth(w);
  };

  return (
    <View
      onLayout={handleContainerLayout}
      style={{ flexShrink: 1, minWidth: 0, position: 'relative' }}
    >
      {/* Hidden measurement text: absolute + no flex parent → renders at
          intrinsic width regardless of how wide the card is. */}
      <Text
        onLayout={handleNaturalLayout}
        style={{
          position: 'absolute',
          opacity: 0,
          fontFamily: F.serifMedium,
          fontSize: 17,
          lineHeight: 20,
        }}
      >
        {title}
      </Text>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        style={{
          fontFamily: F.serifMedium,
          fontSize: 17,
          color,
          lineHeight: 20,
        }}
      >
        {title}
      </Text>
      {drawWidth > 0 && (
        <Reanimated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 10,
              height: 1.2,
              borderRadius: 1,
              backgroundColor: lineColor,
            },
            lineStyle,
          ]}
        />
      )}
    </View>
  );
}

function TaskMeta({ time, subtitle, variant, habitColor, state }: { time?: string; subtitle?: string; variant: TaskVariant; habitColor?: string; state: TaskState }) {
  let c =
    (variant === 'spiritual' || variant === 'challenge') ? 'rgba(197,160,89,0.75)' :
    variant === 'gratitude' ? 'rgba(225,29,72,0.78)' :
    variant === 'routine' ? 'rgba(28,25,23,0.45)' :
    variant === 'habit' ? ((habitColor || '#C5A059') + 'DD') : '#a8a29e';
  if (state === 'done' || state === 'skipped') c = '#a8a29e';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, minWidth: 0, overflow: 'hidden' }}>
      {time && (
        <>
          <View style={{ flexShrink: 0 }}>
            <Clock s={9} c={c} />
          </View>
          <Text style={{ fontFamily: F.sansBold, fontSize: 10.5, color: c, flexShrink: 0 }}>{time}</Text>
          <Text style={{ color: c, opacity: 0.65, fontSize: 10 }}>•</Text>
        </>
      )}
      {subtitle && <Text style={{ fontFamily: F.sansMedium, fontSize: 9.5, color: c, letterSpacing: 0.8, textTransform: 'uppercase', flexShrink: 1, minWidth: 0 }} numberOfLines={1} ellipsizeMode="tail">{subtitle}</Text>}
    </View>
  );
}

export function SpiritualTaskCard({ task, streak }: { task: TaskData; streak?: number }) {
  return (
    <LinearGradient colors={['#FFFBEB', '#ffffff']} start={{ x: 0.135, y: 0 }} end={{ x: 0.865, y: 1 }} style={[cs.base, { borderColor: 'rgba(197,160,89,0.3)', borderRadius: 16, marginBottom: 4 }]}>
      <TaskCheck variant="spiritual" state={task.state} size={34} />
      <View style={cs.mid}>
        <TaskTitle title={task.title} variant="spiritual" state={task.state} />
        <TaskMeta time={task.time} subtitle={task.subtitle} variant="spiritual" state={task.state} />
      </View>
      <StreakBadge count={streak} />
      <TypeBadge variant="spiritual" type={task.type} habitIconName={task.habitIconName} />
    </LinearGradient>
  );
}

export function RoutineTaskCard({ task, streak }: { task: TaskData; streak?: number }) {
  const isDimmed = task.state === 'done' || task.state === 'skipped';
  return (
    <LinearGradient
      colors={['#F2F1EF', '#FFFFFF']}
      start={{ x: 0.135, y: 0 }}
      end={{ x: 0.865, y: 1 }}
      style={[cs.base, { borderColor: 'rgba(28,25,23,0.18)', borderRadius: 16, marginBottom: 4, opacity: isDimmed ? 0.7 : 1 }]}
    >
      <TaskCheck variant="routine" state={task.state} size={32} />
      <View style={cs.mid}>
        <TaskTitle title={task.title} variant="routine" state={task.state} />
        <TaskMeta time={task.time} subtitle={task.subtitle} variant="routine" state={task.state} />
      </View>
      <StreakBadge count={streak} />
      <TypeBadge variant="routine" type={task.type} habitIconName={task.habitIconName} />
    </LinearGradient>
  );
}

export function QuickTaskCard({ task }: { task: TaskData }) {
  return (
    <LinearGradient colors={['#fff', '#F0FDF4']} start={{ x: 0.135, y: 0 }} end={{ x: 0.865, y: 1 }} style={[cs.base, { borderColor: 'rgba(28,25,23,0.2)', borderRadius: 16, marginBottom: 4 }]}>
      <TaskCheck variant="quick" state={task.state} size={32} />
      <View style={cs.mid}>
        <TaskTitle title={task.title} variant="quick" state={task.state} />
        <TaskMeta subtitle="Quick Task" variant="quick" state={task.state} time={task.time} />
      </View>
    </LinearGradient>
  );
}

export function HabitTaskCard({ task, streak }: { task: TaskData; streak?: number }) {
  const habitColor = task.habitColor || '#C5A059';
  const isSkipped = task.state === 'skipped';
  const isDone = task.state === 'done';
  // Two layered gradients form a distinctive "color spotlight" pattern:
  //   1. Bottom diagonal — color blooms from bottom-right corner only (most of
  //      the card stays pure white, color anchors the emoji badge area).
  //   2. Top overlay — vertical fade from a faint top tint down to nothing,
  //      adding a soft "halo from above" without flooding the whole card.
  // Together they look like sun light hitting paper from one direction —
  // different from the simple corner-to-corner fade used elsewhere.
  const baseAlpha = isSkipped ? 0 : (isDone ? 0.04 : 0.10);
  const topAlpha = isSkipped ? 0 : (isDone ? 0.015 : 0.04);
  const accentColor = isSkipped ? '#D1D5DB' : habitColor;
  return (
    <View
      style={[
        cs.base,
        {
          backgroundColor: '#FFFFFF',
          borderColor: hexToRgba(habitColor, isSkipped ? 0.10 : 0.20),
          borderRadius: 20,
          marginBottom: 4,
          overflow: 'hidden',
          shadowColor: '#1C1917',
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
          elevation: 1,
        },
      ]}
    >
      {/* Layer 1 — bottom-right "spotlight" (most of card white, color blooms in corner) */}
      <LinearGradient
        colors={['#FFFFFF', '#FFFFFF', hexToRgba(habitColor, baseAlpha)]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={cs.habitGradientLayer}
        pointerEvents="none"
      />
      {/* Layer 2 — soft top tint that fades to nothing partway down */}
      <LinearGradient
        colors={[hexToRgba(habitColor, topAlpha), 'rgba(255,255,255,0)']}
        locations={[0, 0.55]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={cs.habitGradientLayer}
        pointerEvents="none"
      />
      {/* Distinctive habit-only ornament: small color "L" corners */}
      <View style={[cs.habitCornerRibbonTop, { backgroundColor: accentColor }]} />
      <View style={[cs.habitCornerRibbonBottom, { backgroundColor: accentColor, opacity: 0.55 }]} />
      <TaskCheck variant="habit" state={task.state} size={32} habitColor={habitColor} />
      <View style={cs.mid}>
        <TaskTitle title={task.title} variant="habit" state={task.state} />
        <TaskMeta time={task.time} subtitle={task.subtitle} variant="habit" habitColor={habitColor} state={task.state} />
      </View>
      <StreakBadge count={streak} />
      <TypeBadge variant="habit" habitColor={habitColor} habitIconName={task.habitIconName} />
    </View>
  );
}

export function ReadingTaskCard({ task, streak }: { task: TaskData; streak?: number }) {
  const isSkipped = task.state === 'skipped';
  const isDone = task.state === 'done';
  const dimmed = isDone || isSkipped;
  return (
    <LinearGradient
      colors={isSkipped ? ['#FFFFFF', '#FAFAFA'] : ['#FFFFFF', '#F4EBDC']}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[
        cs.base,
        {
          borderColor: isSkipped ? 'rgba(120,113,108,0.18)' : 'rgba(146,116,82,0.30)',
          borderRadius: 16,
          marginBottom: 4,
          overflow: 'hidden',
          opacity: dimmed ? 0.85 : 1,
          shadowColor: '#1C1917',
          shadowOpacity: 0.05,
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 6,
          elevation: 1,
        },
      ]}
    >
      {/* Distinctive reading ornament: a "book spine" tucked at left edge,
          inset top + bottom so it reads as a closed-book sliver, not a hard bar. */}
      <View style={[cs.readingSpineOuter, { backgroundColor: isSkipped ? '#D6D3D1' : '#9C7C4F' }]} />
      <View style={[cs.readingSpineInner, { backgroundColor: isSkipped ? '#E7E5E4' : '#C5A059' }]} />
      <TaskCheck variant="routine" state={task.state} size={32} />
      <View style={cs.mid}>
        <TaskTitle title={task.title} variant="routine" state={task.state} />
        <TaskMeta time={task.time} subtitle={task.subtitle} variant="routine" state={task.state} />
      </View>
      <StreakBadge count={streak} />
      <TypeBadge variant="reading" type="reading" />
    </LinearGradient>
  );
}

export function ChallengeTaskCard({ task, streak }: { task: TaskData; streak?: number }) {
  return (
    <LinearGradient colors={['#FFFDF7', '#ffffff']} start={{ x: 0.135, y: 0 }} end={{ x: 0.865, y: 1 }} style={[cs.base, { borderColor: 'rgba(197,160,89,0.35)', borderLeftWidth: 5, borderLeftColor: '#C5A059', borderRightWidth: 5, borderRightColor: '#C5A059', borderRadius: 22, marginBottom: 4 }]}>
      <TaskCheck variant="challenge" state={task.state} size={34} />
      <View style={cs.mid}>
        <TaskTitle title={task.title} variant="challenge" state={task.state} />
        <TaskMeta time={task.time} subtitle={task.subtitle} variant="challenge" state={task.state} />
      </View>
      <StreakBadge count={streak} />
      <TypeBadge variant="challenge" type={task.type} habitIconName={task.habitIconName} />
    </LinearGradient>
  );
}

export function GratitudeTaskCard({ task, streak }: { task: TaskData; streak?: number }) {
  const isDimmed = task.state === 'done' || task.state === 'skipped' || task.state === 'locked';
  return (
    <LinearGradient
      colors={['#FFEDF2', '#FFF7F8']}
      start={{ x: 0.135, y: 0 }}
      end={{ x: 0.865, y: 1 }}
      style={[
        cs.base,
        {
          borderColor: 'rgba(244,63,94,0.18)',
          borderRadius: 16,
          marginBottom: 4,
          opacity: isDimmed && task.state === 'locked' ? 0.72 : 1,
        },
      ]}
    >
      <TaskCheck variant="gratitude" state={task.state} size={34} />
      <View style={cs.mid}>
        <TaskTitle title={task.title} variant="gratitude" state={task.state} />
        <TaskMeta time={task.time} subtitle={task.subtitle} variant="gratitude" state={task.state} />
      </View>
      <StreakBadge count={streak} />
      <TypeBadge variant="gratitude" type="gratitude" />
    </LinearGradient>
  );
}

export function AnyTaskCard({ task, streak }: { task: TaskData; streak?: number }) {
  switch (task.variant) {
    case 'spiritual':  return <SpiritualTaskCard task={task} streak={streak} />;
    case 'routine':    return <RoutineTaskCard task={task} streak={streak} />;
    case 'quick':      return <QuickTaskCard task={task} />;
    case 'habit':      return <HabitTaskCard task={task} streak={streak} />;
    case 'challenge':  return <ChallengeTaskCard task={task} streak={streak} />;
    case 'gratitude':  return <GratitudeTaskCard task={task} streak={streak} />;
    case 'reading':    return <ReadingTaskCard task={task} streak={streak} />;
    default:           return <RoutineTaskCard task={task} streak={streak} />;
  }
}

const cs = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderWidth: 1,
  },
  mid: { flex: 1, minWidth: 0, overflow: 'hidden' },
  habitBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  // Distinctive habit-only ornament: small color "L" corners that wrap inside
  // the card, top-left and bottom-right. Reads as a frame indicator rather
  // than a hard edge bar — different geometry from other task cards.
  habitGradientLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Reading "book spine" — two parallel inset bars suggesting a closed-book edge.
  readingSpineOuter: {
    position: 'absolute',
    left: 5,
    top: 8,
    bottom: 8,
    width: 2,
    borderRadius: 1,
  },
  readingSpineInner: {
    position: 'absolute',
    left: 9,
    top: 12,
    bottom: 12,
    width: 1,
    borderRadius: 0.5,
    opacity: 0.7,
  },
  habitCornerRibbonTop: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 14,
    height: 2,
    borderRadius: 1,
  },
  habitCornerRibbonBottom: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 14,
    height: 2,
    borderRadius: 1,
  },
});
