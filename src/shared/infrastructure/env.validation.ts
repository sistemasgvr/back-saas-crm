import * as Joi from 'joi';

function metaEncryptionKeyValidator(value: string, helpers: Joi.CustomHelpers) {
  try {
    const bytes = Buffer.from(value, 'base64');
    if (bytes.length !== 32) {
      return helpers.error('metaEncryptionKey.invalid');
    }
  } catch {
    return helpers.error('metaEncryptionKey.invalid');
  }
  return value;
}

/**
 * Valida variables de entorno al arranque.
 * En Hostinger un fallo aquí aparece en stderr.log / Runtime logs (causa típica de 503).
 *
 * NOTA: no definas PORT en hPanel — Hostinger lo inyecta vía Passenger.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('production'),

  DATABASE_URL: Joi.string()
    .pattern(/^postgresql:\/\/.+/i)
    .required()
    .messages({
      'string.pattern.base':
        'DATABASE_URL debe ser una URL postgresql:// válida',
    }),

  /** Solo Hostinger/Passenger — no fijar manualmente en hPanel. */
  PORT: Joi.number().port().optional(),

  FRONTEND_URL: Joi.string().uri().required(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),

  META_TOKEN_ENCRYPTION_KEY: Joi.string()
    .required()
    .custom(metaEncryptionKeyValidator)
    .messages({
      'metaEncryptionKey.invalid':
        'META_TOKEN_ENCRYPTION_KEY debe ser base64 que decodifique a exactamente 32 bytes',
    }),

  META_WEBHOOK_URL_TOKEN: Joi.string().min(8).required(),
  META_VERIFY_TOKEN: Joi.string().min(8).required(),
  META_OAUTH_REDIRECT_URI: Joi.string().uri().required(),
  /** Única fuente de versión Graph — usada por OAuth dialog y AxiosMetaGraphClient (Fase 14.0). */
  META_GRAPH_VERSION: Joi.string().default('v26.0'),

  // Neon / Postgres individuales (opcionales si DATABASE_URL está presente)
  PGHOST: Joi.string().optional(),
  PGDATABASE: Joi.string().optional(),
  PGUSER: Joi.string().optional(),
  PGPASSWORD: Joi.string().optional(),
  PGSSLMODE: Joi.string().optional(),
  PGCHANNELBINDING: Joi.string().optional(),

  // Seed — solo scripts locales, no requeridos en runtime
  SEED_ADMIN_EMAIL: Joi.string().email().optional(),
  SEED_ADMIN_PASSWORD: Joi.string().optional(),
  SEED_ADMIN_NOMBRE: Joi.string().optional(),
  SEED_ADMIN_APELLIDO: Joi.string().optional(),

  /** Web Push (opcional). Sin estas claves el CRM sigue con WS + toast; push queda off. */
  VAPID_PUBLIC_KEY: Joi.string().optional(),
  VAPID_PRIVATE_KEY: Joi.string().optional(),
  VAPID_SUBJECT: Joi.string().optional(),
});

export const envValidationOptions = {
  allowUnknown: true,
  abortEarly: false,
  convert: true,
} as const;
