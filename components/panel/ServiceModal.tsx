'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/Icon';
import { RichText } from '@/components/ui/RichText';
import type { Service } from '@/lib/types';

interface Props {
  service?: Service | null;
  professionalId: string;
  // Categorías ya usadas por otros servicios, para sugerirlas
  categories: string[];
  onSave: (s: Service) => void;
  onClose: () => void;
}

const DURATIONS = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180];

// Muestra con el formato puesto: un párrafo, un renglón en blanco y una lista.
const DESCRIPTION_PLACEHOLDER = `¿No sabés qué productos usar? Esta asesoría te ayuda a entender tu piel y armar una rutina personalizada.

Incluye:
✔ Historia clínica
✔ Evaluación por fotos y videollamada
✔ Rutina de día y noche

Valor: $59.000 ARS`;

const fmtPrice = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export function ServiceModal({ service, professionalId, categories, onSave, onClose }: Props) {
  const isEdit = !!service;

  const [name, setName] = useState(service?.name ?? '');
  const [category, setCategory] = useState(service?.category ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [price, setPrice] = useState(service ? String(service.price ?? 0) : '');
  const [duration, setDuration] = useState(service?.duration_min ?? 30);
  const [deposit, setDeposit] = useState(service ? String(service.deposit_amount ?? 0) : '');
  const [active, setActive] = useState(service?.active ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceNum = Number(price) || 0;
  const depositNum = Number(deposit) || 0;

  const handleSave = async () => {
    if (!name.trim()) { setError('Poné un nombre al servicio.'); return; }
    if (priceNum < 0 || depositNum < 0) { setError('Los importes no pueden ser negativos.'); return; }
    if (priceNum > 0 && depositNum > priceNum) {
      setError('La seña no puede ser mayor que el precio del servicio.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      name: name.trim(),
      category: category.trim() || 'General',
      description: description.trim(),
      price: priceNum,
      duration_min: duration,
      // Un servicio sin cargo nunca cobra seña
      deposit_amount: priceNum > 0 ? depositNum : 0,
      active,
      professional_id: professionalId,
    };

    const query = isEdit && service
      ? supabase.from('services').update(payload).eq('id', service.id)
      : supabase.from('services').insert(payload);

    const { data, error: err } = await query.select().single();

    if (err) {
      console.error('Error guardando servicio:', err);
      setError('No se pudo guardar. Intentá de nuevo.');
      setLoading(false);
      return;
    }

    onSave(data as Service);
    setLoading(false);
  };

  return (
    <div className="anim-overlay" style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(28,24,16,.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="anim-sheet" style={{
        width: '100%', maxWidth: 520, background: 'var(--surface)',
        borderRadius: '20px 20px 0 0', padding: '0 0 env(safe-area-inset-bottom)',
        maxHeight: '92dvh', overflow: 'auto',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 0' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontFamily: 'var(--serif)', color: 'var(--ink)', fontWeight: 600 }}>
            {isEdit ? 'Editar servicio' : 'Nuevo servicio'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <Icon name="x" size={20} color="var(--muted)" />
          </button>
        </div>

        <div style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="form-label">Nombre del servicio *</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)}
              placeholder="Ej: Aplicación de toxina botulínica" />
          </div>

          <div>
            <label className="form-label">Categoría</label>
            <input className="input" value={category} onChange={e => setCategory(e.target.value)}
              placeholder="Ej: Facial" list="service-categories" />
            <datalist id="service-categories">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div>
            <label className="form-label">
              Descripción <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(la ve la paciente al reservar)</span>
            </label>
            <textarea className="input" rows={7} value={description} onChange={e => setDescription(e.target.value)}
              style={{ lineHeight: 1.55, resize: 'vertical' }}
              placeholder={DESCRIPTION_PLACEHOLDER} />
            <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 6, lineHeight: 1.5 }}>
              Se respeta cómo lo escribís: dejá un renglón en blanco para separar párrafos y
              empezá la línea con <strong>-</strong> o <strong>✔</strong> para armar una lista.
            </div>

            {/* Vista previa: exactamente como lo va a ver la paciente */}
            {description.trim() && (
              <div style={{
                marginTop: 10, padding: '12px 14px', borderRadius: 'var(--r)',
                background: 'var(--surface-2)', border: '1px solid var(--line)',
              }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>
                  Así lo ve la paciente
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>
                  <RichText text={description} />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Precio (ARS)</label>
              <input className="input" type="number" min="0" step="100" inputMode="numeric"
                value={price} onChange={e => setPrice(e.target.value)} placeholder="0" />
              <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 5 }}>
                {priceNum > 0 ? fmtPrice(priceNum) : 'Sin cargo'}
              </div>
            </div>
            <div>
              <label className="form-label">Duración</label>
              <select className="input" value={duration} onChange={e => setDuration(Number(e.target.value))}
                style={{ appearance: 'none', cursor: 'pointer' }}>
                {DURATIONS.map(d => <option key={d} value={d}>{d} minutos</option>)}
              </select>
            </div>
          </div>

          {/* Seña — solo tiene sentido con precio > 0 */}
          <div style={{
            padding: 14, borderRadius: 'var(--r)',
            background: priceNum > 0 ? 'var(--gold-tint)' : 'var(--surface-2)',
            border: '1px solid var(--line)',
            opacity: priceNum > 0 ? 1 : 0.65,
          }}>
            <label className="form-label" style={{ marginBottom: 4 }}>Seña para reservar online</label>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.45 }}>
              {priceNum > 0
                ? 'La paciente paga este monto por Mercado Pago para confirmar el turno. En 0 el turno se reserva sin pagar.'
                : 'Un servicio sin cargo no cobra seña.'}
            </div>
            <input className="input" type="number" min="0" step="100" inputMode="numeric"
              value={priceNum > 0 ? deposit : ''} onChange={e => setDeposit(e.target.value)}
              placeholder="0" disabled={priceNum === 0} />
            {priceNum > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {[0, 0.3, 0.5, 1].map(pct => {
                  const value = Math.round(priceNum * pct);
                  const isSel = depositNum === value;
                  return (
                    <button key={pct} type="button" onClick={() => setDeposit(String(value))}
                      style={{
                        padding: '6px 11px', borderRadius: 99, fontSize: 12, fontWeight: 600,
                        fontFamily: 'var(--sans)', cursor: 'pointer',
                        border: isSel ? '1.5px solid var(--gold)' : '1.5px solid var(--line)',
                        background: isSel ? 'var(--gold)' : 'var(--surface)',
                        color: isSel ? '#fff' : 'var(--muted)',
                      }}>
                      {pct === 0 ? 'Sin seña' : pct === 1 ? 'Total' : `${pct * 100}%`}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activo */}
          <button type="button" onClick={() => setActive(a => !a)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              borderRadius: 'var(--r)', border: '1px solid var(--line)', background: 'var(--surface)',
              cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'var(--sans)',
            }}>
            <div style={{
              width: 42, height: 24, borderRadius: 999, flexShrink: 0, position: 'relative',
              background: active ? 'var(--emerald)' : 'var(--line-strong)', transition: 'background .18s',
            }}>
              <div style={{
                position: 'absolute', top: 3, left: active ? 21 : 3, width: 18, height: 18,
                borderRadius: '50%', background: '#fff', transition: 'left .18s',
              }} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
                {active ? 'Visible para reservar' : 'Oculto'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
                {active ? 'Aparece en la reserva online' : 'No aparece en la reserva online'}
              </div>
            </div>
          </button>

          {error && (
            <div style={{ fontSize: 13, color: 'var(--danger)', padding: '10px 14px', background: 'rgba(180,83,63,.07)', borderRadius: 'var(--r)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="btn btn--outline" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button className="btn btn--gold" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSave} disabled={loading}>
              {loading ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
