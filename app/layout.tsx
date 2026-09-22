import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clickjacking Tester',
  description: 'Ferramenta para testar incorporação de URLs em iframe.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
