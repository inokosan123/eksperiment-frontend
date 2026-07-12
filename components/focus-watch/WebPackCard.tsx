import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ChevronDown, Globe, Shield } from '@/components/icons/Icons';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { C, F } from '@/constants/tokens';
import FocusSwitch from './FocusSwitch';
import { SMOOTH_LAYOUT, SOFT_IN, SOFT_OUT } from './focusMotion';
import { WEB_PACKS } from './focusContent';
import type { PackMode, WebPackId } from './dayPlanStore';

// One protection pack as an expandable card. Three postures:
//   off   — quiet, switch off
//   on    — gold wash, switch on, can be turned off again
//   never — the door is closed for good: switch locked on, rose accents,
//           the only way back runs through the lock cooldown.
export default function WebPackCard({
  packId,
  mode,
  onToggle,
  onSetNever,
  pendingLabel,
}: {
  packId: WebPackId;
  mode: PackMode;
  onToggle: () => void;
  onSetNever: (never: boolean) => void;
  pendingLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const content = WEB_PACKS.find(pack => pack.id === packId)!;
  const enabled = mode !== 'off';
  const never = mode === 'never';

  return (
    <Animated.View
      style={[s.card, enabled && s.cardEnabled, never && s.cardNever]}
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
            <Text style={[s.detail, never && s.detailNever]}>
              {never
                ? 'Closed for good — no unlock'
                : enabled
                  ? 'Blocked in supported browsers'
                  : content.detail}
            </Text>
          </View>
          <View style={[s.chevron, expanded && s.chevronOpen]}>
            <ChevronDown s={16} c={C.textMuted} />
          </View>
        </TouchableOpacity>
        <FocusSwitch value={enabled} onToggle={never ? () => setExpanded(true) : onToggle} />
      </View>

      {expanded && (
        <Animated.View entering={SOFT_IN} exiting={SOFT_OUT} style={s.body}>
          {content.sites.map(site => (
            <View key={site} style={s.siteRow}>
              <Globe s={12} c={C.textMuted} w={2} />
              <Text style={s.siteText}>{site}</Text>
            </View>
          ))}
          <Text style={s.sitesNote}>{content.sitesNote}</Text>

          <View style={s.neverRow}>
            <View style={[s.neverIcon, never && s.neverIconOn]}>
              <Shield s={13} c={never ? '#B54155' : C.textMuted} w={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.neverTitle, never && s.neverTitleOn]}>Never Allowed</Text>
              <Text style={s.neverDesc}>
                {never
                  ? pendingLabel
                    ? `Unlocking waits — ${pendingLabel}`
                    : 'This door stays closed. Undoing it waits for the cooldown.'
                  : 'Close this door for good — no practice opens it.'}
              </Text>
            </View>
            <TouchableOpacity
              style={[s.neverBtn, never && s.neverBtnOn]}
              activeOpacity={0.8}
              haptic="medium"
              onPress={() => onSetNever(!never)}
            >
              <Text style={[s.neverBtnText, never && s.neverBtnTextOn]}>
                {never ? 'Undo' : 'Close it'}
              </Text>
            </TouchableOpacity>
          </View>
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
  cardNever: {
    borderColor: '#F2D4DA',
    backgroundColor: '#FFFBFB',
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
  detailNever: {
    fontFamily: F.sansMedium,
    color: '#B54155',
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  body: {
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

  neverRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F4EFE6',
    backgroundColor: '#FBFAF6',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  neverIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F1F0EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  neverIconOn: {
    backgroundColor: '#FBE6E9',
  },
  neverTitle: {
    fontFamily: F.sansSemiBold,
    fontSize: 12.5,
    color: C.text,
  },
  neverTitleOn: {
    color: '#B54155',
  },
  neverDesc: {
    marginTop: 1,
    fontFamily: F.sans,
    fontSize: 10.5,
    lineHeight: 14,
    color: C.textSecondary,
  },
  neverBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#EFC4CC',
    backgroundColor: '#FDF2F4',
  },
  neverBtnOn: {
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  neverBtnText: {
    fontFamily: F.sansSemiBold,
    fontSize: 11.5,
    color: '#B54155',
  },
  neverBtnTextOn: {
    color: C.textSecondary,
  },
});
