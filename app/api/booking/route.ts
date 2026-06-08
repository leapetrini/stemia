import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
  tls: { rejectUnauthorized: false },
});

export async function POST(req: NextRequest) {
  const { name, email, phone, day, time } = await req.json();

  if (!name || !email || !phone || !day || !time) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  }

  // 1. Obtener professional y service de la DB
  const [profRes, svcRes] = await Promise.all([
    supabaseAdmin.from('professionals').select('id').limit(1).single(),
    supabaseAdmin.from('services').select('id').eq('active', true).limit(1).single(),
  ]);

  if (profRes.error || svcRes.error) {
    console.error('Error fetching prof/svc:', profRes.error, svcRes.error);
    return NextResponse.json({ error: 'Error de configuración' }, { status: 500 });
  }

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

  // 3. Crear turno
  const { error: apptErr } = await supabaseAdmin.from('appointments').insert({
    patient_id: patientId,
    professional_id: profRes.data.id,
    service_id: svcRes.data.id,
    date: day.dateISO,
    time,
    duration_min: 30,
    status: 'confirmado',
    notes: null,
    deposit_paid: false,
  });

  if (apptErr) {
    console.error('Error creando turno:', apptErr);
    return NextResponse.json({ error: 'No se pudo guardar el turno' }, { status: 500 });
  }

  // 4. Enviar mail de confirmación
  try {
    await transporter.sendMail({
      from: `"Dra. Valentina Calvo" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `Turno confirmado — ${day.dayName} ${day.day} de ${day.month} a las ${time} hs`,
      html: `
        <!DOCTYPE html>
        <html lang="es">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#f5f2ee;font-family:'Helvetica Neue',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ee;padding:32px 16px;">
            <tr><td align="center">
              <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06);">

                <tr>
                  <td style="background:#1c1810;padding:28px 32px;text-align:center;">
                    <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;color:#c4a96e;text-transform:uppercase;">MEDICINA ESTÉTICA</p>
                    <h1 style="margin:6px 0 0;font-size:26px;font-weight:400;color:#ffffff;font-family:Georgia,serif;font-style:italic;">Stemia</h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding:32px 32px 0;text-align:center;">
                    <div style="width:60px;height:60px;border-radius:50%;background:#f5ede0;margin:0 auto 16px;line-height:60px;font-size:28px;">✓</div>
                    <h2 style="margin:0;font-size:22px;font-weight:500;color:#1a2e25;font-family:Georgia,serif;">¡Turno confirmado!</h2>
                    <p style="margin:8px 0 0;font-size:15px;color:#6b7f76;">Hola ${name}, tu consulta quedó agendada.</p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:24px 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf5eb;border-radius:10px;border:1px solid #ede0c8;">
                      <tr>
                        <td style="padding:20px 24px;">
                          <p style="margin:0 0 14px;font-size:10px;font-weight:700;letter-spacing:.1em;color:#8fa89e;text-transform:uppercase;">Detalles del turno</p>
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding:6px 0;font-size:14px;color:#6b7f76;width:24px;">📅</td>
                              <td style="padding:6px 0;font-size:14px;color:#6b7f76;width:100px;">Fecha</td>
                              <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a2e25;text-transform:capitalize;">${day.dayName} ${day.day} de ${day.month} de 2026</td>
                            </tr>
                            <tr>
                              <td style="padding:6px 0;font-size:14px;color:#6b7f76;">🕐</td>
                              <td style="padding:6px 0;font-size:14px;color:#6b7f76;">Horario</td>
                              <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a2e25;">${time} hs</td>
                            </tr>
                            <tr>
                              <td style="padding:6px 0;font-size:14px;color:#6b7f76;">👩‍⚕️</td>
                              <td style="padding:6px 0;font-size:14px;color:#6b7f76;">Profesional</td>
                              <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a2e25;">Dra. Valentina Calvo</td>
                            </tr>
                            <tr>
                              <td style="padding:6px 0;font-size:14px;color:#6b7f76;">💻</td>
                              <td style="padding:6px 0;font-size:14px;color:#6b7f76;">Modalidad</td>
                              <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a2e25;">Consulta online</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 32px 28px;">
                    <p style="margin:0;padding:14px 18px;background:#fdf9f0;border-left:3px solid #b8922a;border-radius:0 8px 8px 0;font-size:13px;color:#7a6030;line-height:1.6;">
                      Te enviaremos el <strong>link de la videollamada</strong> antes del turno. ¡Recordá tenerlo a mano!
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:20px 32px;border-top:1px solid #f0ece6;text-align:center;">
                    <p style="margin:0;font-size:12px;color:#aab5b0;">Stemia · Medicina estética · Neuquén Capital</p>
                  </td>
                </tr>

              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
    });
  } catch (err) {
    // El mail falla silenciosamente — el turno ya fue guardado
    console.error('Gmail error:', err);
  }

  return NextResponse.json({ ok: true });
}
