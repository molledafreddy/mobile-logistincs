import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../../src/stores/auth.store';
import { VerificationsService } from '../../../src/services/api/verifications.service';
import type { Verification, VerificationTier } from '../../../src/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_LABEL: Record<string, string> = {
  rut:                   'RUT / RFC',
  tax_id:                'Identificación fiscal',
  insurance:             'Seguro vehicular',
  driver_license:        'Licencia de conducir',
  vehicle_registration:  'Tarjeta de circulación',
  permit:                'Permiso de operación',
  other:                 'Otro documento',
};

const DOC_ICON: Record<string, string> = {
  rut:                  '🪪',
  tax_id:               '📋',
  insurance:            '🛡️',
  driver_license:       '🚗',
  vehicle_registration: '📄',
  permit:               '✅',
  other:                '📎',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pendiente',   color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  in_review: { label: 'En revisión', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  approved:  { label: 'Aprobada',    color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  rejected:  { label: 'Rechazada',   color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
  expired:   { label: 'Vencida',     color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function docLabel(type: string) {
  return DOC_LABEL[type] ?? type;
}

function docIcon(type: string) {
  return DOC_ICON[type] ?? '📎';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ComplianceBanner({ canOperate, currentTier, blockReason }: {
  canOperate: boolean;
  currentTier: string | null;
  blockReason?: string;
}) {
  if (canOperate) {
    return (
      <View className="flex-row items-center bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mb-4 gap-x-3">
        <Text className="text-2xl">✅</Text>
        <View className="flex-1">
          <Text className="text-green-700 font-semibold text-sm" style={{ fontFamily: 'Inter_600SemiBold' }}>
            Empresa verificada
          </Text>
          {currentTier && (
            <Text className="text-green-600 text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
              Nivel: {currentTier}
            </Text>
          )}
        </View>
      </View>
    );
  }

  const reasonMsg: Record<string, string> = {
    no_verification:  'No tienes ninguna verificación activa',
    tier_not_approved: 'Tu verificación aún no ha sido aprobada',
    tier_expired:     'Tu verificación venció, renuévala',
  };

  return (
    <View className="flex-row items-center bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4 gap-x-3">
      <Text className="text-2xl">⚠️</Text>
      <View className="flex-1">
        <Text className="text-amber-700 font-semibold text-sm" style={{ fontFamily: 'Inter_600SemiBold' }}>
          Verificación requerida
        </Text>
        <Text className="text-amber-600 text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
          {blockReason ? (reasonMsg[blockReason] ?? blockReason) : 'Completa el proceso para operar'}
        </Text>
      </View>
    </View>
  );
}

function DocRow({ type, uploaded }: { type: string; uploaded: boolean }) {
  return (
    <View className="flex-row items-center py-2.5 border-b border-border last:border-0">
      <Text className="text-base mr-2">{docIcon(type)}</Text>
      <Text className="flex-1 text-text-primary text-sm" style={{ fontFamily: 'Inter_500Medium' }}>
        {docLabel(type)}
      </Text>
      {uploaded ? (
        <View className="bg-green-100 rounded-full px-2 py-0.5">
          <Text className="text-green-700 text-xs" style={{ fontFamily: 'Inter_600SemiBold' }}>Subido</Text>
        </View>
      ) : (
        <View className="bg-amber-100 rounded-full px-2 py-0.5">
          <Text className="text-amber-700 text-xs" style={{ fontFamily: 'Inter_600SemiBold' }}>Faltante</Text>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function VerificationScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? '';

  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

  // ── Queries ──
  const {
    data: compliance,
    isLoading: complianceLoading,
    refetch: refetchCompliance,
    isRefetching: complianceRefetching,
  } = useQuery({
    queryKey: ['verifications', 'compliance', companyId],
    queryFn: () => VerificationsService.getCompliance(companyId),
    enabled: !!companyId,
    staleTime: 2 * 60_000,
  });

  const {
    data: verifications,
    isLoading: verificationsLoading,
    refetch: refetchVerifications,
    isRefetching: verificationsRefetching,
  } = useQuery({
    queryKey: ['verifications', 'company', companyId],
    queryFn: () => VerificationsService.getCompanyVerifications(companyId),
    enabled: !!companyId,
    staleTime: 2 * 60_000,
  });

  const {
    data: tiers,
    isLoading: tiersLoading,
  } = useQuery({
    queryKey: ['verifications', 'tiers'],
    queryFn: () => VerificationsService.getTiers(),
    staleTime: 10 * 60_000,
  });

  const isLoading = complianceLoading || verificationsLoading || tiersLoading;
  const isRefreshing = complianceRefetching || verificationsRefetching;

  const refetch = () => {
    refetchCompliance();
    refetchVerifications();
  };

  // ── Derived state ──
  const activeVerification: Verification | null =
    verifications?.find((v) => v.status === 'pending' || v.status === 'in_review') ??
    verifications?.[0] ??
    null;

  const uploadedTypes = new Set(
    (activeVerification?.documents ?? []).map((d) => d.type)
  );

  const requiredTierCode = compliance?.requiredTier ?? null;
  const requiredTier: VerificationTier | null =
    tiers?.find((t) => t.code === requiredTierCode) ?? tiers?.[0] ?? null;

  // ── Create verification mutation ──
  const createMutation = useMutation({
    mutationFn: () => VerificationsService.createVerification(companyId, requiredTier!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verifications', 'company', companyId] });
    },
    onError: () => Alert.alert('Error', 'No se pudo iniciar la verificación. Intenta de nuevo.'),
  });

  // ── Upload document mutation ──
  const uploadMutation = useMutation({
    mutationFn: async ({ verificationId, docType, uri }: {
      verificationId: string;
      docType: string;
      uri: string;
    }) => {
      const { url } = await VerificationsService.uploadFile(uri, docType);
      return VerificationsService.addDocument(verificationId, {
        type: docType,
        url,
        name: docLabel(docType),
      });
    },
    onSuccess: () => {
      setUploadingDocType(null);
      queryClient.invalidateQueries({ queryKey: ['verifications', 'company', companyId] });
      queryClient.invalidateQueries({ queryKey: ['verifications', 'compliance', companyId] });
      Alert.alert('Documento subido', 'El documento fue enviado correctamente.');
    },
    onError: () => {
      setUploadingDocType(null);
      Alert.alert('Error', 'No se pudo subir el documento. Intenta de nuevo.');
    },
  });

  // ── Upload flow ──
  const pickAndUpload = async (docType: string, verificationId: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Activa el acceso a la galería en Configuración.');
      return;
    }

    Alert.alert(
      'Subir documento',
      `${docLabel(docType)} — elige la fuente`,
      [
        {
          text: 'Cámara',
          onPress: async () => {
            const camStatus = await ImagePicker.requestCameraPermissionsAsync();
            if (camStatus.status !== 'granted') {
              Alert.alert('Permiso denegado', 'Activa el acceso a la cámara en Configuración.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({ quality: 0.8, mediaTypes: ['images'] });
            if (!result.canceled) {
              setUploadingDocType(docType);
              uploadMutation.mutate({ verificationId, docType, uri: result.assets[0].uri });
            }
          },
        },
        {
          text: 'Galería',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ['images'] });
            if (!result.canceled) {
              setUploadingDocType(docType);
              uploadMutation.mutate({ verificationId, docType, uri: result.assets[0].uri });
            }
          },
        },
        { text: 'Cancelar', style: 'cancel' },
      ]
    );
  };

  const handleCreate = () => {
    if (!requiredTier) {
      Alert.alert('Sin tiers', 'No hay niveles de verificación disponibles.');
      return;
    }
    Alert.alert(
      'Iniciar verificación',
      `Se iniciará el proceso de verificación "${requiredTier.name}". ¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Iniciar', onPress: () => createMutation.mutate() },
      ]
    );
  };

  // ── Render ──
  return (
    <SafeAreaView className="flex-1 bg-surface-secondary">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-4 pb-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 bg-white rounded-full items-center justify-center border border-border mr-3"
        >
          <Text className="text-text-primary">←</Text>
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-text-primary text-lg font-bold" style={{ fontFamily: 'Inter_700Bold' }}>
            Verificación
          </Text>
          <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
            Documentos de empresa
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#22c55e" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 pb-10"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={refetch} tintColor="#22c55e" />
          }
        >
          {/* Compliance banner */}
          {compliance && (
            <View className="mt-4">
              <ComplianceBanner
                canOperate={compliance.canOperate}
                currentTier={compliance.currentTier}
                blockReason={compliance.blockReason}
              />
            </View>
          )}

          {/* Missing documents hint */}
          {compliance && !compliance.canOperate && compliance.missingDocuments.length > 0 && (
            <View className="bg-white rounded-2xl border border-border p-4 mb-4">
              <Text className="text-text-secondary text-sm font-semibold mb-2" style={{ fontFamily: 'Inter_600SemiBold' }}>
                Documentos requeridos
              </Text>
              {compliance.missingDocuments.map((doc) => (
                <DocRow key={doc} type={doc} uploaded={uploadedTypes.has(doc)} />
              ))}
            </View>
          )}

          {/* Active verification */}
          {activeVerification ? (
            <>
              {/* Status card */}
              <View className={`rounded-2xl border p-4 mb-4 ${STATUS_CONFIG[activeVerification.status]?.bg ?? 'bg-white border-border'}`}>
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-text-primary font-semibold text-sm" style={{ fontFamily: 'Inter_600SemiBold' }}>
                    Verificación en curso
                  </Text>
                  <View className={`rounded-full px-2.5 py-0.5 ${STATUS_CONFIG[activeVerification.status]?.bg ?? ''}`}>
                    <Text className={`text-xs font-semibold ${STATUS_CONFIG[activeVerification.status]?.color ?? 'text-text-muted'}`} style={{ fontFamily: 'Inter_600SemiBold' }}>
                      {STATUS_CONFIG[activeVerification.status]?.label ?? activeVerification.status}
                    </Text>
                  </View>
                </View>
                <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                  ID: {activeVerification.id.slice(0, 8)}…
                </Text>
                {activeVerification.reviewNotes && (
                  <View className="mt-2 bg-white/60 rounded-xl p-3">
                    <Text className="text-text-secondary text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                      Nota del revisor: {activeVerification.reviewNotes}
                    </Text>
                  </View>
                )}
              </View>

              {/* Documents section */}
              <Text className="text-text-primary font-bold text-sm mb-3" style={{ fontFamily: 'Inter_700Bold' }}>
                Documentos adjuntos
              </Text>

              {/* Uploaded docs */}
              {(activeVerification.documents ?? []).length > 0 ? (
                <View className="bg-white rounded-2xl border border-border p-4 mb-4">
                  {(activeVerification.documents ?? []).map((doc) => (
                    <View key={doc.id} className="flex-row items-center py-2.5 border-b border-border last:border-0">
                      <Text className="text-base mr-2">{docIcon(doc.type)}</Text>
                      <View className="flex-1">
                        <Text className="text-text-primary text-sm" style={{ fontFamily: 'Inter_500Medium' }}>
                          {docLabel(doc.type)}
                        </Text>
                        <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                          {doc.name}
                        </Text>
                      </View>
                      <View className="bg-green-100 rounded-full px-2 py-0.5">
                        <Text className="text-green-700 text-xs" style={{ fontFamily: 'Inter_600SemiBold' }}>✓</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View className="bg-white rounded-2xl border border-border p-6 items-center mb-4">
                  <Text className="text-3xl mb-2">📂</Text>
                  <Text className="text-text-muted text-sm text-center" style={{ fontFamily: 'Inter_400Regular' }}>
                    Aún no hay documentos adjuntos
                  </Text>
                </View>
              )}

              {/* Upload buttons — only when pending or rejected */}
              {(activeVerification.status === 'pending' || activeVerification.status === 'rejected') && (
                <>
                  <Text className="text-text-primary font-bold text-sm mb-3" style={{ fontFamily: 'Inter_700Bold' }}>
                    Subir documentos
                  </Text>
                  <View className="gap-y-2 mb-4">
                    {(compliance?.missingDocuments.length
                      ? compliance.missingDocuments
                      : Object.keys(DOC_LABEL)
                    ).map((docType) => {
                      const alreadyUploaded = uploadedTypes.has(docType);
                      const isUploading = uploadingDocType === docType && uploadMutation.isPending;

                      return (
                        <TouchableOpacity
                          key={docType}
                          onPress={() => !alreadyUploaded && !isUploading && pickAndUpload(docType, activeVerification.id)}
                          disabled={alreadyUploaded || isUploading}
                          className={`flex-row items-center rounded-2xl border px-4 py-3.5
                            ${alreadyUploaded
                              ? 'bg-green-50 border-green-200 opacity-70'
                              : 'bg-white border-border active:opacity-80'}`}
                          activeOpacity={0.75}
                        >
                          <Text className="text-lg mr-3">{docIcon(docType)}</Text>
                          <View className="flex-1">
                            <Text className="text-text-primary font-medium text-sm" style={{ fontFamily: 'Inter_500Medium' }}>
                              {docLabel(docType)}
                            </Text>
                            <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                              {alreadyUploaded ? 'Ya subido' : 'Toca para adjuntar'}
                            </Text>
                          </View>
                          {isUploading ? (
                            <ActivityIndicator size="small" color="#22c55e" />
                          ) : alreadyUploaded ? (
                            <Text className="text-green-600">✓</Text>
                          ) : (
                            <Text className="text-text-muted text-lg">↑</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </>
          ) : (
            /* No verification yet */
            <View className="bg-white rounded-2xl border border-border p-6 items-center mt-2">
              <Text className="text-4xl mb-3">📋</Text>
              <Text className="text-text-primary font-bold text-base mb-1 text-center" style={{ fontFamily: 'Inter_700Bold' }}>
                Sin verificación activa
              </Text>
              <Text className="text-text-muted text-sm text-center mb-5" style={{ fontFamily: 'Inter_400Regular' }}>
                Inicia el proceso para habilitar tu empresa y comenzar a operar.
              </Text>
              <TouchableOpacity
                onPress={handleCreate}
                disabled={createMutation.isPending || !requiredTier}
                className="w-full bg-primary-500 rounded-xl py-3.5 items-center"
                activeOpacity={0.8}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold" style={{ fontFamily: 'Inter_600SemiBold' }}>
                    Iniciar verificación
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Past verifications */}
          {verifications && verifications.length > 1 && (
            <>
              <Text className="text-text-primary font-bold text-sm mb-3 mt-2" style={{ fontFamily: 'Inter_700Bold' }}>
                Historial
              </Text>
              <View className="bg-white rounded-2xl border border-border overflow-hidden mb-4">
                {verifications.slice(1).map((v, i) => {
                  const cfg = STATUS_CONFIG[v.status] ?? { label: v.status, color: 'text-text-muted', bg: '' };
                  return (
                    <View
                      key={v.id}
                      className={`flex-row items-center px-4 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
                    >
                      <View className="flex-1">
                        <Text className="text-text-primary text-sm" style={{ fontFamily: 'Inter_500Medium' }}>
                          ID: {v.id.slice(0, 8)}…
                        </Text>
                        <Text className="text-text-muted text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                          {new Date(v.createdAt).toLocaleDateString('es-MX')}
                        </Text>
                      </View>
                      <Text className={`text-xs font-semibold ${cfg.color}`} style={{ fontFamily: 'Inter_600SemiBold' }}>
                        {cfg.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
