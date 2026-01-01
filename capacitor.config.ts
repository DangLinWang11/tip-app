import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tip.app',
  appName: 'Tip',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    GoogleAuth: {
      scopes: ['profile', 'email'],
      serverClientId: '279316450534-fo43car2agmbd1p4uujgsoqegkjkb9b6.apps.googleusercontent.com',
      forceCodeForRefreshToken: true,
    }
  }
};

export default config;
