import {
  Tabs } from 'expo-router';
import { View,
  Text,
  StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Icons from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';
import { HapticTouchableOpacity as TouchableOpacity } from '@/components/shared/HapticTouch';


type TabBarProps = {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
};

const TABS = [
  { name: 'index',   label: 'HOME',    Icon: Icons.Home },
  { name: 'library', label: 'LIBRARY', Icon: Icons.Book },
  { name: 'inner',   label: 'INNER',   Icon: Icons.Heart },
  { name: 'focus',   label: 'FOCUS',   Icon: Icons.Shield },
];

function FloatingTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.barWrap, { bottom: Math.max(insets.bottom, 12) }]}
      pointerEvents="box-none"
    >
      <BlurView intensity={80} tint="light" style={styles.pill}>
        {TABS.map((tab, i) => {
          const isActive = state.index === i;
          const color = isActive ? C.gold : C.text;
          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => navigation.navigate(tab.name)}
              // flex:1 so each tab fills exactly 1/3 of the bar width —
              // taps register anywhere in that third, not only on the icon.
              style={[styles.tabBtn, { opacity: isActive ? 1 : 0.42 }]}
              activeOpacity={0.7}
            >
              <tab.Icon s={22} c={color} w={isActive ? 2.4 : 2} />
              <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 9999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 8,
  },
  // The previous design relied on `gap: 44` between tabs and `paddingHorizontal: 40`
  // on the pill — that put 44px of dead, untappable space between each tab.
  // Now the pill is content-sized again (no fixed width = no widening) and the
  // gap is folded into each tab's own paddingHorizontal, so the whole pill is
  // tap-active without changing its visual size.
  // paddingHorizontal 18 (was 22): with the 4th FOCUS tab the pill must still
  // clear the screen edges on smaller iPhones.
  tabBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  tabLabel: {
    fontSize: 9,
    fontFamily: F.sansBold,
    letterSpacing: 2,
  },
});

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar state={props.state} navigation={props.navigation as any} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="library" />
      <Tabs.Screen name="inner" />
      <Tabs.Screen name="focus" />
    </Tabs>
  );
}
