// Integración con Mercado Pago (Checkout Pro).
//
// Las credenciales salen de la cuenta que la doctora conectó desde el panel
// (tabla payment_settings, cifradas). Si no conectó ninguna se usan las env
// vars MP_ACCESS_TOKEN / MP_WEBHOOK_SECRET, y si tampoco están, el flujo de
// reserva sigue funcionando sin cobro (comportamiento original).
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { createHmac } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptSecret } from './crypto';

export interface MpCredentials {
  accessToken: string;
  webhookSecret: string | null;
  source: 'panel' | 'env';
}

// Lee las credenciales del profesional. Requiere un cliente con service role:
// payment_settings tiene RLS sin políticas, nadie más puede leerla.
export async function getMpCredentials(
  admin: SupabaseClient,
  professionalId: string | null,
): Promise<MpCredentials | null> {
  if (professionalId) {
    const { data } = await admin
      .from('payment_settings')
      .select('mp_access_token, mp_webhook_secret')
      .eq('professional_id', professionalId)
      .maybeSingle();

    const accessToken = decryptSecret(data?.mp_access_token ?? null);
    if (accessToken) {
      return {
        accessToken,
        webhookSecret: decryptSecret(data?.mp_webhook_secret ?? null),
        source: 'panel',
      };
    }
  }

  const envToken = process.env.MP_ACCESS_TOKEN;
  if (!envToken) return null;
  return {
    accessToken: envToken,
    webhookSecret: process.env.MP_WEBHOOK_SECRET ?? null,
    source: 'env',
  };
}

export function isMercadoPagoEnabled(creds: MpCredentials | null): boolean {
  return Boolean(creds?.accessToken);
}

function client(accessToken: string): MercadoPagoConfig {
  return new MercadoPagoConfig({ accessToken });
}

function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SITE_URL no configurado');
  return url.replace(/\/$/, '');
}

export interface DepositPreferenceInput {
  accessToken: string;
  appointmentId: string;
  professionalId: string;
  serviceName: string;
  amount: number;
  payerName: string;
  payerEmail: string;
}

// Crea la preferencia de Checkout Pro para la seña de un turno.
// Devuelve la URL (init_point) a la que hay que redirigir a la paciente.
export async function createDepositPreference(input: DepositPreferenceInput) {
  const base = siteUrl();
  const preference = await new Preference(client(input.accessToken)).create({
    body: {
      items: [
        {
          id: input.appointmentId,
          title: `Seña — ${input.serviceName}`,
          quantity: 1,
          unit_price: input.amount,
          currency_id: 'ARS',
        },
      ],
      payer: { name: input.payerName, email: input.payerEmail },
      // external_reference vincula el pago con el turno: es lo que
      // leemos en el webhook para saber qué confirmar.
      external_reference: input.appointmentId,
      back_urls: {
        success: `${base}/reserva/estado`,
        pending: `${base}/reserva/estado`,
        failure: `${base}/reserva/estado`,
      },
      auto_return: 'approved',
      // El ?prof= le dice al webhook con qué cuenta consultar el pago:
      // cada profesional puede tener credenciales distintas.
      notification_url: `${base}/api/webhooks/mercadopago?prof=${input.professionalId}`,
      statement_descriptor: 'STEMIA',
    },
  });
  return { preferenceId: preference.id!, initPoint: preference.init_point! };
}

export async function getPayment(accessToken: string, paymentId: string) {
  return new Payment(client(accessToken)).get({ id: paymentId });
}

export interface MpAccount {
  id: string;
  nickname: string | null;
  email: string | null;
  siteId: string | null;
}

// Valida un access token contra la API de Mercado Pago y devuelve de quién es.
// Sirve para no guardar credenciales mal pegadas.
export async function fetchMpAccount(accessToken: string): Promise<MpAccount> {
  const res = await fetch('https://api.mercadopago.com/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'TOKEN_INVALIDO' : `MP respondió ${res.status}`);
  }
  const json = await res.json();
  return {
    id: String(json.id),
    nickname: json.nickname ?? null,
    email: json.email ?? null,
    siteId: json.site_id ?? null,
  };
}

// Las credenciales de prueba de MP empiezan con TEST-; las productivas con APP_USR-.
export function tokenMode(accessToken: string): 'test' | 'prod' {
  return accessToken.trim().startsWith('TEST-') ? 'test' : 'prod';
}

// Valida la firma x-signature de las notificaciones webhook.
// https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
// Si el profesional no configuró la clave secreta, no se valida (útil en
// desarrollo, pero conviene cargarla siempre en producción).
export function verifyWebhookSignature(opts: {
  secret: string | null;
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
}): boolean {
  if (!opts.secret) return true;
  if (!opts.xSignature) return false;

  const parts: Record<string, string> = {};
  for (const part of opts.xSignature.split(',')) {
    const [k, v] = part.split('=', 2);
    if (k && v) parts[k.trim()] = v.trim();
  }
  if (!parts.ts || !parts.v1) return false;

  const manifest = `id:${opts.dataId.toLowerCase()};request-id:${opts.xRequestId ?? ''};ts:${parts.ts};`;
  const expected = createHmac('sha256', opts.secret).update(manifest).digest('hex');
  return expected === parts.v1;
}
