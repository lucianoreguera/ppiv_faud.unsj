/**
 * Datos de ejemplo tomados literalmente de los prototipos Figma
 * (documentación/Presentacion_Prototipos_Figma_Segunda_Etapa_DHL_Solutions.pdf).
 *
 * Alimentan las vistas en la Fase 0 para validar el diseño. Cada fase posterior
 * reemplaza su porción por la respuesta real del Backend (docs/specs/openapi.json).
 */
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
