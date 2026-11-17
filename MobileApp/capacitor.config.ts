import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ameer.restaurantmobile',
  appName: 'SmartDine',
  webDir: 'www',
  server: {
    // Origin http://localhost (allowed by the API's CORS); plain http to the restaurant's LAN server.
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    webContentsDebuggingEnabled: false,
  },
};

export default config;
