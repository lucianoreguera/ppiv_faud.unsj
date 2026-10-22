# Fase 5: Panel de Administración de Biblioteca FAUD-UNSJ (`RF01`, `RF04`, `RF05`, `RF06`)

**Estado:** Completada y Verificada ✅  
**Responsables técnicos:** Diego A. González (Frontend & PM) · Hugo A. Torrent (Analista Funcional & UI/UX) · Luciano O. Reguera (Integración API & DRM)  
**Especificación asociada:** [`docs/specs/02-especificacion-frontend-ui-ux-y-drm.md`](../specs/02-especificacion-frontend-ui-ux-y-drm.md) — **Spec FE-05**  
**Endpoints consumidos:** `GET /api/v1/usuarios` · `PATCH /api/v1/usuarios/:id/estado` · `POST /api/v1/documentos` · `PATCH /api/v1/documentos/:id` · `DELETE /api/v1/documentos/:id` · `GET /api/v1/prestamos` · `PATCH /api/v1/prestamos/:id/revocar` · `POST /api/v1/notificaciones/ejecutar-control-vigencia` · `GET /api/v1/notificaciones/admin`

---

## 1. Objetivo de la Fase

Reemplazar las páginas de ejemplo del panel `/admin/*` (**Figma págs. 7, 8, 9 y 17**) por el backoffice real del rol `ADMINISTRADOR`. Biblioteca puede validar las cuentas de los 19 departamentos, catalogar y editar documentos PDF de hasta 50 MB, y controlar los préstamos digitales: revocarlos, ejecutar el control de vigencia a demanda y auditar los avisos enviados.

---

## 2. Archivos Incorporados o Modificados en `frontend/`

```text
frontend/src/
├── api/
│   ├── http-client.ts                 # + httpUpload(): multipart por XMLHttpRequest con progreso de subida
│   ├── users.api.ts                   # NUEVO: list(), updateStatus()
│   ├── catalog.api.ts                 # + create(), update() (JSON o multipart), remove()
│   ├── loans.api.ts                   # + adminList(), revoke()
│   ├── notifications.api.ts           # + adminList(), runExpiryControl()
│   └── departments.api.ts             # list() acepta AbortSignal
├── hooks/
│   ├── useAdminIndicators.ts          # Indicadores del sidebar y de /admin (Outlet context)
│   ├── useDepartmentOptions.ts        # 19 departamentos como opciones de filtro/formulario
│   └── useSearchDraft.ts              # Búsqueda con debounce sincronizada con la URL
├── utils/api-error.ts                 # describeApiError(), isAbortError()
├── components/
│   ├── admin/
│   │   ├── AdminActionModal.tsx       # Confirmación con motivo opcional u obligatorio
│   │   ├── KpiCard.tsx                # Tarjeta de métrica (estática, enlace o filtro)
│   │   ├── CronSummaryModal.tsx       # Resultado del control de vigencia (Figura 4)
│   │   └── NotificationsAuditPanel.tsx # Auditoría global de notificaciones
│   ├── layout/AdminLayout.tsx         # + contadores en el sidebar · AdminPageHeader con acciones
│   └── ui/FormField.tsx               # + TextAreaField
├── pages/admin/
│   ├── admin-params.ts                # Filtros de cada vista ⇄ URL ⇄ parámetros de la API
│   ├── document-form.ts               # Valores, validación y DTO del formulario de catalogación
│   ├── AdminDashboardPage.tsx         # NUEVO: /admin
│   ├── AdminUsersPage.tsx             # /admin/usuarios conectado a la API
│   ├── AdminCatalogPage.tsx           # NUEVO: /admin/catalogo (tabla de gestión)
│   ├── AdminDocumentFormPage.tsx      # Antes AdminDocumentUploadPage: /admin/catalogo/nuevo y /:id/editar
│   └── AdminLoansPage.tsx             # /admin/prestamos conectado a la API
├── routes/AppRouter.tsx               # + /admin (panel), /admin/catalogo/nuevo, /admin/catalogo/:id/editar
├── mocks/figma-fixtures.ts            # − datos de ejemplo del panel admin (ya no se usan)
├── pages/public/PhasePlaceholderPage.tsx  # Eliminado: no quedan rutas provisorias
└── test/
    ├── fase-05.spec.tsx               # 12 pruebas de la fase
    └── fase-01.spec.tsx               # Ajuste de una espera (ver 4.1)
```

---

## 3. Entregables Técnicos Desarrollados

### 3.1. Layout de administración e indicadores rápidos

- `AdminLayout` consulta dos indicadores al montarse y los comparte con las páginas hijas por `Outlet` context (`useAdminPanel()`):
  - `GET /usuarios?estado=PENDIENTE` → contadores de cuentas y las primeras 5 pendientes.
  - `GET /prestamos?porVencer24h=true&limit=5` → métricas del tablero y los préstamos que vencen en 24 h.
- El sidebar muestra un contador ámbar junto a **Usuarios** (cuentas pendientes) y a **Préstamos** (por vencer en 24 h). Cada página vuelve a pedir los indicadores después de aprobar, rechazar, revocar o ejecutar el control de vigencia.
- **Panel (`/admin`)**, que no está en los prototipos Figma: cuatro tarjetas que enlazan a su vista filtrada (cuentas pendientes, préstamos activos, por vencer en 24 h y documentos catalogados según `GET /departamentos/metricas`), la lista **Cuentas por validar** y la lista **Préstamos por vencer en 24 h** con el tiempo restante.

### 3.2. Validación de usuarios (`/admin/usuarios` — Figma págs. 8 y 17)

- Pestañas **Todos**, **Pendientes** (por defecto), **Aprobados** y **Rechazados** con los contadores de `GET /usuarios`. Los contadores cubren todo el padrón, sin importar los filtros.
- Filtros combinables por departamento (19), rol y búsqueda por nombre o correo (debounce de 350 ms), sincronizados con la URL: `?estado=todos&departamento=<uuid>&rol=USUARIO&q=gomez`.
- Tabla en desktop y tarjetas en mobile con nombre, iniciales, correo, departamento, estado y fecha de alta.
- Acciones según el estado: **Aprobar** si la cuenta no está aprobada y **Rechazar** si no está rechazada. La cuenta propia del administrador no ofrece **Rechazar**, porque el Backend responde `400`.
- El diálogo de confirmación incluye una **observación opcional** y llama a `PATCH /usuarios/:id/estado` con `{ estado, motivo }`. Al aprobar, el aviso confirma el correo enviado (*"Se envió el correo de confirmación a carlos.gomez@vallefertil.gob.ar"*). Si el Backend rechaza la acción, el error se muestra dentro del diálogo.

### 3.3. Gestión del catálogo y carga de PDFs (`/admin/catalogo` — Figma págs. 7 y 16)

**Tabla de gestión (`AdminCatalogPage`)**

- Lista `GET /documentos` de a 10 obras, incluidas las suspendidas, con pestañas **Todos / Disponibles / Suspendidos** (`disponible=true|false`), búsqueda libre y paginación. Todo queda en la URL: `?disponibilidad=suspendidos&q=tierra&page=2`.
- Columnas: obra (enlace a la ficha pública), tipo, año y carrera, departamento, préstamos `activos / históricos`, disponibilidad y acciones.
- **Interruptor de disponibilidad** (`role="switch"`): `PATCH /documentos/:id { disponible }` y actualización de la fila en el lugar. Si se suspende una obra con préstamos activos, el aviso aclara que esos préstamos siguen vigentes.
- **Eliminar:** diálogo de confirmación y `DELETE /documentos/:id`. Ante el `409` (préstamos activos o historial), el diálogo muestra el mensaje del Backend y ofrece **Suspender en su lugar**.

**Formulario de alta y edición (`AdminDocumentFormPage`)**

- `/admin/catalogo/nuevo` → `POST /documentos` en `multipart/form-data`. `/admin/catalogo/:id/editar` precarga la ficha con `GET /documentos/:id` y guarda con `PATCH /documentos/:id`: en JSON si solo cambian metadatos, o en multipart si se reemplaza el PDF.
- Campos: `titulo`, `autor`, `anio`, `director`, `tipo`, `carrera`, `departamentoOrigenId`, `palabrasClave` (Enter o coma, sin duplicados), `resumen` y `disponible`.
- **Validación en cliente** con las mismas reglas que `CreateDocumentDto` y `UpdateDocumentDto`: título de 3 a 250 caracteres, autor de 2 a 180, director hasta 180, año entero entre 1950 y el año próximo, al menos una palabra clave, resumen de al menos 10 caracteres y PDF obligatorio en el alta. Hay error por campo y un resumen arriba del formulario.
- **Archivo:** zona Drag & Drop o selector. Solo acepta `.pdf` (no vacío) de hasta 50 MB y avisa si el archivo no cumple. El Backend verifica además la firma `%PDF-`.
- **Barra de progreso:** `fetch` no informa el avance de la subida, por eso el multipart viaja con `XMLHttpRequest` (`httpUpload`). Usa los mismos encabezados JWT y la misma clasificación de errores que el resto del cliente. Al 100% muestra *"Procesando en el servidor…"*. **Cancelar carga** aborta la petición, y también se aborta si se abandona la página.
- `palabrasClave` viaja como JSON dentro del multipart (`["tierra cruda","bioclimática, adobe"]`), porque como lista separada por comas el Backend partiría una palabra clave que contenga una coma.
- En la edición, borrar el director lo envía como `""` y el Backend lo guarda como `null`. Si se reemplaza el PDF de una obra con préstamos activos, se avisa que sus titulares verán la nueva versión al reabrir el visor.
- La **vista previa de la ficha** se actualiza en vivo con disponibilidad, tipo, carrera, año, departamento, resumen y palabras clave.

### 3.4. Tablero de préstamos (`/admin/prestamos` — Figma págs. 9 y 17)

- **Cinco métricas** de `GET /prestamos`: **Activos**, **Por Vencer (24h)**, **Vencidos Hoy** (con el total de vencidos), **Revocados** y **Total Histórico**. Cada tarjeta aplica su filtro (`aria-pressed`) y **Total Histórico** los quita.
- Filtros por estado, departamento del titular y búsqueda libre por titular, obra o código (`#0018`), más el filtro "Vencen en las próximas 24 h" que se quita desde su etiqueta. URL: `?estado=ACTIVO&porVencer=1&departamento=<uuid>&q=…&page=2`. Paginación de a 15.
- Columnas: código, obra, titular y departamento, vencimiento con tiempo restante en vivo, estado y acción. Un `ACTIVO` cuyo plazo ya pasó se muestra **Vencido** aunque el Backend todavía no lo haya sincronizado (`getAdminLoanStatus`).
- **Revocar acceso**, solo para préstamos vigentes: diálogo con **motivo administrativo obligatorio** (mínimo 5 caracteres) y `PATCH /prestamos/:id/revocar { motivo }`. Después se recargan la tabla y los indicadores.
- **Ejecutar control de vigencia:** `POST /notificaciones/ejecutar-control-vigencia`. Un diálogo muestra el resumen (préstamos vencidos, alertas de 24 h y correos enviados) con el detalle de cada préstamo procesado y si su correo salió.
- **Auditoría de notificaciones** (`?vista=auditoria`): `GET /notificaciones/admin` de a 20, filtrable por tipo y por lectura del destinatario. Cada aviso muestra tipo, fecha, mensaje, destinatario con su departamento y correo, código del préstamo y si el usuario ya lo leyó.

---

## 4. Verificación

### 4.1. Pruebas automatizadas (`src/test/fase-05.spec.tsx`)

Las subidas se prueban con un `XMLHttpRequest` simulado que reenvía la petición al `fetch` simulado y emite eventos de progreso.

1. Panel: contadores del sidebar (*"2 cuentas pendientes de validación"*, *"4 préstamos por vencer en 24 horas"*), listas de la portada, enlaces de las tarjetas y parámetros `estado=PENDIENTE` y `porVencer24h=true&limit=5`.
2. Usuarios: pestaña **Pendientes (2)** por defecto con los cuatro contadores. Filtro por departamento y búsqueda en la URL y en la API. Aprobación con observación (`{ estado: 'APROBADO', motivo }`), aviso con el correo enviado y recarga del listado y de los indicadores (**Pendientes (1)**).
3. Usuarios: la cuenta propia muestra *"Tu cuenta"*, una aprobada solo ofrece **Rechazar**, y el `400` del Backend aparece dentro del diálogo.
4. Catálogo: `limit=10` sin filtro de disponibilidad, enlaces de ficha y edición, interruptor → `PATCH { disponible: false }` con el aviso de préstamos activos vigentes, y pestaña **Suspendidos** → `disponible=false`.
5. Catálogo: `409` al eliminar → **Suspender en su lugar** → `PATCH { disponible: false }`.
6. Alta: errores por campo sin llamar al Backend, rechazo de `.txt` y de un PDF de más de 50 MB, vista previa, barra de progreso al 40% con **Cancelar carga**, multipart con JWT, sin `Content-Type` manual, campos exactos y `palabrasClave` en JSON, y redirección a `/admin/catalogo` con aviso.
7. Edición: ficha precargada; con solo metadatos → `PATCH` JSON con `director: ''` y `disponible: false`; con un PDF nuevo → `PATCH` multipart y aviso de préstamo activo.
8. Préstamos: las 5 métricas, filas *Por vencer* / *Vencido* (sin acción), tarjeta **Por Vencer** → `porVencer24h=true`, filtros de estado y departamento en la URL, motivo obligatorio y revocación con `{ motivo }`.
9. Control de vigencia: diálogo de resumen con detalle y estado del correo, recarga del tablero, pestaña de auditoría y filtros `tipo` / `leida` / `limit=20`.
10. `admin-params`: ida y vuelta URL ⇄ API de las tres vistas.
11. `document-form`: límites de año, resumen, PDF obligatorio, extensión, tamaño, archivo vacío, palabras clave sin duplicados y director vacío en la edición.
12. `getAdminLoanStatus`: activo, por vencer, activo ya vencido sin sincronizar, revocado y cerrado.

**Ajuste en `fase-01.spec.tsx`.** La prueba *"redirige al panel de Biblioteca cuando inicia sesión un ADMINISTRADOR"* falló de forma intermitente en las corridas completas de la suite (2 de 5), nunca de forma aislada. Después del login, la navegación corre dentro de `startTransition` (`v7_startTransition`): la URL cambia a `/admin` antes de que se pinte el panel, y con el panel real el render tarda más. La prueba ahora espera el botón con `findByRole`. La aplicación no cambió.

### 4.2. Verificación contra el Backend en vivo (`http://localhost:3000/api/v1`, sesión del administrador)

Se reprodujo el circuito del criterio de validación con los mismos formatos de request que arma la SPA:

- **Aprobar** a Carlos Gómez (Valle Fértil) → `200` *"…fue actualizado a APROBADO."*. Contadores: `pendientes 4 → 3`. Mailpit recibió *"[FAUD-UNSJ] Su cuenta ha sido APROBADA por Biblioteca"*. Departamento Iglesia + `q=lucia` → solo Lucía Fernández. Rechazar la cuenta propia → `400` *"Un administrador no puede rechazar ni pasar a pendiente su propia cuenta."*
- **Catalogar** un PDF real de 3 páginas con `palabrasClave` en JSON → `201`. Se conservó la palabra clave `"bioclimática, adobe"` y el documento quedó vinculado a Valle Fértil. Un archivo sin firma `%PDF-` → `400` *"…firma %PDF- ausente"*.
- **Suspender** (`PATCH { disponible: false }`) → aparece en `?disponible=false`. **Editar** en JSON con `director: ""` → `director: null`. **Reemplazar el PDF** en multipart → `200`.
- **Eliminar** *Accesibilidad urbana en San Juan* (con historial) → `409` con la sugerencia de suspenderla.
- **Préstamos:** `?estado=ACTIVO` → `#0018`; `q=#0018` y `departamentoId` de Jáchal filtran bien. Revocar `#0018` → `200` *"…revocado inmediatamente…"*. Revocarlo otra vez → `409`. Con la sesión de Ana Pérez, `GET /prestamos/:id/visor` → `403` *"El préstamo ha vencido o fue revocado…"*.
- **Control de vigencia** → `200` (0 vencidos, 0 alertas, 0 correos, porque no había préstamos en esa situación). **Auditoría** `tipo=PRESTAMO_REVOCADO&leida=false` → aviso de `#0018` para Jáchal con el motivo de la revocación.
- Preflight CORS desde `http://localhost:5173` → `204` con `GET, HEAD, PUT, PATCH, POST, DELETE`.

> La verificación dejó en la base de desarrollo: Carlos Gómez `APROBADO`, el préstamo `#0018` `REVOCADO` (Ana Pérez ya no tiene préstamos activos) y el documento *"Arquitectura en tierra en el Valle Fértil (prueba Fase 5)"*, disponible, con un PDF de 3 páginas. Ese documento sirve para la revisión de paginación y miniaturas del visor que quedó pendiente en la Fase 4.

### 4.3. Observaciones para la Fase 6

- **Revisión visual pendiente.** Igual que en la Fase 4, la verificación no incluyó un navegador real. Falta revisar en desktop y mobile las tablas, los diálogos, el contador del sidebar y la barra de progreso con un PDF grande.
- **Avisos de cuenta aprobada.** El Backend envía el correo `CUENTA_APROBADA`, pero no registra una notificación (`porTipo.CUENTA_APROBADA` queda en 0), así que esas aprobaciones no aparecen en la auditoría. Las notificaciones están ligadas a un préstamo (`prestamoId` es obligatorio).
- **Desvincular el departamento de un documento.** `PATCH /documentos/:id` ignora `departamentoOrigenId: ""`, así que no hay forma de quitarlo. En la edición, el selector no ofrece *"Sin departamento asociado"* cuando la ficha ya tiene uno.
- **Contadores sin filtro.** Los contadores de la auditoría (`contadores` de `/notificaciones/admin`) son globales; la página lo aclara (*"N avisos en el sistema"*). El catálogo no informa cuántas obras hay por disponibilidad, así que la pestaña activa muestra el total filtrado y las demás no muestran número.
- **Listado de usuarios sin paginación.** `GET /usuarios` devuelve todo el padrón, lo cual alcanza para el volumen previsto (19 departamentos). Si el padrón crece, habría que paginarlo en el Backend.
- **Ventana de revocación.** Se mantiene lo de la Fase 4: un visor ya abierto se bloquea en la siguiente revalidación, como máximo 60 s después.

---

## 5. Criterios de Aceptación

- [x] Layout `/admin/*` con indicadores de cuentas pendientes y de préstamos por vencer en 24 h, y un Panel con resumen operativo.
- [x] Validación de usuarios con pestañas y contadores, filtros por departamento, rol y búsqueda, y **Aprobar** / **Rechazar** con confirmación y motivo opcional (`PATCH /usuarios/:id/estado`).
- [x] Alta de documentos en multipart con Drag & Drop, validación de `.pdf` ≤ 50 MB en cliente, barra de progreso y todos los campos normalizados.
- [x] Tabla del catálogo con **Editar metadatos / reemplazar PDF**, alternar disponibilidad con un clic y **Eliminar** con manejo del `409`.
- [x] Tablero de préstamos con las 5 métricas, filtros por estado, departamento y búsqueda, y **Revocar Acceso** con motivo administrativo.
- [x] **Ejecutar control de vigencia** con resumen del proceso y pestaña de **Auditoría de Notificaciones**.
- [x] Circuito verificado contra el Backend: aprobar un usuario de Valle Fértil → subir un PDF → monitorear → revocar un préstamo activo → visor bloqueado (`403`).
- [x] `pnpm run build` y `pnpm run test` en verde (69 pruebas: 5 de Fase 0 + 12 de Fase 1 + 14 de Fase 2 + 13 de Fase 3 + 13 de Fase 4 + 12 de Fase 5).
