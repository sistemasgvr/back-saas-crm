/** Referencias gestionadas en el bucket privado; nunca se aceptan claves del cliente. */
export function claveLogoOrganizacion(
  organizacionId: string,
  referencia: string | null | undefined,
): string | null {
  if (!referencia) return null;
  const prefijo = `organizations/${organizacionId}/branding/`;
  if (!referencia.startsWith(prefijo)) return null;
  const archivo = referencia.slice(prefijo.length);
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/.test(
    archivo,
  )
    ? referencia
    : null;
}

export function logoOrganizacionUrl(
  organizacionId: string,
  referencia: string | null | undefined,
): string | null {
  const clave = claveLogoOrganizacion(organizacionId, referencia);
  if (clave) return `/api/organizations/logo?v=${clave.split('/').at(-1)!}`;
  // Compatibilidad con logos externos ya configurados. No se interpretan claves ajenas.
  if (referencia && /^https?:\/\//i.test(referencia)) return referencia;
  return null;
}
