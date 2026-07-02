import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ChevronDown, Globe } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusSwitch from './FocusSwitch';
import { SMOOTH_LAYOUT, SOFT_IN, SOFT_OUT } from './focusMotion';
import { WEB_PACKS } from './focusContent';
import type { WebPackId } from './focusWatchStore';

// One protection pack as an expandable card: the row toggles the pack, the
// chevron reveals exactly which sites live inside — no mystery blocklists.
export default function WebPackCard({
  packId,
  enabled,
  onToggle,
  enabledDetail,
}: {
  packId: WebPackId;
  enabled: boolean;
  onToggle: () => void;
  enabledDetail?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const content = WEB_PACKS.find(pack => pack.id === packId)!;

  return (
    <Animated.View
      style={[s.card, enabled && s.cardEnabled]}
      layout={SMOOTH_LAYOUT}
    >
      <View style={s.headerRow}>
        <TouchableOpacity
          style={s.headerMain}
          activeOpacity={0.75}
          onPress={() => setExpanded(current => !current)}
        >
          <View style={[s.icon, { backgroundColor: content.iconBg }]}>{content.icon}</View>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={s.name}>{content.name}</Text>
            <Text style={s.detail}>
              {enabled ? enabledDetail ?? 'Blocked across your browsers' : content.detail}
            </Text>
          </View>
          <View style={[s.chevron, expanded && s.chevronOpen]}>
            <ChevronDown s={16} c={C.textMuted} />
          </View>
        </TouchableOpacity>
        <FocusSwitch value={enabled} onToggle={onToggle} />
      </View>

      {expanded && (
        <Animated.View entering={SOFT_IN} exiting={SOFT_OUT} style={s.siteList}>
          {content.sites.map(site => (
            <View key={site} style={s.siteRow}>
              <Globe s={12} c={C.textMuted} w={2} />
              <Text style={s.siteText}>{site}</Text>
            </View>
          ))}
          <Text style={s.sitesNote}>{content.sitesNote}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardEnabled: {
    borderColor: C.goldLight,
    backgroundColor: '#FFFDF6',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: F.serifMedium,
    fontSize: 17,
    color: C.text,
  },
  detail: {
    marginTop: 2,
    fontFamily: F.sans,
    fontSize: 11.5,
    color: C.textSecondary,
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  siteList: {
    marginTop: 11,
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 5,
    paddingLeft: 4,
  },
  siteText: {
    fontFamily: F.sansMedium,
    fontSize: 13,
    color: C.textSecondary,
  },
  sitesNote: {
    marginTop: 6,
    paddingLeft: 4,
    fontFamily: F.sans,
    fontSize: 11,
    color: C.textMuted,
    fontStyle: 'italic',
  },
});
