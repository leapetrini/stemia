// Imagen de vista previa al compartir el link (WhatsApp, Instagram, redes).
// Solo la S del logo (la misma del favicon), en vector, centrada y sutil.
import { ImageResponse } from 'next/og';

export const alt = 'Stemia · Medicina estética';
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
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1c1810',
        }}
      >
        <svg width="230" height="230" viewBox="0 0 48 48" fill="none">
          <rect width="48" height="48" rx="12" fill="#1c1810" />
          <rect x="3" y="3" width="42" height="42" rx="11" stroke="#b9974f" strokeWidth="1.3" opacity="0.9" />
          <path
            d="M30.5 17.5c-1.2-1.8-3.4-2.9-6-2.9-3.4 0-6 1.9-6 4.6 0 6 12.5 3.4 12.5 9.6 0 2.9-2.8 4.9-6.5 4.9-2.9 0-5.4-1.2-6.7-3.2"
            stroke="#ffffff"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
