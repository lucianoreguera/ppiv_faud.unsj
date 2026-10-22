import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth.api';
import {
  ApiHttpError,
  AUTH_USER_STORAGE_KEY,
  clearAllDrmTokens,
  clearAuthToken,
  getAuthToken,
  setAuthToken,
} from '../api/http-client';
import { useToast } from './ToastContext';
import type { LoginDto, UserProfileResponseDto } from '../types/openapi.types';

/**
 * Sesión JWT del usuario (RF05)
 * - Persiste el token (`faud_auth_token`) y el último perfil conocido (`faud_auth_user`) en localStorage.
 * - Al iniciar la SPA revalida el perfil con GET /api/v1/auth/profile; un 401/403 cierra la sesión
 *   (token expirado, usuario eliminado o cuenta que dejó de estar APROBADO).
 * - Escucha el evento global `faud:unauthorized` emitido por http-client ante cualquier 401.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  user: UserProfileResponseDto | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (dto: LoginDto) => Promise<UserProfileResponseDto>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): UserProfileResponseDto | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserProfileResponseDto) : null;
  } catch {
    return null;
  }
}

function writeStoredUser(user: UserProfileResponseDto): void {
  try {
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Ignorar errores de almacenamiento en entornos restringidos
  }
}

/** Sesión inicial: con perfil en caché se muestra de inmediato y se revalida en segundo plano */
function readInitialSession(): { user: UserProfileResponseDto | null; status: AuthStatus } {
  if (!getAuthToken()) return { user: null, status: 'anonymous' };
  const cachedUser = readStoredUser();
  return cachedUser ? { user: cachedUser, status: 'authenticated' } : { user: null, status: 'loading' };
}

const isSessionRejected = (error: unknown) =>
  error instanceof ApiHttpError && [401, 403, 404].includes(error.status);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [session, setSession] = useState(readInitialSession);

  const clearSession = useCallback(() => {
    clearAuthToken();
    clearAllDrmTokens();
    setSession({ user: null, status: 'anonymous' });
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!getAuthToken()) {
      setSession({ user: null, status: 'anonymous' });
      return;
    }
    try {
      const profile = await authApi.getProfile();
      writeStoredUser(profile);
      setSession({ user: profile, status: 'authenticated' });
    } catch (error) {
      if (isSessionRejected(error)) {
        clearSession();
        return;
      }
      // Error de red o del servidor: se conserva el perfil en caché si existe
      setSession((prev) => (prev.user ? prev : { user: null, status: 'anonymous' }));
    }
  }, [clearSession]);

  useEffect(() => {
    if (getAuthToken()) void refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    const handleUnauthorized = () => {
      if (!getAuthToken()) return;
      clearSession();
      showToast({
        title: 'Tu sesión expiró',
        description: 'Volvé a iniciar sesión para continuar.',
        variant: 'warning',
      });
    };

    window.addEventListener('faud:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('faud:unauthorized', handleUnauthorized);
  }, [clearSession, showToast]);

  const login = useCallback(async (dto: LoginDto) => {
    const response = await authApi.login(dto);
    setAuthToken(response.accessToken);
    writeStoredUser(response.usuario);
    setSession({ user: response.usuario, status: 'authenticated' });
    return response.usuario;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session.user,
      status: session.status,
      isAuthenticated: session.status === 'authenticated',
      isAdmin: session.user?.rol === 'ADMINISTRADOR',
      login,
      logout: clearSession,
      refreshProfile,
    }),
    [session, login, clearSession, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de un <AuthProvider>');
  }
  return context;
}
