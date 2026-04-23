import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Activity, Book, Candle, CheckSmall, CircleIcon, Clock, Cross,
  Feather, Flame, Heart, Home, Moon, Skip, Sparkles, Sun, Target, Utensils,
} from '@/components/icons/Icons';
import { F } from '@/constants/tokens';

export type TaskVariant = 'spiritual' | 'routine' | 'quick' | 'habit' | 'challenge';
export type TaskState = 'pending' | 'active' | 'done' | 'skipped' | 'locked';

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
  prayer:  { bg: '#F5E6C8', fg: '#9A7426', border: 'rgba(197,160,89,0.3)' },
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
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 9999, backgroundColor: '#FFF7ED' },
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
      variant === 'quick' || variant === 'routine' ? '#1c1917' : '#C5A059';
    bg = fillColor; borderColor = fillColor; iconColor = '#fff';
  } else {
    if (variant === 'habit') { borderColor = (habitColor || '#C5A059') + '60'; }
    else if (variant === 'routine') { borderColor = '#e7e5e4'; borderWidth = 1; }
    else if (variant === 'challenge') { borderColor = 'rgba(197,160,89,0.55)'; borderWidth = 2.5; }
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

function TypeBadge({ variant, type, habitColor, habitIconName }: { variant: TaskVariant; type?: string; habitColor?: string; habitIconName?: string }) {
  if (variant === 'habit') {
    const HIcon = ICONS[habitIconName || 'Heart'] ?? Heart;
    return (
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: (habitColor || '#C5A059') + '1F', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <HIcon s={16} c={habitColor || '#C5A059'} />
      </View>
    );
  }
  if (variant === 'routine' && habitIconName) {
    const RIcon = ICONS[habitIconName] ?? Sparkles;
    return (
      <View style={{ padding: 8, borderRadius: 9, backgroundColor: '#F5F4F0', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <RIcon s={16} c="#78716C" />
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
  else if (isDone) color = (variant === 'spiritual' || variant === 'challenge') ? 'rgba(120,83,20,0.45)' : '#a8a29e';
  else if (variant === 'spiritual') color = '#451a03';

  return (
    <Text
      numberOfLines={1}
      style={{
        fontFamily: F.serifMedium,
        fontSize: variant === 'spiritual' ? 17 : 15.5,
        color,
        lineHeight: variant === 'spiritual' ? 21 : 19,
        textDecorationLine: (isDone || isSkipped) ? 'line-through' : 'none',
        textDecorationColor: isDone && (variant === 'spiritual' || variant === 'challenge') ? 'rgba(197,160,89,0.3)' : '#d6d3d1',
      }}
    >
      {title}
    </Text>
  );
}

function TaskMeta({ time, subtitle, variant, habitColor, state }: { time?: string; subtitle?: string; variant: TaskVariant; habitColor?: string; state: TaskState }) {
  let c =
    (variant === 'spiritual' || variant === 'challenge') ? 'rgba(197,160,89,0.75)' :
    variant === 'habit' ? ((habitColor || '#C5A059') + 'DD') : '#a8a29e';
  if (state === 'done' || state === 'skipped') c = '#a8a29e';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
      {time && (
        <>
          <Clock s={9} c={c} />
          <Text style={{ fontFamily: F.sansBold, fontSize: 10.5, color: c }}>{time}</Text>
          <Text style={{ color: c, opacity: 0.65, fontSize: 10 }}>•</Text>
        </>
      )}
      {subtitle && <Text style={{ fontFamily: F.sansMedium, fontSize: 9.5, color: c, letterSpacing: 0.8, textTransform: 'uppercase' }} numberOfLines={1}>{subtitle}</Text>}
    </View>
  );
}

export function SpiritualTaskCard({ task, streak }: { task: TaskData; streak?: number }) {
  return (
    <LinearGradient colors={['#FFFBEB', '#ffffff']} start={{ x: 0.135, y: 0 }} end={{ x: 0.865, y: 1 }} style={[cs.base, { borderColor: 'rgba(197,160,89,0.3)', borderRadius: 16, marginBottom: 10 }]}>
      <TaskCheck variant="spiritual" state={task.state} size={38} />
      <View style={cs.mid}>
        <TaskTitle title={task.title} variant="spiritual" state={task.state} />
        <TaskMeta time={task.time} subtitle={task.subtitle} variant="spiritual" state={task.state} />
      </View>
      <StreakBadge count={streak} />
      <TypeBadge variant="spiritual" type={task.type} />
    </LinearGradient>
  );
}

export function RoutineTaskCard({ task, streak }: { task: TaskData; streak?: number }) {
  const isDimmed = task.state === 'done' || task.state === 'skipped';
  return (
    <View style={[cs.base, { backgroundColor: isDimmed ? 'rgba(249,250,251,0.7)' : '#fff', borderColor: '#f2f1ec', borderRadius: 16, marginBottom: 10 }]}>
      <TaskCheck variant="routine" state={task.state} size={36} />
      <View style={cs.mid}>
        <TaskTitle title={task.title} variant="routine" state={task.state} />
        <TaskMeta time={task.time} subtitle={task.subtitle} variant="routine" state={task.state} />
      </View>
      <StreakBadge count={streak} />
      <TypeBadge variant="routine" type={task.type} />
    </View>
  );
}

export function QuickTaskCard({ task }: { task: TaskData }) {
  return (
    <LinearGradient colors={['#fff', '#F0FDF4']} start={{ x: 0.135, y: 0 }} end={{ x: 0.865, y: 1 }} style={[cs.base, { borderColor: 'rgba(28,25,23,0.2)', borderRadius: 16, marginBottom: 10 }]}>
      <TaskCheck variant="quick" state={task.state} size={36} />
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
  return (
    <View style={[cs.base, { backgroundColor: '#fff', borderColor: '#f2f1ec', borderRadius: 16, marginBottom: 10, paddingLeft: 18, overflow: 'hidden' }]}>
      <View style={[cs.habitBar, { backgroundColor: isSkipped ? '#d1d5db' : habitColor }]} />
      <TaskCheck variant="habit" state={task.state} size={36} habitColor={habitColor} />
      <View style={cs.mid}>
        <TaskTitle title={task.title} variant="habit" state={task.state} />
        <TaskMeta time={task.time} subtitle={task.subtitle} variant="habit" habitColor={habitColor} state={task.state} />
      </View>
      <StreakBadge count={streak} />
      <TypeBadge variant="habit" habitColor={habitColor} habitIconName={task.habitIconName} />
    </View>
  );
}

export function ChallengeTaskCard({ task, streak }: { task: TaskData; streak?: number }) {
  return (
    <LinearGradient colors={['#FFFDF7', '#ffffff']} start={{ x: 0.135, y: 0 }} end={{ x: 0.865, y: 1 }} style={[cs.base, { borderColor: 'rgba(197,160,89,0.35)', borderLeftWidth: 5, borderLeftColor: '#C5A059', borderRightWidth: 5, borderRightColor: '#C5A059', borderRadius: 22, marginBottom: 10 }]}>
      <TaskCheck variant="challenge" state={task.state} size={38} />
      <View style={cs.mid}>
        <TaskTitle title={task.title} variant="challenge" state={task.state} />
        <TaskMeta time={task.time} subtitle={task.subtitle} variant="challenge" state={task.state} />
      </View>
      <StreakBadge count={streak} />
      <TypeBadge variant="challenge" type={task.type} />
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
    default:           return <RoutineTaskCard task={task} streak={streak} />;
  }
}

const cs = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderWidth: 1,
  },
  mid: { flex: 1, minWidth: 0 },
  habitBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
});
