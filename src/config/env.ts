import 'dotenv/config';
import { transporter } from '../utils/email.js';

// Verificación de conexión SMTP
(async () => {
  try {
    await transporter.verify();
    console.log("✅ Conexión SMTP con Gmail lista");
  } catch (err) {
    console.error("❌ Error al conectar con Gmail:", err);
  }
})();

/**
 * Obtiene una variable de entorno o lanza error si no existe.
 */
function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 4000),

  BASE_URL: required('BASE_URL', 'http://localhost:4000'),
  CLIENT_ORIGINS: required('CLIENT_ORIGINS', 'http://localhost:5173'),

  MONGO_URI: required('MONGO_URI'),

  JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET'),

  ACCESS_TOKEN_TTL_MIN: Number(required('ACCESS_TOKEN_TTL_MIN', '15')),
  REFRESH_TOKEN_TTL_DAYS: Number(required('REFRESH_TOKEN_TTL_DAYS', '7')),
  SESSION_INACTIVITY_MIN: Number(required('SESSION_INACTIVITY_MIN', '20')),

  RATE_LIMIT_WINDOW_MIN: Number(required('RATE_LIMIT_WINDOW_MIN', '15')),
  RATE_LIMIT_MAX: Number(required('RATE_LIMIT_MAX', '100')),

  SMTP_HOST: required('SMTP_HOST'),
  SMTP_PORT: Number(required('SMTP_PORT', '587')),
  SMTP_SECURE: (process.env.SMTP_SECURE ?? 'false') === 'true',
  SMTP_USER: required('SMTP_USER'),
  SMTP_PASS: required('SMTP_PASS'),
  EMAIL_FROM: required('EMAIL_FROM'),

  GOOGLE_CLIENT_ID: required('GOOGLE_CLIENT_ID')
};
