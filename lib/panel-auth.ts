// Autenticación de las rutas /api/panel/*.
//
// El panel es 100% cliente y habla con Supabase con la anon key, pero las
// credenciales de Mercado Pago viven en una tabla que solo el service role
// puede leer. Estas rutas son el puente: verifican el JWT de la sesión y
// recién ahí usan el service role.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

export function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export interface PanelSession {
  userId: string;
  professionalId: string;
  admin: SupabaseClient;
}

// Devuelve la sesión del panel o null si el token no sirve.
// El profesional se resuelve por professionals.user_id; si nadie está
// vinculado todavía (clínica de una sola doctora), se usa el único
// profesional existente.
export async function getPanelSession(req: NextRequest): Promise<PanelSession | null> {
  const header = req.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null;
  if (!token) return null;

  const admin = adminClient();
  const { data: userRes, error } = await admin.auth.getUser(token);
  if (error || !userRes.user) return null;

  const { data: mine } = await admin
    .from('professionals')
    .select('id')
    .eq('user_id', userRes.user.id)
    .maybeSingle();

  let professionalId = mine?.id as string | undefined;

  if (!professionalId) {
    const { data: all } = await admin.from('professionals').select('id').limit(2);
    if (all?.length === 1) professionalId = all[0].id as string;
  }

  if (!professionalId) return null;

  return { userId: userRes.user.id, professionalId, admin };
}
