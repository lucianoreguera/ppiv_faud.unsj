import React from 'react';
import { Link } from 'react-router-dom';
import { FaudLogo, UnsjLogo } from '../../components/layout/Brand';

/** Introducción al Repositorio FAUD (Figma págs. 4 y 16) */
const STATS = [
  { value: '1,200+', label: 'Documentos Digitales', short: 'Docs', highlight: true },
  { value: '19', label: 'Departamentos Conectados', short: 'Dptos', highlight: false },
  { value: '100%', label: 'Acceso Seguro Protegido', short: 'Seguro', highlight: true },
];

/** Trazos de geometría arquitectónica del fondo (circunferencias y diagonales) */
const HeroGeometry: React.FC = () => (
  <svg
    aria-hidden="true"
    className="absolute inset-0 w-full h-full pointer-events-none"
    viewBox="0 0 1440 900"
    preserveAspectRatio="xMidYMid slice"
    fill="none"
  >
    <circle cx="1150" cy="450" r="320" stroke="#FFB606" strokeOpacity="0.12" strokeDasharray="8 8" />
    <circle cx="1150" cy="450" r="180" stroke="#FFB606" strokeOpacity="0.22" />
    <path d="M1005 0L1440 400" stroke="#FFB606" strokeOpacity="0.12" strokeDasharray="8 8" />
    <path d="M780 900L1440 265" stroke="#FFB606" strokeOpacity="0.12" strokeDasharray="8 8" />
  </svg>
);

export const LandingPage: React.FC = () => (
  <div className="relative min-h-screen bg-faud-hero text-white overflow-hidden flex flex-col">
    <div className="hidden lg:block">
      <HeroGeometry />
    </div>

    {/* Líneas guía del blueprint */}
    <span aria-hidden="true" className="absolute inset-y-0 left-5 lg:left-[120px] w-px bg-faud-amber/[0.12]" />
    <span aria-hidden="true" className="absolute inset-y-0 right-5 lg:right-[120px] w-px bg-faud-amber/[0.12]" />

    {/* Cabecera con logos institucionales */}
    <header className="relative h-[72px] lg:h-[89px] border-b border-faud-amber/[0.15] flex items-center justify-between pl-6 pr-4 lg:pl-[134px] lg:pr-[128px]">
      <UnsjLogo className="w-11 h-11 lg:w-16 lg:h-16" />
      <FaudLogo className="h-12 lg:h-16" />
    </header>

    {/* Hero */}
    <main className="relative flex-1 flex flex-col items-center px-6 lg:px-0 pt-14 lg:pt-[84px] text-center">
      <p className="text-[11px] lg:text-[18px] font-bold text-faud-amber uppercase tracking-normal">
        <span className="lg:hidden">Préstamo digital interdepartamental</span>
        <span className="hidden lg:inline">Sistema de Préstamo Digital Interdepartamental</span>
      </p>

      <h1 className="mt-10 lg:mt-12 text-[28px] lg:text-[48px] font-bold leading-[1.15] lg:leading-[1.3] tracking-tight">
        El conocimiento
        <br />
        académico y creativo
        <br />
        al alcance de todos.
      </h1>

      <p className="mt-10 lg:mt-12 text-caption lg:text-[16px] leading-relaxed text-white/90 lg:text-left">
        <span className="lg:hidden">
          Tesis, monografías y proyectos de investigación
          <br />
          de la Facultad de Arquitectura, Urbanismo y Diseño.
        </span>
        <span className="hidden lg:inline">
          Accedé a tesis, publicaciones, monografías y proyectos de investigación
          <br />
          de la Facultad de Arquitectura, Urbanismo y Diseño de la UNSJ.
        </span>
      </p>

      <div className="mt-12 lg:mt-8 w-full lg:w-auto flex flex-col lg:flex-row gap-3 lg:gap-5">
        <Link
          to="/catalogo"
          className="inline-flex items-center justify-center h-12 lg:h-[54px] lg:w-[220px] rounded-input bg-gradient-to-r from-faud-amber to-faud-gold-dark text-faud-ink text-body lg:text-[16px] font-bold hover:brightness-105 transition"
        >
          Explorar Catálogo →
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center justify-center h-12 lg:h-[54px] lg:w-[182px] rounded-input border-[1.5px] border-faud-amber text-white text-body lg:text-[16px] font-bold hover:bg-faud-amber/10 transition"
        >
          Iniciar Sesión
        </Link>
      </div>

      {/* Métricas de alcance */}
      <dl className="mt-auto pt-10 lg:pt-0 lg:mt-[105px] mb-6 lg:mb-6 w-full lg:w-auto grid grid-cols-3 lg:flex text-left">
        {STATS.map((stat, index) => (
          <div
            key={stat.value}
            className={`lg:px-10 ${index === 0 ? 'lg:pl-0' : 'lg:border-l lg:border-faud-amber/30'} ${
              index === 1 ? 'text-center lg:text-left' : index === 2 ? 'text-right lg:text-left' : ''
            }`}
          >
            <dt className="sr-only">{stat.label}</dt>
            <dd
              className={`text-[16px] lg:text-[32px] font-bold leading-none ${
                stat.highlight ? 'text-faud-amber' : 'text-white'
              }`}
            >
              {stat.value}
            </dd>
            <dd className="mt-1.5 lg:mt-2 text-[10px] lg:text-[13px] text-white">
              <span className="lg:hidden">{stat.short}</span>
              <span className="hidden lg:inline">{stat.label}</span>
            </dd>
          </div>
        ))}
      </dl>
    </main>

    <footer className="relative h-12 lg:h-[90px] border-t border-faud-amber/[0.15] flex items-center justify-center lg:justify-start lg:pl-[145px] text-caption lg:text-body text-faud-muted">
      Desarrollado por : DHL Solutions
    </footer>
  </div>
);
