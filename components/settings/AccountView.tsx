import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import {
  ArrowUpRight,
  Bell,
  ChevronRight,
  Crown,
  Globe,
  Heart,
  LogOut,
  User,
} from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import ScreenTitleBar from '@/components/shared/ScreenTitleBar';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';
import { useAppSettings } from '@/components/settings/SettingsContext';

const BG = '#FAF7F0';
const GOLD = C.gold;

function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}

function Divider({ inset = 16 }: { inset?: number }) {
  return <View style={[s.divider, { marginLeft: inset }]} />;
}

function SectionLabel({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <View style={s.sectionLabel}>
      <View style={s.sectionLabelIcon}>{icon}</View>
      <Text style={s.sectionLabelText}>{title}</Text>
    </View>
  );
}

function RowIconBox({ children, tint }: { children: React.ReactNode; tint?: string }) {
  return <View style={[s.rowIconBox, tint ? { backgroundColor: tint } : null]}>{children}</View>;
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <View style={s.row}>
      <RowIconBox>{icon}</RowIconBox>
      <View style={s.rowCopy}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text style={s.rowSub} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function ActionRow({
  icon, label, sublabel, onPress, accent,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <TouchableOpacity activeOpacity={0.85} style={s.row} onPress={onPress}>
      <RowIconBox tint={accent ? 'rgba(197,160,89,0.14)' : undefined}>{icon}</RowIconBox>
      <View style={s.rowCopy}>
        <Text style={s.rowLabel}>{label}</Text>
        {!!sublabel && <Text style={s.rowSub}>{sublabel}</Text>}
      </View>
      <ChevronRight s={16} c="#CFC8B8" w={2} />
    </TouchableOpacity>
  );
}

export default function AccountView() {
  const insets = useSafeAreaInsets();
  const { account } = useAppSettings();

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <ScreenTitleBar
        title="MY ACCOUNT"
        showBack
        bg={BG}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 48, rowGap: 22 }}
      >
        <LinearGradient
          colors={['#FFFDF7', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <View pointerEvents="none" style={s.heroGlow} />
          <View style={s.avatar}>
            <User s={32} c={GOLD} w={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.heroName} numberOfLines={1}>{account.displayName}</Text>
            <Text style={s.heroEmail} numberOfLines={1}>{account.email}</Text>
            <View style={s.planBadge}>
              <Crown s={11} c="#7B5E1C" w={2.2} />
              <Text style={s.planBadgeText}>{account.plan.toUpperCase()}</Text>
            </View>
          </View>
        </LinearGradient>

        <View>
          <SectionLabel icon={<User s={12} c={GOLD} w={2.2} />} title="Profile" />
          <Card>
            <InfoRow icon={<User s={16} c={C.textSecondary} w={2} />} label="Name" value={account.displayName} />
            <Divider inset={62} />
            <InfoRow icon={<Globe s={16} c={C.textSecondary} w={2} />} label="Account email" value={account.email} />
            <Divider inset={62} />
            <InfoRow icon={<Crown s={16} c={C.textSecondary} w={2} />} label="Plan" value={account.plan} />
            <Divider inset={62} />
            <InfoRow icon={<Heart s={16} c={C.textSecondary} w={2} />} label="Member since" value={account.memberSince} />
          </Card>
        </View>

        <View>
          <SectionLabel icon={<Crown s={12} c={GOLD} w={2.2} />} title="Membership" />
          <Card>
            <ActionRow
              icon={<ArrowUpRight s={16} c={GOLD} w={2} />}
              label="Manage Subscription"
              sublabel="Plans, billing, invoices"
              accent
              onPress={() => Haptics.selectionAsync()}
            />
            <Divider inset={62} />
            <ActionRow
              icon={<LogOut s={16} c={C.textSecondary} w={2} />}
              label="Sign In"
              sublabel="Connect your account when login is enabled"
              onPress={() => Haptics.selectionAsync()}
            />
          </Card>
        </View>

        <View>
          <SectionLabel icon={<Bell s={12} c={GOLD} w={2.2} />} title="Account Data" />
          <Card>
            <InfoRow icon={<Globe s={16} c={C.textSecondary} w={2} />} label="Sync status" value={account.syncStatus} />
            <Divider inset={62} />
            <InfoRow icon={<Bell s={16} c={C.textSecondary} w={2} />} label="Notifications" value="Managed in Settings" />
            <Divider inset={62} />
            <ActionRow
              icon={<ArrowUpRight s={16} c={C.textSecondary} w={2} />}
              label="Export Account Data"
              sublabel="Prepare a local backup"
              onPress={() => Haptics.selectionAsync()}
            />
          </Card>
        </View>

        <View style={s.footer}>
          <Text style={s.footerBrand}>ANASTA</Text>
          <Text style={s.footerCopy}>Your local spiritual workspace</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    minHeight: 136,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.24)',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 15,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    right: -34,
    top: -42,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(197,160,89,0.12)',
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(197,160,89,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: { fontFamily: F.serifMedium, fontSize: 23, color: C.text },
  heroEmail: { marginTop: 2, fontFamily: F.sans, fontSize: 12, color: C.textMuted },
  planBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 5,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(197,160,89,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(197,160,89,0.30)',
  },
  planBadgeText: { fontFamily: F.sansBold, fontSize: 9.5, color: '#7B5E1C', letterSpacing: 1.4 },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', columnGap: 6, marginBottom: 8, marginLeft: 4 },
  sectionLabelIcon: { width: 14, alignItems: 'center', justifyContent: 'center' },
  sectionLabelText: { fontFamily: F.sansBold, fontSize: 10, letterSpacing: 2.4, color: GOLD, textTransform: 'uppercase' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#EDE9E0', overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F2EEE5' },
  row: { flexDirection: 'row', alignItems: 'center', columnGap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  rowIconBox: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#F6F4EE', alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { fontFamily: F.serifMedium, fontSize: 15, color: C.text },
  rowSub: { marginTop: 2, fontFamily: F.sans, fontSize: 11, color: C.textMuted },
  footer: { alignItems: 'center', paddingTop: 4, rowGap: 4 },
  footerBrand: { fontFamily: F.sansBold, fontSize: 11, letterSpacing: 3, color: '#CFC8B8' },
  footerCopy: { fontFamily: F.serifMediumItalic, fontSize: 12, color: '#CFC8B8' },
});
