import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { LocalPdfStorageDriver } from './storage/local-pdf-storage.driver';
import {
  PdfReadStream,
  PdfStorageDriver,
} from './storage/pdf-storage-driver.interface';
import { S3PdfStorageDriver } from './storage/s3-pdf-storage.driver';

export interface SavedPdfResult {
  relativePath: string;
  fileName: string;
  sizeBytes: number;
}

const SEED_SAMPLE_PDFS = [
  {
    fileName: 'accesibilidad-urbana-san-juan-2023.pdf',
    titulo: 'Accesibilidad urbana en San Juan',
    autor: 'Martin Gonzalez',
    anio: 2023,
  },
  {
    fileName: 'vivienda-social-cuyo-2021.pdf',
    titulo: 'Vivienda social en Cuyo',
    autor: 'L. Martinez',
    anio: 2021,
  },
  {
    fileName: 'patrimonio-arquitectonico-sanjuanino-2018.pdf',
    titulo: 'Patrimonio arquitectonico sanjuanino',
    autor: 'C. Ruiz',
    anio: 2018,
  },
  {
    fileName: 'diseno-bioclimatico-zonas-aridas-2024.pdf',
    titulo: 'Diseno bioclimatico en zonas aridas',
    autor: 'E. Silva',
    anio: 2024,
  },
];

@Injectable()
export class PdfStorageService implements OnModuleInit {
  private readonly logger = new Logger(PdfStorageService.name);
  private readonly driver: PdfStorageDriver;
  private readonly maxPdfSizeBytes: number;
  private readonly maxPdfSizeMb: number;

  constructor(private readonly configService: ConfigService) {
    this.driver = this.createDriver();
    this.maxPdfSizeMb = this.configService.get<number>(
      'storage.maxPdfSizeMb',
      50,
    );
    this.maxPdfSizeBytes = this.maxPdfSizeMb * 1024 * 1024;
  }

  async onModuleInit(): Promise<void> {
    if (this.driver instanceof LocalPdfStorageDriver) {
      await this.driver.ensureDirectory();
    }
    await this.ensureSeedSamplePdfs();
  }

  /**
   * Selecciona el backend de almacenamiento según `STORAGE_DRIVER`:
   * `local` (disco privado, por defecto) o `s3` (bucket privado compatible con S3, p. ej. Backblaze B2).
   */
  private createDriver(): PdfStorageDriver {
    const driverName = this.configService.get<string>(
      'storage.driver',
      'local',
    );

    if (driverName === 's3') {
      this.logger.log('Almacenamiento privado de PDFs: bucket S3 compatible');
      return new S3PdfStorageDriver({
        endpoint: this.configService.get<string>('storage.s3.endpoint', ''),
        region: this.configService.get<string>('storage.s3.region', ''),
        bucket: this.configService.get<string>('storage.s3.bucket', ''),
        accessKeyId: this.configService.get<string>(
          'storage.s3.accessKeyId',
          '',
        ),
        secretAccessKey: this.configService.get<string>(
          'storage.s3.secretAccessKey',
          '',
        ),
      });
    }

    const configuredDir = this.configService.get<string>(
      'storage.privateDir',
      './storage/pdfs',
    );
    return new LocalPdfStorageDriver(
      path.resolve(process.cwd(), configuredDir),
    );
  }

  /**
   * Genera archivos PDF válidos para los 4 documentos iniciales del seed si aún no existen en el almacenamiento,
   * garantizando que en Fase 4 puedan transmitirse en el visor protegido.
   */
  async ensureSeedSamplePdfs(): Promise<void> {
    for (const sample of SEED_SAMPLE_PDFS) {
      const exists = await this.driver.exists(sample.fileName);
      if (!exists) {
        const buffer = PdfStorageService.buildSamplePdfBuffer(
          sample.titulo,
          sample.autor,
          sample.anio,
        );
        await this.driver.save(sample.fileName, buffer);
      }
    }
  }

  /**
   * Valida formato (.pdf + magic bytes %PDF-) y tamaño máximo (50 MB) antes de persistir
   * el archivo en el almacenamiento privado (RF01 / RNF02).
   */
  async validateAndSavePdf(
    file: Express.Multer.File | undefined,
    tituloReferencia = 'documento',
  ): Promise<SavedPdfResult> {
    if (!file || !file.buffer) {
      throw new BadRequestException(
        'Debe adjuntar un archivo en formato PDF (campo "archivo").',
      );
    }

    if (file.size <= 0 || file.buffer.length === 0) {
      throw new BadRequestException('El archivo PDF enviado está vacío.');
    }

    if (file.size > this.maxPdfSizeBytes) {
      throw new BadRequestException(
        `El archivo supera el tamaño máximo permitido de ${this.maxPdfSizeMb} MB.`,
      );
    }

    const originalExt = path.extname(file.originalname || '').toLowerCase();
    const isPdfMime = file.mimetype === 'application/pdf';

    if (originalExt !== '.pdf' || !isPdfMime) {
      throw new BadRequestException(
        'Formato de archivo inválido. Solo se admiten documentos con extensión .pdf y MIME application/pdf.',
      );
    }

    // Validación de firma binaria (magic bytes %PDF-)
    const magicHeader = file.buffer.subarray(0, 5).toString('ascii');
    if (magicHeader !== '%PDF-') {
      throw new BadRequestException(
        'El contenido binario del archivo no corresponde a un documento PDF válido (firma %PDF- ausente).',
      );
    }

    const safeSlug = this.slugify(tituloReferencia || file.originalname);
    const shortId = randomUUID().split('-')[0];
    const fileName = `${Date.now()}-${shortId}-${safeSlug}.pdf`;

    await this.driver.save(fileName, file.buffer);
    this.logger.log(
      `PDF almacenado de forma privada: ${fileName} (${file.size} bytes)`,
    );

    return {
      relativePath: `storage/pdfs/${fileName}`,
      fileName,
      sizeBytes: file.size,
    };
  }

  /**
   * Indica si el PDF referenciado por `archivoUrl` existe en el almacenamiento privado.
   */
  async pdfExists(relativePath: string): Promise<boolean> {
    return this.driver.exists(path.basename(relativePath));
  }

  /**
   * Abre el PDF referenciado por `archivoUrl` como stream de lectura, o `null` si no existe.
   */
  async openPdf(relativePath: string): Promise<PdfReadStream | null> {
    return this.driver.open(path.basename(relativePath));
  }

  /**
   * Elimina un archivo PDF del almacenamiento privado si existe.
   */
  async deletePdfIfExists(relativePath: string): Promise<void> {
    try {
      const fileName = path.basename(relativePath);
      const exists = await this.driver.exists(fileName);
      if (exists) {
        await this.driver.delete(fileName);
        this.logger.log(
          `PDF eliminado del almacenamiento privado: ${fileName}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `No se pudo eliminar el archivo PDF "${relativePath}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Genera un documento PDF 1.4 minimalista y 100% válido para semillas y pruebas automatizadas.
   */
  static buildSamplePdfBuffer(
    titulo: string,
    autor: string,
    anio: number,
  ): Buffer {
    const cleanText = (txt: string) =>
      txt
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[()\\]/g, '');

    const contentStream = [
      'BT',
      '/F1 16 Tf',
      '50 750 Td',
      `(Repositorio Digital FAUD - UNSJ) Tj`,
      '/F1 13 Tf',
      '0 -30 Td',
      `(Titulo: ${cleanText(titulo)}) Tj`,
      '0 -22 Td',
      `(Autor: ${cleanText(autor)} - Anio: ${anio}) Tj`,
      '0 -30 Td',
      '/F1 10 Tf',
      '(Documento academico protegido bajo prestamo digital temporal de 7 dias.) Tj',
      'ET',
    ].join('\n');

    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length ${contentStream.length} >>
stream
${contentStream}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000229 00000 n 
0000000297 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${350 + contentStream.length}
%%EOF
`;

    return Buffer.from(pdfContent, 'utf-8');
  }

  private slugify(input: string): string {
    const cleaned = input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);

    return cleaned.length > 0 ? cleaned : 'documento-faud';
  }
}
