# Sistema de Préstamo Digital Interdepartamental — FAUD-UNSJ

Repositorio académico digital de la Facultad de Arquitectura, Urbanismo y Diseño (UNSJ). Permite catalogar tesis y trabajos en PDF y prestarlos por 7 días a usuarios de los 19 departamentos de San Juan, con lectura protegida por DRM temporal y marca de agua.

**DHL Solutions** — Diego A. González · Hugo A. Torrent · Luciano O. Reguera

| Componente | Tecnología | Puerto |
| :--- | :--- | :--- |
| `backend/` | NestJS + Prisma + PostgreSQL | `3000` (API `/api/v1`, Swagger `/api/docs`) |
| `frontend/` | React 18 + Vite + TypeScript + Tailwind CSS | `5173` (desarrollo) · `8080` (Docker) |
| PostgreSQL 16 | Docker | `5433` |
| Mailpit (correo de prueba) | Docker | `1025` SMTP · `8025` interfaz web |

---

## Requisitos

- Node.js 22 y `pnpm` 10
- Docker Desktop (o Docker Engine + Compose)

---

## Puesta en marcha (desarrollo)

```bash
# 1. Base de datos y servidor de correo
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
pnpm install
pnpm run prisma:migrate      # aplica las migraciones
pnpm run prisma:seed         # 19 departamentos, cuentas y catálogo de demostración
pnpm run start:dev           # http://localhost:3000/api/v1

# 3. Frontend (otra terminal)
cd frontend
cp .env.example .env
pnpm install
pnpm run dev                 # http://localhost:5173
```

### Cuentas de demostración (seed)

| Rol | Correo | Contraseña |
| :--- | :--- | :--- |
| Administrador de Biblioteca | `admin@faud.unsj.edu.ar` | `Admin123!` |
| Alumna aprobada (Jáchal) | `ana.perez@jachal.gov.ar` | `Alumno123!` |
| Usuario pendiente (Valle Fértil) | `carlos.gomez@vallefertil.gob.ar` | `Alumno123!` |

En `pnpm run dev`, la pantalla de login muestra estas cuentas como accesos rápidos.

---

## Build de producción del Frontend en Docker (opcional)

Con PostgreSQL, Mailpit y el Backend corriendo como arriba:

```bash
docker compose --profile frontend up -d --build
# SPA en http://localhost:8080
```

nginx sirve la SPA y reenvía `/api` al Backend del host, así que el navegador usa un solo origen y no hace falta tocar `CORS_ORIGIN`.

| Variable | Valor por defecto | Uso |
| :--- | :--- | :--- |
| `FRONTEND_PORT` | `8080` | Puerto publicado |
| `API_UPSTREAM` | `http://host.docker.internal:3000` | Destino del proxy `/api` |
| `VITE_SHOW_DEMO_ACCOUNTS` | `false` | `true` muestra los accesos de demostración (se define al construir la imagen) |

---

## Verificación

```bash
cd backend  && pnpm run test && pnpm run test:e2e   # Jest: unitarias + e2e (requiere PostgreSQL)
cd frontend && pnpm run test && pnpm run build      # Vitest + build de producción
```

- Correos enviados por el sistema: http://localhost:8025
- Estado del servicio: http://localhost:3000/api/v1/health

---

## Documentación

- Plan maestro: [`docs/00-plan-maestro-desarrollo.md`](docs/00-plan-maestro-desarrollo.md)
- Especificaciones y contrato OpenAPI: [`docs/specs/`](docs/specs/)
- Fases del Backend: [`docs/backend/fases-implementacion.md`](docs/backend/fases-implementacion.md)
- Fases del Frontend: [`docs/frontend/fases-implementacion.md`](docs/frontend/fases-implementacion.md)
- Cierre del Frontend y trazabilidad RF/RNF: [`docs/frontend/fase-06-pruebas-integrales-y-cierre.md`](docs/frontend/fase-06-pruebas-integrales-y-cierre.md)
- Despliegue de demostración (Vercel + Render + Neon + Backblaze B2): [`docs/despliegue-demo.md`](docs/despliegue-demo.md)
