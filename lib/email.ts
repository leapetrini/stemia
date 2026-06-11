// Email de confirmación de turno. Usado por /api/booking (servicios sin cargo)
// y por el webhook de Mercado Pago (turnos confirmados al aprobarse la seña).
import nodemailer from 'nodemailer';

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

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

export interface BookingEmailInput {
  to: string;
  patientName: string;
  dateISO: string; // YYYY-MM-DD
  time: string; // HH:MM
  professionalName?: string;
  depositPaid?: boolean;
}

export function formatSpanishDate(dateISO: string) {
  const [y, m, d] = dateISO.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return {
    dayName: DAY_NAMES[date.getDay()],
    day: d,
    month: MONTH_NAMES[m - 1],
    year: y,
  };
}

export async function sendBookingConfirmationEmail(input: BookingEmailInput) {
  const { dayName, day, month, year } = formatSpanishDate(input.dateISO);
  const professional = input.professionalName ?? 'Dra. Valentina Calvo';
  const time = input.time.slice(0, 5);

  await transporter.sendMail({
    from: `"${professional}" <${process.env.GMAIL_USER}>`,
    to: input.to,
    subject: `Turno confirmado — ${dayName} ${day} de ${month} a las ${time} hs`,
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
                  <p style="margin:8px 0 0;font-size:15px;color:#6b7f76;">Hola ${input.patientName}, tu consulta quedó agendada.</p>
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
                            <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a2e25;text-transform:capitalize;">${dayName} ${day} de ${month} de ${year}</td>
                          </tr>
                          <tr>
                            <td style="padding:6px 0;font-size:14px;color:#6b7f76;">🕐</td>
                            <td style="padding:6px 0;font-size:14px;color:#6b7f76;">Horario</td>
                            <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a2e25;">${time} hs</td>
                          </tr>
                          <tr>
                            <td style="padding:6px 0;font-size:14px;color:#6b7f76;">👩‍⚕️</td>
                            <td style="padding:6px 0;font-size:14px;color:#6b7f76;">Profesional</td>
                            <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a2e25;">${professional}</td>
                          </tr>
                          <tr>
                            <td style="padding:6px 0;font-size:14px;color:#6b7f76;">💻</td>
                            <td style="padding:6px 0;font-size:14px;color:#6b7f76;">Modalidad</td>
                            <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a2e25;">Consulta online</td>
                          </tr>
                          ${input.depositPaid ? `
                          <tr>
                            <td style="padding:6px 0;font-size:14px;color:#6b7f76;">💳</td>
                            <td style="padding:6px 0;font-size:14px;color:#6b7f76;">Seña</td>
                            <td style="padding:6px 0;font-size:14px;font-weight:600;color:#1a2e25;">Abonada vía Mercado Pago</td>
                          </tr>` : ''}
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
}
