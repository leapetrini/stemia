'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { AlertTriangle, CreditCard, LoaderCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { panelAuthHeader } from '@/lib/professional';
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

const PAY_LABEL: Record<string, string> = {
  aprobado: 'Aprobado',
  pendiente: 'Pendiente',
  rechazado: 'Rechazado',
  reembolsado: 'Reembolsado',
};

const PAY_CHIP: Record<string, string> = {
  aprobado: 'bg-espresso/10 text-espresso',
  pendiente: 'bg-champagne/40 text-moca',
  rechazado: 'bg-terracota/10 text-terracota',
  reembolsado: 'bg-champagne/40 text-moca',
};

const fmtPrice = (n: number) =>
  Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

const input = 'w-full px-5 py-3 rounded-full bg-ivory border border-champagne/50 text-[14px] text-espresso placeholder:text-moca outline-none focus:border-espresso/30';

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

  const connected = status?.connected ?? false;
  const isTest = status?.mode === 'test';

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

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="px-5 md:px-8 pt-4 md:pt-8 pb-3 shrink-0 flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-2xl md:text-4xl text-espresso tracking-tight leading-tight">Cobros</h1>
            <span className="text-[12px] md:text-[13px] text-moca">
              {loading ? '…' : connected ? 'Mercado Pago conectado' : 'Sin cobros online'}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push('/panel/servicios')}
              className="pressable-soft px-4 py-1.5 rounded-full bg-ivory border border-champagne/50 text-moca hover:text-espresso text-[13px] cursor-pointer"
            >
              Servicios
            </button>
            <span className="px-4 py-1.5 rounded-full bg-espresso text-ivory text-[13px]">Cobros</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 md:px-8 pb-8">
          {loading ? (
            <div className="flex items-center justify-center gap-2.5 py-10 text-moca">
              <LoaderCircle className="spinner w-4 h-4" />
              <span className="text-[13px]">Cargando…</span>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, transform: 'translateY(8px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
              className="flex flex-col gap-4"
            >
              {/* Estado de la conexión */}
              <div className="p-4 rounded-[1.25rem] bg-ivory border border-champagne/50 flex flex-col gap-3 max-w-[640px]">
                <div className="flex items-center gap-3.5">
                  <span className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${
                    connected ? 'bg-espresso/10' : 'bg-champagne/40'
                  }`}>
                    <CreditCard className={`w-5 h-5 ${connected ? 'text-espresso' : 'text-moca'}`} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-espresso">
                      {connected ? 'Mercado Pago conectado' : 'Mercado Pago sin conectar'}
                    </div>
                    <div className="text-[12px] text-moca mt-0.5">
                      {connected
                        ? <>Las señas se acreditan en <strong className="text-espresso">{status?.account ?? 'tu cuenta'}</strong>.</>
                        : 'Sin conectar, los servicios con seña no se pueden reservar online.'}
                    </div>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] ${
                    connected ? 'bg-espresso/10 text-espresso' : 'bg-terracota/10 text-terracota'
                  }`}>
                    {connected ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {connected && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {isTest && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-terracota/10 text-terracota text-[11px]">
                        <AlertTriangle className="w-3 h-3" />
                        Modo prueba
                      </span>
                    )}
                    {status?.tokenPreview && (
                      <span className="px-2.5 py-1 rounded-full bg-porcelain text-moca text-[11px] font-mono">
                        {status.tokenPreview}
                      </span>
                    )}
                    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] ${
                      status?.hasWebhookSecret ? 'bg-espresso/10 text-espresso' : 'bg-terracota/10 text-terracota'
                    }`}>
                      <ShieldCheck className="w-3 h-3" />
                      {status?.hasWebhookSecret ? 'Webhook firmado' : 'Sin clave de webhook'}
                    </span>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setForm(v => !v)}
                    className="pressable-soft px-4 py-1.5 rounded-full bg-porcelain border border-champagne/50 text-espresso text-[13px] cursor-pointer"
                  >
                    {form ? 'Cancelar' : connected ? 'Cambiar credenciales' : 'Conectar'}
                  </button>
                  {connected && (
                    <button
                      onClick={() => setAskDisconnect(true)}
                      className="pressable-soft px-4 py-1.5 rounded-full bg-terracota/5 border border-terracota/30 text-terracota text-[13px] cursor-pointer"
                    >
                      Desconectar
                    </button>
                  )}
                </div>

                {error && <p className="text-[13px] text-terracota leading-relaxed">{error}</p>}

                {form && (
                  <div className="flex flex-col gap-2.5 pt-1">
                    <input
                      className={input}
                      value={accessToken}
                      onChange={e => setAccessToken(e.target.value)}
                      placeholder={connected ? `Actual: ${status?.tokenPreview ?? ''}` : 'Access Token · APP_USR-…'}
                    />
                    <input
                      className={input}
                      value={publicKey}
                      onChange={e => setPublicKey(e.target.value)}
                      placeholder="Public Key (opcional)"
                    />
                    <input
                      className={input}
                      value={webhookSecret}
                      onChange={e => setWebhookSecret(e.target.value)}
                      placeholder="Clave del webhook (opcional)"
                    />
                    <button
                      onClick={save}
                      disabled={saving}
                      className="pressable flex items-center justify-center gap-2 bg-espresso/90 text-ivory rounded-full px-6 py-2.5 hover:bg-espresso self-start border-0 cursor-pointer min-w-[160px]"
                    >
                      {saving && <LoaderCircle className="spinner w-4 h-4" />}
                      <span className="text-[13px]">{saving ? 'Guardando…' : 'Guardar'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Movimientos */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] text-moca uppercase tracking-wider">
                  Últimos movimientos
                </span>
                {payments.length === 0 ? (
                  <div className="rounded-[1.25rem] bg-ivory border border-champagne/50 py-10 text-center text-[13px] text-moca">
                    Todavía no hay cobros registrados
                  </div>
                ) : (
                  <div className="rounded-[1.25rem] bg-ivory border border-champagne/50 px-4">
                    {payments.map((p, i) => (
                      <div
                        key={p.id}
                        className={`flex items-center gap-3 py-3 ${i < payments.length - 1 ? 'border-b border-champagne/40' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] text-espresso truncate">
                            {p.appointment?.patient?.name ?? 'Paciente'}
                          </div>
                          <div className="text-[11.5px] text-moca truncate mt-0.5">
                            {p.type === 'seña' ? 'Seña' : 'Pago total'} ·{' '}
                            {p.appointment?.service?.name ?? 'Servicio'} ·{' '}
                            {new Date(p.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                        <span className="text-[14px] text-espresso shrink-0 tracking-tight">
                          {fmtPrice(p.amount)}
                        </span>
                        <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] ${PAY_CHIP[p.status] ?? PAY_CHIP.pendiente}`}>
                          {PAY_LABEL[p.status] ?? p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {askDisconnect && (
        <ConfirmDialog
          title="Desconectar Mercado Pago"
          message="Los servicios con seña van a dejar de poder reservarse online hasta que vuelvas a conectar una cuenta."
          confirmLabel="Desconectar"
          tone="danger"
          loading={disconnecting}
          onConfirm={disconnect}
          onClose={() => setAskDisconnect(false)}
        />
      )}
    </>
  );
}
