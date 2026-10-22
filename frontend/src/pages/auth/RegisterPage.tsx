import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { departmentsApi } from '../../api/departments.api';
import { authApi } from '../../api/auth.api';
import { ApiHttpError } from '../../api/http-client';
import { AuthSplitLayout } from '../../components/layout/AuthSplitLayout';
import { Alert } from '../../components/ui/Alert';
import { UserStatusBadge } from '../../components/ui/Badge';
import { Button, buttonClasses } from '../../components/ui/Button';
import { SelectField, TextField, type SelectOption } from '../../components/ui/FormField';
import { InfoDot } from '../../components/ui/Decorations';
import type { RegisterDto, UserProfileResponseDto } from '../../types/openapi.types';
import { describeAuthError, EMAIL_PATTERN, type FormAlert } from './auth-form';

type RegisterFieldErrors = Partial<Record<keyof RegisterDto, string>>;

const EMPTY_FORM: RegisterDto = { nombre: '', email: '', departamentoId: '', password: '' };

/** Reglas alineadas con RegisterDto del Backend (la contraseña sigue el mínimo de 8 del prototipo) */
function validate(form: RegisterDto): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};
  const nombre = form.nombre.trim();
  if (!nombre) errors.nombre = 'Ingresá tu nombre y apellido.';
  else if (nombre.length < 2) errors.nombre = 'El nombre debe tener al menos 2 caracteres.';
  else if (nombre.length > 120) errors.nombre = 'El nombre no puede superar los 120 caracteres.';

  if (!form.email.trim()) errors.email = 'Ingresá tu correo electrónico.';
  else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Ingresá un correo electrónico válido.';

  if (!form.departamentoId) errors.departamentoId = 'Seleccioná tu departamento.';

  if (!form.password) errors.password = 'Ingresá una contraseña.';
  else if (form.password.length < 8) errors.password = 'La contraseña debe tener al menos 8 caracteres.';
  else if (form.password.length > 100) errors.password = 'La contraseña no puede superar los 100 caracteres.';

  return errors;
}

interface DepartmentsState {
  status: 'loading' | 'ready' | 'error';
  options: SelectOption[];
}

/** Confirmación tras POST /api/v1/auth/register: la cuenta nace PENDIENTE y no se inicia sesión (Spec FE-01) */
const RegistrationConfirmation: React.FC<{ usuario: UserProfileResponseDto }> = ({ usuario }) => (
  <div>
    <MailCheck className="w-10 h-10 text-faud-gold-dark" strokeWidth={1.75} />
    <h1 className="mt-4 text-[22px] lg:text-[32px] font-bold text-faud-navy-mid leading-tight">
      ¡Cuenta creada!
    </h1>
    <Alert variant="warning" title="Cuenta registrada en estado PENDIENTE de validación por Biblioteca" className="mt-5">
      La Biblioteca FAUD-UNSJ revisará tu solicitud según tu departamento. Te avisamos por correo cuando esté
      aprobada para que puedas iniciar sesión.
    </Alert>

    <dl className="mt-6 rounded-input border border-faud-border-warm bg-white divide-y divide-faud-border-warm text-body">
      {[
        { label: 'Nombre', value: usuario.nombre },
        { label: 'Correo', value: usuario.email },
        { label: 'Departamento', value: usuario.departamento.nombre },
      ].map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-faud-muted">{row.label}</dt>
          <dd className="font-bold text-faud-text text-right break-all">{row.value}</dd>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <dt className="text-faud-muted">Estado</dt>
        <dd>
          <UserStatusBadge estado={usuario.estadoValidacion} />
        </dd>
      </div>
    </dl>

    <Link to="/login" className={buttonClasses('primary', 'lg', 'mt-7 w-full rounded-input text-[16px]')}>
      Ir a iniciar sesión
    </Link>
    <Link to="/catalogo" className="block mt-4 text-center text-caption lg:text-body font-bold text-faud-gold-dark hover:underline">
      Explorar el catálogo mientras tanto
    </Link>
  </div>
);

/** Crear cuenta (Figma págs. 6 y 16) — GET /api/v1/departamentos + POST /api/v1/auth/register (RF05) */
export const RegisterPage: React.FC = () => {
  const [form, setForm] = useState<RegisterDto>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({});
  const [formAlert, setFormAlert] = useState<FormAlert | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registeredUser, setRegisteredUser] = useState<UserProfileResponseDto | null>(null);
  const [departments, setDepartments] = useState<DepartmentsState>({ status: 'loading', options: [] });

  const loadDepartments = useCallback((signal?: AbortSignal) => {
    setDepartments({ status: 'loading', options: [] });
    departmentsApi
      .list()
      .then((items) => {
        if (signal?.aborted) return;
        setDepartments({
          status: 'ready',
          options: items.map((d) => ({ value: d.id, label: d.nombre })),
        });
      })
      .catch(() => {
        if (signal?.aborted) return;
        setDepartments({ status: 'error', options: [] });
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadDepartments(controller.signal);
    return () => controller.abort();
  }, [loadDepartments]);

  const updateField = (field: keyof RegisterDto) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormAlert(null);
    setSubmitting(true);
    try {
      const response = await authApi.register({
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        departamentoId: form.departamentoId,
        password: form.password,
      });
      setRegisteredUser(response.usuario);
    } catch (error) {
      if (error instanceof ApiHttpError && error.code === 'CONFLICT') {
        setFieldErrors({ email: 'Ya existe una cuenta registrada con este correo electrónico.' });
      } else {
        setFormAlert(describeAuthError(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (registeredUser) {
    return (
      <AuthSplitLayout variant="register">
        <RegistrationConfirmation usuario={registeredUser} />
      </AuthSplitLayout>
    );
  }

  const departmentPlaceholder =
    departments.status === 'loading'
      ? 'Cargando departamentos…'
      : departments.status === 'error'
        ? 'No se pudieron cargar los departamentos'
        : 'Seleccioná tu departamento';

  return (
    <AuthSplitLayout variant="register">
      <h1 className="text-[22px] lg:text-[32px] font-bold text-faud-navy-mid leading-tight">
        Crear cuenta
      </h1>

      {formAlert && (
        <Alert variant={formAlert.variant} title={formAlert.title} className="mt-5">
          {formAlert.message}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="mt-5 lg:mt-8 space-y-3 lg:space-y-4" noValidate>
        <TextField
          label="Nombre y apellido"
          name="nombre"
          autoComplete="name"
          placeholder="Juan Pérez"
          className="lg:h-12"
          value={form.nombre}
          error={fieldErrors.nombre}
          onChange={updateField('nombre')}
        />
        <TextField
          label="Correo electrónico"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="juan@faud.unsj.edu.ar"
          className="lg:h-12"
          value={form.email}
          error={fieldErrors.email}
          onChange={updateField('email')}
        />
        <div>
          <SelectField
            label="Departamento"
            name="departamentoId"
            placeholder={departmentPlaceholder}
            options={departments.options}
            disabled={departments.status !== 'ready'}
            className="lg:h-12"
            value={form.departamentoId}
            error={fieldErrors.departamentoId}
            onChange={updateField('departamentoId')}
          />
          {departments.status === 'error' && (
            <button
              type="button"
              onClick={() => loadDepartments()}
              className="mt-1.5 text-caption font-bold text-faud-gold-dark hover:underline"
            >
              Reintentar
            </button>
          )}
        </div>
        <TextField
          label="Contraseña"
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          className="lg:h-12"
          value={form.password}
          error={fieldErrors.password}
          onChange={updateField('password')}
        />

        <div className="!mt-5 lg:!mt-7 flex items-start gap-3 rounded-input border border-faud-amber/50 bg-faud-cream px-3 lg:px-4 py-3 lg:py-4 text-caption lg:text-[13px] leading-relaxed text-status-warning">
          <InfoDot tone="outline" className="hidden lg:inline-flex mt-0.5" />
          <p className="pl-6 lg:pl-0">
            <span className="lg:hidden">Validaremos tu cuenta.</span>
            <span className="hidden lg:inline">Validaremos tu cuenta según tu departamento.</span>
            <br />
            Te avisamos por correo cuando esté aprobada.
          </p>
        </div>

        <Button
          type="submit"
          size="lg"
          fullWidth
          isLoading={submitting}
          className="!mt-5 lg:!mt-7 rounded-input text-[16px]"
        >
          Crear cuenta
        </Button>
      </form>

      <p className="mt-5 lg:mt-6 text-center text-caption lg:text-body text-faud-muted">
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="font-bold text-faud-gold-dark hover:underline">
          Iniciá sesión
        </Link>
      </p>
    </AuthSplitLayout>
  );
};
