'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Clock, Eye, EyeOff, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getMyProfessional } from '@/lib/professional';
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
      <div className="h-full flex flex-col">
        <div className="px-5 md:px-8 pt-4 md:pt-8 pb-3 shrink-0 flex flex-col gap-3">
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl md:text-4xl text-espresso tracking-tight leading-tight">
                Servicios
              </h1>
              <span className="text-[12px] md:text-[13px] text-moca">
                {loading
                  ? '…'
                  : `${activeCount} activo${activeCount === 1 ? '' : 's'}${withDeposit > 0 ? ` · ${withDeposit} con seña` : ''}`}
              </span>
            </div>

            <button
              disabled={!professionalId}
              onClick={() => setModal({ service: null })}
              className="pressable flex items-center gap-2 bg-espresso/90 text-ivory rounded-full pl-3 pr-4 py-1.5 hover:bg-espresso border-0 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="text-[13px]">Nuevo</span>
            </button>
          </div>

          {/* Servicios y Cobros son la misma sección, con pestañas adentro. */}
          <div className="flex gap-2">
            <span className="px-4 py-1.5 rounded-full bg-espresso text-ivory text-[13px]">
              Servicios
            </span>
            <button
              onClick={() => router.push('/panel/pagos')}
              className="pressable-soft px-4 py-1.5 rounded-full bg-ivory border border-champagne/50 text-moca hover:text-espresso text-[13px] cursor-pointer"
            >
              Cobros
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 md:px-8 pb-8">
          {error && (
            <div className="rounded-[1.25rem] bg-terracota/10 border border-terracota/25 p-4 text-[13px] text-terracota mb-3">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2.5 py-10 text-moca">
              <LoaderCircle className="spinner w-4 h-4" />
              <span className="text-[13px]">Cargando…</span>
            </div>
          )}

          {!loading && services.length === 0 && !error && (
            <div className="rounded-[1.25rem] bg-ivory border border-champagne/50 py-10 text-center text-[13px] text-moca">
              Todavía no cargaste ningún servicio
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, transform: 'translateY(8px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)' }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            className="flex flex-col gap-5"
          >
            {grouped.map(([categoria, items]) => (
              <div key={categoria} className="flex flex-col gap-2">
                <span className="text-[11px] text-moca uppercase tracking-wider">{categoria}</span>
                {items.map((s) => (
                  <div
                    key={s.id}
                    className={`p-3.5 md:p-4 rounded-[1.25rem] bg-ivory border border-champagne/50 flex items-center gap-3.5 ${
                      s.active ? '' : 'opacity-60'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] text-espresso truncate">{s.name}</span>
                        {!s.active && (
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-champagne/40 text-moca text-[10px] uppercase tracking-wider">
                            Oculto
                          </span>
                        )}
                      </div>

                      {s.description && (
                        <p className="text-[12px] text-moca leading-relaxed mt-1 line-clamp-2">
                          {s.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-porcelain text-moca">
                          <Clock className="w-3 h-3" />
                          {s.duration_min} min
                        </span>
                        <span className="text-[11px] px-2.5 py-1 rounded-full bg-espresso/10 text-espresso">
                          {(s.price ?? 0) === 0 ? 'Sin cargo' : fmtPrice(s.price)}
                        </span>
                        {(s.deposit_amount ?? 0) > 0 && (
                          <span className="text-[11px] text-moca">Seña {fmtPrice(s.deposit_amount)}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1.5 shrink-0">
                      <button
                        title={s.active ? 'Ocultar de la reserva online' : 'Mostrar en la reserva online'}
                        disabled={busyId === s.id}
                        onClick={() => toggleActive(s)}
                        className="pressable-soft w-9 h-9 rounded-[0.7rem] border border-champagne/50 bg-porcelain hover:border-espresso/20 flex items-center justify-center cursor-pointer"
                      >
                        {s.active
                          ? <Eye className="w-4 h-4 text-espresso" />
                          : <EyeOff className="w-4 h-4 text-moca" />}
                      </button>
                      <button
                        title="Editar"
                        onClick={() => setModal({ service: s })}
                        className="pressable-soft w-9 h-9 rounded-[0.7rem] border border-champagne/50 bg-porcelain hover:border-espresso/20 flex items-center justify-center cursor-pointer"
                      >
                        <Pencil className="w-4 h-4 text-espresso" />
                      </button>
                      <button
                        title="Eliminar"
                        onClick={() => setToDelete(s)}
                        className="pressable-soft w-9 h-9 rounded-[0.7rem] border border-terracota/30 bg-terracota/5 hover:bg-terracota/10 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4 text-terracota" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </motion.div>
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
