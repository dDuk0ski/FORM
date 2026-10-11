import { Tabs } from 'expo-router/js-tabs';
import { SymbolView, type SFSymbol } from 'expo-symbols';

import { useTheme } from '@/theme';

// Order matters: this is the order of the tab bar. Today (index) is the default route.
const TABS: { name: string; title: string; icon: SFSymbol }[] = [
  { name: 'index', title: 'Today', icon: 'calendar' },
  { name: 'pantry', title: 'Pantry', icon: 'basket' },
  { name: 'cook', title: 'Cook', icon: 'fork.knife' },
  { name: 'train', title: 'Train', icon: 'dumbbell' },
  { name: 'profile', title: 'Profile', icon: 'person.crop.circle' },
];

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      {TABS.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, size }) => (
              <SymbolView name={icon} tintColor={color} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
