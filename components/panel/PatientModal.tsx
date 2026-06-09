'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/Icon';

export type PatientData = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  age: number | null;
  skin_type: string | null;
  tags: string[] | null;
  alerts: string[] | null;
  created_at: string;
};

interface Props {
  patient?: PatientData | null;
  onSave: (p: PatientData) => void;
  onClose: () => void;
}

const SKIN_TYPES = ['Normal', 'Seca', 'Grasa', 'Mixta', 'Sensible', 'Combinada'];

export function PatientModal({ patient, onSave, onClose }: Props) {
  const isEdit = !!patient;

  const [name, setName] = useState(patient?.name ?? '');
  const [email, setEmail] = useState(patient?.email ?? '');
  const [phone, setPhone] = useState(patient?.phone ?? '');
  const [age, setAge] = useState(patient?.age?.toString() ?? '');
  const [skinType, setSkinType] = useState(patient?.skin_type ?? '');
  const [tagsRaw, setTagsRaw] = useState(patient?.tags?.join(', ') ?? '');
  const [alertsRaw, setAlertsRaw] = useState(patient?.alerts?.join(', ') ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) { setError('El nombre es obligatorio.'); return; }
    setLoading(true);
    setError(null);

    const payload = {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      age: age ? parseInt(age) : null,
      skin_type: skinType || null,
      tags: tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : null,
      alerts: alertsRaw ? alertsRaw.split(',').map(a => a.trim()).filter(Boolean) : null,
    };

    if (isEdit && patient) {
      const { data, error: err } = await supabase
        .from('patients').update(payload).eq('id', patient.id).select().single();
      if (err) { setError('No se pudo guardar. Intentá de nuevo.'); setLoading(false); return; }
      onSave(data as PatientData);
    } else {
      const { data, error: err } = await supabase
        .from('patients').insert(payload).select().single();
      if (err) { setError('No se pudo guardar. Intentá de nuevo.'); setLoading(false); return; }
      onSave(data as PatientData);
    }
    setLoading(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(28,24,16,.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
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
            {isEdit ? 'Editar paciente' : 'Nuevo paciente'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <Icon name="x" size={20} color="var(--muted)" />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '20px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label className="form-label">Nombre completo *</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre Apellido" autoComplete="name" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Email</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@..." autoComplete="email" />
            </div>
            <div>
              <label className="form-label">Teléfono</label>
              <input className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="299 000 0000" autoComplete="tel" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Edad</label>
              <input className="input" type="number" min="1" max="120" value={age} onChange={e => setAge(e.target.value)} placeholder="—" />
            </div>
            <div>
              <label className="form-label">Tipo de piel</label>
              <select className="input" value={skinType} onChange={e => setSkinType(e.target.value)}
                style={{ appearance: 'none', cursor: 'pointer' }}>
                <option value="">—</option>
                {SKIN_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Etiquetas <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(separadas por coma)</span></label>
            <input className="input" value={tagsRaw} onChange={e => setTagsRaw(e.target.value)} placeholder="Ej: VIP, Referida, Botox" />
          </div>

          <div>
            <label className="form-label">Alertas / contraindicaciones <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(separadas por coma)</span></label>
            <input className="input" value={alertsRaw} onChange={e => setAlertsRaw(e.target.value)} placeholder="Ej: Alergia lidocaína, Embarazo" />
          </div>

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
