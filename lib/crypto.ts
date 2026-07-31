// Cifrado simétrico para los secretos que guardamos en la base (hoy: las
// credenciales de Mercado Pago de la doctora).
//
// La clave sale de MP_TOKEN_SECRET; si no está definida se deriva del
// service role de Supabase, que ya es el secreto más sensible del servidor.
// Así la feature funciona sin agregar env vars nuevas en Vercel.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'v1';

function key(): Buffer {
  const source = process.env.MP_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!source) throw new Error('No hay clave para cifrar secretos (MP_TOKEN_SECRET)');
  return createHash('sha256').update(source).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

// Si el valor no tiene el prefijo se devuelve tal cual: permite pegar un token
// a mano en la base (o migrar valores viejos) sin romper la lectura.
export function decryptSecret(stored: string | null): string | null {
  if (!stored) return null;
  if (!stored.startsWith(`${PREFIX}:`)) return stored;

  const [, ivB64, tagB64, ctB64] = stored.split(':');
  if (!ivB64 || !tagB64 || !ctB64) return null;

  try {
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    // Clave cambiada o dato corrupto: se trata como "no configurado"
    console.error('No se pudo descifrar un secreto guardado');
    return null;
  }
}

// "APP_USR-1234…7890" → para mostrar en el panel sin exponer el token
export function maskToken(token: string): string {
  const clean = token.trim();
  if (clean.length <= 12) return '••••';
  return `${clean.slice(0, 8)}…${clean.slice(-4)}`;
}
