# Fase 1: Modelado de Datos con Prisma ORM, Migraciones y Seeds

**Estado:** Completada y Verificada ✅  
**Responsable técnico:** Backend & DBA (Luciano Reguera)

---

## 1. Objetivo de la Fase
Traducir el **Diagrama de Clases (Figura 2)**, el **DER (Figura 8)** y los metadatos de los **Prototipos de Figma** en un esquema relacional estricto en PostgreSQL mediante **Prisma ORM**, incluyendo las semillas iniciales de los **19 departamentos de San Juan**, usuarios de prueba y documentos académicos.

---

## 2. Diseño del Esquema (`prisma/schema.prisma`)

```prisma
enum RolUsuario {
  USUARIO
  ADMINISTRADOR
}

enum EstadoValidacionUsuario {
  PENDIENTE
  APROBADO
  RECHAZADO
}

enum TipoDocumento {
  TESIS
  MONOGRAFIA
  INVESTIGACION
  OTROS
}

enum EstadoPrestamo {
  SOLICITADO
  ACTIVO
  RECHAZADO
  VENCIDO
  REVOCADO
  CERRADO
}

enum TipoNotificacion {
  CUENTA_APROBADA
  PRESTAMO_OTORGADO
  PROXIMO_VENCIMIENTO_24H
  PRESTAMO_VENCIDO
  PRESTAMO_REVOCADO
}

model Departamento {
  id         String      @id @default(uuid()) @db.Uuid
  nombre     String      @unique
  esCapital  Boolean     @default(false) @map("es_capital")
  usuarios   Usuario[]
  documentos Documento[]

  @@map("departamentos")
}

model Usuario {
  id               String                  @id @default(uuid()) @db.Uuid
  nombre           String
  email            String                  @unique
  passwordHash     String                  @map("password_hash")
  rol              RolUsuario              @default(USUARIO)
  estadoValidacion EstadoValidacionUsuario @default(PENDIENTE) @map("estado_validacion")
  departamentoId   String                  @map("departamento_id") @db.Uuid
  departamento     Departamento            @relation(fields: [departamentoId], references: [id])
  prestamos        Prestamo[]
  createdAt        DateTime                @default(now()) @map("created_at")
  updatedAt        DateTime                @updatedAt @map("updated_at")

  @@index([departamentoId])
  @@index([estadoValidacion])
  @@map("usuarios")
}

model Documento {
  id                   String        @id @default(uuid()) @db.Uuid
  titulo               String
  autor                String
  director             String?
  carrera              String        // Ej: Arquitectura, Diseño, Urbanismo
  tipo                 TipoDocumento
  anio                 Int
  resumen              String        @db.Text
  palabrasClave        String[]      @map("palabras_clave")
  archivoUrl           String        @map("archivo_url")
  disponible           Boolean       @default(true)
  departamentoOrigenId String?       @map("departamento_origen_id") @db.Uuid
  departamentoOrigen   Departamento? @relation(fields: [departamentoOrigenId], references: [id])
  prestamos            Prestamo[]
  createdAt            DateTime      @default(now()) @map("created_at")
  updatedAt            DateTime      @updatedAt @map("updated_at")

  @@index([tipo])
  @@index([carrera])
  @@index([anio])
  @@index([disponible])
  @@map("documentos")
}

model Prestamo {
  id               String         @id @default(uuid()) @db.Uuid
  codigoReferencia Int            @default(autoincrement()) @map("codigo_referencia") // Ej: Préstamo #1024 para marca de agua
  usuarioId        String         @map("usuario_id") @db.Uuid
  documentoId      String         @map("documento_id") @db.Uuid
  fechaInicio      DateTime       @default(now()) @map("fecha_inicio")
  fechaVencimiento DateTime       @map("fecha_vencimiento")
  estado           EstadoPrestamo @default(SOLICITADO)
  tokenAcceso      String?        @map("token_acceso") @db.Text
  usuario          Usuario        @relation(fields: [usuarioId], references: [id])
  documento        Documento      @relation(fields: [documentoId], references: [id])
  notificaciones   Notificacion[]
  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @updatedAt @map("updated_at")

  @@index([usuarioId])
  @@index([documentoId])
  @@index([estado])
  @@index([fechaVencimiento])
  @@map("prestamos")
}

model Notificacion {
  id          String           @id @default(uuid()) @db.Uuid
  prestamoId  String           @map("prestamo_id") @db.Uuid
  tipo        TipoNotificacion
  mensaje     String?
  fechaEnvio  DateTime         @default(now()) @map("fecha_envio")
  leida       Boolean          @default(false)
  prestamo    Prestamo         @relation(fields: [prestamoId], references: [id], onDelete: Cascade)

  @@index([prestamoId])
  @@map("notificaciones")
}
```

---

## 3. Regla de Disponibilidad (`estaDisponible()`) y Préstamos Simultáneos
- **Acceso concurrente multiusuario:** Un mismo `Documento` puede tener múltiples préstamos en estado `ACTIVO` al mismo tiempo para distintos usuarios (el préstamo otorgado a un alumno no bloquea el documento para el resto de la comunidad).
- **Control administrativo (`documento.disponible`):** El booleano `disponible` en la tabla `documentos` actúa como estado editorial manejado por la Biblioteca FAUD-UNSJ (`true` = habilitado para préstamos; `false` = suspendido/en revisión).
- **Validación por usuario (`estaDisponible(documentoId, usuarioId)`):**
  1. Verifica que `documento.disponible === true` (si es `false`, la solicitud deriva al estado `RECHAZADO` del Diagrama de Estados).
  2. Verifica que **ese mismo `usuarioId`** no tenga ya un préstamo en estado `ACTIVO` con `fechaVencimiento > now()` sobre ese `documentoId` (impidiendo préstamos duplicados activos para la misma persona).
- **Indicador en el Catálogo:** Cuando un usuario autenticado consulta el catálogo o el detalle de un documento, el backend informa tanto `disponible` (estado general) como si el usuario actual ya posee un préstamo activo sobre ese material (`enPrestamoPorUsuarioActual: boolean`).

---

## 4. Datos de Semilla (`prisma/seed.ts`)
1. **Los 19 Departamentos de San Juan**:
   - `Capital` (`esCapital: true`)
   - `Rawson`, `Chimbas`, `Rivadavia`, `Santa Lucía`, `Pocito`, `Caucete`, `Jáchal`, `Albardón`, `Sarmiento`, `25 de Mayo`, `San Martín`, `Calingasta`, `9 de Julio`, `Angaco`, `Valle Fértil`, `Iglesia`, `Ullum`, `Zonda` (`esCapital: false`).
2. **Usuarios de prueba (alineados con Figma)**:
   - Admin Biblioteca: `admin@faud.unsj.edu.ar` (`ADMINISTRADOR`, `APROBADO`, contraseña: `Admin123!`)
   - Alumna aprobada (Jáchal): `ana.perez@jachal.gov.ar` (`USUARIO`, `APROBADO`, contraseña: `Alumno123!`)
   - Alumna aprobada (Caucete): `sofia.navarro@caucete.gob.ar` (`USUARIO`, `APROBADO`, contraseña: `Alumno123!`)
   - Usuarios pendientes de validación (Valle Fértil, Iglesia, Calingasta): `carlos.gomez@vallefertil.gob.ar`, `lucia.fernandez@iglesia.gob.ar`, `marcos.sosa@calingasta.gob.ar` (`USUARIO`, `PENDIENTE`, contraseña: `Alumno123!`).
3. **Catálogo inicial de documentos (alineado con Figma)**:
   - *"Accesibilidad urbana en San Juan"* (Martín González, 2023, Tesis, Urbanismo, Capital)
   - *"Vivienda social en Cuyo"* (L. Martínez, 2021, Investigación, Arquitectura, Jáchal)
   - *"Patrimonio arquitectónico sanjuanino"* (C. Ruiz, 2018, Monografía, Arquitectura, Valle Fértil)
   - *"Diseño bioclimático en zonas áridas"* (E. Silva, 2024, Tesis, Diseño, Iglesia)

---

## 5. Criterios de Aceptación (Verificación de Fase 1)
- [x] Esquema relacional `prisma/schema.prisma` creado con los 5 modelos (`Departamento`, `Usuario`, `Documento`, `Prestamo`, `Notificacion`), 5 enumerados, claves primarias UUID e índices de consulta.
- [x] Migración inicial `20261021204757_init_esquema_faud` generada y aplicada en PostgreSQL 16 (`repositorio_faud`).
- [x] Módulo global `PrismaModule` y `PrismaService` integrados en `AppModule` y `HealthService`.
- [x] Script idempotente `prisma/seed.ts` ejecutado con éxito (`pnpm run prisma:seed`): 19 departamentos, 6 usuarios iniciales y 4 documentos académicos.
- [x] Pruebas unitarias (`pnpm run test`) y End-to-End (`pnpm run test:e2e`) verificando estructura y datos en PostgreSQL.
