import { View, Text, Linking, TouchableOpacity } from 'react-native';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

type PermissionType = 'location' | 'camera' | 'notifications';

const CONFIG: Record<
  PermissionType,
  { icon: string; title: string; reason: string; fallback?: string }
> = {
  location: {
    icon: '📍',
    title: 'Ubicación requerida',
    reason:
      'Necesitamos tu ubicación en segundo plano para enviar el tracking en tiempo real mientras conduces.',
    fallback: 'Sin este permiso el tracking GPS no funcionará durante el run.',
  },
  camera: {
    icon: '📸',
    title: 'Cámara requerida',
    reason: 'Necesitamos la cámara para tomar fotos de entrega y comprobantes de gastos.',
    fallback: 'Puedes seleccionar fotos desde tu galería como alternativa.',
  },
  notifications: {
    icon: '🔔',
    title: 'Notificaciones desactivadas',
    reason: 'Activa las notificaciones para recibir alertas de nuevos runs y mensajes.',
    fallback: 'Puedes continuar sin notificaciones, pero no recibirás alertas en tiempo real.',
  },
};

interface PermissionGateProps {
  type: PermissionType;
  /** Si true muestra el bloqueo; si false renderiza children normalmente */
  blocked: boolean;
  children: React.ReactNode;
  /** Acción alternativa (ej: abrir galería) cuando el permiso no es crítico */
  onFallback?: () => void;
  fallbackLabel?: string;
}

export function PermissionGate({
  type,
  blocked,
  children,
  onFallback,
  fallbackLabel,
}: PermissionGateProps) {
  if (!blocked) return <>{children}</>;

  const cfg = CONFIG[type];

  return (
    <View className="flex-1 bg-surface-secondary px-4 justify-center">
      <Card>
        <View className="items-center mb-4">
          <Text className="text-5xl mb-3">{cfg.icon}</Text>
          <Text
            className="text-text-primary text-lg font-bold text-center mb-2"
            style={{ fontFamily: 'Inter_700Bold' }}
          >
            {cfg.title}
          </Text>
          <Text
            className="text-text-secondary text-sm text-center"
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            {cfg.reason}
          </Text>
        </View>

        {cfg.fallback && (
          <View className="bg-amber-50 rounded-xl p-3 mb-4">
            <Text
              className="text-amber-700 text-xs text-center"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              {cfg.fallback}
            </Text>
          </View>
        )}

        <Button fullWidth onPress={() => Linking.openSettings()} className="mb-3">
          Abrir Configuración
        </Button>

        {onFallback && (
          <TouchableOpacity onPress={onFallback} className="items-center py-2">
            <Text
              className="text-primary-600 text-sm font-medium"
              style={{ fontFamily: 'Inter_500Medium' }}
            >
              {fallbackLabel ?? 'Usar alternativa'}
            </Text>
          </TouchableOpacity>
        )}
      </Card>
    </View>
  );
}
