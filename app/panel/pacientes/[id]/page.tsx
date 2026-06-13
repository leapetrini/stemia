'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { PatientModal, type PatientData } from '@/components/panel/PatientModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

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
  treatment: string | null;
  created_at: string;
};

type ClinicalPhoto = {
  id: string;
  date: string;
  path: string;
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

  // Composer de evolución: se abre dentro de un turno (pickable=false, fecha fija)
  // o como anotación suelta desde arriba (pickable=true, con selector de fecha).
  const [composer, setComposer] = useState<{ date: string; pickable: boolean } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [noteTreatment, setNoteTreatment] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Edición de una evolución ya guardada
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editTreatment, setEditTreatment] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Fotos clínicas por consulta
  const [photos, setPhotos] = useState<ClinicalPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [uploadingDate, setUploadingDate] = useState<string | null>(null);
  const [confirmPhoto, setConfirmPhoto] = useState<ClinicalPhoto | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  const loadPhotos = async () => {
    const { data } = await supabase
      .from('clinical_photos')
      .select('id, date, path, created_at')
      .eq('patient_id', id)
      .order('created_at');
    const rows = (data as ClinicalPhoto[]) ?? [];
    setPhotos(rows);
    if (rows.length > 0) {
      // bucket privado: se accede con URLs firmadas con vencimiento
      const { data: signed } = await supabase.storage
        .from('clinical-photos')
        .createSignedUrls(rows.map(p => p.path), 3600);
      const map: Record<string, string> = {};
      signed?.forEach((s, i) => { if (s.signedUrl) map[rows[i].id] = s.signedUrl; });
      setPhotoUrls(map);
    } else {
      setPhotoUrls({});
    }
  };

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
    loadPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handlePhotoUpload = async (date: string, file: File) => {
    setUploadingDate(date);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${id}/${date}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('clinical-photos').upload(path, file);
    if (!upErr) {
      await supabase.from('clinical_photos').insert({ patient_id: id, date, path });
      await loadPhotos();
    }
    setUploadingDate(null);
  };

  const handleDeletePhoto = async (photo: ClinicalPhoto) => {
    setDeletingPhotoId(photo.id);
    await supabase.storage.from('clinical-photos').remove([photo.path]);
    await supabase.from('clinical_photos').delete().eq('id', photo.id);
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    setDeletingPhotoId(null);
    setConfirmPhoto(null);
  };

  const openComposer = (date: string, pickable = false) => {
    setEditingId(null);
    setComposer({ date, pickable });
    setNoteText('');
    setNoteTreatment('');
  };

  const closeComposer = () => {
    setComposer(null);
    setNoteText('');
    setNoteTreatment('');
  };

  const handleSaveNote = async () => {
    if (!composer || !noteText.trim()) return;
    setSavingNote(true);
    const { data, error } = await supabase
      .from('clinical_notes')
      .insert({ patient_id: id, date: composer.date, content: noteText.trim(), treatment: noteTreatment.trim() || null })
      .select().single();
    if (!error && data) {
      setNotes(prev => [data as ClinicalNote, ...prev].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)));
      closeComposer();
    }
    setSavingNote(false);
  };

  const startEdit = (note: ClinicalNote) => {
    setComposer(null);
    setEditingId(note.id);
    setEditText(note.content);
    setEditTreatment(note.treatment ?? '');
  };

  const handleUpdateNote = async () => {
    if (!editingId || !editText.trim()) return;
    setSavingEdit(true);
    const { data, error } = await supabase
      .from('clinical_notes')
      .update({ content: editText.trim(), treatment: editTreatment.trim() || null })
      .eq('id', editingId).select().single();
    if (!error && data) {
      setNotes(prev => prev.map(n => n.id === editingId ? (data as ClinicalNote) : n));
      setEditingId(null);
      setEditText('');
      setEditTreatment('');
    }
    setSavingEdit(false);
  };

  const handleDeleteNote = async (noteId: string) => {
    setDeletingId(noteId);
    await supabase.from('clinical_notes').delete().eq('id', noteId);
    setNotes(prev => prev.filter(n => n.id !== noteId));
    setDeletingId(null);
    setConfirmDeleteId(null);
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

  // Timeline: all unique dates across notes + appointments + photos
  const allDates = [...new Set([
    ...notes.map(n => n.date),
    ...appointments.map(a => a.date),
    ...photos.map(p => p.date),
  ])].sort().reverse();

  const iconBtnStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', padding: 3,
    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6,
  };

  // Formulario para escribir una evolución (inline en un turno o suelta).
  const renderComposer = (showDatePicker: boolean) => (
    <div className="card" style={{ padding: '14px 16px', border: '1.5px solid var(--emerald)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {showDatePicker && (
          <div>
            <label className="form-label">Fecha</label>
            <input className="input" type="date" value={composer?.date ?? today} max={today}
              onChange={e => setComposer(c => (c ? { ...c, date: e.target.value } : c))} />
          </div>
        )}
        <div>
          <label className="form-label">Tratamiento realizado (opcional)</label>
          <input className="input" value={noteTreatment} onChange={e => setNoteTreatment(e.target.value)}
            placeholder="Ej. Limpieza facial profunda, peeling…" />
        </div>
        <div>
          <label className="form-label">Evolución / observaciones</label>
          <textarea className="input" value={noteText} onChange={e => setNoteText(e.target.value)}
            placeholder="Escribí la evolución, observaciones, indicaciones…" rows={5}
            style={{ resize: 'vertical', lineHeight: 1.6 }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn--outline" style={{ flex: 1, justifyContent: 'center' }} onClick={closeComposer}>Cancelar</button>
          <button className="btn btn--gold" style={{ flex: 1, justifyContent: 'center' }} onClick={handleSaveNote} disabled={savingNote || !noteText.trim()}>
            {savingNote ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );

  // Formulario para editar una evolución existente.
  const renderEditForm = () => (
    <div className="card" style={{ padding: '14px 16px', border: '1.5px solid var(--emerald)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label className="form-label">Tratamiento realizado (opcional)</label>
          <input className="input" value={editTreatment} onChange={e => setEditTreatment(e.target.value)}
            placeholder="Ej. Limpieza facial profunda, peeling…" />
        </div>
        <div>
          <label className="form-label">Evolución / observaciones</label>
          <textarea className="input" value={editText} onChange={e => setEditText(e.target.value)}
            rows={5} style={{ resize: 'vertical', lineHeight: 1.6 }} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn--outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setEditingId(null); setEditText(''); setEditTreatment(''); }}>Cancelar</button>
          <button className="btn btn--gold" style={{ flex: 1, justifyContent: 'center' }} onClick={handleUpdateNote} disabled={savingEdit || !editText.trim()}>
            {savingEdit ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );

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

          </div>
        )}

        {/* HISTORIA CLÍNICA TAB — una tarjeta por turno (evento) */}
        {tab === 'historia' && (
          <div style={{ marginTop: 16 }}>

            {/* Anotación suelta (sin turno asociado) */}
            {composer?.pickable ? (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Nueva anotación</div>
                {renderComposer(true)}
              </div>
            ) : (
              <button
                className="btn btn--outline"
                style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}
                onClick={() => openComposer(today, true)}
              >
                <Icon name="plus" size={15} color="var(--emerald)" /> Nueva anotación
              </button>
            )}

            {allDates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--faint)' }}>
                <Icon name="file" size={36} color="var(--faint)" />
                <p style={{ marginTop: 10, fontSize: 13 }}>Sin historia clínica aún</p>
                <p style={{ marginTop: 4, fontSize: 12 }}>Los turnos del paciente van a aparecer acá.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {allDates.map(date => {
                  const dateAppts = appointments.filter(a => a.date === date);
                  const dateNotes = notes.filter(n => n.date === date);
                  const datePhotos = photos.filter(p => p.date === date);
                  const composing = !!composer && !composer.pickable && composer.date === date;

                  return (
                    <div key={date} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      {/* Cabecera del evento: fecha + turno(s) y por qué fue */}
                      <div style={{ padding: '14px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
                        <div style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 15, color: 'var(--ink)', textTransform: 'capitalize' }}>
                          {fmtDate(date)}
                        </div>
                        {dateAppts.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                            {dateAppts.map(a => (
                              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Icon name="clock" size={14} color="var(--muted)" />
                                <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{a.time.slice(0, 5)} hs</span>
                                <span style={{ fontSize: 12.5, color: 'var(--muted)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {a.service?.name ?? 'Consulta'}
                                </span>
                                <span className={`chip ${STATUS_CHIP[a.status] ?? 'chip--silver'}`} style={{ fontSize: 10.5, padding: '2px 8px', marginLeft: 'auto', flexShrink: 0 }}>
                                  {STATUS_LABEL[a.status] ?? a.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 4 }}>Anotación sin turno</div>
                        )}
                      </div>

                      {/* Cuerpo: evolución + fotos, todo dentro del evento */}
                      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

                        {/* Evolución */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--faint)', textTransform: 'uppercase', marginBottom: 8 }}>Evolución</div>
                          {dateNotes.length === 0 && !composing && (
                            <div style={{ fontSize: 12.5, color: 'var(--faint)', marginBottom: 10 }}>Todavía no escribiste la evolución de este turno.</div>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {dateNotes.map(note => editingId === note.id ? (
                              <div key={note.id}>{renderEditForm()}</div>
                            ) : (
                              <div key={note.id} style={{ padding: '12px 14px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--line)' }}>
                                {note.treatment && (
                                  <span className="chip chip--gold" style={{ fontSize: 11, padding: '3px 9px', marginBottom: 7 }}>{note.treatment}</span>
                                )}
                                <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{note.content}</p>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                                  <span style={{ fontSize: 11, color: 'var(--faint)' }}>Dra. Valentina Calvo · {fmtTime(note.created_at)}</span>
                                  <div style={{ display: 'flex', gap: 2 }}>
                                    <button onClick={() => startEdit(note)} title="Editar" style={iconBtnStyle}>
                                      <Icon name="edit" size={13} color="var(--muted)" />
                                    </button>
                                    <button onClick={() => setConfirmDeleteId(note.id)} disabled={deletingId === note.id}
                                      title="Eliminar" style={{ ...iconBtnStyle, opacity: deletingId === note.id ? 0.4 : 1 }}>
                                      <Icon name="x" size={14} color="var(--faint)" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {composing ? (
                            <div style={{ marginTop: dateNotes.length ? 8 : 0 }}>{renderComposer(false)}</div>
                          ) : !editingId && (
                            <button
                              onClick={() => openComposer(date)}
                              style={{ marginTop: dateNotes.length ? 8 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', background: 'none', border: '1.5px dashed var(--line)', borderRadius: 10, cursor: 'pointer', color: 'var(--emerald)', fontSize: 12.5, fontWeight: 600, width: '100%' }}
                            >
                              <Icon name="plus" size={13} color="var(--emerald)" /> {dateNotes.length ? 'Agregar otra evolución' : 'Escribir evolución'}
                            </button>
                          )}
                        </div>

                        {/* Fotos del evento */}
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', color: 'var(--faint)', textTransform: 'uppercase', marginBottom: 8 }}>Fotos</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {datePhotos.map(ph => (
                              <div key={ph.id} style={{ position: 'relative', width: 84, height: 84 }}>
                                {photoUrls[ph.id] ? (
                                  <a href={photoUrls[ph.id]} target="_blank" rel="noreferrer">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={photoUrls[ph.id]} alt="Foto clínica"
                                      style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)', display: 'block' }} />
                                  </a>
                                ) : (
                                  <div style={{ width: 84, height: 84, borderRadius: 10, background: 'var(--surface-2)' }} />
                                )}
                                <button
                                  onClick={() => setConfirmPhoto(ph)}
                                  title="Eliminar foto"
                                  style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--sh-sm)' }}>
                                  <Icon name="x" size={11} color="var(--muted)" />
                                </button>
                              </div>
                            ))}
                            <label htmlFor={`photo-input-${date}`} style={{
                              width: 84, height: 84, borderRadius: 10, border: '1.5px dashed var(--line)',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                              cursor: uploadingDate === date ? 'wait' : 'pointer', color: 'var(--faint)',
                              opacity: uploadingDate === date ? 0.5 : 1,
                            }}>
                              <Icon name="camera" size={18} color="var(--faint)" />
                              <span style={{ fontSize: 10, fontWeight: 600 }}>{uploadingDate === date ? 'Subiendo…' : 'Foto'}</span>
                              <input
                                id={`photo-input-${date}`}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                disabled={uploadingDate === date}
                                onChange={e => {
                                  const f = e.target.files?.[0];
                                  if (f) handlePhotoUpload(date, f);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>
                        </div>

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

    {confirmDeleteId && (
      <ConfirmDialog
        title="Eliminar nota clínica"
        message="La nota se eliminará definitivamente de la historia clínica. Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        tone="danger"
        loading={deletingId === confirmDeleteId}
        onConfirm={() => handleDeleteNote(confirmDeleteId)}
        onClose={() => setConfirmDeleteId(null)}
      />
    )}

    {confirmPhoto && (
      <ConfirmDialog
        title="Eliminar foto clínica"
        message="La foto se eliminará definitivamente de la historia clínica. Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        tone="danger"
        loading={deletingPhotoId === confirmPhoto.id}
        onConfirm={() => handleDeletePhoto(confirmPhoto)}
        onClose={() => setConfirmPhoto(null)}
      />
    )}

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
