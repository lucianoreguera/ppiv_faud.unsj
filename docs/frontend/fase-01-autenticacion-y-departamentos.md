# Fase 1: Autenticación JWT, Registro Interdepartamental (19 Departamentos) y Guardias de Rol (`RF05`)

**Estado:** Completada y Verificada ✅  
**Responsables técnicos:** Diego A. González (Frontend & PM) · Hugo A. Torrent (Analista Funcional & UI/UX) · Luciano O. Reguera (Integración API & DRM)  
**Especificación asociada:** [`docs/specs/02-especificacion-frontend-ui-ux-y-drm.md`](../specs/02-especificacion-frontend-ui-ux-y-drm.md) — **Spec FE-01**  
**Endpoints consumidos:** `POST /api/v1/auth/login` · `POST /api/v1/auth/register` · `GET /api/v1/auth/profile` · `GET /api/v1/departamentos`

---

## 1. Objetivo de la Fase

Conectar las pantallas de **Iniciar sesión** y **Crear cuenta** (Figma págs. 5, 6 y 16) con el Backend, mantener la sesión JWT del usuario en toda la SPA y proteger las rutas privadas según el rol (`USUARIO` / `ADMINISTRADOR`), respetando que toda cuenta nueva nace en estado **`PENDIENTE`** hasta que la Biblioteca FAUD-UNSJ la apruebe.

---

## 2. Archivos Incorporados o Modificados en `frontend/`

```text
frontend/src/
├── api/
│   ├── auth.api.ts                # login, register, getProfile
│   └── departments.api.ts         # GET /departamentos (Capital primero, luego alfabético)
├── context/AuthContext.tsx        # AuthProvider + useAuth (sesión JWT, perfil, logout, isAdmin)
├── routes/
│   ├── auth-redirect.ts           # Inicio por rol y saneamiento de ?redirect=
│   ├── RouteGuards.tsx            # ProtectedRoute, RoleGuard y GuestRoute
│   └── AppRouter.tsx              # Rutas envueltas por las guardias
├── components/ui/
│   ├── Alert.tsx                  # Banner warning / danger / success / info
│   └── FormField.tsx              # + prop `error` (aria-invalid) y opciones { value, label }
├── components/layout/
│   ├── UserLayout.tsx             # Nombre · departamento reales, "Iniciar sesión" para visitantes
│   └── AdminLayout.tsx            # "Cerrar sesión" funcional
├── pages/auth/
│   ├── auth-form.ts               # Validación de email y traducción de errores HTTP a banners
│   ├── LoginPage.tsx              # Formulario conectado + accesos de demostración
│   └── RegisterPage.tsx           # 19 departamentos desde la API + confirmación PENDIENTE
└── test/fase-01.spec.tsx          # 12 pruebas de la fase
```

Se eliminó el fixture `SESSION_USER` de `mocks/figma-fixtures.ts`: la barra de navegación ahora muestra el usuario autenticado.

---

## 3. Entregables Técnicos Desarrollados

### 3.1. `AuthContext` / `useAuth`
- Expone `user`, `status` (`loading` · `authenticated` · `anonymous`), `isAuthenticated`, `isAdmin`, `login()`, `logout()` y `refreshProfile()`.
- Persiste el token (`faud_auth_token`) y el último perfil (`faud_auth_user`) en `localStorage`. Con perfil en caché la SPA se muestra de inmediato y **revalida en segundo plano** con `GET /api/v1/auth/profile`.
- Un `401`, `403` o `404` en la revalidación cierra la sesión (token expirado, usuario eliminado o cuenta que dejó de estar `APROBADO`). Ante errores de red se conserva la sesión en caché.
- Escucha el evento global `faud:unauthorized` emitido por `http-client.ts` ante cualquier `401` y muestra el aviso *"Tu sesión expiró"*.
- `logout()` borra el token, el perfil y todos los tokens DRM almacenados.

### 3.2. Inicio de Sesión (`/login`)
- Validación en cliente (email con formato válido y contraseña obligatoria) con mensajes debajo de cada campo.
- Banners según la respuesta de `POST /api/v1/auth/login`:

| Respuesta | Banner | Texto |
| :--- | :--- | :--- |
| `403` cuenta `PENDIENTE` | Ámbar | *"Tu cuenta aguarda validación"* + motivo de la API |
| `403` cuenta `RECHAZADO` | Rojo | *"Solicitud de cuenta rechazada"* + motivo de la API |
| `401` | Rojo | *"No pudimos iniciar sesión"* (credenciales inválidas) |
| `429` | Ámbar | *"Demasiados intentos"* con los segundos de `Retry-After` |
| Sin conexión | Rojo | *"Sin conexión con el servidor"* |

- Al llegar desde una ruta privada (`?redirect=`) se muestra el aviso *"Iniciá sesión para continuar"*.
- **Accesos de demostración** (credenciales del seed, se precargan sin enviar): *Admin Biblioteca*, *Ana Pérez · Jáchal* (aprobada) y *Carlos Gómez · Valle Fértil (pendiente)*. Visibles con `pnpm dev` o con `VITE_SHOW_DEMO_ACCOUNTS=true` en el build.

### 3.3. Registro Departamental (`/registro`)
- El selector de **Departamento** se completa con `GET /api/v1/departamentos` (Capital primero y los 18 restantes en orden alfabético) y envía el UUID como `departamentoId`. Si la carga falla, ofrece *Reintentar*.
- Validaciones alineadas con `RegisterDto`: nombre de 2 a 120 caracteres, email válido, departamento obligatorio y contraseña de **8 a 100 caracteres** (el Backend acepta 6; se respeta el mínimo de 8 indicado en el prototipo).
- `409 Conflict` marca el campo de correo como ya registrado; `400` y `429` se informan en el banner.
- Tras `201 Created` **no se inicia sesión**: se muestra la tarjeta *"Cuenta registrada en estado PENDIENTE de validación por Biblioteca"* con nombre, correo, departamento y badge `Pendiente`, más el acceso a `/login`.

### 3.4. Guardias de Navegación

| Guardia | Rutas | Comportamiento |
| :--- | :--- | :--- |
| `GuestRoute` | `/login`, `/registro` | Con sesión activa redirige al `?redirect=` válido o al inicio del rol (`/admin` para `ADMINISTRADOR`, `/catalogo` para `USUARIO`). |
| `ProtectedRoute` | `/mis-prestamos`, `/notificaciones`, `/visor/:prestamoId`, `/admin/*` | Sin sesión redirige a `/login?redirect=<ruta original>`. |
| `RoleGuard(['ADMINISTRADOR'])` | `/admin/*` | Un `USUARIO` ve la pantalla *"Acceso restringido"* con enlace a su inicio. |

- `/`, `/catalogo` y `/documentos/:id` siguen siendo públicas. La barra del catálogo muestra *"Iniciar sesión"* a los visitantes.
- `?redirect=` solo acepta rutas internas (rechaza URLs absolutas, `//host` y `/\host`), y un `USUARIO` nunca es redirigido a `/admin/*`.

---

## 4. Verificación

### 4.1. Pruebas automatizadas (`src/test/fase-01.spec.tsx`)
1. Registro: lista los departamentos de la API, envía el `RegisterDto` con el UUID de Jáchal y muestra la confirmación `PENDIENTE` sin guardar token.
2. Registro: validaciones en cliente (sin llamar a la API) y `409` marcado en el campo de correo.
3. Login `403 PENDIENTE` → banner ámbar, permanece en `/login` y sin token.
4. Login `403 RECHAZADO` → banner rojo.
5. Login de cuenta `APROBADO` con acceso de demostración → vuelve a `?redirect=/mis-prestamos` y persiste token y perfil.
6. Login de `ADMINISTRADOR` → redirige a `/admin`.
7. Ruta privada sin sesión → `/login?redirect=%2Fmis-prestamos`.
8. `USUARIO` en `/admin/usuarios` → *"Acceso restringido"*.
9. `GET /auth/profile` con `403` → cierra la sesión y redirige a `/login`.
10. La barra muestra *"Ana Pérez · Jáchal"* y *"Cerrar sesión"* limpia la sesión.
11. Usuario autenticado en `/login` → redirigido a su inicio.
12. Saneamiento de `?redirect=`.

### 4.2. Verificación contra el Backend en vivo (`http://localhost:3000/api/v1`)
- `GET /departamentos` → 19 departamentos, `Capital` primero; preflight CORS desde `http://localhost:5173` aceptado.
- `POST /auth/register` (Jáchal) → `201` con `estadoValidacion: PENDIENTE`; repetir el mismo correo → `409`.
- `POST /auth/login` con la cuenta recién creada → `403` *"... (estado: PENDIENTE)."*, clasificado como `ACCOUNT_PENDING`.
- `POST /auth/login` de Ana Pérez → `200` (`USUARIO`, Jáchal) y `GET /auth/profile` → `200`; Admin Biblioteca → `ADMINISTRADOR`.

---

## 5. Criterios de Aceptación

- [x] `AuthContext` / `useAuth` con persistencia de sesión, carga de perfil, cierre de sesión y helpers de rol.
- [x] `/login` conectado a `POST /api/v1/auth/login` con banners `PENDIENTE` (ámbar) y `RECHAZADO` (rojo).
- [x] Accesos rápidos de demostración con las cuentas del seed.
- [x] `/registro` con los 19 departamentos desde `GET /api/v1/departamentos` y confirmación de estado `PENDIENTE`.
- [x] `ProtectedRoute` con `?redirect=` y `RoleGuard` restringiendo `/admin/*` a `ADMINISTRADOR`.
- [x] `pnpm run build` y `pnpm run test` en verde (17 pruebas: 5 de Fase 0 + 12 de Fase 1).
