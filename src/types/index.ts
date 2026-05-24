// ─── Auth ────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'super_admin'
  | 'company_owner'
  | 'admin'
  | 'manager'
  | 'dispatcher'
  | 'driver'
  | 'accountant'
  | 'viewer';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export type CompanyType = 'carrier' | 'broker' | 'shipper';

export type CompanyStatus =
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'pending_verification';

export type ServiceType = 'freight' | 'passenger' | 'mixed';

export type BusinessModel = 'independent' | 'small_fleet' | 'enterprise';

/** Shape returned by GET /auth/profile and all auth endpoints (sanitizeUser) */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  companyId: string | null;
  timezone: string;
  language: string;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Shape returned by GET /companies/:id */
export interface Company {
  id: string;
  name: string;
  legalName: string | null;
  type: CompanyType;
  status: CompanyStatus;
  serviceType: ServiceType;
  businessModel: BusinessModel;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  mcNumber: string | null;
  dotNumber: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ─── Delivery Run ─────────────────────────────────────────────────────────────

export type RunStatus =
  | 'planned'
  | 'ready'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type StopStatus =
  | 'pending'
  | 'in_transit'
  | 'arrived'
  | 'delivered'
  | 'failed';

export type StopType = 'pickup' | 'dropoff' | 'waypoint';

export interface RunStop {
  id: string;
  sequence: number;
  type: StopType;
  status: StopStatus;
  address: string;
  lat: number;
  lng: number;
  // Contact at destination
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  // Timestamps
  arrivedAt?: string;
  deliveredAt?: string;
  // ETA / distance (from optimize)
  eta?: string;
  distanceKm?: number;
  // Shipment data (populated from API)
  trackingCode?: string;
  referenceNumber?: string | null;
  description?: string;
  weightKg?: string | null;
  volumeM3?: string | null;
  pieces?: number | null;
  cargoType?: string;
  priority?: string;
  originAddress?: string;
  originContactName?: string | null;
  originContactPhone?: string | null;
  podUrl?: string | null;
  podSignedBy?: string | null;
  shipmentStatus?: string;
  publicTrackingToken?: string | null;
}

export type RunShift = 'morning' | 'afternoon' | 'evening' | 'night' | 'custom';

export interface DeliveryRun {
  id: string;
  name: string;
  status: RunStatus;
  driverId: string;
  truckId?: string;
  truckPlate?: string;
  scheduledDate: string;
  shift?: RunShift;
  startTime?: string | null;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  stops: RunStop[];
  totalStops: number;
  completedStops: number;
  notes?: string;
  optimizedAt?: string;
}

// ─── Expense ──────────────────────────────────────────────────────────────────

export type ExpenseCategory =
  | 'fuel'
  | 'toll'
  | 'maintenance'
  | 'meal'
  | 'parking'
  | 'repair'
  | 'lodging'
  | 'other';

export type ExpenseStatus = 'pending' | 'approved' | 'rejected';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  description?: string;
  receiptUrl?: string;
  status: ExpenseStatus;
  driverId: string;
  runId?: string;
  createdAt: string;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  isOnline?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  attachmentUrl?: string;
  createdAt: string;
  readAt?: string;
  pending?: boolean;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'run_assigned'
  | 'run_updated'
  | 'message_received'
  | 'expense_approved'
  | 'expense_rejected'
  | 'general';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  readAt?: string;
  createdAt: string;
}

// ─── Location ─────────────────────────────────────────────────────────────────

export interface LocationUpdate {
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  timestamp: number;
}

// ─── Passenger ───────────────────────────────────────────────────────────────

export type PassengerStatus = 'pending' | 'checked_in' | 'checked_out' | 'absent';

export interface Passenger {
  id: string;
  name: string;
  phone?: string;
  guardianName?: string;
  guardianPhone?: string;
  pickupAddress: string;
  dropoffAddress: string;
  status: PassengerStatus;
  checkedInAt?: string;
  checkedOutAt?: string;
  notes?: string;
}

export interface PassengerRun extends DeliveryRun {
  passengers: Passenger[];
  totalPassengers: number;
  checkedInCount: number;
  serviceSubtype?: 'school' | 'medical' | 'tourism';
}

// ─── Compliance ───────────────────────────────────────────────────────────────

export type VerificationTierCode =
  | 'unverified'
  | 'basic'
  | 'verified'
  | 'premium'
  | 'passenger_safe';

export type ComplianceBlockReason =
  | 'no_verification'
  | 'tier_not_approved'
  | 'tier_expired';

export interface ComplianceStatus {
  companyId: string;
  serviceType: ServiceType;
  canOperate: boolean;
  currentTier: VerificationTierCode | null;
  requiredTier: VerificationTierCode | null;
  blockReason?: ComplianceBlockReason;
  missingDocuments: string[];
  expiresAt?: string;
}

// ─── ETA ──────────────────────────────────────────────────────────────────────

export interface EtaStop {
  stopId: string;
  sequence: number;
  etaMinutes: number;
  etaTime: string;
  distanceKm: number;
}

export interface RunEtas {
  runId: string;
  stops: EtaStop[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  calculatedAt: string;
}

// ─── Geocoding ────────────────────────────────────────────────────────────────

export interface GeocodeFeature {
  placeId: string;
  formatted: string;
  coordinates: { lat: number; lng: number };
  confidence: number;
  featureType?: string;
  country?: string;
  region?: string;
  locality?: string;
  postcode?: string;
}

export interface GeocodeSearchResult {
  provider: 'mapbox' | 'mock';
  features: GeocodeFeature[];
  cached: boolean;
}

// ─── Saved Addresses ──────────────────────────────────────────────────────────

export type SavedAddressKind = 'depot' | 'customer' | 'dropoff' | 'pickup' | 'other';

export interface SavedAddress {
  id: string;
  label: string;
  kind: SavedAddressKind;
  formatted: string;
  lat: string;
  lng: string;
  placeId?: string | null;
  confidence?: string | null;
  country?: string | null;
  region?: string | null;
  locality?: string | null;
  postcode?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Driver ───────────────────────────────────────────────────────────────────

export type DriverStatus = 'available' | 'on_trip' | 'off_duty' | 'suspended';

export interface Driver {
  id: string;
  companyId: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  licenseNumber: string;
  licenseClass: string | null;
  licenseState: string | null;
  licenseExpiresAt: string | null;
  status: DriverStatus;
  ratingAvg: string;
  totalTrips: number;
  currentTruckId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Truck ────────────────────────────────────────────────────────────────────

export type TruckStatus = 'available' | 'in_transit' | 'out_of_service' | 'maintenance';
export type TruckType = 'flatbed' | 'reefer' | 'dry-van' | 'tanker' | 'box' | 'other';

export interface Truck {
  id: string;
  companyId: string;
  plate: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  type: TruckType | null;
  capacityKg: string | null;
  status: TruckStatus;
  currentDriverId: string | null;
  insuranceExpiresAt: string | null;
  registrationExpiresAt: string | null;
  odometerKm: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Shipment ─────────────────────────────────────────────────────────────────

export type ShipmentStatus =
  | 'draft'
  | 'pending_acceptance'
  | 'quoted'
  | 'confirmed'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'at_stop'
  | 'delivered'
  | 'pod_uploaded'
  | 'completed'
  | 'incident'
  | 'cancelled';

export interface Shipment {
  id: string;
  companyId: string;
  driverId: string | null;
  truckId: string | null;
  deliveryRunId: string | null;
  runSequence: number | null;
  status: ShipmentStatus;
  priority: string;
  trackingCode: string;
  referenceNumber: string | null;
  originAddress: string;
  originContactName: string | null;
  originContactPhone: string | null;
  destinationAddress: string;
  destinationContactName: string | null;
  destinationContactPhone: string | null;
  description: string;
  weightKg: string | null;
  volumeM3: string | null;
  pieces: number | null;
  cargoType: string;
  pickupAt: string | null;
  deliveryAt: string | null;
  deliveredAt: string | null;
  podUrl: string | null;
  podSignedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Shipment Timeline ────────────────────────────────────────────────────────

export interface ShipmentTimelineEvent {
  event: string;
  at: string;
  by?: string | null;
  reason?: string | null;
}

export interface ShipmentTimeline {
  shipmentId: string;
  trackingCode: string | null;
  currentStatus: string;
  events: ShipmentTimelineEvent[];
}

// ─── Verification ────────────────────────────────────────────────────────────

export type VerificationStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'expired';

export interface VerificationTier {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  validityDays?: number | null;
  isActive: boolean;
}

export interface VerificationDocument {
  id: string;
  type: string;
  url: string;
  name: string;
  createdAt: string;
}

export interface Verification {
  id: string;
  companyId: string;
  tierId: string;
  status: VerificationStatus;
  reviewNotes?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  expiresAt?: string | null;
  documents?: VerificationDocument[];
  createdAt: string;
}

// ─── Recurring Templates ─────────────────────────────────────────────────────

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface ShipmentTemplateSnapshot {
  originAddress: string;
  originLat?: string;
  originLng?: string;
  destinationAddress: string;
  destinationLat?: string;
  destinationLng?: string;
  description: string;
  cargoType: string;
  weightKg?: string;
  volumeM3?: string;
  pieces?: number;
  metadata?: Record<string, unknown>;
}

export interface RecurringTemplate {
  id: string;
  companyId: string;
  name: string;
  pattern: RecurrencePattern;
  daysOfWeek: number[];
  time: string;
  startDate: string;
  endDate: string | null;
  exceptions: string[];
  driverId: string | null;
  truckId: string | null;
  routeId: string | null;
  shipmentTemplates: ShipmentTemplateSnapshot[];
  active: boolean;
  lastGeneratedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface GenerationResult {
  templateId: string;
  date: string;
  runId: string;
  shipmentIds: string[];
  skipped: boolean;
  skipReason?: 'exception' | 'pattern_mismatch' | 'paused' | 'already_generated' | 'out_of_range';
}

// ─── Plans & Subscriptions ───────────────────────────────────────────────────

export type PlanTier = 'free' | 'pro' | 'enterprise';
export type PlanAudience = 'courier' | 'passenger' | 'fleet' | 'any';
export type SubscriptionStatus = 'active' | 'pending_payment' | 'suspended' | 'canceled';

export interface Plan {
  id: string;
  code: string | null;
  name: string;
  description?: string | null;
  audience: PlanAudience | null;
  tier: PlanTier | null;
  price: number;
  interval: string;
  is_active: boolean;
  limits: Record<string, Record<string, number>>;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  company_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at?: string | null;
  provider: string;
  grace_period_until?: string | null;
  last_renewal_attempt_at?: string | null;
  last_renewal_init_point?: string | null;
  suspended_at?: string | null;
  reactivated_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingRenewal {
  subscriptionId: string;
  status: string;
  planId: string;
  planName: string;
  amount: number;
  currency: 'CLP';
  currentPeriodEnd: string;
  gracePeriodUntil: string | null;
  lastRenewalAttemptAt: string | null;
  initPoint: string | null;
}

export interface RetryRenewalResult {
  subscriptionId: string;
  initPoint: string;
  expiresInSec: number;
}

export interface CheckoutResult {
  initPoint: string;
  sandboxInitPoint?: string;
  providerCheckoutId: string;
  externalReference: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}
