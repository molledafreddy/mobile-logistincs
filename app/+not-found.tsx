import { View, Text } from 'react-native';
import { Link, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotFoundScreen() {
  const path = usePathname();

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary items-center justify-center px-8">
      <Text className="text-6xl mb-4">🔍</Text>
      <Text
        className="text-text-primary text-xl font-bold text-center mb-2"
        style={{ fontFamily: 'Inter_700Bold' }}
      >
        Pantalla no encontrada
      </Text>
      <Text
        className="text-text-muted text-sm text-center mb-8"
        style={{ fontFamily: 'Inter_400Regular' }}
      >
        La ruta{' '}
        <Text className="text-text-secondary font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
          {path}
        </Text>{' '}
        no existe.
      </Text>
      <Link href="/(app)/(tabs)/home" asChild>
        <Text
          className="text-primary-600 font-semibold text-base"
          style={{ fontFamily: 'Inter_600SemiBold' }}
        >
          ← Volver al inicio
        </Text>
      </Link>
    </SafeAreaView>
  );
}
