/** Rol de línea WhatsApp por conexión (dual-número: mensajes vs llamadas). */
export const ROL_LINEA_WHATSAPP = {
  MENSAJES: 'MENSAJES',
  LLAMADAS: 'LLAMADAS',
  AMBOS: 'AMBOS',
} as const;

export type RolLineaWhatsapp =
  (typeof ROL_LINEA_WHATSAPP)[keyof typeof ROL_LINEA_WHATSAPP];

export function conexionPuedeCalling(params: {
  rolLinea: string;
  callingHabilitado: number;
}): boolean {
  if (params.callingHabilitado !== 1) return false;
  return (
    params.rolLinea === ROL_LINEA_WHATSAPP.LLAMADAS ||
    params.rolLinea === ROL_LINEA_WHATSAPP.AMBOS
  );
}
