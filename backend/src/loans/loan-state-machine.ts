import { ConflictException } from '@nestjs/common';
import { EstadoPrestamo } from '@prisma/client';

/**
 * Máquina de Estados Explícita del Préstamo Digital (Figura 5 — Diagrama de Estados UML).
 *
 * Transiciones válidas:
 * - SOLICITADO -> ACTIVO (cuando estaDisponible() es verdadero y se emite el JWT DRM de 7 días)
 * - SOLICITADO -> RECHAZADO (cuando el documento está suspendido por Biblioteca)
 * - ACTIVO     -> VENCIDO (transición automática al cumplirse los 7 días corridos)
 * - ACTIVO     -> REVOCADO (revocación manual inmediata por el Administrador de Biblioteca)
 * - ACTIVO     -> CERRADO (devolución/cierre anticipado del préstamo)
 * - VENCIDO    -> CERRADO (cierre administrativo o archivo del préstamo vencido)
 * - REVOCADO   -> CERRADO (cierre definitivo posterior a revocación)
 * - RECHAZADO  -> [] (estado terminal)
 * - CERRADO    -> [] (estado terminal)
 */
export class LoanStateMachine {
  private static readonly ALLOWED_TRANSITIONS: Readonly<
    Record<EstadoPrestamo, readonly EstadoPrestamo[]>
  > = {
    [EstadoPrestamo.SOLICITADO]: [
      EstadoPrestamo.ACTIVO,
      EstadoPrestamo.RECHAZADO,
    ],
    [EstadoPrestamo.ACTIVO]: [
      EstadoPrestamo.VENCIDO,
      EstadoPrestamo.REVOCADO,
      EstadoPrestamo.CERRADO,
    ],
    [EstadoPrestamo.VENCIDO]: [EstadoPrestamo.CERRADO],
    [EstadoPrestamo.REVOCADO]: [EstadoPrestamo.CERRADO],
    [EstadoPrestamo.RECHAZADO]: [],
    [EstadoPrestamo.CERRADO]: [],
  };

  /**
   * Comprueba si la transición desde `from` hacia `to` es válida según el Diagrama de Estados (Figura 5).
   */
  static canTransition(from: EstadoPrestamo, to: EstadoPrestamo): boolean {
    const allowed = this.ALLOWED_TRANSITIONS[from] ?? [];
    return allowed.includes(to);
  }

  /**
   * Devuelve la lista de estados destino permitidos a partir del estado actual.
   */
  static getAllowedNextStates(from: EstadoPrestamo): readonly EstadoPrestamo[] {
    return this.ALLOWED_TRANSITIONS[from] ?? [];
  }

  /**
   * Valida que la transición de estado sea legal; en caso contrario lanza ConflictException (409).
   */
  static assertTransition(
    from: EstadoPrestamo,
    to: EstadoPrestamo,
    customMessage?: string,
  ): void {
    if (!this.canTransition(from, to)) {
      const allowedList = this.getAllowedNextStates(from);
      const allowedStr =
        allowedList.length > 0 ? allowedList.join(', ') : 'ninguno (terminal)';

      throw new ConflictException(
        customMessage ??
          `Transición de estado inválida en préstamo digital: no se puede pasar de "${from}" a "${to}". Estados permitidos desde "${from}": [${allowedStr}].`,
      );
    }
  }

  /**
   * Indica si el estado actual habilita la lectura del documento en el visor protegido (RF04).
   */
  static allowsReading(estado: EstadoPrestamo): boolean {
    return estado === EstadoPrestamo.ACTIVO;
  }

  /**
   * Indica si el estado es terminal (sin transiciones posteriores posibles).
   */
  static isTerminal(estado: EstadoPrestamo): boolean {
    return this.getAllowedNextStates(estado).length === 0;
  }
}
