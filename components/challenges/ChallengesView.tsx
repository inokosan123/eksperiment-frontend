import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import {
  ArrowUpRight,
  Book,
  BookMarked,
  CalendarCheck,
  CheckSmall,
  ChevronDown,
  Cross,
  Feather,
  Flame,
  Moon,
  Notebook,
  OpenBook,
  Pause,
  Play,
  Sparkles,
  Sun,
  Trash2,
  X,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { useChallenges } from './ChallengesContext';
import {
  ChallengeCatalogEntry,
  ChallengeIconKey,
  ChallengeRecord,
  ChallengeTab,
  GROUP_LABELS,
  GROUP_ORDER,
  TAB_ACTIVE_COLORS,
} from './challengeData';

function getTone(category: ChallengeRecord['category'] | ChallengeCatalogEntry['category']) {
  switch (category) {
    case 'prayer':
      return {
        accent: '#C58A2D',
        soft: '#FFF7EA',
        border: '#F1D6A4',
        text: '#8B5E13',
        iconBg: '#FEF3D9',
      };
    case 'journal':
      return {
        accent: '#8B5CF6',
        soft: '#F5F1FF',
        border: '#DDD0FF',
        text: '#6D28D9',
        iconBg: '#EEE8FF',
      };
    case 'church':
      return {
        accent: '#2F8A62',
        soft: '#EEF9F2',
        border: '#CEEBDD',
        text: '#17603F',
        iconBg: '#E0F3E8',
      };
    case 'scripture':
    default:
      return {
        accent: '#C5A059',
        soft: '#FFFCF3',
        border: '#E9D8B1',
        text: '#8B6B2F',
        iconBg: '#F9EFD6',
      };
  }
}

function getCategoryBadge(category: ChallengeRecord['category'] | ChallengeCatalogEntry['category']) {
  switch (category) {
    case 'prayer':
      return { label: 'Prayer', text: '#C58A2D', bg: '#FFF6E8' };
    case 'journal':
      return { label: 'Journal', text: '#8B5CF6', bg: '#F4EEFF' };
    case 'church':
      return { label: 'Church', text: '#2F8A62', bg: '#EAF8F1' };
    case 'scripture':
    default:
      return { label: 'Scripture', text: '#2C9AEF', bg: '#EDF7FF' };
  }
}

function ChallengeIcon({
  icon,
  size = 18,
  color = C.gold,
}: {
  icon: ChallengeIconKey;
  size?: number;
  color?: string;
}) {
  switch (icon) {
    case 'sun':
      return <Sun s={size} c={color} />;
    case 'moon':
      return <Moon s={size} c={color} />;
    case 'sparkles':
      return <Sparkles s={size} c={color} />;
    case 'book':
      return <Book s={size} c={color} />;
    case 'openBook':
      return <OpenBook s={size} c={color} />;
    case 'bookMarked':
      return <BookMarked s={size} c={color} />;
    case 'calendarCheck':
      return <CalendarCheck s={size} c={color} />;
    case 'feather':
      return <Feather s={size} c={color} />;
    case 'notebook':
      return <Notebook s={size} c={color} />;
    case 'cross':
      return <Cross s={size} c={color} />;
    default:
      return <Book s={size} c={color} />;
  }
}

function TabPill({
  active,
  label,
  color,
  onPress,
}: {
  active: boolean;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.84}
      style={[
        s.tabPill,
        active ? { backgroundColor: color, borderColor: color } : null,
      ]}
    >
      <Text style={[s.tabText, active ? s.tabTextActive : null]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ChallengeLifecycleCard({
  challenge,
  onPress,
}: {
  challenge: ChallengeRecord;
  onPress: () => void;
}) {
  const badge = getCategoryBadge(challenge.category);
  const progress = challenge.progressTotal && challenge.progressTotal > 0
    ? Math.max(6, Math.round((challenge.progressCurrent / challenge.progressTotal) * 100))
    : 0;

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      <LinearGradient
        colors={['#FFFDF8', '#FFFFFF']}
        start={{ x: 0.02, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.lifecycleCard}
      >
        <View style={s.lifecycleTop}>
          <View style={s.lifecycleHeadLeft}>
            <View style={[s.categoryBadge, { backgroundColor: badge.bg }]}>
              <Text style={[s.categoryBadgeText, { color: badge.text }]}>{badge.label}</Text>
            </View>

            <Text style={s.lifecycleTitle}>{challenge.title}</Text>
          </View>

          <View style={s.lifecycleRight}>
            {challenge.streak > 0 ? (
              <View style={s.streakPill}>
                <Flame s={10} filled color="#F97316" />
                <Text style={s.streakText}>{challenge.streak}</Text>
              </View>
            ) : null}
            <ChevronDown s={14} c={C.textMuted} w={2.2} />
          </View>
        </View>

        <View style={s.lifecycleMetaRow}>
          <View style={s.lifecycleMetaLeft}>
            {challenge.time ? <Text style={s.lifecycleMeta}>{challenge.time}</Text> : null}
            {challenge.time ? <Text style={s.lifecycleMetaDot}>◊</Text> : null}
            <Text style={s.lifecycleMeta}>{challenge.headline}</Text>
          </View>
          <Text style={s.lifecyclePct}>{challenge.showBar && challenge.progressTotal ? `${progress}%` : challenge.scheduleLabel.toUpperCase()}</Text>
        </View>

        {challenge.showBar && challenge.progressTotal ? (
          <View style={s.progressTrack}>
            <LinearGradient
              colors={['#C5A059', '#E3C15D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[s.progressFill, { width: `${progress}%` }]}
            />
          </View>
        ) : (
          <Text style={s.lifecycleChurchMeta}>{challenge.subline}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

function CatalogEntryCard({
  entry,
  expanded,
  selectedPaceId,
  onToggle,
  onSelectPace,
  onStart,
}: {
  entry: ChallengeCatalogEntry;
  expanded: boolean;
  selectedPaceId?: string;
  onToggle: () => void;
  onSelectPace: (paceId: string) => void;
  onStart: () => void;
}) {
  const tone = getTone(entry.category);

  return (
    <View style={[s.catalogCard, { borderColor: tone.border, backgroundColor: '#FFFFFF' }]}>
      <TouchableOpacity activeOpacity={0.85} onPress={onToggle} style={s.catalogTop}>
        <View style={[s.catalogIconWrap, { backgroundColor: tone.iconBg }]}>
          <ChallengeIcon icon={entry.icon} size={17} color={tone.accent} />
        </View>

        <View style={s.catalogBody}>
          <Text style={s.catalogTitle}>{entry.title}</Text>
          <Text style={s.catalogDescription}>{entry.description}</Text>
        </View>

        <View style={[s.expandCircle, expanded ? { borderColor: tone.border, backgroundColor: tone.soft } : null]}>
          <ChevronDown s={15} c={tone.accent} w={2.2} />
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View style={s.catalogExpanded}>
          <View style={[s.catalogDescriptor, { backgroundColor: tone.soft, borderColor: tone.border }]}>
            <Text style={[s.catalogDescriptorText, { color: tone.text }]}>{entry.descriptor}</Text>
            <Text style={s.catalogDescriptorMeta}>{entry.defaultTime || 'Anytime'} | {entry.scheduleLabel}</Text>
          </View>

          {entry.paceOptions?.length ? (
            <View style={s.paceWrap}>
              {entry.paceOptions.map(option => {
                const active = option.id === selectedPaceId;
                return (
                  <TouchableOpacity
                    key={option.id}
                    activeOpacity={0.84}
                    onPress={() => onSelectPace(option.id)}
                    style={[
                      s.paceChip,
                      active ? { borderColor: tone.accent, backgroundColor: tone.soft } : null,
                    ]}
                  >
                    <Text style={[s.paceChipTitle, active ? { color: tone.accent } : null]}>{option.label}</Text>
                    <Text style={s.paceChipCaption}>{option.caption}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          <TouchableOpacity
            activeOpacity={0.84}
            onPress={onStart}
            style={[s.startBtn, { backgroundColor: tone.accent }]}
          >
            <Play s={12} c="#FFFFFF" />
            <Text style={s.startBtnText}>START CHALLENGE</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function HistoryCard({
  challenge,
}: {
  challenge: ChallengeRecord;
}) {
  const tone = getTone(challenge.category);

  return (
    <View style={[s.historyCard, { borderColor: tone.border }]}>
      <View style={s.historyTop}>
        <View style={[s.historyDot, { backgroundColor: challenge.status === 'completed' ? tone.accent : '#E7E5E4' }]} />
        <Text style={s.historyTitle}>{challenge.title}</Text>
      </View>
      <Text style={s.historyBody}>{challenge.headline}</Text>
      <Text style={s.historyFoot}>{challenge.endedLabel || challenge.subline}</Text>
    </View>
  );
}

export default function ChallengesView() {
  const {
    activeChallenges,
    pausedChallenges,
    completedChallenges,
    cancelledChallenges,
    availableCatalogEntries,
    pauseChallenge,
    resumeChallenge,
    endChallenge,
    startChallenge,
    updateChallenge,
  } = useChallenges();
  const [activeTab, setActiveTab] = useState<ChallengeTab>('active');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [selectedPaces, setSelectedPaces] = useState<Record<string, string>>({});
  const [manageTarget, setManageTarget] = useState<ChallengeRecord | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<ChallengeRecord | null>(null);
  const [draftTime, setDraftTime] = useState('21:00');
  const [draftSchedule, setDraftSchedule] = useState('Daily');
  const [confirmEndId, setConfirmEndId] = useState<string | null>(null);

  const ongoingChallenges = useMemo(
    () => [...activeChallenges, ...pausedChallenges],
    [activeChallenges, pausedChallenges],
  );

  const historyCount = completedChallenges.length + cancelledChallenges.length;

  const currentTabChallenges = useMemo(() => {
    switch (activeTab) {
      case 'prayer':
        return ongoingChallenges.filter(item => item.category === 'prayer');
      case 'scripture':
        return ongoingChallenges.filter(item => item.category === 'scripture');
      case 'journal':
        return ongoingChallenges.filter(item => item.category === 'journal');
      case 'church':
        return ongoingChallenges.filter(item => item.category === 'church');
      default:
        return ongoingChallenges;
    }
  }, [activeTab, ongoingChallenges]);

  const currentTabCatalog = useMemo(() => {
    switch (activeTab) {
      case 'prayer':
        return availableCatalogEntries.filter(item => item.category === 'prayer');
      case 'scripture':
        return availableCatalogEntries.filter(item => item.category === 'scripture');
      case 'journal':
        return availableCatalogEntries.filter(item => item.category === 'journal');
      case 'church':
        return availableCatalogEntries.filter(item => item.category === 'church');
      default:
        return [];
    }
  }, [activeTab, availableCatalogEntries]);

  const groupedScriptureCatalog = useMemo(() => (
    GROUP_ORDER
      .map(groupKey => ({
        key: groupKey,
        label: GROUP_LABELS[groupKey],
        entries: currentTabCatalog.filter(item => item.groupKey === groupKey),
      }))
      .filter(group => group.entries.length > 0)
  ), [currentTabCatalog]);

  const tabs: { key: ChallengeTab; label: string }[] = [
    { key: 'active', label: `ACTIVE (${ongoingChallenges.length})` },
    { key: 'prayer', label: 'PRAYER' },
    { key: 'scripture', label: 'SCRIPTURE' },
    { key: 'journal', label: 'JOURNAL' },
    { key: 'church', label: 'CHURCH' },
    { key: 'history', label: `HISTORY (${historyCount})` },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScreenTitleBar title="CHALLENGES" showBack />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabsScroll}
        contentContainerStyle={s.tabsRow}
      >
        {tabs.map(tab => (
          <TabPill
            key={tab.key}
            active={tab.key === activeTab}
            label={tab.label}
            color={TAB_ACTIVE_COLORS[tab.key]}
            onPress={() => {
              setActiveTab(tab.key);
              setExpandedEntryId(null);
            }}
          />
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 128, paddingTop: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'active' ? (
          <View style={s.sectionStack}>
            {activeChallenges.length === 0 && pausedChallenges.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={s.emptyTitle}>No active challenges</Text>
                <Text style={s.emptyBody}>Pick a category above and start your next rule.</Text>
              </View>
            ) : null}

            {activeChallenges.map(challenge => (
              <ChallengeLifecycleCard
                key={challenge.id}
                challenge={challenge}
                onPress={() => setManageTarget(challenge)}
              />
            ))}

            {pausedChallenges.length > 0 ? (
              <View style={s.sectionBlock}>
                <Text style={s.sectionLabel}>PAUSED</Text>
                {pausedChallenges.map(challenge => (
                  <ChallengeLifecycleCard
                    key={challenge.id}
                    challenge={challenge}
                    onPress={() => setManageTarget(challenge)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {(activeTab === 'prayer' || activeTab === 'scripture' || activeTab === 'journal' || activeTab === 'church') ? (
          <View style={s.sectionStack}>
            {currentTabChallenges.length > 0 ? (
              <View style={s.sectionBlock}>
                <Text style={s.sectionLabel}>ACTIVE</Text>
                {currentTabChallenges.map(challenge => (
                  <ChallengeLifecycleCard
                    key={challenge.id}
                    challenge={challenge}
                    onPress={() => setManageTarget(challenge)}
                  />
                ))}
              </View>
            ) : null}

            {currentTabCatalog.length > 0 ? (
              <View style={s.sectionBlock}>
                <Text style={s.sectionLabel}>{currentTabChallenges.length > 0 ? 'START NEW' : 'AVAILABLE'}</Text>

                {activeTab === 'scripture'
                  ? groupedScriptureCatalog.map(group => (
                    <View key={group.key} style={s.groupBlock}>
                      <Text style={s.groupLabel}>{group.label}</Text>
                      {group.entries.map(entry => (
                        <CatalogEntryCard
                          key={entry.id}
                          entry={entry}
                          expanded={expandedEntryId === entry.id}
                          selectedPaceId={selectedPaces[entry.id]}
                          onToggle={() => setExpandedEntryId(current => current === entry.id ? null : entry.id)}
                          onSelectPace={paceId => setSelectedPaces(current => ({ ...current, [entry.id]: paceId }))}
                          onStart={() => {
                            const pace = entry.paceOptions?.find(item => item.id === selectedPaces[entry.id]) || entry.paceOptions?.[0] || null;
                            startChallenge(entry.id, pace);
                            setExpandedEntryId(null);
                            setActiveTab('active');
                          }}
                        />
                      ))}
                    </View>
                  ))
                  : currentTabCatalog.map(entry => (
                    <CatalogEntryCard
                      key={entry.id}
                      entry={entry}
                      expanded={expandedEntryId === entry.id}
                      selectedPaceId={selectedPaces[entry.id]}
                      onToggle={() => setExpandedEntryId(current => current === entry.id ? null : entry.id)}
                      onSelectPace={paceId => setSelectedPaces(current => ({ ...current, [entry.id]: paceId }))}
                      onStart={() => {
                        const pace = entry.paceOptions?.find(item => item.id === selectedPaces[entry.id]) || entry.paceOptions?.[0] || null;
                        startChallenge(entry.id, pace);
                        setExpandedEntryId(null);
                        setActiveTab('active');
                      }}
                    />
                  ))}
              </View>
            ) : null}

            {currentTabChallenges.length === 0 && currentTabCatalog.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={s.emptyTitle}>All caught up</Text>
                <Text style={s.emptyBody}>No challenges available in this category right now.</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {activeTab === 'history' ? (
          <View style={s.sectionStack}>
            {completedChallenges.length > 0 ? (
              <View style={s.sectionBlock}>
                <Text style={[s.sectionLabel, { color: C.gold }]}>ACHIEVEMENTS</Text>
                {completedChallenges.map(challenge => (
                  <HistoryCard key={challenge.id} challenge={challenge} />
                ))}
              </View>
            ) : null}

            {cancelledChallenges.length > 0 ? (
              <View style={s.sectionBlock}>
                <Text style={s.sectionLabel}>ENDED EARLY</Text>
                {cancelledChallenges.map(challenge => (
                  <HistoryCard key={challenge.id} challenge={challenge} />
                ))}
              </View>
            ) : null}

            {completedChallenges.length === 0 && cancelledChallenges.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={s.emptyTitle}>No history yet</Text>
                <Text style={s.emptyBody}>Finished and ended challenges will live here.</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={!!manageTarget} transparent animationType="fade" onRequestClose={() => setManageTarget(null)}>
        <View style={s.modalWrap}>
          <Pressable style={s.modalBackdrop} onPress={() => setManageTarget(null)} />
          {manageTarget ? (
            <View style={s.sheet}>
              <View style={s.sheetHandle} />
              <View style={s.sheetHead}>
                <Text style={s.sheetTitle}>{manageTarget.title}</Text>
                <TouchableOpacity onPress={() => setManageTarget(null)} activeOpacity={0.75} style={s.closeCircle}>
                  <X s={16} c={C.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={s.sheetBody}>{manageTarget.headline} | {manageTarget.scheduleLabel}</Text>

              <View style={s.actionGrid}>
                <TouchableOpacity
                  activeOpacity={0.84}
                  style={s.actionCard}
                  onPress={() => {
                    setDraftTime(manageTarget.time || '21:00');
                    setDraftSchedule(manageTarget.scheduleLabel || 'Daily');
                    setScheduleTarget(manageTarget);
                  }}
                >
                  <ArrowUpRight s={15} c={C.gold} />
                  <Text style={s.actionLabel}>Edit Schedule</Text>
                </TouchableOpacity>

                {manageTarget.status === 'active' ? (
                  <TouchableOpacity
                    activeOpacity={0.84}
                    style={s.actionCard}
                    onPress={() => {
                      pauseChallenge(manageTarget.id);
                      setManageTarget(null);
                    }}
                  >
                    <Pause s={15} c={C.gold} />
                    <Text style={s.actionLabel}>Pause</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    activeOpacity={0.84}
                    style={s.actionCard}
                    onPress={() => {
                      resumeChallenge(manageTarget.id);
                      setManageTarget(null);
                    }}
                  >
                    <Play s={13} c={C.gold} />
                    <Text style={s.actionLabel}>Resume</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                activeOpacity={0.84}
                style={s.endBtn}
                onPress={() => setConfirmEndId(manageTarget.id)}
              >
                <Trash2 s={15} c="#DC2626" />
                <Text style={s.endBtnText}>END CHALLENGE</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal visible={!!scheduleTarget} transparent animationType="fade" onRequestClose={() => setScheduleTarget(null)}>
        <View style={s.modalWrap}>
          <Pressable style={s.modalBackdrop} onPress={() => setScheduleTarget(null)} />
          {scheduleTarget ? (
            <View style={s.sheet}>
              <View style={s.sheetHandle} />
              <View style={s.sheetHead}>
                <Text style={s.sheetTitle}>Edit Schedule</Text>
                <TouchableOpacity onPress={() => setScheduleTarget(null)} activeOpacity={0.75} style={s.closeCircle}>
                  <X s={16} c={C.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={s.formLabel}>TIME</Text>
              <View style={s.presetRow}>
                {['06:30', '07:00', '21:00', '22:00'].map(option => (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.84}
                    onPress={() => setDraftTime(option)}
                    style={[s.presetChip, draftTime === option ? s.presetChipActive : null]}
                  >
                    <Text style={[s.presetChipText, draftTime === option ? s.presetChipTextActive : null]}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.formLabel}>FREQUENCY</Text>
              <View style={s.presetRow}>
                {['Daily', 'Weekdays', 'Every Sunday'].map(option => (
                  <TouchableOpacity
                    key={option}
                    activeOpacity={0.84}
                    onPress={() => setDraftSchedule(option)}
                    style={[s.presetChip, draftSchedule === option ? s.presetChipActive : null]}
                  >
                    <Text style={[s.presetChipText, draftSchedule === option ? s.presetChipTextActive : null]}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                activeOpacity={0.84}
                style={s.saveBtn}
                onPress={() => {
                  updateChallenge(scheduleTarget.id, {
                    time: draftTime,
                    scheduleLabel: draftSchedule,
                  });
                  setScheduleTarget(null);
                  setManageTarget(null);
                }}
              >
                <CheckSmall s={14} c="#FFFFFF" />
                <Text style={s.saveBtnText}>SAVE SCHEDULE</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal visible={!!confirmEndId} transparent animationType="fade" onRequestClose={() => setConfirmEndId(null)}>
        <View style={s.modalWrap}>
          <Pressable style={s.modalBackdrop} onPress={() => setConfirmEndId(null)} />
          <View style={s.confirmCard}>
            <Text style={s.confirmTitle}>End challenge?</Text>
            <Text style={s.confirmBody}>Progress stays in history, but the challenge leaves your active routine.</Text>
            <View style={s.confirmRow}>
              <TouchableOpacity activeOpacity={0.84} style={s.confirmGhost} onPress={() => setConfirmEndId(null)}>
                <Text style={s.confirmGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.84}
                style={s.confirmDanger}
                onPress={() => {
                  endChallenge(confirmEndId!);
                  setConfirmEndId(null);
                  setManageTarget(null);
                }}
              >
                <Text style={s.confirmDangerText}>End</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  tabsScroll: {
    flexGrow: 0,
    maxHeight: 52,
  },
  tabsRow: {
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 8,
    alignItems: 'center',
  },
  tabPill: {
    flexShrink: 0,
    alignSelf: 'center',
    minHeight: 34,
    borderRadius: 17,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#EEE8DA',
    backgroundColor: '#F7F4ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#B4AE9F',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  sectionStack: {
    gap: 14,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.textMuted,
    marginLeft: 2,
  },
  groupBlock: {
    gap: 8,
  },
  groupLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.4,
    color: C.gold,
    marginLeft: 2,
    marginTop: 6,
  },
  emptyWrap: {
    paddingVertical: 56,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: F.serifMedium,
    fontSize: 24,
    color: C.text,
  },
  emptyBody: {
    marginTop: 6,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 18,
    color: C.textMuted,
    textAlign: 'center',
  },
  lifecycleCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderColor: C.gold,
    borderRadius: 24,
    padding: 14,
    shadowColor: '#B6913D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  lifecycleTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  lifecycleHeadLeft: {
    flex: 1,
    minWidth: 0,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 7,
  },
  categoryBadgeText: {
    fontFamily: F.sansBold,
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  lifecycleTitle: {
    fontFamily: F.serifMedium,
    fontSize: 15,
    color: C.text,
    lineHeight: 19,
  },
  lifecycleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFF2E8',
  },
  streakText: {
    fontFamily: F.sansBold,
    fontSize: 11,
    color: '#B45309',
  },
  lifecycleMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  lifecycleMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  lifecycleMeta: {
    fontFamily: F.sansMedium,
    fontSize: 11,
    color: '#AAA397',
  },
  lifecycleMetaDot: {
    fontFamily: F.sansBold,
    fontSize: 10,
    color: '#D8D2C5',
    marginTop: -1,
  },
  lifecyclePct: {
    fontFamily: F.sansBold,
    fontSize: 10,
    color: '#C5A059',
  },
  progressTrack: {
    marginTop: 10,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#F3EEE2',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  lifecycleChurchMeta: {
    marginTop: 10,
    fontFamily: F.sansMedium,
    fontSize: 11,
    color: '#AAA397',
  },
  catalogCard: {
    borderWidth: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  catalogTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  catalogIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogBody: {
    flex: 1,
    minWidth: 0,
  },
  catalogTitle: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    color: C.text,
  },
  catalogDescription: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 18,
    color: C.textSecondary,
  },
  expandCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#EEEAE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogExpanded: {
    borderTopWidth: 1,
    borderTopColor: '#F3EFE7',
    padding: 14,
    gap: 12,
  },
  catalogDescriptor: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  catalogDescriptorText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  catalogDescriptorMeta: {
    marginTop: 4,
    fontFamily: F.sans,
    fontSize: 12,
    color: C.textSecondary,
  },
  paceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paceChip: {
    minWidth: 92,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EEEAE1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FCFCFA',
  },
  paceChipTitle: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: C.text,
    textTransform: 'uppercase',
  },
  paceChipCaption: {
    marginTop: 3,
    fontFamily: F.sans,
    fontSize: 11,
    color: C.textMuted,
  },
  startBtn: {
    minHeight: 48,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startBtnText: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 2.1,
    color: '#FFFFFF',
  },
  historyCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  historyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  historyTitle: {
    fontFamily: F.serifMedium,
    fontSize: 16,
    color: C.text,
  },
  historyBody: {
    marginTop: 8,
    fontFamily: F.sans,
    fontSize: 12,
    lineHeight: 18,
    color: C.textSecondary,
  },
  historyFoot: {
    marginTop: 8,
    fontFamily: F.sansBold,
    fontSize: 9,
    letterSpacing: 1.6,
    color: C.textMuted,
    textTransform: 'uppercase',
  },
  modalWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.36)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E9E2D4',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetTitle: {
    flex: 1,
    fontFamily: F.serifMedium,
    fontSize: 28,
    color: C.text,
  },
  closeCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F7F4EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    marginTop: 6,
    fontFamily: F.sans,
    fontSize: 13,
    lineHeight: 19,
    color: C.textSecondary,
  },
  actionGrid: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    minHeight: 78,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDE7DA',
    backgroundColor: '#FFFCF5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  actionLabel: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.8,
    color: C.gold,
    textTransform: 'uppercase',
  },
  endBtn: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  endBtnText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2,
    color: '#DC2626',
  },
  formLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 2.2,
    color: C.textMuted,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    minWidth: 88,
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#EDE7DA',
    backgroundColor: '#FCFBF8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  presetChipActive: {
    borderColor: C.gold,
    backgroundColor: C.goldBg,
  },
  presetChipText: {
    fontFamily: F.sansBold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: C.textSecondary,
    textTransform: 'uppercase',
  },
  presetChipTextActive: {
    color: C.goldDark,
  },
  saveBtn: {
    marginTop: 18,
    minHeight: 48,
    borderRadius: 22,
    backgroundColor: C.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 2,
    color: '#FFFFFF',
  },
  confirmCard: {
    marginHorizontal: 18,
    marginBottom: 28,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  confirmTitle: {
    fontFamily: F.serifMedium,
    fontSize: 28,
    color: C.text,
  },
  confirmBody: {
    marginTop: 8,
    fontFamily: F.sans,
    fontSize: 13,
    lineHeight: 19,
    color: C.textSecondary,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  confirmGhost: {
    flex: 1,
    minHeight: 46,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EDE7DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmGhostText: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.8,
    color: C.textSecondary,
  },
  confirmDanger: {
    flex: 1,
    minHeight: 46,
    borderRadius: 18,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDangerText: {
    fontFamily: F.sansBold,
    fontSize: 10.5,
    letterSpacing: 1.8,
    color: '#FFFFFF',
  },
});
