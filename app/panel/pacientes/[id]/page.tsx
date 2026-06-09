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

type ClinicalNote = {
  id: string;
  date: string;
  content: string;
  created_at: string;
};

const STATUS_CHIP: Record<string, string> = {
  confirmado: 'chip--gold',
  pendiente: 'chip--silver',
  'en-sala': 'chip--silver',
  completado: 'chip--emerald',
  ausente: 'chip--danger',
  cancelado: 'chip--danger',
};
const STATUS_LABEL: Record<string, string> = {
  confirmado: 'Confirmado',
  pendiente: 'Pendiente',
  'en-sala': 'En sala',
  completado: 'Vino',
  ausente: 'No vino',
  cancelado: 'Cancelado',
};

function toLocalISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState<ClinicalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'info' | 'historia' | 'consentimiento'>('info');
  const [editing, setEditing] = useState(false);

  // Historia clínica form
  const [addingNote, setAddingNote] = useState(false);
  const [noteDate, setNoteDate] = useState(toLocalISO(new Date()));
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('patients').select('*').eq('id', id).single(),
      supabase.from('appointments')
        .select('id, date, time, duration_min, status, service:services(name)')
        .eq('patient_id', id)
        .order('date', { ascending: false }),
      supabase.from('clinical_notes')
        .select('*')
        .eq('patient_id', id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
    ]).then(([patRes, apptRes, notesRes]) => {
      setPatient(patRes.data as Patient);
      setAppointments((apptRes.data as unknown as Appointment[]) ?? []);
      setNotes((notesRes.data as ClinicalNote[]) ?? []);
      setLoading(false);
    });
  }, [id]);

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    const { data, error } = await supabase
      .from('clinical_notes')
      .insert({ patient_id: id, date: noteDate, content: noteText.trim() })
      .select().single();
    if (!error && data) {
      setNotes(prev => [data as ClinicalNote, ...prev].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)));
      setNoteText('');
      setNoteDate(toLocalISO(new Date()));
      setAddingNote(false);
    }
    setSavingNote(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    setDeletingId(noteId);
    await supabase.from('clinical_notes').delete().eq('id', noteId);
    setNotes(prev => prev.filter(n => n.id !== noteId));
    setDeletingId(null);
  };

  if (loading) {
    return <div className="page" style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>Cargando…</div>;
  }
  if (!patient) {
    return <div className="page" style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--danger)', fontSize: 13 }}>Paciente no encontrado.</div>;
  }

  const initials = patient.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const joinDate = new Date(patient.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  const today = toLocalISO(new Date());

  // Timeline: all unique dates across notes + appointments
  const allDates = [...new Set([
    ...notes.map(n => n.date),
    ...appointments.map(a => a.date),
  ])].sort().reverse();

  return (
    <>
    <div className="page scr-anim">
      {/* HEADER */}
      <div className="scrhead">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted)', fontSize: 13 }}>
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
          {(['info', 'historia', 'consentimiento'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '9px 4px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 12.5, fontWeight: tab === t ? 700 : 500,
              color: tab === t ? 'var(--emerald)' : 'var(--muted)',
              borderBottom: tab === t ? '2px solid var(--emerald)' : '2px solid transparent',
              marginBottom: -1, transition: 'color .15s',
            }}>
              {t === 'info' ? 'Datos' : t === 'historia' ? 'Historia' : 'Consentimiento'}
            </button>
          ))}
        </div>
      </div>

      <div className="px" style={{ paddingBottom: 40 }}>

        {/* DATOS TAB */}
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
                      {patient.alerts?.map(a => <span key={a} className="chip chip--danger" style={{ fontSize: 11 }}>⚠ {a}</span>)}
                    </div>
                  </div>
                )}
                {(patient.tags?.length ?? 0) > 0 && (
                  <div>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Etiquetas</span>
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {patient.tags?.map(t => <span key={t} className="chip chip--gold" style={{ fontSize: 11 }}>{t}</span>)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ padding: '16px 18px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--faint)', textTransform: 'uppercase' }}>Fotos clínicas</p>
              <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--muted)' }}>Antes · Después</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {['Antes', 'Después'].map(label => (
                  <div key={label} style={{ aspectRatio: '3/4', background: 'var(--surface-2)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1.5px dashed var(--line)', cursor: 'pointer' }}>
                    <Icon name="camera" size={22} color="var(--faint)" />
                    <span style={{ fontSize: 12, color: 'var(--faint)', fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 10, color: 'var(--faint)' }}>Agregar foto</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* HISTORIA CLÍNICA TAB */}
        {tab === 'historia' && (
          <div style={{ marginTop: 16 }}>

            {/* Formulario nueva evolución */}
            {addingNote ? (
              <div className="card" style={{ padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Nueva evolución</span>
                  <button onClick={() => { setAddingNote(false); setNoteText(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                    <Icon name="x" size={18} color="var(--muted)" />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label className="form-label">Fecha</label>
                    <input className="input" type="date" value={noteDate} onChange={e => setNoteDate(e.target.value)} max={today} />
                  </div>
                  <div>
                    <label className="form-label">Evolución / observaciones</label>
                    <textarea
                      className="input"
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      placeholder="Escribí aquí la evolución clínica, tratamiento realizado, observaciones…"
                      rows={5}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn--outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setAddingNote(false); setNoteText(''); }}>
                      Cancelar
                    </button>
                    <button className="btn btn--gold" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSaveNote} disabled={savingNote || !noteText.trim()}>
                      {savingNote ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                className="btn btn--outline"
                style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}
                onClick={() => setAddingNote(true)}
              >
                <Icon name="plus" size={15} color="var(--emerald)" /> Nueva evolución
              </button>
            )}

            {/* Timeline */}
            {allDates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--faint)' }}>
                <Icon name="file" size={36} color="var(--faint)" />
                <p style={{ marginTop: 10, fontSize: 13 }}>Sin historia clínica aún</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {allDates.map(date => {
                  const dateNotes = notes.filter(n => n.date === date);
                  const dateAppt = appointments.find(a => a.date === date);
                  const isPast = date < today;
                  return (
                    <div key={date}>
                      {/* Date header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ height: 1, flex: 1, background: 'var(--line)' }} />
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                          {fmtDate(date)}
                        </span>
                        <div style={{ height: 1, flex: 1, background: 'var(--line)' }} />
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {/* Appointment for this date */}
                        {dateAppt && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--line)' }}>
                            <Icon name="calendar" size={16} color="var(--muted)" />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>
                                {dateAppt.time.slice(0, 5)} hs
                              </span>
                              <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 6 }}>
                                {dateAppt.service?.name ?? 'Consulta'} · {dateAppt.duration_min} min
                              </span>
                            </div>
                            <span className={`chip ${STATUS_CHIP[dateAppt.status] ?? 'chip--silver'}`} style={{ fontSize: 11, padding: '3px 8px', flexShrink: 0 }}>
                              {STATUS_LABEL[dateAppt.status] ?? dateAppt.status}
                            </span>
                          </div>
                        )}

                        {/* Clinical notes for this date */}
                        {dateNotes.map(note => (
                          <div key={note.id} className="card" style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--emerald-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                                <Icon name="file" size={14} color="var(--emerald)" />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{note.content}</p>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                                  <span style={{ fontSize: 11, color: 'var(--faint)' }}>
                                    Dra. Valentina Calvo · {fmtTime(note.created_at)}
                                  </span>
                                  <button
                                    onClick={() => handleDeleteNote(note.id)}
                                    disabled={deletingId === note.id}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: deletingId === note.id ? 0.4 : 1 }}
                                    title="Eliminar nota"
                                  >
                                    <Icon name="x" size={14} color="var(--faint)" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Si solo hay turno (sin nota) y es pasado, sugerir agregar nota */}
                        {dateAppt && dateNotes.length === 0 && isPast && (
                          <button
                            onClick={() => { setNoteDate(date); setAddingNote(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: 'none', border: '1.5px dashed var(--line)', borderRadius: 10, cursor: 'pointer', color: 'var(--muted)', fontSize: 12.5, width: '100%' }}
                          >
                            <Icon name="plus" size={13} color="var(--muted)" /> Agregar evolución para este día
                          </button>
                        )}
                      </div>
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
              <button className="btn btn--gold btn--sm" onClick={() => window.print()}>
                <Icon name="printer" size={14} color="#fff" /> Imprimir
              </button>
            </div>
            <div className="card consent-form" style={{ padding: '28px 24px' }}>
              <div style={{ textAlign: 'center', marginBottom: 20, paddingBottom: 18, borderBottom: '1px solid var(--line)' }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '.14em', color: 'var(--muted)', textTransform: 'uppercase' }}>Stemia · Medicina estética · Neuquén Capital</p>
                <h2 style={{ margin: '8px 0 0', fontSize: 20, fontFamily: 'var(--serif)', color: 'var(--ink)', fontWeight: 600 }}>Acta de Consentimiento Informado</h2>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.7, marginBottom: 16 }}>
                Yo, <strong>{patient.name}</strong>{patient.age ? `, de ${patient.age} años de edad` : ''}, domiciliado/a en la ciudad de Neuquén Capital, en pleno uso de mis facultades, declaro haber recibido información completa y comprensible acerca del tratamiento médico estético a realizar por la <strong>Dra. Valentina Calvo (M.P. _________)</strong>.
              </p>
              <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '14px 16px', marginBottom: 18 }}>
                <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>Datos del/la paciente</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px', fontSize: 13 }}>
                  <div><span style={{ color: 'var(--muted)' }}>Nombre: </span>{patient.name}</div>
                  <div><span style={{ color: 'var(--muted)' }}>Edad: </span>{patient.age ?? '—'}</div>
                  <div><span style={{ color: 'var(--muted)' }}>Teléfono: </span>{patient.phone ?? '—'}</div>
                  <div><span style={{ color: 'var(--muted)' }}>Email: </span>{patient.email ?? '—'}</div>
                </div>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.7, marginBottom: 10 }}><strong>He sido informado/a sobre:</strong></p>
              <ul style={{ fontSize: 13, color: 'var(--ink)', paddingLeft: 20, lineHeight: 1.8, marginBottom: 18 }}>
                <li>La naturaleza del procedimiento a realizar, sus objetivos y técnicas empleadas.</li>
                <li>Los beneficios esperados y los posibles resultados del tratamiento.</li>
                <li>Los riesgos, complicaciones e inconvenientes previsibles y sus consecuencias.</li>
                <li>Los procedimientos alternativos existentes y sus características.</li>
                <li>Las consecuencias previsibles de no realizar el tratamiento propuesto.</li>
                <li>Los cuidados necesarios antes y después del procedimiento.</li>
              </ul>
              <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.7, marginBottom: 16 }}>
                Declaro haber tenido la oportunidad de realizar todas las preguntas que consideré necesarias, obteniendo respuestas satisfactorias. Entiendo que puedo revocar este consentimiento en cualquier momento previo al inicio del procedimiento.
              </p>
              <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.7, marginBottom: 20, padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 8, borderLeft: '3px solid var(--emerald)' }}>
                <strong>Contraindicaciones declaradas:</strong>{' '}
                {patient.alerts?.join(', ') || 'Ninguna referida por el/la paciente.'}
              </div>
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
