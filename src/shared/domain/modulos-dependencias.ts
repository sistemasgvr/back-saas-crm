export interface ModuloDependencias {
  codigo: string;
  requiere: string[];
}

/** Transitive closure in prerequisite-first order. Reject unknown codes and cycles. */
export function dependenciasDe(
  codigo: string,
  catalogo: readonly ModuloDependencias[],
): string[] {
  const visitados = new Set<string>();
  const camino = new Set<string>();
  const visitar = (actual: string) => {
    if (camino.has(actual)) throw new Error(`Dependencia circular: ${actual}`);
    if (visitados.has(actual)) return;
    const modulo = catalogo.find((m) => m.codigo === actual);
    if (!modulo) throw new Error(`Módulo requerido inexistente: ${actual}`);
    camino.add(actual);
    for (const requerido of modulo.requiere) visitar(requerido);
    camino.delete(actual);
    visitados.add(actual);
  };
  visitar(codigo);
  return [...visitados].filter((c) => c !== codigo);
}

export function dependientesActivos(
  codigo: string,
  habilitados: readonly string[],
  catalogo: readonly ModuloDependencias[],
): string[] {
  return habilitados.filter(
    (c) => c !== codigo && dependenciasDe(c, catalogo).includes(codigo),
  );
}
