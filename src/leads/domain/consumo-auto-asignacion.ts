export function limitesDesdeJson(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, n]) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 1,
    ),
  );
}

export function consumoDelDia(
  value: unknown,
  dia: string,
): { dia: string; porUsuario: Record<string, number> } {
  const stored = value as { dia?: string; porUsuario?: unknown } | null;
  return {
    dia,
    porUsuario: stored?.dia === dia ? limitesDesdeJson(stored.porUsuario) : {},
  };
}
