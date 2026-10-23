import { Readable } from 'stream';

/**
 * Stream de lectura de un PDF privado junto con su tamaño en bytes (para `Content-Length`).
 */
export interface PdfReadStream {
  stream: Readable;
  sizeBytes: number;
}

/**
 * Contrato común de los backends de almacenamiento privado de PDFs (RF01 / RNF02).
 * Las claves son siempre el nombre de archivo (basename), nunca rutas.
 */
export interface PdfStorageDriver {
  save(fileName: string, buffer: Buffer): Promise<void>;
  exists(fileName: string): Promise<boolean>;
  delete(fileName: string): Promise<void>;
  /** Retorna `null` si el archivo no existe en el almacenamiento. */
  open(fileName: string): Promise<PdfReadStream | null>;
}
