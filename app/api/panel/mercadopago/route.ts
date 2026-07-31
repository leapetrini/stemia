// Conexión de la cuenta de Mercado Pago de la doctora desde el panel.
//
// GET    → estado de la conexión (nunca devuelve el token completo)
// POST   → valida el access token contra MP y lo guarda cifrado
// DELETE → desconecta la cuenta
import { NextRequest, NextResponse } from 'next/server';
import { getPanelSession } from '@/lib/panel-auth';
import { encryptSecret, decryptSecret, maskToken } from '@/lib/crypto';
import { fetchMpAccount, tokenMode } from '@/lib/mercadopago';

export async function GET(req: NextRequest) {
  const session = await getPanelSession(req);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data } = await session.admin
    .from('payment_settings')
    .select('mp_access_token, mp_public_key, mp_webhook_secret, mp_account, mp_mode, connected_at, updated_at')
    .eq('professional_id', session.professionalId)
    .maybeSingle();

  const token = decryptSecret(data?.mp_access_token ?? null);

  if (!token) {
    // Sin cuenta propia: puede haber credenciales globales en Vercel
    return NextResponse.json({
      connected: false,
      envFallback: Boolean(process.env.MP_ACCESS_TOKEN),
    });
  }

  return NextResponse.json({
    connected: true,
    envFallback: false,
    account: data?.mp_account ?? null,
    mode: data?.mp_mode ?? null,
    tokenPreview: maskToken(token),
    publicKey: data?.mp_public_key ?? null,
    hasWebhookSecret: Boolean(data?.mp_webhook_secret),
    connectedAt: data?.connected_at ?? null,
    updatedAt: data?.updated_at ?? null,
  });
}

export async function POST(req: NextRequest) {
  const session = await getPanelSession(req);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const accessToken = String(body.accessToken ?? '').trim();
  const publicKey = String(body.publicKey ?? '').trim();
  const webhookSecret = String(body.webhookSecret ?? '').trim();

  // Si ya hay una cuenta conectada se pueden actualizar solo la firma del
  // webhook o la public key: los campos que quedan vacíos conservan su valor.
  const { data: current } = await session.admin
    .from('payment_settings')
    .select('mp_access_token, mp_public_key, mp_webhook_secret')
    .eq('professional_id', session.professionalId)
    .maybeSingle();

  const storedToken = decryptSecret(current?.mp_access_token ?? null);
  const token = accessToken || storedToken;

  if (!token) {
    return NextResponse.json({ error: 'Pegá el Access Token de Mercado Pago.' }, { status: 400 });
  }

  // No guardamos nada sin confirmar que el token es válido y de quién es
  let account;
  try {
    account = await fetchMpAccount(token);
  } catch (err) {
    const invalid = err instanceof Error && err.message === 'TOKEN_INVALIDO';
    console.error('Validación de token MP falló:', err);
    return NextResponse.json(
      {
        error: invalid
          ? 'Mercado Pago rechazó ese token. Revisá que sea el Access Token completo de tus credenciales.'
          : 'No pudimos verificar el token con Mercado Pago. Intentá de nuevo en un minuto.',
      },
      { status: invalid ? 400 : 502 },
    );
  }

  const nextWebhookSecret = webhookSecret
    ? encryptSecret(webhookSecret)
    : current?.mp_webhook_secret ?? null;

  const now = new Date().toISOString();
  const { error } = await session.admin.from('payment_settings').upsert({
    professional_id: session.professionalId,
    mp_access_token: encryptSecret(token),
    mp_public_key: publicKey || current?.mp_public_key || null,
    mp_webhook_secret: nextWebhookSecret,
    mp_user_id: account.id,
    mp_account: account.nickname ?? account.email,
    mp_mode: tokenMode(token),
    connected_at: now,
    updated_at: now,
  });

  if (error) {
    console.error('Error guardando credenciales MP:', error);
    return NextResponse.json({ error: 'No se pudo guardar la conexión.' }, { status: 500 });
  }

  return NextResponse.json({
    connected: true,
    envFallback: false,
    account: account.nickname ?? account.email,
    mode: tokenMode(token),
    tokenPreview: maskToken(token),
    publicKey: publicKey || current?.mp_public_key || null,
    hasWebhookSecret: Boolean(nextWebhookSecret),
    connectedAt: now,
    updatedAt: now,
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getPanelSession(req);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { error } = await session.admin
    .from('payment_settings')
    .delete()
    .eq('professional_id', session.professionalId);

  if (error) {
    console.error('Error desconectando MP:', error);
    return NextResponse.json({ error: 'No se pudo desconectar la cuenta.' }, { status: 500 });
  }

  return NextResponse.json({ connected: false, envFallback: Boolean(process.env.MP_ACCESS_TOKEN) });
}
