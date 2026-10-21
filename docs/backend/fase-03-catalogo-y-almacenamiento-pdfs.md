# Fase 3: Módulo de Catálogo y Almacenamiento Seguro de PDFs (RF01, RF02)

**Estado:** Completada y Verificada ✅  
**Responsable técnico:** Backend & DBA (Luciano Reguera)

---

## 1. Objetivo de la Fase
Implementar el **Módulo de Catálogo Académico (`CatalogModule`)** y el **Servicio de Almacenamiento Privado de PDFs (`PdfStorageService`)**, cumpliendo con los requerimientos funcionales **`RF01`** (carga, edición y catalogación de documentos PDF por el Administrador de Biblioteca) y **`RF02`** (buscador público paginado con filtros combinados y ficha bibliográfica detallada), garantizando que los archivos PDF nunca queden expuestos en rutas públicas estáticas (**`RNF02`**).

---

## 2. Almacenamiento Privado y Validación Binaria de PDFs (`PdfStorageService`)

Ubicación: `backend/src/catalog/pdf-storage.service.ts`

1. **Directorio Privado Fuera del Alcance Público (`storage/pdfs/`)**:
   - Los archivos PDF se almacenan en `backend/storage/pdfs/` (configurable vía `PRIVATE_STORAGE_DIR` en `.env`), completamente aislados de cualquier servidor de archivos estáticos.
   - Ninguna respuesta HTTP del catálogo incluye el campo interno `archivoUrl`, impidiendo descargas directas sin pasar por el control de préstamos y DRM temporal (Fase 4).
2. **Validación Estricta Multicapa (`validateAndSavePdf`)**:
   - **Presencia y tamaño:** Verifica que el archivo no esté vacío y no supere el límite de **`50 MB`** (`MAX_PDF_SIZE_MB`).
   - **Extensión y MIME Type:** Exige extensión `.pdf` y `Content-Type: application/pdf`.
   - **Firma Binaria (Magic Bytes `%PDF-`):** Inspecciona los primeros 5 bytes del buffer para rechazar archivos maliciosos o ejecutables renombrados como `.pdf`.
   - **Prevención de Path Traversal:** Normaliza el nombre con slug + UUID corto + timestamp y verifica con `path.resolve` que el destino permanezca dentro de `storage/pdfs/`.
3. **Semillas PDF Iniciales (`ensureSeedSamplePdfs`)**:
   - Al inicializar el módulo (`onModuleInit`), garantiza que los 4 documentos académicos iniciales del seed cuenten con archivos PDF 1.4 válidos en `storage/pdfs/` listos para el streaming protegido de la Fase 4.

---

## 3. Endpoints Implementados en `CatalogModule` (`src/catalog/`)

| Método | Endpoint | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/documentos` | `ADMINISTRADOR` (`multipart/form-data`) | Carga un archivo `.pdf` (máx. 50 MB) junto con sus metadatos normalizados (`titulo`, `autor`, `director`, `carrera`, `tipo`, `anio`, `departamentoOrigenId`, `palabrasClave[]`, `resumen`, `disponible`). |
| `GET` | `/api/v1/documentos` | Público | Buscador paginado con filtros combinables: texto libre (`q` en título, autor, director, resumen y palabras clave), `departamentoId` (19 departamentos de San Juan), `carrera`, `tipo`, `anio`, rango `anioDesde`/`anioHasta` y `disponible`. |
| `GET` | `/api/v1/documentos/:id` | Público | Devuelve la ficha bibliográfica completa del documento (Figma pág. 12), incluyendo `estaDisponible` (`estaDisponible()`), `departamentoOrigen` y contadores de préstamos, sin exponer el PDF. |
| `PATCH` | `/api/v1/documentos/:id` | `ADMINISTRADOR` | Actualiza metadatos bibliográficos, habilita/suspende la disponibilidad (`disponible: true/false`) o reemplaza el archivo PDF adjunto (eliminando el archivo anterior del almacenamiento privado). |
| `DELETE` | `/api/v1/documentos/:id` | `ADMINISTRADOR` | Elimina un documento del catálogo y borra su archivo PDF del almacenamiento privado (bloqueando con `409 Conflict` si posee préstamos activos o historial comprometido). |

---

## 4. Regla de Dominio: `estaDisponible(id, usuarioId?)`

En `CatalogService.estaDisponible()` se dejó implementada y exportada la regla de negocio del **Diagrama de Clases (Figura 2)** y **Spec 03**:
- Comprueba que el documento exista y se encuentre habilitado administrativamente por Biblioteca (`documento.disponible === true`).
- Soporta **préstamos digitales simultáneos multiusuario** (el préstamo activo de un alumno no bloquea a otros alumnos), verificando únicamente que el mismo `usuarioId` no posea ya un préstamo `ACTIVO` vigente sobre ese documento.

---

## 5. Criterios de Aceptación (Verificación de Fase 3)
- [x] `POST /api/v1/documentos` (Solo Admin, `multipart/form-data`) valida extensión `.pdf`, firma `%PDF-`, tamaño máximo `50 MB` y persiste el archivo en `storage/pdfs/`.
- [x] `GET /api/v1/documentos` permite búsqueda pública paginada combinando `q`, `departamentoId`, `carrera`, `tipo`, `anioDesde`/`anioHasta` y `disponible`.
- [x] `GET /api/v1/documentos/:id` devuelve la ficha detallada del documento e indicador `estaDisponible` sin exponer `archivoUrl`.
- [x] Ningún archivo PDF en `storage/pdfs/` es accesible mediante URLs públicas directas (`404 Not Found`).
- [x] `PATCH /api/v1/documentos/:id` y `DELETE /api/v1/documentos/:id` permiten administrar el catálogo con control de acceso por rol `ADMINISTRADOR`.
- [x] Pruebas unitarias (`catalog.service.spec.ts`) y pruebas End-to-End (`test/app.e2e-spec.ts`) ejecutadas en verde.
