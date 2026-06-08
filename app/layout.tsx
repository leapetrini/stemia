import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stemia · Medicina estética',
  description: 'Procedimientos médicos personalizados, con criterio estético y resultados sutiles.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
