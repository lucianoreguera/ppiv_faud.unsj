import React from 'react';

/**
 * Vista reservada para pantallas que no forman parte de los prototipos Figma
 * (Panel de inicio del admin, Bandeja de notificaciones). Se diseñan en su fase.
 */
export interface PhasePlaceholderPageProps {
  title: string;
  phaseLabel: string;
  description: string;
  endpoints: string[];
  /** Cuando se renderiza dentro de UserLayout necesita márgenes propios */
  padded?: boolean;
}

export const PhasePlaceholderPage: React.FC<PhasePlaceholderPageProps> = ({
  title,
  phaseLabel,
  description,
  endpoints,
  padded = false,
}) => (
  <div className={padded ? 'max-w-[1240px] mx-auto px-5 lg:px-10 pt-6 lg:pt-12 pb-12' : ''}>
    <h1 className="text-[22px] lg:text-[32px] font-bold text-faud-ink leading-tight">{title}</h1>
    <div className="relative h-px bg-faud-border-warm mt-3 lg:mt-7">
      <span className="absolute left-0 -top-px h-[3px] w-10 bg-faud-amber" />
    </div>

    <section className="mt-8 max-w-2xl bg-white rounded-card border border-faud-border-warm p-6 lg:p-8">
      <span className="inline-flex items-center h-6 px-2.5 rounded-badge bg-faud-amber-light text-status-warning text-caption font-bold">
        {phaseLabel}
      </span>
      <p className="mt-4 text-body text-faud-muted leading-relaxed">{description}</p>
      <ul className="mt-5 space-y-2">
        {endpoints.map((endpoint) => (
          <li
            key={endpoint}
            className="font-mono text-caption text-faud-text bg-faud-cream border border-faud-border-warm rounded-input px-3 py-2"
          >
            {endpoint}
          </li>
        ))}
      </ul>
    </section>
  </div>
);
