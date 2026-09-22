'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Box, Calendar, House, LogOut, MessageCircle, Tag, Users } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

const TABS: Array<{
  id: string; label: string; Icon: typeof House; href: string;
  alt?: string[]; badge?: number;
}> = [
  { id: 'dashboard', label: 'Inicio', Icon: House, href: '/panel' },
  { id: 'agenda', label: 'Agenda', Icon: Calendar, href: '/panel/agenda' },
  { id: 'pacientes', label: 'Pacientes', Icon: Users, href: '/panel/pacientes' },
  // Servicios y Cobros son la misma sección (pestañas dentro de la pantalla)
  { id: 'servicios', label: 'Servicios', Icon: Tag, href: '/panel/servicios', alt: ['/panel/pagos'] },
  { id: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle, href: '/panel/whatsapp' },
  { id: 'insumos', label: 'Insumos', Icon: Box, href: '/panel/insumos' },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  const isLogin = pathname === '/panel/login';

  useEffect(() => {
    if (isLogin) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) router.replace('/panel/login');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      if (!s) router.replace('/panel/login');
    });

    return () => subscription.unsubscribe();
  }, [isLogin, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/panel/login');
  };

  // Login page — sin shell ni autenticación
  if (isLogin) return <>{children}</>;

  if (session === undefined || session === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-ivory">
        <span className="text-[13px] text-moca">Cargando…</span>
      </div>
    );
  }

  const active = (() => {
    if (pathname === '/panel') return 'dashboard';
    return TABS
      .filter(t => t.href !== '/panel')
      .find(t => [t.href, ...(t.alt ?? [])].some(h => pathname.startsWith(h)))?.id ?? 'dashboard';
  })();

  return (
    <div className="w-full h-dvh flex items-center justify-center p-3 md:p-5 bg-ivory">
      {/* El mismo contenedor redondeado del hero: es lo que los hace el mismo
          producto. min-w-0 para que nada de adentro lo estire. */}
      <section className="relative w-full min-w-0 max-w-[1536px] h-full rounded-[1.5rem] md:rounded-[3rem] overflow-hidden flex bg-porcelain">
        {/* Sidebar · desktop */}
        <aside className="hidden md:flex w-[248px] shrink-0 flex-col bg-ivory border-r border-champagne/50">
          <div className="px-7 pt-8 pb-7">
            <span className="tracking-tighter text-xl text-espresso">Stemia</span>
          </div>

          <nav className="flex-1 px-4 flex flex-col gap-1">
            <span className="px-3 pb-2 text-[10px] text-moca uppercase tracking-wider">
              Panel médico
            </span>
            {TABS.map(({ id, label, Icon, href, badge }) => {
              const on = active === id;
              return (
                <button
                  key={id}
                  onClick={() => router.push(href)}
                  className={`pressable-soft flex items-center gap-3 px-4 py-2.5 rounded-full text-[14px] border-0 cursor-pointer text-left ${
                    on ? 'bg-espresso text-ivory' : 'bg-transparent text-moca hover:bg-porcelain'
                  }`}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="flex-1">{label}</span>
                  {badge && (
                    <span className={`min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] flex items-center justify-center ${
                      on ? 'bg-ivory text-espresso' : 'bg-espresso text-ivory'
                    }`}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="m-4 p-3 rounded-[1.25rem] bg-porcelain flex items-center gap-3">
            <span className="w-9 h-9 shrink-0 rounded-full bg-espresso text-ivory flex items-center justify-center text-[12px]">
              VC
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] text-espresso truncate">Dra. V. Calvo</span>
              <span className="block text-[11px] text-moca">Administradora</span>
            </span>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="pressable-soft w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-transparent border-0 text-moca hover:text-espresso hover:bg-ivory cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          {/* Barra superior · solo mobile */}
          <div className="md:hidden flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
            <span className="tracking-tighter text-xl text-espresso">Stemia</span>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="pressable-soft w-9 h-9 rounded-full bg-ivory border-0 flex items-center justify-center text-moca cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* min-h-0 para que el scroll viva dentro de cada pantalla. */}
          <div className="flex-1 min-h-0">{children}</div>

          {/* Tab bar · mobile */}
          <nav className="md:hidden shrink-0 flex items-stretch border-t border-champagne/50 bg-ivory">
            {TABS.map(({ id, label, Icon, href, badge }) => {
              const on = active === id;
              return (
                <button
                  key={id}
                  onClick={() => router.push(href)}
                  className={`pressable-soft flex-1 min-w-0 flex flex-col items-center gap-1 py-2.5 bg-transparent border-0 cursor-pointer ${
                    on ? 'text-espresso' : 'text-moca'
                  }`}
                >
                  <span className="relative flex">
                    <Icon className="w-[20px] h-[20px]" />
                    {badge && (
                      <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] px-1 rounded-full bg-espresso text-ivory text-[9px] flex items-center justify-center">
                        {badge}
                      </span>
                    )}
                  </span>
                  <span className="text-[9px] truncate max-w-full">{label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </section>
    </div>
  );
}
