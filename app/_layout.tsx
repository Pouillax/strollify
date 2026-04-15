import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="route-options" />
        <Stack.Screen name="route-preview" />
        <Stack.Screen name="walk" />
        <Stack.Screen name="history" />
      </Stack>
      <StatusBar style="auto" />
    </GestureHandlerRootView>
  );
}
