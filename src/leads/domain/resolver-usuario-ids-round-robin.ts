/** Resuelve la lista del round-robin (JSON N>=1 o legacy primero/segundo). */
export function resolverUsuarioIdsRoundRobin(cfg: {
  usuarioPrimeroId: string;
  usuarioSegundoId: string;
  usuarioIds: unknown;
}): string[] {
  const desdeJson = cfg.usuarioIds as unknown as string[] | null;
  const jsonValidos = Array.isArray(desdeJson)
    ? desdeJson.filter((id) => typeof id === 'string' && id.length > 0)
    : [];

  if (jsonValidos.length >= 1) {
    return jsonValidos;
  }

  return [cfg.usuarioPrimeroId, cfg.usuarioSegundoId].filter(
    (id) => typeof id === 'string' && id.length > 0,
  );
}
