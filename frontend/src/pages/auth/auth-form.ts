import { ApiHttpError } from '../../api/http-client';
import type { AlertVariant } from '../../components/ui/Alert';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface FormAlert {
  variant: AlertVariant;
  title: string;
  message: string;
}

/**
 * Traduce los errores del Backend en el banner del formulario de acceso (Spec FE-01):
 * 403 PENDIENTE (ámbar) · 403 RECHAZADO (rojo) · 401 credenciales · 429 Retry-After · red.
 */
export function describeAuthError(error: unknown): FormAlert {
  if (!(error instanceof ApiHttpError)) {
    return {
      variant: 'danger',
      title: 'Ocurrió un error inesperado',
      message: 'Intentá nuevamente en unos instantes.',
    };
  }

  switch (error.code) {
    case 'ACCOUNT_PENDING':
      return {
        variant: 'warning',
        title: 'Tu cuenta aguarda validación',
        message: `${error.message} Te avisaremos por correo cuando la Biblioteca FAUD-UNSJ apruebe tu cuenta.`,
      };
    case 'ACCOUNT_REJECTED':
      return {
        variant: 'danger',
        title: 'Solicitud de cuenta rechazada',
        message: `${error.message} Comunicate con la Biblioteca FAUD-UNSJ para más información.`,
      };
    case 'UNAUTHORIZED':
      return { variant: 'danger', title: 'No pudimos iniciar sesión', message: error.message };
    case 'RATE_LIMITED':
      return { variant: 'warning', title: 'Demasiados intentos', message: error.message };
    case 'VALIDATION_ERROR':
      return { variant: 'danger', title: 'Revisá los datos ingresados', message: error.message };
    case 'NETWORK_ERROR':
      return {
        variant: 'danger',
        title: 'Sin conexión con el servidor',
        message: 'No pudimos comunicarnos con el Repositorio FAUD. Verificá tu conexión e intentá nuevamente.',
      };
    default:
      return { variant: 'danger', title: 'No pudimos completar la operación', message: error.message };
  }
}
