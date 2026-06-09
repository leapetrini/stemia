'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Icon, Mark } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import type { Session } from '@supabase/supabase-js';

const TABS = [
  { id: 'dashboard', label: 'Inicio', icon: 'home', href: '/panel' },
  { id: 'agenda', label: 'Agenda', icon: 'calendar', href: '/panel/agenda' },
  { id: 'pacientes', label: 'Pacientes', icon: 'users', href: '/panel/pacientes' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'chat', href: '/panel/whatsapp', wa: true, badge: 3 },
  { id: 'insumos', label: 'Insumos', icon: 'box', href: '/panel/insumos' },
];

function Sidebar({ active, onLogout }: { active: string; onLogout: () => void }) {
  const router = useRouter();
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <Mark size={34} />
        <span className="sidebar__name">Stemia</span>
      </div>
      <nav className="sidenav">
        <div className="sidenav__label">Panel médico</div>
        {TABS.map(t => (
          <button key={t.id} onClick={() => router.push(t.href)}
            className={`navitem${active === t.id ? ' navitem--active' : ''}${t.wa && active === t.id ? ' navitem--wa' : ''}`}>
            <Icon name={t.icon} size={20} />
            {t.label}
            {t.badge && <span className="navitem__badge">{t.badge}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar__user">
        <Avatar initials="VC" tone="emerald" size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>Dra. V. Calvo</div>
          <div style={{ fontSize: 12, color: 'var(--faint)' }}>Administradora</div>
        </div>
        <button className="sidebar__logout" onClick={onLogout} title="Cerrar sesión">
          <Icon name="logout" size={16} />
        </button>
      </div>
    </aside>
  );
}

function TabBar({ active }: { active: string }) {
  const router = useRouter();
  return (
    <nav className="tabbar">
      {TABS.map(t => (
        <button key={t.id} onClick={() => router.push(t.href)}
          className={`tab${active === t.id ? ' tab--active' : ''}${t.wa ? ' tab--wa' : ''}`}>
          <span className="tab__wrap">
            <Icon name={t.icon} size={24} />
            {t.badge && <span className="tab__badge">{t.badge}</span>}
          </span>
          <span className="tab__label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

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

  // Login page — sin sidebar ni autenticación
  if (isLogin) return <>{children}</>;

  // Verificando sesión
  if (session === undefined || session === null) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ fontSize: 13, color: 'var(--faint)' }}>Cargando…</div>
      </div>
    );
  }

  const active = TABS.find(t => t.href === pathname)?.id ?? 'dashboard';

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <div className="shell" style={{ height: '100%' }}>
        <Sidebar active={active} onLogout={handleLogout} />
        <div className="shell__main">
          <div className="shell__scroll">
            {children}
          </div>
          <TabBar active={active} />
        </div>
      </div>
    </div>
  );
}
