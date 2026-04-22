import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Icons from '@/components/icons/Icons';
import { C, F } from '@/constants/tokens';

type TabBarProps = {
  state: { index: number; routes: { name: string }[] };
  navigation: { navigate: (name: string) => void };
};

const TABS = [
  { name: 'index',   label: 'HOME',    Icon: Icons.Home },
  { name: 'library', label: 'LIBRARY', Icon: Icons.Book },
  { name: 'inner',   label: 'INNER',   Icon: Icons.Heart },
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
    alignItems: 'center',
    borderRadius: 9999,
    paddingVertical: 10,
    paddingHorizontal: 40,
    gap: 44,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 15,
    elevation: 8,
  },
  tabBtn: {
    alignItems: 'center',
    gap: 3,
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
    </Tabs>
  );
}
