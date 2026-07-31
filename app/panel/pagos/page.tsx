'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { panelAuthHeader } from '@/lib/professional';
import { Icon } from '@/components/ui/Icon';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface MpStatus {
  connected: boolean;
  envFallback?: boolean;
  account?: string | null;
  mode?: 'test' | 'prod' | null;
  tokenPreview?: string | null;
  publicKey?: string | null;
  hasWebhookSecret?: boolean;
  connectedAt?: string | null;
  updatedAt?: string | null;
}

type PaymentRow = {
  id: string;
  amount: number;
  status: string;
  type: string;
  created_at: string;
  appointment: {
    date: string;
    time: string;
    patient: { name: string } | null;
    service: { name: string } | null;
  } | null;
};

const PAY_STATUS: Record<string, { label: string; cls: string }> = {
  aprobado: { label: 'Aprobado', cls: 'chip--emerald' },
  pendiente: { label: 'Pendiente', cls: 'chip--silver' },
  rechazado: { label: 'Rechazado', cls: 'chip--danger' },
  reembolsado: { label: 'Reembolsado', cls: 'chip--gold' },
};

const fmtPrice = (n: number) =>
  Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export default function PagosPage() {
  const router = useRouter();
  const [status, setStatus] = useState<MpStatus | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askDisconnect, setAskDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    (async () => {
      const headers = await panelAuthHeader();
      const [mpRes, payRes] = await Promise.all([
        fetch('/api/panel/mercadopago', { headers }),
        supabase
          .from('payments')
          .select('id, amount, status, type, created_at, appointment:appointments(date, time, patient:patients(name), service:services(name))')
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      if (mpRes.ok) setStatus(await mpRes.json());
      else setError('No pudimos leer el estado de la conexión.');

      setPayments((payRes.data as unknown as PaymentRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!accessToken.trim() && !connected) { setError('Pegá el Access Token.'); return; }
    setSaving(true);
    setError(null);

    const res = await fetch('/api/panel/mercadopago', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await panelAuthHeader()) },
      body: JSON.stringify({ accessToken, publicKey, webhookSecret }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error ?? 'No se pudo guardar.');
      setSaving(false);
      return;
    }

    setStatus(json);
    setAccessToken(''); setPublicKey(''); setWebhookSecret('');
    setForm(false);
    setSaving(false);
  };

  const disconnect = async () => {
    setDisconnecting(true);
    const res = await fetch('/api/panel/mercadopago', {
      method: 'DELETE',
      headers: await panelAuthHeader(),
    });
    if (res.ok) setStatus(await res.json());
    setDisconnecting(false);
    setAskDisconnect(false);
  };

  const connected = status?.connected ?? false;
  const isTest = status?.mode === 'test';

  return (
    <>
      <div className="page scr-anim">
        <div className="scrhead">
          <div className="scrhead__row">
            <div>
              <h1 className="scrhead__title">Cobros</h1>
              <p className="scrhead__sub">
                {loading ? '…' : connected ? 'Mercado Pago conectado' : 'Mercado Pago sin conectar'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
            <button style={pillIdle} onClick={() => router.push('/panel/servicios')}>Mis servicios</button>
            <button style={pillActive}>Cobros</button>
          </div>
        </div>

        <div className="px" style={{ paddingBottom: 40 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--faint)', fontSize: 13 }}>Cargando…</div>
          ) : (
            <>
              {/* ── Estado de la cuenta ── */}
              <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: connected ? 'var(--emerald-tint)' : 'var(--surface-2)',
                    color: connected ? 'var(--emerald)' : 'var(--faint)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon name="card" size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>Mercado Pago</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>
                      {connected
                        ? <>Las señas se acreditan en <strong>{status?.account ?? 'tu cuenta'}</strong>.</>
                        : 'Conectá tu cuenta para cobrar las señas de los turnos online.'}
                    </div>

                    {connected && (
                      <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
                        <span className={`chip chip--dot ${isTest ? 'chip--gold' : 'chip--emerald'}`} style={{ fontSize: 11, padding: '3px 9px' }}>
                          {isTest ? 'Credenciales de prueba' : 'Credenciales productivas'}
                        </span>
                        <span className="chip chip--silver" style={{ fontSize: 11, padding: '3px 9px' }}>
                          {status?.tokenPreview}
                        </span>
                        <span className={`chip ${status?.hasWebhookSecret ? 'chip--emerald' : 'chip--danger'}`} style={{ fontSize: 11, padding: '3px 9px' }}>
                          {status?.hasWebhookSecret ? 'Webhook firmado' : 'Sin clave de webhook'}
                        </span>
                      </div>
                    )}

                    {!connected && status?.envFallback && (
                      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)', padding: '9px 12px', background: 'var(--surface-2)', borderRadius: 10, lineHeight: 1.5 }}>
                        Hoy se está usando la cuenta configurada por el desarrollador en el servidor. Si conectás la tuya acá, pasa a cobrar esa.
                      </div>
                    )}
                  </div>
                </div>

                {isTest && (
                  <div style={{ marginTop: 12, padding: '10px 13px', borderRadius: 10, background: 'var(--gold-tint)', fontSize: 12.5, color: 'var(--gold-deep)', lineHeight: 1.5 }}>
                    Son credenciales de <strong>prueba</strong>: los pagos no son reales. Para cobrar de verdad, pegá las credenciales de producción.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
                  <button className={connected ? 'btn btn--outline btn--sm' : 'btn btn--gold btn--sm'}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => { setForm(f => !f); setError(null); }}>
                    {connected ? (form ? 'Cancelar' : 'Cambiar credenciales') : (form ? 'Cancelar' : 'Conectar cuenta')}
                  </button>
                  {connected && (
                    <button className="btn btn--sm" style={{ justifyContent: 'center', border: '1.5px solid var(--line)', background: 'transparent', color: 'var(--danger)' }}
                      onClick={() => setAskDisconnect(true)}>
                      Desconectar
                    </button>
                  )}
                </div>
              </div>

              {/* ── Formulario de credenciales ── */}
              {form && (
                <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>Credenciales de tu cuenta</div>
                  {connected ? (
                    <div style={{ margin: '9px 0 16px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
                      Completá solo lo que quieras cambiar. Lo que dejes vacío se mantiene como está.
                    </div>
                  ) : (
                    <ol style={{ margin: '9px 0 16px', paddingLeft: 18, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.65 }}>
                      <li>Entrá a <strong>mercadopago.com.ar/developers</strong> con tu usuario y andá a <em>Tus integraciones</em>.</li>
                      <li>Creá una aplicación (o abrí la que ya tenés) y entrá a <em>Credenciales de producción</em>.</li>
                      <li>Copiá el <strong>Access Token</strong> y pegalo acá abajo.</li>
                    </ol>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                    <div>
                      <label className="form-label">
                        Access Token {connected
                          ? <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(vacío = conservar el actual)</span>
                          : '*'}
                      </label>
                      <input className="input" type="password" autoComplete="off" spellCheck={false}
                        value={accessToken} onChange={e => setAccessToken(e.target.value)}
                        placeholder={connected ? `Actual: ${status?.tokenPreview ?? ''}` : 'APP_USR-…'} />
                      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 5 }}>
                        Se guarda cifrado y nunca se muestra completo de nuevo.
                      </div>
                    </div>

                    <div>
                      <label className="form-label">
                        Public Key <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(opcional)</span>
                      </label>
                      <input className="input" autoComplete="off" spellCheck={false}
                        value={publicKey} onChange={e => setPublicKey(e.target.value)}
                        placeholder="APP_USR-xxxx-xxxx…" />
                    </div>

                    <div>
                      <label className="form-label">
                        Clave secreta del webhook <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(recomendado)</span>
                      </label>
                      <input className="input" type="password" autoComplete="off" spellCheck={false}
                        value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)}
                        placeholder="Notificaciones → Webhooks → Firma secreta" />
                      <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 5, lineHeight: 1.5 }}>
                        En Mercado Pago, configurá el webhook apuntando a{' '}
                        <code style={{ fontSize: 11 }}>{typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/mercadopago</code>{' '}
                        y pegá acá la firma secreta. Sin ella, no podemos verificar que las notificaciones vengan de Mercado Pago.
                      </div>
                    </div>

                    {error && (
                      <div style={{ fontSize: 13, color: 'var(--danger)', padding: '10px 14px', background: 'rgba(180,83,63,.07)', borderRadius: 'var(--r)' }}>
                        {error}
                      </div>
                    )}

                    <button className="btn btn--gold" style={{ justifyContent: 'center' }} onClick={save} disabled={saving}>
                      {saving ? 'Verificando con Mercado Pago…' : 'Guardar y verificar'}
                    </button>
                  </div>
                </div>
              )}

              {!form && error && (
                <div style={{ padding: '12px 14px', marginBottom: 16, borderRadius: 'var(--r)', background: 'rgba(180,83,63,.08)', color: 'var(--danger)', fontSize: 13 }}>
                  {error}
                </div>
              )}

              {/* ── Últimos pagos ── */}
              <div className="between" style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>Últimos pagos</div>
              </div>

              {payments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--faint)', fontSize: 13, background: 'var(--surface)', borderRadius: 'var(--r-lg)', border: '1px solid var(--line)' }}>
                  Todavía no hay pagos registrados
                </div>
              ) : (
                <div className="card" style={{ padding: '2px 14px' }}>
                  {payments.map((p, i) => {
                    const st = PAY_STATUS[p.status] ?? PAY_STATUS.pendiente;
                    return (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: i < payments.length - 1 ? '1px solid var(--line)' : 'none' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.appointment?.patient?.name ?? 'Paciente'}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.type === 'seña' ? 'Seña' : 'Pago total'} · {p.appointment?.service?.name ?? 'Servicio'}
                            {p.appointment?.date ? ` · ${new Date(p.appointment.date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{fmtPrice(p.amount)}</div>
                          <span className={`chip chip--dot ${st.cls}`} style={{ fontSize: 10.5, padding: '2px 8px', marginTop: 3 }}>
                            {st.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {askDisconnect && (
        <ConfirmDialog
          title="Desconectar Mercado Pago"
          message="Se borran las credenciales guardadas. Los turnos con seña dejan de poder pagarse online hasta que conectes una cuenta de nuevo."
          confirmLabel="Desconectar"
          loading={disconnecting}
          onConfirm={disconnect}
          onClose={() => setAskDisconnect(false)}
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
