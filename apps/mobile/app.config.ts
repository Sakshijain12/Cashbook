// apps/mobile/app.config.ts
import { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name:            'CashBook',
  slug:            'cashbook',
  version:         '1.0.0',
  orientation:     'portrait',
  icon:            './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image:           './assets/splash.png',
    resizeMode:      'contain',
    backgroundColor: '#e4e8ee',
  },
  ios: {
    supportsTablet:   false,
    bundleIdentifier: 'com.sakshijain.cashbook',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1F5FA6',
    },
    package: 'com.sakshijain.cashbook',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-camera', { cameraPermission: 'Allow CashBook to access your camera to scan bills.' }],
    ['expo-image-picker', { photosPermission: 'Allow CashBook to access your photos to attach bills.' }],
  ],
  experiments: { typedRoutes: true },
  extra: { apiUrl: process.env.EXPO_PUBLIC_API_URL },
}

export default config
