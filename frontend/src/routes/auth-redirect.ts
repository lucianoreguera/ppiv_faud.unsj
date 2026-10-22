import type { RolUsuario } from '../types/openapi.types';

/** Pantalla de inicio de cada rol luego de iniciar sesión */
export function getHomePathForRole(rol: RolUsuario): string {
  return rol === 'ADMINISTRADOR' ? '/admin' : '/catalogo';
}

/**
 * Valida el parámetro `?redirect=` para evitar redirecciones abiertas:
 * solo se aceptan rutas internas de la SPA (empiezan con "/" pero no con "//" ni "/\").
 */
export function sanitizeRedirect(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;
  if (raw.startsWith('/login') || raw.startsWith('/registro')) return null;
  return raw;
}

/** Destino tras el login: la ruta solicitada si el rol puede verla, o la pantalla de inicio del rol */
export function resolvePostLoginPath(rol: RolUsuario, rawRedirect: string | null | undefined): string {
  const redirect = sanitizeRedirect(rawRedirect);
  if (!redirect) return getHomePathForRole(rol);
  if (redirect.startsWith('/admin') && rol !== 'ADMINISTRADOR') return getHomePathForRole(rol);
  return redirect;
}

export function buildLoginPath(targetPath: string): string {
  return `/login?redirect=${encodeURIComponent(targetPath)}`;
}
