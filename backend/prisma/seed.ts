import {
  EstadoValidacionUsuario,
  PrismaClient,
  RolUsuario,
  TipoDocumento,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEPARTAMENTOS_SAN_JUAN = [
  { nombre: 'Capital', esCapital: true },
  { nombre: 'Rawson', esCapital: false },
  { nombre: 'Chimbas', esCapital: false },
  { nombre: 'Rivadavia', esCapital: false },
  { nombre: 'Santa Lucía', esCapital: false },
  { nombre: 'Pocito', esCapital: false },
  { nombre: 'Caucete', esCapital: false },
  { nombre: 'Jáchal', esCapital: false },
  { nombre: 'Albardón', esCapital: false },
  { nombre: 'Sarmiento', esCapital: false },
  { nombre: '25 de Mayo', esCapital: false },
  { nombre: 'San Martín', esCapital: false },
  { nombre: 'Calingasta', esCapital: false },
  { nombre: '9 de Julio', esCapital: false },
  { nombre: 'Angaco', esCapital: false },
  { nombre: 'Valle Fértil', esCapital: false },
  { nombre: 'Iglesia', esCapital: false },
  { nombre: 'Ullum', esCapital: false },
  { nombre: 'Zonda', esCapital: false },
];

async function main(): Promise<void> {
  console.log(
    '🌱 Iniciando seed de base de datos — Repositorio FAUD-UNSJ (19 departamentos, usuarios y catálogo)...',
  );

  // 1. Semilla de los 19 Departamentos de San Juan
  const departamentosMap = new Map<string, string>();

  for (const depto of DEPARTAMENTOS_SAN_JUAN) {
    const saved = await prisma.departamento.upsert({
      where: { nombre: depto.nombre },
      update: { esCapital: depto.esCapital },
      create: {
        nombre: depto.nombre,
        esCapital: depto.esCapital,
      },
    });
    departamentosMap.set(saved.nombre, saved.id);
  }

  console.log(
    `✅ ${departamentosMap.size} departamentos de San Juan registrados correctamente.`,
  );

  // 2. Semilla de Usuarios de Prueba (alineados con Prototipos Figma)
  const adminPasswordHash = await bcrypt.hash('Admin123!', 10);
  const userPasswordHash = await bcrypt.hash('Alumno123!', 10);

  const usuariosIniciales = [
    {
      nombre: 'Administrador Biblioteca FAUD',
      email: 'admin@faud.unsj.edu.ar',
      passwordHash: adminPasswordHash,
      rol: RolUsuario.ADMINISTRADOR,
      estadoValidacion: EstadoValidacionUsuario.APROBADO,
      departamentoNombre: 'Capital',
    },
    {
      nombre: 'Ana Pérez',
      email: 'ana.perez@jachal.gov.ar',
      passwordHash: userPasswordHash,
      rol: RolUsuario.USUARIO,
      estadoValidacion: EstadoValidacionUsuario.APROBADO,
      departamentoNombre: 'Jáchal',
    },
    {
      nombre: 'Sofía Navarro',
      email: 'sofia.navarro@caucete.gob.ar',
      passwordHash: userPasswordHash,
      rol: RolUsuario.USUARIO,
      estadoValidacion: EstadoValidacionUsuario.APROBADO,
      departamentoNombre: 'Caucete',
    },
    {
      nombre: 'Carlos Gómez',
      email: 'carlos.gomez@vallefertil.gob.ar',
      passwordHash: userPasswordHash,
      rol: RolUsuario.USUARIO,
      estadoValidacion: EstadoValidacionUsuario.PENDIENTE,
      departamentoNombre: 'Valle Fértil',
    },
    {
      nombre: 'Lucía Fernández',
      email: 'lucia.fernandez@iglesia.gob.ar',
      passwordHash: userPasswordHash,
      rol: RolUsuario.USUARIO,
      estadoValidacion: EstadoValidacionUsuario.PENDIENTE,
      departamentoNombre: 'Iglesia',
    },
    {
      nombre: 'Marcos Sosa',
      email: 'marcos.sosa@calingasta.gob.ar',
      passwordHash: userPasswordHash,
      rol: RolUsuario.USUARIO,
      estadoValidacion: EstadoValidacionUsuario.PENDIENTE,
      departamentoNombre: 'Calingasta',
    },
  ];

  for (const user of usuariosIniciales) {
    const departamentoId = departamentosMap.get(user.departamentoNombre);
    if (!departamentoId) {
      throw new Error(
        `No se encontró el departamento ${user.departamentoNombre}`,
      );
    }

    await prisma.usuario.upsert({
      where: { email: user.email },
      update: {
        nombre: user.nombre,
        rol: user.rol,
        estadoValidacion: user.estadoValidacion,
        departamentoId,
      },
      create: {
        nombre: user.nombre,
        email: user.email,
        passwordHash: user.passwordHash,
        rol: user.rol,
        estadoValidacion: user.estadoValidacion,
        departamentoId,
      },
    });
  }

  console.log(
    `✅ ${usuariosIniciales.length} usuarios iniciales registrados (Admin + Aprobados + Pendientes).`,
  );

  // 3. Semilla del Catálogo Inicial de Documentos Académicos (alineados con Figma)
  const documentosIniciales = [
    {
      titulo: 'Accesibilidad urbana en San Juan',
      autor: 'Martín González',
      director: 'Dr. Arq. Roberto Sánchez',
      carrera: 'Urbanismo',
      tipo: TipoDocumento.TESIS,
      anio: 2023,
      resumen:
        'Estudio integral sobre las condiciones de accesibilidad física y espacial en el microcentro de la Ciudad de San Juan, proponiendo lineamientos de diseño universal para veredas, cruces peatonales y edificios públicos.',
      palabrasClave: [
        'accesibilidad',
        'urbanismo',
        'espacio público',
        'San Juan',
        'movilidad reducida',
      ],
      archivoUrl: 'storage/pdfs/accesibilidad-urbana-san-juan-2023.pdf',
      disponible: true,
      departamentoOrigenNombre: 'Capital',
    },
    {
      titulo: 'Vivienda social en Cuyo',
      autor: 'L. Martínez',
      director: 'Mg. Arq. Claudia Quiroga',
      carrera: 'Arquitectura',
      tipo: TipoDocumento.INVESTIGACION,
      anio: 2021,
      resumen:
        'Investigación aplicada sobre tipologías de vivienda de interés social adaptadas a las condiciones climáticas y culturales de los valles del norte sanjuanino, con énfasis en el departamento de Jáchal.',
      palabrasClave: [
        'vivienda social',
        'Cuyo',
        'hábitat rural',
        'Jáchal',
        'sustentabilidad',
      ],
      archivoUrl: 'storage/pdfs/vivienda-social-cuyo-2021.pdf',
      disponible: true,
      departamentoOrigenNombre: 'Jáchal',
    },
    {
      titulo: 'Patrimonio arquitectónico sanjuanino',
      autor: 'C. Ruiz',
      director: 'Esp. Arq. Héctor Flores',
      carrera: 'Arquitectura',
      tipo: TipoDocumento.MONOGRAFIA,
      anio: 2018,
      resumen:
        'Relevamiento histórico y constructivo de las manifestaciones arquitectónicas patrimoniales de la provincia de San Juan, analizando técnicas tradicionales en tierra cruda y estrategias de preservación.',
      palabrasClave: [
        'patrimonio',
        'historia',
        'conservación',
        'arquitectura colonial',
        'Valle Fértil',
      ],
      archivoUrl: 'storage/pdfs/patrimonio-arquitectonico-sanjuanino-2018.pdf',
      disponible: true,
      departamentoOrigenNombre: 'Valle Fértil',
    },
    {
      titulo: 'Diseño bioclimático en zonas áridas',
      autor: 'E. Silva',
      director: 'Dra. Arq. Valeria Molina',
      carrera: 'Diseño',
      tipo: TipoDocumento.TESIS,
      anio: 2024,
      resumen:
        'Propuesta de envolventes arquitectónicas y sistemas pasivos de acondicionamiento térmico para edificaciones de alta montaña en el departamento de Iglesia, optimizando la ganancia solar y la inercia térmica.',
      palabrasClave: [
        'bioclimática',
        'zonas áridas',
        'eficiencia energética',
        'Iglesia',
        'arquitectura solar',
      ],
      archivoUrl: 'storage/pdfs/diseno-bioclimatico-zonas-aridas-2024.pdf',
      disponible: true,
      departamentoOrigenNombre: 'Iglesia',
    },
  ];

  for (const doc of documentosIniciales) {
    const departamentoOrigenId = departamentosMap.get(
      doc.departamentoOrigenNombre,
    );
    const existente = await prisma.documento.findFirst({
      where: {
        titulo: doc.titulo,
        autor: doc.autor,
      },
    });

    if (existente) {
      await prisma.documento.update({
        where: { id: existente.id },
        data: {
          director: doc.director,
          carrera: doc.carrera,
          tipo: doc.tipo,
          anio: doc.anio,
          resumen: doc.resumen,
          palabrasClave: doc.palabrasClave,
          archivoUrl: doc.archivoUrl,
          disponible: doc.disponible,
          departamentoOrigenId,
        },
      });
    } else {
      await prisma.documento.create({
        data: {
          titulo: doc.titulo,
          autor: doc.autor,
          director: doc.director,
          carrera: doc.carrera,
          tipo: doc.tipo,
          anio: doc.anio,
          resumen: doc.resumen,
          palabrasClave: doc.palabrasClave,
          archivoUrl: doc.archivoUrl,
          disponible: doc.disponible,
          departamentoOrigenId,
        },
      });
    }
  }

  console.log(
    `✅ ${documentosIniciales.length} documentos académicos iniciales catalogados.`,
  );
  console.log('🎉 Seed completado exitosamente.');
}

main()
  .catch((error) => {
    console.error('❌ Error ejecutando el seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
