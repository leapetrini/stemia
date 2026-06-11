// Página de retorno del checkout de Mercado Pago (back_urls).
// Solo informa el resultado: la confirmación real del turno la hace el webhook.
import Link from 'next/link';

type Search = Promise<Record<string, string | string[] | undefined>>;

const STATES = {
  approved: {
    tone: 'var(--emerald)',
    bg: 'var(--emerald-tint)',
    symbol: '✓',
    title: '¡Pago recibido!',
    text: 'Tu seña fue acreditada y tu turno quedó confirmado. En unos minutos vas a recibir un email con todos los detalles.',
  },
  pending: {
    tone: 'var(--gold-deep)',
    bg: 'var(--gold-tint)',
    symbol: '⏳',
    title: 'Pago en proceso',
    text: 'Tu pago está siendo procesado. Apenas se acredite, tu turno quedará confirmado y te avisaremos por email.',
  },
  failure: {
    tone: 'var(--danger)',
    bg: 'rgba(180,83,63,.08)',
    symbol: '✕',
    title: 'No pudimos procesar el pago',
    text: 'El pago fue rechazado o cancelado. Tu turno quedó reservado por unos minutos: podés intentar nuevamente con otro medio de pago.',
  },
} as const;

export default async function EstadoReserva({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const raw = (params.collection_status ?? params.status) as string | undefined;

  const key: keyof typeof STATES =
    raw === 'approved' ? 'approved'
    : raw === 'pending' || raw === 'in_process' ? 'pending'
    : 'failure';
  const s = STATES[key];

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-tint)', padding: 20 }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: '40px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: 'var(--gold)', textTransform: 'uppercase' }}>
          Medicina estética
        </div>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 30, fontStyle: 'italic', color: 'var(--ink)', marginTop: 4 }}>
          Stemia
        </div>

        <div style={{ width: 72, height: 72, borderRadius: '50%', background: s.bg, color: s.tone, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '28px auto 18px' }}>
          {s.symbol}
        </div>

        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 500, color: 'var(--ink)', margin: 0, lineHeight: 1.2 }}>
          {s.title}
        </h1>
        <p style={{ fontSize: 14.5, color: 'var(--muted)', lineHeight: 1.6, margin: '12px 0 0' }}>
          {s.text}
        </p>

        <Link href="/" className="btn btn--primary btn--block" style={{ marginTop: 28 }}>
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
