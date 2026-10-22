/**
 * Datos de ejemplo tomados literalmente de los prototipos Figma
 * (documentación/Presentacion_Prototipos_Figma_Segunda_Etapa_DHL_Solutions.pdf).
 *
 * Alimentan las vistas en la Fase 0 para validar el diseño. Cada fase posterior
 * reemplaza su porción por la respuesta real del Backend (docs/specs/openapi.json).
 */
import type { TipoDocumento } from '../types/openapi.types';

export const DEPARTAMENTOS_SAN_JUAN = [
  'Albardón',
  'Angaco',
  'Calingasta',
  'Capital',
  'Caucete',
  'Chimbas',
  'Iglesia',
  'Jáchal',
  '9 de Julio',
  'Pocito',
  'Rawson',
  'Rivadavia',
  'San Martín',
  'Santa Lucía',
  'Sarmiento',
  'Ullum',
  'Valle Fértil',
  '25 de Mayo',
  'Zonda',
] as const;

export const CARRERAS = ['Arquitectura', 'Diseño', 'Urbanismo'] as const;

export const TIPOS_DOCUMENTO_FORM = [
  'Tesis de Grado',
  'Monografía',
  'Investigación',
  'Otros',
] as const;

/** Usuaria de la sesión de ejemplo en las vistas del alumno (Figma págs. 11 a 14) */
export const SESSION_USER = {
  nombre: 'Ana Pérez',
  iniciales: 'AP',
  departamento: 'Jáchal',
};

export interface CatalogDocumentFixture {
  id: string;
  titulo: string;
  subtitulo?: string;
  tipo: TipoDocumento;
  tipoLabelLargo: string;
  carrera: string;
  autorCorto: string;
  autor: string;
  anio: number;
  departamento: string;
  disponible: boolean;
  director?: string;
  resumen?: string;
  palabrasClave?: string[];
  idioma?: string;
  formato?: string;
}

export const CATALOG_DOCUMENTS: CatalogDocumentFixture[] = [
  {
    id: 'accesibilidad-urbana-san-juan',
    titulo: 'Accesibilidad urbana en San Juan',
    subtitulo: 'Análisis de barreras arquitectónicas en el microcentro',
    tipo: 'TESIS',
    tipoLabelLargo: 'Tesis de Grado',
    carrera: 'Arquitectura',
    autorCorto: 'M. González',
    autor: 'Martín González',
    anio: 2023,
    departamento: 'Capital',
    disponible: true,
    director: 'Arq. Laura Estévez',
    resumen:
      'El presente trabajo final de grado analiza las condiciones actuales de accesibilidad urbana en el microcentro de la Ciudad de San Juan. A través de un relevamiento in situ y el estudio de las normativas vigentes, se identifican las principales barreras arquitectónicas que limitan la movilidad de personas con discapacidad motriz y visual. El documento concluye con una propuesta de intervención a nivel urbano y arquitectónico para las principales arterias peatonales, priorizando el diseño universal.',
    palabrasClave: ['Accesibilidad', 'Diseño Universal', 'Urbanismo', 'Barreras Físicas'],
    idioma: 'Español',
    formato: 'PDF · 124 pág.',
  },
  {
    id: 'vivienda-social-cuyo',
    titulo: 'Vivienda social en Cuyo',
    tipo: 'INVESTIGACION',
    tipoLabelLargo: 'Investigación',
    carrera: 'Arquitectura',
    autorCorto: 'L. Martínez',
    autor: 'Lucía Martínez',
    anio: 2021,
    departamento: 'Jáchal',
    disponible: false,
  },
  {
    id: 'patrimonio-arquitectonico-sanjuanino',
    titulo: 'Patrimonio arquitectónico sanjuanino',
    tipo: 'MONOGRAFIA',
    tipoLabelLargo: 'Monografía',
    carrera: 'Arquitectura',
    autorCorto: 'C. Ruiz',
    autor: 'Carlos Ruiz',
    anio: 2018,
    departamento: 'Valle Fértil',
    disponible: true,
  },
  {
    id: 'diseno-bioclimatico-zonas-aridas',
    titulo: 'Diseño bioclimático en zonas áridas',
    tipo: 'TESIS',
    tipoLabelLargo: 'Tesis de Grado',
    carrera: 'Diseño',
    autorCorto: 'E. Silva',
    autor: 'Elena Silva',
    anio: 2024,
    departamento: 'Iglesia',
    disponible: true,
  },
];

export type MyLoanTab = 'activos' | 'vencidos' | 'solicitados';

export interface MyLoanFixture {
  id: string;
  codigo: string;
  documentoId: string;
  titulo: string;
  autor: string;
  inicio: string;
  vence: string;
  estado: 'ACTIVO' | 'POR_VENCER' | 'VENCIDO' | 'SOLICITADO';
  diasRestantes?: number;
}

/** Figma pág. 13 */
export const MY_LOANS: MyLoanFixture[] = [
  {
    id: '1024',
    codigo: '#1024',
    documentoId: 'accesibilidad-urbana-san-juan',
    titulo: 'Accesibilidad urbana en San Juan',
    autor: 'Morales M.D.',
    inicio: '18/09/2026',
    vence: '25/09/2026',
    estado: 'ACTIVO',
    diasRestantes: 5,
  },
  {
    id: '1019',
    codigo: '#1019',
    documentoId: 'vivienda-social-cuyo',
    titulo: 'Vivienda social en Cuyo',
    autor: 'Pérez L.',
    inicio: '14/09/2026',
    vence: '21/09/2026',
    estado: 'POR_VENCER',
    diasRestantes: 1,
  },
  {
    id: '1003',
    codigo: '#1003',
    documentoId: 'patrimonio-arquitectonico-sanjuanino',
    titulo: 'Patrimonio arquitectónico sanjuanino',
    autor: 'Gómez R.',
    inicio: '01/09/2026',
    vence: '08/09/2026',
    estado: 'VENCIDO',
  },
];

export type AdminUserTab = 'pendientes' | 'aprobados' | 'rechazados';

export interface AdminUserFixture {
  id: string;
  nombre: string;
  iniciales: string;
  email: string;
  departamento: string;
}

/** Figma pág. 8 */
export const PENDING_USERS: AdminUserFixture[] = [
  { id: 'u1', nombre: 'Ana Pérez', iniciales: 'AP', email: 'ana.perez@jachal.gov.ar', departamento: 'Jáchal' },
  { id: 'u2', nombre: 'Luis Romero', iniciales: 'LR', email: 'lromero@vallefertil.gov.ar', departamento: 'Valle Fértil' },
  { id: 'u3', nombre: 'Marta Ríos', iniciales: 'MR', email: 'mrios@iglesia.gov.ar', departamento: 'Iglesia' },
  { id: 'u4', nombre: 'Diego Sosa', iniciales: 'DS', email: 'dsosa@calingasta.gov.ar', departamento: 'Calingasta' },
];

export const ADMIN_USER_COUNTS: Record<AdminUserTab, number> = {
  pendientes: 3,
  aprobados: 48,
  rechazados: 2,
};

export interface AdminLoanFixture {
  id: string;
  documento: string;
  documentoCorto: string;
  usuario: string;
  vence: string;
  venceCorto: string;
  estado: 'ALERTA' | 'ACTIVO' | 'VENCIDO';
}

/** Figma pág. 9 */
export const ADMIN_LOANS: AdminLoanFixture[] = [
  {
    id: 'l1',
    documento: 'Planificación Urbana Sostenible',
    documentoCorto: 'Planificación Urbana...',
    usuario: 'Ana Pérez (Jáchal)',
    vence: 'Mañana',
    venceCorto: 'Mañana',
    estado: 'ALERTA',
  },
  {
    id: 'l2',
    documento: 'Diseño Bioclimático en Arquitectura',
    documentoCorto: 'Diseño Bioclimático en...',
    usuario: 'Luis Romero (Valle Fértil)',
    vence: '12/10/2023',
    venceCorto: '12/10',
    estado: 'ACTIVO',
  },
  {
    id: 'l3',
    documento: 'Historia de la Arq. Arg.',
    documentoCorto: 'Historia de la Arq. Arg.',
    usuario: 'Marta Ríos (Iglesia)',
    vence: 'Hoy',
    venceCorto: 'Hoy',
    estado: 'VENCIDO',
  },
  {
    id: 'l4',
    documento: 'Materiales y Construcción',
    documentoCorto: 'Materiales y Construcción',
    usuario: 'Diego Sosa (Calingasta)',
    vence: '15/10/2023',
    venceCorto: '15/10',
    estado: 'ACTIVO',
  },
];

export const ADMIN_LOAN_KPIS = { activos: 24, porVencer: 3, vencidosHoy: 5 };

/** Figma pág. 14 */
export const VIEWER_FIXTURE = {
  prestamoId: '1024',
  titulo: 'Accesibilidad urbana en San Juan',
  tituloPagina: 'Accesibilidad Urbana y Diseño Universal',
  subtituloPagina: 'Capítulo 1: Fundamentos en San Juan',
  totalPaginas: 84,
  diasRestantes: 5,
  marcaAgua: 'Ana Pérez · Préstamo #1024',
};
