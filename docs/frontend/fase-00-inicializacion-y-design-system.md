# Fase 0: Inicialización de la SPA, Design System (Figma) y Cliente HTTP Tipado

**Estado:** Completada y Verificada ✅  
**Responsables técnicos:** Diego A. González (Frontend & PM) · Hugo A. Torrent (Analista Funcional & UI/UX) · Luciano O. Reguera (Integración API & DRM)  
**Especificación asociada:** [`docs/specs/02-especificacion-frontend-ui-ux-y-drm.md`](../specs/02-especificacion-frontend-ui-ux-y-drm.md)  
**Contrato consumido:** [`docs/specs/openapi.json`](../specs/openapi.json) (`v1.0.0` — 26 endpoints y 50 esquemas DTO)

---

## 1. Objetivo de la Fase

Dejar operativo el esqueleto del proyecto **React 18 + Vite + TypeScript** en `frontend/` gestionado con **`pnpm`**, con **Tailwind CSS** configurado según la identidad visual institucional de la **FAUD-UNSJ (Prototipos Figma páginas 7 a 14)**, contratos TypeScript espejados 1:1 con `docs/specs/openapi.json`, cliente HTTP centralizado con interceptores de sesión JWT y DRM temporal (7 días), servicio de notificaciones (`ToastContext`) y Layout institucional conectado en vivo a `GET /api/v1/health`.

---

## 2. Estructura de Directorios Implementada en `frontend/`

```text
frontend/
├── .env.example                   # Plantilla de variables de entorno
├── index.html                     # Entrada HTML con Inter (400–800) y favicon FAUD
├── package.json                   # Scripts y dependencias gestionadas con pnpm
├── tailwind.config.js             # Tokens del Design System Figma (colores, escala tipográfica, radios, layouts)
├── vite.config.ts                 # Servidor puerto 5173, proxy /api -> :3000 y Vitest (jsdom)
├── public/brand/                  # Logos UNSJ y FAUD + foto del edificio, extraídos del PDF de prototipos
└── src/
    ├── api/                       # http-client.ts (JWT/DRM, errores 401/403/409/429) y health.api.ts
    ├── components/
    │   ├── layout/
    │   │   ├── Brand.tsx          # Logos institucionales, isotipo ámbar y wordmark "Repositorio FAUD"
    │   │   ├── AuthSplitLayout.tsx# Login / Registro: panel de marca oscuro + formulario sobre crema
    │   │   ├── UserLayout.tsx     # Navbar del alumno (clara en Catálogo/Ficha, oscura en Mis préstamos)
    │   │   ├── AdminLayout.tsx    # Sidebar fijo 240px + top bar mobile con menú hamburguesa
    │   │   └── HealthStatusBadge.tsx # Indicador en vivo de GET /api/v1/health
    │   └── ui/
    │       ├── Badge.tsx          # Badges de estado, chips, tags de palabras clave y tab pills
    │       ├── Button.tsx         # Botones primary / secondary / danger / neutral
    │       ├── FormField.tsx      # TextField, PasswordField (ojo) y SelectField (chevron)
    │       └── Decorations.tsx    # Acentos de esquina, ícono "i" y rectángulos áureos
    ├── context/ToastContext.tsx   # Notificaciones visuales y avisos 429 Retry-After
    ├── hooks/useMediaQuery.ts
    ├── mocks/figma-fixtures.ts    # Datos de ejemplo idénticos a los prototipos (se reemplazan por API en Fases 1–5)
    ├── pages/
    │   ├── public/                # LandingPage, CatalogPage, DocumentDetailPage, DesignSystemPage, PhasePlaceholderPage
    │   ├── auth/                  # LoginPage, RegisterPage
    │   ├── user/                  # MyLoansPage, ViewerPage
    │   └── admin/                 # AdminDocumentUploadPage, AdminUsersPage, AdminLoansPage
    ├── routes/AppRouter.tsx
    ├── test/fase-00.spec.tsx
    └── types/openapi.types.ts     # Enumerados y DTOs espejados de docs/specs/openapi.json
```

---

## 3. Entregables Técnicos Desarrollados

### 3.1. Design System Institucional Oficial (Figma FAUD-UNSJ — Páginas 20 a 24)
- Configuración en [`tailwind.config.js`](../../frontend/tailwind.config.js) e [`index.css`](../../frontend/src/index.css) de los tokens cromáticos, tipográficos, radios y motivos arquitectónicos relevados en [`Presentacion_Prototipos_Figma_Segunda_Etapa_DHL_Solutions.pdf`](../../documentación/Presentacion_Prototipos_Figma_Segunda_Etapa_DHL_Solutions.pdf):
  - **01 Marca e Identidad (Páginas 4, 5, 7, 13 y 21)**: logos institucionales UNSJ y FAUD extraídos del PDF, wordmark **`Repositorio FAUD`** con subtítulo **`FAUD-UNSJ · Préstamo Digital Interdepartamental`** (`Biblioteca FAUD-UNSJ · Admin` en el sidebar) e isotipo cuadrado ámbar.
  - **02 Paleta de Colores (Página 21)**: Ámbar FAUD `#FFB606`, Oro oscuro `#E6A303`, Oro hover `#FFCA28`, Navy profundo `#2D2D2D` (fondos oscuros, sidebar, top bars), Navy medio `#16213E`, Azul arquitectónico `#0F3460`, Crema cálido `#FFF9EC`, Ámbar claro `#FFF3D0`, Borde cálido `#E8DCC8` y semánticos `#2D6A4F` / `#9A5B00` / `#B3261E` / `#6B7280`.
  - **03 Tipografía (Página 22)**: `Inter` con la escala `hero 48`, `h2 28`, `h3 20`, `h4 16`, `body 14`, `label 13`, `caption 12`, `overline 11`.
  - **04 Componentes UI (Página 23)**: botones, inputs (`r:8`, foco ámbar), badges de estado, tags de palabras clave (`r:16`) y tab pills (`r:20`).
  - **05–07 Espaciado, Layouts y Motivos (Página 24)**: navbar `64px` (`56px` mobile), sidebar admin `240px`, split Login/Registro, acentos de esquina dorados, líneas guía de blueprint y marca de agua diagonal.

### 3.1.1. Pantallas implementadas según los prototipos (desktop 1440 × 900 y mobile 375 × 812)

| Ruta | Pantalla | Figma |
|------|----------|-------|
| `/` | Introducción al Repositorio FAUD | Págs. 4 y 16 |
| `/login` | Iniciar sesión | Págs. 5 y 16 |
| `/registro` | Crear cuenta | Págs. 6 y 16 |
| `/admin/catalogo` | Cargar documento (+ vista previa de la ficha) | Págs. 7 y 16 |
| `/admin/usuarios` | Validación de usuarios | Págs. 8 y 17 |
| `/admin/prestamos` | Control de préstamos y revocación | Págs. 9 y 17 |
| `/catalogo` | Catálogo de documentos con filtros | Págs. 11 y 19 |
| `/documentos/:id` | Ficha del documento y solicitud de préstamo | Págs. 12 y 19 |
| `/mis-prestamos` | Mis préstamos | Págs. 13 y 19 |
| `/visor/:prestamoId` | Visor protegido con marca de agua | Págs. 14 y 19 |

Las vistas usan los datos de ejemplo de [`figma-fixtures.ts`](../../frontend/src/mocks/figma-fixtures.ts); cada fase posterior reemplaza su porción por la respuesta real del Backend. Los formularios y acciones muestran un aviso indicando la fase en la que se conectan. `/admin` (Panel) y `/notificaciones` no figuran en los prototipos y quedan como vistas reservadas.

### 3.2. Contratos TypeScript Espejados de `openapi.json`
- En [`src/types/openapi.types.ts`](../../frontend/src/types/openapi.types.ts) se declararon los 5 enumerados oficiales (`RolUsuario`, `EstadoValidacionUsuario`, `TipoDocumento`, `EstadoPrestamo`, `TipoNotificacion`) y la totalidad de interfaces de solicitud/respuesta correspondientes a los 26 endpoints del Backend.

### 3.3. Cliente HTTP Tipado e Interceptores JWT / DRM
- En [`src/api/http-client.ts`](../../frontend/src/api/http-client.ts) se implementó:
  - Inyección automática del encabezado `Authorization: Bearer <token>` desde `localStorage` (`faud_auth_token`).
  - Inyección de `x-drm-token` para los endpoints del Visor Protegido (`/prestamos/:id/visor`, `/prestamos/:id/contenido` y `/documentos/:id/ver`).
  - Función `extractDrmHeaders()` para leer las cabeceras expuestas por CORS (`X-DRM-Watermark`, `X-DRM-Loan-Code`, `X-DRM-Remaining-Days`, `X-DRM-Remaining-Hours`, `X-DRM-Por-Vencer-24h`, `X-DRM-Allow-Download`, `X-DRM-Allow-Print`, `X-DRM-Allow-Copy`).
  - Clase `ApiHttpError` con clasificación semántica automática:
    - `401` -> `UNAUTHORIZED` (dispara evento `faud:unauthorized`).
    - `403` -> `ACCOUNT_PENDING`, `ACCOUNT_REJECTED`, `DRM_BLOCKED` o `FORBIDDEN`.
    - `409` -> `CONFLICT`.
    - `429` -> `RATE_LIMITED` leyendo `Retry-After` en segundos y notificando vía `ToastContext`.

### 3.4. Layout Institucional y Conexión en Vivo con `/api/v1/health`
- El componente [`HealthStatusBadge.tsx`](../../frontend/src/components/layout/HealthStatusBadge.tsx) consume `GET /api/v1/health` y se muestra en la página interna `/design-system` ([`DesignSystemPage.tsx`](../../frontend/src/pages/public/DesignSystemPage.tsx)), junto al catálogo de componentes. Las pantallas del prototipo no incluyen indicadores técnicos para respetar el diseño.

---

## 4. Criterios de Aceptación (Verificación de Fase 0)

- [x] Proyecto inicializado en `frontend/` con `pnpm`, React 18, Vite, TypeScript y Tailwind CSS.
- [x] Contratos TypeScript en `src/types/openapi.types.ts` alineados al 100% con `docs/specs/openapi.json`.
- [x] `pnpm run build` compila TypeScript y genera el bundle de producción sin errores.
- [x] `pnpm run test` ejecuta las pruebas de Vitest + React Testing Library en verde.
- [x] Las 10 pantallas del prototipo (desktop y mobile) reproducen los diseños de `Presentacion_Prototipos_Figma_Segunda_Etapa_DHL_Solutions.pdf`.
- [x] Página `/design-system` verificando el estado con `GET /api/v1/health`.
