import { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Modal, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { DeliveryRun, RunShift } from '../../types';

const editSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato: AAAA-MM-DD'),
  shift: z
    .enum(['morning', 'afternoon', 'evening', 'night', 'custom'])
    .optional(),
  startTime: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d{2}:\d{2}$/.test(v),
      'Formato: HH:MM',
    ),
});

type EditForm = z.infer<typeof editSchema>;

const SHIFTS: { value: RunShift; label: string; icon: string }[] = [
  { value: 'morning',   label: 'Mañana',    icon: '🌅' },
  { value: 'afternoon', label: 'Tarde',     icon: '☀️' },
  { value: 'evening',   label: 'Noche',     icon: '🌆' },
  { value: 'night',     label: 'Madrugada', icon: '🌙' },
  { value: 'custom',    label: 'Custom',    icon: '⚙️' },
];

// ─── Time Picker Modal ────────────────────────────────────────────────────────

const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function TimePickerModal({
  visible, value, onConfirm, onClose,
}: {
  visible: boolean;
  value: string;
  onConfirm: (time: string) => void;
  onClose: () => void;
}) {
  const [selHour, setSelHour]     = useState(() => value ? parseInt(value.split(':')[0], 10) : 7);
  const [selMinute, setSelMinute] = useState(() => {
    if (!value) return 0;
    const raw = parseInt(value.split(':')[1], 10);
    return MINUTES.includes(raw) ? raw : 0;
  });

  const pad = (n: number) => String(n).padStart(2, '0');

  const Column = ({ items, selected, onSelect }: { items: number[]; selected: number; onSelect: (v: number) => void }) => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={{ height: 200, width: 72 }}
      contentContainerStyle={{ paddingVertical: 80 }}
    >
      {items.map((v) => {
        const isActive = v === selected;
        return (
          <TouchableOpacity
            key={v}
            onPress={() => onSelect(v)}
            style={{
              height: 40, alignItems: 'center', justifyContent: 'center',
              borderRadius: 10, backgroundColor: isActive ? '#f0fdf4' : 'transparent', marginVertical: 1,
            }}
          >
            <Text style={{ fontSize: 22, fontFamily: isActive ? 'Inter_700Bold' : 'Inter_400Regular', color: isActive ? '#22c55e' : '#94a3b8' }}>
              {pad(v)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' }}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, width: 280, padding: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#0f172a', textAlign: 'center', marginBottom: 4 }}>
              Hora de inicio
            </Text>
            <Text style={{ fontSize: 36, fontFamily: 'Inter_700Bold', color: '#22c55e', textAlign: 'center', marginBottom: 12 }}>
              {pad(selHour)}:{pad(selMinute)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: '#94a3b8', marginBottom: 4 }}>HH</Text>
                <Column items={HOURS} selected={selHour} onSelect={setSelHour} />
              </View>
              <Text style={{ fontSize: 28, fontFamily: 'Inter_700Bold', color: '#cbd5e1', marginTop: 16 }}>:</Text>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: '#94a3b8', marginBottom: 4 }}>MM</Text>
                <Column items={MINUTES} selected={selMinute} onSelect={setSelMinute} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                onPress={onClose}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: '#64748b' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onConfirm(`${pad(selHour)}:${pad(selMinute)}`)}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#22c55e', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  sheetRef: React.RefObject<BottomSheetModalMethods | null>;
  run: DeliveryRun;
  isLoading: boolean;
  onSubmit: (payload: {
    name?: string;
    scheduledDate?: string;
    shift?: RunShift;
    startTime?: string;
  }) => void;
}

export function EditRunSheet({ sheetRef, run, isLoading, onSubmit }: Props) {
  const [showTimePicker, setShowTimePicker] = useState(false);

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: run.name ?? '',
      scheduledDate: run.scheduledDate?.slice(0, 10) ?? '',
      shift: run.shift ?? undefined,
      startTime: run.startTime ?? '',
    },
  });

  const startTime = watch('startTime');

  const handleSave = (values: EditForm) => {
    const payload: Parameters<typeof onSubmit>[0] = {};
    if (values.name !== run.name) payload.name = values.name;
    const newDate = values.scheduledDate;
    if (newDate !== run.scheduledDate?.slice(0, 10)) payload.scheduledDate = newDate;
    if (values.shift !== run.shift) payload.shift = values.shift;
    const st = values.startTime || undefined;
    if (st !== (run.startTime ?? undefined)) payload.startTime = st;
    onSubmit(payload);
  };

  return (
    <>
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['75%', '92%']}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}
        handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
        backgroundStyle={{ backgroundColor: '#fff' }}
        keyboardBehavior={Platform.OS === 'ios' ? 'extend' : 'interactive'}
        keyboardBlurBehavior="restore"
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            className="text-text-primary text-lg font-bold mb-5 mt-1"
            style={{ fontFamily: 'Inter_700Bold' }}
          >
            Editar run
          </Text>

          <View className="gap-y-4">
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Nombre del run"
                  placeholder="Ruta norte — turno mañana"
                  autoCapitalize="sentences"
                  returnKeyType="next"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.name?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="scheduledDate"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Fecha programada"
                  placeholder="2026-05-20"
                  keyboardType="numbers-and-punctuation"
                  returnKeyType="next"
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                  error={errors.scheduledDate?.message}
                />
              )}
            />

            {/* Shift chips */}
            <Controller
              control={control}
              name="shift"
              render={({ field: { onChange, value } }) => (
                <View>
                  <Text
                    className="text-sm text-text-secondary mb-2"
                    style={{ fontFamily: 'Inter_500Medium' }}
                  >
                    Turno (opcional)
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {SHIFTS.map((s) => {
                      const active = value === s.value;
                      return (
                        <TouchableOpacity
                          key={s.value}
                          onPress={() => onChange(active ? undefined : s.value)}
                          activeOpacity={0.75}
                          className={`flex-row items-center px-3 py-2 rounded-xl border ${
                            active
                              ? 'bg-primary-50 border-primary-400'
                              : 'bg-white border-border'
                          }`}
                        >
                          <Text className="text-base mr-1.5">{s.icon}</Text>
                          <Text
                            className={`text-xs font-medium ${
                              active ? 'text-primary-700' : 'text-text-secondary'
                            }`}
                            style={{ fontFamily: 'Inter_500Medium' }}
                          >
                            {s.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            />

            {/* Start time — tap to open picker */}
            <View>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#475569', marginBottom: 6 }}>
                Hora de inicio (opcional)
              </Text>
              <TouchableOpacity
                onPress={() => setShowTimePicker(true)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row', alignItems: 'center',
                  borderWidth: 1, borderColor: errors.startTime ? '#ef4444' : '#e2e8f0',
                  borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
                  backgroundColor: '#fff',
                }}
              >
                <Ionicons name="time-outline" size={18} color={startTime ? '#22c55e' : '#94a3b8'} />
                <Text style={{ flex: 1, marginLeft: 10, fontSize: 14, fontFamily: 'Inter_400Regular', color: startTime ? '#0f172a' : '#94a3b8' }}>
                  {startTime || 'Seleccionar hora'}
                </Text>
                {startTime ? (
                  <TouchableOpacity
                    onPress={() => setValue('startTime', '', { shouldValidate: true })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ) : (
                  <Ionicons name="chevron-down" size={16} color="#94a3b8" />
                )}
              </TouchableOpacity>
              {errors.startTime && (
                <Text style={{ fontSize: 12, color: '#ef4444', marginTop: 4, fontFamily: 'Inter_400Regular' }}>
                  {errors.startTime.message}
                </Text>
              )}
            </View>
          </View>

          <Button
            fullWidth
            size="lg"
            loading={isLoading}
            onPress={handleSubmit(handleSave)}
            className="mt-6"
          >
            Guardar cambios
          </Button>
        </BottomSheetScrollView>
      </BottomSheetModal>

      <TimePickerModal
        visible={showTimePicker}
        value={startTime ?? ''}
        onConfirm={(time) => { setValue('startTime', time, { shouldValidate: true }); setShowTimePicker(false); }}
        onClose={() => setShowTimePicker(false)}
      />
    </>
  );
}
