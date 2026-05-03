import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vtech.pro',
  appName: 'V-Tech PRO',
  webDir: 'out',
  server: {
    url: 'https://vtech-next.vercel.app',
    cleartext: true
  }
};

export default config;
