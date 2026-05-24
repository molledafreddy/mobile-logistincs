# mobile-logistics — Estado de implementación

> Última actualización: 2026-05-24 (sesión 8 — análisis pagos)

## Stack

| Tecnología | Versión | Rol |
|---|---|---|
| Expo SDK | 54 | Runtime / build toolchain |
| Expo Router | v6 | Navegación file-based |
| React Native | 0.76+ | Framework UI |
| NativeWind | v4 | Tailwind CSS en RN (tema verde `#22c55e`) |
| TanStack Query | v5 | Server state, cache, invalidación |
| Zustand | v5 | Estado global del cliente |
| MMKV | — | Persistencia local (offline queue, tokens, driverId, push_token, flags) |
| Socket.io-client | — | Tiempo real (chat, tracking) |
| jest-expo | 55 (jest 29) | Testing — NO compatible con jest 30 |

---

## Infraestructura base

| Módulo | Archivo | Estado |
|---|---|---|
| QueryClient global | `app/_layout.tsx` | ✅ |
| Auth hydration al inicio | `app/_layout.tsx` | ✅ |
| Interceptor refresh token | `src/services/api/client.ts` | ✅ |
| Push notifications (registro, cold start, warm tap) | `app/_layout.tsx` | ✅ |
| Deep links push → pantalla (run, chat, expenses, notifications) | `src/services/notifications/notifications.service.ts` | ✅ |
| Deep links URL scheme (`logistics://activate`, `logistics://run/:id`) | `app/_layout.tsx` | ✅ |
| Offline queue auto-sync al reconectar | `app/_layout.tsx` | ✅ |
| NetworkBanner global | `app/_layout.tsx` | ✅ |
| Push token guardado en MMKV + deregistro en logout | `src/services/storage/` + `src/stores/auth.store.ts` | ✅ |

---

## Servicios API — Cobertura por módulo

| Módulo API | Endpoints cubiertos | Endpoints no cubiertos (y por qué) |
|---|---|---|
| **auth** | `POST /login`, `POST /logout`, `GET /profile`, `POST /register`, `POST /activate`, `PATCH /change-password` | — |
| **delivery-runs** | `POST /`, `GET /`, `GET /:id`, `PATCH /:id` (update), `POST /:id/cancel`, `POST /:id/start`, `POST /:id/complete`, `POST /:id/stops/:id/done`, `POST /:id/stops/:id/incident` | `PATCH /:id/assign-driver`, add/remove/reorder shipments — rol dispatcher en web |
| **shipments** | `POST /` (en wizard de run), `GET /`, `GET /:id`, `GET /:id/timeline` | Mutations de status, POD, accept/reject — web backoffice |
| **drivers** | `GET /`, `GET /:id/stats`, `PATCH /:id/status` | `POST /`, `GET /:id/current-trip`, `PATCH /:id`, `DELETE /:id` — CRUD de administración en web |
| **trucks** | `GET /`, `GET /:id`, `PATCH /:id`, `PATCH /:id/status`, `PATCH /:id/assign-driver`, `PATCH /:id/unassign-driver` | `POST /`, `GET /:id/location`, `DELETE /:id` — CRUD en web |
| **expenses** | `POST /`, `GET /` | `PATCH /:id/approve`, `PATCH /:id/reject` — **P5 pendiente**; reimburse/delete en web |
| **tracking** | `POST /points`, `POST /points/bulk` | Query/historial — solo necesario en backoffice |
| **dashboard** | `GET /overview`, `GET /expenses/by-category` | — |
| **verifications** | `GET /tiers`, `POST /`, `GET /company/:id`, `GET /:id`, `GET /:id/documents`, `POST /:id/documents`, `GET /compliance/:id` | `PATCH /:id/review` — super_admin en web |
| **notifications** | `GET /`, `PATCH /:id/read`, `PATCH /read-all`, `POST /push-tokens`, `DELETE /push-tokens/:token` | — |
| **chat** | completo | — |
| **saved-addresses** | `GET /`, `GET /:id` | Mutaciones — web |
| **geocoding** | completo | — |
| **companies** | `GET /`, `GET /:id` | Mutaciones — web |
| **reports** | — | Todos — solo necesarios en web backoffice |
| **plans / subscriptions / billing** | `GET /plans/catalog`, `GET /plans/me/limits`, `GET /plans/me/permissions`, `GET /subscriptions/company/:id`, `POST /subscriptions/free`, `PATCH /subscriptions/:id/upgrade`, `PATCH /subscriptions/:id/cancel`, `POST /payments/checkout`, `GET /billing/me/renewal`, `POST /billing/me/retry` | Pantallas implementadas (`billing/index.tsx`, `plans/index.tsx`). Pasarela: **MercadoPago** (redirect web via `Linking.openURL`). Gaps: sin deep link de retorno post-pago, sin `sandboxInitPoint` en dev, sin historial de facturas. Ver sección Pendientes. |
| **recurring-templates** | — | B4 futuro |
| **admin / audit / users** | — | Solo super_admin en web |

---

## Servicios API (archivos)

| Servicio | Métodos |
|---|---|
| `AuthService` | `login`, `logout`, `getMe`, `activate`, `register`, `changePassword`, `registerDeviceToken`, `deregisterDeviceToken` |
| `DeliveryRunsService` | `create`, `update`, `cancel`, `getMyRuns`, `getActiveRun`, `getRunById`, `startRun`, `completeRun`, `optimizeRun`, `getRunEtas`, `markStopDone`, `reportStopIncident` |
| `ShipmentsService` | `create`, `getAll`, `getById`, `getTimeline` |
| `DriversService` | `create`, `getAll`, `getById`, `getStats`, `updateStatus` |
| `TrucksService` | `create`, `getAll`, `getById`, `assignDriver`, `unassignDriver`, `updateStatus`, `update` |
| `TrackingService` | `sendLocation`, `sendLocationBulk` |
| `ExpensesService` | `getMyExpenses`, `createExpense`, `uploadReceipt` |
| `DashboardService` | `getOverview`, `getExpensesByCategory` |
| `VerificationsService` | `getCompliance`, `getTiers`, `getCompanyVerifications`, `getVerification`, `createVerification`, `getDocuments`, `addDocument`, `uploadFile` |
| `GeocodingService` | `search`, `reverseGeocode` |
| `SavedAddressesService` | `getAll`, `getById` |
| `NotificationsService` | `register`, `deregister`, `getAll`, `markRead`, `markAllRead` |
| `ChatService` | `getConversations`, `getMessages`, `sendMessage` |
| `PassengersService` | completo |
| `CompaniesService` | `getById`, `getAll` |

---

## Tipos (`src/types/index.ts`)

Todos los tipos necesarios para la app están definidos, incluyendo los añadidos en sesiones recientes:
`RunShift`, `VerificationStatus`, `VerificationTier`, `VerificationDocument`, `Verification`, `ShipmentTimelineEvent`, `ShipmentTimeline`.

---

## StorageService — Keys MMKV

| Key | Propósito |
|---|---|
| `access_token` | JWT access token |
| `refresh_token` | JWT refresh token |
| `user_data` | Caché de AuthUser |
| `driver_id` | ID del Driver entity |
| `setup_completed_v1` | Flag anti-bypass del wizard |
| `push_token` | Token push para deregistro en logout |

---

## Offline Queue

| Op | Comportamiento en flush |
|---|---|
| `stop_status` | Request individual por op |
| `message` | Request individual por op |
| `expense` | Request individual por op |
| `location_update` | **Un único `POST /tracking/points/bulk`** con todos los puntos acumulados |

Retry: `MAX_RETRIES = 5`. Cap de location ops: 50.

---

## Pantallas — Mapa completo

### Auth & Onboarding
| Pantalla | Archivo | Estado |
|---|---|---|
| Login | `app/(auth)/login.tsx` | ✅ |
| Registro | `app/(auth)/register.tsx` | ✅ |
| Activar cuenta (token email) | `app/(auth)/activate.tsx` | ✅ |
| Setup wizard post-registro (perfil + vehículo) | `app/(auth)/setup.tsx` | ✅ |
| Onboarding permisos | `app/onboarding.tsx` | ✅ |

### Tabs principales
| Pantalla | Archivo | Estado |
|---|---|---|
| Home (dashboard conductor) | `app/(app)/(tabs)/home/index.tsx` | ✅ |
| Lista de runs (filtros estado) | `app/(app)/(tabs)/runs/index.tsx` | ✅ |
| Chat — lista conversaciones | `app/(app)/(tabs)/chat/index.tsx` | ✅ |
| Chat — conversación + offline queue | `app/(app)/(tabs)/chat/[id].tsx` | ✅ |
| Expenses — lista | `app/(app)/(tabs)/expenses/index.tsx` | ✅ |
| Nueva expense — foto S3 + offline | `app/(app)/(tabs)/expenses/new.tsx` | ✅ |
| Perfil | `app/(app)/(tabs)/profile/index.tsx` | ✅ |

### Delivery & Operación
| Pantalla | Archivo | Estado |
|---|---|---|
| Detalle del run + optimización + editar + cancelar | `app/(app)/delivery/[runId]/index.tsx` | ✅ |
| Parada freight (arrive → foto → firma → done/incident) | `app/(app)/delivery/[runId]/stop/[stopId].tsx` | ✅ |
| Parada pasajero | `app/(app)/delivery/[runId]/passenger/[stopId].tsx` | ✅ |
| Crear delivery run (wizard 2 pasos) | `app/(app)/runs/new.tsx` | ✅ |
| Detalle de shipment + historial de eventos | `app/(app)/shipments/[id].tsx` | ✅ |
| Tracking activo + reverse geocoding | `app/(app)/tracking/active.tsx` | ✅ |
| Notificaciones | `app/(app)/notifications/index.tsx` | ✅ |

### Empresa & Flota
| Pantalla | Archivo | Estado |
|---|---|---|
| Gestión de flota (conductores + status editable + asignación) | `app/(app)/fleet/index.tsx` | ✅ |
| Mi vehículo | `app/(app)/my-truck.tsx` | ✅ |
| Verificación de empresa + subida de documentos S3 | `app/(app)/verification/index.tsx` | ✅ |
| Cambiar contraseña | `app/(app)/change-password.tsx` | ✅ |
| Saved addresses — lista y detalle | `app/(app)/saved-addresses/` | ✅ |

### Planes & Pagos (MercadoPago)
| Pantalla | Archivo | Estado | Notas |
|---|---|---|---|
| Suscripción activa + pagar ahora + reintentar | `app/(app)/billing/index.tsx` | ✅ código / ⚠️ sin validar en dispositivo | Muestra estado, monto, período de gracia. Abre `initPoint` con `Linking.openURL`. |
| Catálogo de planes (por vertical) | `app/(app)/plans/index.tsx` | ✅ código / ⚠️ sin validar en dispositivo | Agrupa por audience, muestra límites y permisos. Flujo: upgrade → checkout → `Linking.openURL`. |

### Métricas
| Pantalla | Archivo | Estado |
|---|---|---|
| Dashboard (conductor + empresa + gastos del mes) | `app/(app)/metrics.tsx` | ✅ |

---

## Tests — Estado actual

**Suite:** 4 archivos / **40 tests / 40 passing** ✅

| Archivo | Tests | Qué cubre |
|---|---|---|
| `offline-queue.service.spec.ts` | 17 | enqueue, flush individual + bulk location, retry, drop MAX_RETRIES, aislamiento entre tipos |
| `DeliveryFlowFactory.spec.ts` | 8 | factory por vertical, compliance, rutas |
| `auth.store.spec.ts` | 9 | login, logout (+ deregisterDeviceToken), hydrate, driverId caché y API |
| `useDeliveryStop.spec.ts` | 6 | arrive, deliver online/offline, fail online/offline |

> ⚠️ `useDeliveryStop.spec.ts` deja timers de TanStack Query sin limpiar. Los tests pasan pero hay un warning de "worker process exited forcefully". No afecta CI.

---

## Cambios en backend (api-logistics)

| Cambio | Archivo | Descripción |
|---|---|---|
| `ChangePasswordDto` | `src/modules/auth/dto/change-password.dto.ts` | DTO para cambio de contraseña |
| `AuthService.changePassword` | `src/modules/auth/auth.service.ts` | Verifica contraseña actual antes de actualizar |
| `PATCH /auth/change-password` | `src/modules/auth/auth.controller.ts` | Ruta protegida con JWT |

---

## Pendientes

### Media prioridad (1 ítem)

| # | Ítem | Descripción | Endpoints |
|---|---|---|---|
| **P5** | **Aprobación de gastos** | UI para `company_owner` / `manager` / `dispatcher` para aprobar o rechazar gastos pendientes. El dashboard de métricas ya muestra el contador. Requiere lista filtrada por `status=pending` + acciones inline. | `PATCH /expenses/:id/approve`, `PATCH /expenses/:id/reject` |

### Deuda técnica (1 ítem)

| # | Ítem | Descripción |
|---|---|---|
| **T2** | **Test `TrackingService.sendLocationBulk`** | Verificar que el payload `{ points: [...] }` se construye con campos como strings numéricos. Test unitario simple. |

### Baja prioridad / Futuro

| # | Ítem | Descripción |
|---|---|---|
| B1 | **Detox E2E** | Flujos críticos: login → run → stop done |
| B2 | **Web Backoffice (Next.js)** | Sprints 13-16 del plan original |
| B3 | **MercadoPago live** | Validar flujo completo en dispositivo con sandbox MP. API ya funciona. |
| B4 | **Recurring templates** | UI para crear runs recurrentes |
| B5 | **Shipment creation standalone** | Crear envío sin run (rol dispatcher) |
| B6 | **Expense detail + filters** | Ver detalle de un gasto, filtrar por fecha/categoría |
| B7 | **Teardown de timers en useDeliveryStop.spec.ts** | Añadir `afterEach(() => jest.useRealTimers())` para evitar el warning de worker exit |

### Gaps de MercadoPago (pendiente validación)

| # | Ítem | Prioridad | Descripción |
|---|---|---|---|
| MP1 | **Deep link de retorno post-pago** | Alta | Configurar `back_urls` en el checkout para que MP redirija de vuelta a la app al completar el pago. Sin esto el usuario vuelve manualmente. |
| MP2 | **Usar `sandboxInitPoint` en desarrollo** | Alta | El `.env` no tiene variable para alternar entre `initPoint` (prod) y `sandboxInitPoint` (test). Agregar `EXPO_PUBLIC_MP_ENV=sandbox\|production`. |
| MP3 | **Pantalla de confirmación post-pago** | Media | Al volver a la app no hay feedback de éxito/error. Solo el polling de TanStack Query detecta el cambio. |
| MP4 | **Polling más agresivo al hacer foco** | Media | Al volver de MP el browser, refetch inmediato de `subscription` y `renewal` para mostrar estado actualizado. |
| MP5 | **Historial de facturas** | Baja | No hay pantalla de facturas/recibos descargables. |
| MP6 | **Tests unitarios de billing.service** | Baja | `createCheckout`, `getMyRenewal`, `retry` sin cobertura de test. |

---

## Notas de integración API

- **`arrived`** — estado local UI únicamente, no tiene endpoint.
- **Tracking payload** — lat/lng/speed/heading/accuracy como **strings**.
- **Tracking bulk** — cap interno 50 ops, API acepta hasta 500. Sin chunking necesario.
- **Upload S3** — 3 pasos: `POST /files/upload-url` → `PUT` binario → `GET /files/download-url?key=`.
- **Stop done vs incident** — endpoints separados (`/done` y `/incident`).
- **Multi-tenant** — `company_id` implícito vía JWT.
- **`stop.id === shipment.id`** — las paradas de un run son shipments; mismo ID en backend.
- **Creación de run** — 2 pasos: `POST /shipments` por parada, luego `POST /delivery-runs` con `shipmentIds`.
- **Verificación** — flujo: compliance → tier requerido → `POST /verifications` → `POST /verifications/:id/documents` (con URL S3 ya subida).
- **Push token** — persiste en MMKV al registrarse, deregistra con `DELETE /notifications/push-tokens/:token` en logout.
- **Cambio de contraseña** — backend verifica contraseña actual via Supabase antes de actualizar.
