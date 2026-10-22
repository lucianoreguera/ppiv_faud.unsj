import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BrandMark, BrandWordmark } from '../../components/layout/Brand';
import { HealthStatusBadge } from '../../components/layout/HealthStatusBadge';
import { Badge, KeywordTag, TabPill } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { PasswordField, SelectField, TextField } from '../../components/ui/FormField';
import { DEPARTAMENTOS_SAN_JUAN, VIEWER_FIXTURE } from '../../mocks/figma-fixtures';

/**
 * Página interna de verificación (no forma parte de los prototipos):
 * estado en vivo de GET /api/v1/health + catálogo de componentes del Design System (Figma págs. 20 a 24).
 */
const PALETTE = [
  { name: 'Ámbar FAUD', hex: '#FFB606', text: '#1A1A2E' },
  { name: 'Oro oscuro', hex: '#E6A303', text: '#1A1A2E' },
  { name: 'Navy profundo', hex: '#2D2D2D', text: '#FFB606' },
  { name: 'Navy medio', hex: '#16213E', text: '#FFB606' },
  { name: 'Azul arquitect.', hex: '#0F3460', text: '#FFB606' },
  { name: 'Oro hover', hex: '#FFCA28', text: '#1A1A2E' },
  { name: 'Crema cálido', hex: '#FFF9EC', text: '#2D2D2D' },
  { name: 'Ámbar claro', hex: '#FFF3D0', text: '#2D2D2D' },
  { name: 'Borde cálido', hex: '#E8DCC8', text: '#2D2D2D' },
  { name: 'Éxito / Activo', hex: '#2D6A4F', text: '#FFFFFF' },
  { name: 'Alerta / Warning', hex: '#9A5B00', text: '#FFFFFF' },
  { name: 'Error / Peligro', hex: '#B3261E', text: '#FFFFFF' },
];

const Section: React.FC<{ index: string; title: string; children: React.ReactNode }> = ({ index, title, children }) => (
  <section className="bg-white rounded-card border border-faud-border-warm p-6">
    <h2 className="flex gap-6 text-caption font-bold text-faud-amber uppercase pb-3 mb-5 border-b border-faud-amber-light">
      <span>{index}</span>
      {title}
    </h2>
    {children}
  </section>
);

export const DesignSystemPage: React.FC = () => (
  <div className="min-h-screen bg-faud-cream">
    <header className="bg-faud-dark">
      <div className="max-w-content mx-auto px-5 lg:px-10 h-navbar flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <BrandMark icon="block" className="w-8 h-8" />
          <BrandWordmark titleClassName="text-faud-text-cream text-[18px]" subtitle="Design System · Fase 0" />
        </Link>
        <HealthStatusBadge />
      </div>
    </header>

    <main className="max-w-content mx-auto px-5 lg:px-10 py-10 space-y-6">
      <Link to="/" className="inline-flex items-center gap-2 text-body text-faud-muted hover:text-faud-text">
        <ArrowLeft className="w-4 h-4" /> Volver a la portada
      </Link>

      <Section index="02" title="Paleta de colores">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {PALETTE.map((c) => (
            <div
              key={c.hex}
              className="h-20 rounded-input border border-faud-border-warm flex flex-col items-center justify-center text-center"
              style={{ backgroundColor: c.hex, color: c.text }}
            >
              <span className="text-caption font-bold">{c.name}</span>
              <span className="text-caption">{c.hex}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section index="04" title="Componentes UI">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-3">
            <Button size="lg">Acción primaria</Button>
            <Button size="lg" variant="secondary">
              Acción secundaria
            </Button>
            <Button size="lg" variant="danger">
              Revocar acceso
            </Button>
            <Button size="lg" disabled>
              Deshabilitado
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <TextField label="Correo electrónico" placeholder="nombre@ejemplo.com" />
            <PasswordField label="Contraseña" defaultValue="contraseña" />
            <SelectField
              label="Departamento"
              placeholder="Seleccionar departamento"
              options={DEPARTAMENTOS_SAN_JUAN}
              defaultValue=""
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Badge variant="success" dot>
              Disponible
            </Badge>
            <Badge variant="success">Activo · 5 días</Badge>
            <Badge variant="warning">Por vencer · 1 día</Badge>
            <Badge variant="warning" dot>
              Prestado
            </Badge>
            <Badge variant="inactive">Vencido</Badge>
            <Badge variant="alert" dot shape="square">
              Alerta
            </Badge>
            <Badge variant="danger" dot shape="square">
              Vencido
            </Badge>
            <Badge variant="visor">Vigente · 5 días</Badge>
          </div>

          <div className="flex flex-wrap gap-3">
            {['accesibilidad', 'espacio público', 'urbanismo', 'San Juan'].map((t) => (
              <KeywordTag key={t}>{t}</KeywordTag>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <TabPill active>Activos (2)</TabPill>
            <TabPill>Vencidos (1)</TabPill>
            <TabPill>Solicitados (0)</TabPill>
          </div>

          <div className="relative h-24 rounded-card border border-faud-border-warm overflow-hidden flex items-center justify-center">
            <span className="text-faud-gold-dark font-bold text-[18px] -rotate-[20deg] opacity-80">
              {VIEWER_FIXTURE.marcaAgua}
            </span>
          </div>
        </div>
      </Section>
    </main>
  </div>
);
