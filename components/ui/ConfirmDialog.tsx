'use client';

import { Icon } from '@/components/ui/Icon';

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'danger' | 'emerald';
  icon?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

// Diálogo de confirmación para acciones que no se pueden deshacer
// (eliminar turnos, marcar asistencia, borrar notas clínicas, etc.)
export function ConfirmDialog({ title, message, confirmLabel, tone = 'danger', icon, loading, onConfirm, onClose }: Props) {
  const color = tone === 'danger' ? 'var(--danger)' : 'var(--emerald)';
  const bg = tone === 'danger' ? 'rgba(180,83,63,.1)' : 'var(--emerald-tint)';

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,24,16,.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 380, padding: '26px 24px', textAlign: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <Icon name={icon ?? (tone === 'danger' ? 'alert' : 'checkCircle')} size={24} color={color} />
        </div>
        <h2 style={{ margin: 0, fontSize: 19, fontFamily: 'var(--serif)', fontWeight: 600, color: 'var(--ink)' }}>{title}</h2>
        <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.55 }}>{message}</p>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="btn btn--outline" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            className="btn"
            style={{ flex: 1, justifyContent: 'center', background: tone === 'danger' ? 'var(--danger)' : 'var(--emerald)', color: '#fff', opacity: loading ? .6 : 1 }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Un momento…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
