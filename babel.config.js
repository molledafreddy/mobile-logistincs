module.exports = function (api) {
  api.cache.using(() => process.env.NODE_ENV);
  const isTest = process.env.NODE_ENV === 'test';
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          jsxImportSource: isTest ? 'react' : 'nativewind',
          // Reanimated plugin requires react-native-worklets which isn't available in jest
          ...(isTest ? { reanimated: false } : {}),
        },
      ],
      ...(isTest ? [] : ['nativewind/babel']),
    ],
  };
};
