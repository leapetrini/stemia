'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getMyProfessional } from '@/lib/professional';
import { Icon } from '@/components/ui/Icon';
import { ExpandableText } from '@/components/ui/RichText';
import { ServiceModal } from '@/components/panel/ServiceModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Service } from '@/lib/types';

const SELECT = 'id, name, category, description, price, duration_min, deposit_amount, active, professional_id';

const fmtPrice = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export default function ServiciosPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ service: Service | null } | null>(null);
  const [toDelete, setToDelete] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    getMyProfessional().then(async prof => {
      if (!prof) {
        setError('No encontramos tu perfil profesional.');
        setLoading(false);
        return;
      }
      setProfessionalId(prof.id);

      // Los servicios sin professional_id son de antes de la migración:
      // se muestran igual para poder asignarlos editándolos.
      const { data, error: err } = await supabase
        .from('services')
        .select(SELECT)
        .or(`professional_id.eq.${prof.id},professional_id.is.null`)
        .order('category')
        .order('name');

      if (err) setError(err.message);
      else setServices((data as Service[]) ?? []);
      setLoading(false);
    });
  }, []);

  const categories = useMemo(
    () => [...new Set(services.map(s => s.category).filter(Boolean))].sort(),
    [services],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const s of services) {
      const key = s.category || 'General';
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [services]);

  const activeCount = services.filter(s => s.active).length;
  const withDeposit = services.filter(s => s.active && (s.deposit_amount ?? 0) > 0).length;

  const upsertLocal = (s: Service) => {
    setServices(prev => {
      const exists = prev.some(x => x.id === s.id);
      const next = exists ? prev.map(x => (x.id === s.id ? s : x)) : [...prev, s];
      return next.sort((a, b) =>
        (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name));
    });
    setModal(null);
  };

  const toggleActive = async (s: Service) => {
    setBusyId(s.id);
    const { error: err } = await supabase.from('services').update({ active: !s.active }).eq('id', s.id);
    if (!err) setServices(prev => prev.map(x => (x.id === s.id ? { ...x, active: !s.active } : x)));
    setBusyId(null);
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const { error: err } = await supabase.from('services').delete().eq('id', toDelete.id);
    if (err) {
      // Un servicio con turnos asociados no se puede borrar: se oculta
      await supabase.from('services').update({ active: false }).eq('id', toDelete.id);
      setServices(prev => prev.map(x => (x.id === toDelete.id ? { ...x, active: false } : x)));
      setError('Ese servicio tiene turnos asociados, así que lo ocultamos en vez de borrarlo.');
    } else {
      setServices(prev => prev.filter(x => x.id !== toDelete.id));
    }
    setDeleting(false);
    setToDelete(null);
  };

  return (
    <>
      <div className="page scr-anim">
        <div className="scrhead">
          <div className="scrhead__row">
            <div>
              <h1 className="scrhead__title">Servicios</h1>
              <p className="scrhead__sub">
                {loading
                  ? '…'
                  : `${activeCount} activo${activeCount === 1 ? '' : 's'}${withDeposit > 0 ? ` · ${withDeposit} con seña` : ''}`}
              </p>
            </div>
            <button className="btn btn--gold btn--sm" disabled={!professionalId}
              onClick={() => setModal({ service: null })}>
              <Icon name="plus" size={15} color="#fff" /> Agregar
            </button>
          </div>

          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
            <button style={pillActive}>Mis servicios</button>
            <button style={pillIdle} onClick={() => router.push('/panel/pagos')}>Cobros</button>
          </div>
        </div>

        <div className="px" style={{ paddingBottom: 32 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--faint)', fontSize: 13 }}>Cargando…</div>
          )}

          {error && (
            <div style={{ padding: '12px 14px', marginBottom: 14, borderRadius: 'var(--r)', background: 'rgba(180,83,63,.08)', color: 'var(--danger)', fontSize: 13 }}>
              {error}
            </div>
          )}

          {!loading && services.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--faint)' }}>
              <Icon name="tag" size={40} color="var(--faint)" />
              <p style={{ marginTop: 12, fontSize: 14 }}>Todavía no cargaste servicios</p>
              <button className="btn btn--gold btn--sm" style={{ marginTop: 14 }}
                disabled={!professionalId} onClick={() => setModal({ service: null })}>
                <Icon name="plus" size={15} color="#fff" /> Agregar el primero
              </button>
            </div>
          )}

          {!loading && grouped.map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 9 }}>
                {cat}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.map(s => {
                  const free = (s.price ?? 0) === 0;
                  const deposit = s.deposit_amount ?? 0;
                  return (
                    <div key={s.id} className="card" style={{ padding: '14px 16px', opacity: s.active ? 1 : 0.62 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>{s.name}</span>
                            {!s.active && (
                              <span className="chip chip--silver" style={{ fontSize: 10.5, padding: '2px 8px' }}>Oculto</span>
                            )}
                          </div>

                          {/* Se muestra igual que en la reserva, así ve cómo le queda */}
                          {s.description && (
                            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6, lineHeight: 1.55 }}>
                              <ExpandableText text={s.description} collapsedHeight={60} />
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
                            <span className="chip chip--silver" style={{ fontSize: 11, padding: '3px 9px' }}>
                              <Icon name="clock" size={11} /> {s.duration_min} min
                            </span>
                            <span className={`chip ${free ? 'chip--emerald' : 'chip--gold'}`} style={{ fontSize: 11, padding: '3px 9px' }}>
                              {free ? 'Sin cargo' : fmtPrice(s.price)}
                            </span>
                            {!free && (
                              <span className="chip" style={{ fontSize: 11, padding: '3px 9px' }}>
                                {deposit > 0 ? `Seña ${fmtPrice(deposit)}` : 'Sin seña'}
                              </span>
                            )}
                            {!s.professional_id && (
                              <span className="chip chip--danger" style={{ fontSize: 11, padding: '3px 9px' }}>Sin asignar</span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                          <button className="iconbtn" title="Editar" style={sqBtn}
                            onClick={() => setModal({ service: s })}>
                            <Icon name="edit" size={15} color="var(--muted)" />
                          </button>
                          <button className="iconbtn" title={s.active ? 'Ocultar' : 'Mostrar'} style={sqBtn}
                            disabled={busyId === s.id} onClick={() => toggleActive(s)}>
                            <Icon name="power" size={15} color={s.active ? 'var(--emerald)' : 'var(--faint)'} />
                          </button>
                          <button className="iconbtn" title="Eliminar" style={sqBtn}
                            onClick={() => setToDelete(s)}>
                            <Icon name="trash" size={15} color="var(--danger)" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {!loading && services.length > 0 && (
            <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 'var(--r)', background: 'var(--surface-2)', border: '1px solid var(--line)' }}>
              <Icon name="card" size={17} color="var(--muted)" />
              <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                Para cobrar las señas online tenés que conectar tu cuenta de Mercado Pago.{' '}
                <button onClick={() => router.push('/panel/pagos')}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--emerald)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 12.5 }}>
                  Ir a Cobros
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {modal && professionalId && (
        <ServiceModal
          service={modal.service}
          professionalId={professionalId}
          categories={categories}
          onSave={upsertLocal}
          onClose={() => setModal(null)}
        />
      )}

      {toDelete && (
        <ConfirmDialog
          title="Eliminar servicio"
          message={`"${toDelete.name}" se va a dejar de ofrecer en la reserva online. Los turnos ya agendados no se modifican.`}
          confirmLabel="Eliminar"
          icon="trash"
          loading={deleting}
          onConfirm={confirmDelete}
          onClose={() => setToDelete(null)}
        />
      )}
    </>
  );
}

const pillBase: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 99, fontFamily: 'var(--sans)', cursor: 'pointer', fontSize: 13,
};
const pillActive: React.CSSProperties = {
  ...pillBase, border: 'none', background: 'var(--emerald)', color: '#fff', fontWeight: 600,
};
const pillIdle: React.CSSProperties = {
  ...pillBase, border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--muted)',
};

const sqBtn: React.CSSProperties = { width: 32, height: 32 };
