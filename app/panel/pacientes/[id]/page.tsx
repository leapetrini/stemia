'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { PatientModal, type PatientData } from '@/components/panel/PatientModal';

type Patient = PatientData;

type Appointment = {
  id: string;
  date: string;
  time: string;
  duration_min: number;
  status: string;
  service: { name: string } | null;
};

const STATUS_CHIP: Record<string, string> = {
  confirmado: 'chip--emerald',
  pendiente: 'chip--gold',
  'en-sala': 'chip--silver',
  cancelado: 'chip--danger',
};

function toLocalISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'historial' | 'consentimiento'>('info');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('patients').select('*').eq('id', id).single(),
      supabase
        .from('appointments')
        .select('id, date, time, duration_min, status, service:services(name)')
        .eq('patient_id', id)
        .order('date', { ascending: false }),
    ]).then(([patRes, apptRes]) => {
      setPatient(patRes.data as Patient);
      setAppointments((apptRes.data as unknown as Appointment[]) ?? []);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <div className="page" style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>
        Cargando…
      </div>
    );
  }
  if (!patient) {
    return (
      <div className="page" style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--danger)', fontSize: 13 }}>
        Paciente no encontrado.
      </div>
    );
  }

  const initials = patient.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const joinDate = new Date(patient.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  const today = toLocalISO(new Date());

  const handlePrint = () => window.print();

  return (
    <>
    <div className="page scr-anim">
      {/* HEADER */}
      <div className="scrhead">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted)', fontSize: 13 }}
          >
            <Icon name="chevL" size={14} color="var(--muted)" /> Pacientes
          </button>
          <button className="btn btn--outline btn--sm" onClick={() => setEditing(true)}>
            <Icon name="edit" size={14} color="var(--emerald)" /> Editar
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar initials={initials} tone="gold" size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 21, fontFamily: 'var(--serif)', color: 'var(--ink)', fontWeight: 600 }}>{patient.name}</h1>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--faint)' }}>Desde {joinDate} · {appointments.length} turno{appointments.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {(patient.skin_type || (patient.tags?.length ?? 0) > 0 || (patient.alerts?.length ?? 0) > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {patient.skin_type && <span className="chip chip--silver" style={{ fontSize: 11 }}>{patient.skin_type}</span>}
            {patient.tags?.map(t => <span key={t} className="chip chip--gold" style={{ fontSize: 11 }}>{t}</span>)}
            {patient.alerts?.map(a => <span key={a} className="chip chip--danger" style={{ fontSize: 11 }}>⚠ {a}</span>)}
          </div>
        )}

        {/* TABS */}
        <div style={{ display: 'flex', marginTop: 16, borderBottom: '1px solid var(--line)' }}>
          {(['info', 'historial', 'consentimiento'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '9px 4px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 12.5, fontWeight: tab === t ? 700 : 500,
              color: tab === t ? 'var(--emerald)' : 'var(--muted)',
              borderBottom: tab === t ? '2px solid var(--emerald)' : '2px solid transparent',
              marginBottom: -1, transition: 'color .15s',
            }}>
              {t === 'info' ? 'Información' : t === 'historial' ? 'Historial' : 'Consentimiento'}
            </button>
          ))}
        </div>
      </div>

      <div className="px" style={{ paddingBottom: 40 }}>

        {/* INFO TAB */}
        {tab === 'info' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
            <div className="card" style={{ padding: '16px 18px' }}>
              <p style={{ margin: '0 0 14px', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--faint)', textTransform: 'uppercase' }}>Contacto</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {patient.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Icon name="mail" size={15} color="var(--muted)" />
                    <span style={{ fontSize: 14, color: 'var(--ink)' }}>{patient.email}</span>
                  </div>
                )}
                {patient.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Icon name="phone" size={15} color="var(--muted)" />
                    <span style={{ fontSize: 14, color: 'var(--ink)' }}>{patient.phone}</span>
                  </div>
                )}
                {patient.age && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Icon name="user" size={15} color="var(--muted)" />
                    <span style={{ fontSize: 14, color: 'var(--ink)' }}>{patient.age} años</span>
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ padding: '16px 18px' }}>
              <p style={{ margin: '0 0 14px', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--faint)', textTransform: 'uppercase' }}>Datos clínicos</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Tipo de piel</span>
                  <div style={{ fontSize: 14, color: 'var(--ink)', marginTop: 2 }}>{patient.skin_type ?? '—'}</div>
                </div>
                {(patient.alerts?.length ?? 0) > 0 && (
                  <div>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Alertas / contraindicaciones</span>
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {patient.alerts?.map(a => (
                        <span key={a} className="chip chip--danger" style={{ fontSize: 11 }}>⚠ {a}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(patient.tags?.length ?? 0) > 0 && (
                  <div>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Etiquetas</span>
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {patient.tags?.map(t => (
                        <span key={t} className="chip chip--gold" style={{ fontSize: 11 }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* FOTOS */}
            <div className="card" style={{ padding: '16px 18px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--faint)', textTransform: 'uppercase' }}>Fotos clínicas</p>
              <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--muted)' }}>Antes · Después</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {['Antes', 'Después'].map(label => (
                  <div key={label} style={{
                    aspectRatio: '3/4', background: 'var(--surface-2)', borderRadius: 10,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 8, border: '1.5px dashed var(--line)', cursor: 'pointer',
                  }}>
                    <Icon name="camera" size={22} color="var(--faint)" />
                    <span style={{ fontSize: 12, color: 'var(--faint)', fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 10, color: 'var(--faint)' }}>Agregar foto</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* HISTORIAL TAB */}
        {tab === 'historial' && (
          <div style={{ marginTop: 16 }}>
            {appointments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--faint)' }}>
                <Icon name="calendar" size={36} color="var(--faint)" />
                <p style={{ marginTop: 10, fontSize: 13 }}>Sin turnos registrados</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {appointments.map(a => {
                  const dateLabel = new Date(a.date + 'T12:00:00').toLocaleDateString('es-AR', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                  });
                  const isPast = a.date < today;
                  return (
                    <div key={a.id} className="card" style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 12, opacity: isPast ? 0.72 : 1 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', textTransform: 'capitalize' }}>
                          {dateLabel} · {a.time.slice(0, 5)} hs
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                          {a.service?.name ?? '—'} · {a.duration_min} min
                        </div>
                      </div>
                      <span className={`chip ${STATUS_CHIP[a.status] ?? 'chip--silver'}`} style={{ fontSize: 11, padding: '3px 9px' }}>
                        {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* CONSENTIMIENTO TAB */}
        {tab === 'consentimiento' && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button className="btn btn--gold btn--sm" onClick={handlePrint}>
                <Icon name="printer" size={14} color="#fff" /> Imprimir
              </button>
            </div>

            <div className="card consent-form" style={{ padding: '28px 24px' }}>
              {/* Encabezado */}
              <div style={{ textAlign: 'center', marginBottom: 20, paddingBottom: 18, borderBottom: '1px solid var(--line)' }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '.14em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Stemia · Medicina estética · Neuquén Capital
                </p>
                <h2 style={{ margin: '8px 0 0', fontSize: 20, fontFamily: 'var(--serif)', color: 'var(--ink)', fontWeight: 600 }}>
                  Acta de Consentimiento Informado
                </h2>
              </div>

              <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.7, marginBottom: 16 }}>
                Yo, <strong>{patient.name}</strong>{patient.age ? `, de ${patient.age} años de edad` : ''}, domiciliado/a en la ciudad de Neuquén Capital, en pleno uso de mis facultades, declaro haber recibido información completa y comprensible acerca del tratamiento médico estético a realizar por la <strong>Dra. Valentina Calvo (M.P. _________)</strong>.
              </p>

              {/* Datos del paciente */}
              <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '14px 16px', marginBottom: 18 }}>
                <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Datos del/la paciente
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', fontSize: 13 }}>
                  <div><span style={{ color: 'var(--muted)' }}>Nombre: </span>{patient.name}</div>
                  <div><span style={{ color: 'var(--muted)' }}>Edad: </span>{patient.age ?? '—'}</div>
                  <div><span style={{ color: 'var(--muted)' }}>Teléfono: </span>{patient.phone ?? '—'}</div>
                  <div><span style={{ color: 'var(--muted)' }}>Email: </span>{patient.email ?? '—'}</div>
                </div>
              </div>

              <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.7, marginBottom: 10 }}>
                <strong>He sido informado/a sobre:</strong>
              </p>
              <ul style={{ fontSize: 13, color: 'var(--ink)', paddingLeft: 20, lineHeight: 1.8, marginBottom: 18 }}>
                <li>La naturaleza del procedimiento a realizar, sus objetivos y técnicas empleadas.</li>
                <li>Los beneficios esperados y los posibles resultados del tratamiento.</li>
                <li>Los riesgos, complicaciones e inconvenientes previsibles y sus consecuencias.</li>
                <li>Los procedimientos alternativos existentes y sus características.</li>
                <li>Las consecuencias previsibles de no realizar el tratamiento propuesto.</li>
                <li>Los cuidados necesarios antes y después del procedimiento.</li>
              </ul>

              <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.7, marginBottom: 16 }}>
                Declaro haber tenido la oportunidad de realizar todas las preguntas que consideré necesarias, obteniendo respuestas satisfactorias. Entiendo que puedo revocar este consentimiento en cualquier momento previo al inicio del procedimiento, sin que ello derive en consecuencia alguna.
              </p>

              <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.7, marginBottom: 20, padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 8, borderLeft: '3px solid var(--emerald)' }}>
                <strong>Contraindicaciones declaradas:</strong>{' '}
                {patient.alerts?.join(', ') || 'Ninguna referida por el/la paciente.'}
              </div>

              {/* Firmas */}
              <div style={{ marginTop: 36, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderTop: '1.5px solid var(--ink)', paddingTop: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                      Firma del/la paciente<br />
                      <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--ink)' }}>{patient.name}</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ borderTop: '1.5px solid var(--ink)', paddingTop: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                      Firma y sello profesional<br />
                      <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontSize: 14, color: 'var(--ink)' }}>Dra. Valentina Calvo</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 28, textAlign: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--muted)', borderTop: '1px solid var(--line)', paddingTop: 12, display: 'inline-block' }}>
                  Fecha: Neuquén Capital, _______ de _____________________ de 20 ______
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {editing && patient && (
      <PatientModal
        patient={patient}
        onSave={updated => { setPatient(updated); setEditing(false); }}
        onClose={() => setEditing(false)}
      />
    )}
    </>
  );
}
