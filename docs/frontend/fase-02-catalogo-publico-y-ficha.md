# Fase 2: Catálogo Público Interdepartamental, Buscador Combinado y Ficha Bibliográfica (`RF02`)

**Estado:** Completada y Verificada ✅  
**Responsables técnicos:** Diego A. González (Frontend & PM) · Hugo A. Torrent (Analista Funcional & UI/UX) · Luciano O. Reguera (Integración API & DRM)  
**Especificación asociada:** [`docs/specs/02-especificacion-frontend-ui-ux-y-drm.md`](../specs/02-especificacion-frontend-ui-ux-y-drm.md) — **Spec FE-02**  
**Endpoints consumidos:** `GET /api/v1/documentos` · `GET /api/v1/documentos/:id` · `GET /api/v1/departamentos/metricas` · `GET /api/v1/prestamos/mis-prestamos`

---

## 1. Objetivo de la Fase

Reemplazar los datos de ejemplo de las pantallas **Catálogo de documentos** y **Ficha del documento** (Figma págs. 11, 12 y 19) por el catálogo real del Backend: búsqueda libre con *debounce*, filtros combinables sincronizados con la URL, métricas de alcance en los 19 departamentos de San Juan, paginación y ficha bibliográfica completa con un botón de acción que depende de la sesión, de los préstamos del usuario y de la disponibilidad de la obra. En ningún momento se expone una URL directa al PDF.

---

## 2. Archivos Incorporados o Modificados en `frontend/`

```text
frontend/src/
├── api/
│   ├── catalog.api.ts             # GET /documentos (filtros + paginación) y GET /documentos/:id
│   ├── departments.api.ts         # + metrics(): GET /departamentos/metricas
│   └── loans.api.ts               # myLoans(): GET /prestamos/mis-prestamos (la Fase 3 suma solicitud y cierre)
├── hooks/
│   ├── useDebouncedValue.ts       # Debounce genérico (búsqueda y rango de años)
│   ├── useTerritorialMetrics.ts   # Métricas territoriales para la portada y el catálogo
│   └── useDocumentLoanAction.ts   # Acción contextual de la ficha (login / visor / solicitar / suspendido)
├── components/
│   ├── catalog/
│   │   ├── CatalogFilters.tsx     # Panel de filtros (departamento, carrera, tipo, años, disponibilidad)
│   │   ├── DocumentCard.tsx       # Tarjeta de resultado + skeleton de carga
│   │   ├── LoanActionButton.tsx   # Botón de la ficha según LoanAction
│   │   └── TerritorialBanner.tsx  # Banner "Alcance territorial"
│   └── ui/
│       ├── Badge.tsx              # + AvailabilityBadge y TIPO_DOCUMENTO_LABEL_LARGO
│       └── Pagination.tsx         # Paginador con elipsis conectado a `meta`
├── pages/public/
│   ├── catalog-params.ts          # URL ↔ filtros, validación del rango de años
│   ├── CatalogPage.tsx            # Catálogo conectado a la API
│   ├── DocumentDetailPage.tsx     # Ficha conectada a la API + condiciones DRM
│   └── LandingPage.tsx            # Métricas de la portada en vivo
├── mocks/figma-fixtures.ts        # − CATALOG_DOCUMENTS (reemplazado por la API)
└── test/
    ├── test-utils.tsx             # Helpers compartidos (mockBackend, renderAt, startSession, fixtures)
    └── fase-02.spec.tsx           # 14 pruebas de la fase
```

---

## 3. Entregables Técnicos Desarrollados

### 3.1. Catálogo Público (`/catalogo`)

**Filtros sincronizados con la URL.** La URL es la única fuente de verdad: `/catalogo?q=&departamentoId=&carrera=&tipo=&anioDesde=&anioHasta=&disponible=&page=`. Esto permite compartir una búsqueda, recargar la página y usar atrás/adelante del navegador.

| Filtro | Control | Parámetro de la API |
| :--- | :--- | :--- |
| Texto libre (título, autor, director, resumen, carrera o palabra clave) | Buscador con *debounce* de 400 ms; "Buscar" / Enter aplica en el acto | `q` |
| Departamento de origen | Selector con los 19 departamentos y la cantidad de obras de cada uno (`Jáchal (1)`) | `departamentoId` |
| Carrera | Selector `Arquitectura` · `Diseño` · `Urbanismo` | `carrera` |
| Tipo de documento | Radios en desktop / chips en mobile: `Tesis`, `Monografía`, `Investigación`, `Otros` | `tipo` |
| Año de publicación | Desde / Hasta (4 dígitos, 1950–2100) | `anioDesde`, `anioHasta` |
| Disponibilidad | "Solo disponibles para préstamo" | `disponible=true` |

- Todo cambio de filtro vuelve a la página 1. Los valores inválidos de la URL (tipo o carrera inexistentes, años fuera de rango, página ≤ 1) se descartan antes de consultar, para no provocar un `400`.
- **Rango de años validado en el cliente:** si "desde" es mayor que "hasta" se muestra *"El año "desde" no puede ser mayor que el año "hasta"."* y no se consulta la API.
- El tipo es de **selección única** porque `QueryDocumentsDto.tipo` acepta un solo valor (el prototipo mostraba checkboxes).
- En mobile, el botón **Filtros (N)** despliega el mismo panel debajo de los chips de tipo.
- **Limpiar filtros (N)** restablece la búsqueda, los años y la URL.

**Resultados.** Contador *"N documentos encontrados · Página X de Y"*, skeletons en la primera carga, opacidad reducida al refrescar, estado vacío con *"Limpiar filtros"*, y banner de error con **Reintentar**. Cada `DocumentCard` muestra el badge de disponibilidad (`Disponible` / `No disponible`), chips de tipo y carrera, autor, año, departamento y hasta 4 palabras clave.

**Paginación.** `Pagination` usa `meta.page` y `meta.totalPages` (10 resultados por página): números con elipsis en desktop y *"Página X de Y"* en mobile.

**Banner de Alcance Territorial** (`GET /api/v1/departamentos/metricas`): documentos catalogados, departamentos conectados, departamentos con obras y usuarios fuera de Capital, con la leyenda *"Capital + 18 departamentos de San Juan"*. La misma respuesta alimenta el selector de departamentos, así que no hace falta un segundo `GET /departamentos`.

### 3.2. Ficha Bibliográfica (`/documentos/:id`)

- Consume `GET /api/v1/documentos/:id` y muestra título, tipo, carrera, año, resumen completo, todas las palabras clave, autor, director y departamento de origen.
- Un `400` (identificador que no es UUID) o un `404` muestran *"Documento no encontrado"*; los errores de red ofrecen **Reintentar**.
- Recuadro **"Condiciones del préstamo digital y derechos de autor"**: 7 días corridos, lectura solo en el Visor Protegido (sin descarga, impresión ni copia), marca de agua con nombre y código de préstamo, bloqueo inmediato al vencer o ante revocación, y protección por la Ley 11.723.
- El breadcrumb **Catálogo** vuelve a la búsqueda de la que se vino (los filtros viajan en el `state` de la navegación).

**Botón de acción contextual (`useDocumentLoanAction`)**

| Situación | Botón |
| :--- | :--- |
| Visitante sin sesión | **"Iniciar sesión para solicitar préstamo (7 días)"** → `/login?redirect=/documentos/:id` |
| Usuario con préstamo `ACTIVO` vigente sobre la obra (`GET /prestamos/mis-prestamos?estado=ACTIVO`) | Verde **"Ya tenés un préstamo activo · Abrir en Visor Protegido"** → `/visor/:prestamoId` |
| Documento habilitado (`estaDisponible = true`) | **"Solicitar Préstamo Digital (7 días)"** (la Fase 3 lo conecta con `POST /api/v1/prestamos`; hoy muestra un aviso) |
| Documento suspendido (`disponible = false`) | Deshabilitado: **"Material temporalmente no disponible por Biblioteca"** |

Mientras se verifica la sesión o los préstamos se muestra *"Verificando disponibilidad…"*. Si la consulta de préstamos falla, se ofrece la solicitud; un `401` cierra la sesión mediante el evento global de `http-client.ts`.

### 3.3. Portada (`/`)

Las métricas *Documentos Digitales* y *Departamentos Conectados* salen de `GET /api/v1/departamentos/metricas` (con formato `es-AR`). Mientras cargan, o si no hay conexión, muestran "—" en lugar de cifras inventadas.

### 3.4. Barra de navegación unificada (`UserLayout`)

El prototipo usaba una barra blanca en Catálogo y Ficha (págs. 11 y 12) y una oscura en Mis préstamos (pág. 13), por lo que la navegación cambiaba bruscamente de color y tamaño entre secciones. Se adoptó una **única barra oscura `#2D2D2D` a ancho completo** para todas las vistas del usuario. Esta barra:

- Armoniza con la portada, el sidebar del panel admin y el banner territorial.
- Muestra el isotipo ámbar, la sección activa en ámbar con subrayado de 3 px, y un avatar con iniciales más *"Nombre · Departamento"* (visible desde 1280 px).
- Muestra el foco de teclado con un anillo ámbar en lugar del outline negro del navegador.
- En mobile usa la misma base oscura, con el botón *Volver* en la ficha y el menú hamburguesa oscuro.

---

## 4. Verificación

### 4.1. Pruebas automatizadas (`src/test/fase-02.spec.tsx`)
1. El catálogo lista `GET /documentos` (`?page=1&limit=10`), el banner territorial y los departamentos con su cantidad de obras; ningún enlace apunta al PDF.
2. Búsqueda con *debounce* (una sola consulta para `bioclim`) combinada con departamento, carrera, tipo, años y disponibilidad: URL y request coinciden; **Limpiar filtros** restablece todo.
3. Los filtros se leen desde la URL (`tipo`, `departamentoId`, `page=2`); **Siguiente** pide la página 3; cambiar un filtro vuelve a la página 1.
4. El rango de años invertido muestra el error y nunca llega a la API ni a la URL.
5. Un error `500` del catálogo muestra el banner y **Reintentar** recupera los resultados.
6. Ficha para visitante: metadatos, palabras clave, condiciones DRM, enlace de login con `?redirect=` y sin enlaces al PDF ni consulta de préstamos.
7. Usuario con préstamo `ACTIVO` → enlace a `/visor/loan-1024` (consulta `estado=ACTIVO`).
8. Usuario sin préstamo y documento habilitado → **"Solicitar Préstamo Digital (7 días)"**.
9. Documento suspendido → botón deshabilitado y badge *No disponible*.
10. Identificador inválido (`400`) → *"Documento no encontrado"*.
11. Volver desde la ficha conserva `?tipo=TESIS`.
12. La portada muestra `1.250` documentos y `19` departamentos desde las métricas.
13. Parseo y serialización de los filtros de la URL.
14. Validación del rango de años y paginación con elipsis.

Los helpers de mock del Backend se movieron a `src/test/test-utils.tsx` y `fase-01.spec.tsx` ahora los importa. Con esto, el test de portada de la Fase 0 ya no sale a la red.

### 4.2. Verificación contra el Backend en vivo (`http://localhost:3000/api/v1`)
- `GET /departamentos/metricas` → 19 departamentos y 4 documentos; con obras: Capital, Iglesia, Jáchal y Valle Fértil.
- `GET /documentos?q=bioclim&departamentoId=<Iglesia>&carrera=Diseño&tipo=TESIS&anioDesde=2020&anioHasta=2025&disponible=true&page=1&limit=10` → `200`, 1 resultado (*Diseño bioclimático en zonas áridas*).
- `q=San Juan` encuentra por palabra clave *Accesibilidad urbana en San Juan* y *Patrimonio arquitectónico sanjuanino*; `page=2&limit=3` → `totalPages: 2`.
- `GET /documentos/:id` → `200` sin campos de ruta ni URL de archivo; `/documentos/no-existe` → `400`; UUID inexistente → `404`.
- `GET /prestamos/mis-prestamos?estado=ACTIVO` con la sesión de Ana Pérez → `200`.
- Preflight CORS desde `http://localhost:5173` → `204`.

---

## 5. Criterios de Aceptación

- [x] Catálogo público en `/catalogo` con búsqueda libre (`q`) y *debounce*.
- [x] Filtros combinables por departamento (19), carrera, tipo, rango de años y disponibilidad, sincronizados con la URL.
- [x] Banner de alcance territorial interdepartamental desde `GET /api/v1/departamentos/metricas`.
- [x] Tarjetas `DocumentCard` con badges de tipo, carrera, departamento, año, palabras clave y disponibilidad.
- [x] Paginación conectada a `meta` (`page`, `limit`, `total`, `totalPages`).
- [x] Ficha `/documentos/:id` con metadatos completos, condiciones del préstamo DRM de 7 días y botón contextual de cuatro estados.
- [x] Ninguna vista expone URLs directas al PDF.
- [x] `pnpm run build` y `pnpm run test` en verde (31 pruebas: 5 de Fase 0 + 12 de Fase 1 + 14 de Fase 2).
