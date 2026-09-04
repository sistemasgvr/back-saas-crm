import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  INMUEBLES_REPOSITORY,
  type InmueblesRepository,
} from '../ports/inmuebles.repository.port';

@Injectable()
export class ActualizarInmuebleUseCase {
  constructor(
    @Inject(INMUEBLES_REPOSITORY)
    private readonly inmuebles: InmueblesRepository,
  ) {}

  async execute(
    organizacionId: string,
    id: string,
    input: {
      codigo?: string;
      titulo?: string;
      tipo?: string;
      operacion?: string;
      zona?: string | null;
      direccion?: string | null;
      precio?: number | null;
      moneda?: string;
      estadoInmueble?: string;
      notas?: string | null;
    },
    usuarioId: string,
  ) {
    if (input.codigo !== undefined) {
      const codigo = input.codigo.trim().toUpperCase();
      const existe = await this.inmuebles.existeCodigo(
        organizacionId,
        codigo,
        id,
      );
      if (existe) {
        throw new ConflictException(
          `Ya existe un inmueble con el código ${codigo}`,
        );
      }
    }

    const actualizado = await this.inmuebles.actualizar(organizacionId, id, {
      ...(input.codigo !== undefined
        ? { codigo: input.codigo.trim().toUpperCase() }
        : {}),
      ...(input.titulo !== undefined
        ? { titulo: input.titulo.trim() }
        : {}),
      ...(input.tipo !== undefined ? { tipo: input.tipo } : {}),
      ...(input.operacion !== undefined
        ? { operacion: input.operacion }
        : {}),
      ...(input.zona !== undefined
        ? { zona: input.zona?.trim() || null }
        : {}),
      ...(input.direccion !== undefined
        ? { direccion: input.direccion?.trim() || null }
        : {}),
      ...(input.precio !== undefined ? { precio: input.precio } : {}),
      ...(input.moneda !== undefined
        ? { moneda: input.moneda.trim().toUpperCase() }
        : {}),
      ...(input.estadoInmueble !== undefined
        ? { estadoInmueble: input.estadoInmueble }
        : {}),
      ...(input.notas !== undefined
        ? { notas: input.notas?.trim() || null }
        : {}),
      usuarioId,
    });

    if (!actualizado) {
      throw new NotFoundException('Inmueble no encontrado');
    }
    return actualizado;
  }
}
