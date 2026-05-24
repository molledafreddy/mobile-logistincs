import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Alert,
  RefreshControl, Modal, ScrollView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { format, addMonths, subMonths, getDaysInMonth, startOfMonth, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  RecurringTemplatesService,
  type CreateRecurringTemplatePayload,
} from '../../../src/services/api/recurring-templates.service';
import { PlansService } from '../../../src/services/api/plans.service';
import { Input } from '../../../src/components/ui/Input';
import { AddressSearchInput } from '../../../src/components/common/AddressSearchInput';
import { Button } from '../../../src/components/ui/Button';
import type { RecurringTemplate, RecurrencePattern, ShipmentTemplateSnapshot } from '../../../src/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PATTERN_LABELS: Record<RecurrencePattern, string> = {
  daily:   'Diario',
  weekly:  'Semanal',
  monthly: 'Mensual',
  custom:  'Manual',
};

const PATTERN_ICONS: Record<RecurrencePattern, keyof typeof Ionicons.glyphMap> = {
  daily:   'sunny-outline',
  weekly:  'calendar-outline',
  monthly: 'refresh-outline',
  custom:  'settings-outline',
};

const WEEKDAY_LABELS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const WEEKDAY_ISO    = [1, 2, 3, 4, 5, 6, 7];

const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const WEEKDAYS_CALENDAR = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

function describePattern(t: RecurringTemplate): string {
  if (t.pattern === 'weekly' && t.daysOfWeek.length) {
    const days = t.daysOfWeek
      .slice()
      .sort((a, b) => a - b)
      .map((d) => WEEKDAY_LABELS[d - 1])
      .join(', ');
    return `${days} · ${t.time}`;
  }
  return `${PATTERN_LABELS[t.pattern]} · ${t.time}`;
}

// ─── Date Picker Modal ────────────────────────────────────────────────────────

function DatePickerModal({
  visible, value, title, onConfirm, onClose,
}: { visible: boolean; value: string; title: string; onConfirm: (d: string) => void; onClose: () => void }) {
  const initial = value ? new Date(value + 'T12:00:00') : new Date();
  const [viewDate, setViewDate] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(value ? initial : null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const cells: (number | null)[] = [
    ...Array(getDay(startOfMonth(viewDate))).fill(null),
    ...Array.from({ length: getDaysInMonth(viewDate) }, (_, i) => i + 1),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, width: 320, padding: 20, elevation: 10 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#0f172a', marginBottom: 12 }}>{title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <TouchableOpacity onPress={() => setViewDate(subMonths(viewDate, 1))} style={{ padding: 6 }}>
                <Ionicons name="chevron-back" size={20} color="#334155" />
              </TouchableOpacity>
              <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#0f172a', textTransform: 'capitalize' }}>
                {format(viewDate, 'MMMM yyyy', { locale: es })}
              </Text>
              <TouchableOpacity onPress={() => setViewDate(addMonths(viewDate, 1))} style={{ padding: 6 }}>
                <Ionicons name="chevron-forward" size={20} color="#334155" />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {WEEKDAYS_CALENDAR.map((d) => (
                <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'Inter_500Medium', color: '#94a3b8' }}>{d}</Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {cells.map((day, i) => {
                const isSelected = selected && selected.getFullYear() === year && selected.getMonth() === month && selected.getDate() === day;
                return (
                  <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                    {day !== null && (
                      <TouchableOpacity
                        onPress={() => setSelected(new Date(year, month, day))}
                        style={{ flex: 1, borderRadius: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: isSelected ? '#22c55e' : 'transparent' }}
                      >
                        <Text style={{ fontSize: 13, fontFamily: isSelected ? 'Inter_700Bold' : 'Inter_400Regular', color: isSelected ? '#fff' : '#334155' }}>{day}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity onPress={onClose} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: '#64748b' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { if (selected) { onConfirm(format(selected, 'yyyy-MM-dd')); } }}
                disabled={!selected}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: selected ? '#22c55e' : '#e2e8f0', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: selected ? '#fff' : '#94a3b8' }}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Time Picker Modal ────────────────────────────────────────────────────────

function TimePickerModal({
  visible, value, onConfirm, onClose,
}: { visible: boolean; value: string; onConfirm: (t: string) => void; onClose: () => void }) {
  const [selHour, setSelHour]     = useState(() => value ? parseInt(value.split(':')[0], 10) : 7);
  const [selMinute, setSelMinute] = useState(() => {
    if (!value) return 0;
    const raw = parseInt(value.split(':')[1], 10);
    return MINUTES.includes(raw) ? raw : 0;
  });

  const Col = ({ items, selected, onSelect }: { items: number[]; selected: number; onSelect: (v: number) => void }) => (
    <ScrollView showsVerticalScrollIndicator={false} style={{ height: 200, width: 72 }} contentContainerStyle={{ paddingVertical: 80 }}>
      {items.map((v) => {
        const active = v === selected;
        return (
          <TouchableOpacity key={v} onPress={() => onSelect(v)} style={{ height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: active ? '#f0fdf4' : 'transparent', marginVertical: 1 }}>
            <Text style={{ fontSize: 22, fontFamily: active ? 'Inter_700Bold' : 'Inter_400Regular', color: active ? '#22c55e' : '#94a3b8' }}>{pad(v)}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, width: 280, padding: 20, elevation: 10 }}>
            <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#0f172a', textAlign: 'center', marginBottom: 4 }}>Hora de inicio</Text>
            <Text style={{ fontSize: 36, fontFamily: 'Inter_700Bold', color: '#22c55e', textAlign: 'center', marginBottom: 12 }}>{pad(selHour)}:{pad(selMinute)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: '#94a3b8', marginBottom: 4 }}>HH</Text>
                <Col items={HOURS} selected={selHour} onSelect={setSelHour} />
              </View>
              <Text style={{ fontSize: 28, fontFamily: 'Inter_700Bold', color: '#cbd5e1', marginTop: 16 }}>:</Text>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: '#94a3b8', marginBottom: 4 }}>MM</Text>
                <Col items={MINUTES} selected={selMinute} onSelect={setSelMinute} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity onPress={onClose} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: '#64748b' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onConfirm(`${pad(selHour)}:${pad(selMinute)}`)} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#22c55e', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onUse,
  onEdit,
  onTogglePause,
  onDelete,
}: {
  template: RecurringTemplate;
  onUse: () => void;
  onEdit: () => void;
  onTogglePause: () => void;
  onDelete: () => void;
}) {
  const stopCount = template.shipmentTemplates.length;
  const isPassenger = template.shipmentTemplates.some((s) => s.cargoType === 'passenger');

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, borderWidth: template.active ? 0 : 1, borderColor: '#e2e8f0' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: template.active ? '#f0fdf4' : '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Ionicons name={isPassenger ? 'people-outline' : 'cube-outline'} size={20} color={template.active ? '#22c55e' : '#94a3b8'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#0f172a' }} numberOfLines={1}>{template.name}</Text>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#64748b', marginTop: 2 }}>
            {describePattern(template)}
          </Text>
        </View>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: template.active ? '#dcfce7' : '#f1f5f9' }}>
          <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: template.active ? '#16a34a' : '#94a3b8' }}>
            {template.active ? 'Activa' : 'Pausada'}
          </Text>
        </View>
      </View>

      {/* Stops preview */}
      {template.shipmentTemplates.slice(0, 2).map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Inter_700Bold', color: '#22c55e' }}>{i + 1}</Text>
          </View>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#475569', flex: 1 }} numberOfLines={1}>
            {s.description}  ·  {s.destinationAddress}
          </Text>
        </View>
      ))}
      {stopCount > 2 && (
        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginBottom: 4, marginLeft: 26 }}>
          +{stopCount - 2} {stopCount - 2 === 1 ? 'parada más' : 'paradas más'}
        </Text>
      )}

      {template.lastGeneratedAt && (
        <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginTop: 6 }}>
          Último run: {format(new Date(template.lastGeneratedAt), "d MMM yyyy", { locale: es })}
        </Text>
      )}

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TouchableOpacity
          onPress={onUse}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#22c55e', borderRadius: 10, paddingVertical: 9, gap: 6 }}
          activeOpacity={0.8}
        >
          <Ionicons name="play-outline" size={15} color="#fff" />
          <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Usar plantilla</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onEdit}
          style={{ width: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f9ff', borderRadius: 10, borderWidth: 1, borderColor: '#bae6fd' }}
          activeOpacity={0.7}
        >
          <Ionicons name="pencil-outline" size={17} color="#0ea5e9" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onTogglePause}
          style={{ width: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' }}
          activeOpacity={0.7}
        >
          <Ionicons name={template.active ? 'pause-outline' : 'play-skip-forward-outline'} size={17} color="#64748b" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          style={{ width: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff5f5', borderRadius: 10, borderWidth: 1, borderColor: '#fecaca' }}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={17} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Generate Run Modal ───────────────────────────────────────────────────────

function GenerateRunModal({
  template,
  visible,
  onClose,
  onGenerate,
  isLoading,
}: {
  template: RecurringTemplate | null;
  visible: boolean;
  onClose: () => void;
  onGenerate: (date: string) => void;
  isLoading: boolean;
}) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [date, setDate] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);

  if (!template) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 360, padding: 24, elevation: 10 }}>
            <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: '#0f172a', marginBottom: 4 }}>Generar run</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: '#64748b', marginBottom: 20 }}>
              {template.name}  ·  {template.shipmentTemplates.length} {template.shipmentTemplates.length === 1 ? 'parada' : 'paradas'}
            </Text>

            <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#475569', marginBottom: 8 }}>Fecha del run</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#fff', marginBottom: 20 }}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={18} color="#22c55e" />
              <Text style={{ flex: 1, marginLeft: 10, fontSize: 14, fontFamily: 'Inter_400Regular', color: '#0f172a' }}>
                {format(new Date(date + 'T12:00:00'), "EEEE d 'de' MMMM, yyyy", { locale: es })}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#94a3b8" />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={onClose} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: '#64748b' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onGenerate(date)}
                disabled={isLoading}
                style={{ flex: 2, paddingVertical: 13, borderRadius: 12, backgroundColor: '#22c55e', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>
                  {isLoading ? 'Generando…' : 'Crear run'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>

      <DatePickerModal
        visible={showDatePicker}
        value={date}
        title="Seleccionar fecha"
        onConfirm={(d) => { setDate(d); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
      />
    </Modal>
  );
}

// ─── Create Template Schema ───────────────────────────────────────────────────

const stopSchema = z.object({
  description:        z.string().min(2, 'Mínimo 2 caracteres'),
  originAddress:      z.string().min(2, 'Requerido'),
  originLat:          z.string().optional(),
  originLng:          z.string().optional(),
  destinationAddress: z.string().min(2, 'Requerido'),
  destinationLat:     z.string().optional(),
  destinationLng:     z.string().optional(),
  cargoType:          z.enum(['passenger', 'general', 'fragile', 'refrigerated', 'hazardous', 'oversized', 'food', 'documents', 'medical']),
});

const templateSchema = z.object({
  name:        z.string().min(2, 'Mínimo 2 caracteres').max(150),
  pattern:     z.enum(['daily', 'weekly', 'monthly', 'custom']),
  daysOfWeek:  z.array(z.number()).optional(),
  time:        z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:MM'),
  stops:       z.array(stopSchema).min(1, 'Agrega al menos una parada'),
});

type TemplateForm = z.infer<typeof templateSchema>;

const CARGO_OPTIONS = [
  { value: 'passenger', label: 'Persona',    icon: '🧑' },
  { value: 'general',   label: 'General',    icon: '📦' },
  { value: 'fragile',   label: 'Frágil',     icon: '🔮' },
  { value: 'refrigerated', label: 'Frío',    icon: '❄️' },
];

// ─── Template Form Sheet (create & edit) ─────────────────────────────────────

const EMPTY_DEFAULTS: TemplateForm = {
  name: '',
  pattern: 'weekly',
  daysOfWeek: [1, 2, 3, 4, 5],
  time: '07:00',
  stops: [{ description: '', originAddress: '', destinationAddress: '', cargoType: 'passenger' }],
};

const VALID_CARGO = ['passenger', 'general', 'fragile', 'refrigerated', 'hazardous', 'oversized', 'food', 'documents', 'medical'] as const;
type ValidCargo = typeof VALID_CARGO[number];

function templateToForm(t: RecurringTemplate): TemplateForm {
  return {
    name:       t.name,
    pattern:    t.pattern,
    daysOfWeek: t.daysOfWeek,
    time:       t.time.slice(0, 5), // DB returns "HH:mm:ss", Zod expects "HH:mm"
    stops: t.shipmentTemplates.map((s) => ({
      description:        s.description,
      originAddress:      s.originAddress,
      originLat:          s.originLat  ?? undefined,
      originLng:          s.originLng  ?? undefined,
      destinationAddress: s.destinationAddress,
      destinationLat:     s.destinationLat ?? undefined,
      destinationLng:     s.destinationLng ?? undefined,
      cargoType: (VALID_CARGO as readonly string[]).includes(s.cargoType)
        ? (s.cargoType as ValidCargo)
        : 'passenger',
    })),
  };
}

function TemplateFormSheet({
  sheetRef,
  isSaving,
  onSave,
  initialTemplate,
  formKey,
}: {
  sheetRef: React.RefObject<BottomSheetModalMethods | null>;
  isSaving: boolean;
  onSave: (values: TemplateForm) => void;
  initialTemplate: RecurringTemplate | null;
  formKey: number;
}) {
  const isEdit = !!initialTemplate;
  const [showTimePicker, setShowTimePicker] = useState(false);

  const { control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<TemplateForm>({
    resolver: zodResolver(templateSchema),
    defaultValues: initialTemplate ? templateToForm(initialTemplate) : EMPTY_DEFAULTS,
  });

  // Fires every time the sheet is about to open (formKey increments before present()).
  // This guarantees form is populated BEFORE the sheet animation starts.
  useEffect(() => {
    reset(initialTemplate ? templateToForm(initialTemplate) : EMPTY_DEFAULTS);
  }, [formKey]);

  const { fields, append, remove } = useFieldArray({ control, name: 'stops' });
  const pattern    = watch('pattern');
  const time       = watch('time');
  const daysOfWeek = watch('daysOfWeek') ?? [];

  const toggleDay = (day: number) => {
    const current = daysOfWeek;
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    setValue('daysOfWeek', next);
  };

  const handleSave = (values: TemplateForm) => {
    onSave(values);
    reset();
  };

  const handleInvalid = (formErrors: Record<string, any>) => {
    // Check top-level fields first
    if (formErrors.name?.message) { Alert.alert('Nombre requerido', formErrors.name.message); return; }
    if (formErrors.time?.message) { Alert.alert('Hora requerida', 'Selecciona una hora de salida.'); return; }

    // Check stops — RHF may return an array or sparse object with numeric keys
    const stopErrs = formErrors.stops;
    if (stopErrs) {
      const entries = Array.isArray(stopErrs)
        ? stopErrs.map((e: any, i: number) => [i, e] as [number, any])
        : Object.entries(stopErrs).map(([k, v]) => [Number(k), v] as [number, any]);

      for (const [i, s] of entries) {
        if (!s || typeof s !== 'object') continue;
        const idx = i + 1;
        if (s.originAddress?.message) {
          Alert.alert(`Parada ${idx}`, 'Selecciona una dirección de recogida del buscador.');
          return;
        }
        if (s.destinationAddress?.message) {
          Alert.alert(`Parada ${idx}`, 'Selecciona una dirección de destino del buscador.');
          return;
        }
        if (s.description?.message) {
          Alert.alert(`Parada ${idx}`, s.description.message);
          return;
        }
        // Catch any other field in the stop (e.g. cargoType)
        for (const [field, fieldErr] of Object.entries(s)) {
          const err = fieldErr as any;
          if (err?.message) {
            Alert.alert(`Parada ${idx} — ${field}`, err.message);
            return;
          }
        }
      }

      // Array-level root error (e.g. min(1))
      if ((stopErrs as any)?.root?.message) {
        Alert.alert('Paradas', (stopErrs as any).root.message);
        return;
      }
    }

    Alert.alert('Formulario incompleto', 'Revisa los campos marcados en rojo.');
  };

  return (
    <>
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['80%', '95%']}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}
        handleIndicatorStyle={{ backgroundColor: '#d1d5db' }}
        backgroundStyle={{ backgroundColor: '#fff' }}
        keyboardBehavior={Platform.OS === 'ios' ? 'extend' : 'interactive'}
        keyboardBlurBehavior="restore"
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, paddingTop: 4 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: '#0f172a', marginBottom: 4 }}>
            {isEdit ? 'Editar plantilla' : 'Nueva plantilla'}
          </Text>
          <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginBottom: 20 }}>
            {isEdit ? `Modificando "${initialTemplate!.name}"` : 'Define las paradas y la recurrencia del run'}
          </Text>

          {/* Name */}
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Nombre de la plantilla"
                placeholder="Ej. Ruta escolar mañana"
                autoCapitalize="sentences"
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                error={errors.name?.message}
              />
            )}
          />

          <View style={{ height: 16 }} />

          {/* Pattern */}
          <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#475569', marginBottom: 8 }}>Recurrencia</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {(['daily', 'weekly', 'monthly', 'custom'] as RecurrencePattern[]).map((p) => {
              const active = pattern === p;
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setValue('pattern', p)}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: active ? '#22c55e' : '#e2e8f0', backgroundColor: active ? '#f0fdf4' : '#fff' }}
                  activeOpacity={0.75}
                >
                  <Ionicons name={PATTERN_ICONS[p]} size={16} color={active ? '#22c55e' : '#94a3b8'} />
                  <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: active ? '#16a34a' : '#64748b', marginTop: 4 }}>{PATTERN_LABELS[p]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Days of week (weekly only) */}
          {pattern === 'weekly' && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#475569', marginBottom: 8 }}>Días</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {WEEKDAY_ISO.map((day, i) => {
                  const active = daysOfWeek.includes(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      onPress={() => toggleDay(day)}
                      style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: active ? '#22c55e' : '#e2e8f0', backgroundColor: active ? '#22c55e' : '#fff' }}
                      activeOpacity={0.75}
                    >
                      <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: active ? '#fff' : '#94a3b8' }}>
                        {WEEKDAY_LABELS[i]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Time */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#475569', marginBottom: 6 }}>Hora de salida</Text>
            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#fff' }}
              activeOpacity={0.7}
            >
              <Ionicons name="time-outline" size={18} color="#22c55e" />
              <Text style={{ flex: 1, marginLeft: 10, fontSize: 14, fontFamily: 'Inter_400Regular', color: '#0f172a' }}>{time || 'Seleccionar hora'}</Text>
              <Ionicons name="chevron-down" size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Stops */}
          <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#0f172a', marginBottom: 12 }}>
            Paradas ({fields.length})
          </Text>

          {fields.map((field, index) => {
            const stopErrors = errors.stops?.[index];
            return (
              <View key={field.id} style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 14, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 22, height: 22, backgroundColor: '#22c55e', borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 11, fontFamily: 'Inter_700Bold' }}>{index + 1}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#0f172a' }}>Parada {index + 1}</Text>
                  </View>
                  {fields.length > 1 && (
                    <TouchableOpacity onPress={() => remove(index)} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={20} color="#f87171" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Cargo type chips */}
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                  {CARGO_OPTIONS.map((opt) => (
                    <Controller
                      key={opt.value}
                      control={control}
                      name={`stops.${index}.cargoType`}
                      render={({ field: { onChange, value } }) => {
                        const active = value === opt.value;
                        return (
                          <TouchableOpacity
                            onPress={() => onChange(opt.value)}
                            style={{ flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: active ? '#22c55e' : '#e2e8f0', backgroundColor: active ? '#f0fdf4' : '#fff' }}
                            activeOpacity={0.75}
                          >
                            <Text style={{ fontSize: 14 }}>{opt.icon}</Text>
                            <Text style={{ fontSize: 10, fontFamily: 'Inter_500Medium', color: active ? '#16a34a' : '#94a3b8', marginTop: 2 }}>{opt.label}</Text>
                          </TouchableOpacity>
                        );
                      }}
                    />
                  ))}
                </View>

                <View style={{ gap: 10 }}>
                  <Controller
                    control={control}
                    name={`stops.${index}.description`}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <Input label="Nombre / descripción" placeholder="Ej. Juan García — Col. Las Flores" autoCapitalize="words"
                        onChangeText={onChange} onBlur={onBlur} value={value} error={stopErrors?.description?.message} />
                    )}
                  />
                  <AddressSearchInput
                    label="Dirección de recogida"
                    placeholder="Buscar origen..."
                    initialValue={watch(`stops.${index}.originAddress`)}
                    onSelect={(f) => {
                      setValue(`stops.${index}.originAddress`, f.formatted, { shouldValidate: true });
                      setValue(`stops.${index}.originLat`, String(f.coordinates.lat));
                      setValue(`stops.${index}.originLng`, String(f.coordinates.lng));
                    }}
                  />
                  {stopErrors?.originAddress && (
                    <Text style={{ fontSize: 12, color: '#ef4444', marginTop: 2, fontFamily: 'Inter_400Regular' }}>{stopErrors.originAddress.message}</Text>
                  )}
                  <AddressSearchInput
                    label="Dirección de destino"
                    placeholder="Buscar destino..."
                    initialValue={watch(`stops.${index}.destinationAddress`)}
                    onSelect={(f) => {
                      setValue(`stops.${index}.destinationAddress`, f.formatted, { shouldValidate: true });
                      setValue(`stops.${index}.destinationLat`, String(f.coordinates.lat));
                      setValue(`stops.${index}.destinationLng`, String(f.coordinates.lng));
                    }}
                  />
                  {stopErrors?.destinationAddress && (
                    <Text style={{ fontSize: 12, color: '#ef4444', marginTop: 2, fontFamily: 'Inter_400Regular' }}>{stopErrors.destinationAddress.message}</Text>
                  )}
                </View>
              </View>
            );
          })}

          <TouchableOpacity
            onPress={() => append({ description: '', originAddress: '', destinationAddress: '', cargoType: 'passenger' })}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#86efac', borderRadius: 14, paddingVertical: 12, marginBottom: 20 }}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={18} color="#22c55e" />
            <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#16a34a' }}>Agregar parada</Text>
          </TouchableOpacity>

          <Button fullWidth size="lg" loading={isSaving} onPress={handleSubmit(handleSave, handleInvalid)}>
            {isEdit ? 'Actualizar plantilla' : 'Guardar plantilla'}
          </Button>
        </BottomSheetScrollView>
      </BottomSheetModal>

      <TimePickerModal
        visible={showTimePicker}
        value={time}
        onConfirm={(t) => { setValue('time', t, { shouldValidate: true }); setShowTimePicker(false); }}
        onClose={() => setShowTimePicker(false)}
      />
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TemplatesScreen() {
  const queryClient = useQueryClient();
  const formSheetRef = useRef<BottomSheetModalMethods>(null);

  const [generateTarget, setGenerateTarget] = useState<RecurringTemplate | null>(null);
  const [editTarget,     setEditTarget]     = useState<RecurringTemplate | null>(null);
  const [formKey,        setFormKey]        = useState(0);

  // Open sheet AFTER state updates are committed so the form reset runs first.
  useEffect(() => {
    if (formKey > 0) formSheetRef.current?.present();
  }, [formKey]);

  const handleOpenCreate = () => { setEditTarget(null); setFormKey((k) => k + 1); };
  const handleOpenEdit   = (t: RecurringTemplate) => { setEditTarget(t); setFormKey((k) => k + 1); };

  const { data: myPermissions } = useQuery({
    queryKey: ['plans', 'me', 'permissions'],
    queryFn: () => PlansService.getMyPermissions(),
    staleTime: 2 * 60_000,
  });
  const canCreateTemplates = myPermissions?.includes('templates.basic') ?? false;

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['recurring-templates'],
    queryFn: () => RecurringTemplatesService.getAll({ limit: 50, sortBy: 'createdAt', sortOrder: 'DESC' }),
  });

  const templates = data?.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['recurring-templates'] });

  const createMutation = useMutation({
    mutationFn: (values: TemplateForm) => {
      const payload: CreateRecurringTemplatePayload = {
        name:       values.name,
        pattern:    values.pattern,
        daysOfWeek: values.pattern === 'weekly' ? (values.daysOfWeek ?? []) : undefined,
        time:       values.time,
        startDate:  format(new Date(), 'yyyy-MM-dd'),
        shipmentTemplates: values.stops.map((s): ShipmentTemplateSnapshot => ({
          originAddress:      s.originAddress,
          originLat:          s.originLat,
          originLng:          s.originLng,
          destinationAddress: s.destinationAddress,
          destinationLat:     s.destinationLat,
          destinationLng:     s.destinationLng,
          description:        s.description,
          cargoType:          s.cargoType,
        })),
      };
      return RecurringTemplatesService.create(payload);
    },
    onSuccess: (created) => {
      formSheetRef.current?.dismiss();
      invalidate();
      Alert.alert('Plantilla creada', `"${created.name}" está lista para usarse.`);
    },
    onError: (err: any) => {
      const resp = err?.response?.data;
      const validationErrors: string[] | undefined = resp?.errors?.validation;
      const detail = validationErrors?.[0];
      const msg = resp?.message ?? 'No se pudo crear la plantilla.';
      Alert.alert('Error al guardar', detail ?? (Array.isArray(msg) ? msg[0] : msg));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: TemplateForm }) =>
      RecurringTemplatesService.update(id, {
        name:       values.name,
        pattern:    values.pattern,
        daysOfWeek: values.pattern === 'weekly' ? (values.daysOfWeek ?? []) : undefined,
        time:       values.time,
        shipmentTemplates: values.stops.map((s): ShipmentTemplateSnapshot => ({
          originAddress:      s.originAddress,
          originLat:          s.originLat,
          originLng:          s.originLng,
          destinationAddress: s.destinationAddress,
          destinationLat:     s.destinationLat,
          destinationLng:     s.destinationLng,
          description:        s.description,
          cargoType:          s.cargoType,
        })),
      }),
    onSuccess: (updated) => {
      formSheetRef.current?.dismiss();
      setEditTarget(null);
      invalidate();
      Alert.alert('Plantilla actualizada', `"${updated.name}" fue guardada correctamente.`);
    },
    onError: (err: any) => {
      const resp = err?.response?.data;
      const validationErrors: string[] | undefined = resp?.errors?.validation;
      const detail = validationErrors?.[0];
      const msg = resp?.message ?? 'No se pudo actualizar la plantilla.';
      Alert.alert('Error al guardar', detail ?? (Array.isArray(msg) ? msg[0] : msg));
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => RecurringTemplatesService.pause(id),
    onSuccess: invalidate,
    onError: () => Alert.alert('Error', 'No se pudo pausar la plantilla.'),
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => RecurringTemplatesService.resume(id),
    onSuccess: invalidate,
    onError: () => Alert.alert('Error', 'No se pudo reanudar la plantilla.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => RecurringTemplatesService.remove(id),
    onSuccess: invalidate,
    onError: () => Alert.alert('Error', 'No se pudo eliminar la plantilla.'),
  });

  const generateMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      RecurringTemplatesService.generate(id, date),
    onSuccess: (result) => {
      setGenerateTarget(null);
      queryClient.invalidateQueries({ queryKey: ['delivery-runs'] });
      if (result.skipped) {
        const reason: Record<string, string> = {
          already_generated: 'Ya existe un run para esa fecha.',
          paused:            'La plantilla está pausada.',
          pattern_mismatch:  'La fecha no coincide con los días configurados.',
          exception:         'La fecha está marcada como excepción.',
          out_of_range:      'La fecha está fuera del rango de la plantilla.',
        };
        Alert.alert('Run no generado', reason[result.skipReason ?? ''] ?? 'No se generó el run.', [
          { text: 'OK' },
        ]);
      } else {
        Alert.alert('Run creado', 'El run fue generado correctamente.', [
          { text: 'Ver run', onPress: () => router.push(`/(app)/delivery/${result.runId}` as any) },
          { text: 'OK' },
        ]);
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo generar el run.';
      Alert.alert('Error', Array.isArray(msg) ? msg[0] : msg);
    },
  });

  const handleTogglePause = (t: RecurringTemplate) => {
    if (t.active) {
      Alert.alert('Pausar plantilla', `¿Pausar "${t.name}"? No se generarán nuevos runs automáticamente.`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Pausar', onPress: () => pauseMutation.mutate(t.id) },
      ]);
    } else {
      resumeMutation.mutate(t.id);
    }
  };

  const handleDelete = (t: RecurringTemplate) => {
    Alert.alert('Eliminar plantilla', `¿Eliminar "${t.name}"? Los runs ya generados no se verán afectados.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate(t.id) },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: 36, height: 36, backgroundColor: '#fff', borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginRight: 12 }}
        >
          <Ionicons name="arrow-back" size={18} color="#334155" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: '#0f172a' }}>Plantillas</Text>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginTop: 1 }}>
            {templates.length} {templates.length === 1 ? 'plantilla' : 'plantillas'} guardadas
          </Text>
        </View>
        {canCreateTemplates && (
          <TouchableOpacity
            onPress={handleOpenCreate}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#22c55e', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, gap: 6 }}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={{ fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Nueva</Text>
          </TouchableOpacity>
        )}
      </View>

      {!canCreateTemplates && (
        <TouchableOpacity
          onPress={() => router.push('/(app)/plans' as any)}
          activeOpacity={0.85}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            marginHorizontal: 16, marginBottom: 12,
            backgroundColor: '#fef9c3', borderWidth: 1, borderColor: '#fde047',
            borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
          }}
        >
          <Ionicons name="lock-closed-outline" size={16} color="#854d0e" />
          <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: '#854d0e' }}>
            Las plantillas requieren un plan Pro o superior.
          </Text>
          <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#854d0e' }}>Mejorar →</Text>
        </TouchableOpacity>
      )}

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: 'Inter_400Regular', color: '#94a3b8' }}>Cargando plantillas…</Text>
        </View>
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#22c55e" />}
          renderItem={({ item }) => (
            <TemplateCard
              template={item}
              onUse={canCreateTemplates ? () => setGenerateTarget(item) : () => router.push('/(app)/plans' as any)}
              onEdit={canCreateTemplates ? () => handleOpenEdit(item) : () => router.push('/(app)/plans' as any)}
              onTogglePause={() => handleTogglePause(item)}
              onDelete={() => handleDelete(item)}
            />
          )}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="copy-outline" size={36} color="#94a3b8" />
              </View>
              <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#334155', marginBottom: 6 }}>Sin plantillas</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: '#94a3b8', textAlign: 'center', paddingHorizontal: 32, marginBottom: 20 }}>
                Crea una plantilla para reutilizar rutas recurrentes con un solo tap
              </Text>
              {canCreateTemplates ? (
                <TouchableOpacity
                  onPress={handleOpenCreate}
                  style={{ backgroundColor: '#22c55e', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Crear primera plantilla</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => router.push('/(app)/plans' as any)}
                  style={{ backgroundColor: '#6366f1', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-up-circle-outline" size={18} color="#fff" />
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Mejorar plan</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      <TemplateFormSheet
        sheetRef={formSheetRef}
        isSaving={createMutation.isPending || updateMutation.isPending}
        initialTemplate={editTarget}
        formKey={formKey}
        onSave={(values) => {
          if (editTarget) {
            updateMutation.mutate({ id: editTarget.id, values });
          } else {
            createMutation.mutate(values);
          }
        }}
      />

      <GenerateRunModal
        template={generateTarget}
        visible={!!generateTarget}
        onClose={() => setGenerateTarget(null)}
        onGenerate={(date) => {
          if (generateTarget) generateMutation.mutate({ id: generateTarget.id, date });
        }}
        isLoading={generateMutation.isPending}
      />
    </SafeAreaView>
  );
}
