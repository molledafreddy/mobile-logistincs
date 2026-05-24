import { useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, KeyboardAvoidingView, Platform,
  TouchableOpacity, Alert, Modal, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format, getDaysInMonth, startOfMonth, getDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import type { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { Input } from '../../../src/components/ui/Input';
import { Button } from '../../../src/components/ui/Button';
import { SavedAddressPickerSheet } from '../../../src/components/common/SavedAddressPickerSheet';
import { AddressSearchInput } from '../../../src/components/common/AddressSearchInput';
import { useAuthStore } from '../../../src/stores/auth.store';
import { DeliveryRunsService } from '../../../src/services/api/delivery-runs.service';
import { ShipmentsService } from '../../../src/services/api/shipments.service';
import { TrucksService } from '../../../src/services/api/trucks.service';
import { DriversService } from '../../../src/services/api/drivers.service';
import { SavedAddressesService } from '../../../src/services/api/saved-addresses.service';
import { RecurringTemplatesService } from '../../../src/services/api/recurring-templates.service';
import { PlansService } from '../../../src/services/api/plans.service';
import type { SavedAddress, Truck, Driver, GeocodeFeature, RecurringTemplate } from '../../../src/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Shift = 'morning' | 'afternoon' | 'evening' | 'night' | 'custom';
type RunType = 'freight' | 'passenger';

const SHIFTS: { value: Shift; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'custom',    label: 'Todo el día', icon: 'time-outline' },
  { value: 'morning',   label: 'Mañana',      icon: 'sunny-outline' },
  { value: 'afternoon', label: 'Tarde',       icon: 'partly-sunny-outline' },
  { value: 'evening',   label: 'Noche',       icon: 'moon-outline' },
  { value: 'night',     label: 'Nocturno',    icon: 'star-outline' },
];

const CARGO_TYPES = [
  { value: 'general',      label: 'General' },
  { value: 'fragile',      label: 'Frágil' },
  { value: 'refrigerated', label: 'Refrigerado' },
  { value: 'hazmat',       label: 'Mat. peligrosos' },
  { value: 'valuable',     label: 'Valioso' },
] as const;

// ─── Run Type Selector ────────────────────────────────────────────────────────

function RunTypeSelector({
  value, onChange,
}: { value: RunType | null; onChange: (v: RunType) => void }) {
  const options: { type: RunType; emoji: string; title: string; sub: string }[] = [
    { type: 'freight',   emoji: '📦', title: 'Paquetes',  sub: 'Envíos, carga\ny mercancía' },
    { type: 'passenger', emoji: '🧑', title: 'Personas',  sub: 'Traslados,\npasajeros y escolares' },
  ];
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#0f172a' }}>
        ¿Qué vas a transportar?
      </Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {options.map((o) => {
          const active = value === o.type;
          return (
            <TouchableOpacity
              key={o.type}
              onPress={() => onChange(o.type)}
              activeOpacity={0.75}
              style={{
                flex: 1, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 10,
                borderRadius: 16, borderWidth: 2,
                borderColor: active ? '#22c55e' : '#e2e8f0',
                backgroundColor: active ? '#f0fdf4' : '#f8fafc',
              }}
            >
              <Text style={{ fontSize: 36, marginBottom: 8 }}>{o.emoji}</Text>
              <Text style={{ fontSize: 15, fontFamily: 'Inter_700Bold', color: active ? '#15803d' : '#334155', marginBottom: 4 }}>
                {o.title}
              </Text>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: active ? '#4ade80' : '#94a3b8', textAlign: 'center', lineHeight: 16 }}>
                {o.sub}
              </Text>
              {active && (
                <View style={{ position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: 10, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const stopSchema = z.object({
  originAddress:   z.string().max(255).optional(),
  destination:     z.string().min(5, 'Mínimo 5 caracteres').max(255),
  description:     z.string().min(2, 'Mínimo 2 caracteres').max(255),
  referenceNumber: z.string().max(60).optional(),
  cargoType:       z.enum(['general', 'fragile', 'refrigerated', 'hazmat', 'valuable']).optional(),
  weightKg:        z.string().regex(/^\d+(\.\d{1,2})?$/, 'Ej. 150.50').optional().or(z.literal('')),
  pieces:          z.string().regex(/^\d+$/, 'Número entero').optional().or(z.literal('')),
  contactName:     z.string().max(100).optional(),
  contactPhone:    z.string().max(30).optional(),
  notes:           z.string().max(500).optional(),
});

const runSchema = z.object({
  name:          z.string().min(2, 'Mínimo 2 caracteres').max(150),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecciona una fecha'),
  shift:         z.enum(['morning', 'afternoon', 'evening', 'night', 'custom']).optional(),
  startTime:     z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato HH:mm').optional().or(z.literal('')),
  truckId:       z.string().optional(),
  driverIdField: z.string().optional(),
  stops:         z.array(stopSchema).min(1, 'Agrega al menos una parada'),
});

type RunForm = z.infer<typeof runSchema>;

// ─── Date Picker Modal ────────────────────────────────────────────────────────

const WEEKDAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

function DatePickerModal({
  visible, value, onConfirm, onClose,
}: {
  visible: boolean;
  value: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
}) {
  const initial = value ? new Date(value + 'T12:00:00') : new Date();
  const [viewDate, setViewDate] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(value ? initial : null);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = getDaysInMonth(viewDate);
  const firstDow    = getDay(startOfMonth(viewDate));

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const isSelected = (d: number) =>
    selected &&
    selected.getFullYear() === year &&
    selected.getMonth() === month &&
    selected.getDate() === d;

  const isToday = (d: number) => {
    const t = new Date();
    return t.getFullYear() === year && t.getMonth() === month && t.getDate() === d;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' }}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={{ backgroundColor: '#fff', borderRadius: 20, width: 320, padding: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 }}>
            {/* Month navigation */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <TouchableOpacity onPress={() => setViewDate(subMonths(viewDate, 1))} style={{ padding: 6 }}>
                <Ionicons name="chevron-back" size={20} color="#334155" />
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#0f172a', textTransform: 'capitalize' }}>
                {format(viewDate, 'MMMM yyyy', { locale: es })}
              </Text>
              <TouchableOpacity onPress={() => setViewDate(addMonths(viewDate, 1))} style={{ padding: 6 }}>
                <Ionicons name="chevron-forward" size={20} color="#334155" />
              </TouchableOpacity>
            </View>

            {/* Weekday headers */}
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {WEEKDAYS.map((d) => (
                <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'Inter_500Medium', color: '#94a3b8' }}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Day grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {cells.map((day, i) => (
                <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                  {day !== null && (
                    <TouchableOpacity
                      onPress={() => setSelected(new Date(year, month, day))}
                      style={{
                        flex: 1, borderRadius: 100, alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isSelected(day) ? '#22c55e' : isToday(day) ? '#f0fdf4' : 'transparent',
                      }}
                    >
                      <Text style={{
                        fontSize: 13,
                        fontFamily: isSelected(day) ? 'Inter_700Bold' : 'Inter_400Regular',
                        color: isSelected(day) ? '#fff' : isToday(day) ? '#22c55e' : '#334155',
                      }}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                onPress={onClose}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: '#64748b' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (selected) {
                    onConfirm(format(selected, 'yyyy-MM-dd'));
                  }
                }}
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
  const [selMinute, setSelMinute] = useState(() => value ? parseInt(value.split(':')[1], 10) : 0);

  const pad = (n: number) => String(n).padStart(2, '0');

  const Column = ({
    items, selected, onSelect,
  }: { items: number[]; selected: number; onSelect: (v: number) => void }) => (
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
            style={{ height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: isActive ? '#f0fdf4' : 'transparent', marginVertical: 1 }}
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

            {/* Preview */}
            <Text style={{ fontSize: 36, fontFamily: 'Inter_700Bold', color: '#22c55e', textAlign: 'center', marginBottom: 12 }}>
              {pad(selHour)}:{pad(selMinute)}
            </Text>

            {/* Columns */}
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

            {/* Actions */}
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

// ─── Entity Picker Modal (generic) ───────────────────────────────────────────

interface PickerItem { id: string; label: string; sublabel?: string; }

function EntityPickerModal({
  visible, title, items, selectedId, onSelect, onClose, loading,
}: {
  visible: boolean;
  title: string;
  items: PickerItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  loading?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={onClose} />
      <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '60%', paddingTop: 16, paddingBottom: 32 }}>
        {/* Handle */}
        <View style={{ width: 36, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 12 }} />
        <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: '#0f172a', paddingHorizontal: 20, marginBottom: 12 }}>{title}</Text>
        {loading ? (
          <Text style={{ textAlign: 'center', color: '#94a3b8', padding: 24, fontFamily: 'Inter_400Regular' }}>Cargando…</Text>
        ) : items.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#94a3b8', padding: 24, fontFamily: 'Inter_400Regular' }}>Sin opciones disponibles</Text>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => {
              const isActive = selectedId === item.id;
              return (
                <TouchableOpacity
                  onPress={() => { onSelect(item.id); onClose(); }}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: isActive ? '#22c55e' : '#1e293b' }}>{item.label}</Text>
                    {item.sublabel && (
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginTop: 2 }}>{item.sublabel}</Text>
                    )}
                  </View>
                  {isActive && <Ionicons name="checkmark-circle" size={20} color="#22c55e" />}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

// ─── Select Field ─────────────────────────────────────────────────────────────

function SelectField({
  label, value, placeholder, icon, onPress, error,
}: {
  label: string; value?: string; placeholder: string;
  icon: keyof typeof Ionicons.glyphMap; onPress: () => void; error?: string;
}) {
  return (
    <View>
      <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#475569', marginBottom: 6 }}>{label}</Text>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={{
          flexDirection: 'row', alignItems: 'center',
          borderWidth: 1, borderColor: error ? '#ef4444' : '#e2e8f0',
          borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
          backgroundColor: '#fff',
        }}
      >
        <Ionicons name={icon} size={18} color={value ? '#22c55e' : '#94a3b8'} />
        <Text style={{ flex: 1, marginLeft: 10, fontSize: 14, fontFamily: 'Inter_400Regular', color: value ? '#0f172a' : '#94a3b8' }}>
          {value ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#94a3b8" />
      </TouchableOpacity>
      {error && <Text style={{ fontSize: 12, color: '#ef4444', marginTop: 4, fontFamily: 'Inter_400Regular' }}>{error}</Text>}
    </View>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 24, gap: 8 }}>
      {([1, 2] as const).map((n) => (
        <View key={n} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: step >= n ? '#22c55e' : '#f1f5f9', borderWidth: step >= n ? 0 : 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' }}>
            {step > n ? (
              <Ionicons name="checkmark" size={16} color="#fff" />
            ) : (
              <Text style={{ fontSize: 13, fontFamily: 'Inter_700Bold', color: step >= n ? '#fff' : '#94a3b8' }}>{n}</Text>
            )}
          </View>
          {n < 2 && <View style={{ width: 40, height: 2, backgroundColor: step > 1 ? '#22c55e' : '#e2e8f0', marginHorizontal: 4 }} />}
        </View>
      ))}
    </View>
  );
}

// ─── Stop Row ─────────────────────────────────────────────────────────────────

function StopRow({ index, control, errors, onRemove, onPickSaved, originFeature, onOriginFeatureSelect, selectedFeature, onFeatureSelect, saveAsFrequent, onSaveAsFrequentChange, runType }: {
  index: number; control: any; errors: any;
  onRemove: () => void; onPickSaved: () => void;
  originFeature: GeocodeFeature | null;
  onOriginFeatureSelect: (f: GeocodeFeature | null) => void;
  selectedFeature: GeocodeFeature | null;
  onFeatureSelect: (f: GeocodeFeature | null) => void;
  saveAsFrequent: boolean;
  onSaveAsFrequentChange: (v: boolean) => void;
  runType: RunType | null;
}) {
  const stopErrors = errors.stops?.[index];
  const [showExtra, setShowExtra] = useState(false);
  const isPassenger = runType === 'passenger';

  return (
    <View style={{ backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, padding: 16, marginBottom: 12 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 24, height: 24, backgroundColor: '#22c55e', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'Inter_700Bold' }}>{index + 1}</Text>
          </View>
          <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#0f172a' }}>
            {isPassenger ? `🧑 Pasajero ${index + 1}` : `Parada ${index + 1}`}
          </Text>
        </View>
        <TouchableOpacity onPress={onRemove} style={{ padding: 4 }}>
          <Ionicons name="close-circle" size={20} color="#f87171" />
        </TouchableOpacity>
      </View>

      <View style={{ gap: 12 }}>
        {/* Origin */}
        <View>
          <Controller
            control={control}
            name={`stops.${index}.originAddress`}
            render={({ field: { onChange, value } }) => (
              <AddressSearchInput
                label={isPassenger ? 'Punto de recogida' : 'Origen (dirección de recogida)'}
                placeholder="Buscar dirección de origen..."
                initialValue={value}
                onSelect={(feature) => {
                  onChange(feature.formatted);
                  onOriginFeatureSelect(feature);
                }}
              />
            )}
          />
          {stopErrors?.originAddress?.message && (
            <Text style={{ fontSize: 12, color: '#ef4444', marginTop: 4, fontFamily: 'Inter_400Regular' }}>
              {stopErrors.originAddress.message}
            </Text>
          )}
          {originFeature && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#2563eb', flex: 1 }} numberOfLines={1}>
                🌐 {originFeature.coordinates.lat.toFixed(5)}, {originFeature.coordinates.lng.toFixed(5)}
              </Text>
              <TouchableOpacity onPress={() => onOriginFeatureSelect(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close" size={14} color="#2563eb" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Destination */}
        <View>
          <Controller
            control={control}
            name={`stops.${index}.destination`}
            render={({ field: { onChange, value } }) => (
              <AddressSearchInput
                label={isPassenger ? 'Punto de destino' : 'Destino (dirección de entrega)'}
                placeholder="Buscar dirección de destino..."
                initialValue={value}
                onSelect={(feature) => {
                  onChange(feature.formatted);
                  onFeatureSelect(feature);
                }}
              />
            )}
          />
          {stopErrors?.destination?.message && (
            <Text style={{ fontSize: 12, color: '#ef4444', marginTop: 4, fontFamily: 'Inter_400Regular' }}>
              {stopErrors.destination.message}
            </Text>
          )}

          {selectedFeature && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#16a34a', flex: 1 }} numberOfLines={1}>
                🌐 {selectedFeature.coordinates.lat.toFixed(5)}, {selectedFeature.coordinates.lng.toFixed(5)}
              </Text>
              <TouchableOpacity onPress={() => onFeatureSelect(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close" size={14} color="#16a34a" />
              </TouchableOpacity>
            </View>
          )}

          {selectedFeature && (
            <TouchableOpacity
              onPress={() => onSaveAsFrequentChange(!saveAsFrequent)}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}
            >
              <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: saveAsFrequent ? '#22c55e' : '#cbd5e1', backgroundColor: saveAsFrequent ? '#22c55e' : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                {saveAsFrequent && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: '#475569' }}>
                Guardar como dirección frecuente
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={onPickSaved}
            activeOpacity={0.75}
            style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 6, gap: 6, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}
          >
            <Ionicons name="location-outline" size={12} color="#16a34a" />
            <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: '#16a34a' }}>Usar dirección frecuente</Text>
          </TouchableOpacity>
        </View>

        {/* Description */}
        <Controller
          control={control}
          name={`stops.${index}.description`}
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label={isPassenger ? 'Nombre del pasajero' : 'Descripción de la carga'}
              placeholder={isPassenger ? 'Ej. Juan García' : 'Ej. Pallets de electrónica'}
              onChangeText={onChange}
              onBlur={onBlur}
              value={value}
              error={stopErrors?.description?.message}
            />
          )}
        />

        {/* Reference + Cargo Type row */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: isPassenger ? undefined : 1 }}>
            <Controller
              control={control}
              name={`stops.${index}.referenceNumber`}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label={isPassenger ? 'N° referencia' : 'N° referencia'} placeholder="PO-12345"
                  onChangeText={onChange} onBlur={onBlur} value={value}
                  error={stopErrors?.referenceNumber?.message} />
              )}
            />
          </View>
          {!isPassenger && (
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#475569', marginBottom: 6 }}>Tipo de carga</Text>
              <Controller
                control={control}
                name={`stops.${index}.cargoType`}
                render={({ field: { onChange, value } }) => (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {CARGO_TYPES.map((ct) => {
                        const active = value === ct.value;
                        return (
                          <TouchableOpacity key={ct.value} onPress={() => onChange(active ? undefined : ct.value)}
                            style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: active ? '#22c55e' : '#e2e8f0', backgroundColor: active ? '#f0fdf4' : '#fff' }}
                          >
                            <Text style={{ fontSize: 11, fontFamily: 'Inter_500Medium', color: active ? '#16a34a' : '#64748b' }}>{ct.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}
              />
            </View>
          )}
        </View>

        {/* Weight + Pieces — freight only */}
        {!isPassenger && (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name={`stops.${index}.weightKg`}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input label="Peso (kg)" placeholder="1500.00" keyboardType="decimal-pad"
                    onChangeText={onChange} onBlur={onBlur} value={value}
                    error={stopErrors?.weightKg?.message} />
                )}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Controller
                control={control}
                name={`stops.${index}.pieces`}
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input label="Piezas" placeholder="24" keyboardType="number-pad"
                    onChangeText={onChange} onBlur={onBlur} value={value as string}
                    error={stopErrors?.pieces?.message} />
                )}
              />
            </View>
          </View>
        )}

        {/* Contact */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name={`stops.${index}.contactName`}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label={isPassenger ? 'Responsable en destino' : 'Contacto destino'} placeholder="Nombre" autoCapitalize="words"
                  onChangeText={onChange} onBlur={onBlur} value={value} error={stopErrors?.contactName?.message} />
              )}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name={`stops.${index}.contactPhone`}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Teléfono" placeholder="+1 555 0000" keyboardType="phone-pad"
                  onChangeText={onChange} onBlur={onBlur} value={value} error={stopErrors?.contactPhone?.message} />
              )}
            />
          </View>
        </View>

        {/* Notes collapsible */}
        <TouchableOpacity onPress={() => setShowExtra((p) => !p)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
          <Ionicons name={showExtra ? 'chevron-up' : 'chevron-down'} size={14} color="#94a3b8" />
          <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: '#94a3b8' }}>
            {showExtra ? 'Ocultar notas' : 'Agregar notas'}
          </Text>
        </TouchableOpacity>

        {showExtra && (
          <Controller
            control={control}
            name={`stops.${index}.notes`}
            render={({ field: { onChange, onBlur, value } }) => (
              <Input label="Notas internas" placeholder="Instrucciones especiales de entrega..."
                onChangeText={onChange} onBlur={onBlur} value={value}
                error={stopErrors?.notes?.message} />
            )}
          />
        )}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NewRunScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const authDriverId = useAuthStore((s) => s.driverId);
  const [step, setStep] = useState<1 | 2>(1);
  const [runType, setRunType] = useState<RunType | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showTruckPicker, setShowTruckPicker] = useState(false);
  const [showDriverPicker, setShowDriverPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showGenerateDate, setShowGenerateDate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RecurringTemplate | null>(null);
  const [generateDate, setGenerateDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeStopIndex, setActiveStopIndex] = useState<number | null>(null);
  const pickerSheetRef = useRef<BottomSheetModalMethods>(null);
  const [stopOriginFeatures, setStopOriginFeatures] = useState<Array<GeocodeFeature | null>>([null]);
  const [stopOriginCoords, setStopOriginCoords] = useState<Array<{ lat: number; lng: number } | null>>([null]);
  const [stopFeatures, setStopFeatures] = useState<Array<GeocodeFeature | null>>([null]);
  const [stopDestCoords, setStopDestCoords] = useState<Array<{ lat: number; lng: number } | null>>([null]);
  const [saveAsFrequent, setSaveAsFrequent] = useState<boolean[]>([false]);

  const { data: myPermissions } = useQuery({
    queryKey: ['plans', 'me', 'permissions'],
    queryFn: () => PlansService.getMyPermissions(),
    staleTime: 2 * 60_000,
  });
  const canUseTemplates = myPermissions?.includes('templates.basic') ?? false;

  const { data: templatesData } = useQuery({
    queryKey: ['recurring-templates', 'active'],
    queryFn: () => RecurringTemplatesService.getAll({ active: true, limit: 50 }),
    staleTime: 5 * 60_000,
    enabled: canUseTemplates,
  });
  const activeTemplates = canUseTemplates ? (templatesData?.data ?? []) : [];

  const generateMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      RecurringTemplatesService.generate(id, date),
    onSuccess: (result) => {
      setShowGenerateDate(false);
      setSelectedTemplate(null);
      queryClient.invalidateQueries({ queryKey: ['delivery-runs'] });
      if (result.skipped) {
        const reasons: Record<string, string> = {
          already_generated: 'Ya existe un run para esa fecha.',
          paused:            'La plantilla está pausada.',
          pattern_mismatch:  'La fecha no coincide con los días de la plantilla.',
          exception:         'La fecha está marcada como excepción.',
          out_of_range:      'La fecha está fuera del rango de la plantilla.',
        };
        Alert.alert('Run no generado', reasons[result.skipReason ?? ''] ?? 'No se generó el run.');
      } else {
        router.replace(`/(app)/delivery/${result.runId}` as any);
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo generar el run.';
      Alert.alert('Error', Array.isArray(msg) ? msg[0] : msg);
    },
  });

  const { data: trucksData, isLoading: loadingTrucks } = useQuery({
    queryKey: ['trucks', 'available'],
    queryFn: () => TrucksService.getAll({ status: 'available', limit: 50 }),
    enabled: showTruckPicker,
  });

  const { data: driversData, isLoading: loadingDrivers } = useQuery({
    queryKey: ['drivers', 'available'],
    queryFn: () => DriversService.getAll({ status: 'available', limit: 50 }),
    enabled: showDriverPicker,
  });

  const truckItems: PickerItem[] = (trucksData?.data ?? []).map((t: Truck) => ({
    id: t.id,
    label: t.plate,
    sublabel: [t.make, t.model, t.year].filter(Boolean).join(' ') || undefined,
  }));

  const driverItems: PickerItem[] = (driversData?.data ?? []).map((d: Driver) => ({
    id: d.id,
    label: `${d.firstName} ${d.lastName}`,
    sublabel: d.licenseNumber ? `Licencia: ${d.licenseNumber}` : undefined,
  }));

  const { control, handleSubmit, trigger, watch, setValue, formState: { errors } } = useForm<RunForm>({
    resolver: zodResolver(runSchema),
    defaultValues: {
      name: '',
      scheduledDate: '',
      shift: undefined,
      startTime: '',
      truckId: undefined,
      driverIdField: authDriverId ?? undefined,
      stops: [{ originAddress: '', destination: '', description: '', referenceNumber: '', cargoType: undefined, weightKg: '', pieces: '', contactName: '', contactPhone: '', notes: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'stops' });

  const scheduledDate = watch('scheduledDate');
  const truckId       = watch('truckId');
  const driverIdField = watch('driverIdField');

  const selectedTruck  = truckItems.find((t) => t.id === truckId);
  const selectedDriver = driverItems.find((d) => d.id === driverIdField)
    ?? (authDriverId === driverIdField && driverIdField ? { id: driverIdField, label: 'Yo (conductor asignado)' } : undefined);

  const handlePickSaved = useCallback((index: number) => {
    setActiveStopIndex(index);
    pickerSheetRef.current?.present();
  }, []);

  const handleAddressSelected = useCallback((addr: SavedAddress) => {
    if (activeStopIndex !== null) {
      setValue(`stops.${activeStopIndex}.destination`, addr.formatted, { shouldValidate: true });
      setStopFeatures((prev) => prev.map((f, i) => (i === activeStopIndex ? null : f)));
      setSaveAsFrequent((prev) => prev.map((v, i) => (i === activeStopIndex ? false : v)));
      const lat = parseFloat(addr.lat);
      const lng = parseFloat(addr.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        setStopDestCoords((prev) => prev.map((c, i) => (i === activeStopIndex ? { lat, lng } : c)));
      }
    }
  }, [activeStopIndex, setValue]);

  const mutation = useMutation({
    mutationFn: async (values: RunForm) => {
      const shipments = await Promise.all(
        values.stops.map((stop, i) =>
          ShipmentsService.create({
            originAddress:           stop.originAddress || 'Sin especificar',
            originLat:               stopOriginCoords[i]?.lat,
            originLng:               stopOriginCoords[i]?.lng,
            destinationAddress:      stop.destination,
            destinationLat:          stopDestCoords[i]?.lat,
            destinationLng:          stopDestCoords[i]?.lng,
            description:             stop.description,
            referenceNumber:         stop.referenceNumber || undefined,
            cargoType:               (runType === 'passenger' ? 'passenger' : stop.cargoType) as any,
            weightKg:                stop.weightKg || undefined,
            pieces:                  stop.pieces ? parseInt(stop.pieces as string, 10) : undefined,
            destinationContactName:  stop.contactName || undefined,
            destinationContactPhone: stop.contactPhone || undefined,
            notes:                   stop.notes || undefined,
            driverId:                values.driverIdField ?? undefined,
          })
        )
      );
      const run = await DeliveryRunsService.create({
        name:          values.name,
        scheduledDate: values.scheduledDate,
        shift:         values.shift,
        startTime:     values.startTime || undefined,
        driverId:      values.driverIdField ?? undefined,
        truckId:       values.truckId ?? undefined,
        shipmentIds:   shipments.map((s) => s.id),
      });
      await Promise.allSettled(
        values.stops.map((_, i) => {
          const feature = stopFeatures[i];
          if (saveAsFrequent[i] && feature) {
            return SavedAddressesService.create({
              label:     feature.formatted.split(',')[0]?.trim() ?? feature.formatted,
              formatted: feature.formatted,
              lat:       feature.coordinates.lat,
              lng:       feature.coordinates.lng,
              placeId:   feature.placeId,
              locality:  feature.locality,
              region:    feature.region,
              postcode:  feature.postcode,
              country:   feature.country,
            });
          }
          return Promise.resolve();
        })
      );
      return run;
    },
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-runs'] });
      queryClient.invalidateQueries({ queryKey: ['saved-addresses'] });
      router.replace(`/(app)/delivery/${run.id}` as any);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'No se pudo crear el run.';
      Alert.alert('Error', Array.isArray(msg) ? msg[0] : msg);
    },
  });

  const handleNext = async () => {
    const ok = await trigger(['name', 'scheduledDate', 'shift', 'startTime']);
    if (ok) setStep(2);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ paddingTop: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              onPress={() => (step === 2 ? setStep(1) : router.back())}
              style={{ width: 36, height: 36, backgroundColor: '#f1f5f9', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="arrow-back" size={18} color="#334155" />
            </TouchableOpacity>
            <View>
              <Text style={{ fontSize: 20, fontFamily: 'Inter_700Bold', color: '#0f172a' }}>Nuevo run</Text>
              <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#94a3b8', marginTop: 1 }}>
                {step === 1 ? 'Paso 1 · Detalles' : 'Paso 2 · Paradas'}
              </Text>
            </View>
          </View>

          <StepIndicator step={step} />

          {/* ── Step 1 ── */}
          {step === 1 && (
            <View style={{ gap: 16 }}>

              {/* ── Plantillas ── */}
              {canUseTemplates ? (
                <View style={{ backgroundColor: '#f0fdf4', borderRadius: 16, borderWidth: 1, borderColor: '#bbf7d0', overflow: 'hidden' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, gap: 8 }}>
                    <Ionicons name="copy-outline" size={16} color="#16a34a" />
                    <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Inter_600SemiBold', color: '#15803d' }}>
                      Plantillas de rutas
                    </Text>
                    <TouchableOpacity
                      onPress={() => router.push('/(app)/templates' as any)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: '#16a34a' }}>Gestionar</Text>
                      <Ionicons name="open-outline" size={12} color="#16a34a" />
                    </TouchableOpacity>
                  </View>

                  {activeTemplates.length === 0 ? (
                    <TouchableOpacity
                      onPress={() => router.push('/(app)/templates' as any)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, gap: 8 }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0', borderStyle: 'dashed', paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="add-circle-outline" size={16} color="#22c55e" />
                        <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#16a34a' }}>Crear primera plantilla</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 6 }}>
                      {activeTemplates.slice(0, 3).map((t) => (
                        <TouchableOpacity
                          key={t.id}
                          onPress={() => { setSelectedTemplate(t); setShowGenerateDate(true); }}
                          activeOpacity={0.75}
                          style={{ backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0', paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                        >
                          <Ionicons
                            name={t.shipmentTemplates.some((s) => s.cargoType === 'passenger') ? 'people-outline' : 'cube-outline'}
                            size={16}
                            color="#22c55e"
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#0f172a' }} numberOfLines={1}>{t.name}</Text>
                            <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#64748b' }}>
                              {t.shipmentTemplates.length} {t.shipmentTemplates.length === 1 ? 'parada' : 'paradas'} · {t.time}
                            </Text>
                          </View>
                          <View style={{ backgroundColor: '#22c55e', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                            <Text style={{ fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>Usar</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                      {activeTemplates.length > 3 && (
                        <TouchableOpacity onPress={() => setShowTemplatePicker(true)} activeOpacity={0.7}>
                          <Text style={{ fontSize: 12, fontFamily: 'Inter_500Medium', color: '#16a34a', textAlign: 'center', paddingVertical: 4 }}>
                            Ver las {activeTemplates.length - 3} restantes
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => router.push('/(app)/plans' as any)}
                  activeOpacity={0.85}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fef9c3', borderWidth: 1, borderColor: '#fde047', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 }}
                >
                  <Ionicons name="lock-closed-outline" size={16} color="#854d0e" />
                  <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Inter_500Medium', color: '#854d0e' }}>
                    Las plantillas de rutas requieren un plan Pro o superior.
                  </Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_600SemiBold', color: '#854d0e' }}>Mejorar →</Text>
                </TouchableOpacity>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
                <Text style={{ fontSize: 11, fontFamily: 'Inter_400Regular', color: '#94a3b8' }}>o crea un run manualmente</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
              </View>

              <RunTypeSelector value={runType} onChange={setRunType} />

              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Nombre del run"
                    placeholder="Ej. Ruta Norte – Lunes"
                    autoCapitalize="sentences"
                    onChangeText={onChange}
                    onBlur={onBlur}
                    value={value}
                    error={errors.name?.message}
                  />
                )}
              />

              {/* Date picker trigger */}
              <Controller
                control={control}
                name="scheduledDate"
                render={({ field: { value } }) => (
                  <SelectField
                    label="Fecha programada"
                    value={value ? format(new Date(value + 'T12:00:00'), "EEEE d 'de' MMMM, yyyy", { locale: es }) : undefined}
                    placeholder="Seleccionar fecha"
                    icon="calendar-outline"
                    onPress={() => setShowDatePicker(true)}
                    error={errors.scheduledDate?.message}
                  />
                )}
              />

              {/* Shift */}
              <View>
                <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: '#475569', marginBottom: 8 }}>Turno (opcional)</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {SHIFTS.map((s) => (
                    <Controller
                      key={s.value}
                      control={control}
                      name="shift"
                      render={({ field: { onChange, value } }) => {
                        const active = value === s.value;
                        return (
                          <TouchableOpacity
                            onPress={() => onChange(value === s.value ? undefined : s.value)}
                            activeOpacity={0.75}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: active ? '#22c55e' : '#e2e8f0', backgroundColor: active ? '#f0fdf4' : '#fff', gap: 6 }}
                          >
                            <Ionicons name={s.icon} size={14} color={active ? '#22c55e' : '#64748b'} />
                            <Text style={{ fontSize: 13, fontFamily: 'Inter_500Medium', color: active ? '#16a34a' : '#475569' }}>{s.label}</Text>
                          </TouchableOpacity>
                        );
                      }}
                    />
                  ))}
                </View>
              </View>

              <Controller
                control={control}
                name="startTime"
                render={({ field: { value } }) => (
                  <SelectField
                    label="Hora de inicio (opcional)"
                    value={value || undefined}
                    placeholder="Seleccionar hora"
                    icon="time-outline"
                    onPress={() => setShowTimePicker(true)}
                    error={errors.startTime?.message}
                  />
                )}
              />

              {/* Truck selector */}
              <SelectField
                label="Camión (opcional)"
                value={selectedTruck?.label}
                placeholder="Asignar camión"
                icon="bus-outline"
                onPress={() => setShowTruckPicker(true)}
              />

              {/* Driver selector */}
              <SelectField
                label="Conductor (opcional)"
                value={selectedDriver?.label}
                placeholder="Asignar conductor"
                icon="person-outline"
                onPress={() => setShowDriverPicker(true)}
              />

              <Button fullWidth size="lg" onPress={handleNext} disabled={runType === null}>
                Siguiente
              </Button>
            </View>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <View>
              {errors.stops?.root && (
                <View style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 14, marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, color: '#dc2626', fontFamily: 'Inter_400Regular' }}>{errors.stops.root.message}</Text>
                </View>
              )}

              {fields.map((field, index) => (
                <StopRow
                  key={field.id}
                  index={index}
                  control={control}
                  errors={errors}
                  runType={runType}
                  onRemove={() => {
                    if (fields.length > 1) {
                      remove(index);
                      setStopOriginFeatures((prev) => prev.filter((_, i) => i !== index));
                      setStopOriginCoords((prev) => prev.filter((_, i) => i !== index));
                      setStopFeatures((prev) => prev.filter((_, i) => i !== index));
                      setStopDestCoords((prev) => prev.filter((_, i) => i !== index));
                      setSaveAsFrequent((prev) => prev.filter((_, i) => i !== index));
                    }
                  }}
                  onPickSaved={() => handlePickSaved(index)}
                  originFeature={stopOriginFeatures[index] ?? null}
                  onOriginFeatureSelect={(f) => {
                    setStopOriginFeatures((prev) => prev.map((x, i) => (i === index ? f : x)));
                    setStopOriginCoords((prev) => prev.map((x, i) => (i === index ? (f ? f.coordinates : null) : x)));
                  }}
                  selectedFeature={stopFeatures[index] ?? null}
                  onFeatureSelect={(f) => {
                    setStopFeatures((prev) => prev.map((x, i) => (i === index ? f : x)));
                    setStopDestCoords((prev) => prev.map((x, i) => (i === index ? (f ? f.coordinates : null) : x)));
                  }}
                  saveAsFrequent={saveAsFrequent[index] ?? false}
                  onSaveAsFrequentChange={(v) => setSaveAsFrequent((prev) => prev.map((x, i) => (i === index ? v : x)))}
                />
              ))}

              <TouchableOpacity
                onPress={() => {
                  append({ originAddress: '', destination: '', description: '', referenceNumber: '', cargoType: undefined, weightKg: '', pieces: '', contactName: '', contactPhone: '', notes: '' });
                  setStopOriginFeatures((prev) => [...prev, null]);
                  setStopOriginCoords((prev) => [...prev, null]);
                  setStopFeatures((prev) => [...prev, null]);
                  setStopDestCoords((prev) => [...prev, null]);
                  setSaveAsFrequent((prev) => [...prev, false]);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#86efac', borderRadius: 16, paddingVertical: 14, marginBottom: 20 }}
                activeOpacity={0.7}
              >
                <Ionicons name="add-circle-outline" size={20} color="#22c55e" />
                <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: '#16a34a' }}>Agregar parada</Text>
              </TouchableOpacity>

              <Button fullWidth size="lg" loading={mutation.isPending} onPress={handleSubmit((v) => mutation.mutate(v as RunForm))}>
                Crear run · {fields.length} {fields.length === 1 ? 'parada' : 'paradas'}
              </Button>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Time picker modal */}
      <TimePickerModal
        visible={showTimePicker}
        value={watch('startTime') ?? ''}
        onConfirm={(time) => { setValue('startTime', time, { shouldValidate: true }); setShowTimePicker(false); }}
        onClose={() => setShowTimePicker(false)}
      />

      {/* Truck picker */}
      <EntityPickerModal
        visible={showTruckPicker}
        title="Seleccionar camión"
        items={truckItems}
        selectedId={truckId}
        onSelect={(id) => setValue('truckId', id, { shouldValidate: true })}
        onClose={() => setShowTruckPicker(false)}
        loading={loadingTrucks}
      />

      {/* Driver picker */}
      <EntityPickerModal
        visible={showDriverPicker}
        title="Seleccionar conductor"
        items={driverItems}
        selectedId={driverIdField}
        onSelect={(id) => setValue('driverIdField', id, { shouldValidate: true })}
        onClose={() => setShowDriverPicker(false)}
        loading={loadingDrivers}
      />

      <SavedAddressPickerSheet sheetRef={pickerSheetRef} onSelect={handleAddressSelected} />

      {/* Template picker — muestra todas las plantillas activas */}
      <Modal visible={showTemplatePicker} transparent animationType="slide" onRequestClose={() => setShowTemplatePicker(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} activeOpacity={1} onPress={() => setShowTemplatePicker(false)} />
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '65%', paddingTop: 16, paddingBottom: 32 }}>
          <View style={{ width: 36, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, alignSelf: 'center', marginBottom: 12 }} />
          <Text style={{ fontSize: 16, fontFamily: 'Inter_700Bold', color: '#0f172a', paddingHorizontal: 20, marginBottom: 12 }}>Seleccionar plantilla</Text>
          <FlatList
            data={activeTemplates}
            keyExtractor={(t) => t.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
            renderItem={({ item: t }) => (
              <TouchableOpacity
                onPress={() => { setSelectedTemplate(t); setShowTemplatePicker(false); setShowGenerateDate(true); }}
                activeOpacity={0.75}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 12 }}
              >
                <View style={{ width: 36, height: 36, backgroundColor: '#f0fdf4', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={t.shipmentTemplates.some((s) => s.cargoType === 'passenger') ? 'people-outline' : 'cube-outline'} size={18} color="#22c55e" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: '#0f172a' }}>{t.name}</Text>
                  <Text style={{ fontSize: 12, fontFamily: 'Inter_400Regular', color: '#94a3b8' }}>
                    {t.shipmentTemplates.length} paradas · {t.time}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Generate date picker */}
      <Modal visible={showGenerateDate} transparent animationType="fade" onRequestClose={() => setShowGenerateDate(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }} activeOpacity={1} onPress={() => setShowGenerateDate(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: '#fff', borderRadius: 20, width: '100%', maxWidth: 360, padding: 24, elevation: 10 }}>
              <Text style={{ fontSize: 18, fontFamily: 'Inter_700Bold', color: '#0f172a', marginBottom: 4 }}>Seleccionar fecha</Text>
              {selectedTemplate && (
                <Text style={{ fontSize: 13, fontFamily: 'Inter_400Regular', color: '#64748b', marginBottom: 16 }}>
                  {selectedTemplate.name} · {selectedTemplate.shipmentTemplates.length} paradas
                </Text>
              )}
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#fff', marginBottom: 20 }}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={18} color="#22c55e" />
                <Text style={{ flex: 1, marginLeft: 10, fontSize: 14, fontFamily: 'Inter_400Regular', color: '#0f172a' }}>
                  {format(new Date(generateDate + 'T12:00:00'), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#94a3b8" />
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => { setShowGenerateDate(false); setSelectedTemplate(null); }} style={{ flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_500Medium', color: '#64748b' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { if (selectedTemplate) generateMutation.mutate({ id: selectedTemplate.id, date: generateDate }); }}
                  disabled={generateMutation.isPending}
                  style={{ flex: 2, paddingVertical: 13, borderRadius: 12, backgroundColor: '#22c55e', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: 14, fontFamily: 'Inter_600SemiBold', color: '#fff' }}>
                    {generateMutation.isPending ? 'Generando…' : 'Crear run'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Date picker — reutilizado también para el generate date */}
      <DatePickerModal
        visible={showDatePicker}
        value={showGenerateDate ? generateDate : scheduledDate}
        onConfirm={(date) => {
          if (showGenerateDate) {
            setGenerateDate(date);
          } else {
            setValue('scheduledDate', date, { shouldValidate: true });
          }
          setShowDatePicker(false);
        }}
        onClose={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
}
