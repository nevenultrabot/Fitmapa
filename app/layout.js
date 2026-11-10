import { Manrope } from 'next/font/google';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import Header from '@/components/Header';

const manrope = Manrope({ subsets: ['latin', 'latin-ext'], display: 'swap' });

export const metadata = {
  title: 'FitMapa — personalni treneri u Novom Sadu',
  description: 'Pronađi teretanu na mapi, izaberi personalnog trenera i zakaži termin.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#14161a',
};

export default function RootLayout({ children }) {
  return (
    <html lang="sr">
      <body className={manrope.className}>
        <Header />
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
