-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('USUARIO', 'ADMINISTRADOR');

-- CreateEnum
CREATE TYPE "EstadoValidacionUsuario" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('TESIS', 'MONOGRAFIA', 'INVESTIGACION', 'OTROS');

-- CreateEnum
CREATE TYPE "EstadoPrestamo" AS ENUM ('SOLICITADO', 'ACTIVO', 'RECHAZADO', 'VENCIDO', 'REVOCADO', 'CERRADO');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('CUENTA_APROBADA', 'PRESTAMO_OTORGADO', 'PROXIMO_VENCIMIENTO_24H', 'PRESTAMO_VENCIDO', 'PRESTAMO_REVOCADO');

-- CreateTable
CREATE TABLE "departamentos" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "es_capital" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "departamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'USUARIO',
    "estado_validacion" "EstadoValidacionUsuario" NOT NULL DEFAULT 'PENDIENTE',
    "departamento_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "director" TEXT,
    "carrera" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "anio" INTEGER NOT NULL,
    "resumen" TEXT NOT NULL,
    "palabras_clave" TEXT[],
    "archivo_url" TEXT NOT NULL,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "departamento_origen_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prestamos" (
    "id" UUID NOT NULL,
    "codigo_referencia" SERIAL NOT NULL,
    "usuario_id" UUID NOT NULL,
    "documento_id" UUID NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_vencimiento" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoPrestamo" NOT NULL DEFAULT 'SOLICITADO',
    "token_acceso" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prestamos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" UUID NOT NULL,
    "prestamo_id" UUID NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "mensaje" TEXT,
    "fecha_envio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leida" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departamentos_nombre_key" ON "departamentos"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_departamento_id_idx" ON "usuarios"("departamento_id");

-- CreateIndex
CREATE INDEX "usuarios_estado_validacion_idx" ON "usuarios"("estado_validacion");

-- CreateIndex
CREATE INDEX "documentos_tipo_idx" ON "documentos"("tipo");

-- CreateIndex
CREATE INDEX "documentos_carrera_idx" ON "documentos"("carrera");

-- CreateIndex
CREATE INDEX "documentos_anio_idx" ON "documentos"("anio");

-- CreateIndex
CREATE INDEX "documentos_disponible_idx" ON "documentos"("disponible");

-- CreateIndex
CREATE INDEX "prestamos_usuario_id_idx" ON "prestamos"("usuario_id");

-- CreateIndex
CREATE INDEX "prestamos_documento_id_idx" ON "prestamos"("documento_id");

-- CreateIndex
CREATE INDEX "prestamos_estado_idx" ON "prestamos"("estado");

-- CreateIndex
CREATE INDEX "prestamos_fecha_vencimiento_idx" ON "prestamos"("fecha_vencimiento");

-- CreateIndex
CREATE INDEX "notificaciones_prestamo_id_idx" ON "notificaciones"("prestamo_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_departamento_id_fkey" FOREIGN KEY ("departamento_id") REFERENCES "departamentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_departamento_origen_id_fkey" FOREIGN KEY ("departamento_origen_id") REFERENCES "departamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prestamos" ADD CONSTRAINT "prestamos_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documentos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_prestamo_id_fkey" FOREIGN KEY ("prestamo_id") REFERENCES "prestamos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
