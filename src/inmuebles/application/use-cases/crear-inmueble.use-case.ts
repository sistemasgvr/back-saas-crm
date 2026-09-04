import {
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  INMUEBLES_REPOSITORY,
  type InmueblesRepository,
} from '../ports/inmuebles.repository.port';

@Injectable()
export class CrearInmuebleUseCase {
  constructor(
    @Inject(INMUEBLES_REPOSITORY)
    private readonly inmuebles: InmueblesRepository,
  ) {}

  async execute(
    organizacionId: string,
    input: {
      codigo: string;
      titulo: string;
      tipo: string;
      operacion: string;
      zona?: string;
      direccion?: string;
      precio?: number;
      moneda?: string;
      estadoInmueble?: string;
      notas?: string;
    },
    usuarioId: string,
  ) {
    const codigo = input.codigo.trim().toUpperCase();
    const existe = await this.inmuebles.existeCodigo(organizacionId, codigo);
    if (existe) {
      throw new ConflictException(
        `Ya existe un inmueble con el código ${codigo}`,
      );
    }

    return this.inmuebles.crear(organizacionId, {
      codigo,
      titulo: input.titulo.trim(),
      tipo: input.tipo,
      operacion: input.operacion,
      zona: input.zona?.trim() || null,
      direccion: input.direccion?.trim() || null,
      precio: input.precio ?? null,
      moneda: input.moneda?.trim().toUpperCase() || 'PEN',
      estadoInmueble: input.estadoInmueble ?? 'DISPONIBLE',
      notas: input.notas?.trim() || null,
      usuarioId,
    });
  }
}
