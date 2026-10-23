import { BadRequestException } from '@nestjs/common';
import { createReadStream, promises as fs } from 'fs';
import * as path from 'path';
import {
  PdfReadStream,
  PdfStorageDriver,
} from './pdf-storage-driver.interface';

/**
 * Almacenamiento privado en disco local (`PRIVATE_STORAGE_DIR`), fuera de cualquier ruta pública estática.
 * Driver por defecto para desarrollo, pruebas y despliegues con disco persistente.
 */
export class LocalPdfStorageDriver implements PdfStorageDriver {
  constructor(private readonly storageDirAbs: string) {}

  async ensureDirectory(): Promise<void> {
    await fs.mkdir(this.storageDirAbs, { recursive: true });
  }

  /**
   * Resuelve de forma segura la ruta absoluta de un archivo dentro del directorio privado.
   */
  resolveSafePath(fileName: string): string {
    const resolved = path.resolve(this.storageDirAbs, path.basename(fileName));

    // Defensa contra Path Traversal
    if (!resolved.startsWith(this.storageDirAbs)) {
      throw new BadRequestException(
        'Acceso a ruta fuera del directorio privado.',
      );
    }

    return resolved;
  }

  async save(fileName: string, buffer: Buffer): Promise<void> {
    await this.ensureDirectory();
    await fs.writeFile(this.resolveSafePath(fileName), buffer);
  }

  async exists(fileName: string): Promise<boolean> {
    try {
      await fs.access(this.resolveSafePath(fileName));
      return true;
    } catch {
      return false;
    }
  }

  async delete(fileName: string): Promise<void> {
    const fullPath = this.resolveSafePath(fileName);
    if (await this.exists(fileName)) {
      await fs.unlink(fullPath);
    }
  }

  async open(fileName: string): Promise<PdfReadStream | null> {
    const fullPath = this.resolveSafePath(fileName);
    try {
      const stats = await fs.stat(fullPath);
      return { stream: createReadStream(fullPath), sizeBytes: stats.size };
    } catch {
      return null;
    }
  }
}
