import type { RolOrganizacion } from '../../../auth/domain/request-context.interface';
import { tienePermiso } from '../../../shared/domain/permisos';

type LeadAcceso = { asignadoUsuarioId: string | null } | null;

/** Chat sin dueño: sin lead, o lead sin asignar — cualquiera de la org puede
 * abrirlo / escribir / tomarlo (chats viejos o recién creados por WhatsApp). */
export function conversacionSinDueno(lead: LeadAcceso): boolean {
  return !lead || lead.asignadoUsuarioId == null;
}

/** Gestiona chats de todo el equipo (antes: PROPIETARIO o ADMINISTRADOR). */
export function gestionaTodosLosChats(ctx: {
  rol: RolOrganizacion;
  permisos?: readonly string[];
}): boolean {
  return veTodosLosChats(ctx) && tienePermiso(ctx, 'chats.gestionar_todos');
}

export function veTodosLosChats(ctx: {
  rol: RolOrganizacion;
  permisos?: readonly string[];
}): boolean {
  return tienePermiso(ctx, 'chats.ver_todos');
}

/** Lectura de chats propios, libres o del equipo según el rol. */
export function puedeVerConversacionWhatsApp(
  lead: LeadAcceso,
  ctx: {
    usuarioId: string;
    rol: RolOrganizacion;
    permisos?: readonly string[];
  },
): boolean {
  return (
    veTodosLosChats(ctx) ||
    lead?.asignadoUsuarioId === ctx.usuarioId ||
    conversacionSinDueno(lead)
  );
}

/** Escritura / media / bloquear: admin, dueño del lead, o chat libre. */
export function puedeEscribirConversacionWhatsApp(
  lead: LeadAcceso,
  ctx: {
    usuarioId: string;
    rol: RolOrganizacion;
    permisos?: readonly string[];
  },
): boolean {
  if (gestionaTodosLosChats(ctx)) return true;
  if (lead?.asignadoUsuarioId === ctx.usuarioId) return true;
  return conversacionSinDueno(lead);
}
