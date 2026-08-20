import type { MetaCampoLead } from '../../connections/application/ports/meta-graph-client.port';

// Nombres de pregunta habituales en formularios de Meta Lead Ads. El payload
// completo siempre se conserva en datos_crudos aunque esta heurística falle.
const CAMPOS_EMAIL = ['email'];
const CAMPOS_TELEFONO = ['phone_number', 'phone'];
const CAMPOS_NOMBRE = ['full_name', 'first_name', 'name'];

function valorDe(
  fieldData: MetaCampoLead[],
  nombres: string[],
): string | undefined {
  for (const nombre of nombres) {
    const campo = fieldData.find((f) => f.name.toLowerCase() === nombre);
    if (campo?.values?.[0]) return campo.values[0];
  }
  return undefined;
}

export interface ContactoLead {
  nombre?: string;
  email?: string;
  telefono?: string;
}

export function extraerContactoLead(fieldData: MetaCampoLead[]): ContactoLead {
  const nombre = valorDe(fieldData, CAMPOS_NOMBRE);
  const apellido = valorDe(fieldData, ['last_name']);

  return {
    nombre: apellido && nombre ? `${nombre} ${apellido}` : nombre,
    email: valorDe(fieldData, CAMPOS_EMAIL),
    telefono: valorDe(fieldData, CAMPOS_TELEFONO),
  };
}
