// apps/mobile/app/tabs/_layout.tsx
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAppTheme } from '../../lib/theme'

export default function TabLayout() {
  const theme = useAppTheme()

  return (
    <Tabs
      screenOptions={{
        headerShown:          false,
        tabBarActiveTintColor:   theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          borderTopWidth:   0.5,
          borderTopColor:   theme.tabBarBorder,
          backgroundColor:  theme.tabBarBg,
          paddingBottom:    8,
          paddingTop:       6,
          height:           60,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Entries',
          tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="books"
        options={{
          title: 'Books',
          tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  )
}
