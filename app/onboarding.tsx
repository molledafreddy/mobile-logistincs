import { useState, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../src/components/ui/Button';
import { StorageService } from '../src/services/storage/storage.service';


// ─── Step definitions ────────────────────────────────────────────────────────

interface Step {
  key: string;
  icon: string;
  title: string;
  description: string;
  detail: string;
  cta: string;
  skipLabel?: string;
  onRequest: () => Promise<void>;
}

const buildSteps = (): Step[] => [
  {
    key: 'welcome',
    icon: '🚛',
    title: 'Bienvenido a Logistics',
    description:
      'Tu aplicación para gestionar entregas, pasajeros y gastos en tiempo real.',
    detail: 'Vamos a configurar algunos permisos para que puedas operar sin interrupciones.',
    cta: 'Comenzar',
    onRequest: async () => {},
  },
  {
    key: 'location',
    icon: '📍',
    title: 'Ubicación',
    description:
      'El tracking GPS se envía en tiempo real mientras conduces para que el dispatcher vea tu posición.',
    detail: 'El permiso de ubicación en segundo plano se solicitará cuando inicies tu primer run.',
    cta: 'Permitir ubicación',
    onRequest: async () => {
      await Location.requestForegroundPermissionsAsync();
    },
  },
  {
    key: 'notifications',
    icon: '🔔',
    title: 'Notificaciones',
    description:
      'Recibe alertas de nuevos runs asignados, mensajes del dispatcher y actualizaciones de tus gastos.',
    detail: 'Puedes activarlas más tarde desde Configuración.',
    cta: 'Activar notificaciones',
    skipLabel: 'Omitir por ahora',
    onRequest: async () => {
      await Notifications.requestPermissionsAsync();
    },
  },
  {
    key: 'camera',
    icon: '📸',
    title: 'Cámara',
    description:
      'Toma fotos de entrega como comprobante y adjunta recibos de gastos directamente desde la app.',
    detail: 'Siempre podrás usar la galería como alternativa si prefieres no dar acceso.',
    cta: 'Permitir cámara',
    skipLabel: 'Usar solo galería',
    onRequest: async () => {
      await ImagePicker.requestCameraPermissionsAsync();
    },
  },
];

// ─── Dot indicator ───────────────────────────────────────────────────────────

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <View className="flex-row items-center justify-center gap-x-2">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`rounded-full transition-all
            ${i === current ? 'w-6 h-2 bg-primary-500' : 'w-2 h-2 bg-surface-tertiary'}`}
        />
      ))}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const router = useRouter();
  const steps = buildSteps();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  const advance = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    if (isLast) {
      StorageService.setOnboarded().finally(() => {
        router.replace('/(app)/(tabs)/home');
      });
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleCTA = async () => {
    setIsLoading(true);
    try {
      await step.onRequest();
    } finally {
      setIsLoading(false);
    }
    advance();
  };

  const handleSkip = () => advance();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 justify-between pb-8 pt-12">
        {/* Content */}
        <Animated.View className="flex-1 items-center justify-center" style={{ opacity: fadeAnim }}>
          {/* Illustration */}
          <View className="w-28 h-28 bg-primary-50 rounded-full items-center justify-center mb-8">
            <Text style={{ fontSize: 52 }}>{step.icon}</Text>
          </View>

          {/* Texts */}
          <Text
            className="text-text-primary text-2xl font-bold text-center mb-3"
            style={{ fontFamily: 'Inter_700Bold' }}
          >
            {step.title}
          </Text>
          <Text
            className="text-text-secondary text-base text-center mb-4 leading-relaxed"
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            {step.description}
          </Text>

          {/* Detail box */}
          <View className="bg-surface-secondary rounded-2xl px-5 py-4 w-full">
            <Text
              className="text-text-muted text-sm text-center"
              style={{ fontFamily: 'Inter_400Regular' }}
            >
              {step.detail}
            </Text>
          </View>
        </Animated.View>

        {/* Bottom area */}
        <View className="gap-y-3">
          <StepDots total={steps.length} current={currentStep} />

          <Button fullWidth size="lg" loading={isLoading} onPress={handleCTA} className="mt-4">
            {step.cta}
          </Button>

          {step.skipLabel && (
            <TouchableOpacity onPress={handleSkip} className="items-center py-2">
              <Text
                className="text-text-muted text-sm"
                style={{ fontFamily: 'Inter_400Regular' }}
              >
                {step.skipLabel}
              </Text>
            </TouchableOpacity>
          )}

          {/* Step counter */}
          <Text
            className="text-text-muted text-xs text-center"
            style={{ fontFamily: 'Inter_400Regular' }}
          >
            {currentStep + 1} de {steps.length}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
