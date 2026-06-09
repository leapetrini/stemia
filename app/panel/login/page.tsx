'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Mark } from '@/components/ui/Icon';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError('Email o contraseña incorrectos.');
      setLoading(false);
    } else {
      router.push('/panel');
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-tint)',
      padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <Mark size={40} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', color: 'var(--gold)', textTransform: 'uppercase' }}>STEMIA</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>Panel médico</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '32px 28px' }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontFamily: 'var(--serif)', color: 'var(--ink)', fontWeight: 600 }}>
            Bienvenida
          </h1>
          <p style={{ margin: '0 0 24px', fontSize: 13.5, color: 'var(--muted)' }}>
            Ingresá con tu cuenta para continuar.
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                Email
              </label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                Contraseña
              </label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{ fontSize: 13, color: 'var(--danger)', padding: '10px 14px', background: 'rgba(180,83,63,.07)', borderRadius: 'var(--r)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn--gold"
              style={{ marginTop: 4, width: '100%', justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
