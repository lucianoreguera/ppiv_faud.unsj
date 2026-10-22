import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AUTH_USER_STORAGE_KEY, clearAllDrmTokens, clearAuthToken, getAuthToken } from '../api/http-client';
import { resolvePostLoginPath, sanitizeRedirect } from '../routes/auth-redirect';
import type { DepartmentResponseDto, LoginResponseDto, RegisterResponseDto } from '../types/openapi.types';
import { department, json, mockBackend, profile, renderAt, startSession } from './test-utils';

const DEPARTAMENTOS: DepartmentResponseDto[] = [
  department('d-capital', 'Capital', true),
  department('d-jachal', 'Jáchal'),
  department('d-valle-fertil', 'Valle Fértil'),
];

const ADMIN = profile({
  id: 'u-admin',
  nombre: 'Administrador Biblioteca FAUD',
  email: 'admin@faud.unsj.edu.ar',
  rol: 'ADMINISTRADOR',
  departamentoId: 'd-capital',
  departamento: { id: 'd-capital', nombre: 'Capital', esCapital: true },
});

describe('Fase 1 — Autenticación JWT, Registro Interdepartamental y Guardias de Rol (RF05)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    clearAuthToken();
    clearAllDrmTokens();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('Registro departamental (/registro)', () => {
    it('lista los departamentos desde la API y confirma la cuenta en estado PENDIENTE sin iniciar sesión', async () => {
      const user = userEvent.setup();
      let registerBody: unknown;
      mockBackend({
        'GET /departamentos': () => json(DEPARTAMENTOS),
        'POST /auth/register': (init) => {
          registerBody = JSON.parse(String(init.body));
          const response: RegisterResponseDto = {
            message: 'Registro exitoso. Su cuenta se encuentra PENDIENTE de validación.',
            usuario: profile({
              nombre: 'Juan Pérez',
              email: 'juan@jachal.gov.ar',
              estadoValidacion: 'PENDIENTE',
            }),
          };
          return json(response, 201);
        },
      });

      renderAt('/registro');

      const select = await screen.findByLabelText('Departamento');
      await waitFor(() => expect(select).toBeEnabled());
      const optionLabels = Array.from((select as HTMLSelectElement).options).map((o) => o.text);
      expect(optionLabels).toEqual(['Seleccioná tu departamento', 'Capital', 'Jáchal', 'Valle Fértil']);

      await user.type(screen.getByLabelText('Nombre y apellido'), 'Juan Pérez');
      await user.type(screen.getByLabelText('Correo electrónico'), 'juan@jachal.gov.ar');
      await user.selectOptions(select, 'd-jachal');
      await user.type(screen.getByLabelText('Contraseña'), 'Secreta123');
      await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      expect(
        await screen.findByText('Cuenta registrada en estado PENDIENTE de validación por Biblioteca'),
      ).toBeInTheDocument();
      expect(registerBody).toEqual({
        nombre: 'Juan Pérez',
        email: 'juan@jachal.gov.ar',
        departamentoId: 'd-jachal',
        password: 'Secreta123',
      });
      expect(screen.getByText('Jáchal')).toBeInTheDocument();
      expect(getAuthToken()).toBeNull();
    });

    it('valida los campos en el cliente y marca el email duplicado ante 409 Conflict', async () => {
      const user = userEvent.setup();
      const fetchMock = mockBackend({
        'GET /departamentos': () => json(DEPARTAMENTOS),
        'POST /auth/register': () =>
          json({ statusCode: 409, message: 'Ya existe una cuenta registrada con el correo electrónico.' }, 409),
      });

      renderAt('/registro');
      const select = await screen.findByLabelText('Departamento');
      await waitFor(() => expect(select).toBeEnabled());

      await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
      expect(screen.getByText('Ingresá tu nombre y apellido.')).toBeInTheDocument();
      expect(screen.getByText('Seleccioná tu departamento.')).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1); // solo GET /departamentos

      await user.type(screen.getByLabelText('Nombre y apellido'), 'Ana Pérez');
      await user.type(screen.getByLabelText('Correo electrónico'), 'ana.perez@jachal.gov.ar');
      await user.selectOptions(select, 'd-jachal');
      await user.type(screen.getByLabelText('Contraseña'), 'Alumno123!');
      await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      expect(
        await screen.findByText('Ya existe una cuenta registrada con este correo electrónico.'),
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Inicio de sesión (/login)', () => {
    it('muestra el banner ámbar ante 403 PENDIENTE y no abre sesión', async () => {
      const user = userEvent.setup();
      mockBackend({
        'POST /auth/login': () =>
          json(
            {
              statusCode: 403,
              message: 'Su cuenta aguarda validación por parte de la Biblioteca FAUD-UNSJ (estado: PENDIENTE).',
            },
            403,
          ),
      });

      renderAt('/login');
      await user.type(screen.getByLabelText('Correo electrónico'), 'carlos.gomez@vallefertil.gob.ar');
      await user.type(screen.getByLabelText('Contraseña'), 'Alumno123!');
      await user.click(screen.getByRole('button', { name: 'Ingresar' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Tu cuenta aguarda validación');
      expect(alert).toHaveTextContent('estado: PENDIENTE');
      expect(alert.className).toContain('bg-status-warning-bg');
      expect(window.location.pathname).toBe('/login');
      expect(getAuthToken()).toBeNull();
    });

    it('muestra el banner rojo ante 403 RECHAZADO', async () => {
      const user = userEvent.setup();
      mockBackend({
        'POST /auth/login': () =>
          json(
            {
              statusCode: 403,
              message: 'Su solicitud de cuenta fue rechazada por la Biblioteca FAUD-UNSJ (estado: RECHAZADO).',
            },
            403,
          ),
      });

      renderAt('/login');
      await user.type(screen.getByLabelText('Correo electrónico'), 'rechazado@iglesia.gob.ar');
      await user.type(screen.getByLabelText('Contraseña'), 'Alumno123!');
      await user.click(screen.getByRole('button', { name: 'Ingresar' }));

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('Solicitud de cuenta rechazada');
      expect(alert.className).toContain('bg-status-danger-bg');
    });

    it('inicia sesión con una cuenta APROBADO y vuelve a la ruta indicada en ?redirect=', async () => {
      const user = userEvent.setup();
      const loginResponse: LoginResponseDto = {
        accessToken: 'jwt-ana',
        tokenType: 'Bearer',
        expiresIn: '8h',
        usuario: profile(),
      };
      mockBackend({ 'POST /auth/login': () => json(loginResponse) });

      renderAt('/login?redirect=%2Fmis-prestamos');
      expect(screen.getByText('Iniciá sesión para continuar')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Ana Pérez · Jáchal' }));
      expect(screen.getByLabelText('Correo electrónico')).toHaveValue('ana.perez@jachal.gov.ar');
      await user.click(screen.getByRole('button', { name: 'Ingresar' }));

      await waitFor(() => expect(window.location.pathname).toBe('/mis-prestamos'));
      expect(getAuthToken()).toBe('jwt-ana');
      expect(JSON.parse(localStorage.getItem(AUTH_USER_STORAGE_KEY)!)).toMatchObject({ nombre: 'Ana Pérez' });
    });

    it('redirige al panel de Biblioteca cuando inicia sesión un ADMINISTRADOR', async () => {
      const user = userEvent.setup();
      mockBackend({
        'POST /auth/login': () =>
          json({ accessToken: 'jwt-admin', tokenType: 'Bearer', expiresIn: '8h', usuario: ADMIN }),
      });

      renderAt('/login');
      await user.click(screen.getByRole('button', { name: 'Admin Biblioteca' }));
      await user.click(screen.getByRole('button', { name: 'Ingresar' }));

      await waitFor(() => expect(window.location.pathname).toBe('/admin'));
      // La navegación corre en startTransition: la URL cambia antes de que se pinte el panel
      expect(await screen.findByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    });
  });

  describe('Guardias de navegación (ProtectedRoute / RoleGuard / GuestRoute)', () => {
    it('redirige a /login preservando el destino cuando no hay sesión', async () => {
      mockBackend({});
      renderAt('/mis-prestamos');

      await waitFor(() => expect(window.location.pathname).toBe('/login'));
      expect(window.location.search).toBe('?redirect=%2Fmis-prestamos');
    });

    it('bloquea /admin/* para el rol USUARIO', async () => {
      startSession(profile());
      mockBackend({ 'GET /auth/profile': () => json(profile()) });

      renderAt('/admin/usuarios');

      expect(await screen.findByRole('heading', { name: 'Acceso restringido' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/catalogo');
    });

    it('cierra la sesión si GET /auth/profile responde 403 (cuenta que dejó de estar APROBADO)', async () => {
      startSession(profile());
      mockBackend({
        'GET /auth/profile': () =>
          json({ statusCode: 403, message: 'Su cuenta no se encuentra habilitada (estado actual: RECHAZADO).' }, 403),
      });

      renderAt('/mis-prestamos');

      await waitFor(() => expect(window.location.pathname).toBe('/login'));
      expect(getAuthToken()).toBeNull();
    });

    it('muestra la sesión real en la barra y permite cerrarla', async () => {
      const user = userEvent.setup();
      startSession(profile());
      mockBackend({ 'GET /auth/profile': () => json(profile()) });

      renderAt('/catalogo');

      expect(screen.getByText('Ana Pérez · Jáchal')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

      await waitFor(() => expect(window.location.pathname).toBe('/login'));
      expect(getAuthToken()).toBeNull();
    });

    it('envía a un usuario autenticado fuera de /login hacia su inicio', async () => {
      startSession(ADMIN);
      mockBackend({ 'GET /auth/profile': () => json(ADMIN) });

      renderAt('/login');

      await waitFor(() => expect(window.location.pathname).toBe('/admin'));
    });
  });

  describe('Saneamiento del parámetro ?redirect=', () => {
    it('acepta solo rutas internas y respeta el rol', () => {
      expect(sanitizeRedirect('/documentos/abc?x=1')).toBe('/documentos/abc?x=1');
      expect(sanitizeRedirect('https://malicioso.com')).toBeNull();
      expect(sanitizeRedirect('//malicioso.com')).toBeNull();
      expect(sanitizeRedirect('/\\malicioso.com')).toBeNull();
      expect(sanitizeRedirect('/login')).toBeNull();
      expect(resolvePostLoginPath('USUARIO', '/admin/usuarios')).toBe('/catalogo');
      expect(resolvePostLoginPath('ADMINISTRADOR', '/admin/usuarios')).toBe('/admin/usuarios');
      expect(resolvePostLoginPath('ADMINISTRADOR', null)).toBe('/admin');
    });
  });
});
