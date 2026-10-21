# Fase 0: Inicialización, Estructura Monorepo, Docker y OpenAPI

**Estado:** Completada y Verificada ✅  
**Responsable técnico:** Backend & DBA (Luciano Reguera)

---

## 1. Objetivo de la Fase
Establecer la estructura base del repositorio (`backend/`, `frontend/`, `docs/`), configurar los servicios de infraestructura local en Docker (**PostgreSQL 16** y **Mailpit** para pruebas de correo electrónico de `RF05` / `RF06`) y dejar funcionando el esqueleto de **NestJS** con validación global y documentación **OpenAPI / Swagger**.

---

## 2. Estructura de Directorios Implementada

```text
PPI_IV/
├── documentación/                 # PDFs originales de Etapas 1 y 2
├── docs/                          # Documentación técnica y especificaciones OpenSpec
│   ├── 00-plan-maestro-desarrollo.md
│   ├── specs/
│   │   └── 01-especificacion-dominio-y-contratos.md
│   └── backend/
│       ├── fases-implementacion.md
│       ├── fase-00-inicializacion.md
│       └── fase-01-base-de-datos-prisma.md
├── backend/                       # Proyecto NestJS (API Backend — gestor: pnpm)
│   ├── prisma/                    # Reservado para esquema Prisma, migraciones y seed (Fase 1)
│   ├── storage/                   # Almacenamiento privado de PDFs (Fase 3)
│   ├── src/
│   │   ├── common/                # Decoradores, filtros de excepción, guards, interceptores
│   │   ├── config/                # Variables de entorno tipadas (configuration.ts + env.validation.ts)
│   │   ├── prisma/                # Reservado para PrismaModule y PrismaService (Fase 1)
│   │   ├── health/                # Módulo Healthcheck (/api/v1/health) con chequeo de PostgreSQL
│   │   ├── app.module.ts
│   │   └── main.ts                # Bootstrap + ValidationPipe + Swagger (/api/docs)
│   ├── test/
│   │   └── app.e2e-spec.ts        # Prueba E2E del endpoint /api/v1/health
│   ├── .env.example
│   ├── pnpm-lock.yaml
│   └── package.json
├── frontend/                      # Carpeta reservada para el SPA React (gestor: pnpm)
├── docker-compose.yml             # PostgreSQL 16 + Mailpit (desarrollo local)
└── .gitignore
```

---

## 3. Tareas Técnicas Ejecutadas

1. **Orquestación Local (`docker-compose.yml`)**:
   - Servicio `postgres` (`faud_postgres`): Imagen `postgres:16-alpine`, base de datos `repositorio_faud`, volumen persistente `faud_repositorio_postgres_data`. Expone el puerto `5433:5432` en el host para no colisionar con el servicio local de Windows `postgresql-x64-16` en el puerto `5432`.
   - Servicio `mailpit` (`faud_mailpit`): Imagen `axllent/mailpit:latest`, puerto SMTP `1025` y consola web en `http://localhost:8025` para visualizar los emails de notificación (`RF05` y `RF06`).
2. **Inicialización del Proyecto NestJS en `backend/` con `pnpm`**:
   - Gestión de paquetes con **`pnpm`** (`pnpm-lock.yaml`).
   - Dependencias instaladas: `@nestjs/config`, `@nestjs/swagger`, `class-validator`, `class-transformer`, `pg`.
3. **Configuración en `main.ts` y `src/config/`**:
   - Validación estricta de variables de entorno al arranque (`validateEnv` en `src/config/env.validation.ts`).
   - Prefijo global: `/api/v1`.
   - `ValidationPipe` global con `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
   - Configuración de `SwaggerModule` en `/api/docs` con esquemas Bearer JWT (`jwt-auth` para sesión y `loan-drm-token` para DRM de préstamos a 7 días).
4. **Módulo de Healthcheck (`GET /api/v1/health`)**:
   - Endpoint documentado en Swagger que devuelve el estado del servidor, versión, entorno, uptime y verificación real de conexión/latencia contra PostgreSQL (`SELECT 1`).

---

## 4. Criterios de Aceptación (Verificación de Fase 0)
- [x] `docker compose up -d` levanta `faud_postgres` (PostgreSQL 16) y `faud_mailpit` correctamente.
- [x] `pnpm run build`, `pnpm run test` (unitarias) y `pnpm run test:e2e` (integración) pasan sin errores.
- [x] `GET http://localhost:3000/api/v1/health` responde `200 OK` con `database.status: "up"`.
- [x] `http://localhost:3000/api/docs` renderiza la interfaz de Swagger con la especificación OpenAPI 3.0 del proyecto.
