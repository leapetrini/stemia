// Webhook de Mercado Pago: confirma turnos cuando la seña se aprueba.
// Es la única fuente de verdad del pago — la página de retorno (/reserva/estado)
// es solo informativa, porque el usuario puede cerrarla antes de volver.
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { getPayment, verifyWebhookSignature } from '@/lib/mercadopago';
import { sendBookingConfirmationEmail } from '@/lib/email';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));

  const type = url.searchParams.get('type') ?? body?.type;
  const dataId = url.searchParams.get('data.id') ?? body?.data?.id;

  // MP también notifica merchant_orders y otros eventos: los ignoramos
  if (type !== 'payment' || !dataId) {
    return NextResponse.json({ ok: true });
  }

  const valid = verifyWebhookSignature({
    xSignature: req.headers.get('x-signature'),
    xRequestId: req.headers.get('x-request-id'),
    dataId: String(dataId),
  });
  if (!valid) {
    console.error('Webhook MP: firma inválida', dataId);
    return NextResponse.json({ error: 'firma inválida' }, { status: 401 });
  }

  let payment;
  try {
    payment = await getPayment(String(dataId));
  } catch (err) {
    console.error('Webhook MP: error consultando pago', dataId, err);
    // 500 hace que MP reintente la notificación más tarde
    return NextResponse.json({ error: 'error consultando pago' }, { status: 500 });
  }

  const appointmentId = payment.external_reference;
  if (!appointmentId) return NextResponse.json({ ok: true });

  const { data: payRow } = await supabaseAdmin
    .from('payments')
    .select('id, status')
    .eq('appointment_id', appointmentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!payRow) {
    console.error('Webhook MP: pago sin registro local', appointmentId);
    return NextResponse.json({ ok: true });
  }

  // Idempotencia: MP puede notificar el mismo pago varias veces
  if (payRow.status === 'aprobado') {
    return NextResponse.json({ ok: true });
  }

  if (payment.status === 'approved') {
    await supabaseAdmin
      .from('payments')
      .update({ mp_payment_id: String(payment.id), status: 'aprobado', updated_at: new Date().toISOString() })
      .eq('id', payRow.id);

    const { data: appt } = await supabaseAdmin
      .from('appointments')
      .update({ status: 'confirmado', deposit_paid: true })
      .eq('id', appointmentId)
      .select('date, time, patient:patients(name, email), professional:professionals(name)')
      .single();

    if (appt) {
      const patient = Array.isArray(appt.patient) ? appt.patient[0] : appt.patient;
      const professional = Array.isArray(appt.professional) ? appt.professional[0] : appt.professional;
      if (patient?.email) {
        try {
          await sendBookingConfirmationEmail({
            to: patient.email,
            patientName: patient.name,
            dateISO: appt.date,
            time: appt.time,
            professionalName: professional?.name,
            depositPaid: true,
          });
        } catch (err) {
          console.error('Webhook MP: error enviando mail', err);
        }
      }
    }
  } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
    // El turno queda 'pendiente': la paciente puede reintentar el pago
    // desde el mismo checkout mientras la preferencia siga vigente.
    await supabaseAdmin
      .from('payments')
      .update({ mp_payment_id: String(payment.id), status: 'rechazado', updated_at: new Date().toISOString() })
      .eq('id', payRow.id);
  }

  return NextResponse.json({ ok: true });
}
