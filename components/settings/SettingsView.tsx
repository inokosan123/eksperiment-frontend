import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BellOff,
  BookMarked,
  CalendarHeart,
  ChevronRight,
  Clock,
  Crown,
  Feather,
  Globe,
  Heart,
  ListChecks,
  Sparkles,
  Target,
  Trash2,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import ConfirmModal from '@/components/shared/ConfirmModal';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { useAppSettings } from '@/components/settings/SettingsContext';
import { normalizeScriptureLanguage, SCRIPTURE_LANGUAGE_DETAILS } from '@/constants/scripture';

const GOLD = C.gold;
const BG = '#FAF7F0';
const CARD_BG = '#FFFFFF';
const CARD_BORDER = '#EDE9E0';
const ROW_DIVIDER = '#F2EEE5';

// Shared motion hook (same pattern as GratitudeView's useChoiceMotion)
function useChoiceMotion(active: boolean) {
  const progress = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, { damping: 15, stiffness: 160, mass: 1 });
  }, [active, progress]);
  return progress;
}

// Primitives

function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View style={s.sectionLabel}>
      <View style={s.sectionLabelIcon}>{icon}</View>
      <Text style={s.sectionLabelText}>{title}</Text>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

function Divider({ inset = 16 }: { inset?: number }) {
  return <View style={[s.divider, { marginLeft: inset }]} />;
}

function RowIconBox({ children, tint }: { children: React.ReactNode; tint?: string }) {
  return (
    <View style={[s.rowIconBox, tint ? { backgroundColor: tint } : null]}>
      {children}
    </View>
  );
}

// Toggle (animated track + knob)

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  const progress = useChoiceMotion(enabled);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#E7E1D2', GOLD]),
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 20 }],
  }));

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChange(!enabled);
      }}
      activeOpacity={0.85}
      style={s.togglePress}
    >
      <Reanimated.View style={[s.toggleTrack, trackStyle]}>
        <Reanimated.View style={[s.toggleKnob, knobStyle]} />
      </Reanimated.View>
    </TouchableOpacity>
  );
}

// Pill selector

type PillOption = { value: string; label: string };

function PillSelector({
  label, value, options, onChange,
}: {
  label?: string;
  value: string;
  options: PillOption[];
  onChange: (v: string) => void;
}) {
  const spread = options.length === 3;
  return (
    <View style={s.pillSelector}>
      {!!label && <Text style={s.pillSelectorLabel}>{label}</Text>}
      <View style={[s.pillRow, spread && s.pillRowSpread]}>
        {options.map(opt => (
          <PillBtn
            key={opt.value}
            active={value === opt.value}
            label={opt.label}
            onPress={() => onChange(opt.value)}
            stretch={spread}
          />
        ))}
      </View>
    </View>
  );
}

function BibleLanguageSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.bibleLanguageSelector}>
      <Text style={s.pillSelectorLabel}>Bible language</Text>
      <View style={s.bibleLanguageList}>
        {LANGS.map(opt => {
          const details = SCRIPTURE_LANGUAGE_DETAILS[normalizeScriptureLanguage(opt.value)];
          return (
            <LanguageOptionCard
              key={opt.value}
              active={value === opt.value}
              label={details.name}
              code={details.label}
              version={details.version}
              onPress={() => onChange(opt.value)}
            />
          );
        })}
      </View>
    </View>
  );
}

function LanguageOptionCard({
  active,
  label,
  code,
  version,
  onPress,
}: {
  active: boolean;
  label: string;
  code: string;
  version: string;
  onPress: () => void;
}) {
  const progress = useChoiceMotion(active);
  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#FFFFFF', '#FFFBF2']),
    borderColor: interpolateColor(progress.value, [0, 1], ['#EDE9E0', GOLD]),
    transform: [{ scale: 1 + progress.value * 0.01 }],
  }));

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.88}
    >
      <Reanimated.View style={[s.languageOptionCard, animStyle]}>
        <View style={s.languageOptionCopy}>
          <View style={s.languageOptionTitleRow}>
            <Text style={[s.languageOptionName, active && s.languageOptionNameActive]}>{label}</Text>
            <Text style={[s.languageOptionCode, active && s.languageOptionCodeActive]}>{code}</Text>
          </View>
          <Text style={s.languageOptionVersion}>{version}</Text>
        </View>
        <View style={[s.languageOptionDot, active && s.languageOptionDotActive]} />
      </Reanimated.View>
    </TouchableOpacity>
  );
}

function PillBtn({
  active,
  label,
  onPress,
  stretch = false,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  stretch?: boolean;
}) {
  const progress = useChoiceMotion(active);

  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], ['#F6F4EE', GOLD]),
    borderColor: interpolateColor(progress.value, [0, 1], ['#EDE9E0', GOLD]),
    transform: [{ scale: 1 + progress.value * 0.02 }],
  }));

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.88}
      style={stretch ? s.pillBtnPressStretch : undefined}
    >
      <Reanimated.View style={[s.pillBtn, stretch && s.pillBtnStretch, animStyle]}>
        <Text style={[s.pillBtnText, active && s.pillBtnTextActive]} numberOfLines={1}>{label}</Text>
      </Reanimated.View>
    </TouchableOpacity>
  );
}

// Toggle row and action row

function ToggleRow({
  icon, label, sublabel, enabled, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={s.row}>
      <RowIconBox>{icon}</RowIconBox>
      <View style={s.rowCopy}>
        <Text style={s.rowLabel}>{label}</Text>
        {!!sublabel && <Text style={s.rowSub}>{sublabel}</Text>}
      </View>
      <Toggle enabled={enabled} onChange={onChange} />
    </View>
  );
}

function ActionRow({
  icon, label, sublabel, onPress, danger, accent,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
  accent?: boolean;
}) {
  const tint = danger ? '#FEE2E2' : accent ? 'rgba(197,160,89,0.14)' : undefined;
  return (
    <TouchableOpacity activeOpacity={0.85} style={s.row} onPress={onPress}>
      <RowIconBox tint={tint}>{icon}</RowIconBox>
      <View style={s.rowCopy}>
        <Text style={[s.rowLabel, danger && { color: '#DC2626' }]}>{label}</Text>
        {!!sublabel && <Text style={[s.rowSub, danger && { color: '#F87171' }]}>{sublabel}</Text>}
      </View>
      <ChevronRight s={16} c={danger ? '#F87171' : '#CFC8B8'} w={2} />
    </TouchableOpacity>
  );
}

// Constants for picker options

const LANGS: PillOption[] = [
  { value: 'en', label: 'English' },
  { value: 'sr', label: 'Serbian' },
  { value: 'ru', label: 'Russian' },
];

// Main view

export default function SettingsView() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useAppSettings();
  const {
    bibleLang,
    prayerLang,
    notifSpiritual,
    notifRoutine,
    notifReading,
    notifGratitude,
    notifHabits,
    notifJournal,
    notifChallenges,
    quietHours,
    dndEnabled,
  } = settings;
  const setBibleLang = (bibleLang: string) => updateSettings({ bibleLang });
  const setPrayerLang = (prayerLang: string) => updateSettings({ prayerLang });
  const setNotifSpiritual = (notifSpiritual: boolean) => updateSettings({ notifSpiritual });
  const setNotifRoutine = (notifRoutine: boolean) => updateSettings({ notifRoutine });
  const setNotifReading = (notifReading: boolean) => updateSettings({ notifReading });
  const setNotifGratitude = (notifGratitude: boolean) => updateSettings({ notifGratitude });
  const setNotifHabits = (notifHabits: boolean) => updateSettings({ notifHabits });
  const setNotifJournal = (notifJournal: boolean) => updateSettings({ notifJournal });
  const setNotifChallenges = (notifChallenges: boolean) => updateSettings({ notifChallenges });
  const setQuietHours = (quietHours: boolean) => updateSettings({ quietHours });
  const setDndEnabled = (dndEnabled: boolean) => updateSettings({ dndEnabled });

  const [showResetModal, setShowResetModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScreenTitleBar
        title="SETTINGS"
        showBack
        bg={BG}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 48, rowGap: 22 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Preferences */}
        <View>
          <SectionLabel icon={<Globe s={12} c={GOLD} w={2.2} />} title="Preferences" />
          <Card>
            <BibleLanguageSelector value={bibleLang} onChange={setBibleLang} />
            <Divider />
            <PillSelector label="Prayer language" value={prayerLang} options={LANGS} onChange={setPrayerLang} />
          </Card>
        </View>

        {/* Notifications */}
        <View>
          <SectionLabel icon={<Bell s={12} c={GOLD} w={2.2} />} title="Notifications" />
          <View style={{ rowGap: 10 }}>
            <Card>
              <ToggleRow
                icon={<Sparkles s={16} c={C.textSecondary} w={2} />}
                label="Spiritual Tasks"
                sublabel="Prayer, scripture practice, and spiritual rules"
                enabled={notifSpiritual}
                onChange={setNotifSpiritual}
              />
              <Divider inset={62} />
              <ToggleRow
                icon={<ListChecks s={16} c={C.textSecondary} w={2} />}
                label="Routine Tasks"
                sublabel="Daily routines and scheduled tasks"
                enabled={notifRoutine}
                onChange={setNotifRoutine}
              />
              <Divider inset={62} />
              <ToggleRow
                icon={<Target s={16} c={C.textSecondary} w={2} />}
                label="Challenges"
                sublabel="Challenge tasks and progress reminders"
                enabled={notifChallenges}
                onChange={setNotifChallenges}
              />
              <Divider inset={62} />
              <ToggleRow
                icon={<Activity s={16} c={C.textSecondary} w={2} />}
                label="Habits"
                sublabel="Habit reminders and streak checks"
                enabled={notifHabits}
                onChange={setNotifHabits}
              />
              <Divider inset={62} />
              <ToggleRow
                icon={<Feather s={16} c={C.textSecondary} w={2} />}
                label="Journal"
                sublabel="Daily entries and writing prompts"
                enabled={notifJournal}
                onChange={setNotifJournal}
              />
              <Divider inset={62} />
              <ToggleRow
                icon={<CalendarHeart s={16} c={C.textSecondary} w={2} />}
                label="Gratitude Tasks"
                sublabel="Gratitude check-ins and reflection prompts"
                enabled={notifGratitude}
                onChange={setNotifGratitude}
              />
              <Divider inset={62} />
              <ToggleRow
                icon={<BookMarked s={16} c={C.textSecondary} w={2} />}
                label="Reading Tasks"
                sublabel="Books, Bible reading, and reading sessions"
                enabled={notifReading}
                onChange={setNotifReading}
              />
            </Card>

            <Card>
              <ToggleRow
                icon={<BellOff s={16} c={C.textSecondary} w={2} />}
                label="Quiet Hours"
                sublabel="Pause Anasta notifications during your rest window"
                enabled={quietHours}
                onChange={setQuietHours}
              />
              {quietHours && (
                <Reanimated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
                  <Divider inset={62} />
                  <View style={s.quietRow}>
                    <Text style={s.quietLabel}>From</Text>
                    <View style={s.timePill}>
                      <Clock s={12} c={GOLD} w={2} />
                      <Text style={s.timePillText}>22:00</Text>
                    </View>
                    <Text style={s.quietLabel}>to</Text>
                    <View style={s.timePill}>
                      <Clock s={12} c={GOLD} w={2} />
                      <Text style={s.timePillText}>07:00</Text>
                    </View>
                  </View>
                </Reanimated.View>
              )}
              <Divider inset={62} />
              <ToggleRow
                icon={<BellOff s={16} c={C.textSecondary} w={2} />}
                label="Do Not Disturb"
                sublabel="Mute selected app notification groups during quiet hours"
                enabled={dndEnabled}
                onChange={setDndEnabled}
              />
            </Card>
          </View>
        </View>

        {/* Data */}
        <View>
          <SectionLabel icon={<Sparkles s={12} c={GOLD} w={2.2} />} title="Onboarding" />
          <Card>
            <ActionRow
              icon={<Sparkles s={16} c={C.textSecondary} w={2} />}
              label="Start Onboarding"
              sublabel="Open the onboarding flow for phone testing"
              accent
              onPress={() => router.push('/onboarding' as any)}
            />
          </Card>
        </View>

        {/* Data */}
        <View>
          <SectionLabel icon={<Crown s={12} c={GOLD} w={2.2} />} title="Data" />
          <Card>
            <ActionRow
              icon={<ArrowUpRight s={16} c={C.textSecondary} w={2} />}
              label="Export Data"
              sublabel="Back up all your local app data"
              onPress={() => setShowExportModal(true)}
            />
            <Divider inset={62} />
            <ActionRow
              icon={<Trash2 s={16} c="#DC2626" w={2} />}
              label="Reset All Data"
              sublabel="Delete everything permanently"
              danger
              onPress={() => setShowResetModal(true)}
            />
          </Card>
        </View>

        {/* About */}
        <View>
          <SectionLabel icon={<Heart s={12} c={GOLD} w={2.2} />} title="About" />
          <Card>
            <View style={s.aboutRow}>
              <RowIconBox><Crown s={16} c={C.textSecondary} w={2} /></RowIconBox>
              <Text style={[s.rowLabel, { flex: 1 }]}>App Version</Text>
              <Text style={s.aboutValue}>1.0.0</Text>
            </View>
            <Divider inset={62} />
            <View style={s.aboutRow}>
              <RowIconBox><Heart s={16} c={C.textSecondary} w={2} /></RowIconBox>
              <Text style={[s.rowLabel, { flex: 1 }]}>Contact</Text>
              <Text style={[s.aboutValue, { color: GOLD }]}>support@anasta.app</Text>
            </View>
          </Card>
        </View>

        <View style={s.footer}>
          <Text style={s.footerBrand}>ANASTA</Text>
          <Text style={s.footerCopy}>Made with love for the glory of God</Text>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={showExportModal}
        icon={<ArrowUpRight s={22} c={GOLD} w={2} />}
        iconBg="rgba(197,160,89,0.14)"
        title="Export app data?"
        body="This will prepare a local backup of your app data when export is connected."
        confirmLabel="EXPORT"
        confirmColor={GOLD}
        onCancel={() => setShowExportModal(false)}
        onConfirm={() => {
          setShowExportModal(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />

      <ConfirmModal
        visible={showResetModal}
        icon={<AlertTriangle s={22} c={C.red} w={2} />}
        iconBg="#FEE2E2"
        title="Reset all data?"
        body="This will permanently delete all your tasks, journal entries, annotations, and settings. This action cannot be undone."
        confirmLabel="RESET"
        confirmColor={C.red}
        onCancel={() => setShowResetModal(false)}
        onConfirm={() => {
          setShowResetModal(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }}
      />
    </View>
  );
}

// Styles

const s = StyleSheet.create({
  // Section label (uppercase gold eyebrow)
  sectionLabel: { flexDirection: 'row', alignItems: 'center', columnGap: 6, marginBottom: 8, marginLeft: 4 },
  sectionLabelIcon: { width: 14, alignItems: 'center', justifyContent: 'center' },
  sectionLabelText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: GOLD, textTransform: 'uppercase' },

  // Card wrapper
  card: { backgroundColor: CARD_BG, borderRadius: 20, borderWidth: 1, borderColor: CARD_BORDER, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: ROW_DIVIDER },

  // Row primitives
  row: { flexDirection: 'row', alignItems: 'center', columnGap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowIconBox: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#F6F4EE', alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { fontFamily: F.serifMedium, fontSize: 15, color: C.text },
  rowSub: { marginTop: 2, fontFamily: F.sans, fontSize: 11, color: C.textMuted },

  // Toggle
  togglePress: { padding: 2 },
  toggleTrack: { width: 44, height: 26, borderRadius: 13, padding: 3 },
  toggleKnob: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 3, elevation: 2,
  },

  // Pill selector
  pillSelector: { paddingVertical: 14, paddingHorizontal: 16 },
  pillSelectorLabel: { fontFamily: F.serifMedium, fontSize: 15, color: C.text, marginBottom: 10 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pillRowSpread: { flexWrap: 'nowrap' },
  pillBtnPressStretch: { flex: 1, minWidth: 0 },
  pillBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  pillBtnStretch: { minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  pillBtnText: { fontFamily: F.sansMedium, fontSize: 13, color: C.textSecondary, textAlign: 'center' },
  pillBtnTextActive: { color: '#FFFFFF', fontFamily: F.sansBold },
  bibleLanguageSelector: { paddingVertical: 14, paddingHorizontal: 16 },
  bibleLanguageList: { gap: 8 },
  languageOptionCard: {
    minHeight: 58,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  languageOptionCopy: { flex: 1, minWidth: 0 },
  languageOptionTitleRow: { flexDirection: 'row', alignItems: 'center', columnGap: 8 },
  languageOptionName: { fontFamily: F.serifMedium, fontSize: 16, lineHeight: 20, color: C.text },
  languageOptionNameActive: { color: '#8A682C' },
  languageOptionCode: {
    overflow: 'hidden',
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: '#F6F4EE',
    fontFamily: F.sansBold,
    fontSize: 8.5,
    letterSpacing: 1.2,
    color: '#B8B0A3',
  },
  languageOptionCodeActive: { backgroundColor: 'rgba(197,160,89,0.16)', color: GOLD },
  languageOptionVersion: { marginTop: 3, fontFamily: F.sansMedium, fontSize: 11, lineHeight: 15, color: C.textMuted },
  languageOptionDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#E7E1D2' },
  languageOptionDotActive: { backgroundColor: GOLD },

  // Time pill
  timePill: { flexDirection: 'row', alignItems: 'center', columnGap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(197,160,89,0.10)', borderWidth: 1, borderColor: 'rgba(197,160,89,0.30)' },
  timePillText: { fontFamily: F.sansBold, fontSize: 12, color: GOLD, letterSpacing: 0.6 },

  // Quiet hours
  quietRow: { flexDirection: 'row', alignItems: 'center', columnGap: 8, paddingLeft: 62, paddingRight: 16, paddingVertical: 12 },
  quietLabel: { fontFamily: F.sans, fontSize: 12, color: C.textMuted },

  // About
  aboutRow: { flexDirection: 'row', alignItems: 'center', columnGap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  aboutValue: { fontFamily: F.sans, fontSize: 13, color: C.textSecondary },

  // Footer
  footer: { alignItems: 'center', paddingTop: 4, paddingBottom: 4, rowGap: 4 },
  footerBrand: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 3, color: '#CFC8B8' },
  footerCopy: { fontFamily: F.serifMediumItalic, fontSize: 12, color: '#CFC8B8' },
});
