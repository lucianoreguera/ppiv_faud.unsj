# OpenSpec — Especificación de Dominio, Reglas de Negocio y Contratos (v1.0)

**Sistema:** Sistema de Préstamo Digital Interdepartamental (Repositorio FAUD-UNSJ)  
**Estado:** Aprobada / Cerrada (v1.0)
**Gestor de paquetes oficial:** `pnpm`
**Estructura de repositorio:** Monorepo (`backend/`, `frontend/`, `docs/`, `documentación/`, `docker-compose.yml`)

---

## 1. Modelo de Dominio Consolidado (UML + Figma)

Esta especificación unifica el **Diagrama de Clases / DER** de la Segunda Etapa con las pantallas de alta fidelidad del **Prototipo en Figma**.

### 1.1. Enumerados del Dominio

```typescript
export enum RolUsuario {
  USUARIO = 'USUARIO',             // Estudiante, docente o profesional
  ADMINISTRADOR = 'ADMINISTRADOR', // Personal de Biblioteca FAUD-UNSJ
}

export enum EstadoValidacionUsuario {
  PENDIENTE = 'PENDIENTE',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
}

export enum TipoDocumento {
  TESIS = 'TESIS',
  MONOGRAFIA = 'MONOGRAFIA',
  INVESTIGACION = 'INVESTIGACION',
  OTROS = 'OTROS',
}

export enum EstadoPrestamo {
  SOLICITADO = 'SOLICITADO',
  ACTIVO = 'ACTIVO',
  RECHAZADO = 'RECHAZADO',
  VENCIDO = 'VENCIDO',
  REVOCADO = 'REVOCADO',
  CERRADO = 'CERRADO',
}

export enum TipoNotificacion {
  CUENTA_APROBADA = 'CUENTA_APROBADA',
  PRESTAMO_OTORGADO = 'PRESTAMO_OTORGADO',
  PROXIMO_VENCIMIENTO_24H = 'PROXIMO_VENCIMIENTO_24H',
  PRESTAMO_VENCIDO = 'PRESTAMO_VENCIDO',
  PRESTAMO_REVOCADO = 'PRESTAMO_REVOCADO',
}
```

---

## 2. Especificación de Requerimientos y Escenarios (Given / When / Then)

### Spec 01 — Registro y Validación Territorial de Usuarios (`RF05`)
- **Regla de negocio:** Todo usuario externo se registra seleccionando uno de los 19 departamentos de San Juan. Su cuenta nace en estado `PENDIENTE` y requiere aprobación de un `ADMINISTRADOR` para poder iniciar sesión y solicitar préstamos.
- **Escenario 1: Registro exitoso en estado pendiente**
  - **Given** un estudiante de Jáchal no registrado
  - **When** envía `POST /api/v1/auth/register` con nombre, email, contraseña y `departamentoId` válido
  - **Then** el sistema crea el usuario con `rol = USUARIO` y `estadoValidacion = PENDIENTE`.
- **Escenario 2: Bloqueo de acceso a cuenta no validada**
  - **Given** un usuario con `estadoValidacion = PENDIENTE` o `RECHAZADO`
  - **When** intenta iniciar sesión en `POST /api/v1/auth/login` o solicitar un préstamo
  - **Then** el sistema rechaza la operación con `403 Forbidden` informando que la cuenta aguarda validación de Biblioteca.

---

### Spec 02 — Gestión de Catálogo y Búsqueda Pública (`RF01`, `RF02`)
- **Regla de negocio:** Solo un `ADMINISTRADOR` puede cargar o editar documentos. Los archivos PDF (máx. 50 MB) se almacenan en un directorio privado fuera del alcance público y nunca se expone una URL estática directa al PDF. El buscador del catálogo es público.
- **Escenario 1: Carga de documento académico**
  - **Given** un usuario con rol `ADMINISTRADOR`
  - **When** envía `POST /api/v1/documentos` con archivo `.pdf` (<= 50MB) y metadatos (`titulo`, `autor`, `director`, `carrera`, `tipo`, `anio`, `departamentoOrigenId`, `palabrasClave[]`, `resumen`)
  - **Then** el sistema guarda el PDF de forma privada y registra el documento como disponible en el catálogo.
- **Escenario 2: Búsqueda pública combinada**
  - **Given** cualquier visitante (autenticado o anónimo)
  - **When** consulta `GET /api/v1/documentos` filtrando por texto (`q`), `departamentoId`, `tipo`, `carrera` o rango de `anio`
  - **Then** el sistema devuelve la lista paginada de fichas bibliográficas junto con su estado de disponibilidad (`disponible: true/false`), sin incluir el contenido binario del PDF.

---

### Spec 03 — Préstamo Digital Concurrente y DRM Temporal de 7 Días (`RF03`, `RF04`, `RNF02`)
- **Regla de negocio:**
  1. **Préstamos simultáneos multiusuario:** Por tratarse de producción académica digital, múltiples usuarios pueden mantener préstamos en estado `ACTIVO` sobre un mismo documento al mismo tiempo (el préstamo de un alumno no bloquea el material para otros).
  2. **Definición de `estaDisponible(usuarioId)`:**
     - Verifica que el documento esté habilitado administrativamente por Biblioteca (`documento.disponible === true`). Si Biblioteca deshabilitó temporalmente el documento (`disponible === false`), la solicitud se rechaza (`estado = RECHAZADO`), respetando la transición del Diagrama de Estados.
     - Verifica que **el mismo usuario** no posea ya un préstamo `ACTIVO` vigente sobre ese mismo documento (evitando préstamos duplicados activos para la misma persona).
  3. **Vigencia:** Un préstamo válido dura exactamente **7 días corridos** (`fechaVencimiento = fechaInicio + 7 días`). Al otorgarse, el sistema emite un `tokenAcceso` (JWT con expiración a 7 días).
  4. **Control de visualización doble:** Para visualizar el documento (`GET /api/v1/documentos/:id/ver`), el backend valida **ambas condiciones**: que el token JWT sea válido/vigente **y** que el registro del préstamo en PostgreSQL esté en estado `ACTIVO` (para garantizar que una revocación manual del Administrador corte el acceso en el acto).
- **Escenario 1: Solicitud de préstamo sobre documento habilitado (acceso concurrente)**
  - **Given** un usuario autenticado con cuenta `APROBADO`, un documento con `disponible = true` y sin préstamo `ACTIVO` previo de ese mismo usuario sobre ese documento (aunque otros usuarios sí lo tengan en préstamo activo)
  - **When** envía `POST /api/v1/prestamos` con `{ documentoId }`
  - **Then** el sistema crea el préstamo en estado `ACTIVO`, calcula `fechaVencimiento (+7d)`, firma el `tokenAcceso` JWT y responde `201 Created`.
- **Escenario 2: Rechazo por documento suspendido por Biblioteca o préstamo duplicado del mismo usuario**
  - **Given** un documento deshabilitado por Biblioteca (`disponible = false`) **o** un usuario que ya posee un préstamo `ACTIVO` vigente para ese mismo documento
  - **When** envía `POST /api/v1/prestamos` con `{ documentoId }`
  - **Then** el sistema no otorga un nuevo acceso activo (registra/informa el rechazo con `409 Conflict` / `400 Bad Request`).
- **Escenario 3: Visualización autorizada durante la vigencia**
  - **Given** un préstamo en estado `ACTIVO` con `fechaVencimiento > now()` y su `tokenAcceso` válido
  - **When** el usuario solicita `GET /api/v1/documentos/:id/ver`
  - **Then** el sistema responde `200 OK` entregando el flujo protegido del PDF y los datos de marca de agua (`"{nombreUsuario} · Préstamo #{codigo}"`).
- **Escenario 4: Bloqueo automático o por revocación (`403 Forbidden`)**
  - **Given** un préstamo cuyo plazo de 7 días expiró (`VENCIDO`) o que fue revocado por Biblioteca (`REVOCADO`)
  - **When** el usuario intenta acceder a `GET /api/v1/documentos/:id/ver`
  - **Then** el sistema rechaza la petición con `403 Forbidden` y mensaje `"El préstamo ha vencido o fue revocado"`.
