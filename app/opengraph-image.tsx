// Imagen de vista previa al compartir el link (WhatsApp, Instagram, redes).
// Next.js la sirve automáticamente y agrega las etiquetas og:image.
import { ImageResponse } from 'next/og';

export const alt = 'Stemia · Medicina estética · Neuquén Capital';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1c1810',
          position: 'relative',
        }}
      >
        {/* marco dorado fino */}
        <div
          style={{
            position: 'absolute',
            top: 30,
            left: 30,
            right: 30,
            bottom: 30,
            border: '2px solid rgba(185,151,79,.55)',
            borderRadius: 26,
            display: 'flex',
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 70, height: 2, backgroundColor: '#b9974f', marginBottom: 40, display: 'flex' }} />
          <div style={{ fontSize: 27, letterSpacing: '.4em', marginLeft: '.4em', color: '#c4a96e', display: 'flex' }}>
            MEDICINA ESTÉTICA
          </div>
          <div style={{ fontSize: 126, fontWeight: 500, letterSpacing: '.3em', marginLeft: '.3em', color: '#ffffff', marginTop: 16, display: 'flex' }}>
            STEMIA
          </div>
          <div style={{ fontSize: 27, color: 'rgba(255,255,255,.68)', marginTop: 30, display: 'flex' }}>
            Neuquén Capital · Reservá tu consulta online
          </div>
          <div style={{ width: 70, height: 2, backgroundColor: '#b9974f', marginTop: 40, display: 'flex' }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
