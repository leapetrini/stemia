'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight, LoaderCircle, Plus, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PatientModal, type PatientData } from '@/components/panel/PatientModal';
import { BLOCKING_STATUSES } from '@/lib/types';

type PatientRow = PatientData;

// "hace 3 días", "hace 2 meses" — más útil de un vistazo que la fecha exacta.
function sinceLabel(iso: string): string {
  const days = Math.round((Date.now() - new Date(iso + 'T12:00:00').getTime()) / 86400000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  const months = Math.round(days / 30);
  if (months < 12) return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
  const years = Math.floor(months / 12);
  return `hace ${years} año${years === 1 ? '' : 's'}`;
}

function iniciales(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function PacientesPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [lastVisits, setLastVisits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    const todayISO = new Date().toLocaleDateString('sv-SE'); // "YYYY-MM-DD" local

    Promise.all([
      supabase
        .from('patients')
        .select('id, name, age, phone, email, skin_type, tags, alerts')
        .order('name'),
      // Turnos ya pasados que no se cancelaron ni quedaron ausentes: el más
      // reciente de cada paciente es su última visita.
      supabase
        .from('appointments')
        .select('patient_id, date')
        .in('status', BLOCKING_STATUSES)
        .lte('date', todayISO)
        .order('date', { ascending: false }),
    ]).then(([patRes, apptRes]) => {
      if (patRes.error) setError(patRes.error.message);
      else setPatients((patRes.data as PatientRow[]) ?? []);

      const seen: Record<string, string> = {};
      for (const a of (apptRes.data as { patient_id: string; date: string }[]) ?? []) {
        if (a.patient_id && !seen[a.patient_id]) seen[a.patient_id] = a.date;
      }
      setLastVisits(seen);

      setLoading(false);
    });
  }, []);

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    (p.email ?? '').toLowerCase().includes(q.toLowerCase()) ||
    (p.phone ?? '').includes(q)
  );

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="px-5 md:px-8 pt-4 md:pt-8 pb-3 shrink-0 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-2xl md:text-4xl text-espresso tracking-tight leading-tight">
              Pacientes
            </h1>
            <button
              onClick={() => setShowNew(true)}
              className="pressable flex items-center gap-2 bg-espresso/90 text-ivory rounded-full pl-3 pr-4 py-1.5 hover:bg-espresso border-0 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="text-[13px]">Nueva</span>
            </button>
          </div>

          <div className="relative max-w-[480px]">
            <Search className="w-4 h-4 text-moca absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, email o teléfono…"
              className="w-full pl-11 pr-4 py-2.5 rounded-full bg-ivory border border-champagne/50 text-[14px] text-espresso placeholder:text-moca outline-none focus:border-espresso/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 md:px-8 pb-8">
          {error && (
            <div className="rounded-[1.25rem] bg-terracota/10 border border-terracota/25 p-4 text-[13px] text-terracota">
              No pudimos leer los pacientes: {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2.5 py-10 text-moca">
              <LoaderCircle className="spinner w-4 h-4" />
              <span className="text-[13px]">Cargando…</span>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="rounded-[1.25rem] bg-ivory border border-champagne/50 py-10 text-center text-[13px] text-moca">
              {q ? `Nadie coincide con «${q}»` : 'Todavía no hay pacientes cargados'}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => router.push(`/panel/pacientes/${p.id}`)}
                className="pressable-soft w-full text-left p-3.5 md:p-4 rounded-[1.25rem] bg-ivory border border-champagne/50 hover:border-espresso/20 flex items-center gap-3.5 cursor-pointer"
              >
                <span className="w-11 h-11 shrink-0 rounded-full bg-espresso/10 text-espresso flex items-center justify-center text-[14px]">
                  {iniciales(p.name)}
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] text-espresso truncate">{p.name}</span>
                  <span className="block text-[12px] text-moca truncate mt-0.5">
                    {[
                      p.age ? `${p.age} años` : null,
                      p.skin_type,
                      lastVisits[p.id] ? `última visita ${sinceLabel(lastVisits[p.id])}` : null,
                    ].filter(Boolean).join(' · ')}
                  </span>

                  {((p.tags?.length ?? 0) > 0 || (p.alerts?.length ?? 0) > 0) && (
                    <span className="flex flex-wrap items-center gap-1.5 mt-2">
                      {p.tags?.map((t) => (
                        <span key={t} className="px-2.5 py-0.5 rounded-full bg-espresso/8 text-espresso text-[11px]">
                          {t}
                        </span>
                      ))}
                      {p.alerts?.map((a) => (
                        <span
                          key={a}
                          className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-terracota/10 text-terracota text-[11px]"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {a}
                        </span>
                      ))}
                    </span>
                  )}
                </span>

                <ChevronRight className="w-5 h-5 shrink-0 text-taupe" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {showNew && (
        <PatientModal
          onSave={newPatient => {
            setPatients(prev => [...prev, newPatient].sort((a, b) => a.name.localeCompare(b.name)));
            setShowNew(false);
            router.push(`/panel/pacientes/${newPatient.id}`);
          }}
          onClose={() => setShowNew(false)}
        />
      )}
    </>
  );
}
