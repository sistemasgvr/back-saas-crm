import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import type { LeadsRepository, UpsertLeadInput } from '../application/ports/leads.repository.port';

@Injectable()
export class PrismaLeadsRepository implements LeadsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertPorIdExterno(input: UpsertLeadInput): Promise<{ id: string; creado: boolean }> {
    const existente = await this.prisma.lead.findUnique({
      where: { organizacionId_idExterno: { organizacionId: input.organizacionId, idExterno: input.idExterno } },
    });

    if (existente) {
      return { id: existente.id, creado: false };
    }

    const lead = await this.prisma.lead.create({
      data: {
        organizacionId: input.organizacionId,
        campanaId: input.campanaId,
        conjuntoAnuncioId: input.conjuntoAnuncioId,
        anuncioId: input.anuncioId,
        formularioId: input.formularioId,
        idExterno: input.idExterno,
        nombre: input.nombre,
        email: input.email,
        telefono: input.telefono,
        datosCrudos: input.datosCrudos as Prisma.InputJsonValue,
        fechaLead: input.fechaLead,
      },
    });
    return { id: lead.id, creado: true };
  }
}
