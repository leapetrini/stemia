// Resuelve qué profesional es el usuario logueado en el panel.
//
// El vínculo es professionals.user_id. Si todavía no está vinculado (la
// clínica arrancó con una sola doctora), se usa el único profesional
// existente, que es el comportamiento que ya tenía el panel.
import { supabase } from './supabase';

export interface MyProfessional {
  id: string;
  name: string;
  title: string | null;
  initials: string | null;
}

export async function getMyProfessional(): Promise<MyProfessional | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data } = await supabase
      .from('professionals')
      .select('id, name, title, initials')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) return data as MyProfessional;
  }

  const { data: all } = await supabase
    .from('professionals')
    .select('id, name, title, initials')
    .order('name')
    .limit(1);

  return (all?.[0] as MyProfessional) ?? null;
}

// Token de la sesión para llamar a las rutas /api/panel/*
export async function panelAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
