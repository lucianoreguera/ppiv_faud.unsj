# Plan Maestro de Desarrollo — Sistema de Préstamo Digital Interdepartamental (FAUD-UNSJ)

**Empresa:** DHL Solutions (Grupo N°9 — IFTS N°29, Práctica Profesionalizante IV)  
**Equipo:**
- **Luciano O. Reguera** — Backend Developer & DBA
- **Diego A. González** — Frontend Developer & Project Manager
- **Hugo A. Torrent** — Analista Funcional & UI/UX

---

## 1. Síntesis del Relevamiento Documental

A partir de la lectura integral de la carpeta `documentación/` (`Primera_Etapa`, `Segunda_Etapa` y `Presentacion_Prototipos_Figma`), se consolidan los pilares del sistema:

### 1.1. Objetivo del Sistema
Permitir a la **Facultad de Arquitectura, Urbanismo y Diseño (FAUD-UNSJ)** catalogar su producción académica (tesis, monografías, investigaciones) y otorgar **préstamos digitales temporales (7 días)** a estudiantes, docentes y profesionales de los **19 departamentos de San Juan**, protegiendo los derechos de autor mediante tokens de acceso temporal (JWT), bloqueo de descarga/impresión y marcas de agua dinámicas en el visor.

### 1.2. Módulos Core Identificados
1. **Autenticación y Seguridad (`AuthModule`)**: Login con JWT de sesión, guardias de roles (`USUARIO`, `ADMINISTRADOR`) y emisión/validación de tokens temporales de préstamo (7 días).
2. **Administración de Usuarios y Departamentos (`UsersModule` / `DepartmentsModule`)**: Registro de usuarios por departamento (los 19 departamentos de San Juan, distinguiendo `esCapital`) y flujo de **validación administrativa** (`PENDIENTE`, `APROBADO`, `RECHAZADO`).
3. **Gestión de Catálogo (`CatalogModule`)**: Carga de documentos PDF (máx. 50 MB), catalogación con metadatos normalizados y buscador público con filtros combinados.
4. **Préstamos y DRM Temporal (`LoansModule`)**: Solicitud de préstamo digital, máquina de estados explícita (`SOLICITADO`, `ACTIVO`, `RECHAZADO`, `VENCIDO`, `REVOCADO`, `CERRADO`), revocación manual por biblioteca, vencimiento automático a los 7 días y entrega segura del stream PDF al visor.
5. **Notificaciones (`NotificationsModule`)**: Avisos por correo electrónico y en plataforma (aprobación de cuenta, préstamo otorgado, alerta 24h antes del vencimiento y cierre/vencimiento).

---

## 2. Alineación entre Diagramas UML (Etapa 2) y Prototipos Figma

Al contrastar el **Diagrama de Clases / DER** con las pantallas del **Prototipo en Figma**, detectamos enriquecimientos importantes que debemos contemplar en la base de datos desde la Fase 1 para que el Backend soporte el 100% de las pantallas:

| Entidad | Campos en DER / Clases | Campos adicionales en SRS / Figma a incorporar |
| :--- | :--- | :--- |
| **`Departamento`** | `id`, `nombre`, `esCapital` | Semilla inicial con los **19 departamentos de San Juan**. |
| **`Usuario`** | `id`, `nombre`, `email`, `rol`, `departamentoId` | `passwordHash` (autenticación), `estadoValidacion` (`PENDIENTE`, `APROBADO`, `RECHAZADO` — visto en Figma pág. 8), `createdAt`. |
| **`Documento`** | `id`, `titulo`, `autor`, `tipo`, `palabrasClave[]`, `anio`, `archivoUrl` | `carrera` (`Arquitectura`, `Diseño`, `Urbanismo` — RF01/RF02 y Figma pág. 7), `resumen` (Figma pág. 12), `director` (Figma pág. 12), `departamentoOrigenId` (filtro territorial en Figma pág. 11), `disponible` (boolean). |
| **`Prestamo`** | `id`, `usuarioId`, `documentoId`, `fechaInicio`, `fechaVencimiento`, `estado`, `tokenAcceso` | `codigoReferencia` (ej. `#1024` para la marca de agua del visor en Figma pág. 14: `"Ana Pérez · Préstamo #1024"`). |
| **`Notificacion`** | `id`, `prestamoId`, `tipo`, `fechaEnvio`, `leida` | Soporte de listado para el usuario e integración con servicio de email (SMTP / Mailpit en desarrollo). |

---

## 3. Estructura del Proyecto Propuesta (Monorepo con `pnpm`)

El gestor de paquetes oficial para todo el proyecto (`backend/` y `frontend/`) es **`pnpm`**, garantizando instalaciones rápidas, deterministas (`pnpm-lock.yaml`) y uso eficiente de disco.

Siguiendo la separación por contenedores del **Diagrama de Despliegue (Figura 7)** y tu propuesta de trabajo por etapas:

```text
PPI_IV/
├── documentación/                 # Documentos académicos originales (Etapas 1 y 2, Figma PDFs)
├── docs/                          # Documentación viva de ingeniería e implementación (.md)
│   ├── 00-plan-maestro-desarrollo.md
│   ├── specs/                     # Especificaciones OpenSpec (dominio, contratos, casos de uso)
│   ├── backend/                   # Fases de implementación del Backend y guías de prueba
│   │   └── fases-implementacion.md
│   └── frontend/                  # (Futuro) Fases de implementación del Frontend
├── backend/                       # API Modular en NestJS + TypeScript + PostgreSQL (gestionado con pnpm)
├── frontend/                      # SPA en React + Vite + TypeScript + Tailwind CSS (gestionado con pnpm)
└── docker-compose.yml             # Orquestación local (PostgreSQL + Mailpit + Backend + Frontend)
```

---

## 4. Enfoque con OpenSpec y OpenAPI (Swagger)

Para aplicar **Spec-Driven Development (OpenSpec)** sin agregar fricción innecesaria:

1. **Especificaciones en `docs/specs/` (OpenSpec)**:
   - Antes de codificar cada fase, definimos/validamos su especificación en Markdown (modelo de datos, reglas de negocio, estados válidos y criterios de aceptación tipo Gherkin `Given/When/Then`).
   - Si desean usar la herramienta CLI de `openspec` (`openspec/` en la raíz), también podemos inicializarla directamente.
2. **Contrato ejecutable con OpenAPI 3.0 (`@nestjs/swagger`)**:
   - Desde la Fase 0 del Backend, configuramos Swagger en `/api/docs`.
   - Cada DTO tendrá decoradores de validación (`class-validator`) y de documentación (`@ApiProperty`), lo que nos permitirá **probar todo el backend desde el navegador o exportar el spec JSON** antes de escribir la primera línea de React.

---

## 5. Estrategia de Ejecución: "Backend First"

1. **Etapa A — Construcción y Pruebas del Backend (Fases 0 a 6)**:
   - Desarrollamos cada fase de forma incremental.
   - Al terminar cada fase, ejecutamos pruebas (Tests unitarios/e2e + colección de endpoints en Swagger/REST) y documentamos el resultado en `docs/backend/`.
2. **Etapa B — Congelamiento de Contrato API**:
   - Con el Backend 100% probado y validado contra los RF01–RF06 y RNF01–RNF02, exportamos la especificación OpenAPI.
3. **Etapa C — Construcción del Frontend React (basado en el Design System de Figma)**:
   - Implementamos las vistas públicas, el flujo de alumno (con visor PDF protegido y marca de agua) y el panel de administración de Biblioteca.
