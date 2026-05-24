import { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Image, KeyboardAvoidingView, Platform, Linking, Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import type { SignatureViewRef } from 'react-native-signature-canvas';
// RNCWebViewModule may be absent if the build predates react-native-webview being added
let SignatureCanvas: React.ComponentType<any> = () => null;
try { SignatureCanvas = require('react-native-signature-canvas').default; } catch { /* needs new build */ }
import { DeliveryRunsService } from '../../../../../src/services/api/delivery-runs.service';
import { useDeliveryStop } from '../../../../../src/features/delivery-runs/useDeliveryStop';
import { useNetworkStatus } from '../../../../../src/features/tracking/useNetworkStatus';
import { usePlanPermission } from '../../../../../src/features/auth/usePlanPermission';
import { Button } from '../../../../../src/components/ui/Button';
import { Input } from '../../../../../src/components/ui/Input';
import { PermissionGate } from '../../../../../src/components/common/PermissionGate';
import { PhotoSourceSheet } from '../../../../../src/components/common/PhotoSourceSheet';

type Step = 'arrive' | 'notify' | 'photo' | 'signature' | 'incident' | 'done';

const TRACKING_BASE = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1').replace(/\/(api\/)?v\d+.*$/, '');

// ─── Offline banner ────────────────────────────────────────────────────────────

function OfflineBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <View className="bg-slate-800 px-4 py-2 flex-row items-center gap-x-2">
      <Text className="text-base">📡</Text>
      <Text className="text-white text-xs flex-1" style={{ fontFamily: 'Inter_400Regular' }}>
        Sin conexión — la entrega se guardará y enviará al reconectar
      </Text>
    </View>
  );
}

// ─── Signature step ────────────────────────────────────────────────────────────

interface SignatureStepProps {
  receiverName: string;
  notes: string;
  onReceiverNameChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onConfirm: (signatureBase64: string | null) => void;
  isLoading: boolean;
}

function SignatureStep({
  receiverName,
  notes,
  onReceiverNameChange,
  onNotesChange,
  onConfirm,
  isLoading,
}: SignatureStepProps) {
  const sigRef = useRef<SignatureViewRef>(null);
  const [isSigned, setIsSigned] = useState(false);
  const [capturedSig, setCapturedSig] = useState<string | null>(null);

  const handleOK = (sig: string) => { setCapturedSig(sig); };
  const handleBegin = () => setIsSigned(true);
  const handleClear = () => {
    setIsSigned(false);
    setCapturedSig(null);
    sigRef.current?.clearSignature();
  };

  const handleConfirm = () => {
    if (isSigned && !capturedSig) {
      sigRef.current?.readSignature();
      return;
    }
    onConfirm(capturedSig);
  };

  const webStyle = `
    .m-signature-pad { box-shadow: none; border: none; background: transparent; }
    .m-signature-pad--body { border: none; background: transparent; }
    .m-signature-pad--footer { display: none; margin: 0; padding: 0; }
    body { background: transparent; }
  `;

  return (
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text className="text-2xl font-bold text-text-primary mb-2" style={{ fontFamily: 'Inter_700Bold' }}>
          Datos del receptor
        </Text>
        <Text className="text-text-secondary mb-5" style={{ fontFamily: 'Inter_400Regular' }}>
          Registra quién recibió el paquete y solicita su firma.
        </Text>

        <Input
          label="Nombre del receptor (opcional)"
          placeholder="Nombre completo"
          value={receiverName}
          onChangeText={onReceiverNameChange}
          returnKeyType="next"
          className="mb-4"
        />

        <Input
          label="Notas adicionales (opcional)"
          placeholder="Ej: dejado en recepción, firmado por..."
          value={notes}
          onChangeText={onNotesChange}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
          className="mb-5 min-h-[64px]"
        />

        <Text className="text-sm text-text-secondary font-medium mb-2" style={{ fontFamily: 'Inter_500Medium' }}>
          Firma del receptor (opcional)
        </Text>

        <View className="border border-border rounded-2xl overflow-hidden mb-1 bg-white">
          {capturedSig ? (
            <View className="h-40 items-center justify-center bg-white">
              <Image source={{ uri: capturedSig }} className="w-full h-36" resizeMode="contain" />
            </View>
          ) : (
            <SignatureCanvas
              ref={sigRef}
              onOK={handleOK}
              onBegin={handleBegin}
              webStyle={webStyle}
              backgroundColor="white"
              penColor="#1e293b"
              style={{ height: 160, width: '100%' }}
            />
          )}
        </View>

        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
            {capturedSig ? '✓ Firma capturada' : isSigned ? 'Firma en progreso...' : 'Dibuja la firma en el recuadro'}
          </Text>
          {(isSigned || capturedSig) && (
            <TouchableOpacity onPress={handleClear}>
              <Text className="text-primary-600 text-xs font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
                Limpiar
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Button fullWidth size="lg" loading={isLoading} onPress={handleConfirm}>
          {isLoading ? 'Procesando...' : '✅ Confirmar entrega'}
        </Button>

        <View className="h-6" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Notify step ──────────────────────────────────────────────────────────────

interface NotifyStepProps {
  trackingUrl: string | null;
  contactPhone?: string;
  contactName?: string;
  isPassenger: boolean;
  onContinue: () => void;
}

function NotifyStep({ trackingUrl, contactPhone, contactName, isPassenger, onContinue }: NotifyStepProps) {
  const greeting = contactName ? `, ${contactName}` : '';
  const message = isPassenger
    ? `Hola${greeting} 👋 El traslado está en camino.\n\nSigue el avance en tiempo real:\n\n${trackingUrl}`
    : `Hola${greeting} 👋 Tu pedido está en camino 🚚\n\nSigue el avance en tiempo real:\n\n${trackingUrl}`;

  const copyLink = () => {
    if (!trackingUrl) return;
    Share.share({ message: trackingUrl, url: trackingUrl });
  };

  const openWhatsApp = async () => {
    if (!contactPhone) return;
    const phone = contactPhone.replace(/[^0-9+]/g, '');
    const native = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;
    const web    = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(native);
    Linking.openURL(canOpen ? native : web);
  };

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 22, fontFamily: 'Inter_700Bold', color: '#0f172a', marginBottom: 6 }}>
        Notificar al cliente
      </Text>
      <Text style={{ fontSize: 14, fontFamily: 'Inter_400Regular', color: '#64748b', marginBottom: 20, lineHeight: 20 }}>
        {isPassenger
          ? 'Avisa que el traslado está en camino con el link de seguimiento.'
          : 'Avisa que el pedido está en camino con el link de seguimiento.'}
      </Text>

      {/* Tracking link card */}
      {trackingUrl ? (
        <View style={{ backgroundColor: '#f0fdf4', borderRadius: 14, borderWidth: 1, borderColor: '#86efac', padding: 14, marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: '#15803d', marginBottom: 6 }}>
            🔗 Link de seguimiento
          </Text>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#166534', lineHeight: 18, marginBottom: 10 }} numberOfLines={2}>
            {trackingUrl}
          </Text>
          <TouchableOpacity
            onPress={copyLink}
            activeOpacity={0.75}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 9, borderWidth: 1, borderColor: '#bbf7d0' }}
          >
            <Text style={{ fontSize: 14 }}>📋</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#16a34a' }}>
              Compartir link
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ backgroundColor: '#fef2f2', borderRadius: 14, borderWidth: 1, borderColor: '#fecaca', padding: 14, marginBottom: 12 }}>
          <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: '#b91c1c' }}>
            Este envío no tiene token de seguimiento generado.
          </Text>
        </View>
      )}

      {/* Message preview */}
      <View style={{ backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginBottom: 16 }}>
        <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: '#94a3b8', marginBottom: 6 }}>
          MENSAJE A ENVIAR
        </Text>
        <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: '#334155', lineHeight: 18 }}>
          {message}
        </Text>
      </View>

      {/* WhatsApp button */}
      {contactPhone ? (
        <TouchableOpacity
          onPress={openWhatsApp}
          activeOpacity={0.8}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#25D366', borderRadius: 14, paddingVertical: 16, marginBottom: 12 }}
        >
          <Text style={{ fontSize: 22 }}>💬</Text>
          <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: '#fff' }}>
            Enviar por WhatsApp
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={{ backgroundColor: '#f1f5f9', borderRadius: 14, padding: 14, marginBottom: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: '#94a3b8' }}>
            Sin teléfono de contacto registrado
          </Text>
        </View>
      )}

      <TouchableOpacity
        onPress={onContinue}
        activeOpacity={0.7}
        style={{ alignItems: 'center', paddingVertical: 14 }}
      >
        <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: '#64748b' }}>
          Omitir y continuar →
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function StopDeliveryScreen() {
  const { runId, stopId, initialStep } = useLocalSearchParams<{ runId: string; stopId: string; initialStep?: string }>();
  const router = useRouter();
  const { isOnline } = useNetworkStatus();

  const photoSheetRef = useRef<BottomSheetModalMethods>(null);
  const queryClient = useQueryClient();

  // Determine initial step from cache to avoid notify flash on re-open.
  const [step, setStep] = useState<Step>(() => {
    if (initialStep === 'incident') return 'incident';
    const cached = queryClient.getQueryData<any>(['delivery-runs', runId]);
    const cachedStop = cached?.stops?.find((s: any) => s.id === stopId);
    if (cachedStop?.status === 'in_transit') return 'arrive';
    if (cachedStop?.status === 'arrived')    return 'photo';
    return 'notify';
  });

  const [photos, setPhotos] = useState<string[]>([]);
  const [receiverName, setReceiverName] = useState('');
  const [notes, setNotes] = useState('');
  const [cameraBlocked, setCameraBlocked] = useState(false);

  const { arrive, deliver, fail, isArriving, isDelivering, isFailing, isUploading } = useDeliveryStop(runId, stopId);
  const hasPublicLink = usePlanPermission('tracking.public_link');

  const [incidentReason, setIncidentReason] = useState('');
  const [incidentPhoto, setIncidentPhoto] = useState<string | undefined>();

  const { data: run } = useQuery({
    queryKey: ['delivery-runs', runId],
    queryFn: () => DeliveryRunsService.getRunById(runId),
  });

  const stop = run?.stops.find((s) => s.id === stopId);

  // Auto-transit: persist "En camino" state as soon as the screen opens so
  // restarting the app doesn't lose the in-progress status for this stop.
  const autoTransitRef = useRef(false);
  useEffect(() => {
    if (autoTransitRef.current) return;
    if (!stop || stop.status !== 'pending' || run?.status !== 'in_progress') return;
    autoTransitRef.current = true;
    DeliveryRunsService.startTransit(runId, stopId)
      .then((updatedStop) => {
        queryClient.setQueryData(['delivery-runs', runId], (prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            stops: prev.stops.map((s: any) => s.id === stopId ? { ...s, ...updatedStop } : s),
          };
        });
      })
      .catch(() => {}); // silently ignore if run isn't started yet
  }, [stop?.status, run?.status]);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setCameraBlocked(true);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
      setCameraBlocked(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const removePhoto = (uri: string) => setPhotos((prev) => prev.filter((p) => p !== uri));

  // ─── Step indicator ─────────────────────────────────────────────────────────

  const STEP_ORDER: Step[] = ['arrive', 'photo', 'signature'];

  const StepIndicator = () => (
    <View className="flex-row items-center justify-center mb-6 gap-x-2">
      {STEP_ORDER.map((s, idx) => (
        <View key={s} className="flex-row items-center">
          <View
            className={`w-7 h-7 rounded-full items-center justify-center ${
              step === s
                ? 'bg-primary-500'
                : STEP_ORDER.indexOf(step) > idx
                ? 'bg-primary-200'
                : 'bg-surface-tertiary'
            }`}
          >
            <Text
              className={`text-xs font-bold ${
                step === s ? 'text-white' : STEP_ORDER.indexOf(step) > idx ? 'text-primary-600' : 'text-text-muted'
              }`}
              style={{ fontFamily: 'Inter_700Bold' }}
            >
              {idx + 1}
            </Text>
          </View>
          {idx < STEP_ORDER.length - 1 && (
            <View
              className={`w-8 h-0.5 mx-1 ${STEP_ORDER.indexOf(step) > idx ? 'bg-primary-300' : 'bg-surface-tertiary'}`}
            />
          )}
        </View>
      ))}
    </View>
  );

  // ─── Arrive step ────────────────────────────────────────────────────────────

  const ArrivedStep = () => (
    <View className="flex-1">
      {run?.status !== 'in_progress' && (
        <View style={{ backgroundColor: '#fef3c7', borderRadius: 12, borderWidth: 1, borderColor: '#fcd34d', padding: 12, marginBottom: 16, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Text style={{ fontSize: 18 }}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#92400e', marginBottom: 2 }}>
              El run no está iniciado
            </Text>
            <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#78350f', lineHeight: 17 }}>
              Debes iniciar el run desde la pantalla anterior antes de registrar entregas.
            </Text>
          </View>
        </View>
      )}
      <Text className="text-2xl font-bold text-text-primary mb-2" style={{ fontFamily: 'Inter_700Bold' }}>
        Confirmar llegada
      </Text>
      <Text className="text-text-secondary mb-6" style={{ fontFamily: 'Inter_400Regular' }}>
        Confirma que llegaste al punto de entrega.
      </Text>

      <View className="bg-surface-secondary rounded-2xl p-4 mb-6 border border-border">
        <Text className="text-xs text-text-muted mb-1" style={{ fontFamily: 'Inter_400Regular' }}>
          Dirección
        </Text>
        <Text className="text-text-primary font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
          {stop?.address ?? '—'}
        </Text>
        {stop?.contactName && (
          <>
            <Text className="text-xs text-text-muted mt-3 mb-1" style={{ fontFamily: 'Inter_400Regular' }}>
              Contacto
            </Text>
            <Text className="text-text-primary font-medium" style={{ fontFamily: 'Inter_500Medium' }}>
              {stop.contactName}
            </Text>
          </>
        )}
        {stop?.contactPhone && (
          <Text className="text-primary-600 text-sm mt-1" style={{ fontFamily: 'Inter_400Regular' }}>
            📞 {stop.contactPhone}
          </Text>
        )}
        {stop?.notes && (
          <>
            <Text className="text-xs text-text-muted mt-3 mb-1" style={{ fontFamily: 'Inter_400Regular' }}>
              Notas
            </Text>
            <Text className="text-text-secondary text-sm" style={{ fontFamily: 'Inter_400Regular' }}>
              {stop.notes}
            </Text>
          </>
        )}
      </View>

      {stop && stop.lat !== 0 && stop.lng !== 0 && (
        <TouchableOpacity
          onPress={() => {
            const { Alert: RNAlert } = require('react-native');
            RNAlert.alert(
              '🧭 Navegar al destino',
              stop.address,
              [
                {
                  text: 'Google Maps',
                  onPress: async () => {
                    const native = `comgooglemaps://?daddr=${stop.lat},${stop.lng}&directionsmode=driving`;
                    const web    = `https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`;
                    const canOpen = await Linking.canOpenURL(native);
                    Linking.openURL(canOpen ? native : web);
                  },
                },
                {
                  text: 'Waze',
                  onPress: async () => {
                    const native = `waze://ul?ll=${stop.lat},${stop.lng}&navigate=yes`;
                    const web    = `https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes&q=${encodeURIComponent(stop.address)}`;
                    const canOpen = await Linking.canOpenURL(native);
                    Linking.openURL(canOpen ? native : web);
                  },
                },
                { text: 'Cancelar', style: 'cancel' },
              ]
            );
          }}
          activeOpacity={0.75}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' }}
        >
          <Text style={{ fontSize: 16 }}>🧭</Text>
          <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#334155' }}>
            Cómo llegar
          </Text>
        </TouchableOpacity>
      )}

      <Button
        fullWidth
        size="lg"
        loading={isArriving}
        onPress={() => arrive(undefined, { onSuccess: () => setStep('photo') })}
        className="mb-3"
      >
        📍 Confirmar llegada
      </Button>

      <Button
        fullWidth
        size="lg"
        variant="ghost"
        onPress={() => setStep('incident')}
      >
        ⚠️ No puedo entregar
      </Button>

      {hasPublicLink && stop?.contactPhone && stop?.publicTrackingToken && (
        <TouchableOpacity
          onPress={async () => {
            const trackingUrl = `${TRACKING_BASE}/tracking/${stop.publicTrackingToken}`;
            const greeting = stop.contactName ? `, ${stop.contactName}` : '';
            const msg = stop.cargoType === 'passenger'
              ? `Hola${greeting} 👋 El traslado está en camino.\n\nSigue el avance en tiempo real:\n\n${trackingUrl}`
              : `Hola${greeting} 👋 Tu pedido está en camino 🚚\n\nSigue el avance en tiempo real:\n\n${trackingUrl}`;
            const phone = stop.contactPhone!.replace(/[^0-9+]/g, '');
            const native = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`;
            const web    = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
            const canOpen = await Linking.canOpenURL(native);
            Linking.openURL(canOpen ? native : web);
          }}
          activeOpacity={0.75}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#86efac', backgroundColor: '#f0fdf4' }}
        >
          <Text style={{ fontSize: 16 }}>💬</Text>
          <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#15803d' }}>
            Reenviar link de seguimiento
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ─── Photo step ─────────────────────────────────────────────────────────────

  const PhotoStep = () => (
    <PermissionGate type="camera" blocked={cameraBlocked} onFallback={pickFromLibrary} fallbackLabel="Seleccionar desde galería">
      <View className="flex-1">
        <Text className="text-2xl font-bold text-text-primary mb-2" style={{ fontFamily: 'Inter_700Bold' }}>
          Foto de entrega
        </Text>
        <Text className="text-text-secondary mb-4" style={{ fontFamily: 'Inter_400Regular' }}>
          Toma al menos una foto de la mercancía entregada.
        </Text>

        <View className="flex-row flex-wrap gap-2 mb-4">
          {photos.map((uri) => (
            <View key={uri} className="relative">
              <Image source={{ uri }} className="w-24 h-24 rounded-xl" />
              <TouchableOpacity
                onPress={() => removePhoto(uri)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full items-center justify-center"
              >
                <Text className="text-white text-xs font-bold">✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          {photos.length < 5 && (
            <TouchableOpacity
              onPress={() => photoSheetRef.current?.present()}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-primary-300 items-center justify-center bg-primary-50"
            >
              <Text className="text-3xl">📸</Text>
              <Text className="text-primary-600 text-xs mt-1" style={{ fontFamily: 'Inter_500Medium' }}>
                {photos.length === 0 ? 'Tomar foto' : 'Agregar'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text className="text-text-muted text-xs mb-6" style={{ fontFamily: 'Inter_400Regular' }}>
          {photos.length}/5 fotos · {photos.length === 0 ? 'Mínimo 1 requerida' : 'Listo para continuar'}
        </Text>

        <Button fullWidth size="lg" disabled={photos.length === 0} onPress={() => setStep('signature')}>
          Continuar → Firma
        </Button>

        <Button fullWidth size="lg" variant="ghost" onPress={() => setStep('incident')} className="mt-2">
          ⚠️ No pude entregar
        </Button>

        {hasPublicLink && stop?.contactPhone && stop?.publicTrackingToken && (
          <TouchableOpacity
            onPress={async () => {
              const trackingUrl = `${TRACKING_BASE}/tracking/${stop.publicTrackingToken}`;
              const greeting = stop.contactName ? `, ${stop.contactName}` : '';
              const msg = stop.cargoType === 'passenger'
                ? `Hola${greeting} 👋 Ya llegamos a tu punto de destino. En breve estaremos contigo 🚗\n\nSigue el estado aquí:\n\n${trackingUrl}`
                : `Hola${greeting} 👋 Ya llegamos a tu dirección. En breve recibirás tu paquete 📦\n\nSigue el estado aquí:\n\n${trackingUrl}`;
              const phone = stop.contactPhone!.replace(/[^0-9+]/g, '');
              const native = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(msg)}`;
              const web    = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
              const canOpen = await Linking.canOpenURL(native);
              Linking.openURL(canOpen ? native : web);
            }}
            activeOpacity={0.75}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#86efac', backgroundColor: '#f0fdf4' }}
          >
            <Text style={{ fontSize: 16 }}>💬</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#15803d' }}>
              Avisar que ya llegamos
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </PermissionGate>
  );

  // ─── Incident step ──────────────────────────────────────────────────────────

  const IncidentStep = () => {
    const takeIncidentPhoto = async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return;
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled && result.assets[0]) {
        setIncidentPhoto(result.assets[0].uri);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    };

    return (
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text className="text-2xl font-bold text-text-primary mb-2" style={{ fontFamily: 'Inter_700Bold' }}>
            Reportar incidente
          </Text>
          <Text className="text-text-secondary mb-5" style={{ fontFamily: 'Inter_400Regular' }}>
            Indica por qué no se pudo completar la entrega.
          </Text>

          <Input
            label="Motivo (requerido)"
            placeholder="Ej: nadie en casa, dirección incorrecta..."
            value={incidentReason}
            onChangeText={setIncidentReason}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            className="mb-5 min-h-[80px]"
          />

          <Text className="text-sm text-text-secondary font-medium mb-2" style={{ fontFamily: 'Inter_500Medium' }}>
            Foto del lugar (opcional)
          </Text>

          {incidentPhoto ? (
            <View className="relative mb-5 self-start">
              <Image source={{ uri: incidentPhoto }} className="w-32 h-32 rounded-xl" />
              <TouchableOpacity
                onPress={() => setIncidentPhoto(undefined)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full items-center justify-center"
              >
                <Text className="text-white text-xs font-bold">✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={takeIncidentPhoto}
              className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-300 items-center justify-center bg-slate-50 mb-5"
            >
              <Text className="text-3xl">📷</Text>
              <Text className="text-slate-500 text-xs mt-1" style={{ fontFamily: 'Inter_500Medium' }}>
                Agregar foto
              </Text>
            </TouchableOpacity>
          )}

          <Button
            fullWidth
            size="lg"
            loading={isFailing}
            disabled={!incidentReason.trim()}
            onPress={() =>
              fail(
                { reason: incidentReason.trim(), photoUri: incidentPhoto },
                { onSuccess: () => setStep('done') }
              )
            }
          >
            {isFailing ? 'Reportando...' : '⚠️ Confirmar incidente'}
          </Button>

          <View className="h-6" />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  // ─── Done step ──────────────────────────────────────────────────────────────

  const DoneStep = () => (
    <View className="flex-1 items-center justify-center">
      <View className="w-24 h-24 bg-primary-100 rounded-full items-center justify-center mb-6">
        <Text className="text-5xl">✅</Text>
      </View>
      <Text className="text-2xl font-bold text-text-primary mb-2 text-center" style={{ fontFamily: 'Inter_700Bold' }}>
        ¡Entrega completada!
      </Text>
      <Text className="text-text-secondary text-center mb-8" style={{ fontFamily: 'Inter_400Regular' }}>
        La parada fue registrada correctamente.
      </Text>
      <Button fullWidth size="lg" onPress={() => router.back()}>
        Volver al run
      </Button>
    </View>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  const isPending = isArriving || isDelivering || isUploading || isFailing;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-4 pt-4 pb-3 border-b border-border">
        <TouchableOpacity
          onPress={() => {
            if (step === 'notify') router.back();
            else if (step === 'arrive') setStep('notify');
            else if (step === 'incident') setStep('arrive');
            else setStep('arrive');
          }}
          className="mr-3"
          disabled={step === 'done' || isPending}
        >
          <Text
            className={`font-medium ${step === 'done' || isPending ? 'text-transparent' : 'text-primary-600'}`}
            style={{ fontFamily: 'Inter_500Medium' }}
          >
            ← Atrás
          </Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center text-text-primary font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
          {step === 'notify' ? 'Iniciar entrega' : `Parada · ${stop?.type === 'pickup' ? 'Recogida' : 'Entrega'}`}
        </Text>
        <View className="w-12" />
      </View>

      <OfflineBanner visible={!isOnline} />

      <View className="flex-1 px-6 pt-6 pb-4">
        {step !== 'done' && step !== 'incident' && step !== 'notify' && <StepIndicator />}

        {step === 'arrive' && <ArrivedStep />}
        {step === 'notify' && (
          <NotifyStep
            trackingUrl={hasPublicLink && stop?.publicTrackingToken ? `${TRACKING_BASE}/tracking/${stop.publicTrackingToken}` : null}
            contactPhone={stop?.contactPhone}
            contactName={stop?.contactName}
            isPassenger={stop?.cargoType === 'passenger'}
            onContinue={() => setStep('arrive')}
          />
        )}
        {step === 'incident' && <IncidentStep />}
        {step === 'photo' && <PhotoStep />}
        {step === 'signature' && (
          <SignatureStep
            receiverName={receiverName}
            notes={notes}
            onReceiverNameChange={setReceiverName}
            onNotesChange={setNotes}
            isLoading={isPending}
            onConfirm={(sig) =>
              deliver(
                { photoUris: photos, receiverName: receiverName.trim() || undefined, notes: notes.trim() || undefined, signatureBase64: sig },
                { onSuccess: () => setStep('done') }
              )
            }
          />
        )}
        {step === 'done' && <DoneStep />}
      </View>

      <PhotoSourceSheet sheetRef={photoSheetRef} onCamera={takePhoto} onGallery={pickFromLibrary} />
    </SafeAreaView>
  );
}
