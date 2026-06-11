import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.stemia.com.ar'),
  title: 'Stemia · Medicina estética',
  description: 'Procedimientos médicos personalizados, con criterio estético y resultados sutiles. Reservá tu consulta online.',
  openGraph: {
    title: 'Stemia · Medicina estética',
    description: 'Procedimientos médicos personalizados, con criterio estético y resultados sutiles. Reservá tu consulta online.',
    url: 'https://www.stemia.com.ar',
    siteName: 'Stemia',
    locale: 'es_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Stemia · Medicina estética',
    description: 'Procedimientos médicos personalizados, con criterio estético y resultados sutiles.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
