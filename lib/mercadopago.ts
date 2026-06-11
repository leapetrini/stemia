// Integración con Mercado Pago (Checkout Pro).
// Si MP_ACCESS_TOKEN no está configurado, isMercadoPagoEnabled() devuelve false
// y el flujo de reserva sigue funcionando sin cobro (comportamiento actual).
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { createHmac } from 'crypto';

export function isMercadoPagoEnabled(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

function client(): MercadoPagoConfig {
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new Error('MP_ACCESS_TOKEN no configurado');
  return new MercadoPagoConfig({ accessToken });
}

function siteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SITE_URL no configurado');
  return url.replace(/\/$/, '');
}

export interface DepositPreferenceInput {
  appointmentId: string;
  serviceName: string;
  amount: number;
  payerName: string;
  payerEmail: string;
}

// Crea la preferencia de Checkout Pro para la seña de un turno.
// Devuelve la URL (init_point) a la que hay que redirigir a la paciente.
export async function createDepositPreference(input: DepositPreferenceInput) {
  const base = siteUrl();
  const preference = await new Preference(client()).create({
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
      notification_url: `${base}/api/webhooks/mercadopago`,
      statement_descriptor: 'STEMIA',
    },
  });
  return { preferenceId: preference.id!, initPoint: preference.init_point! };
}

export async function getPayment(paymentId: string) {
  return new Payment(client()).get({ id: paymentId });
}

// Valida la firma x-signature de las notificaciones webhook.
// https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
// Si MP_WEBHOOK_SECRET no está configurado, no se valida (útil en desarrollo,
// pero configurarlo siempre en producción).
export function verifyWebhookSignature(opts: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
}): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!opts.xSignature) return false;

  const parts: Record<string, string> = {};
  for (const part of opts.xSignature.split(',')) {
    const [k, v] = part.split('=', 2);
    if (k && v) parts[k.trim()] = v.trim();
  }
  if (!parts.ts || !parts.v1) return false;

  const manifest = `id:${opts.dataId.toLowerCase()};request-id:${opts.xRequestId ?? ''};ts:${parts.ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');
  return expected === parts.v1;
}
