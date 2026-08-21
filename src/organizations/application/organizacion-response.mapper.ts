import type { Organizacion } from '@prisma/client';

// notas y las columnas de auditoría son uso interno de plataforma (PLAN.md §4.3);
// no se exponen en el contrato de cliente.
export function toOrganizacionResponse(org: Organizacion) {
  return {
    id: org.id,
    nombre: org.nombre,
    slug: org.slug,
    razonSocial: org.razonSocial,
    documentoFiscal: org.documentoFiscal,
    emailContacto: org.emailContacto,
    telefonoContacto: org.telefonoContacto,
    logoUrl: org.logoUrl,
    pais: org.pais,
    zonaHoraria: org.zonaHoraria,
    // Lo define el admin de plataforma (§3) — solo lectura para la org.
    rubro: org.rubro,
    fechaCreacion: org.fechaCreacion,
  };
}
