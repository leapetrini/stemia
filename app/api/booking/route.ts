import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { sendBookingConfirmationEmail } from '@/lib/email';
import { createDepositPreference, isMercadoPagoEnabled } from '@/lib/mercadopago';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { name, email, phone, day, time } = await req.json();

  if (!name || !email || !phone || !day || !time) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }

  // 1. Obtener professional y service de la DB
  const [profRes, svcRes] = await Promise.all([
    supabaseAdmin.from('professionals').select('id, name').limit(1).single(),
    supabaseAdmin.from('services').select('id, name, deposit_amount').eq('name', 'Consulta online de piel').eq('active', true).limit(1).single(),
  ]);

  if (profRes.error || svcRes.error) {
    console.error('Error fetching prof/svc:', profRes.error, svcRes.error);
    return NextResponse.json({ error: 'Error de configuración' }, { status: 500 });
  }

  const depositAmount = Number(svcRes.data.deposit_amount ?? 0);
  const requiresDeposit = depositAmount > 0 && isMercadoPagoEnabled();

  // 2. Buscar o crear paciente por email
  let patientId: string;
  const { data: existing } = await supabaseAdmin
    .from('patients')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    patientId = existing.id;
    await supabaseAdmin.from('patients').update({ name, phone }).eq('id', patientId);
  } else {
    const { data: newPatient, error: insertErr } = await supabaseAdmin
      .from('patients')
      .insert({ name, email, phone })
      .select('id')
      .single();

    if (insertErr || !newPatient) {
      console.error('Error creando paciente:', insertErr);
      return NextResponse.json({ error: 'No se pudo registrar el paciente' }, { status: 500 });
    }
    patientId = newPatient.id;
  }

  // 3. Crear turno. Con seña queda 'pendiente' hasta que el webhook de
  // Mercado Pago confirme el pago; sin cargo se confirma directo.
  const { data: appointment, error: apptErr } = await supabaseAdmin
    .from('appointments')
    .insert({
      patient_id: patientId,
      professional_id: profRes.data.id,
      service_id: svcRes.data.id,
      date: day.dateISO,
      time,
      duration_min: 30,
      status: requiresDeposit ? 'pendiente' : 'confirmado',
      notes: null,
      deposit_paid: false,
    })
    .select('id, date, time')
    .single();

  if (apptErr || !appointment) {
    console.error('Error creando turno:', apptErr);
    return NextResponse.json({ error: 'No se pudo guardar el turno' }, { status: 500 });
  }

  // 4a. Con seña: crear preferencia de Mercado Pago y redirigir al checkout.
  // El mail de confirmación lo manda el webhook cuando el pago se aprueba.
  if (requiresDeposit) {
    try {
      const { preferenceId, initPoint } = await createDepositPreference({
        appointmentId: appointment.id,
        serviceName: svcRes.data.name,
        amount: depositAmount,
        payerName: name,
        payerEmail: email,
      });

      const { error: payErr } = await supabaseAdmin.from('payments').insert({
        appointment_id: appointment.id,
        mp_preference_id: preferenceId,
        amount: depositAmount,
        type: 'seña',
        status: 'pendiente',
      });
      if (payErr) throw payErr;

      return NextResponse.json({ ok: true, init_point: initPoint });
    } catch (err) {
      console.error('Error creando preferencia MP:', err);
      // Sin checkout no hay forma de señar: liberar el horario
      await supabaseAdmin.from('appointments').delete().eq('id', appointment.id);
      return NextResponse.json({ error: 'No se pudo iniciar el pago. Intentá de nuevo.' }, { status: 500 });
    }
  }

  // 4b. Sin cargo: mail de confirmación inmediato
  try {
    await sendBookingConfirmationEmail({
      to: email,
      patientName: name,
      dateISO: appointment.date,
      time: appointment.time,
      professionalName: profRes.data.name,
    });
  } catch (err) {
    // El mail falla silenciosamente — el turno ya fue guardado
    console.error('Gmail error:', err);
  }

  return NextResponse.json({ ok: true });
}
