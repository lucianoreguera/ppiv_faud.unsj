# Fase 3: Solicitud de Préstamo, Panel `"Mis Préstamos"` y Bandeja de Notificaciones (`RF03`, `RF06`)

**Estado:** Completada y Verificada ✅  
**Responsables técnicos:** Diego A. González (Frontend & PM) · Hugo A. Torrent (Analista Funcional & UI/UX) · Luciano O. Reguera (Integración API & DRM)  
**Especificación asociada:** [`docs/specs/02-especificacion-frontend-ui-ux-y-drm.md`](../specs/02-especificacion-frontend-ui-ux-y-drm.md) — **Spec FE-03**  
**Endpoints consumidos:** `POST /api/v1/prestamos` · `GET /api/v1/prestamos/mis-prestamos` · `PATCH /api/v1/prestamos/:id/cerrar` · `GET /api/v1/notificaciones` · `PATCH /api/v1/notificaciones/:id/leida` · `PATCH /api/v1/notificaciones/marcar-todas-leidas`

---

## 1. Objetivo de la Fase

Completar la experiencia del estudiante o docente autenticado (**Figma págs. 13 y 19**): solicitar un préstamo digital de 7 días desde la ficha del documento, seguir su vigencia con una cuenta regresiva y la alerta temprana de 24 horas, devolverlo antes de tiempo, y recibir los avisos del sistema en la campana de la barra superior y en la bandeja `/notificaciones`. Los datos de ejemplo de "Mis préstamos" se reemplazan por la respuesta real del Backend.

---

## 2. Archivos Incorporados o Modificados en `frontend/`

```text
frontend/src/
├── api/
│   ├── loans.api.ts                   # + request(): POST /prestamos · close(): PATCH /prestamos/:id/cerrar
│   └── notifications.api.ts           # list, markRead (leída / no leída), markAllRead
├── context/
│   └── NotificationsContext.tsx       # Contadores y últimos avisos de la campana (sondeo cada 60 s)
├── hooks/
│   ├── useDocumentLoanAction.ts       # + refresh() tras una solicitud otorgada o rechazada
│   └── useNow.ts                      # Reloj de las cuentas regresivas (cada 30 s)
├── utils/
│   └── loan-time.ts                   # Fechas es-AR, tiempo restante, % de vigencia y tiempo relativo
├── components/
│   ├── ui/Modal.tsx                   # Diálogo accesible (Escape, foco atrapado, velo)
│   ├── loans/
│   │   ├── RequestLoanModal.tsx       # Confirmación → POST /prestamos → código, vencimiento y marca de agua
│   │   ├── loan-status.ts             # Estado visible de cada préstamo y pestañas de "Mis préstamos"
│   │   ├── CountdownBadge.tsx         # Badge con tiempo restante + barra de vigencia de 7 días
│   │   └── LoanCard.tsx               # Tarjeta mobile y acciones (Visor / Devolver / Archivar)
│   ├── notifications/
│   │   ├── notification-meta.ts       # Etiqueta, ícono, tono y destino de cada TipoNotificacion
│   │   └── NotificationBell.tsx       # Campana con badge noLeidas y panel de últimos avisos
│   └── layout/UserLayout.tsx          # + campana (desktop y mobile) y "Notificaciones" en el menú
├── pages/
│   ├── public/DocumentDetailPage.tsx  # "Solicitar Préstamo Digital (7 días)" abre RequestLoanModal
│   └── user/
│       ├── MyLoansPage.tsx            # Conectada a GET /prestamos/mis-prestamos
│       └── NotificationsPage.tsx      # Bandeja /notificaciones con filtros y paginación
├── routes/AppRouter.tsx               # /notificaciones deja de ser un marcador de posición
├── App.tsx                            # + NotificationsProvider
├── mocks/figma-fixtures.ts            # − MY_LOANS (reemplazado por la API)
└── test/
    ├── fase-02.spec.tsx               # El botón de solicitud ahora abre el modal
    └── fase-03.spec.tsx               # 13 pruebas de la fase
```

---

## 3. Entregables Técnicos Desarrollados

### 3.1. Solicitud de Préstamo (`RequestLoanModal` + `POST /api/v1/prestamos`)

El botón **"Solicitar Préstamo Digital (7 días)"** de la ficha abre un diálogo de confirmación con:

- Título y autor de la obra.
- Vigencia de **7 días corridos** con la fecha y hora estimadas de vencimiento.
- Aviso de que se genera un **token de acceso temporal (DRM)** exclusivo del préstamo.
- Vista previa de la marca de agua: **"Ana Pérez · Préstamo #…"** (el código real se asigna al confirmar).
- Recordatorio de lectura exclusiva en el Visor Protegido, sin descarga, impresión ni copia.

**Respuesta `201 Created`.** El diálogo muestra **"Préstamo #0016 otorgado"** con el código, la fecha de vencimiento y la marca de agua definitiva, y ofrece **Abrir en Visor Protegido** (`/visor/:prestamoId`) o **Ir a Mis préstamos**. El `tokenAcceso` queda guardado por préstamo en `faud_drm_tokens`; `http-client.ts` lo envía como `x-drm-token` cuando se le pasa el `prestamoId`. Al mismo tiempo, la ficha vuelve a consultar los préstamos (el botón pasa a **"Ya tenés un préstamo activo · Abrir en Visor Protegido"**) y la campana recibe el aviso `PRESTAMO_OTORGADO`.

**Errores**

| Respuesta | Mensaje en el diálogo | Acciones |
| :--- | :--- | :--- |
| `409` préstamo `ACTIVO` duplicado (*"Ya posees un préstamo ACTIVO vigente (#0016)…"*) | **"Ya tenés un préstamo activo de esta obra"** + mensaje del Backend | **Ir a Mis préstamos** · Cerrar |
| `409` obra suspendida por Biblioteca (solicitud `RECHAZADO`) | **"Material no disponible"** + mensaje del Backend | Cerrar. La ficha se vuelve a consultar sin parpadeo y el botón queda deshabilitado |
| `404` documento retirado | **"Documento no encontrado"** | Cerrar. La ficha pasa a *"Documento no encontrado"* |
| `403`, error de red o del servidor | Mensaje correspondiente | **Confirmar** de nuevo · Cancelar |

Mientras se envía la solicitud, el diálogo no se puede cerrar (ni con Escape ni con un clic fuera de él) y el botón muestra *"Solicitando…"*.

### 3.2. Panel "Mis Préstamos" (`/mis-prestamos` — Figma págs. 13 y 19)

Se consulta `GET /api/v1/prestamos/mis-prestamos` sin filtros. Las pestañas filtran en el cliente y muestran los contadores que devuelve el Backend:

| Pestaña (`?tab=`) | Contador | Préstamos |
| :--- | :--- | :--- |
| **Activos** (por defecto) | `activos` | `ACTIVO` |
| **Por vencer 24h** (`por-vencer`) | `porVencer24h` | `porVencer24h = true` |
| **Vencidos / Historial** (`historial`) | `vencidos + revocados + cerrados` | `VENCIDO`, `REVOCADO`, `CERRADO` |
| **Todos** (`todos`) | `todos` | Todos (incluye solicitudes `RECHAZADO`) |

La pestaña activa se guarda en la URL, y los avisos de la campana enlazan directamente a ella. Por ejemplo, un `PROXIMO_VENCIMIENTO_24H` abre `/mis-prestamos?tab=por-vencer`.

**Cada préstamo** (tabla en desktop, tarjeta con barra superior de estado en mobile) muestra el código `#0016`, el título con enlace a la ficha, el autor, la fecha de inicio y la fecha y hora de vencimiento, junto con:

- **Cuenta regresiva en vivo** a partir de `fechaVencimiento` (se actualiza cada 30 s): `Activo · 5 d 2 h` en verde, o `Por vencer · 5 h` en ámbar con punto de alerta dentro de las últimas 24 horas (`RF06`).
- **Barra de vigencia** con el porcentaje restante del plazo de 7 días (`role="progressbar"`).
- Estados finalizados: `Vencido`, `Revocado por Biblioteca`, `Devuelto` y `Solicitud rechazada`.

**Acciones según el estado (máquina de estados, Figura 5)**

| Estado | Acciones |
| :--- | :--- |
| `ACTIVO` vigente | **Abrir en Visor Protegido** (`/visor/:id`) · **Devolver** |
| `VENCIDO` / `REVOCADO` | **Archivar** |
| `CERRADO` / `RECHAZADO` | — |

**Devolver** y **Archivar** piden confirmación (*"¿Devolver el préstamo #0016? … perderás el acceso al Visor Protegido de inmediato"*). Luego invocan `PATCH /api/v1/prestamos/:id/cerrar`, descartan el token DRM, muestran un aviso con el mensaje del Backend y recargan la lista. Un `409` (por ejemplo, un préstamo que ya fue cerrado desde otra pestaña) se informa con un aviso de error y la lista se recarga.

**Otros comportamientos**

- **Tokens DRM sincronizados:** al cargar la lista se guarda el `tokenAcceso` de cada préstamo vigente y se elimina el de los finalizados.
- **Vencimiento con la página abierta:** si un `ACTIVO` llega a su fecha de vencimiento, se muestra como `Vencido`, se deshabilita la lectura, se descarta su token y se vuelve a consultar al Backend, que lo sincroniza a `VENCIDO`.
- **Alerta ámbar** *"Tenés N préstamo(s) que vencen en las próximas 24 horas"*, con acceso directo a la pestaña correspondiente.
- **Estados de carga:** skeleton en la primera carga, estado vacío por pestaña con *"Explorar el catálogo"* y error con **Reintentar**. Si falla una recarga posterior, se conserva la lista y solo se muestra un aviso.

### 3.3. Campana y Bandeja de Notificaciones (`RF06`)

**`NotificationsContext`** consulta `GET /api/v1/notificaciones?limit=5` al iniciar sesión y cada 60 s mientras la pestaña está visible. Cuando no hay sesión no consulta nada. Marcar avisos como leídos actualiza la campana al instante e incrementa un contador de versión, que la bandeja usa para volver a consultar su página.

**Campana (`NotificationBell`)** en la barra oscura, para usuarios con sesión iniciada:

- Badge ámbar con `contadores.noLeidas` (`99+` como tope) y nombre accesible *"Notificaciones (2 sin leer)"*.
- Panel con los últimos 5 avisos: ícono y tono por tipo, mensaje del Backend, código del préstamo, tiempo relativo (*"hace 1 hora"*) y punto ámbar en los no leídos.
- **"Marcar todas como leídas"** (`PATCH /notificaciones/marcar-todas-leidas`) y **"Ver todas las notificaciones"**.
- Al abrir un aviso, se marca como leído (`PATCH /notificaciones/:id/leida`) y se navega a la sección relacionada.
- Se cierra con Escape, con un clic fuera del panel o al navegar. Se monta una sola vez: en la barra desktop o junto al menú hamburguesa en mobile, donde el menú también incluye *"Notificaciones (N)"*.

| Tipo | Etiqueta | Destino |
| :--- | :--- | :--- |
| `PRESTAMO_OTORGADO` | Préstamo otorgado | `/mis-prestamos?tab=activos` |
| `PROXIMO_VENCIMIENTO_24H` | Vence en 24 horas | `/mis-prestamos?tab=por-vencer` |
| `PRESTAMO_VENCIDO` | Préstamo vencido | `/mis-prestamos?tab=historial` |
| `PRESTAMO_REVOCADO` | Préstamo revocado | `/mis-prestamos?tab=historial` |
| `CUENTA_APROBADA` | Cuenta aprobada | `/catalogo` |

**Bandeja (`/notificaciones`)**

- Filtros sincronizados con la URL: `?estado=no-leidas|leidas&tipo=<TipoNotificacion>&page=N`. Se traducen a `leida`, `tipo`, `page` y `limit=20`.
- Pestañas **Todas (N)**, **No leídas (N)** y **Leídas (N)**, y selector **Tipo de aviso** con la cantidad de cada tipo (`porTipo`). Estos contadores siempre cubren toda la bandeja, porque así los calcula el Backend.
- Cada aviso ofrece **Ver en Mis préstamos** y **Marcar como leída / Marcar como no leída** (`PATCH /:id/leida` con `{ leida }`).
- **Marcar todas como leídas (N)** muestra un aviso con la cantidad actualizada (`actualizadas`).
- Paginación conectada a `meta`, estado vacío distinto según haya o no filtros activos, y error con **Reintentar**.

### 3.4. Componente `Modal`

`components/ui/Modal.tsx` usa `role="dialog"` y `aria-modal`, con el título enlazado mediante `aria-labelledby`. Enfoca el primer control al abrirse, mantiene el foco dentro con Tab, lo devuelve al elemento de origen al cerrarse y bloquea el scroll de la página. En mobile se presenta como hoja inferior. Lo usan la solicitud de préstamo y la confirmación de devolución, y queda disponible para los modales del panel de administración (Fase 5).

---

## 4. Verificación

### 4.1. Pruebas automatizadas (`src/test/fase-03.spec.tsx`)
1. Solicitud confirmada: el diálogo muestra las condiciones y la vista previa de la marca de agua. `POST /prestamos` envía `{ documentoId }`. Se guarda el token DRM, aparecen los enlaces al visor y a Mis préstamos, la ficha pasa a *"Ya tenés un préstamo activo"* y la campana muestra 1 aviso sin leer.
2. `409` por préstamo duplicado → *"Ya tenés un préstamo activo de esta obra"*, enlace a Mis préstamos y sin botón de confirmar.
3. `409` por obra suspendida → *"Material no disponible"*. Al cerrar el diálogo, la ficha muestra el botón deshabilitado.
4. Mis préstamos: pestañas con los contadores `2 / 1 / 3 / 5`, `Activo · 5 d 2 h`, `Por vencer · 5 h`, alerta de 24 horas y enlaces al visor. Se guardan los tokens de los préstamos vigentes y se descarta el de uno vencido. La pestaña *Por vencer 24h* actualiza `?tab=por-vencer`.
5. `?tab=historial` desde la URL: *Revocado por Biblioteca*, *Devuelto*, **Archivar** solo en `VENCIDO` y `REVOCADO`, sin enlaces al visor.
6. Devolver: confirmación → `PATCH /prestamos/:id/cerrar` → aviso *"Préstamo #1024 devuelto"*, token descartado y contadores actualizados.
7. `/mis-prestamos` sin sesión redirige a `/login?redirect=%2Fmis-prestamos`.
8. Campana: `limit=5`, *"Notificaciones (2 sin leer)"*, panel con puntos de no leído, **Marcar todas como leídas** y navegación de un aviso de 24 horas a `/mis-prestamos?tab=por-vencer`.
9. Los visitantes no ven la campana y no se consulta `/notificaciones`.
10. Bandeja: `page=1&limit=20`, pestaña *No leídas* → `leida=false`, tipo → `tipo=PRESTAMO_OTORGADO` en la URL y en la consulta, y **Marcar como leída** → `PATCH` con `{ leida: true }` seguido de una nueva consulta.
11. Cálculo y formato del tiempo restante (`5 d 3 h`, `7 h 12 min`, `menos de 1 min`, límite exacto de 24 horas).
12. Estado visible de cada préstamo: un `ACTIVO` con el plazo cumplido se muestra vencido, y se definen las acciones de cierre y el parseo de `?tab=`.
13. Traducción de los filtros de la bandeja entre la URL y la API.

### 4.2. Verificación contra el Backend en vivo (`http://localhost:3000/api/v1`, sesión de Ana Pérez)
- `POST /prestamos` sobre *Accesibilidad urbana en San Juan* → `201`, `Préstamo digital #0016 otorgado…`, `expiresInDays: 7`, `tokenAcceso` presente y marca de agua `Ana Pérez · Préstamo #0016`.
- Segundo `POST` sobre la misma obra → `409` *"Ya posees un préstamo ACTIVO vigente (#0016)…"*. El texto *"Ya posees"* es el que usa el diálogo para reconocer un préstamo duplicado.
- `GET /prestamos/mis-prestamos` → `activos: 1`, `diasRestantes: 7`, `horasRestantes: 168` y `tokenAcceso` incluido.
- `GET /notificaciones?limit=5` → `noLeidas: 1` (`PRESTAMO_OTORGADO`). El filtro `leida=false&tipo=PRESTAMO_OTORGADO&page=1&limit=20` → 1 resultado.
- `PATCH /notificaciones/:id/leida` con `{ leida: true }` → `200`. Con `{ leida: false }` → *"La notificación fue marcada como no leída."* `PATCH /marcar-todas-leidas` → `actualizadas: 1`.
- `PATCH /prestamos/:id/cerrar` → `ACTIVO → CERRADO`. Repetirlo → `409` *"No se puede cerrar el préstamo #0016 desde el estado "CERRADO"."*
- Preflight CORS de `PATCH` desde `http://localhost:5173` → `204` (`Access-Control-Allow-Methods` incluye `PATCH`).

> La verificación dejó en la base de desarrollo el préstamo `#0016` en estado `CERRADO` y su notificación `PRESTAMO_OTORGADO` (leída).

### 4.3. Observaciones para fases siguientes
- La marca de agua real del Backend es **`"Ana Pérez · Préstamo #0016"`**, sin el sufijo `· FAUD-UNSJ` que muestra el ejemplo de la Spec FE-04. La SPA usa la cadena tal como la devuelve la API. El Visor de la Fase 4 debe hacer lo mismo, o el sufijo debe agregarse en el Backend.
- El Visor (Fase 4) puede tomar el token con `getDrmToken(prestamoId)`. "Mis préstamos" lo vuelve a sincronizar cada vez que se carga.

---

## 5. Criterios de Aceptación

- [x] Modal de confirmación con vigencia de 7 días, token DRM temporal y marca de agua nominal.
- [x] `201 Created`: código asignado, token DRM guardado y acceso directo al Visor Protegido o a Mis préstamos.
- [x] `409 Conflict` claro, tanto por préstamo `ACTIVO` duplicado como por material suspendido.
- [x] `/mis-prestamos` conectado a `GET /prestamos/mis-prestamos`, con las pestañas `Activos`, `Por vencer 24h`, `Vencidos / Historial` y `Todos` y sus contadores.
- [x] Tarjetas con código, obra, fechas, cuenta regresiva y alerta ámbar `porVencer24h` (`RF06`).
- [x] "Abrir en Visor Protegido" para préstamos vigentes y "Devolver / Archivar" mediante `PATCH /prestamos/:id/cerrar`.
- [x] Campana con `noLeidas`, últimos avisos y "Marcar todas como leídas".
- [x] Bandeja `/notificaciones` filtrable por lectura y tipo, con marcado individual y masivo.
- [x] `pnpm run build` y `pnpm run test` en verde (44 pruebas: 5 de Fase 0 + 12 de Fase 1 + 14 de Fase 2 + 13 de Fase 3).
