'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { PatientModal, type PatientData } from '@/components/panel/PatientModal';

type PatientRow = PatientData;

export default function PacientesPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    supabase
      .from('patients')
      .select('id, name, age, phone, email, skin_type, tags, alerts')
      .order('name')
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setPatients((data as PatientRow[]) ?? []);
        setLoading(false);
      });
  }, []);

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    (p.email ?? '').toLowerCase().includes(q.toLowerCase()) ||
    (p.phone ?? '').includes(q)
  );

  return (
    <div className="page scr-anim">
      <div className="scrhead">
        <div className="scrhead__row">
          <div>
            <h1 className="scrhead__title">Pacientes</h1>
            <p className="scrhead__sub">{loading ? '…' : `${patients.length} registrados`}</p>
          </div>
          <button className="btn btn--gold btn--sm" onClick={() => setShowNew(true)}>
            <Icon name="plus" size={15} color="#fff" /> Nuevo
          </button>
        </div>
        <div style={{ marginTop: 12, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
            <Icon name="search" size={16} color="var(--faint)" />
          </span>
          <input
            className="input"
            placeholder="Buscar por nombre, email o teléfono…"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ paddingLeft: 38 }}
          />
        </div>
      </div>

      <div className="px" style={{ paddingBottom: 24 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--faint)', fontSize: 13 }}>Cargando…</div>
        )}
        {error && (
          <div style={{ padding: '14px 16px', borderRadius: 'var(--r)', background: 'rgba(180,83,63,.08)', color: 'var(--danger)', fontSize: 13 }}>
            Error al cargar: {error}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--faint)' }}>
            <Icon name="users" size={40} color="var(--faint)" />
            <p style={{ marginTop: 12, fontSize: 14 }}>{q ? 'Sin resultados' : 'No hay pacientes aún'}</p>
          </div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--line)' }}>
            {filtered.map(p => (
              <div key={p.id} onClick={() => router.push(`/panel/pacientes/${p.id}`)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--surface)', cursor: 'pointer' }}>
                <Avatar
                  initials={p.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
                  tone="gold"
                  size={42}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>
                    {[p.age ? `${p.age} años` : null, p.skin_type].filter(Boolean).join(' · ')}
                  </div>
                  {((p.tags?.length ?? 0) > 0 || (p.alerts?.length ?? 0) > 0) && (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {p.tags?.map(tag => (
                        <span key={tag} className="chip chip--gold" style={{ fontSize: 11, padding: '3px 8px' }}>{tag}</span>
                      ))}
                      {p.alerts?.map(a => (
                        <span key={a} className="chip chip--danger" style={{ fontSize: 11, padding: '3px 8px' }}>⚠ {a}</span>
                      ))}
                    </div>
                  )}
                </div>
                <Icon name="chevR" size={16} color="var(--faint)" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {showNew && (
      <PatientModal
        onSave={newPatient => {
          setPatients(prev => [...prev, newPatient].sort((a, b) => a.name.localeCompare(b.name)));
          setShowNew(false);
          router.push(`/panel/pacientes/${newPatient.id}`);
        }}
        onClose={() => setShowNew(false)}
      />
    )}
  );
}
