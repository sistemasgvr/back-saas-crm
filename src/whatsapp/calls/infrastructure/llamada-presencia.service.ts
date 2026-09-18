import { Injectable } from '@nestjs/common';

/**
 * Presencia in-memory de agentes disponibles para atender llamadas WhatsApp.
 * Se pierde al reiniciar el proceso — suficiente para single-instance;
 * en multi-réplica habría que mover esto a Redis.
 */
@Injectable()
export class LlamadaPresenciaService {
  private readonly disponibles = new Map<string, Set<string>>();

  setDisponible(
    organizacionId: string,
    usuarioId: string,
    disponible: boolean,
  ): void {
    let set = this.disponibles.get(organizacionId);
    if (!set) {
      set = new Set();
      this.disponibles.set(organizacionId, set);
    }
    if (disponible) {
      set.add(usuarioId);
    } else {
      set.delete(usuarioId);
    }
  }

  listDisponibles(organizacionId: string): string[] {
    return [...(this.disponibles.get(organizacionId) ?? [])];
  }

  isDisponible(organizacionId: string, usuarioId: string): boolean {
    return this.disponibles.get(organizacionId)?.has(usuarioId) ?? false;
  }
}
