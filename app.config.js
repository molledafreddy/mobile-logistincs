const { withAndroidManifest } = require('@expo/config-plugins');

const MAPS_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  'AIzaSyD7lNP6tvJ2stkFyRvGxzsq1PBt64YUQGU';

// Directly inject com.google.android.geo.API_KEY into AndroidManifest.xml.
// This bypasses Expo's internal config normalization path.
const withGoogleMapsApiKey = (config) =>
  withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (!app) return mod;

    // Remove any existing entry to avoid duplicates
    app['meta-data'] = (app['meta-data'] ?? []).filter(
      (item) => item.$?.['android:name'] !== 'com.google.android.geo.API_KEY'
    );

    app['meta-data'].push({
      $: {
        'android:name': 'com.google.android.geo.API_KEY',
        'android:value': MAPS_KEY,
      },
    });

    return mod;
  });

module.exports = ({ config }) =>
  withGoogleMapsApiKey({
    ...config,
    android: {
      ...config.android,
      googleMapsApiKey: MAPS_KEY,
    },
  });
