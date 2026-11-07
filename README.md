# Sistema de Préstamo Digital Interdepartamental — FAUD-UNSJ

![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)

Repositorio académico digital de la Facultad de Arquitectura, Urbanismo y Diseño (UNSJ). Permite catalogar tesis y trabajos en PDF y prestarlos por 7 días a usuarios de los 19 departamentos de San Juan, con lectura protegida por DRM temporal y marca de agua dinámica.

**DHL Solutions** — Diego A. González · Hugo A. Torrent · Luciano O. Reguera

---

## Arquitectura y Componentes

| Componente | Tecnología | Puerto / Endpoint |
| :--- | :--- | :--- |
| `backend/` | NestJS + Prisma + PostgreSQL | `3000` (API `/api/v1`, Swagger `/api/docs`) |
| `frontend/` | React 18 + Vite + TypeScript + Tailwind CSS | `5173` (desarrollo) · `8080` (Docker) |
| PostgreSQL 16 | Docker | `5433` |
| Mailpit (servidor de correo de prueba) | Docker | `1025` SMTP · `8025` Web UI |

---

## Estructura del Repositorio

```text
├── backend/            # API NestJS, Prisma ORM, autenticación y lógica DRM
├── frontend/           # SPA React 18 + Vite + TypeScript + Tailwind CSS
├── docs/               # Especificaciones OpenAPI, trazabilidad RF/RNF y guías
├── docker-compose.yml  # Configuración de PostgreSQL 16, Mailpit y frontend
└── README.md
```

---

## Requisitos Previos

- **Node.js** >= 22 y **pnpm** >= 10
- **Docker Desktop** (o Docker Engine + Docker Compose v2)

---

## Puesta en Marcha (Desarrollo)

```bash
# 1. Base de datos y servidor de correo de prueba
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
pnpm install
pnpm run prisma:migrate      # Aplica las migraciones en PostgreSQL
pnpm run prisma:seed         # Carga los 19 departamentos, cuentas y catálogo de demostración
pnpm run start:dev           # http://localhost:3000/api/v1

# 3. Frontend (en otra terminal)
cd ../frontend
cp .env.example .env
pnpm install
pnpm run dev                 # http://localhost:5173
```

> **Documentación interactiva de la API:** disponible en [http://localhost:3000/api/docs](http://localhost:3000/api/docs) una vez levantado el backend.

---

### Cuentas de Demostración (Seed)

| Rol | Correo | Contraseña |
| :--- | :--- | :--- |
| **Administrador de Biblioteca** | `admin@faud.unsj.edu.ar` | `Admin123!` |
| **Alumna aprobada (Jáchal)** | `ana.perez@jachal.gov.ar` | `Alumno123!` |
| **Usuario pendiente (Valle Fértil)** | `carlos.gomez@vallefertil.gob.ar` | `Alumno123!` |

*En modo desarrollo (`pnpm run dev`), la pantalla de login incluye botones de acceso rápido con estas cuentas.*

---

## Build de Producción del Frontend en Docker (Opcional)

Con PostgreSQL, Mailpit y el Backend corriendo:

```bash
docker compose --profile frontend up -d --build
# SPA servida en http://localhost:8080
```

Nginx sirve la SPA y reenvía `/api` al backend del host, operando bajo un único origen para simplificar el manejo de CORS en entornos cerrados.

| Variable | Valor por defecto | Uso |
| :--- | :--- | :--- |
| `FRONTEND_PORT` | `8080` | Puerto publicado en el host |
| `API_UPSTREAM` | `http://host.docker.internal:3000` | Destino del proxy `/api` |
| `VITE_SHOW_DEMO_ACCOUNTS` | `false` | `true` activa los accesos demo (definido al construir la imagen) |

---

## Verificación y Calidad de Código

```bash
# Backend: Pruebas unitarias y end-to-end (requiere PostgreSQL levantado)
cd backend && pnpm run test && pnpm run test:e2e

# Frontend: Pruebas con Vitest y build estático de producción
cd frontend && pnpm run test && pnpm run build
```

- **Buzón de correos enviados:** [http://localhost:8025](http://localhost:8025)
- **Comprobación de estado (Healthcheck):** [http://localhost:3000/api/v1/health](http://localhost:3000/api/v1/health)

---

## Documentación del Proyecto

- **Plan maestro:** [`docs/00-plan-maestro-desarrollo.md`](docs/00-plan-maestro-desarrollo.md)
- **Especificaciones y contrato OpenAPI:** [`docs/specs/`](docs/specs/)
- **Fases del Backend:** [`docs/backend/fases-implementacion.md`](docs/backend/fases-implementacion.md)
- **Fases del Frontend:** [`docs/frontend/fases-implementacion.md`](docs/frontend/fases-implementacion.md)
- **Cierre del Frontend y trazabilidad RF/RNF:** [`docs/frontend/fase-06-pruebas-integrales-y-cierre.md`](docs/frontend/fase-06-pruebas-integrales-y-cierre.md)
- **Despliegue de demostración (Vercel + Render + Neon + Backblaze B2):** [`docs/despliegue-demo.md`](docs/despliegue-demo.md)
