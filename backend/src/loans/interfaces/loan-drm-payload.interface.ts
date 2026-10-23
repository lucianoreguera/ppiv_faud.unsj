import { TipoDocumento } from '@prisma/client';

/**
 * Payload firmado dentro del token JWT de acceso temporal DRM (7 días - RF03, RF04, RNF02).
 * Se firma con un secreto dedicado (`LOAN_DRM_JWT_SECRET`) distinto al secreto de sesión.
 */
export interface LoanDrmJwtPayload {
  /** UUID del usuario prestatario */
  sub: string;
  /** UUID del préstamo en PostgreSQL */
  prestamoId: string;
  /** UUID del documento académico autorizado */
  documentoId: string;
  /** Alias corto del documento para compatibilidad con el Diagrama de Secuencia */
  docId: string;
  /** Código numérico correlativo del préstamo (ej. 1024) */
  codigoReferencia: number;
  /** Texto precalculado para la marca de agua dinámica del visor (Figma pág. 14) */
  marcaAgua: string;
  /** Identificador de propósito del token */
  type: 'LOAN_DRM_7D';
  iat?: number;
  exp?: number;
}

/**
 * Resultado de la doble verificación DRM (Token JWT + Estado ACTIVO y vigencia en PostgreSQL).
 */
export interface ValidatedDrmAccess {
  prestamoId: string;
  codigoReferencia: number;
  codigoFormateado: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioEmail: string;
  departamentoNombre: string;
  documentoId: string;
  documentoTitulo: string;
  documentoAutor: string;
  documentoCarrera: string;
  documentoTipo: TipoDocumento;
  documentoAnio: number;
  archivoUrl: string;
  fechaInicio: Date;
  fechaVencimiento: Date;
  diasRestantes: number;
  horasRestantes: number;
  segundosRestantes: number;
  porVencer24h: boolean;
  marcaAgua: string;
}
