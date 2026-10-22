# Frontend — Sistema de Préstamo Digital Interdepartamental (FAUD-UNSJ)

Single Page Application (**React 18 + Vite + TypeScript + Tailwind CSS**) gestionada con **`pnpm`** para el **Repositorio Académico Digital de la Facultad de Arquitectura, Urbanismo y Diseño (FAUD-UNSJ)**.

---

## Comandos Principales (`pnpm`)

```bash
# Instalar dependencias
pnpm install

# Levantar servidor de desarrollo en http://localhost:5173
pnpm run dev

# Verificar tipos y generar build de producción
pnpm run build

# Ejecutar suite de pruebas automatizadas (Vitest + React Testing Library)
pnpm run test

# Servir la build de producción en http://localhost:4173
pnpm run preview
```

---

## Imagen Docker (build de producción con nginx)

Desde la raíz del monorepo, con el Backend corriendo en el host (`http://localhost:3000`):

```bash
# SPA en http://localhost:8080 (reenvía /api al Backend)
docker compose --profile frontend up -d --build

# Con los accesos de demostración en /login
VITE_SHOW_DEMO_ACCOUNTS=true docker compose --profile frontend up -d --build
```

La imagen compila con `VITE_API_BASE_URL=/api/v1` y nginx reenvía `/api` a `API_UPSTREAM` (por defecto `http://host.docker.internal:3000`). Configuración en [`nginx/`](nginx/). Guía completa del monorepo: [`README.md`](../README.md).

---

## Documentación y Especificaciones (Etapa C)

- **Especificación OpenSpec Frontend (UI/UX, Figma y DRM):** [`docs/specs/02-especificacion-frontend-ui-ux-y-drm.md`](../docs/specs/02-especificacion-frontend-ui-ux-y-drm.md)
- **Plan de Fases de Implementación (Fases 0 a 6):** [`docs/frontend/fases-implementacion.md`](../docs/frontend/fases-implementacion.md)
- **Seguimiento Fase 0:** [`docs/frontend/fase-00-inicializacion-y-design-system.md`](../docs/frontend/fase-00-inicializacion-y-design-system.md)
- **Seguimiento Fase 1:** [`docs/frontend/fase-01-autenticacion-y-departamentos.md`](../docs/frontend/fase-01-autenticacion-y-departamentos.md)
- **Seguimiento Fase 2:** [`docs/frontend/fase-02-catalogo-publico-y-ficha.md`](../docs/frontend/fase-02-catalogo-publico-y-ficha.md)
- **Seguimiento Fase 3:** [`docs/frontend/fase-03-prestamos-usuario-y-notificaciones.md`](../docs/frontend/fase-03-prestamos-usuario-y-notificaciones.md)
- **Seguimiento Fase 4:** [`docs/frontend/fase-04-visor-pdf-protegido-drm.md`](../docs/frontend/fase-04-visor-pdf-protegido-drm.md)
- **Seguimiento Fase 5:** [`docs/frontend/fase-05-panel-admin-biblioteca.md`](../docs/frontend/fase-05-panel-admin-biblioteca.md)
- **Seguimiento Fase 6:** [`docs/frontend/fase-06-pruebas-integrales-y-cierre.md`](../docs/frontend/fase-06-pruebas-integrales-y-cierre.md)
- **Contrato API Congelado (OpenAPI 3.0):** [`docs/specs/openapi.json`](../docs/specs/openapi.json)
