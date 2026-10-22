import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { AUTH_USER_STORAGE_KEY, setAuthToken } from '../api/http-client';
import { App } from '../App';
import type { DepartmentResponseDto, UserProfileResponseDto } from '../types/openapi.types';

// ============================================================================
// Fixtures alineadas con backend/prisma/seed.ts
// ============================================================================

export const department = (id: string, nombre: string, esCapital = false, totalDocumentos = 0): DepartmentResponseDto => ({
  id,
  nombre,
  esCapital,
  totalUsuarios: 0,
  usuariosAprobados: 0,
  usuariosPendientes: 0,
  totalDocumentos,
});

export const profile = (overrides: Partial<UserProfileResponseDto> = {}): UserProfileResponseDto => ({
  id: 'u-ana',
  nombre: 'Ana Pérez',
  email: 'ana.perez@jachal.gov.ar',
  rol: 'USUARIO',
  estadoValidacion: 'APROBADO',
  departamentoId: 'd-jachal',
  departamento: { id: 'd-jachal', nombre: 'Jáchal', esCapital: false },
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
  ...overrides,
});

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export type RouteHandler = (init: RequestInit, url: URL) => Response;

/** Simula el Backend respondiendo por "MÉTODO /ruta" (sin el prefijo /api/v1 ni la query) */
export function mockBackend(routes: Record<string, RouteHandler>) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const key = `${init.method ?? 'GET'} ${path}`;
    const handler = routes[key];
    if (!handler) return Promise.resolve(json({ statusCode: 404, message: `Sin mock para ${key}` }, 404));
    return Promise.resolve(handler(init, url));
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

/** URLs solicitadas a un endpoint (incluida la query) */
export function requestedUrls(fetchMock: ReturnType<typeof mockBackend>, path: string): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input)))
    .filter((url) => url.pathname.replace(/^\/api\/v1/, '') === path);
}

export const renderAt = (path: string) => {
  window.history.pushState({}, '', path);
  return render(<App />);
};

export const startSession = (user: UserProfileResponseDto) => {
  setAuthToken(`jwt-${user.id}`);
  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
};
