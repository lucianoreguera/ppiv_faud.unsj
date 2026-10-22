import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthSplitLayout } from '../../components/layout/AuthSplitLayout';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PasswordField, TextField } from '../../components/ui/FormField';
import { useAuth } from '../../context/AuthContext';
import { describeAuthError, EMAIL_PATTERN, type FormAlert } from './auth-form';

/**
 * Cuentas del seed del Backend (backend/prisma/seed.ts) para agilizar pruebas y la defensa del proyecto.
 * Visibles en desarrollo o con VITE_SHOW_DEMO_ACCOUNTS=true.
 */
const DEMO_ACCOUNTS = [
  { label: 'Admin Biblioteca', email: 'admin@faud.unsj.edu.ar', password: 'Admin123!' },
  { label: 'Ana Pérez · Jáchal', email: 'ana.perez@jachal.gov.ar', password: 'Alumno123!' },
  { label: 'Carlos Gómez · Valle Fértil (pendiente)', email: 'carlos.gomez@vallefertil.gob.ar', password: 'Alumno123!' },
] as const;

const SHOW_DEMO_ACCOUNTS = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === 'true';

interface LoginFieldErrors {
  email?: string;
  password?: string;
}

function validate(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  if (!email.trim()) errors.email = 'Ingresá tu correo electrónico.';
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Ingresá un correo electrónico válido.';
  if (!password) errors.password = 'Ingresá tu contraseña.';
  return errors;
}

/**
 * Iniciar sesión (Figma págs. 5 y 16) — POST /api/v1/auth/login (RF05)
 * La redirección posterior (?redirect= o inicio según rol) la resuelve GuestRoute al activarse la sesión.
 */
export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [formAlert, setFormAlert] = useState<FormAlert | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors = validate(email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormAlert(null);
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
    } catch (error) {
      setFormAlert(describeAuthError(error));
      setSubmitting(false);
    }
  };

  const fillDemoAccount = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(account.email);
    setPassword(account.password);
    setFieldErrors({});
    setFormAlert(null);
  };

  return (
    <AuthSplitLayout variant="login">
      <h1 className="text-[22px] lg:text-[32px] font-bold text-faud-navy-mid leading-tight">
        Iniciar sesión
      </h1>
      <p className="text-caption lg:text-[15px] text-faud-muted mt-1 lg:mt-2">
        <span className="lg:hidden">Accedé para solicitar préstamos.</span>
        <span className="hidden lg:inline">Accedé para solicitar y leer préstamos digitales.</span>
      </p>

      {searchParams.get('redirect') && !formAlert && (
        <Alert variant="info" title="Iniciá sesión para continuar" className="mt-6">
          La sección que intentaste abrir requiere una cuenta aprobada.
        </Alert>
      )}

      {formAlert && (
        <Alert variant={formAlert.variant} title={formAlert.title} className="mt-6">
          {formAlert.message}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="mt-7 lg:mt-8" noValidate>
        <TextField
          label="Correo electrónico"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="ejemplo@faud.unsj.edu.ar"
          className="lg:h-12"
          value={email}
          error={fieldErrors.email}
          onChange={(e) => {
            setEmail(e.target.value);
            setFieldErrors((prev) => ({ ...prev, email: undefined }));
          }}
        />
        <PasswordField
          label="Contraseña"
          name="password"
          autoComplete="current-password"
          placeholder="••••••"
          wrapperClassName="mt-5"
          className="lg:h-12"
          value={password}
          error={fieldErrors.password}
          onChange={(e) => {
            setPassword(e.target.value);
            setFieldErrors((prev) => ({ ...prev, password: undefined }));
          }}
        />
        <div className="mt-3 text-center">
          <Link to="/login" className="text-caption lg:text-body font-bold text-faud-gold-dark hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <Button
          type="submit"
          size="lg"
          fullWidth
          isLoading={submitting}
          className="mt-7 lg:mt-8 rounded-input text-[16px]"
        >
          Ingresar
        </Button>
      </form>

      <p className="mt-6 lg:mt-9 text-center text-caption lg:text-body text-faud-muted">
        ¿No tenés cuenta?{' '}
        <Link to="/registro" className="font-bold text-faud-gold-dark hover:underline">
          Registrate
        </Link>
      </p>

      {SHOW_DEMO_ACCOUNTS && (
        <section aria-labelledby="demo-accounts-title" className="mt-6 pt-5 border-t border-faud-border-warm">
          <h2 id="demo-accounts-title" className="text-overline uppercase text-faud-muted text-center">
            Accesos de demostración
          </h2>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillDemoAccount(account)}
                className="h-8 px-3 rounded-tag border border-faud-border-warm bg-white text-caption text-faud-text hover:border-faud-amber hover:bg-faud-amber-light transition-colors"
              >
                {account.label}
              </button>
            ))}
          </div>
        </section>
      )}
    </AuthSplitLayout>
  );
};
