// Diagnóstico de configuración: indica qué variables ve el servidor en
// producción (solo true/false, nunca los valores) y el estado de la seña.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isMercadoPagoEnabled } from '@/lib/mercadopago';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: services } = await supabaseAdmin
    .from('services')
    .select('name, deposit_amount, active');

  return NextResponse.json({
    env: {
      MP_ACCESS_TOKEN: isMercadoPagoEnabled(),
      MP_WEBHOOK_SECRET: Boolean(process.env.MP_WEBHOOK_SECRET),
      NEXT_PUBLIC_SITE_URL: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    },
    services: services ?? [],
  });
}
