import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';

const ROLES_ADMIN: RolOrganizacion[] = ['PROPIETARIO', 'ADMINISTRADOR'];

type LeadAcceso = { asignadoUsuarioId: string | null } | null;

/** Chat sin dueño: sin lead, o lead sin asignar — cualquiera de la org puede
 * abrirlo / escribir / tomarlo (chats viejos o recién creados por WhatsApp). */
export function conversacionSinDueno(lead: LeadAcceso): boolean {
  return !lead || lead.asignadoUsuarioId == null;
}

export function esAdminOrganizacion(rol: RolOrganizacion): boolean {
  return ROLES_ADMIN.includes(rol);
}

/** Lectura: cualquier miembro de la org (el repo ya filtra por organizacionId). */
export function puedeVerConversacionWhatsApp(
  _lead: LeadAcceso,
  _ctx: { usuarioId: string; rol: RolOrganizacion },
): boolean {
  return true;
}

/** Escritura / media / bloquear: admin, dueño del lead, o chat libre. */
export function puedeEscribirConversacionWhatsApp(
  lead: LeadAcceso,
  ctx: { usuarioId: string; rol: RolOrganizacion },
): boolean {
  if (esAdminOrganizacion(ctx.rol)) return true;
  if (lead?.asignadoUsuarioId === ctx.usuarioId) return true;
  return conversacionSinDueno(lead);
}
