import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
  ApiHttpError,
  clearAllDrmTokens,
  clearAuthToken,
  extractDrmHeaders,
  httpClient,
  setAuthToken,
  setDrmToken,
} from '../api/http-client';
import { App } from '../App';
import type { HealthResponseDto } from '../types/openapi.types';

describe('Fase 0 — Cliente HTTP Tipado, Tokens DRM y Layout Institucional FAUD-UNSJ', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearAuthToken();
    clearAllDrmTokens();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('inyecta automáticamente Authorization Bearer y x-drm-token en las peticiones', async () => {
    setAuthToken('jwt-sesion-123');
    setDrmToken('prestamo-1024', 'jwt-drm-7d-abc');

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock;

    await httpClient.get('/prestamos/prestamo-1024/visor', {
      prestamoId: 'prestamo-1024',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(requestInit.headers);

    expect(headers.get('Authorization')).toBe('Bearer jwt-sesion-123');
    expect(headers.get('x-drm-token')).toBe('jwt-drm-7d-abc');
  });

  it('extrae correctamente las cabeceras DRM expuestas por CORS (X-DRM-Watermark, X-DRM-Loan-Code)', () => {
    const headers = new Headers({
      'X-DRM-Loan-Id': 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      'X-DRM-Loan-Code': '#1024',
      'X-DRM-Watermark': 'Ana Pérez · Préstamo #1024',
      'X-DRM-Remaining-Days': '7',
      'X-DRM-Remaining-Hours': '168',
      'X-DRM-Por-Vencer-24h': 'false',
      'X-DRM-Allow-Download': 'false',
      'X-DRM-Allow-Print': 'false',
      'X-DRM-Allow-Copy': 'false',
    });

    const drmMeta = extractDrmHeaders(headers);

    expect(drmMeta.loanCode).toBe('#1024');
    expect(drmMeta.watermark).toBe('Ana Pérez · Préstamo #1024');
    expect(drmMeta.remainingDays).toBe(7);
    expect(drmMeta.allowDownload).toBe(false);
    expect(drmMeta.allowPrint).toBe(false);
  });

  it('clasifica errores HTTP 403 (PENDIENTE / DRM_BLOCKED) y 429 (Retry-After)', async () => {
    // 1. Cuenta PENDIENTE (403)
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 403,
          message: 'Su cuenta se encuentra PENDIENTE de validación por Biblioteca FAUD-UNSJ.',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(httpClient.post('/auth/login', {})).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_PENDING',
    });

    // 2. Bloqueo DRM por préstamo vencido o revocado (403)
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 403,
          message: 'El préstamo ha vencido o fue revocado',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(httpClient.get('/prestamos/1024/visor')).rejects.toMatchObject({
      status: 403,
      code: 'DRM_BLOCKED',
    });

    // 3. Rate Limit excedido (429 con Retry-After)
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 429,
          message: 'Too Many Requests',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '45',
          },
        },
      ),
    );

    try {
      await httpClient.post('/auth/login', {});
    } catch (error) {
      expect(error).toBeInstanceOf(ApiHttpError);
      const apiErr = error as ApiHttpError;
      expect(apiErr.status).toBe(429);
      expect(apiErr.code).toBe('RATE_LIMITED');
      expect(apiErr.retryAfterSeconds).toBe(45);
    }
  });

  it('renderiza la portada del Repositorio FAUD según el prototipo Figma (pág. 4)', () => {
    window.history.pushState({}, '', '/');
    render(<App />);

    expect(
      screen.getAllByText(/Sistema de Préstamo Digital Interdepartamental/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/académico y creativo/i);
    expect(screen.getByRole('link', { name: /Explorar Catálogo/i })).toHaveAttribute('href', '/catalogo');
    expect(screen.getByRole('link', { name: /Iniciar Sesión/i })).toHaveAttribute('href', '/login');
    expect(screen.getByText(/Desarrollado por : DHL Solutions/i)).toBeInTheDocument();
  });

  it('muestra el estado en vivo de GET /api/v1/health en la página del Design System', async () => {
    const mockHealth: HealthResponseDto = {
      status: 'ok',
      service: 'Sistema de Préstamo Digital Interdepartamental — FAUD-UNSJ',
      version: '0.1.0',
      environment: 'development',
      timestamp: '2026-10-22T12:00:00.000Z',
      uptimeSeconds: 120,
      database: {
        status: 'up',
        latencyMs: 4,
      },
    };

    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(mockHealth), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    window.history.pushState({}, '', '/design-system');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/API Online · DB 4ms/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Ana Pérez · Préstamo #1024')).toBeInTheDocument();
  });
});
