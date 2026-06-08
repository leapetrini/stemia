'use client';

import { Icon } from '@/components/ui/Icon';

export default function WhatsAppPage() {
  return (
    <div className="page scr-anim">
      <div className="scrhead">
        <div className="scrhead__row">
          <h1 className="scrhead__title">WhatsApp</h1>
        </div>
      </div>
      <div className="px" style={{ paddingTop: 60, paddingBottom: 24, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--gold-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Icon name="chat" size={32} color="var(--gold)" />
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 26, color: 'var(--ink)', marginBottom: 10 }}>Próximamente</div>
        <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 260, margin: '0 auto' }}>
          La integración con WhatsApp Business estará disponible en la próxima versión.
        </p>
      </div>
    </div>
  );
}
