import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tip.app',
  appName: 'Tip',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
