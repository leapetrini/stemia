// Diagnóstico de configuración: indica qué variables ve el servidor en
// producción (solo true/false, nunca los valores) y el estado de la seña.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: services } = await supabaseAdmin
    .from('services')
    .select('name, deposit_amount, active');

  // Cuentas de Mercado Pago conectadas desde el panel (sin exponer tokens)
  const { data: mpAccounts } = await supabaseAdmin
    .from('payment_settings')
    .select('professional_id, mp_account, mp_mode, connected_at');

  return NextResponse.json({
    env: {
      MP_ACCESS_TOKEN: Boolean(process.env.MP_ACCESS_TOKEN),
      MP_WEBHOOK_SECRET: Boolean(process.env.MP_WEBHOOK_SECRET),
      NEXT_PUBLIC_SITE_URL: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    },
    mercadopago: mpAccounts ?? [],
    services: services ?? [],
  });
}
