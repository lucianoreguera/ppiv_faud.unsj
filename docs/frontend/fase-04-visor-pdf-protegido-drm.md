# Fase 4: Visor PDF Protegido con DRM Temporal (7 Días) y Marca de Agua Dinámica (`RF04`, `RNF02`)

**Estado:** Completada y Verificada ✅  
**Responsables técnicos:** Diego A. González (Frontend & PM) · Hugo A. Torrent (Analista Funcional & UI/UX) · Luciano O. Reguera (Integración API & DRM)  
**Especificación asociada:** [`docs/specs/02-especificacion-frontend-ui-ux-y-drm.md`](../specs/02-especificacion-frontend-ui-ux-y-drm.md) — **Spec FE-04**  
**Endpoints consumidos:** `GET /api/v1/prestamos/:id/visor` · `GET /api/v1/documentos/:id/ver` · `GET /api/v1/prestamos/:id/contenido`

---

## 1. Objetivo de la Fase

Reemplazar la página de ejemplo de `/visor/:prestamoId` (**Figma pág. 14**) por el Visor Protegido real. El visor valida el préstamo dos veces antes de abrir el documento (**Diagrama de Secuencia, Figura 3**) y descarga el PDF en memoria, sin exponer una URL. Lo renderiza página por página en `<canvas>` con la marca de agua del préstamo superpuesta y bloquea descarga, impresión y copia. Si el préstamo vence o Biblioteca lo revoca, cierra el documento en el acto.

---

## 2. Archivos Incorporados o Modificados en `frontend/`

```text
frontend/
├── package.json                         # + pdfjs-dist 4.10.38
└── src/
    ├── api/
    │   ├── http-client.ts               # + suppressUnauthorizedEvent · X-DRM-Watermark-URI tiene prioridad
    │   └── loans.api.ts                 # + viewerMetadata(), documentStream(), loanStream()
    ├── hooks/
    │   └── useProtectedViewer.ts        # Doble validación, descarga, revalidación y bloqueo
    ├── utils/
    │   └── loan-time.ts                 # + splitRemaining(), formatCountdown() (mm:ss en la última hora)
    ├── components/viewer/
    │   ├── pdf-engine.ts                # Carga diferida de pdf.js, render en canvas y sello de marca de agua
    │   ├── viewer-zoom.ts               # Pasos de zoom, 100%, ajustar ancho y modo automático
    │   ├── ProtectedPdfCanvas.tsx       # Página actual en <canvas> + DynamicWatermark
    │   ├── PdfThumbnails.tsx            # Miniaturas (desktop) renderizadas al entrar en pantalla
    │   ├── DynamicWatermark.tsx         # Mosaico diagonal con la leyenda del préstamo
    │   ├── DrmSecurityShield.tsx        # Bloqueo de atajos, menú contextual, arrastre, portapapeles e impresión
    │   ├── ViewerCountdown.tsx          # Reloj de la barra superior
    │   └── ViewerBlockedScreen.tsx      # Pantalla "Acceso Bloqueado"
    ├── pages/user/ViewerPage.tsx        # Visor conectado a la API (reemplaza la página de ejemplo)
    ├── index.css                        # + body.drm-print-lock en @media print
    └── test/
        └── fase-04.spec.tsx             # 13 pruebas de la fase
```

---

## 3. Entregables Técnicos Desarrollados

### 3.1. Doble validación DRM (`useProtectedViewer` — Figura 3)

Al entrar a `/visor/:prestamoId` (ruta protegida por sesión):

1. **`GET /prestamos/:id/visor`** con `Authorization: Bearer <JWT de sesión>` y `x-drm-token: <tokenAcceso>` (el token que se guardó en `faud_drm_tokens` en la Fase 3). Devuelve `marcaAgua`, `segundosRestantes`, las restricciones `drm` y los datos de la obra.
2. **`GET /documentos/:documentoId/ver`** con los mismos encabezados. El PDF se lee como `ArrayBuffer` y nunca se crea un enlace, `blob:` ni `<iframe>`. Si el endpoint responde `404` o `5xx`, se usa el respaldo **`GET /prestamos/:id/contenido`**.
3. El buffer se transfiere al worker de pdf.js, de modo que el hilo principal no conserva una copia del archivo.

**Token DRM ausente o inválido.** Si no hay token guardado (otro navegador o `localStorage` limpio), el Backend valida con el JWT de sesión. Si el token guardado responde `401` (por ejemplo, porque se firmó en otro entorno), el visor lo descarta y repite la consulta solo con el JWT. Ese primer `401` se marca con `suppressUnauthorizedEvent`, así que no cierra la sesión. Un `401` en el reintento sí la cierra, como en el resto de la SPA.

**El reloj usa `segundosRestantes`.** El vencimiento local se calcula como `Date.now() + segundosRestantes`, no a partir de `fechaVencimiento`. Así la cuenta regresiva no depende de que la hora del equipo esté bien configurada.

| Estado del visor | Qué se muestra |
| :--- | :--- |
| Cargando | *"Validando el acceso DRM del préstamo…"* → *"Descargando el documento protegido…"* |
| Listo | Página en `<canvas>`, miniaturas, reloj y controles |
| `403` vencido o revocado | **"Acceso Bloqueado: El préstamo ha vencido o fue revocado"** + mensaje del Backend |
| `403` de otro tipo (préstamo de otro usuario) | **"Acceso denegado al Visor Protegido"** + mensaje del Backend |
| `404` | **"Préstamo no encontrado"** |
| Red, `5xx` o PDF ilegible | *"No se pudo abrir el Visor Protegido"* + **Reintentar** |

### 3.2. Renderizado seguro en `<canvas>` (`pdf-engine` + `ProtectedPdfCanvas`)

- **pdf.js se carga bajo demanda.** `pdfjs-dist` y su worker quedan en un chunk aparte (`pdf-*.js`, 107 kB gzip) que solo descarga quien abre el visor. El bundle principal no crece.
- **Opciones de carga:** `isEvalSupported: false`, `enableXfa: false` y `annotationMode: DISABLE`. No se crea capa de texto, enlaces ni formularios, así que no hay nada que seleccionar o copiar.
- **Una página por vez**, con 100% = tamaño real (96 dpi). La densidad del canvas se ajusta al `devicePixelRatio` con un tope de 2× y de 16 Mpx, para que el zoom alto no dispare la memoria.
- **Zoom:** `−` / `+` en pasos de 50 a 300%, **100%** y **Ajustar al ancho**. El modo automático inicial muestra la página al 100%, o la reduce para que entre completa en mobile.
- **Navegación:** botones anterior / siguiente, miniaturas en desktop y teclado (`←` `→`, `RePág` `AvPág`, `Inicio` `Fin`).
- **Miniaturas:** se renderizan cuando entran en pantalla (`IntersectionObserver`), para no pintar cientos de páginas de una vez.
- **Al desmontarse**, el canvas se vacía (`width = height = 0`).

**Barras del visor (Figma pág. 14)**

- **Superior:** volver a Mis préstamos, título, *"M. Morales · Préstamo #0016"* y reloj *"Vigente · vence en 5 d 2 h"*. Dentro de las últimas 24 horas el reloj pasa a *"Por vencer"* en tono de alerta, y en la última hora muestra segundos (`59:07`).
- **Inferior:** *"Página X de Y · Zoom Z%"*, los controles de paginación y zoom, y la etiqueta *"Descarga e impresión deshabilitadas"* (*"Solo lectura"* en mobile).

### 3.3. Marca de agua dinámica (`DynamicWatermark`)

- La capa superpuesta es un mosaico SVG diagonal (−35°) en oro `#E6A303` con la leyenda exacta del Backend: **`"Ana Pérez · Préstamo #0016"`**. Usa `pointer-events-none select-none` y `aria-hidden`, y escala con el zoom.
- **Sello en el canvas:** `pdf-engine` también escribe la leyenda en los márgenes superior e inferior de cada página, dentro de los píxeles. Si alguien elimina la capa DOM desde DevTools, el sello sigue en la imagen.

### 3.4. Escudo antidescarga / antiimpresión (`DrmSecurityShield` — `RNF02`)

| Acción | Bloqueo |
| :--- | :--- |
| `Ctrl` / `Cmd` + `S`, `P`, `C`, `X`, `A` | `keydown` en fase de captura → `preventDefault` + aviso *"Descarga bloqueada"*, *"Impresión bloqueada"*… (máximo un aviso cada 4 s) |
| Clic derecho | `onContextMenu` → *"Menú contextual deshabilitado"* |
| Arrastrar la página | `onDragStart` + `draggable="false"` |
| Copiar / cortar | `copy` / `cut` cancelados en `document` |
| Selección | `user-select: none` y `-webkit-touch-callout: none` |
| Imprimir desde el menú del navegador | `body.drm-print-lock` + `@media print { display: none }` imprime una hoja en blanco; `beforeprint` además oculta el contenido |

### 3.5. Revalidación y bloqueo inmediato

- **Revalidación periódica:** con el documento abierto, se vuelve a consultar `GET /prestamos/:id/visor` cada **60 s**, al volver a la pestaña (`visibilitychange`) y al cambiar de página, si la última validación tiene más de 15 s. Un error de red o `5xx` no interrumpe la lectura; se reintenta en la siguiente revalidación.
- **Revocación o vencimiento informados por el Backend (`403`/`404`):** el visor destruye el documento (`loadingTask.destroy()`, que libera el PDF en el worker), desmonta el canvas, la marca de agua y el reloj, descarta el token DRM y muestra la pantalla de bloqueo. También pide a la campana que vuelva a consultar, para que aparezca el aviso `PRESTAMO_REVOCADO` o `PRESTAMO_VENCIDO`.
- **Plazo cumplido con el visor abierto:** un temporizador local bloquea en el instante del vencimiento (*"El plazo de 7 días del préstamo #0016 finalizó el 29/10/2026 · 14:30…"*) y lanza una consulta de sincronización para que el Backend pase el préstamo a `VENCIDO`.
- La pantalla de bloqueo ofrece **Ir a Mis préstamos** y **Explorar el catálogo**.

---

## 4. Verificación

### 4.1. Pruebas automatizadas (`src/test/fase-04.spec.tsx`)

pdf.js no funciona en jsdom (no hay canvas ni worker), así que las pruebas reemplazan `loadProtectedPdf` por un documento simulado de 3 páginas y verifican las llamadas de render.

1. Apertura: `GET /visor` con `x-drm-token` y `Authorization`, y `GET /documentos/:id/ver` con `Accept: application/pdf`. Los bytes recibidos llegan al motor. Se muestran el título, *"M. Morales · Préstamo #0016"*, el reloj *"Vigente · vence en 5 d 2 h"* y *"Página 1 de 3 · Zoom 100%"*. El render recibe el sello y la capa tiene `data-watermark` con la leyenda y `pointer-events-none select-none`. No hay `<iframe>`, `<embed>`, `<object>` ni enlaces al archivo.
2. Paginación con botones, con `Fin` y con miniaturas (`aria-current`). Zoom `+` → 125% (render a escala 1.25), `−` `−` → 75%, **100%**, y **Ajustar al ancho** → 147% (`aria-pressed`).
3. Token DRM inválido (`401`): se descarta, el reintento va solo con el JWT y la sesión sigue abierta.
4. Si `/documentos/:id/ver` responde `500`, se usa `/prestamos/:id/contenido`.
5. Sin sesión: redirige a `/login?redirect=%2Fvisor%2Floan-16` y no carga el PDF.
6. Escudo: `Ctrl+S`, `Ctrl+P` y `Cmd+C` cancelados con aviso, `S` sin modificador permitido, clic derecho, arrastre y `copy` cancelados, `body.drm-print-lock` presente, y `beforeprint` / `afterprint` ocultan y restauran el contenido.
7. `403` al entrar: pantalla de bloqueo con los dos enlaces, sin descarga del PDF y con el token descartado.
8. Revocación durante la lectura (revalidación por `visibilitychange`): `destroy()` invocado, sin canvas, marca de agua ni reloj, token descartado y nueva consulta de `/notificaciones`.
9. Vencimiento con el visor abierto (`segundosRestantes: 1`): reloj *"Por vencer · vence en 00:01"*, bloqueo con el texto del plazo cumplido, `destroy()` y consulta de sincronización sin `x-drm-token`.
10. Error `503` al abrir → **Reintentar** abre el documento.
11. `resolveZoomScale` y `stepZoom` (automático, ajustar ancho, límites 50% y 300%).
12. `formatCountdown`: `5 d 2 h`, `7 h 12 min`, `59:07`, `00:01`, `00:00`.
13. `extractDrmHeaders` prefiere `X-DRM-Watermark-URI` sobre el encabezado Latin-1.

### 4.2. Verificación contra el Backend en vivo (`http://localhost:3000/api/v1`, sesión de Ana Pérez)

- `POST /prestamos` sobre *Diseño bioclimático en zonas áridas* → `201`, préstamo `#0017`, marca de agua `Ana Pérez · Préstamo #0017`.
- `GET /prestamos/:id/visor` con `x-drm-token` → `200`, `segundosRestantes: 604799`, `drm.permitirDescarga/Impresion/Copia: false`, `streamDocumentoUrl` → `/documentos/:id/ver`.
- `GET /documentos/:id/ver` → `200 application/pdf` con firma `%PDF-`, `Cache-Control: no-store…`, `Content-Disposition: inline`, `Access-Control-Allow-Origin: http://localhost:5173`, y `Access-Control-Expose-Headers` con todos los `X-DRM-*`. `X-DRM-Watermark-URI` decodificado → `Ana Pérez · Préstamo #0017`.
- pdf.js (`pdfjs-dist` 4.10.38) abre el buffer descargado: 1 página, 816 × 1056 px al 100%.
- Respaldo `GET /prestamos/:id/contenido` → `200` con los mismos bytes. `GET /visor` solo con JWT de sesión → `200`. Con un token DRM inválido → `401` *"Token de acceso DRM inválido o firma criptográfica no reconocida."*, que es el caso que el visor reintenta con el JWT.
- Preflight CORS con `authorization, x-drm-token` → `204`.
- `PATCH /prestamos/:id/revocar` (administrador) → `REVOCADO`. Con el mismo token DRM, `GET /visor` y `GET /ver` → `403` *"El préstamo ha vencido o fue revocado. El acceso al documento ha sido bloqueado."* `http-client` clasifica ese mensaje como `DRM_BLOCKED`.
- `GET /notificaciones` → `PRESTAMO_REVOCADO` (*"…fue revocado por Biblioteca. Motivo: Verificación Fase 4 del visor"*) y `PRESTAMO_OTORGADO`, ambas sin leer.

> La verificación dejó en la base de desarrollo el préstamo `#0017` en estado `REVOCADO` y sus dos notificaciones sin leer.

### 4.3. Observaciones para fases siguientes

- **Revisión visual pendiente.** La verificación automática no incluye el render real en canvas de un navegador. Falta revisar en Chrome, Edge y Firefox (desktop y mobile) la nitidez, el mosaico de la marca de agua y la hoja en blanco al imprimir.
- **PDFs del seed.** Son mínimos (814 bytes, 1 página) y con la tabla `xref` incompleta. pdf.js los repara (*"Indexing all PDF objects"*), pero no sirven para probar paginación ni miniaturas. Conviene probar con un PDF real de varias páginas cuando el panel de catálogo de la Fase 5 permita subirlo.
- **Marca de agua.** Igual que en la Fase 3, se usa la leyenda del Backend sin el sufijo `· FAUD-UNSJ` del ejemplo de la Spec FE-04. Si se quiere el sufijo, hay que agregarlo en el Backend.
- **Ventana de revocación.** Cuando un administrador revoca un préstamo desde `/admin/prestamos` (Fase 5), el Backend rechaza de inmediato cualquier nueva consulta o descarga. El documento que ya está abierto se cierra en la siguiente revalidación: como máximo 60 s después, o antes si el usuario cambia de página o vuelve a la pestaña.
- **Alcance del escudo.** El escudo de cliente disuade, pero no puede impedir una captura de pantalla del sistema operativo. Para ese caso, la protección es la marca de agua nominal, en la capa DOM y en los píxeles.
- **Compatibilidad.** pdf.js 4.x requiere navegadores con `Promise.withResolvers` (Chrome/Edge 119+, Firefox 121+, Safari 17.4+).

---

## 5. Criterios de Aceptación

- [x] Doble validación: `GET /prestamos/:id/visor` y luego `GET /documentos/:id/ver` (respaldo `/prestamos/:id/contenido`) con `x-drm-token` y `Authorization`.
- [x] PDF descargado en memoria y renderizado en `<canvas>` con pdf.js, sin `<iframe>`, `<embed>` ni URL pública.
- [x] Barra superior con obra, autor, código y cuenta regresiva en vivo; paginación `Página X de Y` y zoom `−`, `100%`, `+` y ajustar ancho.
- [x] Marca de agua dinámica en mosaico diagonal con la leyenda del Backend, no seleccionable y respaldada por un sello en los píxeles.
- [x] Bloqueo de clic derecho, selección, arrastre, portapapeles, `Ctrl/Cmd + S / P / C` e impresión (`@media print`).
- [x] Revalidación periódica, al volver a la pestaña y al cambiar de página.
- [x] Pantalla **"Acceso Bloqueado: El préstamo ha vencido o fue revocado"** ante `403` o al cumplirse el plazo, con el documento destruido de la memoria.
- [x] `pnpm run build` y `pnpm run test` en verde (57 pruebas: 5 de Fase 0 + 12 de Fase 1 + 14 de Fase 2 + 13 de Fase 3 + 13 de Fase 4).
