# Fase 6: Pruebas Integrales, Contrato OpenAPI, Docker y Cierre del Frontend

**Estado:** Completada y Verificada ✅  
**Responsables técnicos:** Diego A. González (Frontend & PM) · Hugo A. Torrent (Analista Funcional & UI/UX) · Luciano O. Reguera (Integración API & DRM)  
**Especificación asociada:** [`docs/specs/02-especificacion-frontend-ui-ux-y-drm.md`](../specs/02-especificacion-frontend-ui-ux-y-drm.md)  
**Contrato verificado:** [`docs/specs/openapi.json`](../specs/openapi.json) (26 rutas)

---

## 1. Objetivo de la Fase

Certificar el Frontend antes de la entrega final de la Práctica Profesionalizante IV:

- Probar los circuitos completos que cruzan roles (alumno ⇄ Biblioteca), que las suites de las fases 1 a 5 cubrían por separado.
- Detectar por prueba automática cualquier diferencia entre la capa API de la SPA y el contrato congelado.
- Hacer la revisión en navegador real que quedó pendiente en las Fases 4 y 5.
- Empaquetar la build de producción en Docker y documentar cómo levantar el sistema completo.

---

## 2. Archivos Incorporados o Modificados

```text
frontend/
├── Dockerfile                         # NUEVO: build con pnpm + nginx
├── .dockerignore                      # NUEVO
├── nginx/
│   ├── default.conf.template          # NUEVO: SPA, fallback de rutas, proxy /api, MIME .mjs, caché
│   └── security-headers.conf          # NUEVO: CSP y cabeceras de seguridad
├── README.md                          # + comandos Docker y enlace a la Fase 6
└── src/test/
    ├── fake-backend.ts                # NUEVO: Backend simulado con estado compartido entre sesiones
    └── fase-06.spec.tsx               # NUEVO: 5 circuitos de punta a punta + 2 pruebas de contrato
docker-compose.yml                     # + servicio `frontend` (perfil opcional)
README.md                              # NUEVO: guía de ejecución integral del monorepo
docs/frontend/fases-implementacion.md  # Fase 6 marcada como completada
```

La aplicación (`src/` fuera de `test/`) no cambió en esta fase.

---

## 3. Suite de Pruebas Integrales (`src/test/fase-06.spec.tsx`)

### 3.1. Backend simulado con estado (`fake-backend.ts`)

Las pruebas de las fases anteriores simulan cada respuesta por separado. Para recorrer un circuito completo hace falta que lo que hace un rol lo vea el otro: `FakeFaudBackend` guarda usuarios, catálogo, préstamos y notificaciones en memoria y aplica las reglas del Backend que la SPA necesita observar:

- Login: `401` con credenciales inválidas y `403` con la cuenta `PENDIENTE` o `RECHAZADO`.
- JWT de sesión `jwt-<userId>` y token DRM `drm-<código>` por préstamo.
- Préstamos de 7 días con códigos desde `#1024`, y `409` ante un préstamo activo duplicado o una obra suspendida.
- Visor y stream con doble validación (sesión del titular o token DRM): `403` si el préstamo dejó de estar `ACTIVO` o venció.
- Avisos `PRESTAMO_OTORGADO` y `PRESTAMO_REVOCADO` en la bandeja del titular y en la auditoría de Biblioteca.
- Acciones de "otra sesión" para la prueba: `grantLoan()`, `revokeLoan()` y `expireSessions()`.

Las rutas que no conoce quedan en `unhandled`, y cada prueba termina verificando que esa lista esté vacía.

### 3.2. Circuitos de punta a punta

1. **RF05 — Registro y validación.** Lucía Fernández se registra en Iglesia, la cuenta nace `PENDIENTE` y el login muestra el banner ámbar del `403`. Biblioteca ingresa, ve la cuenta en **Cuentas por validar** (sidebar: 2 pendientes), la aprueba y el contador baja a 1. Al cerrar sesión, Lucía ingresa y llega a `/catalogo` con su departamento en la barra.
2. **RF02 → RF03 → RF04 → RF06 — Préstamo y revocación.** Un visitante busca `bioclim` con debounce y abre la ficha. Inicia sesión desde la ficha y vuelve a ella. Solicita el préstamo **#1024** (token DRM guardado) y abre el visor: canvas, marca de agua `Ana Pérez · Préstamo #1024` en la capa DOM y en los píxeles, y cuenta regresiva de 7 días. Biblioteca revoca el préstamo desde su sesión y, al volver a la pestaña, el visor se bloquea: destruye el documento, quita la marca de agua y descarta el token. **Mis préstamos** muestra `Activos (0)` y `Vencidos / Historial (1)`, y la campana, 2 avisos sin leer.
3. **RF01 — Catalogación.** Biblioteca carga un PDF en multipart (`POST /documentos` por `XMLHttpRequest`) y vuelve a la tabla con el aviso *"Documento catalogado"*. Al cerrar sesión, un visitante encuentra la obra buscando `calingasta` en el catálogo público.
4. **RF04 — Revocación desde el tablero.** Biblioteca revoca el préstamo de Ana desde `/admin/prestamos` con motivo obligatorio, y la **Auditoría de notificaciones** muestra el aviso con el motivo, sin leer. Ana abre el enlace del visor sin sesión, inicia sesión y encuentra la pantalla de bloqueo. El PDF nunca se pide (`GET /documentos/:id/ver` no aparece).
5. **Sesión vencida (`401`).** Con el JWT vencido en el Backend, la navegación a `/notificaciones` cierra la sesión, avisa *"Tu sesión expiró"* y redirige a `/login?redirect=%2Fnotificaciones`. Después del login vuelve a la bandeja. Ninguna fase anterior probaba este circuito.

### 3.3. Contrato OpenAPI ⇄ capa API (`RNF01`)

Las pruebas leen `docs/specs/openapi.json` y ejecutan **cada función** de `src/api/*.api.ts`, registrando la petición que emite (incluidas las subidas por `XMLHttpRequest`):

- **Ninguna función sin probar.** El tipo de la tabla de invocaciones exige una entrada por cada función exportada: si se agrega una función a la capa API y no se suma a la prueba, `tsc` falla.
- **Cada petición existe en el contrato**, con método y ruta. Un `{id}` del contrato solo acepta los identificadores de prueba, así que una ruta literal mal escrita (`/prestamos/mis-prestamo`) no pasa por `/prestamos/{id}`. Se comprobó con esa mutación: la prueba falla y nombra la función.
- **Los query params están declarados en el contrato.** Los filtros de los listados se escriben como `Required<CatalogFilterParams>`, `Required<AdminLoansFilterParams>`, etc., así que un filtro nuevo en los tipos obliga a probarlo.
- **Cobertura del contrato:** la SPA usa 22 de las 26 rutas. No consume `GET /departamentos/{id}`, `/usuarios/{id}`, `/notificaciones/{id}` ni `/prestamos/{id}`, porque obtiene esos datos de los listados. La prueba fija esa lista: cualquier cambio en el contrato obliga a revisarla.

### 3.4. Resultado

| Suite | Pruebas |
| :--- | :--- |
| Frontend (`pnpm run test`, Vitest) | **76** en verde: 5 (F0) + 12 (F1) + 14 (F2) + 13 (F3) + 13 (F4) + 12 (F5) + 7 (F6). Dos corridas completas consecutivas, sin fallos intermitentes. |
| Backend (`pnpm run test`, Jest) | **53** en verde (9 suites) |
| Backend (`pnpm run test:e2e`, Supertest) | **41** en verde |

`pnpm run build` compila TypeScript y genera el bundle sin advertencias. `pnpm run preview` sirve `/` y `/admin/prestamos` con `200`.

---

## 4. Docker y Despliegue de la SPA

### 4.1. Imagen (`frontend/Dockerfile`)

- **Etapa 1 (`node:22-alpine` + `pnpm@10.17.1`):** `pnpm install --frozen-lockfile` y `pnpm run build`, con `VITE_API_BASE_URL=/api/v1` (base relativa) y `VITE_SHOW_DEMO_ACCOUNTS=false` por defecto.
- **Etapa 2 (`nginx:1.27-alpine`):** sirve `dist/` y reenvía `/api/` al Backend (`API_UPSTREAM`, por defecto `http://host.docker.internal:3000`). Incluye un `HEALTHCHECK`.

Con la base relativa, el navegador habla con un solo origen: no hace falta sumar el puerto del contenedor a `CORS_ORIGIN` del Backend.

### 4.2. Configuración de nginx

| Aspecto | Configuración |
| :--- | :--- |
| Rutas del cliente | `try_files $uri /index.html`. `/visor/:id` y `/admin/*` responden `200` al recargar, y un asset inexistente devuelve `404`. |
| Worker de pdf.js | `mime.types` no conoce `.mjs`, y nginx lo servía como `application/octet-stream`. El navegador rechaza un module worker sin MIME de JavaScript, así que **el visor no habría cargado en el contenedor**. Se agregó `text/javascript mjs`. |
| Subida de PDFs | `client_max_body_size 55m` (50 MB del RF01 más los campos) y `proxy_request_buffering off`, para que la barra de progreso refleje la subida real. |
| Caché | `/assets/*` (con hash): `public, max-age=31536000, immutable`. `index.html`: `no-cache`. |
| Cabeceras (RNF02) | `Content-Security-Policy` (`default-src 'self'`, sin `unsafe-eval`, `connect-src 'self'`, `frame-ancestors 'none'`; solo Google Fonts como origen externo), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` y `server_tokens off`. |
| Rate Limiting | Ver 4.3. |

### 4.3. Hallazgo: `X-Forwarded-For` y el límite de intentos de login

El Backend identifica al cliente por la primera IP de `X-Forwarded-For` (`app.module.ts`, `getTracker`). Con `$proxy_add_x_forwarded_for`, nginx conserva la cabecera que manda el cliente y le agrega la IP real al final. Así, un cliente podría inventar una IP distinta en cada intento y esquivar el límite de 15 logins por minuto. Como nginx es el borde, ahora **reemplaza** la cabecera con `$remote_addr`.

Verificación: 17 intentos de login a través de `:8080`, cada uno con un `X-Forwarded-For` distinto → 15 respuestas `401` y luego `429`.

> El Backend sigue confiando en esa cabecera cuando se le habla directo al puerto `3000`. Ver 6.

### 4.4. Servicio en `docker-compose.yml`

El servicio `frontend` está bajo el perfil `frontend`, así que `docker compose up -d` sigue levantando solo PostgreSQL y Mailpit:

```bash
docker compose --profile frontend up -d --build      # SPA en http://localhost:8080
VITE_SHOW_DEMO_ACCOUNTS=true docker compose --profile frontend up -d --build   # con accesos de demostración
```

Variables: `FRONTEND_PORT` (8080), `API_UPSTREAM` y `VITE_SHOW_DEMO_ACCOUNTS`. `extra_hosts: host.docker.internal:host-gateway` permite llegar al Backend del host también en Linux. La guía completa está en el [`README.md`](../../README.md) de la raíz.

---

## 5. Revisión en Navegador Real (pendiente de las Fases 4 y 5)

Se recorrió la **build de producción servida por el contenedor** (con la CSP activa) contra el Backend en vivo, en **Microsoft Edge** controlado con `playwright-core`. Se usaron dos sesiones en paralelo (Ana Pérez y Biblioteca), en desktop (1440 × 900) y mobile (390 × 844), y se capturaron 25 pantallas.

| Verificación | Resultado |
| :--- | :--- |
| Préstamo desde la ficha del documento de 3 páginas de la Fase 5 | `#0019` otorgado |
| Visor: render real de pdf.js en canvas | Páginas 1 y 2 nítidas, 3 miniaturas, paginación y zoom operativos |
| Marca de agua | `Ana Pérez · Préstamo #0019` en mosaico, en encabezado y pie de página y en las miniaturas |
| Selección de texto | `user-select: none` en el visor |
| `@media print` | El canvas queda oculto al emular impresión |
| Alta de un PDF de **40 MB** a través de nginx | Progreso observado 0 → 34 → 55 → 72 → 92 → 100 %, redirección y aviso *"Documento catalogado"* |
| Revocación desde el tablero con el visor abierto en la otra sesión | Bloqueo al volver a la pestaña, sin canvas en el DOM |
| Desborde horizontal de página (todas las vistas, ambos anchos) | Ninguno. Las tarjetas KPI y las pestañas usan scroll interno, como en Figma. |
| Errores de consola, violaciones de CSP y requests fallidos | Ninguno, salvo el `403` esperado de la revalidación que bloquea el visor |
| Accesos de demostración en la build por defecto | Ocultos (`VITE_SHOW_DEMO_ACCOUNTS=false`) |

> **Estado que dejó la verificación en la base de desarrollo:** el préstamo `#0019` de Ana Pérez quedó `REVOCADO` (motivo *"Verificación integral de la Fase 6."*), con sus avisos `PRESTAMO_OTORGADO` y `PRESTAMO_REVOCADO`. El documento temporal de 40 MB se eliminó después con `DELETE /documentos/:id` (`200`, archivo removido del almacenamiento privado).

---

## 6. Observaciones Abiertas (Backend y alcance futuro)

Se arrastran de fases anteriores o surgieron en esta. Ninguna bloquea los criterios de aceptación.

- **`X-Forwarded-For` en el Backend.** Detrás de nginx está resuelto (4.3). Si el Backend queda expuesto sin proxy, conviene que `getTracker` use `req.ip` con `trust proxy` configurado en lugar de leer la cabecera.
- **Aviso de cuenta aprobada.** El Backend envía el correo `CUENTA_APROBADA` pero no registra la notificación (`prestamoId` es obligatorio), así que esas aprobaciones no aparecen en la auditoría (Fase 5).
- **Quitar el departamento de un documento.** `PATCH /documentos/:id` ignora `departamentoOrigenId: ""` (Fase 5).
- **Padrón sin paginación.** `GET /usuarios` devuelve todo el padrón. Alcanza para el volumen previsto (Fase 5).
- **Backend fuera de Docker.** El servicio `frontend` reenvía al Backend que corre en el host con `pnpm run start:dev`. Para un despliegue con un solo comando falta una imagen del Backend; con ella, basta `API_UPSTREAM=http://backend:3000`.

---

## 7. Matriz de Trazabilidad del Frontend (RF01–RF06 · RNF01–RNF02)

| Código | Requerimiento | Implementación en la SPA | Verificación | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **RF01** | Carga y catalogación de PDFs (≤ 50 MB) con metadatos normalizados | `AdminDocumentFormPage`, `AdminCatalogPage`, `catalogApi.create/update/remove`, `httpUpload` | F5 (pruebas 4–7, 11) · F6 circuito 3 · alta real de 40 MB por nginx | ✅ |
| **RF02** | Búsqueda pública combinada y ficha bibliográfica | `CatalogPage`, `CatalogFilters`, `DocumentDetailPage`, `TerritorialBanner` | F2 (14 pruebas) · F6 circuito 2 | ✅ |
| **RF03** | Préstamo digital de 7 días con disponibilidad concurrente | `RequestLoanModal`, `MyLoansPage`, `LoanCard` | F3 (pruebas de solicitud y Mis préstamos) · F6 circuitos 2 y 4 | ✅ |
| **RF04** | Visor protegido con DRM temporal, marca de agua y bloqueo al vencer o revocar | `ViewerPage`, `ProtectedPdfCanvas`, `DynamicWatermark`, `DrmSecurityShield`, `AdminLoansPage` (revocar) | F4 (13 pruebas) · F5 prueba 8 · F6 circuitos 2 y 4 · Edge real | ✅ |
| **RF05** | Registro por departamento (19), validación por Biblioteca, JWT y guardias de rol | `RegisterPage`, `LoginPage`, `AuthContext`, `RouteGuards`, `AdminUsersPage` | F1 (12 pruebas) · F5 pruebas 2–3 · F6 circuitos 1 y 5 | ✅ |
| **RF06** | Avisos de préstamo, alerta 24 h y control de vigencia | `NotificationBell`, `NotificationsPage`, `CountdownBadge`, `CronSummaryModal`, `NotificationsAuditPanel` | F3 (bandeja y campana) · F5 prueba 9 · F6 circuitos 2 y 4 | ✅ |
| **RNF01** | Cliente de una API REST paginada y documentada en OpenAPI 3.0 | `openapi.types.ts`, `http-client.ts`, `src/api/*.api.ts` | F6: contrato ⇄ capa API (rutas, métodos, query params y cobertura 22/26) | ✅ |
| **RNF02** | Seguridad de los PDFs y del cliente | PDF solo en memoria y canvas, sin URLs al binario, bloqueo de atajos, `@media print`, token DRM aparte del JWT, nginx con CSP y cabeceras, `X-Forwarded-For` saneado | F2 (ficha sin URLs al PDF) · F4 · F6 · Edge real · `curl` de cabeceras | ✅ |

---

## 8. Criterios de Aceptación

- [x] Suite Vitest + Testing Library con los cinco bloques del plan (Login/Registro, Catálogo y Ficha, Mis préstamos y Notificaciones, Visor DRM y Panel de Biblioteca) más los circuitos integrales de la Fase 6.
- [x] Contrato OpenAPI verificado automáticamente contra la capa API.
- [x] `pnpm run build` sin advertencias de tipos y `pnpm run preview` operativo.
- [x] `Dockerfile` + servicio en `docker-compose.yml` verificados: imagen construida, rutas del cliente, MIME del worker, cabeceras, proxy y Rate Limiting a través de nginx.
- [x] Guía de ejecución integral del monorepo (`README.md` de la raíz).
- [x] Revisión en navegador real, en desktop y mobile, de las vistas pendientes de las Fases 4 y 5.
- [x] Suites de `backend/` (53 unitarias + 41 e2e) y `frontend/` (76) en verde, con trazabilidad completa RF01–RF06 y RNF01–RNF02.
