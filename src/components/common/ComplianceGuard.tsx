import { View, Text, ActivityIndicator } from 'react-native';
import { useComplianceCheck } from '../../features/delivery-runs/useComplianceCheck';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useRouter } from 'expo-router';

interface ComplianceGuardProps {
  children: React.ReactNode;
  /** Si es false, el guard siempre renderiza children (modo bypass para freight) */
  required?: boolean;
}

/**
 * Envuelve una pantalla o flujo que requiere tier passenger_safe vigente.
 * Si el compliance no está OK, muestra un bloqueo claro con acción.
 */
export function ComplianceGuard({ children, required = true }: ComplianceGuardProps) {
  const router = useRouter();
  const { isLoading, canOperate, blockMessage, compliance } = useComplianceCheck(required);

  if (!required) return <>{children}</>;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-secondary">
        <ActivityIndicator color="#22c55e" />
        <Text className="text-text-muted mt-3 text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
          Verificando habilitación...
        </Text>
      </View>
    );
  }

  if (!canOperate) {
    const missing = compliance?.missingDocuments ?? [];

    return (
      <View className="flex-1 bg-surface-secondary px-4 justify-center">
        <Card>
          <View className="items-center mb-4">
            <Text className="text-5xl mb-3">🚫</Text>
            <Text
              className="text-text-primary text-lg font-bold text-center mb-2"
              style={{ fontFamily: 'Inter_700Bold' }}
            >
              Operación bloqueada
            </Text>
            <Text
              className="text-text-secondary text-sm text-center"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              {blockMessage}
            </Text>
          </View>

          {missing.length > 0 && (
            <View className="bg-amber-50 rounded-xl p-3 mb-4">
              <Text
                className="text-amber-700 text-xs font-semibold mb-2"
                style={{ fontFamily: 'Inter_600SemiBold' }}
              >
                Documentos faltantes:
              </Text>
              {missing.map((doc) => (
                <View key={doc} className="flex-row items-center mb-1">
                  <Text className="text-amber-500 mr-2 text-xs">•</Text>
                  <Text
                    className="text-amber-700 text-xs"
                    style={{ fontFamily: 'Inter_400Regular' }}
                  >
                    {doc.replace(/_/g, ' ')}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <Button
            variant="outline"
            fullWidth
            onPress={() => router.back()}
          >
            Volver
          </Button>
        </Card>
      </View>
    );
  }

  return <>{children}</>;
}
