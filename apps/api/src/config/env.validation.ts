/**
 * Si falta o es inválida una variable requerida, la app no arranca.
 */
export function validateEnv(env: Record<string, unknown>) {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = required.filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`Variables de entorno faltantes: ${missing.join(', ')}`);
  }
  if (String(env.JWT_SECRET).length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres');
  }

  // Con el driver de consola no hace falta nada; con Resend, la key es
  // obligatoria. Si faltara, el reset de contraseña fallaría recién cuando
  // alguien lo pidiera, y en silencio: el envío no se espera.
  if (env.MAIL_DRIVER === 'resend' && !env.RESEND_API_KEY) {
    throw new Error('MAIL_DRIVER=resend requiere RESEND_API_KEY');
  }

  return env;
}
