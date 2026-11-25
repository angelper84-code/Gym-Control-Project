import './Globals.css';

export const metadata = {
  title: 'Kova Gym',
  description: 'Control de Acceso y cobros',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
