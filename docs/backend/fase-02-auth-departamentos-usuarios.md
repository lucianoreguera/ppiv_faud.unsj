# Fase 2: Módulo de Departamentos, Autenticación (JWT) y Gestión/Validación de Usuarios (RF05)

**Estado:** Completada y Verificada ✅  
**Responsable técnico:** Backend & DBA (Luciano Reguera)

---

## 1. Objetivo de la Fase
Implementar el **alcance territorial de los 19 departamentos de San Juan**, el flujo de **registro e inicio de sesión con JWT** y el **Panel de Administración de Usuarios de la Biblioteca FAUD-UNSJ (`RF05`)**, garantizando que toda cuenta externa nazca en estado `PENDIENTE` y solo pueda operar una vez que un usuario con rol `ADMINISTRADOR` la apruebe (`APROBADO`).

---

## 2. Arquitectura e Infraestructura de Seguridad (`src/common/`)

1. **Interfaces de Sesión (`src/common/interfaces/authenticated-user.interface.ts`)**:
   - `JwtPayload`: Contiene `sub` (UUID del usuario), `email`, `nombre`, `rol`, `departamentoId` y `departamentoNombre`.
   - `AuthenticatedUser`: Objeto inyectado en `request.user` tras validar el token contra PostgreSQL.
2. **Decoradores Personalizados**:
   - `@Roles(...roles: RolUsuario[])` (`src/common/decorators/roles.decorator.ts`): Define los roles requeridos por endpoint o controlador.
   - `@CurrentUser()` (`src/common/decorators/current-user.decorator.ts`): Extrae el usuario autenticado de la petición HTTP.
3. **Guardias (`Guards`)**:
   - `JwtAuthGuard` (`src/common/guards/jwt-auth.guard.ts`) + `JwtStrategy` (`src/auth/strategies/jwt.strategy.ts`): Verifica la firma y vigencia del Bearer Token (`jwt-auth`) **y comprueba en PostgreSQL que el usuario exista y permanezca en estado `APROBADO`**.
   - `RolesGuard` (`src/common/guards/roles.guard.ts`): Verifica que el rol del usuario autenticado coincida con `@Roles(...)`, devolviendo `403 Forbidden` en caso contrario.

---

## 3. Módulos y Endpoints Implementados

### 3.1. `DepartmentsModule` (`src/departments/`)
| Método | Endpoint | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/departamentos` | Público | Lista los **19 departamentos de San Juan** (`Capital` primero, luego orden alfabético) junto con métricas por departamento (`totalUsuarios`, `usuariosAprobados`, `usuariosPendientes`, `totalDocumentos`). |
| `GET` | `/api/v1/departamentos/metricas` | Público | Consolida la distribución territorial diferenciando `Capital` (`esCapital = true`) frente a los 18 departamentos restantes (`usuariosDepartamentosAlejados`). |
| `GET` | `/api/v1/departamentos/:id` | Público | Obtiene el detalle y métricas de un departamento específico por su UUID. |

### 3.2. `AuthModule` (`src/auth/`)
| Método | Endpoint | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Público | Registra un usuario asociado a uno de los 19 departamentos (`RF05`). Hashea la contraseña con `bcrypt` (10 rondas) y asigna `rol = USUARIO` y `estadoValidacion = PENDIENTE`. |
| `POST` | `/api/v1/auth/login` | Público | Verifica credenciales con `bcrypt.compare`. Si `estadoValidacion` es `PENDIENTE` o `RECHAZADO`, bloquea el acceso con **`403 Forbidden`**. Si es `APROBADO`, firma y devuelve el `accessToken` JWT. |
| `GET` | `/api/v1/auth/profile` | Autenticado (`Bearer`) | Devuelve los datos actualizados del perfil del usuario autenticado y su departamento. |

### 3.3. `UsersModule` — Panel Admin Biblioteca (`src/users/`)
| Método | Endpoint | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/usuarios` | `ADMINISTRADOR` | Lista usuarios con filtros combinables (`estado`, `departamentoId`, `rol`, búsqueda `q`) e incluye el objeto `contadores` (`todos`, `pendientes`, `aprobados`, `rechazados`) para las pestañas del Panel Admin (Figma pág. 8). |
| `GET` | `/api/v1/usuarios/:id` | `ADMINISTRADOR` | Obtiene el detalle de un usuario por su UUID e historial de cantidad de préstamos. |
| `PATCH` | `/api/v1/usuarios/:id/estado` | `ADMINISTRADOR` | Aprueba (`APROBADO`), rechaza (`RECHAZADO`) o pasa a `PENDIENTE` la cuenta de un usuario departamental (`RF05`), impidiendo que un administrador bloquee su propia cuenta. |

---

## 4. Criterios de Aceptación (Verificación de Fase 2)
- [x] `GET /api/v1/departamentos` y `GET /api/v1/departamentos/metricas` devuelven los 19 departamentos de San Juan con distinción `esCapital` y métricas territoriales.
- [x] `POST /api/v1/auth/register` crea cuentas departamentales con contraseña hasheada (`bcrypt`) y estado inicial `PENDIENTE`, rechazando emails duplicados (`409 Conflict`).
- [x] `POST /api/v1/auth/login` bloquea con `403 Forbidden` a usuarios en estado `PENDIENTE` o `RECHAZADO` y emite token JWT a usuarios en estado `APROBADO`.
- [x] `GET /api/v1/usuarios` y `PATCH /api/v1/usuarios/:id/estado` están protegidos para rol `ADMINISTRADOR` y permiten aprobar/rechazar usuarios departamentales.
- [x] Pruebas unitarias (`departments.service.spec.ts`, `auth.service.spec.ts`, `users.service.spec.ts`) y pruebas End-to-End (`test/app.e2e-spec.ts`) ejecutadas en verde.
